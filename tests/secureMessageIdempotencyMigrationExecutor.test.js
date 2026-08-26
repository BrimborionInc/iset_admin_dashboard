const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  CREATE_TABLE_DDL,
  ENVIRONMENT_CONTRACTS,
  LEDGER_READ_SQL,
  LEDGER_WRITE_SQL,
  MIGRATION_FILENAME,
  MIGRATION_SHA256,
  executeSecureMessageIdempotencyMigration,
  verifyMigrationArtifact,
} = require('../scripts/lib/secure-message-idempotency-migration-executor');
const {
  parseArgs,
  summarizeEvidence,
  validateArgs,
} = require('../scripts/apply-20260825-secure-message-idempotency');

const migrationPath = path.join(__dirname, '..', 'sql', 'migrations', MIGRATION_FILENAME);

function column(Field, Type, Null = 'NO', Extra = '', Collation = null, Default = null) {
  return { Field, Type, Null, Extra, Collation, Default, Key: '' };
}

function index(Key_name, Column_name, Non_unique, Seq_in_index) {
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

function createState({ target = false, targetExtraIndex = false, ledgerRows = [] } = {}) {
  const tables = {
    messages: {
      ddl: 'CREATE TABLE `messages` (`id` int NOT NULL AUTO_INCREMENT, `sender_user_id` int DEFAULT NULL, `sender_staff_profile_id` bigint unsigned DEFAULT NULL, `case_id` bigint unsigned NOT NULL, `application_id` bigint unsigned DEFAULT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
      columns: [
        column('id', 'int', 'NO', 'auto_increment'),
        column('sender_user_id', 'int', 'YES'),
        column('sender_staff_profile_id', 'bigint unsigned', 'YES'),
        column('case_id', 'bigint unsigned'),
        column('application_id', 'bigint unsigned', 'YES'),
      ],
      indexes: [index('PRIMARY', 'id', 0, 1)],
      constraints: [{ CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' }],
      keyRows: [{
        CONSTRAINT_NAME: 'PRIMARY', COLUMN_NAME: 'id', ORDINAL_POSITION: 1,
        REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null,
      }],
      referential: [],
    },
    iset_migration: {
      ddl: 'CREATE TABLE `iset_migration` (`id` int NOT NULL AUTO_INCREMENT, `filename` varchar(255) NOT NULL, `checksum` char(64) NOT NULL, `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, `duration_ms` int NOT NULL, `success` tinyint(1) NOT NULL DEFAULT 1, `error_snippet` text, PRIMARY KEY (`id`), UNIQUE KEY `uniq_filename_checksum` (`filename`,`checksum`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
      columns: [
        column('id', 'int', 'NO', 'auto_increment'),
        column('filename', 'varchar(255)', 'NO', '', 'utf8mb4_0900_ai_ci'),
        column('checksum', 'char(64)', 'NO', '', 'utf8mb4_0900_ai_ci'),
        column('applied_at', 'datetime', 'NO', 'DEFAULT_GENERATED', null, 'CURRENT_TIMESTAMP'),
        column('duration_ms', 'int'),
        column('success', 'tinyint(1)', 'NO', '', null, '1'),
        column('error_snippet', 'text', 'YES', '', 'utf8mb4_0900_ai_ci'),
      ],
      indexes: [
        index('PRIMARY', 'id', 0, 1),
        index('uniq_filename_checksum', 'filename', 0, 1),
        index('uniq_filename_checksum', 'checksum', 0, 2),
      ],
      constraints: [
        { CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' },
        { CONSTRAINT_NAME: 'uniq_filename_checksum', CONSTRAINT_TYPE: 'UNIQUE' },
      ],
      keyRows: [
        { CONSTRAINT_NAME: 'PRIMARY', COLUMN_NAME: 'id', ORDINAL_POSITION: 1, REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null },
        { CONSTRAINT_NAME: 'uniq_filename_checksum', COLUMN_NAME: 'filename', ORDINAL_POSITION: 1, REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null },
        { CONSTRAINT_NAME: 'uniq_filename_checksum', COLUMN_NAME: 'checksum', ORDINAL_POSITION: 2, REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null },
      ],
      referential: [],
    },
  };
  const addTarget = () => {
    tables.message_send_operation = {
      ddl: `CREATE TABLE \`message_send_operation\` (${CREATE_TABLE_DDL.slice(CREATE_TABLE_DDL.indexOf('(') + 1, CREATE_TABLE_DDL.lastIndexOf(')'))}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      columns: [
        column('id', 'bigint unsigned', 'NO', 'auto_increment'),
        column('client_operation_id', 'varchar(128)', 'NO', '', 'ascii_bin'),
        column('request_sha256', 'char(64)', 'NO', '', 'ascii_bin'),
        column('sender_user_id', 'int'),
        column('sender_staff_profile_id', 'bigint unsigned', 'YES'),
        column('case_id', 'bigint unsigned'),
        column('application_id', 'bigint unsigned', 'YES'),
        column('message_id', 'int', 'YES'),
        column('response_status', 'smallint unsigned', 'YES'),
        column('response_json', 'json', 'YES'),
        column('created_at', 'timestamp', 'YES', 'DEFAULT_GENERATED', null, 'CURRENT_TIMESTAMP'),
        column('completed_at', 'timestamp', 'YES'),
      ],
      indexes: [
        index('PRIMARY', 'id', 0, 1),
        index('uq_message_send_operation_scope', 'sender_user_id', 0, 1),
        index('uq_message_send_operation_scope', 'case_id', 0, 2),
        index('uq_message_send_operation_scope', 'client_operation_id', 0, 3),
        index('idx_message_send_operation_message', 'message_id', 1, 1),
        ...(targetExtraIndex ? [index('idx_unexpected', 'case_id', 1, 1)] : []),
      ],
      constraints: [
        { CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' },
        { CONSTRAINT_NAME: 'uq_message_send_operation_scope', CONSTRAINT_TYPE: 'UNIQUE' },
        { CONSTRAINT_NAME: 'fk_message_send_operation_message', CONSTRAINT_TYPE: 'FOREIGN KEY' },
      ],
      keyRows: [
        { CONSTRAINT_NAME: 'PRIMARY', COLUMN_NAME: 'id', ORDINAL_POSITION: 1, REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null },
        { CONSTRAINT_NAME: 'uq_message_send_operation_scope', COLUMN_NAME: 'sender_user_id', ORDINAL_POSITION: 1, REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null },
        { CONSTRAINT_NAME: 'uq_message_send_operation_scope', COLUMN_NAME: 'case_id', ORDINAL_POSITION: 2, REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null },
        { CONSTRAINT_NAME: 'uq_message_send_operation_scope', COLUMN_NAME: 'client_operation_id', ORDINAL_POSITION: 3, REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null },
        { CONSTRAINT_NAME: 'fk_message_send_operation_message', COLUMN_NAME: 'message_id', ORDINAL_POSITION: 1, REFERENCED_TABLE_NAME: 'messages', REFERENCED_COLUMN_NAME: 'id' },
      ],
      referential: [{
        CONSTRAINT_NAME: 'fk_message_send_operation_message',
        MATCH_OPTION: 'NONE',
        UPDATE_RULE: 'NO ACTION',
        DELETE_RULE: 'CASCADE',
      }],
    };
  };
  if (target) addTarget();
  return { tables, ledgerRows: [...ledgerRows], addTarget, ddlCalls: [], ended: false };
}

function createConnection(state) {
  const query = jest.fn(async (sql, params = []) => {
    const text = String(sql);
    if (text === 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()') {
      return [[{
        'DATABASE()': 'iset_intake',
        '@@hostname': 'DESKTOP-PDFA51K',
        '@@port': 3306,
        'CURRENT_USER()': 'root@172.26.%',
        'VERSION()': '8.0.40',
      }], []];
    }
    if (text.startsWith('SHOW FULL TABLES FROM')) {
      const table = params[0];
      return state.tables[table]
        ? [[{ Tables_in_iset_intake: table, Table_type: 'BASE TABLE' }], []]
        : [[], []];
    }
    if (text.startsWith('SHOW CREATE TABLE')) {
      const table = /`([^`]+)`/u.exec(text)?.[1];
      return [[{ Table: table, 'Create Table': state.tables[table].ddl }], []];
    }
    if (text.startsWith('SHOW FULL COLUMNS FROM')) {
      const table = /`([^`]+)`/u.exec(text)?.[1];
      return [state.tables[table].columns, []];
    }
    if (text.startsWith('SHOW INDEX FROM')) {
      const table = /`([^`]+)`/u.exec(text)?.[1];
      return [state.tables[table].indexes, []];
    }
    if (text.includes('information_schema.TABLE_CONSTRAINTS')) {
      return [state.tables[params[0]].constraints, []];
    }
    if (text.includes('information_schema.KEY_COLUMN_USAGE')) {
      return [state.tables[params[0]].keyRows, []];
    }
    if (text.includes('information_schema.REFERENTIAL_CONSTRAINTS')) {
      return [state.tables[params[0]].referential, []];
    }
    if (text === CREATE_TABLE_DDL) {
      state.ddlCalls.push(text);
      state.addTarget();
      return [{ affectedRows: 0 }, []];
    }
    throw new Error(`unexpected_query:${text}`);
  });
  const execute = jest.fn(async (sql, params = []) => {
    if (sql === LEDGER_READ_SQL) {
      return [state.ledgerRows.filter(row => row.filename === params[0]), []];
    }
    if (sql === LEDGER_WRITE_SQL) {
      const [filename, checksum, appliedAt, durationMs] = params;
      const existing = state.ledgerRows.find(row => row.filename === filename && row.checksum === checksum);
      if (existing) Object.assign(existing, { applied_at: appliedAt, duration_ms: durationMs, success: 1, error_snippet: null });
      else state.ledgerRows.push({ id: 1, filename, checksum, applied_at: appliedAt, duration_ms: durationMs, success: 1, error_snippet: null });
      return [{ affectedRows: 1 }, []];
    }
    throw new Error(`unexpected_execute:${sql}`);
  });
  return {
    query,
    execute,
    end: jest.fn(async () => { state.ended = true; }),
  };
}

describe('bounded secure-message idempotency migration executor', () => {
  test('the canonical artifact is exact and checksum drift is rejected', () => {
    expect(verifyMigrationArtifact(migrationPath)).toEqual({
      filename: MIGRATION_FILENAME,
      checksum: MIGRATION_SHA256,
      operationCount: 1,
      executionModel: 'file-pinned-literal-ddl',
    });
    const canonicalSql = fs.readFileSync(migrationPath, 'utf8');
    expect(canonicalSql).toContain('@message_send_operation_total_column_count = 12');
    expect(canonicalSql).toContain('@message_send_operation_total_index_row_count = 5');
    expect(canonicalSql).toContain('@message_send_operation_total_index_name_count = 3');
    expect(canonicalSql).toContain('@message_send_operation_total_constraint_count = 3');
    expect(canonicalSql).toContain("AND sub_part IS NULL\n     AND UPPER(index_type) = 'BTREE'\n     AND is_visible = 'YES'\n     AND expression IS NULL");
    expect(canonicalSql).toContain('AND kcu.referenced_table_schema = DATABASE()');
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'message-idempotency-migration-'));
    const changed = path.join(directory, MIGRATION_FILENAME);
    fs.writeFileSync(changed, `${fs.readFileSync(migrationPath, 'utf8')}\n`, 'utf8');
    expect(() => verifyMigrationArtifact(changed)).toThrow(expect.objectContaining({
      code: 'secure_message_idempotency_migration_checksum_mismatch',
    }));
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('missing target receives only the pinned CREATE, exact post-proof, and ledger row', async () => {
    const state = createState();
    const connection = createConnection(state);
    const evidence = await executeSecureMessageIdempotencyMigration({
      targetEnv: 'dev',
      configuredIdentity: ENVIRONMENT_CONTRACTS.dev.configured,
      connectionFactory: async () => connection,
      migrationPath,
      clock: () => new Date('2026-08-25T12:00:00.000Z'),
    });
    expect(evidence).toMatchObject({
      executor: '20260825-secure-message-idempotency-bounded',
      targetEnv: 'dev',
      decision: 'COMPLETE',
      phase: 'complete',
      migration: { filename: MIGRATION_FILENAME, checksum: MIGRATION_SHA256 },
      finalProof: { operationStates: { message_send_operation: 'target' } },
      ledger: { status: 'recorded', writePerformed: true },
    });
    expect(state.ddlCalls).toEqual([CREATE_TABLE_DDL]);
    expect(state.ledgerRows).toHaveLength(1);
    expect(state.ended).toBe(true);
  });

  test('an exact existing target is revalidated without DDL or ledger timestamp rewrite', async () => {
    const prior = {
      id: 9,
      filename: MIGRATION_FILENAME,
      checksum: MIGRATION_SHA256,
      applied_at: '2026-08-25T11:00:00.000Z',
      duration_ms: 17,
      success: 1,
      error_snippet: null,
    };
    const state = createState({ target: true, ledgerRows: [prior] });
    const connection = createConnection(state);
    const evidence = await executeSecureMessageIdempotencyMigration({
      targetEnv: 'dev',
      configuredIdentity: ENVIRONMENT_CONTRACTS.dev.configured,
      connectionFactory: async () => connection,
      migrationPath,
    });
    expect(state.ddlCalls).toEqual([]);
    expect(connection.execute).not.toHaveBeenCalledWith(LEDGER_WRITE_SQL, expect.anything());
    expect(evidence.ledger).toMatchObject({
      status: 'already-recorded',
      writePerformed: false,
      appliedAt: prior.applied_at,
      durationMs: 17,
    });
  });

  test('target topology drift and ledger/schema contradiction fail before mutation', async () => {
    const drifted = createState({ target: true, targetExtraIndex: true });
    const driftedConnection = createConnection(drifted);
    await expect(executeSecureMessageIdempotencyMigration({
      targetEnv: 'dev',
      configuredIdentity: ENVIRONMENT_CONTRACTS.dev.configured,
      connectionFactory: async () => driftedConnection,
      migrationPath,
    })).rejects.toMatchObject({
      code: 'secure_message_idempotency_target_index_set_mismatch',
      evidence: { failure: { ddlMayHaveAutoCommitted: false } },
    });
    expect(drifted.ddlCalls).toEqual([]);
    expect(drifted.ledgerRows).toEqual([]);

    const contradiction = createState({
      ledgerRows: [{
        id: 1,
        filename: MIGRATION_FILENAME,
        checksum: MIGRATION_SHA256,
        applied_at: '2026-08-25T12:00:00.000Z',
        duration_ms: 1,
        success: 1,
        error_snippet: null,
      }],
    });
    await expect(executeSecureMessageIdempotencyMigration({
      targetEnv: 'dev',
      configuredIdentity: ENVIRONMENT_CONTRACTS.dev.configured,
      connectionFactory: async () => createConnection(contradiction),
      migrationPath,
    })).rejects.toMatchObject({ code: 'secure_message_idempotency_ledger_schema_contradiction' });
    expect(contradiction.ddlCalls).toEqual([]);
  });

  test('ledger default metadata drift fails closed before any DDL or ledger write', async () => {
    const state = createState();
    state.tables.iset_migration.columns[3].Extra = '';
    const connection = createConnection(state);
    await expect(executeSecureMessageIdempotencyMigration({
      targetEnv: 'dev',
      configuredIdentity: ENVIRONMENT_CONTRACTS.dev.configured,
      connectionFactory: async () => connection,
      migrationPath,
    })).rejects.toMatchObject({
      code: 'secure_message_idempotency_ledger_shape_mismatch',
      message: 'applied_at',
      evidence: { failure: { ddlMayHaveAutoCommitted: false } },
    });
    expect(state.ddlCalls).toEqual([]);
    expect(state.ledgerRows).toEqual([]);
    expect(connection.execute).not.toHaveBeenCalled();
  });

  test('wrapper requires explicit target authority and emits the registry summary contract', () => {
    expect(parseArgs([
      '--target-env', 'test',
      '--env-file', '/tmp/test.env',
      '--expected-aws-account-id', '124355655255',
      '--expected-ssm-instance-id', 'i-0123456789abcdef0',
      '--run-token', 'run-1',
      '--compact-output',
      '--yes',
    ])).toMatchObject({ targetEnv: 'test', compactOutput: true, yes: true });
    expect(() => validateArgs({
      targetEnv: 'test',
      envFile: '/tmp/test.env',
      expectedAwsAccountId: '468278742295',
      expectedSsmInstanceId: 'i-0123456789abcdef0',
      runToken: 'run-1',
      yes: true,
    })).toThrow('TEST requires --expected-aws-account-id 124355655255');
    expect(summarizeEvidence({
      executor: '20260825-secure-message-idempotency-bounded',
      targetEnv: 'test',
      decision: 'COMPLETE',
      phase: 'complete',
      operations: [{}],
      migration: { filename: MIGRATION_FILENAME, checksum: MIGRATION_SHA256 },
      finalProof: {
        identity: { database: 'iset_intake' },
        operationStates: { message_send_operation: 'target' },
      },
      ledger: { status: 'recorded' },
    }, { evidencePath: '/tmp/evidence.json' })).toMatchObject({
      evidencePath: '/tmp/evidence.json',
      executor: '20260825-secure-message-idempotency-bounded',
      operationCount: 1,
      finalOperationStates: { message_send_operation: 'target' },
    });
  });
});
