'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MIGRATION_FILENAME = '20260825_0002_add_secure_message_send_idempotency.sql';
const MIGRATION_SHA256 = '15cbd83ef53695c6c4036266701bb080d854f9f47693a8f0cf1c18a99ec0a709';
const EXPECTED_AWS_ACCOUNT_IDS = Object.freeze({
  test: '124355655255',
  prod: '468278742295',
});
const EXPECTED_AWS_ACCOUNT_ID = EXPECTED_AWS_ACCOUNT_IDS.test;

const ENVIRONMENT_CONTRACTS = Object.freeze({
  dev: Object.freeze({
    configured: Object.freeze({
      host: '172.26.176.1',
      user: 'root',
      database: 'iset_intake',
      port: 3306,
    }),
    live: Object.freeze({
      database: 'iset_intake',
      host: 'DESKTOP-PDFA51K',
      port: 3306,
      currentUser: 'root@172.26.%',
      version: '8.0.40',
    }),
  }),
  test: Object.freeze({
    configured: Object.freeze({
      host: 'nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com',
      user: 'app_admin',
      database: 'iset_intake',
      port: 3306,
    }),
    live: Object.freeze({
      database: 'iset_intake',
      host: 'ip-172-16-0-199',
      port: 3306,
      currentUser: 'app_admin@10.48.%',
      version: '8.0.42',
    }),
  }),
  prod: Object.freeze({
    configured: Object.freeze({
      host: 'nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com',
      user: 'app_admin',
      database: 'iset_intake',
      port: 3306,
    }),
    live: Object.freeze({
      database: 'iset_intake',
      host: 'ip-172-16-0-77',
      port: 3306,
      currentUser: 'app_admin@%',
      version: '8.0.42',
    }),
  }),
});

const CREATE_TABLE_DDL = 'CREATE TABLE message_send_operation (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, client_operation_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, request_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, sender_user_id INT NOT NULL, sender_staff_profile_id BIGINT UNSIGNED NULL, case_id BIGINT UNSIGNED NOT NULL, application_id BIGINT UNSIGNED NULL, message_id INT NULL, response_status SMALLINT UNSIGNED NULL, response_json JSON NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP NULL DEFAULT NULL, PRIMARY KEY (id), UNIQUE KEY uq_message_send_operation_scope (sender_user_id, case_id, client_operation_id), KEY idx_message_send_operation_message (message_id), CONSTRAINT fk_message_send_operation_message FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
const OPERATIONS = Object.freeze([
  Object.freeze({
    key: 'message_send_operation',
    kind: 'table',
    table: 'message_send_operation',
    ddl: CREATE_TABLE_DDL,
  }),
]);
const TABLES = Object.freeze(['messages', 'iset_migration', 'message_send_operation']);

const IDENTITY_SQL = 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()';
const TABLE_CONSTRAINTS_SQL = 'SELECT * FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY CONSTRAINT_NAME';
const KEY_COLUMN_USAGE_SQL = 'SELECT * FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION';
const REFERENTIAL_CONSTRAINTS_SQL = 'SELECT * FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY CONSTRAINT_NAME';
const LEDGER_READ_SQL = 'SELECT `iset_migration`.`id`, `iset_migration`.`filename`, `iset_migration`.`checksum`, `iset_migration`.`applied_at`, `iset_migration`.`duration_ms`, `iset_migration`.`success`, `iset_migration`.`error_snippet` FROM `iset_migration` WHERE `iset_migration`.`filename` = ? ORDER BY `iset_migration`.`applied_at`, `iset_migration`.`id`';
const LEDGER_WRITE_SQL = 'INSERT INTO `iset_migration` (`filename`, `checksum`, `applied_at`, `duration_ms`, `success`, `error_snippet`) VALUES (?, ?, ?, ?, 1, NULL) ON DUPLICATE KEY UPDATE `applied_at` = ?, `duration_ms` = ?, `success` = 1, `error_snippet` = NULL';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function nativeValue(row, key) {
  if (!row || typeof row !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  const found = Object.keys(row).find(candidate => candidate.toLowerCase() === key.toLowerCase());
  return found ? row[found] : undefined;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeType(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function jsonSafeClone(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') return item.toString();
    if (item instanceof Date) return item.toISOString();
    return item;
  }));
}

function assertExactObject(actual, expected, code) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (actual[key] !== expectedValue) {
      fail(code, `${code}:${key}:${String(actual[key])}:${String(expectedValue)}`);
    }
  }
}

function comparableConfiguredIdentity(value) {
  return {
    host: String(value?.host || '').trim(),
    user: String(value?.user || '').trim(),
    database: String(value?.database || '').trim(),
    port: Number(value?.port),
  };
}

function verifyMigrationArtifact(migrationPath) {
  const content = fs.readFileSync(migrationPath, 'utf8');
  const checksum = sha256(content);
  if (path.basename(migrationPath) !== MIGRATION_FILENAME) {
    fail('secure_message_idempotency_migration_filename_mismatch');
  }
  if (checksum !== MIGRATION_SHA256) {
    fail(
      'secure_message_idempotency_migration_checksum_mismatch',
      `secure_message_idempotency_migration_checksum_mismatch:${checksum}`
    );
  }
  const quoted = `'${CREATE_TABLE_DDL}'`;
  let executable = content.replace(/^\s*--.*$/gmu, '');
  const literalOccurrences = executable.split(quoted).length - 1;
  if (literalOccurrences !== 1) {
    fail('secure_message_idempotency_migration_literal_set_mismatch');
  }
  executable = executable.replace(quoted, "''");
  if (/\b(?:CREATE\s+TABLE|ALTER\s+TABLE|DROP|TRUNCATE|RENAME|INSERT|UPDATE|DELETE|REPLACE)\b/iu.test(executable)) {
    fail('secure_message_idempotency_migration_unexpected_mutation');
  }
  return Object.freeze({
    filename: MIGRATION_FILENAME,
    checksum,
    operationCount: 1,
    executionModel: 'file-pinned-literal-ddl',
  });
}

async function metadataQuery(connection, sql, params, metadataLog) {
  const [rows] = await connection.query(sql, params || []);
  metadataLog.push({ sqlHash: sha256(sql), rowCount: Array.isArray(rows) ? rows.length : 0 });
  return rows;
}

function mapColumns(rows) {
  return (rows || []).map((row, index) => ({
    ordinal: index + 1,
    name: normalizeName(nativeValue(row, 'Field')),
    type: normalizeType(nativeValue(row, 'Type')),
    collation: nativeValue(row, 'Collation') ?? null,
    nullable: String(nativeValue(row, 'Null') || '').toUpperCase() === 'YES',
    key: String(nativeValue(row, 'Key') || '').toUpperCase(),
    defaultValue: nativeValue(row, 'Default') ?? null,
    extra: normalizeType(nativeValue(row, 'Extra')),
  }));
}

function mapIndexes(rows) {
  const indexes = new Map();
  for (const row of rows || []) {
    const name = normalizeName(nativeValue(row, 'Key_name'));
    if (!indexes.has(name)) indexes.set(name, []);
    indexes.get(name).push({
      sequence: Number(nativeValue(row, 'Seq_in_index')),
      column: normalizeName(nativeValue(row, 'Column_name')),
      nonUnique: Number(nativeValue(row, 'Non_unique')),
      subPart: nativeValue(row, 'Sub_part') ?? null,
      indexType: String(nativeValue(row, 'Index_type') || '').toUpperCase(),
      visible: nativeValue(row, 'Visible') == null
        ? null
        : String(nativeValue(row, 'Visible')).toUpperCase(),
      expression: nativeValue(row, 'Expression') ?? null,
    });
  }
  return Object.fromEntries(Array.from(indexes.entries()).map(([name, entries]) => [
    name,
    entries.sort((left, right) => left.sequence - right.sequence),
  ]));
}

function mapConstraints(constraintRows, keyRows, referentialRows) {
  const constraints = {};
  for (const row of constraintRows || []) {
    const name = normalizeName(nativeValue(row, 'CONSTRAINT_NAME'));
    constraints[name] = {
      type: String(nativeValue(row, 'CONSTRAINT_TYPE') || '').toUpperCase(),
      columns: [],
      referencedTable: null,
      referencedColumns: [],
      matchOption: null,
      updateRule: null,
      deleteRule: null,
    };
  }
  for (const row of keyRows || []) {
    const name = normalizeName(nativeValue(row, 'CONSTRAINT_NAME'));
    if (!constraints[name]) continue;
    const ordinal = Number(nativeValue(row, 'ORDINAL_POSITION'));
    constraints[name].columns.push({
      ordinal,
      value: normalizeName(nativeValue(row, 'COLUMN_NAME')),
    });
    const referencedTable = normalizeName(nativeValue(row, 'REFERENCED_TABLE_NAME'));
    const referencedColumn = normalizeName(nativeValue(row, 'REFERENCED_COLUMN_NAME'));
    if (referencedTable) constraints[name].referencedTable = referencedTable;
    if (referencedColumn) {
      constraints[name].referencedColumns.push({ ordinal, value: referencedColumn });
    }
  }
  for (const row of referentialRows || []) {
    const name = normalizeName(nativeValue(row, 'CONSTRAINT_NAME'));
    if (!constraints[name]) continue;
    constraints[name].matchOption = String(nativeValue(row, 'MATCH_OPTION') || '').toUpperCase();
    constraints[name].updateRule = String(nativeValue(row, 'UPDATE_RULE') || '').toUpperCase();
    constraints[name].deleteRule = String(nativeValue(row, 'DELETE_RULE') || '').toUpperCase();
  }
  for (const constraint of Object.values(constraints)) {
    constraint.columns = constraint.columns
      .sort((left, right) => left.ordinal - right.ordinal)
      .map(entry => entry.value);
    constraint.referencedColumns = constraint.referencedColumns
      .sort((left, right) => left.ordinal - right.ordinal)
      .map(entry => entry.value);
  }
  return constraints;
}

async function discoverTable(connection, database, table, metadataLog) {
  const rows = await metadataQuery(
    connection,
    `SHOW FULL TABLES FROM \`${database}\` LIKE ?`,
    [table],
    metadataLog
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (rows.length !== 1) fail('secure_message_idempotency_table_discovery_ambiguous', table);
  const values = Object.values(rows[0]);
  if (normalizeName(values[0]) !== table || String(values[1] || '').toUpperCase() !== 'BASE TABLE') {
    fail('secure_message_idempotency_table_discovery_mismatch', table);
  }
  return rows[0];
}

async function captureTableProof(connection, database, table, metadataLog, { optional = false } = {}) {
  const discovered = await discoverTable(connection, database, table, metadataLog);
  if (!discovered) {
    if (optional) return null;
    fail('secure_message_idempotency_required_table_missing', table);
  }
  const [createRows, columnRows, indexRows, constraintRows, keyRows, referentialRows] = await Promise.all([
    metadataQuery(connection, `SHOW CREATE TABLE \`${table}\``, [], metadataLog),
    metadataQuery(connection, `SHOW FULL COLUMNS FROM \`${table}\``, [], metadataLog),
    metadataQuery(connection, `SHOW INDEX FROM \`${table}\``, [], metadataLog),
    metadataQuery(connection, TABLE_CONSTRAINTS_SQL, [table], metadataLog),
    metadataQuery(connection, KEY_COLUMN_USAGE_SQL, [table], metadataLog),
    metadataQuery(connection, REFERENTIAL_CONSTRAINTS_SQL, [table], metadataLog),
  ]);
  const ddl = String(nativeValue(createRows?.[0], 'Create Table') || '');
  if (!ddl || !Array.isArray(columnRows) || !columnRows.length) {
    fail('secure_message_idempotency_incomplete_table_proof', table);
  }
  const engineMatch = /\bENGINE=([A-Za-z0-9_]+)/iu.exec(ddl);
  const collationMatch = /\bCOLLATE=([A-Za-z0-9_]+)/iu.exec(ddl);
  return {
    table,
    ddl,
    ddlHash: sha256(ddl),
    engine: engineMatch ? engineMatch[1].toLowerCase() : null,
    tableCollation: collationMatch ? collationMatch[1].toLowerCase() : null,
    columns: mapColumns(columnRows),
    indexes: mapIndexes(indexRows),
    constraints: mapConstraints(constraintRows, keyRows, referentialRows),
    metadata: jsonSafeClone({ columnRows, indexRows, constraintRows, keyRows, referentialRows }),
  };
}

async function captureSchemaProof(connection, contract, metadataLog) {
  const identityRows = await metadataQuery(connection, IDENTITY_SQL, [], metadataLog);
  const row = identityRows?.[0];
  const identity = {
    database: nativeValue(row, 'DATABASE()') ?? null,
    host: nativeValue(row, '@@hostname') ?? null,
    port: Number(nativeValue(row, '@@port')) || null,
    currentUser: nativeValue(row, 'CURRENT_USER()') ?? null,
    version: nativeValue(row, 'VERSION()') ?? null,
  };
  assertExactObject(identity, contract.live, 'secure_message_idempotency_live_database_identity_mismatch');
  return {
    identity,
    tables: {
      messages: await captureTableProof(connection, identity.database, 'messages', metadataLog),
      iset_migration: await captureTableProof(connection, identity.database, 'iset_migration', metadataLog),
      message_send_operation: await captureTableProof(
        connection,
        identity.database,
        'message_send_operation',
        metadataLog,
        { optional: true }
      ),
    },
  };
}

function findColumn(table, name) {
  return table?.columns?.find(column => column.name === name) || null;
}

function assertExactIndex(index, key, columns, unique) {
  if (!Array.isArray(index) || index.length !== columns.length) {
    fail('secure_message_idempotency_index_shape_mismatch', key);
  }
  index.forEach((entry, position) => {
    if (
      entry.sequence !== position + 1 || entry.column !== columns[position] ||
      entry.nonUnique !== (unique ? 0 : 1) || entry.subPart !== null ||
      entry.indexType !== 'BTREE' || (entry.visible !== null && entry.visible !== 'YES') ||
      entry.expression !== null
    ) fail('secure_message_idempotency_index_shape_mismatch', key);
  });
}

function assertMessagesAndLedgerShape(proof) {
  const messages = proof.tables.messages;
  const ledger = proof.tables.iset_migration;
  if (messages.engine !== 'innodb' || ledger.engine !== 'innodb') {
    fail('secure_message_idempotency_base_engine_mismatch');
  }
  for (const [name, type, nullable, extra] of [
    ['id', 'int', false, 'auto_increment'],
    ['sender_user_id', 'int', true, ''],
    ['sender_staff_profile_id', 'bigint unsigned', true, ''],
    ['case_id', 'bigint unsigned', false, ''],
    ['application_id', 'bigint unsigned', true, ''],
  ]) {
    const column = findColumn(messages, name);
    if (!column || column.type !== type || column.nullable !== nullable || column.extra !== extra) {
      fail('secure_message_idempotency_messages_shape_mismatch', name);
    }
  }
  assertExactIndex(messages.indexes.primary, 'messages.PRIMARY', ['id'], true);
  const expectedLedgerColumns = [
    ['id', 'int', false, null, null, 'auto_increment'],
    ['filename', 'varchar(255)', false, 'utf8mb4_0900_ai_ci', null, ''],
    ['checksum', 'char(64)', false, 'utf8mb4_0900_ai_ci', null, ''],
    ['applied_at', 'datetime', false, null, 'current_timestamp', 'default_generated'],
    ['duration_ms', 'int', false, null, null, ''],
    ['success', 'tinyint(1)', false, null, '1', ''],
    ['error_snippet', 'text', true, 'utf8mb4_0900_ai_ci', null, ''],
  ];
  if (
    ledger.tableCollation !== 'utf8mb4_0900_ai_ci' ||
    ledger.columns.length !== expectedLedgerColumns.length
  ) {
    fail('secure_message_idempotency_ledger_shape_mismatch', 'table');
  }
  expectedLedgerColumns.forEach(
    ([name, type, nullable, collation, defaultValue, extra], index) => {
      const column = ledger.columns[index];
      if (
        !column || column.ordinal !== index + 1 || column.name !== name ||
        column.type !== type || column.nullable !== nullable ||
        column.collation !== collation || normalizeDefault(column.defaultValue) !== defaultValue ||
        column.extra !== extra
      ) {
      fail('secure_message_idempotency_ledger_shape_mismatch', name);
      }
    }
  );
  assertExactIndex(ledger.indexes.primary, 'iset_migration.PRIMARY', ['id'], true);
  assertExactIndex(
    ledger.indexes.uniq_filename_checksum,
    'iset_migration.uniq_filename_checksum',
    ['filename', 'checksum'],
    true
  );
}

function normalizeDefault(value) {
  if (value === null || typeof value === 'undefined') return null;
  return String(value).trim().toLowerCase().replace(/\(\)$/u, '');
}

function assertTargetTableShape(proof) {
  const table = proof.tables.message_send_operation;
  if (!table) return 'absent';
  if (table.engine !== 'innodb' || table.tableCollation !== 'utf8mb4_unicode_ci') {
    fail('secure_message_idempotency_target_engine_or_collation_mismatch');
  }
  const expectedColumns = [
    ['id', 'bigint unsigned', false, null, null, 'auto_increment'],
    ['client_operation_id', 'varchar(128)', false, 'ascii_bin', null, ''],
    ['request_sha256', 'char(64)', false, 'ascii_bin', null, ''],
    ['sender_user_id', 'int', false, null, null, ''],
    ['sender_staff_profile_id', 'bigint unsigned', true, null, null, ''],
    ['case_id', 'bigint unsigned', false, null, null, ''],
    ['application_id', 'bigint unsigned', true, null, null, ''],
    ['message_id', 'int', true, null, null, ''],
    ['response_status', 'smallint unsigned', true, null, null, ''],
    ['response_json', 'json', true, null, null, ''],
    ['created_at', 'timestamp', true, null, 'current_timestamp', ''],
    ['completed_at', 'timestamp', true, null, null, ''],
  ];
  if (table.columns.length !== expectedColumns.length) {
    fail('secure_message_idempotency_target_column_count_mismatch');
  }
  expectedColumns.forEach(([name, type, nullable, collation, defaultValue, extra], index) => {
    const column = table.columns[index];
    const extraMatches = column?.extra === extra || (
      name === 'created_at' && ['', 'default_generated'].includes(column?.extra)
    );
    if (
      column.name !== name || column.ordinal !== index + 1 || column.type !== type ||
      column.nullable !== nullable || column.collation !== collation ||
      normalizeDefault(column.defaultValue) !== defaultValue || !extraMatches
    ) fail('secure_message_idempotency_target_column_shape_mismatch', name);
  });
  const indexNames = Object.keys(table.indexes).sort();
  const expectedIndexNames = [
    'idx_message_send_operation_message',
    'primary',
    'uq_message_send_operation_scope',
  ].sort();
  if (JSON.stringify(indexNames) !== JSON.stringify(expectedIndexNames)) {
    fail('secure_message_idempotency_target_index_set_mismatch');
  }
  assertExactIndex(table.indexes.primary, 'message_send_operation.PRIMARY', ['id'], true);
  assertExactIndex(
    table.indexes.uq_message_send_operation_scope,
    'message_send_operation.uq_message_send_operation_scope',
    ['sender_user_id', 'case_id', 'client_operation_id'],
    true
  );
  assertExactIndex(
    table.indexes.idx_message_send_operation_message,
    'message_send_operation.idx_message_send_operation_message',
    ['message_id'],
    false
  );
  const constraintNames = Object.keys(table.constraints).sort();
  const expectedConstraintNames = [
    'primary',
    'uq_message_send_operation_scope',
    'fk_message_send_operation_message',
  ].sort();
  if (JSON.stringify(constraintNames) !== JSON.stringify(expectedConstraintNames)) {
    fail('secure_message_idempotency_target_constraint_set_mismatch');
  }
  const foreignKey = table.constraints.fk_message_send_operation_message;
  if (
    foreignKey?.type !== 'FOREIGN KEY' ||
    JSON.stringify(foreignKey.columns) !== JSON.stringify(['message_id']) ||
    foreignKey.referencedTable !== 'messages' ||
    JSON.stringify(foreignKey.referencedColumns) !== JSON.stringify(['id']) ||
    foreignKey.matchOption !== 'NONE' ||
    !['NO ACTION', 'RESTRICT'].includes(foreignKey.updateRule) ||
    foreignKey.deleteRule !== 'CASCADE'
  ) fail('secure_message_idempotency_target_foreign_key_mismatch');
  const messageId = findColumn(proof.tables.messages, 'id');
  const operationMessageId = findColumn(table, 'message_id');
  if (!messageId || !operationMessageId || messageId.type !== operationMessageId.type) {
    fail('secure_message_idempotency_reference_type_mismatch');
  }
  return 'target';
}

function assertAllOperationShapes(proof) {
  assertMessagesAndLedgerShape(proof);
  return { message_send_operation: assertTargetTableShape(proof) };
}

function compactProof(proof) {
  return {
    identity: { ...proof.identity },
    tables: Object.fromEntries(TABLES.map(table => {
      const tableProof = proof.tables[table];
      return [table, tableProof ? {
        ddl: tableProof.ddl,
        ddlHash: tableProof.ddlHash,
        engine: tableProof.engine,
        tableCollation: tableProof.tableCollation,
        columns: jsonSafeClone(tableProof.columns),
        indexes: jsonSafeClone(tableProof.indexes),
        constraints: jsonSafeClone(tableProof.constraints),
        metadata: jsonSafeClone(tableProof.metadata),
      } : null];
    })),
  };
}

async function executeSecureMessageIdempotencyMigration({
  targetEnv,
  configuredIdentity,
  executionContext,
  instanceIdentityProvider,
  testExecutionContext,
  testInstanceIdentityProvider,
  connectionFactory,
  migrationPath,
  clock = () => new Date(),
}) {
  const startedAt = clock();
  const evidence = {
    schemaVersion: 1,
    executor: '20260825-secure-message-idempotency-bounded',
    targetEnv: String(targetEnv || '').toLowerCase(),
    decision: 'FAILED',
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    transactionalDdlRollbackClaimed: false,
    phase: 'environment',
    awsIdentity: null,
    executionContext: null,
    configuredDatabase: null,
    migration: null,
    executionModel: 'The canonical file is checksum/semantic proof; this bounded executor applies its one exact CREATE TABLE literal and only then records the canonical checksum.',
    metadataStatementCount: 0,
    preflight: null,
    operations: [],
    finalProof: null,
    ledgerPrecheck: null,
    ledger: null,
    connectionCloseError: null,
    operationalWarnings: [],
    failure: null,
  };
  const metadataLog = [];
  let connection = null;
  try {
    const contract = ENVIRONMENT_CONTRACTS[evidence.targetEnv];
    if (!contract) fail('secure_message_idempotency_environment_invalid');
    if (typeof connectionFactory !== 'function') {
      fail('secure_message_idempotency_connection_factory_required');
    }
    const configured = comparableConfiguredIdentity(configuredIdentity);
    assertExactObject(
      configured,
      contract.configured,
      'secure_message_idempotency_configured_database_identity_mismatch'
    );
    evidence.configuredDatabase = configured;

    if (evidence.targetEnv === 'test' || evidence.targetEnv === 'prod') {
      evidence.phase = `${evidence.targetEnv}-instance-identity`;
      const remoteContext = executionContext || testExecutionContext;
      const identityProvider = instanceIdentityProvider || testInstanceIdentityProvider;
      const expectedAccountId = String(remoteContext?.expectedAwsAccountId || '').trim();
      const expectedInstanceId = String(remoteContext?.expectedSsmInstanceId || '').trim();
      const runToken = String(remoteContext?.runToken || '').trim();
      if (expectedAccountId !== EXPECTED_AWS_ACCOUNT_IDS[evidence.targetEnv]) {
        fail('secure_message_idempotency_outer_account_context_mismatch');
      }
      if (!/^i-[a-f0-9]{8,17}$/u.test(expectedInstanceId)) {
        fail('secure_message_idempotency_outer_instance_context_invalid');
      }
      if (!runToken) fail('secure_message_idempotency_outer_run_token_required');
      if (typeof identityProvider !== 'function') {
        fail('secure_message_idempotency_instance_identity_provider_required');
      }
      const awsIdentity = await identityProvider();
      const actualAccountId = String(awsIdentity?.Account || awsIdentity?.accountId || '').trim();
      const actualInstanceId = String(awsIdentity?.InstanceId || awsIdentity?.instanceId || '').trim();
      const actualRegion = String(awsIdentity?.Region || awsIdentity?.region || '').trim();
      if (actualAccountId !== expectedAccountId) fail('secure_message_idempotency_aws_account_mismatch');
      if (actualInstanceId !== expectedInstanceId) fail('secure_message_idempotency_ssm_instance_mismatch');
      if (actualRegion !== 'ca-central-1') fail('secure_message_idempotency_instance_region_mismatch');
      evidence.executionContext = {
        expectedAwsAccountId: expectedAccountId,
        expectedSsmInstanceId: expectedInstanceId,
        runToken,
      };
      evidence.awsIdentity = {
        applicable: true,
        source: 'ec2-instance-identity-document',
        Account: actualAccountId,
        InstanceId: actualInstanceId,
        Region: actualRegion,
      };
    } else {
      evidence.awsIdentity = {
        applicable: false,
        reason: 'Local DEV database execution has no AWS dependency.',
      };
    }

    evidence.phase = 'migration-artifact';
    evidence.migration = verifyMigrationArtifact(migrationPath);
    evidence.phase = 'connect';
    connection = await connectionFactory();
    if (!connection || typeof connection.query !== 'function' || typeof connection.execute !== 'function') {
      fail('secure_message_idempotency_connection_invalid');
    }

    evidence.phase = 'schema-preflight';
    let proof = await captureSchemaProof(connection, contract, metadataLog);
    // Preserve the exact live metadata even when a shape assertion rejects the
    // candidate. A failed preflight authorizes metadata correction only; the
    // evidence must show the mismatch without requiring a guessed follow-up.
    evidence.preflight = { ...compactProof(proof), operationStates: null };
    const initialStates = assertAllOperationShapes(proof);
    evidence.preflight.operationStates = initialStates;

    evidence.phase = 'ledger-precheck';
    assertMessagesAndLedgerShape(proof);
    const [initialLedgerRows] = await connection.execute(LEDGER_READ_SQL, [MIGRATION_FILENAME]);
    const successfulLedgerRows = (initialLedgerRows || []).filter(
      row => Number(nativeValue(row, 'success')) === 1
    );
    if (successfulLedgerRows.some(row => String(nativeValue(row, 'checksum')) !== MIGRATION_SHA256)) {
      fail('secure_message_idempotency_ledger_checksum_drift');
    }
    if (
      successfulLedgerRows.some(row => String(nativeValue(row, 'checksum')) === MIGRATION_SHA256) &&
      initialStates.message_send_operation !== 'target'
    ) fail('secure_message_idempotency_ledger_schema_contradiction');
    evidence.ledgerPrecheck = {
      rowCount: (initialLedgerRows || []).length,
      successfulChecksums: successfulLedgerRows.map(row => String(nativeValue(row, 'checksum'))),
    };

    evidence.phase = 'operation-preflight-refresh';
    proof = await captureSchemaProof(connection, contract, metadataLog);
    let operationState = assertAllOperationShapes(proof).message_send_operation;
    const operationEvidence = {
      key: 'message_send_operation',
      stateBefore: operationState,
      attempted: false,
      executed: false,
      ddlSha256: sha256(CREATE_TABLE_DDL),
      durationMs: 0,
      postProof: null,
    };
    evidence.operations.push(operationEvidence);
    if (operationState === 'absent') {
      const messageId = findColumn(proof.tables.messages, 'id');
      if (!messageId || messageId.type !== 'int' || messageId.nullable || messageId.extra !== 'auto_increment') {
        fail('secure_message_idempotency_ddl_reference_unproved');
      }
      evidence.phase = 'operation:message_send_operation:execute';
      const ddlStarted = Date.now();
      operationEvidence.attempted = true;
      await connection.query(CREATE_TABLE_DDL);
      operationEvidence.durationMs = Date.now() - ddlStarted;
      operationEvidence.executed = true;
      evidence.phase = 'operation:message_send_operation:post-proof';
      proof = await captureSchemaProof(connection, contract, metadataLog);
      operationState = assertAllOperationShapes(proof).message_send_operation;
      if (operationState !== 'target') fail('secure_message_idempotency_post_proof_failed');
      operationEvidence.postProof = compactProof(proof);
    }

    evidence.phase = 'final-proof';
    proof = await captureSchemaProof(connection, contract, metadataLog);
    const finalStates = assertAllOperationShapes(proof);
    if (finalStates.message_send_operation !== 'target') {
      fail('secure_message_idempotency_target_incomplete');
    }
    evidence.finalProof = { ...compactProof(proof), operationStates: finalStates };

    evidence.phase = 'ledger-read';
    assertMessagesAndLedgerShape(proof);
    const [finalLedgerRows] = await connection.execute(LEDGER_READ_SQL, [MIGRATION_FILENAME]);
    const finalSuccessfulRows = (finalLedgerRows || []).filter(
      row => Number(nativeValue(row, 'success')) === 1
    );
    if (finalSuccessfulRows.some(row => String(nativeValue(row, 'checksum')) !== MIGRATION_SHA256)) {
      fail('secure_message_idempotency_ledger_checksum_drift');
    }
    const finalExactRows = finalSuccessfulRows.filter(
      row => String(nativeValue(row, 'checksum')) === MIGRATION_SHA256
    );
    let totalDdlDurationMs = operationEvidence.durationMs;
    if (finalExactRows.length) {
      if (finalExactRows.length !== 1) fail('secure_message_idempotency_ledger_changed_during_execution');
      const row = finalExactRows[0];
      evidence.ledger = {
        priorRowCount: (finalLedgerRows || []).length,
        filename: MIGRATION_FILENAME,
        checksum: MIGRATION_SHA256,
        success: true,
        status: 'already-recorded',
        writePerformed: false,
        appliedAt: nativeValue(row, 'applied_at') ?? null,
        durationMs: Number(nativeValue(row, 'duration_ms')) || 0,
      };
    } else {
      evidence.phase = 'ledger-write';
      assertMessagesAndLedgerShape(proof);
      const appliedAt = clock();
      await connection.execute(LEDGER_WRITE_SQL, [
        MIGRATION_FILENAME,
        MIGRATION_SHA256,
        appliedAt,
        totalDdlDurationMs,
        appliedAt,
        totalDdlDurationMs,
      ]);
      evidence.phase = 'ledger-verify';
      assertMessagesAndLedgerShape(proof);
      const [verifiedRows] = await connection.execute(LEDGER_READ_SQL, [MIGRATION_FILENAME]);
      const exact = (verifiedRows || []).filter(row => (
        String(nativeValue(row, 'checksum')) === MIGRATION_SHA256 &&
        Number(nativeValue(row, 'success')) === 1
      ));
      const wrongSuccessful = (verifiedRows || []).some(row => (
        Number(nativeValue(row, 'success')) === 1 &&
        String(nativeValue(row, 'checksum')) !== MIGRATION_SHA256
      ));
      if (exact.length !== 1 || wrongSuccessful) {
        fail('secure_message_idempotency_ledger_verification_failed');
      }
      evidence.ledger = {
        priorRowCount: (finalLedgerRows || []).length,
        filename: MIGRATION_FILENAME,
        checksum: MIGRATION_SHA256,
        success: true,
        status: 'recorded',
        writePerformed: true,
        appliedAt: appliedAt.toISOString(),
        durationMs: totalDdlDurationMs,
      };
    }
    evidence.phase = 'complete';
    evidence.decision = 'COMPLETE';
    return evidence;
  } catch (error) {
    evidence.failure = {
      code: error?.code || 'secure_message_idempotency_migration_failed',
      message: String(error?.message || error),
      phase: evidence.phase,
      ddlMayHaveAutoCommitted: evidence.operations.some(operation => operation.attempted),
    };
    error.evidence = evidence;
    throw error;
  } finally {
    evidence.metadataStatementCount = metadataLog.length;
    evidence.finishedAt = clock().toISOString();
    if (connection && typeof connection.end === 'function') {
      try {
        await connection.end();
      } catch (error) {
        evidence.connectionCloseError = {
          code: error?.code || 'secure_message_idempotency_connection_close_failed',
          message: String(error?.message || error),
        };
        evidence.operationalWarnings.push({
          code: 'secure_message_idempotency_connection_close_failed',
          message: 'The guarded work result is preserved, but closing the database session reported an error.',
        });
      }
    }
  }
}

module.exports = {
  CREATE_TABLE_DDL,
  ENVIRONMENT_CONTRACTS,
  EXPECTED_AWS_ACCOUNT_ID,
  EXPECTED_AWS_ACCOUNT_IDS,
  IDENTITY_SQL,
  KEY_COLUMN_USAGE_SQL,
  LEDGER_READ_SQL,
  LEDGER_WRITE_SQL,
  MIGRATION_FILENAME,
  MIGRATION_SHA256,
  OPERATIONS,
  REFERENTIAL_CONSTRAINTS_SQL,
  TABLES,
  TABLE_CONSTRAINTS_SQL,
  assertAllOperationShapes,
  captureSchemaProof,
  executeSecureMessageIdempotencyMigration,
  verifyMigrationArtifact,
};
