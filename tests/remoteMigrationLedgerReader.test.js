const fs = require('fs');
const { spawnSync } = require('child_process');

const {
  ENVIRONMENT_REGIONS,
  READER_ID,
  RESULT_MARKER,
  encodeResultMarker,
  readRemoteMigrationLedger,
  validateArgs,
} = require('../scripts/read-remote-migration-ledger');
const { buildAppliedMigrationRowsSql } = require('../src/lib/sharedSchemaMigrationRunner');
const {
  ENVIRONMENT_CONTRACTS,
  EXPECTED_AWS_ACCOUNT_IDS,
} = require('../scripts/lib/typed-lineage-migration-executor');
const {
  REMOTE_TARGETS,
  createRemoteMigrationLedgerReaderBundle,
  discoverRemoteMigrationInstance,
  dispatchRemoteMigrationLedgerReader,
  parseRemoteMigrationLedgerResult,
  proveRemoteAwsIdentity,
  validateRemoteMigrationLedgerResult,
} = require('../scripts/path-schema-migrate');

const TRACKING_DDL = `CREATE TABLE \`iset_migration\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`filename\` varchar(255) NOT NULL,
  \`checksum\` char(64) NOT NULL,
  \`applied_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`duration_ms\` int NOT NULL,
  \`success\` tinyint(1) NOT NULL DEFAULT '1',
  \`error_snippet\` text,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uniq_filename_checksum\` (\`filename\`,\`checksum\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const TRACKING_COLUMNS = [
  { Field: 'id', Type: 'int', Collation: null, Null: 'NO', Key: 'PRI', Default: null, Extra: 'auto_increment' },
  { Field: 'filename', Type: 'varchar(255)', Collation: 'utf8mb4_unicode_ci', Null: 'NO', Key: 'MUL', Default: null, Extra: '' },
  { Field: 'checksum', Type: 'char(64)', Collation: 'utf8mb4_unicode_ci', Null: 'NO', Key: '', Default: null, Extra: '' },
  { Field: 'applied_at', Type: 'datetime', Collation: null, Null: 'NO', Key: '', Default: 'CURRENT_TIMESTAMP', Extra: '' },
  { Field: 'duration_ms', Type: 'int', Collation: null, Null: 'NO', Key: '', Default: null, Extra: '' },
  { Field: 'success', Type: 'tinyint(1)', Collation: null, Null: 'NO', Key: '', Default: '1', Extra: '' },
  { Field: 'error_snippet', Type: 'text', Collation: 'utf8mb4_unicode_ci', Null: 'YES', Key: '', Default: null, Extra: '' },
];

const TEST_INSTANCE_ID = 'i-0123456789abcdef0';
const TEST_ENV_FILE = '/candidate/admin-dashboard/.env';
const TEST_RUN_TOKEN = 'migration-ledger-test-123';

function args(overrides = {}) {
  return {
    targetEnv: 'test',
    envFile: TEST_ENV_FILE,
    expectedAwsAccountId: EXPECTED_AWS_ACCOUNT_IDS.test,
    expectedSsmInstanceId: TEST_INSTANCE_ID,
    runToken: TEST_RUN_TOKEN,
    ...overrides,
  };
}

function configuredDb(overrides = {}) {
  return {
    ...ENVIRONMENT_CONTRACTS.test.configured,
    password: 'candidate-db-secret',
    ...overrides,
  };
}

function instanceIdentity(overrides = {}) {
  return {
    Account: EXPECTED_AWS_ACCOUNT_IDS.test,
    InstanceId: TEST_INSTANCE_ID,
    Region: ENVIRONMENT_REGIONS.test,
    ...overrides,
  };
}

function createConnection({ trackingTableExists = true, appliedRows = [], liveOverrides = {} } = {}) {
  const live = { ...ENVIRONMENT_CONTRACTS.test.live, ...liveOverrides };
  const query = jest.fn(async (statement, params = []) => {
    const sql = String(statement).trim().replace(/\s+/gu, ' ');
    if (sql === 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()') {
      return [[{
        'DATABASE()': live.database,
        '@@hostname': live.host,
        '@@port': live.port,
        'CURRENT_USER()': live.currentUser,
        'VERSION()': live.version,
      }], []];
    }
    if (sql === 'SHOW FULL TABLES FROM `iset_intake` LIKE ?') {
      expect(params).toEqual(['iset_migration']);
      return trackingTableExists
        ? [[{ Tables_in_iset_intake: 'iset_migration', Table_type: 'BASE TABLE' }], []]
        : [[], []];
    }
    if (sql === 'SHOW CREATE TABLE `iset_migration`') {
      return [[{ Table: 'iset_migration', 'Create Table': TRACKING_DDL }], []];
    }
    if (sql === 'SHOW FULL COLUMNS FROM `iset_migration`') return [TRACKING_COLUMNS, []];
    if (sql === 'SHOW INDEX FROM `iset_migration`') {
      return [[
        { Key_name: 'PRIMARY', Column_name: 'id', Non_unique: 0, Seq_in_index: 1 },
        { Key_name: 'uniq_filename_checksum', Column_name: 'filename', Non_unique: 0, Seq_in_index: 1 },
        { Key_name: 'uniq_filename_checksum', Column_name: 'checksum', Non_unique: 0, Seq_in_index: 2 },
      ], []];
    }
    if (sql.includes('FROM information_schema.TABLE_CONSTRAINTS')) {
      return [[
        { CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' },
        { CONSTRAINT_NAME: 'uniq_filename_checksum', CONSTRAINT_TYPE: 'UNIQUE' },
      ], []];
    }
    if (sql.includes('FROM information_schema.KEY_COLUMN_USAGE')) {
      return [[
        { CONSTRAINT_NAME: 'PRIMARY', COLUMN_NAME: 'id', REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null, ORDINAL_POSITION: 1 },
        { CONSTRAINT_NAME: 'uniq_filename_checksum', COLUMN_NAME: 'filename', REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null, ORDINAL_POSITION: 1 },
        { CONSTRAINT_NAME: 'uniq_filename_checksum', COLUMN_NAME: 'checksum', REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null, ORDINAL_POSITION: 2 },
      ], []];
    }
    throw new Error(`Unexpected metadata SQL: ${sql}`);
  });
  const execute = jest.fn(async (statement, params = []) => {
    expect(statement).toBe(buildAppliedMigrationRowsSql('iset_migration'));
    expect(params).toEqual([]);
    return [appliedRows, []];
  });
  return { query, execute, end: jest.fn(async () => {}) };
}

async function readLedger({ trackingTableExists = true, appliedRows = [], overrides = {} } = {}) {
  const connection = createConnection({ trackingTableExists, appliedRows });
  const createMysqlConnection = jest.fn(async () => connection);
  const identityProvider = jest.fn(async () => instanceIdentity());
  const result = await readRemoteMigrationLedger(args(), {
    expectedEnvFile: TEST_ENV_FILE,
    readDbConfigImpl: () => configuredDb(),
    instanceIdentityProvider: identityProvider,
    createConnection: createMysqlConnection,
    ...overrides,
  });
  return { result, connection, createMysqlConnection, identityProvider };
}

describe('candidate-bundled remote migration ledger reader', () => {
  test('outer profile account proof and ASG/SSM intersection select only a healthy exact target', () => {
    const remoteConfig = {
      ...REMOTE_TARGETS.test,
      profile: REMOTE_TARGETS.test.defaultProfile,
      region: REMOTE_TARGETS.test.defaultRegion,
    };
    const runAws = jest.fn((_config, awsArgs) => {
      if (awsArgs[0] === 'sts') {
        return {
          Account: EXPECTED_AWS_ACCOUNT_IDS.test,
          Arn: 'arn:aws:sts::124355655255:assumed-role/test/operator',
          UserId: 'test-user',
        };
      }
      if (awsArgs[0] === 'autoscaling') {
        return { AutoScalingGroups: [{
          Instances: [
            { InstanceId: TEST_INSTANCE_ID, LifecycleState: 'InService', HealthStatus: 'Healthy' },
            { InstanceId: 'i-11111111111111111', LifecycleState: 'InService', HealthStatus: 'Unhealthy' },
          ],
        }] };
      }
      if (awsArgs[0] === 'ssm') {
        return { InstanceInformationList: [
          { InstanceId: TEST_INSTANCE_ID, PingStatus: 'Online' },
          { InstanceId: 'i-11111111111111111', PingStatus: 'Online' },
          { InstanceId: 'i-22222222222222222', PingStatus: 'Online' },
        ] };
      }
      throw new Error(`Unexpected AWS call: ${awsArgs.join(' ')}`);
    });

    expect(proveRemoteAwsIdentity(remoteConfig, runAws)).toMatchObject({
      Account: EXPECTED_AWS_ACCOUNT_IDS.test,
    });
    expect(discoverRemoteMigrationInstance(remoteConfig, runAws)).toBe(TEST_INSTANCE_ID);
    expect(runAws.mock.calls.every(([config]) => config === remoteConfig)).toBe(true);
  });

  test('outer AWS account mismatch fails before instance discovery can be trusted', () => {
    const remoteConfig = {
      ...REMOTE_TARGETS.test,
      profile: REMOTE_TARGETS.test.defaultProfile,
      region: REMOTE_TARGETS.test.defaultRegion,
    };
    expect(() => proveRemoteAwsIdentity(remoteConfig, () => ({
      Account: EXPECTED_AWS_ACCOUNT_IDS.prod,
      Arn: 'wrong-account',
      UserId: 'wrong-account',
    }))).toThrow(expect.objectContaining({ code: 'remote_schema_outer_aws_identity_mismatch' }));
  });

  test('bundle contains the candidate reader, live guard, shared runner, and pinned contracts with a hash manifest', () => {
    const bundle = createRemoteMigrationLedgerReaderBundle();
    try {
      const listing = spawnSync('tar', ['-tzf', bundle.archivePath], { encoding: 'utf8' });
      expect(listing.status).toBe(0);
      expect(listing.stdout.split(/\r?\n/u)).toEqual(expect.arrayContaining([
        './MANIFEST.sha256',
        './scripts/read-remote-migration-ledger.js',
        './scripts/lib/live-mysql-schema-guard.js',
        './scripts/lib/typed-lineage-migration-executor.js',
        './src/lib/sharedSchemaMigrationRunner.js',
      ]));
      expect(bundle.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(bundle.bytes).toBeGreaterThan(0);
    } finally {
      fs.rmSync(bundle.tempRoot, { recursive: true, force: true });
    }
  });

  test('uses one exact MySQL connection for identity, full metadata preflight, and one guarded ledger read', async () => {
    const appliedRows = [{
      filename: '20260825_0001_example.sql',
      checksum: 'a'.repeat(64),
      success: 1,
      applied_at: new Date('2026-08-25T12:00:00.000Z'),
      duration_ms: 17,
      error_snippet: null,
    }];
    const { result, connection, createMysqlConnection, identityProvider } = await readLedger({ appliedRows });

    expect(identityProvider).toHaveBeenCalledTimes(1);
    expect(createMysqlConnection).toHaveBeenCalledTimes(1);
    expect(createMysqlConnection).toHaveBeenCalledWith(expect.objectContaining({
      ...ENVIRONMENT_CONTRACTS.test.configured,
      password: 'candidate-db-secret',
      multipleStatements: false,
    }));
    expect(connection.execute).toHaveBeenCalledTimes(1);
    expect(connection.execute).toHaveBeenCalledWith(buildAppliedMigrationRowsSql('iset_migration'), []);
    expect(connection.end).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      reader: READER_ID,
      decision: 'COMPLETE',
      targetEnv: 'test',
      awsIdentity: instanceIdentity(),
      executionContext: { runToken: TEST_RUN_TOKEN, envFile: TEST_ENV_FILE },
      trackingTable: 'iset_migration',
      trackingTableExists: true,
      rows: [expect.objectContaining({
        filename: appliedRows[0].filename,
        applied_at: '2026-08-25T12:00:00.000Z',
      })],
      guardEvidence: expect.objectContaining({
        preflightComplete: true,
        verifiedStatementCount: 1,
        objects: {
          iset_migration: expect.objectContaining({
            ddlHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
            columnsHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
            indexesHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
            constraintsHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
          }),
        },
      }),
    });
    expect(JSON.stringify(result)).not.toContain('candidate-db-secret');
  });

  test('proves optional ledger absence and executes no ordinary SQL', async () => {
    const { result, connection } = await readLedger({ trackingTableExists: false });

    expect(result).toMatchObject({
      trackingTableExists: false,
      rows: [],
      guardEvidence: expect.objectContaining({
        optionalAbsentObjects: ['iset_migration'],
        objects: {},
        verifiedStatementCount: 0,
        verifiedStatements: [],
      }),
    });
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledTimes(1);
  });

  test('rejects a different IMDS instance before opening MySQL', async () => {
    const createMysqlConnection = jest.fn();
    await expect(readRemoteMigrationLedger(args(), {
      expectedEnvFile: TEST_ENV_FILE,
      readDbConfigImpl: () => configuredDb(),
      instanceIdentityProvider: async () => instanceIdentity({ InstanceId: 'i-fffffffffffffffff' }),
      createConnection: createMysqlConnection,
    })).rejects.toMatchObject({ code: 'remote_migration_ledger_instance_identity_mismatch' });
    expect(createMysqlConnection).not.toHaveBeenCalled();
  });

  test('rejects configured database drift before IMDS or MySQL', async () => {
    const identityProvider = jest.fn();
    const createMysqlConnection = jest.fn();
    await expect(readRemoteMigrationLedger(args(), {
      expectedEnvFile: TEST_ENV_FILE,
      readDbConfigImpl: () => configuredDb({ host: 'wrong.example.invalid' }),
      instanceIdentityProvider: identityProvider,
      createConnection: createMysqlConnection,
    })).rejects.toMatchObject({ code: 'remote_migration_ledger_configured_identity_mismatch' });
    expect(identityProvider).not.toHaveBeenCalled();
    expect(createMysqlConnection).not.toHaveBeenCalled();
  });

  test('live database identity drift closes the sole connection without ordinary SQL', async () => {
    const connection = createConnection({
      liveOverrides: { currentUser: 'app_admin@unexpected' },
    });
    await expect(readRemoteMigrationLedger(args(), {
      expectedEnvFile: TEST_ENV_FILE,
      readDbConfigImpl: () => configuredDb(),
      instanceIdentityProvider: async () => instanceIdentity(),
      createConnection: async () => connection,
    })).rejects.toMatchObject({ code: 'schema_guard_wrong_database_principal' });
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledTimes(1);
  });

  test('requires the exact remote env file, account, instance, and run token', () => {
    expect(() => validateArgs(args({ envFile: '/tmp/copied.env' }), {
      expectedEnvFile: TEST_ENV_FILE,
    })).toThrow(expect.objectContaining({ code: 'remote_migration_ledger_env_file_mismatch' }));
    expect(() => validateArgs(args({ expectedAwsAccountId: EXPECTED_AWS_ACCOUNT_IDS.prod }), {
      expectedEnvFile: TEST_ENV_FILE,
    })).toThrow(expect.objectContaining({ code: 'remote_migration_ledger_expected_account_mismatch' }));
    expect(() => validateArgs(args({ expectedSsmInstanceId: 'not-an-instance' }), {
      expectedEnvFile: TEST_ENV_FILE,
    })).toThrow(expect.objectContaining({ code: 'remote_migration_ledger_expected_instance_invalid' }));
    expect(() => validateArgs(args({ runToken: '../escape' }), {
      expectedEnvFile: TEST_ENV_FILE,
    })).toThrow(expect.objectContaining({ code: 'remote_migration_ledger_run_token_invalid' }));
  });

  test('compressed marker round-trips and local validation rejects evidence tampering', async () => {
    const { result } = await readLedger({
      appliedRows: [{
        filename: '20260825_0001_example.sql',
        checksum: 'b'.repeat(64),
        success: 1,
        applied_at: '2026-08-25 12:00:00',
        duration_ms: 2,
        error_snippet: null,
      }],
    });
    const marker = encodeResultMarker(result);
    expect(marker.startsWith(RESULT_MARKER)).toBe(true);
    const parsed = parseRemoteMigrationLedgerResult(marker);
    const remoteConfig = {
      ...REMOTE_TARGETS.test,
      profile: REMOTE_TARGETS.test.defaultProfile,
      region: REMOTE_TARGETS.test.defaultRegion,
      remoteEnvFile: TEST_ENV_FILE,
    };
    expect(validateRemoteMigrationLedgerResult(
      parsed,
      remoteConfig,
      TEST_INSTANCE_ID,
      TEST_RUN_TOKEN
    )).toEqual(parsed);

    const tampered = JSON.parse(JSON.stringify(parsed));
    tampered.guardEvidence.objects.iset_migration.ddlHash = '0'.repeat(64);
    expect(() => validateRemoteMigrationLedgerResult(
      tampered,
      remoteConfig,
      TEST_INSTANCE_ID,
      TEST_RUN_TOKEN
    )).toThrow(expect.objectContaining({ code: 'remote_migration_ledger_guard_evidence_invalid' }));
  });

  test('outer account and healthy-instance proofs bind the staged reader to one exact SSM target', async () => {
    const { result } = await readLedger({
      appliedRows: [{
        filename: '20260825_0001_example.sql',
        checksum: 'c'.repeat(64),
        success: 1,
        applied_at: '2026-08-25 12:00:00',
        duration_ms: 3,
        error_snippet: null,
      }],
    });
    const remoteConfig = {
      ...REMOTE_TARGETS.test,
      profile: REMOTE_TARGETS.test.defaultProfile,
      region: REMOTE_TARGETS.test.defaultRegion,
      remoteEnvFile: TEST_ENV_FILE,
    };
    const outerIdentity = {
      Account: EXPECTED_AWS_ACCOUNT_IDS.test,
      Arn: 'arn:aws:sts::124355655255:assumed-role/test/operator',
      UserId: 'test-user',
    };
    const proveOuterAwsIdentity = jest.fn(() => outerIdentity);
    const discoverInstance = jest.fn(() => TEST_INSTANCE_ID);
    const tempRoot = fs.mkdtempSync('/tmp/remote-ledger-dispatch-test-');
    const createBundle = jest.fn(() => ({
      tempRoot,
      archivePath: `${tempRoot}/bundle.tgz`,
      sha256: 'd'.repeat(64),
      bytes: 123,
    }));
    const stagedArtifact = {
      key: 'reader/key',
      uri: 's3://test/reader/key',
      downloadUrl: 'https://example.test/reader.tgz',
      sha256: 'd'.repeat(64),
      bytes: 123,
    };
    const stageBundle = jest.fn(() => stagedArtifact);
    const deleteStagedObject = jest.fn(() => ({ deleted: true }));
    let dispatchedRunToken = null;
    const sendCommand = jest.fn((_config, instanceId, commands) => {
      expect(instanceId).toBe(TEST_INSTANCE_ID);
      const command = commands.join('\n');
      expect(command).toContain("'scripts/read-remote-migration-ledger.js'");
      expect(command).toContain(`'${TEST_ENV_FILE}'`);
      expect(command).toContain("trap 'rm -rf -- \"$OPS_DIR\"' EXIT");
      const match = /'--run-token' '([^']+)'/u.exec(command);
      expect(match).not.toBeNull();
      dispatchedRunToken = match[1];
      return 'command-123';
    });
    const waitCommand = jest.fn(() => ({
      Status: 'Success',
      StandardOutputContent: encodeResultMarker({
        ...result,
        executionContext: {
          ...result.executionContext,
          runToken: dispatchedRunToken,
        },
      }),
      StandardErrorContent: '',
    }));

    const ledger = dispatchRemoteMigrationLedgerReader(remoteConfig, {
      proveOuterAwsIdentity,
      discoverInstance,
      createBundle,
      stageBundle,
      sendCommand,
      waitCommand,
      deleteStagedObject,
    });

    expect(proveOuterAwsIdentity).toHaveBeenCalledWith(remoteConfig);
    expect(discoverInstance).toHaveBeenCalledWith(remoteConfig);
    expect(stageBundle).toHaveBeenCalledWith(remoteConfig, expect.objectContaining({
      sha256: 'd'.repeat(64),
    }), expect.stringMatching(/^migration-ledger-test-/u));
    expect(sendCommand).toHaveBeenCalledTimes(1);
    expect(waitCommand).toHaveBeenCalledWith(remoteConfig, 'command-123', TEST_INSTANCE_ID);
    expect(ledger).toMatchObject({
      trackingTableExists: true,
      rows: result.rows,
      schemaEvidence: {
        reader: READER_ID,
        outerAwsIdentity: outerIdentity,
        remoteAwsIdentity: instanceIdentity(),
        instanceId: TEST_INSTANCE_ID,
        stagingCleanup: {
          remoteOps: 'shell-exit-trap',
          bundleObjectDeleted: true,
        },
      },
    });
    expect(deleteStagedObject).toHaveBeenCalledWith(remoteConfig, stagedArtifact.key);
    expect(fs.existsSync(tempRoot)).toBe(false);
  });
});
