const fs = require('fs');

const {
  ATTEMPT_RESIDUE_AUDITS,
  EXPECTED_DEV_IDENTITY,
  RELEASE_CONTRACT_RESIDUE_AUDITS,
  REAL_CONTRACT_OBJECTS,
  ROLLBACK_FIXTURE_OBJECTS,
  createFixtureIdentity,
  createFixtureLedger,
  failureReport,
  mutationControlFromArgs,
  parseArgs,
  runRealMysqlReleaseContract,
  runRollbackContracts,
  serializeFailure,
} = require('../scripts/real-mysql-release-contract');

const RESIDUE_AUDIT_COLUMNS = Object.freeze({
  staff_profiles: ['id', 'cognito_sub', 'email'],
  client_file_import_run: ['id', 'request_hash', 'file_name', 'worksheet_name'],
  client_file_import_identity_claim: ['id', 'identity_key'],
  iset_event_entry: ['id', 'category', 'event_type', 'captured_by'],
  iset_event_delivery: ['id', 'event_id', 'payload_json'],
  user: ['id', 'email'],
  client: ['id', 'last_name', 'applicant_account_email'],
  iset_case: ['id', 'case_number'],
  iset_application: ['id', 'client_id', 'case_id'],
  funding_overview_series: ['id', 'case_id'],
  funding_overview_version: ['id', 'series_id'],
  funding_overview_version_documents: ['id', 'funding_overview_version_id'],
  iset_document: ['id', 'file_path'],
});

const RESIDUE_AUDIT_FOREIGN_KEYS = Object.freeze({
  iset_application: Object.freeze([
    Object.freeze({ name: 'fk_iset_application_client_id', column: 'client_id', target: 'client' }),
    Object.freeze({ name: 'fk_iset_application_case_id', column: 'case_id', target: 'iset_case' }),
  ]),
  funding_overview_series: Object.freeze([
    Object.freeze({ name: 'fk_funding_overview_series_case', column: 'case_id', target: 'iset_case' }),
  ]),
  funding_overview_version: Object.freeze([
    Object.freeze({ name: 'fk_funding_overview_version_series', column: 'series_id', target: 'funding_overview_series' }),
  ]),
  funding_overview_version_documents: Object.freeze([
    Object.freeze({
      name: 'fk_funding_overview_documents_version',
      column: 'funding_overview_version_id',
      target: 'funding_overview_version',
    }),
  ]),
});

function column(Field, overrides = {}) {
  return {
    Field,
    Type: 'bigint',
    Collation: null,
    Null: 'NO',
    Key: 'PRI',
    Default: null,
    Extra: 'auto_increment',
    ...overrides,
  };
}

function createPreflightDriver({ wrongIdentity = false, omitObject = null, residueCounts = {} } = {}) {
  const objectNames = new Set(REAL_CONTRACT_OBJECTS.filter(name => name !== omitObject));
  const columnsByObject = new Map(REAL_CONTRACT_OBJECTS.map(name => [
    name,
    RESIDUE_AUDIT_COLUMNS[name] || ['id'],
  ]));
  const residueAuditBySql = new Map([...RELEASE_CONTRACT_RESIDUE_AUDITS, ...ATTEMPT_RESIDUE_AUDITS].map(audit => [
    audit.sql.trim().replace(/\s+/g, ' '),
    audit,
  ]));
  const query = jest.fn(async (sql, params = []) => {
    const normalized = String(sql).trim().replace(/\s+/g, ' ');
    if (normalized === 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()') {
      return [[{
        'DATABASE()': wrongIdentity ? 'prod_database' : EXPECTED_DEV_IDENTITY.database,
        '@@hostname': EXPECTED_DEV_IDENTITY.serverHostname,
        '@@port': EXPECTED_DEV_IDENTITY.port,
        'CURRENT_USER()': EXPECTED_DEV_IDENTITY.currentUser,
        'VERSION()': EXPECTED_DEV_IDENTITY.version,
      }], []];
    }
    if (normalized.startsWith('SHOW FULL TABLES FROM `iset_intake` LIKE ?')) {
      const name = params[0];
      return [objectNames.has(name)
        ? [{ Tables_in_iset_intake: name, Table_type: 'BASE TABLE' }]
        : [], []];
    }
    const create = /^SHOW CREATE TABLE `([^`]+)`$/u.exec(normalized);
    if (create && objectNames.has(create[1])) {
      const definitions = columnsByObject.get(create[1])
        .map(name => `\`${name}\` ${name === 'id' || name.endsWith('_id') ? 'bigint' : 'varchar(255)'} ${name === 'id' ? 'NOT NULL AUTO_INCREMENT' : 'NULL'}`)
        .join(', ');
      return [[{
        Table: create[1],
        'Create Table': `CREATE TABLE \`${create[1]}\` (${definitions}, PRIMARY KEY (\`id\`))`,
      }], []];
    }
    const columns = /^SHOW FULL COLUMNS FROM `([^`]+)`$/u.exec(normalized);
    if (columns && objectNames.has(columns[1])) {
      return [columnsByObject.get(columns[1]).map(name => column(name, name === 'id' ? {} : {
        Type: name === 'payload_json' ? 'json' : name.endsWith('_id') ? 'bigint' : 'varchar(255)',
        Collation: name === 'payload_json' || name.endsWith('_id') ? null : 'utf8mb4_0900_ai_ci',
        Null: 'YES',
        Key: '',
        Extra: '',
      })), []];
    }
    const indexes = /^SHOW INDEX FROM `([^`]+)`$/u.exec(normalized);
    if (indexes && objectNames.has(indexes[1])) {
      return [[{
        Table: indexes[1],
        Key_name: 'PRIMARY',
        Non_unique: 0,
        Seq_in_index: 1,
        Column_name: 'id',
      }], []];
    }
    if (normalized.includes('FROM information_schema.TABLE_CONSTRAINTS')) {
      const foreignKeys = RESIDUE_AUDIT_FOREIGN_KEYS[params[0]] || [];
      return [[
        { CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' },
        ...foreignKeys.map(item => ({
          CONSTRAINT_NAME: item.name,
          CONSTRAINT_TYPE: 'FOREIGN KEY',
        })),
      ], []];
    }
    if (normalized.includes('FROM information_schema.KEY_COLUMN_USAGE')) {
      const foreignKeys = RESIDUE_AUDIT_FOREIGN_KEYS[params[0]] || [];
      return [[
        {
          CONSTRAINT_NAME: 'PRIMARY',
          COLUMN_NAME: 'id',
          REFERENCED_TABLE_NAME: null,
          REFERENCED_COLUMN_NAME: null,
          ORDINAL_POSITION: 1,
        },
        ...foreignKeys.map(item => ({
          CONSTRAINT_NAME: item.name,
          COLUMN_NAME: item.column,
          REFERENCED_TABLE_NAME: item.target,
          REFERENCED_COLUMN_NAME: 'id',
          ORDINAL_POSITION: 1,
        })),
      ], []];
    }
    if (normalized.includes('FROM information_schema.KEYWORDS')) return [[], []];
    if (['START TRANSACTION', 'COMMIT', 'ROLLBACK'].includes(normalized)) {
      throw new Error(`unexpected transaction control: ${normalized}`);
    }
    throw new Error(`unexpected raw query: ${normalized}`);
  });
  return {
    query,
    execute: jest.fn(async (sql) => {
      const normalized = String(sql).trim().replace(/\s+/g, ' ');
      const audit = residueAuditBySql.get(normalized);
      if (audit) return [[{ 'COUNT(*)': Number(residueCounts[audit.key] || 0) }], []];
      throw new Error(`ordinary statement reached fake driver: ${normalized}`);
    }),
  };
}

const config = Object.freeze({
  host: EXPECTED_DEV_IDENTITY.configuredHost,
  user: EXPECTED_DEV_IDENTITY.configuredUser,
  database: EXPECTED_DEV_IDENTITY.database,
  port: EXPECTED_DEV_IDENTITY.port,
});

describe('real MySQL release contract schema boundary', () => {
  test('attempt identity and deliberate controls are explicit, validated and fail closed', () => {
    expect(parseArgs(['--residue-audit-only'])).toEqual(expect.objectContaining({
      residueAuditOnly: true,
      schemaPreflightOnly: false,
    }));
    expect(() => parseArgs(['--schema-preflight-only', '--residue-audit-only']))
      .toThrow('--schema-preflight-only and --residue-audit-only are mutually exclusive');
    expect(parseArgs(['--attempt-id', 'phase5-attempt-001', '--fail-after-first-mutation']))
      .toEqual(expect.objectContaining({
        attemptId: 'phase5-attempt-001',
        failAfterFirstMutation: true,
      }));
    expect(() => parseArgs(['--attempt-id', 'bad id']))
      .toThrow('release_contract_attempt_id_invalid');
    expect(() => parseArgs(['--fail-after-first-mutation']))
      .toThrow('require --attempt-id');
    expect(() => parseArgs([
      '--attempt-id',
      'phase5-attempt-001',
      '--fail-after-first-mutation',
      '--interrupt-after-first-mutation',
    ])).toThrow('mutually exclusive');
    expect(() => parseArgs([
      '--attempt-id',
      'phase5-attempt-001',
      '--schema-preflight-only',
      '--interrupt-after-first-mutation',
    ])).toThrow('require the full rollback contract');
  });

  test('fixture ledger is immutable, deterministic and covers every mutated object once', () => {
    const ledger = createFixtureLedger('phase5-attempt-001');
    const same = createFixtureLedger('phase5-attempt-001');
    const different = createFixtureLedger('phase5-attempt-002');

    expect(ledger).toEqual(same);
    expect(ledger.ledgerDigest).not.toBe(different.ledgerDigest);
    expect(ledger.fixture).toEqual(createFixtureIdentity('phase5-attempt-001'));
    expect(Object.isFrozen(ledger)).toBe(true);
    expect(Object.isFrozen(ledger.fixture)).toBe(true);
    expect(Object.isFrozen(ledger.residueStatements)).toBe(true);
    expect(ledger.objects).toEqual(ROLLBACK_FIXTURE_OBJECTS);
    expect(new Set(ledger.objects).size).toBe(13);
    expect(ledger.residueStatements).toHaveLength(13);
    expect(ledger.residueStatements.map(item => item.object)).toEqual(ROLLBACK_FIXTURE_OBJECTS);
  });

  test('schema-preflight-only captures exact identity/full structure with zero ordinary statements', async () => {
    const connection = createPreflightDriver();

    const result = await runRealMysqlReleaseContract({
      connection,
      config,
      schemaPreflightOnly: true,
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'passed',
      mode: 'schema-preflight-only',
      ordinaryStatementCount: 0,
      mutationBegan: false,
    }));
    expect(result.schemaSafety.identity).toEqual(expect.objectContaining({
      database: 'iset_intake',
      host: 'DESKTOP-PDFA51K',
      currentUser: 'root@172.26.%',
      version: '8.0.40',
    }));
    expect(Object.keys(result.schemaSafety.objects)).toHaveLength(REAL_CONTRACT_OBJECTS.length);
    expect(Object.keys(result.objectProofs)).toHaveLength(REAL_CONTRACT_OBJECTS.length);
    for (const proof of Object.values(result.objectProofs)) {
      expect(proof.rawDdl).toMatch(/^CREATE TABLE `/u);
      expect(require('crypto').createHash('sha256').update(proof.rawDdl).digest('hex')).toBe(proof.ddlHash);
      expect(proof.rawDdlHash).toBe(proof.ddlHash);
      expect(proof.structuralDdlHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(proof.volatileDdlOptions).toEqual(expect.any(Array));
    }
    expect(Object.keys(result.schemaSafety.structuralDdlHashes)).toHaveLength(REAL_CONTRACT_OBJECTS.length);
    expect(result.residueStatementCatalogue).toEqual(
      createFixtureLedger('phase5-attempt-001').residueStatements
    );
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.query.mock.calls.some(([sql]) => /(?:START TRANSACTION|ROLLBACK)/u.test(sql))).toBe(false);
  });

  test('wrong identity and missing DDL fail before ordinary SQL or cleanup', async () => {
    const wrongIdentityConnection = createPreflightDriver({ wrongIdentity: true });
    await expect(runRealMysqlReleaseContract({
      connection: wrongIdentityConnection,
      config,
      schemaPreflightOnly: true,
    })).rejects.toMatchObject({ code: 'schema_guard_wrong_database' });
    expect(wrongIdentityConnection.query).toHaveBeenCalledTimes(1);
    expect(wrongIdentityConnection.execute).not.toHaveBeenCalled();

    const missingConnection = createPreflightDriver({ omitObject: REAL_CONTRACT_OBJECTS[1] });
    await expect(runRealMysqlReleaseContract({
      connection: missingConnection,
      config,
      schemaPreflightOnly: true,
    })).rejects.toMatchObject({ code: 'schema_guard_required_object_missing' });
    expect(missingConnection.execute).not.toHaveBeenCalled();
    expect(missingConnection.query.mock.calls.some(([sql]) => /(?:START TRANSACTION|ROLLBACK|SELECT COUNT)/u.test(sql))).toBe(false);
  });

  test('runtime readiness shape failure after preflight still runs no fixture transaction or cleanup', async () => {
    const connection = createPreflightDriver();

    await expect(runRealMysqlReleaseContract({
      connection,
      config,
      schemaPreflightOnly: false,
    })).rejects.toMatchObject({ code: 'schema_not_ready' });

    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.query.mock.calls.some(([sql]) => /(?:START TRANSACTION|ROLLBACK|SELECT COUNT)/u.test(sql))).toBe(false);
  });

  test('residue-audit-only performs only guarded native counts after full preflight', async () => {
    const connection = createPreflightDriver();

    const result = await runRealMysqlReleaseContract({
      connection,
      config,
      residueAuditOnly: true,
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'passed',
      mode: 'residue-audit-only',
      mutationBegan: false,
      cleanupAttempted: false,
    }));
    expect(result.residue).toEqual({
      counts: Object.fromEntries(RELEASE_CONTRACT_RESIDUE_AUDITS.map(audit => [audit.key, 0])),
      total: 0,
      clean: true,
      auditChecks: RELEASE_CONTRACT_RESIDUE_AUDITS.length,
    });
    expect(connection.execute).toHaveBeenCalledTimes(RELEASE_CONTRACT_RESIDUE_AUDITS.length);
    for (const [sql] of connection.execute.mock.calls) {
      const normalized = String(sql).trim().replace(/\s+/g, ' ');
      expect(normalized).toMatch(/^SELECT COUNT\(\*\) FROM [A-Za-z_`]/u);
      expect(normalized).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|START TRANSACTION|ROLLBACK|COMMIT)\b/u);
    }
    expect(connection.query.mock.calls.some(([sql]) => /(?:START TRANSACTION|ROLLBACK|COMMIT)/u.test(String(sql)))).toBe(false);
  });

  test('attempt-bound residue mode validates all 13 exact scopes through the live guard', async () => {
    const connection = createPreflightDriver();
    const result = await runRealMysqlReleaseContract({
      connection,
      config,
      residueAuditOnly: true,
      attemptId: 'phase5-attempt-001',
    });

    expect(result.attemptId).toBe('phase5-attempt-001');
    expect(result.fixtureLedger.objects).toEqual(ROLLBACK_FIXTURE_OBJECTS);
    expect(result.residue).toEqual({
      counts: Object.fromEntries(ATTEMPT_RESIDUE_AUDITS.map(audit => [audit.key, 0])),
      total: 0,
      clean: true,
      auditChecks: 13,
    });
    expect(connection.execute).toHaveBeenCalledTimes(13);
  });

  test('residue-audit-only reports counts as a failure without mutating or cleaning them', async () => {
    const connection = createPreflightDriver({ residueCounts: { financialOverviewDocuments: 2 } });

    let failure;
    try {
      await runRealMysqlReleaseContract({ connection, config, residueAuditOnly: true });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      name: 'ReleaseContractResidueError',
      code: 'release_contract_residue_detected',
      cleanup: expect.objectContaining({ financialOverviewDocuments: 2 }),
    });
    expect(serializeFailure(failure)).toEqual(expect.objectContaining({
      cleanup: expect.objectContaining({ financialOverviewDocuments: 2 }),
      recovery: {
        rollback: { attempted: 0, succeeded: 0, failed: 0 },
        cleanup: expect.objectContaining({
          planned: 0,
          attempted: 0,
          completed: 0,
          nonzeroScopes: 1,
          totalResidue: 2,
        }),
      },
    }));
    expect(connection.execute).toHaveBeenCalledTimes(RELEASE_CONTRACT_RESIDUE_AUDITS.length);
    expect(connection.execute.mock.calls.some(([sql]) => /\b(?:INSERT|UPDATE|DELETE)\b/u.test(String(sql)))).toBe(false);
  });

  test('pre-mutation validation failure performs neither rollback nor residue reads', async () => {
    const state = { mutationBegan: false };
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockRejectedValue(new Error('guard rejected first insert')),
    };

    await expect(runRollbackContracts(connection, state)).rejects.toThrow('guard rejected first insert');
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(state.attemptId).toMatch(/^auto-/u);
    expect(state.fixtureLedger).toEqual(expect.objectContaining({
      attemptId: state.attemptId,
      objects: ROLLBACK_FIXTURE_OBJECTS,
    }));
  });

  test('deliberate first-mutation failure rolls back and proves all 13 residue scopes', async () => {
    const state = { mutationBegan: false };
    const injectedFailure = new Error('deliberate post-mutation failure');
    injectedFailure.code = 'release_contract_injected_failure_after_first_mutation';
    const afterFirstMutation = jest.fn(async () => {
      throw injectedFailure;
    });
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(async (sql) => {
        const normalized = String(sql).trim().replace(/\s+/g, ' ');
        if (normalized.startsWith('INSERT INTO staff_profiles')) {
          state.mutationBegan = true;
          return [{ affectedRows: 1 }, []];
        }
        if (normalized.startsWith('SELECT COUNT(*)')) return [[{ 'COUNT(*)': 0 }], []];
        throw new Error(`unexpected query: ${normalized}`);
      }),
    };

    let failure;
    try {
      await runRollbackContracts(connection, state, {
        attemptId: 'phase5-attempt-failure',
        afterFirstMutation,
      });
    } catch (error) {
      failure = error;
    }

    expect(afterFirstMutation).toHaveBeenCalledTimes(1);
    expect(afterFirstMutation.mock.calls[0][0]).toEqual(expect.objectContaining({
      attemptId: 'phase5-attempt-failure',
      fixtureLedger: expect.objectContaining({
        objects: ROLLBACK_FIXTURE_OBJECTS,
      }),
    }));
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.errors).toContain(injectedFailure);
    expect(failure.attemptId).toBe('phase5-attempt-failure');
    expect(failure.cleanup).toEqual(
      Object.fromEntries(ATTEMPT_RESIDUE_AUDITS.map(audit => [audit.key, 0]))
    );
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls.filter(([sql]) => String(sql).includes('SELECT COUNT(*)'))).toHaveLength(13);
  });

  test('abrupt interruption control emits the bound ledger marker before signalling only itself', async () => {
    const write = jest.spyOn(fs, 'writeSync').mockImplementation(() => 0);
    const kill = jest.spyOn(process, 'kill').mockImplementation(() => true);
    const fixtureLedger = createFixtureLedger('phase5-attempt-interrupt');

    try {
      const control = mutationControlFromArgs({ interruptAfterFirstMutation: true });
      await control({
        attemptId: 'phase5-attempt-interrupt',
        fixtureLedger,
      });
      expect(write).toHaveBeenCalledWith(2, expect.stringContaining(fixtureLedger.ledgerDigest));
      expect(kill).toHaveBeenCalledWith(process.pid, 'SIGKILL');
    } finally {
      write.mockRestore();
      kill.mockRestore();
    }
  });

  test('failure after mutation rolls back and proves every residue counter before surfacing the error', async () => {
    const state = { mutationBegan: false };
    const originalError = new Error('fixture request failed');
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(async (sql) => {
        const normalized = String(sql).trim().replace(/\s+/g, ' ');
        if (normalized.startsWith('INSERT INTO staff_profiles')) {
          state.mutationBegan = true;
          return [{ affectedRows: 1 }, []];
        }
        if (normalized.startsWith('SELECT `id`, `cognito_sub`')) throw originalError;
        if (normalized.startsWith('SELECT COUNT(*)')) return [[{ 'COUNT(*)': 0 }], []];
        throw new Error(`unexpected query: ${normalized}`);
      }),
    };

    let failure;
    try {
      await runRollbackContracts(connection, state);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.errors).toContain(originalError);
    expect(failure.cleanup).toEqual(
      Object.fromEntries(ATTEMPT_RESIDUE_AUDITS.map(audit => [audit.key, 0]))
    );
    expect(failure.recovery).toEqual({
      rollback: { attempted: 1, succeeded: 1, failed: 0 },
      cleanup: {
        planned: 13,
        attempted: 13,
        completed: 13,
        nonzeroScopes: 0,
        totalResidue: 0,
      },
    });
    const report = failureReport(failure);
    expect(report).toEqual(expect.objectContaining({
      status: 'failed',
      contract: 'real-mysql-release-contract',
      failure: expect.objectContaining({
        name: 'AggregateError',
        code: 'release_contract_failed',
        message: 'release_contract_failed_with_cleanup_evidence',
        cleanup: expect.objectContaining({ financialOverviewDocuments: 0 }),
        recovery: failure.recovery,
        errors: expect.arrayContaining([
          expect.objectContaining({
            name: 'Error',
            code: null,
            message: 'fixture request failed',
          }),
        ]),
      }),
    }));
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls.filter(([sql]) => String(sql).includes('SELECT COUNT(*)'))).toHaveLength(13);
  });

  test('failure serialization exposes nested causes but omits arbitrary row and secret fields', () => {
    const cause = new Error('live guard rejected the statement');
    cause.code = 'schema_guard_column_wrong_owner';
    const error = new Error('outer contract failure');
    error.code = 'release_contract_failed';
    error.cause = cause;
    error.cleanup = { documents: 3 };
    error.rows = [{ applicant: 'must-not-serialize' }];
    error.password = 'must-not-serialize';

    const serialized = serializeFailure(error);

    expect(serialized).toEqual({
      name: 'Error',
      code: 'release_contract_failed',
      message: 'outer contract failure',
      cleanup: { documents: 3 },
      cause: {
        name: 'Error',
        code: 'schema_guard_column_wrong_owner',
        message: 'live guard rejected the statement',
      },
    });
    expect(JSON.stringify(serialized)).not.toContain('must-not-serialize');
  });
});
