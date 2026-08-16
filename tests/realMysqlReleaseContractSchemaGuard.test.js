const {
  EXPECTED_DEV_IDENTITY,
  RELEASE_CONTRACT_RESIDUE_AUDITS,
  REAL_CONTRACT_OBJECTS,
  failureReport,
  parseArgs,
  runRealMysqlReleaseContract,
  runRollbackContracts,
  serializeFailure,
} = require('../scripts/real-mysql-release-contract');

const RESIDUE_AUDIT_COLUMNS = Object.freeze({
  staff_profiles: ['id', 'cognito_sub', 'email'],
  client_file_import_run: ['id', 'file_name', 'worksheet_name'],
  client_file_import_identity_claim: ['id', 'identity_key'],
  iset_event_entry: ['id', 'category', 'event_type', 'captured_by'],
  iset_event_delivery: ['id', 'payload_json'],
  user: ['id', 'email'],
  client: ['id', 'last_name', 'applicant_account_email'],
  iset_case: ['id', 'case_number'],
  iset_document: ['id', 'file_path'],
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
  const residueAuditBySql = new Map(RELEASE_CONTRACT_RESIDUE_AUDITS.map(audit => [
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
        .map(name => `\`${name}\` ${name === 'id' ? 'bigint NOT NULL AUTO_INCREMENT' : 'varchar(255) NULL'}`)
        .join(', ');
      return [[{
        Table: create[1],
        'Create Table': `CREATE TABLE \`${create[1]}\` (${definitions}, PRIMARY KEY (\`id\`))`,
      }], []];
    }
    const columns = /^SHOW FULL COLUMNS FROM `([^`]+)`$/u.exec(normalized);
    if (columns && objectNames.has(columns[1])) {
      return [columnsByObject.get(columns[1]).map(name => column(name, name === 'id' ? {} : {
        Type: name === 'payload_json' ? 'json' : 'varchar(255)',
        Collation: name === 'payload_json' ? null : 'utf8mb4_0900_ai_ci',
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
      return [[{ CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' }], []];
    }
    if (normalized.includes('FROM information_schema.KEY_COLUMN_USAGE')) {
      return [[{
        CONSTRAINT_NAME: 'PRIMARY',
        COLUMN_NAME: 'id',
        REFERENCED_TABLE_NAME: null,
        REFERENCED_COLUMN_NAME: null,
        ORDINAL_POSITION: 1,
      }], []];
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
  test('residue audit CLI mode is explicit and mutually exclusive with metadata-only preflight', () => {
    expect(parseArgs(['--residue-audit-only'])).toEqual(expect.objectContaining({
      residueAuditOnly: true,
      schemaPreflightOnly: false,
    }));
    expect(() => parseArgs(['--schema-preflight-only', '--residue-audit-only']))
      .toThrow('--schema-preflight-only and --residue-audit-only are mutually exclusive');
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

  test('residue-audit-only performs only guarded single-table native counts after full preflight', async () => {
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
      expect(normalized).toMatch(/^SELECT COUNT\(\*\) FROM [A-Za-z_][A-Za-z0-9_]*/u);
      expect((normalized.match(/\b(?:FROM|JOIN)\b/gu) || [])).toHaveLength(1);
      expect(normalized).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|START TRANSACTION|ROLLBACK|COMMIT)\b/u);
    }
    expect(connection.query.mock.calls.some(([sql]) => /(?:START TRANSACTION|ROLLBACK|COMMIT)/u.test(String(sql)))).toBe(false);
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
    expect(failure.cleanup).toEqual({
      staffProfiles: 0,
      importRuns: 0,
      identityClaims: 0,
      events: 0,
      deliveries: 0,
      financialOverviewUsers: 0,
      financialOverviewCases: 0,
      financialOverviewDocuments: 0,
    });
    expect(failure.recovery).toEqual({
      rollback: { attempted: 1, succeeded: 1, failed: 0 },
      cleanup: {
        planned: 8,
        attempted: 8,
        completed: 8,
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
    expect(connection.query.mock.calls.filter(([sql]) => String(sql).includes('SELECT COUNT(*)'))).toHaveLength(8);
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
