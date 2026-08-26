const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ENVIRONMENT_CONTRACTS,
  EXPECTED_AWS_ACCOUNT_ID,
  EXPECTED_AWS_ACCOUNT_IDS,
  KEY_COLUMN_USAGE_SQL,
  LEDGER_READ_SQL,
  LEDGER_WRITE_SQL,
  MIGRATION_FILENAME,
  MIGRATION_SHA256,
  OPERATIONS,
  REFERENTIAL_CONSTRAINTS_SQL,
  TABLE_CONSTRAINTS_SQL,
  executeTypedLineageMigration,
  verifyMigrationArtifact,
} = require('../scripts/lib/typed-lineage-migration-executor');
const {
  createEc2InstanceIdentityProvider,
  parseArgs,
  persistEvidenceWithFallback,
  validateArgs,
  writeEvidence,
} = require('../scripts/apply-20260825-typed-lineage');

const migrationPath = path.join(__dirname, '..', 'sql', 'migrations', MIGRATION_FILENAME);

function column(Field, Type, Null = 'NO', Extra = '') {
  return { Field, Type, Collation: Type.includes('char') || Type === 'text' ? 'utf8mb4_unicode_ci' : null, Null, Key: '', Default: null, Extra };
}

function indexRow(Key_name, Column_name, Non_unique, Seq_in_index) {
  return {
    Key_name,
    Column_name,
    Non_unique,
    Seq_in_index,
    Sub_part: null,
    Index_type: 'BTREE',
    Visible: 'YES',
    Expression: null,
  };
}

function createBaseState() {
  const tables = {
    cfa_series: {
      columns: [column('id', 'int', 'NO', 'auto_increment'), column('case_id', 'bigint unsigned'), column('template_key', 'varchar(64)')],
      indexes: [indexRow('PRIMARY', 'id', 0, 1), indexRow('idx_cfa_series_case', 'case_id', 1, 1)],
      foreignKeys: {},
    },
    cfa_version: {
      columns: [column('id', 'int', 'NO', 'auto_increment'), column('series_id', 'int'), column('version_number', 'int')],
      indexes: [
        indexRow('PRIMARY', 'id', 0, 1),
        indexRow('uniq_cfa_version_series', 'series_id', 0, 1),
        indexRow('uniq_cfa_version_series', 'version_number', 0, 2),
      ],
      foreignKeys: {
        fk_cfa_version_series: {
          column: 'series_id',
          referencedTable: 'cfa_series',
          referencedColumn: 'id',
          deleteRule: 'RESTRICT',
          updateRule: 'NO ACTION',
          matchOption: 'NONE',
        },
      },
    },
    funding_overview_series: {
      columns: [column('id', 'int', 'NO', 'auto_increment'), column('case_id', 'bigint unsigned'), column('template_key', 'varchar(64)')],
      indexes: [
        indexRow('PRIMARY', 'id', 0, 1),
        indexRow('uniq_funding_overview_series_case_template', 'case_id', 0, 1),
        indexRow('uniq_funding_overview_series_case_template', 'template_key', 0, 2),
      ],
      foreignKeys: {},
    },
    funding_overview_version: {
      columns: [column('id', 'int', 'NO', 'auto_increment'), column('series_id', 'int'), column('version_number', 'int')],
      indexes: [
        indexRow('PRIMARY', 'id', 0, 1),
        indexRow('uniq_funding_overview_version_series', 'series_id', 0, 1),
        indexRow('uniq_funding_overview_version_series', 'version_number', 0, 2),
      ],
      foreignKeys: {
        fk_funding_overview_version_series: {
          column: 'series_id',
          referencedTable: 'funding_overview_series',
          referencedColumn: 'id',
          deleteRule: 'RESTRICT',
          updateRule: 'NO ACTION',
          matchOption: 'NONE',
        },
      },
    },
    iset_application: {
      columns: [column('id', 'bigint unsigned', 'NO', 'auto_increment')],
      indexes: [indexRow('PRIMARY', 'id', 0, 1)],
      foreignKeys: {},
    },
    iset_case_action_plan: {
      columns: [column('id', 'bigint unsigned', 'NO', 'auto_increment')],
      indexes: [indexRow('PRIMARY', 'id', 0, 1)],
      foreignKeys: {},
    },
    iset_migration: {
      columns: [
        column('id', 'int', 'NO', 'auto_increment'),
        column('filename', 'varchar(255)'),
        column('checksum', 'char(64)'),
        { ...column('applied_at', 'datetime'), Default: 'CURRENT_TIMESTAMP' },
        column('duration_ms', 'int'),
        { ...column('success', 'tinyint(1)'), Default: '1' },
        column('error_snippet', 'text', 'YES'),
      ],
      indexes: [
        indexRow('PRIMARY', 'id', 0, 1),
        indexRow('uniq_filename_checksum', 'filename', 0, 1),
        indexRow('uniq_filename_checksum', 'checksum', 0, 2),
      ],
      foreignKeys: {},
    },
  };
  return { tables, ledger: [], nextLedgerId: 1 };
}

function addOperationToState(state, operation) {
  const table = state.tables[operation.table];
  if (operation.kind === 'column') {
    const afterIndex = table.columns.findIndex(item => item.Field === operation.after);
    table.columns.splice(afterIndex + 1, 0, column(operation.column, 'bigint unsigned', 'YES'));
  } else if (operation.kind === 'index') {
    table.indexes.push(indexRow(operation.index, operation.column, 1, 1));
  } else {
    table.foreignKeys[operation.constraint] = {
      column: operation.column,
      referencedTable: operation.referencedTable,
      referencedColumn: operation.referencedColumn,
      deleteRule: 'RESTRICT',
      updateRule: 'NO ACTION',
      matchOption: 'NONE',
    };
  }
}

function constraintRows(table) {
  const rows = [{ CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' }];
  const uniqueNames = [...new Set(table.indexes.filter(row => row.Non_unique === 0 && row.Key_name !== 'PRIMARY').map(row => row.Key_name))];
  uniqueNames.forEach(name => rows.push({ CONSTRAINT_NAME: name, CONSTRAINT_TYPE: 'UNIQUE' }));
  Object.keys(table.foreignKeys).forEach(name => rows.push({ CONSTRAINT_NAME: name, CONSTRAINT_TYPE: 'FOREIGN KEY' }));
  return rows;
}

function keyRows(table) {
  const rows = table.indexes
    .filter(row => row.Non_unique === 0)
    .map(row => ({
      CONSTRAINT_NAME: row.Key_name,
      COLUMN_NAME: row.Column_name,
      REFERENCED_TABLE_NAME: null,
      REFERENCED_COLUMN_NAME: null,
      ORDINAL_POSITION: row.Seq_in_index,
    }));
  Object.entries(table.foreignKeys).forEach(([name, fk]) => rows.push({
    CONSTRAINT_NAME: name,
    COLUMN_NAME: fk.column,
    REFERENCED_TABLE_NAME: fk.referencedTable,
    REFERENCED_COLUMN_NAME: fk.referencedColumn,
    ORDINAL_POSITION: 1,
  }));
  return rows;
}

function referentialRows(table) {
  return Object.entries(table.foreignKeys).map(([name, fk]) => ({
    CONSTRAINT_NAME: name,
    MATCH_OPTION: fk.matchOption,
    UPDATE_RULE: fk.updateRule,
    DELETE_RULE: fk.deleteRule,
  }));
}

function createFakeConnection(state = createBaseState(), options = {}) {
  const calls = [];
  const operationByDdl = new Map(OPERATIONS.map(operation => [operation.ddl, operation]));
  function tableFromShow(sql) {
    const match = /`([^`]+)`$/u.exec(sql);
    return match?.[1];
  }
  const connection = {
    calls,
    state,
    async query(sql, params = []) {
      calls.push({ method: 'query', sql, params });
      if (sql === 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()') {
        const identity = options.identity || ENVIRONMENT_CONTRACTS.test.live;
        return [[{
          'DATABASE()': identity.database,
          '@@hostname': identity.host,
          '@@port': identity.port,
          'CURRENT_USER()': identity.currentUser,
          'VERSION()': identity.version,
        }], []];
      }
      if (sql.startsWith('SHOW FULL TABLES FROM')) {
        const table = params[0];
        return state.tables[table]
          ? [[{ Tables_in_iset_intake: table, Table_type: 'BASE TABLE' }], []]
          : [[], []];
      }
      if (sql.startsWith('SHOW CREATE TABLE')) {
        const table = tableFromShow(sql);
        return [[{
          Table: table,
          'Create Table': `CREATE TABLE ${table} ${JSON.stringify(state.tables[table])} ENGINE=${state.tables[table].engine || 'InnoDB'} AUTO_INCREMENT=${state.tables[table].volatileAutoIncrement || 1}`,
        }], []];
      }
      if (sql.startsWith('SHOW FULL COLUMNS FROM')) return [state.tables[tableFromShow(sql)].columns.map(item => ({ ...item })), []];
      if (sql.startsWith('SHOW INDEX FROM')) {
        const table = state.tables[tableFromShow(sql)];
        return [table.indexes.map(item => ({ ...item, Cardinality: table.volatileCardinality || 0 })), []];
      }
      if (sql === TABLE_CONSTRAINTS_SQL) return [constraintRows(state.tables[params[0]]), []];
      if (sql === KEY_COLUMN_USAGE_SQL) return [keyRows(state.tables[params[0]]), []];
      if (sql === REFERENTIAL_CONSTRAINTS_SQL) return [referentialRows(state.tables[params[0]]), []];
      const operation = operationByDdl.get(sql);
      if (operation) {
        if (options.failDdl === operation.key) throw Object.assign(new Error('injected DDL failure'), { code: 'injected_ddl_failure' });
        addOperationToState(state, operation);
        if (options.mutateSeriesAfter === operation.key) state.tables.cfa_series.columns.push(column('unexpected_column', 'int', 'YES'));
        if (options.mutateVolatileSeriesMetadataAfter === operation.key) {
          for (const name of ['cfa_series', 'funding_overview_series']) {
            state.tables[name].volatileAutoIncrement = 999;
            state.tables[name].volatileCardinality = 777;
          }
        }
        if (options.reorderSeriesIndexesAfter === operation.key) {
          for (const name of ['cfa_series', 'funding_overview_series']) {
            state.tables[name].indexes.reverse();
          }
        }
        return [{ affectedRows: 0 }, []];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async execute(sql, params = []) {
      calls.push({ method: 'execute', sql, params });
      if (sql === LEDGER_READ_SQL) return [state.ledger.filter(row => row.filename === params[0]).map(row => ({ ...row })), []];
      if (sql === LEDGER_WRITE_SQL) {
        const [filename, checksum, appliedAt, durationMs] = params;
        let row = state.ledger.find(item => item.filename === filename && item.checksum === checksum);
        if (!row) {
          row = { id: state.nextLedgerId++, filename, checksum };
          state.ledger.push(row);
        }
        Object.assign(row, { applied_at: appliedAt, duration_ms: durationMs, success: 1, error_snippet: null });
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected execute: ${sql}`);
    },
    async end() {
      calls.push({ method: 'end' });
      if (options.failEnd) throw Object.assign(new Error('injected connection close failure'), { code: 'injected_close_failure' });
    },
  };
  return connection;
}

function runOptions(connection, overrides = {}) {
  let factoryCalls = 0;
  const options = {
    targetEnv: 'test',
    configuredIdentity: ENVIRONMENT_CONTRACTS.test.configured,
    testExecutionContext: {
      expectedAwsAccountId: EXPECTED_AWS_ACCOUNT_ID,
      expectedSsmInstanceId: 'i-0123456789abcdef0',
      runToken: 'test-command-token',
    },
    testInstanceIdentityProvider: jest.fn(async () => ({
      Account: EXPECTED_AWS_ACCOUNT_ID,
      InstanceId: 'i-0123456789abcdef0',
      Region: 'ca-central-1',
    })),
    connectionFactory: jest.fn(async () => {
      factoryCalls += 1;
      if (factoryCalls > 1) throw new Error('more than one database session');
      return connection;
    }),
    migrationPath,
    clock: () => new Date('2026-08-25T17:00:00.000Z'),
    ...overrides,
  };
  return options;
}

describe('bounded 20260825 typed-lineage migration executor', () => {
  test('CLI binds TEST to outer account/SSM/run context and keeps local DEV AWS-free', () => {
    expect(validateArgs(parseArgs([
      '--target-env', 'dev', '--env-file', '.env', '--yes',
    ]))).toEqual(expect.objectContaining({ targetEnv: 'dev', expectedAwsAccountId: null }));
    expect(() => validateArgs(parseArgs([
      '--target-env', 'dev', '--env-file', '.env', '--expected-aws-account-id', EXPECTED_AWS_ACCOUNT_ID,
      '--expected-ssm-instance-id', 'i-0123456789abcdef0', '--run-token', 'command-token', '--yes',
    ]))).toThrow('Remote execution-context options do not apply to local DEV');
    expect(() => validateArgs(parseArgs([
      '--target-env', 'test', '--env-file', '.env.test', '--yes',
    ]))).toThrow(`TEST requires --expected-aws-account-id ${EXPECTED_AWS_ACCOUNT_ID}`);
    expect(validateArgs(parseArgs([
      '--target-env', 'test', '--env-file', '.env.test',
      '--expected-aws-account-id', EXPECTED_AWS_ACCOUNT_ID,
      '--expected-ssm-instance-id', 'i-0123456789abcdef0',
      '--run-token', 'command-token', '--yes',
    ]))).toEqual(expect.objectContaining({
      targetEnv: 'test',
      expectedAwsAccountId: EXPECTED_AWS_ACCOUNT_ID,
      expectedSsmInstanceId: 'i-0123456789abcdef0',
      runToken: 'command-token',
    }));
    expect(() => validateArgs(parseArgs([
      '--target-env', 'prod', '--env-file', '.env.production',
      '--expected-aws-account-id', EXPECTED_AWS_ACCOUNT_IDS.prod,
      '--expected-ssm-instance-id', 'i-0123456789abcdef0',
      '--run-token', 'prod-command-token',
    ]))).toThrow('--yes is required');
    expect(() => validateArgs(parseArgs([
      '--target-env', 'prod', '--env-file', '.env.production',
      '--expected-aws-account-id', EXPECTED_AWS_ACCOUNT_IDS.test,
      '--expected-ssm-instance-id', 'i-0123456789abcdef0',
      '--run-token', 'prod-command-token', '--yes',
    ]))).toThrow(`PROD requires --expected-aws-account-id ${EXPECTED_AWS_ACCOUNT_IDS.prod}`);
    expect(validateArgs(parseArgs([
      '--target-env', 'prod', '--env-file', '.env.production',
      '--expected-aws-account-id', EXPECTED_AWS_ACCOUNT_IDS.prod,
      '--expected-ssm-instance-id', 'i-0123456789abcdef0',
      '--run-token', 'prod-command-token', '--yes',
    ]))).toEqual(expect.objectContaining({
      targetEnv: 'prod',
      expectedAwsAccountId: EXPECTED_AWS_ACCOUNT_IDS.prod,
      expectedSsmInstanceId: 'i-0123456789abcdef0',
      runToken: 'prod-command-token',
    }));
  });

  test('TEST instance identity comes from credential-free IMDSv2 document proof', async () => {
    const requestImpl = jest.fn()
      .mockResolvedValueOnce('imds-token')
      .mockResolvedValueOnce(JSON.stringify({
        accountId: EXPECTED_AWS_ACCOUNT_ID,
        instanceId: 'i-0123456789abcdef0',
        region: 'ca-central-1',
      }));
    const provider = createEc2InstanceIdentityProvider({ requestImpl });
    await expect(provider()).resolves.toEqual({
      Account: EXPECTED_AWS_ACCOUNT_ID,
      InstanceId: 'i-0123456789abcdef0',
      Region: 'ca-central-1',
    });
    expect(requestImpl).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: 'PUT',
      requestPath: '/latest/api/token',
    }));
    expect(requestImpl).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: 'GET',
      requestPath: '/latest/dynamic/instance-identity/document',
      headers: { 'X-aws-ec2-metadata-token': 'imds-token' },
    }));
  });

  test('a requested evidence-write failure preserves COMPLETE evidence in a /tmp fallback', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'typed-lineage-evidence-fallback-'));
    const requestedPath = path.join(temp, 'unwritable', 'requested.json');
    const fallbackDirectory = path.join(temp, 'fallback');
    fs.mkdirSync(fallbackDirectory, { recursive: true });
    const completeEvidence = { schemaVersion: 1, decision: 'COMPLETE', ledger: { success: true } };
    const writeEvidenceImpl = jest.fn((filePath, evidence) => {
      if (filePath === requestedPath) throw new Error('injected requested evidence failure');
      return writeEvidence(filePath, evidence);
    });
    const result = persistEvidenceWithFallback({
      requestedPath,
      evidence: completeEvidence,
      writeEvidenceImpl,
      fallbackDirectory,
    });
    expect(result.usedFallback).toBe(true);
    expect(result.evidence.decision).toBe('COMPLETE');
    expect(result.evidence.evidenceOutput).toEqual(expect.objectContaining({
      status: 'fallback',
      requestedWriteError: 'injected requested evidence failure',
    }));
    expect(result.evidencePath.startsWith(fallbackDirectory)).toBe(true);
    expect(JSON.parse(fs.readFileSync(result.evidencePath, 'utf8'))).toEqual(expect.objectContaining({
      decision: 'COMPLETE',
      ledger: { success: true },
      evidenceOutput: expect.objectContaining({ status: 'fallback' }),
    }));
  });

  test('pins the canonical file and proves its exact nine version-only operations', () => {
    expect(verifyMigrationArtifact(migrationPath)).toEqual({
      filename: MIGRATION_FILENAME,
      checksum: MIGRATION_SHA256,
      operationCount: 9,
      executionModel: 'file-pinned-literal-ddl',
    });
    const changed = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'typed-lineage-checksum-')), MIGRATION_FILENAME);
    fs.writeFileSync(changed, `${fs.readFileSync(migrationPath, 'utf8')}\n`);
    expect(() => verifyMigrationArtifact(changed)).toThrow(/checksum_mismatch/u);
  });

  test('PROD rejects a wrong fresh instance identity before opening a database session', async () => {
    const instanceIdentityProvider = jest.fn(async () => ({
      Account: EXPECTED_AWS_ACCOUNT_IDS.test,
      InstanceId: 'i-0123456789abcdef0',
      Region: 'ca-central-1',
    }));
    const connectionFactory = jest.fn();
    await expect(executeTypedLineageMigration({
      targetEnv: 'prod',
      configuredIdentity: ENVIRONMENT_CONTRACTS.prod.configured,
      executionContext: {
        expectedAwsAccountId: EXPECTED_AWS_ACCOUNT_IDS.prod,
        expectedSsmInstanceId: 'i-0123456789abcdef0',
        runToken: 'prod-command-token',
      },
      instanceIdentityProvider,
      connectionFactory,
      migrationPath,
    })).rejects.toMatchObject({ code: 'typed_lineage_aws_account_mismatch' });
    expect(instanceIdentityProvider).toHaveBeenCalledTimes(1);
    expect(connectionFactory).not.toHaveBeenCalled();
  });

  test('PROD rejects configured or live database identity drift before DDL or ledger access', async () => {
    const instanceIdentityProvider = jest.fn(async () => ({
      Account: EXPECTED_AWS_ACCOUNT_IDS.prod,
      InstanceId: 'i-0123456789abcdef0',
      Region: 'ca-central-1',
    }));
    const executionContext = {
      expectedAwsAccountId: EXPECTED_AWS_ACCOUNT_IDS.prod,
      expectedSsmInstanceId: 'i-0123456789abcdef0',
      runToken: 'prod-command-token',
    };
    const connectionFactory = jest.fn();
    await expect(executeTypedLineageMigration({
      targetEnv: 'prod',
      configuredIdentity: ENVIRONMENT_CONTRACTS.test.configured,
      executionContext,
      instanceIdentityProvider,
      connectionFactory,
      migrationPath,
    })).rejects.toMatchObject({ code: 'typed_lineage_configured_database_identity_mismatch' });
    expect(instanceIdentityProvider).not.toHaveBeenCalled();
    expect(connectionFactory).not.toHaveBeenCalled();

    const connection = createFakeConnection(createBaseState(), { identity: ENVIRONMENT_CONTRACTS.test.live });
    await expect(executeTypedLineageMigration({
      targetEnv: 'prod',
      configuredIdentity: ENVIRONMENT_CONTRACTS.prod.configured,
      executionContext,
      instanceIdentityProvider,
      connectionFactory: jest.fn(async () => connection),
      migrationPath,
    })).rejects.toMatchObject({ code: 'typed_lineage_live_database_identity_mismatch' });
    expect(connection.calls.some(call => call.sql === LEDGER_READ_SQL || call.sql === LEDGER_WRITE_SQL)).toBe(false);
    expect(connection.calls.some(call => OPERATIONS.some(operation => operation.ddl === call.sql))).toBe(false);
  });

  test('applies only the nine exact literal operations in one session and records the ledger last', async () => {
    const connection = createFakeConnection();
    const options = runOptions(connection);
    const evidence = await executeTypedLineageMigration(options);

    expect(options.connectionFactory).toHaveBeenCalledTimes(1);
    expect(evidence.decision).toBe('COMPLETE');
    expect(evidence.awsIdentity).toEqual(expect.objectContaining({
      applicable: true,
      source: 'ec2-instance-identity-document',
      Account: EXPECTED_AWS_ACCOUNT_ID,
      InstanceId: 'i-0123456789abcdef0',
    }));
    expect(evidence.executionContext).toEqual({
      expectedAwsAccountId: EXPECTED_AWS_ACCOUNT_ID,
      expectedSsmInstanceId: 'i-0123456789abcdef0',
      runToken: 'test-command-token',
    });
    expect(evidence.transactionalDdlRollbackClaimed).toBe(false);
    expect(evidence.metadataStatementCount).toBeGreaterThan(550);
    expect(evidence.operations).toHaveLength(9);
    expect(evidence.operations.every(operation => operation.attempted && operation.executed)).toBe(true);
    expect(evidence.preflight.tables.cfa_version.ddl).toMatch(/^CREATE TABLE cfa_version/u);
    expect(evidence.preflight.tables.cfa_version.columns).toEqual(expect.any(Array));
    expect(evidence.preflight.tables.cfa_version.metadata).toEqual(expect.objectContaining({
      fullColumns: expect.any(Array),
      indexes: expect.any(Array),
      tableConstraints: expect.any(Array),
      keyColumnUsage: expect.any(Array),
      referentialConstraints: expect.any(Array),
    }));
    expect(evidence.finalProof.tables.funding_overview_version.ddl).toMatch(/^CREATE TABLE funding_overview_version/u);

    const ordinary = connection.calls.filter(call => OPERATIONS.some(operation => operation.ddl === call.sql) || call.method === 'execute');
    expect(ordinary.map(call => call.sql)).toEqual([
      LEDGER_READ_SQL,
      ...OPERATIONS.map(operation => operation.ddl),
      LEDGER_READ_SQL,
      LEDGER_WRITE_SQL,
      LEDGER_READ_SQL,
    ]);
    expect(connection.calls[connection.calls.length - 1].method).toBe('end');

    const firstDdlIndex = connection.calls.findIndex(call => call.sql === OPERATIONS[0].ddl);
    expect(firstDdlIndex).toBe(101);
    expect(connection.state.ledger).toEqual([expect.objectContaining({
      filename: MIGRATION_FILENAME,
      checksum: MIGRATION_SHA256,
      success: 1,
    })]);
  });

  test('local DEV has no AWS dependency and relies on exact configured/live DB identity', async () => {
    const state = createBaseState();
    OPERATIONS.forEach(operation => addOperationToState(state, operation));
    const connection = createFakeConnection(state, { identity: ENVIRONMENT_CONTRACTS.dev.live });
    const testInstanceIdentityProvider = jest.fn(() => {
      throw new Error('DEV must not ask for AWS identity');
    });
    const evidence = await executeTypedLineageMigration(runOptions(connection, {
      targetEnv: 'dev',
      configuredIdentity: ENVIRONMENT_CONTRACTS.dev.configured,
      testExecutionContext: null,
      testInstanceIdentityProvider,
    }));
    expect(testInstanceIdentityProvider).not.toHaveBeenCalled();
    expect(evidence.awsIdentity).toEqual({
      applicable: false,
      reason: 'Local DEV database execution has no AWS dependency.',
    });
    expect(evidence.decision).toBe('COMPLETE');
  });

  test('TEST caller context alone is insufficient when IMDS proves a different instance', async () => {
    const connectionFactory = jest.fn();
    await expect(executeTypedLineageMigration(runOptions(createFakeConnection(), {
      connectionFactory,
      testInstanceIdentityProvider: jest.fn(async () => ({
        Account: EXPECTED_AWS_ACCOUNT_ID,
        InstanceId: 'i-0fedcba9876543210',
        Region: 'ca-central-1',
      })),
    }))).rejects.toMatchObject({ code: 'typed_lineage_ssm_instance_mismatch' });
    expect(connectionFactory).not.toHaveBeenCalled();
  });

  test('an already successful exact migration preserves its original ledger audit row', async () => {
    const state = createBaseState();
    OPERATIONS.forEach(operation => addOperationToState(state, operation));
    const originalAppliedAt = new Date('2026-08-20T10:00:00.000Z');
    state.ledger.push({
      id: state.nextLedgerId++,
      filename: MIGRATION_FILENAME,
      checksum: MIGRATION_SHA256,
      applied_at: originalAppliedAt,
      duration_ms: 4321,
      success: 1,
      error_snippet: null,
    });
    const connection = createFakeConnection(state);
    const evidence = await executeTypedLineageMigration(runOptions(connection));
    expect(connection.calls.some(call => call.sql === LEDGER_WRITE_SQL)).toBe(false);
    expect(connection.calls.filter(call => call.method === 'execute').map(call => call.sql)).toEqual([
      LEDGER_READ_SQL,
      LEDGER_READ_SQL,
    ]);
    expect(state.ledger[0]).toEqual(expect.objectContaining({
      applied_at: originalAppliedAt,
      duration_ms: 4321,
      success: 1,
    }));
    expect(evidence.ledger).toEqual(expect.objectContaining({
      status: 'already-recorded',
      writePerformed: false,
      durationMs: 4321,
    }));
  });

  test('resumes a proven partial shape without replaying completed DDL', async () => {
    const state = createBaseState();
    OPERATIONS.slice(0, 5).forEach(operation => addOperationToState(state, operation));
    const connection = createFakeConnection(state);
    const evidence = await executeTypedLineageMigration(runOptions(connection));
    const ddlCalls = connection.calls.filter(call => OPERATIONS.some(operation => operation.ddl === call.sql));
    expect(ddlCalls.map(call => call.sql)).toEqual(OPERATIONS.slice(5).map(operation => operation.ddl));
    expect(evidence.operations.slice(0, 5).every(operation => operation.stateBefore === 'target' && !operation.executed)).toBe(true);
    expect(evidence.decision).toBe('COMPLETE');
  });

  test('a wrong existing shape stops after metadata preflight with no DDL or ledger SQL', async () => {
    const state = createBaseState();
    const table = state.tables.cfa_version;
    table.columns.splice(2, 0, column('application_id', 'bigint', 'YES'));
    const connection = createFakeConnection(state);
    await expect(executeTypedLineageMigration(runOptions(connection))).rejects.toMatchObject({
      code: 'typed_lineage_column_shape_mismatch',
      evidence: expect.objectContaining({ failure: expect.objectContaining({ ddlMayHaveAutoCommitted: false }) }),
    });
    expect(connection.calls.some(call => OPERATIONS.some(operation => operation.ddl === call.sql))).toBe(false);
    expect(connection.calls.some(call => call.method === 'execute')).toBe(false);
  });

  test('a successful different canonical checksum stops before any DDL', async () => {
    const state = createBaseState();
    state.ledger.push({
      id: state.nextLedgerId++,
      filename: MIGRATION_FILENAME,
      checksum: 'f'.repeat(64),
      applied_at: new Date('2026-08-24T00:00:00.000Z'),
      duration_ms: 1,
      success: 1,
      error_snippet: null,
    });
    const connection = createFakeConnection(state);
    await expect(executeTypedLineageMigration(runOptions(connection))).rejects.toMatchObject({
      code: 'typed_lineage_ledger_checksum_drift',
    });
    expect(connection.calls.filter(call => OPERATIONS.some(operation => operation.ddl === call.sql))).toHaveLength(0);
    expect(connection.calls.filter(call => call.method === 'execute').map(call => call.sql)).toEqual([LEDGER_READ_SQL]);
  });

  test('final drift check rejects any concurrently added successful checksum', async () => {
    const state = createBaseState();
    OPERATIONS.forEach(operation => addOperationToState(state, operation));
    const connection = createFakeConnection(state);
    const originalExecute = connection.execute.bind(connection);
    let ledgerReads = 0;
    connection.execute = async (sql, params = []) => {
      if (sql === LEDGER_READ_SQL && ++ledgerReads === 2) {
        state.ledger.push({
          id: state.nextLedgerId++,
          filename: MIGRATION_FILENAME,
          checksum: 'e'.repeat(64),
          applied_at: new Date('2026-08-25T16:59:00.000Z'),
          duration_ms: 1,
          success: 1,
          error_snippet: null,
        });
      }
      return originalExecute(sql, params);
    };
    await expect(executeTypedLineageMigration(runOptions(connection))).rejects.toMatchObject({
      code: 'typed_lineage_ledger_checksum_drift',
    });
    expect(connection.calls.some(call => call.sql === LEDGER_WRITE_SQL)).toBe(false);
  });

  test('a concurrently completed exact ledger row is verified without rewriting its audit facts', async () => {
    const state = createBaseState();
    OPERATIONS.forEach(operation => addOperationToState(state, operation));
    const connection = createFakeConnection(state);
    const originalExecute = connection.execute.bind(connection);
    const concurrentAppliedAt = new Date('2026-08-25T16:59:30.000Z');
    let ledgerReads = 0;
    connection.execute = async (sql, params = []) => {
      if (sql === LEDGER_READ_SQL && ++ledgerReads === 2) {
        state.ledger.push({
          id: state.nextLedgerId++,
          filename: MIGRATION_FILENAME,
          checksum: MIGRATION_SHA256,
          applied_at: concurrentAppliedAt,
          duration_ms: 99,
          success: 1,
          error_snippet: null,
        });
      }
      return originalExecute(sql, params);
    };
    const evidence = await executeTypedLineageMigration(runOptions(connection));
    expect(connection.calls.some(call => call.sql === LEDGER_WRITE_SQL)).toBe(false);
    expect(state.ledger[0]).toEqual(expect.objectContaining({
      applied_at: concurrentAppliedAt,
      duration_ms: 99,
    }));
    expect(evidence.ledger).toEqual(expect.objectContaining({
      status: 'already-recorded',
      writePerformed: false,
      durationMs: 99,
    }));
  });

  test('ledger omitted-id generation and unique-index shape are exact prerequisites', async () => {
    const missingAutoIncrement = createBaseState();
    missingAutoIncrement.tables.iset_migration.columns.find(item => item.Field === 'id').Extra = '';
    const missingAutoConnection = createFakeConnection(missingAutoIncrement);
    await expect(executeTypedLineageMigration(runOptions(missingAutoConnection))).rejects.toMatchObject({
      code: 'typed_lineage_ledger_id_generation_mismatch',
    });
    expect(missingAutoConnection.calls.some(call => call.method === 'execute')).toBe(false);

    const prefixedUnique = createBaseState();
    prefixedUnique.tables.iset_migration.indexes.find(
      item => item.Key_name === 'uniq_filename_checksum' && item.Column_name === 'filename'
    ).Sub_part = 32;
    const prefixedConnection = createFakeConnection(prefixedUnique);
    await expect(executeTypedLineageMigration(runOptions(prefixedConnection))).rejects.toMatchObject({
      code: 'typed_lineage_ledger_unique_mismatch',
    });
    expect(prefixedConnection.calls.some(call => call.method === 'execute')).toBe(false);
  });

  test('unexpected indexes or foreign keys on new lineage columns reject the target as non-exact', async () => {
    const redundantIndex = createBaseState();
    addOperationToState(redundantIndex, OPERATIONS[0]);
    redundantIndex.tables.cfa_version.indexes.push(indexRow('idx_unreviewed_application', 'application_id', 1, 1));
    const redundantIndexConnection = createFakeConnection(redundantIndex);
    await expect(executeTypedLineageMigration(runOptions(redundantIndexConnection))).rejects.toMatchObject({
      code: 'typed_lineage_unexpected_index',
    });
    expect(redundantIndexConnection.calls.some(call => OPERATIONS.some(operation => operation.ddl === call.sql))).toBe(false);

    const conflictingForeignKey = createBaseState();
    addOperationToState(conflictingForeignKey, OPERATIONS[0]);
    conflictingForeignKey.tables.cfa_version.foreignKeys.fk_unreviewed_application = {
      column: 'application_id',
      referencedTable: 'iset_application',
      referencedColumn: 'id',
      deleteRule: 'CASCADE',
      updateRule: 'RESTRICT',
      matchOption: 'NONE',
    };
    const conflictingForeignKeyConnection = createFakeConnection(conflictingForeignKey);
    await expect(executeTypedLineageMigration(runOptions(conflictingForeignKeyConnection))).rejects.toMatchObject({
      code: 'typed_lineage_unexpected_foreign_key',
    });
    expect(conflictingForeignKeyConnection.calls.some(call => OPERATIONS.some(operation => operation.ddl === call.sql))).toBe(false);
  });

  test('preserved case-series and global version-numbering topology must be exact', async () => {
    const wrongEngine = createBaseState();
    wrongEngine.tables.cfa_version.engine = 'NDBCLUSTER';
    await expect(executeTypedLineageMigration(runOptions(createFakeConnection(wrongEngine)))).rejects.toMatchObject({
      code: 'typed_lineage_table_engine_mismatch',
    });

    const brokenSeries = createBaseState();
    brokenSeries.tables.cfa_series.columns.find(item => item.Field === 'case_id').Null = 'YES';
    await expect(executeTypedLineageMigration(runOptions(createFakeConnection(brokenSeries)))).rejects.toMatchObject({
      code: 'typed_lineage_series_base_shape_mismatch',
    });

    const brokenUnique = createBaseState();
    brokenUnique.tables.funding_overview_version.indexes.find(
      item => item.Key_name === 'uniq_funding_overview_version_series' && item.Column_name === 'series_id'
    ).Sub_part = 4;
    await expect(executeTypedLineageMigration(runOptions(createFakeConnection(brokenUnique)))).rejects.toMatchObject({
      code: 'typed_lineage_index_shape_mismatch',
    });

    const brokenSeriesForeignKey = createBaseState();
    brokenSeriesForeignKey.tables.cfa_version.foreignKeys.fk_cfa_version_series.deleteRule = 'CASCADE';
    await expect(executeTypedLineageMigration(runOptions(createFakeConnection(brokenSeriesForeignKey)))).rejects.toMatchObject({
      code: 'typed_lineage_series_foreign_key_mismatch',
    });

    const cascadingSeriesUpdate = createBaseState();
    cascadingSeriesUpdate.tables.cfa_version.foreignKeys.fk_cfa_version_series.updateRule = 'CASCADE';
    await expect(executeTypedLineageMigration(runOptions(createFakeConnection(cascadingSeriesUpdate)))).rejects.toMatchObject({
      code: 'typed_lineage_series_foreign_key_mismatch',
    });

    const explicitlyRestrictiveSeriesUpdate = createBaseState();
    explicitlyRestrictiveSeriesUpdate.tables.cfa_version.foreignKeys.fk_cfa_version_series.updateRule = 'RESTRICT';
    await expect(executeTypedLineageMigration(runOptions(createFakeConnection(explicitlyRestrictiveSeriesUpdate)))).resolves.toMatchObject({
      decision: 'COMPLETE',
    });
  });

  test('a DDL failure stops immediately without ledger or cleanup SQL', async () => {
    const connection = createFakeConnection(createBaseState(), { failDdl: OPERATIONS[1].key });
    await expect(executeTypedLineageMigration(runOptions(connection))).rejects.toMatchObject({
      code: 'injected_ddl_failure',
      evidence: expect.objectContaining({ failure: expect.objectContaining({ ddlMayHaveAutoCommitted: true }) }),
    });
    const failingIndex = connection.calls.findIndex(call => call.sql === OPERATIONS[1].ddl);
    expect(connection.calls.slice(failingIndex + 1)).toEqual([{ method: 'end' }]);
  });

  test('an ambiguous first-DDL failure conservatively reports possible auto-commit', async () => {
    const connection = createFakeConnection(createBaseState(), { failDdl: OPERATIONS[0].key });
    let caught;
    try {
      await executeTypedLineageMigration(runOptions(connection));
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      code: 'injected_ddl_failure',
      evidence: expect.objectContaining({
        failure: expect.objectContaining({ ddlMayHaveAutoCommitted: true }),
        operations: [expect.objectContaining({
          key: OPERATIONS[0].key,
          attempted: true,
          executed: false,
        })],
      }),
    });
    const failingIndex = connection.calls.findIndex(call => call.sql === OPERATIONS[0].ddl);
    expect(connection.calls.slice(failingIndex + 1)).toEqual([{ method: 'end' }]);
  });

  test('post-DDL topology drift is detected before another operation or ledger write', async () => {
    const connection = createFakeConnection(createBaseState(), { mutateSeriesAfter: OPERATIONS[0].key });
    await expect(executeTypedLineageMigration(runOptions(connection))).rejects.toMatchObject({
      code: 'typed_lineage_series_changed',
    });
    expect(connection.calls.filter(call => OPERATIONS.some(operation => operation.ddl === call.sql))).toHaveLength(1);
    expect(connection.calls.filter(call => call.method === 'execute').map(call => call.sql)).toEqual([LEDGER_READ_SQL]);
  });

  test('volatile AUTO_INCREMENT, index statistics, and metadata row order do not masquerade as topology drift', async () => {
    const connection = createFakeConnection(createBaseState(), {
      mutateVolatileSeriesMetadataAfter: OPERATIONS[0].key,
      reorderSeriesIndexesAfter: OPERATIONS[0].key,
    });
    const evidence = await executeTypedLineageMigration(runOptions(connection));
    expect(evidence.decision).toBe('COMPLETE');
    expect(evidence.operations.every(operation => operation.executed)).toBe(true);
    expect(evidence.preflight.tables.cfa_series.ddlHash)
      .not.toBe(evidence.operations[0].postProof.tables.cfa_series.ddlHash);
    expect(evidence.preflight.tables.cfa_series.structureHash)
      .toBe(evidence.operations[0].postProof.tables.cfa_series.structureHash);
  });

  test('connection-close errors preserve either COMPLETE evidence or the original guarded failure', async () => {
    const completeState = createBaseState();
    OPERATIONS.forEach(operation => addOperationToState(completeState, operation));
    const completeEvidence = await executeTypedLineageMigration(runOptions(
      createFakeConnection(completeState, { failEnd: true })
    ));
    expect(completeEvidence.decision).toBe('COMPLETE');
    expect(completeEvidence.connectionCloseError).toEqual(expect.objectContaining({
      code: 'injected_close_failure',
    }));
    expect(completeEvidence.operationalWarnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'typed_lineage_connection_close_failed' }),
    ]));

    let guardedFailure;
    try {
      await executeTypedLineageMigration(runOptions(createFakeConnection(createBaseState(), {
        failDdl: OPERATIONS[0].key,
        failEnd: true,
      })));
    } catch (error) {
      guardedFailure = error;
    }
    expect(guardedFailure.code).toBe('injected_ddl_failure');
    expect(guardedFailure.evidence.connectionCloseError).toEqual(expect.objectContaining({
      code: 'injected_close_failure',
    }));
  });
});
