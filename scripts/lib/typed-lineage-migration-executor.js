'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MIGRATION_FILENAME = '20260825_0001_add_typed_cfa_funding_lineage.sql';
const MIGRATION_SHA256 = '6e0a7ee7d6afabce5ea77892169dd7ad3694accfcfec8f74ac9091bfddede0fa';
const EXPECTED_AWS_ACCOUNT_IDS = Object.freeze({
  test: '124355655255',
  prod: '468278742295',
});
// Retained as the TEST alias for existing callers of the bounded executor.
const EXPECTED_AWS_ACCOUNT_ID = EXPECTED_AWS_ACCOUNT_IDS.test;
const TABLES = Object.freeze([
  'cfa_series',
  'cfa_version',
  'funding_overview_series',
  'funding_overview_version',
  'iset_application',
  'iset_case_action_plan',
  'iset_migration',
]);

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

const OPERATIONS = Object.freeze([
  Object.freeze({
    key: 'cfa_version.application_id',
    kind: 'column',
    table: 'cfa_version',
    column: 'application_id',
    after: 'series_id',
    ddl: 'ALTER TABLE cfa_version ADD COLUMN application_id BIGINT UNSIGNED NULL AFTER series_id',
  }),
  Object.freeze({
    key: 'cfa_version.action_plan_id',
    kind: 'column',
    table: 'cfa_version',
    column: 'action_plan_id',
    after: 'application_id',
    ddl: 'ALTER TABLE cfa_version ADD COLUMN action_plan_id BIGINT UNSIGNED NULL AFTER application_id',
  }),
  Object.freeze({
    key: 'funding_overview_version.application_id',
    kind: 'column',
    table: 'funding_overview_version',
    column: 'application_id',
    after: 'series_id',
    ddl: 'ALTER TABLE funding_overview_version ADD COLUMN application_id BIGINT UNSIGNED NULL AFTER series_id',
  }),
  Object.freeze({
    key: 'idx_cfa_version_application',
    kind: 'index',
    table: 'cfa_version',
    index: 'idx_cfa_version_application',
    column: 'application_id',
    ddl: 'CREATE INDEX idx_cfa_version_application ON cfa_version (application_id)',
  }),
  Object.freeze({
    key: 'idx_cfa_version_action_plan',
    kind: 'index',
    table: 'cfa_version',
    index: 'idx_cfa_version_action_plan',
    column: 'action_plan_id',
    ddl: 'CREATE INDEX idx_cfa_version_action_plan ON cfa_version (action_plan_id)',
  }),
  Object.freeze({
    key: 'idx_funding_overview_version_application',
    kind: 'index',
    table: 'funding_overview_version',
    index: 'idx_funding_overview_version_application',
    column: 'application_id',
    ddl: 'CREATE INDEX idx_funding_overview_version_application ON funding_overview_version (application_id)',
  }),
  Object.freeze({
    key: 'fk_cfa_version_application',
    kind: 'foreignKey',
    table: 'cfa_version',
    constraint: 'fk_cfa_version_application',
    column: 'application_id',
    referencedTable: 'iset_application',
    referencedColumn: 'id',
    ddl: 'ALTER TABLE cfa_version ADD CONSTRAINT fk_cfa_version_application FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT',
  }),
  Object.freeze({
    key: 'fk_cfa_version_action_plan',
    kind: 'foreignKey',
    table: 'cfa_version',
    constraint: 'fk_cfa_version_action_plan',
    column: 'action_plan_id',
    referencedTable: 'iset_case_action_plan',
    referencedColumn: 'id',
    ddl: 'ALTER TABLE cfa_version ADD CONSTRAINT fk_cfa_version_action_plan FOREIGN KEY (action_plan_id) REFERENCES iset_case_action_plan (id) ON DELETE RESTRICT',
  }),
  Object.freeze({
    key: 'fk_funding_overview_version_application',
    kind: 'foreignKey',
    table: 'funding_overview_version',
    constraint: 'fk_funding_overview_version_application',
    column: 'application_id',
    referencedTable: 'iset_application',
    referencedColumn: 'id',
    ddl: 'ALTER TABLE funding_overview_version ADD CONSTRAINT fk_funding_overview_version_application FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT',
  }),
]);

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
  const match = Object.keys(row).find(candidate => candidate.toLowerCase() === key.toLowerCase());
  return match ? row[match] : undefined;
}

function normalizeType(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function comparableConfiguredIdentity(value) {
  return {
    host: String(value?.host || '').trim(),
    user: String(value?.user || '').trim(),
    database: String(value?.database || '').trim(),
    port: Number(value?.port),
  };
}

function assertExactObject(actual, expected, code) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) fail(code, `${code}:${key}:${String(actual[key])}:${String(value)}`);
  }
}

function verifyMigrationArtifact(migrationPath) {
  const content = fs.readFileSync(migrationPath, 'utf8');
  const checksum = sha256(content);
  if (path.basename(migrationPath) !== MIGRATION_FILENAME) {
    fail('typed_lineage_migration_filename_mismatch');
  }
  if (checksum !== MIGRATION_SHA256) {
    fail('typed_lineage_migration_checksum_mismatch', `typed_lineage_migration_checksum_mismatch:${checksum}`);
  }
  let executable = content.replace(/^\s*--.*$/gmu, '');
  for (const operation of OPERATIONS) {
    const quoted = `'${operation.ddl}'`;
    const occurrences = executable.split(quoted).length - 1;
    if (occurrences !== 1) {
      fail('typed_lineage_migration_literal_set_mismatch', `${operation.key}:${occurrences}`);
    }
    executable = executable.replace(quoted, "''");
  }
  if (/\b(?:ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|DROP|TRUNCATE|RENAME|INSERT|UPDATE|DELETE|REPLACE)\b/iu.test(executable)) {
    fail('typed_lineage_migration_unexpected_mutation');
  }
  if (/(?:ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX)\s+(?:`?cfa_series`?|`?funding_overview_series`?)/iu.test(content)) {
    fail('typed_lineage_migration_series_change_forbidden');
  }
  return Object.freeze({
    filename: MIGRATION_FILENAME,
    checksum,
    operationCount: OPERATIONS.length,
    executionModel: 'file-pinned-literal-ddl',
  });
}

function hashRows(rows) {
  return sha256(JSON.stringify(rows || []));
}

function jsonSafeClone(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') return item.toString();
    if (item instanceof Date) return item.toISOString();
    return item;
  }));
}

function canonicalizeStructure(value) {
  if (Array.isArray(value)) return value.map(canonicalizeStructure);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalizeStructure(value[key])])
  );
}

async function metadataQuery(connection, sql, params, log) {
  const [rows] = await connection.query(sql, params || []);
  log.push({ sqlHash: sha256(sql), rowCount: Array.isArray(rows) ? rows.length : 0 });
  return rows;
}

function mapColumns(rows) {
  return (rows || []).map((row, ordinal) => ({
    ordinal: ordinal + 1,
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
  const groups = new Map();
  for (const row of rows || []) {
    const name = normalizeName(nativeValue(row, 'Key_name'));
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({
      sequence: Number(nativeValue(row, 'Seq_in_index')),
      column: normalizeName(nativeValue(row, 'Column_name')),
      nonUnique: Number(nativeValue(row, 'Non_unique')),
      subPart: nativeValue(row, 'Sub_part') ?? null,
      indexType: String(nativeValue(row, 'Index_type') || '').toUpperCase(),
      visible: nativeValue(row, 'Visible') == null ? null : String(nativeValue(row, 'Visible')).toUpperCase(),
      expression: nativeValue(row, 'Expression') ?? null,
    });
  }
  return Object.fromEntries(Array.from(groups.entries()).map(([name, entries]) => [
    name,
    entries.sort((left, right) => left.sequence - right.sequence),
  ]));
}

function mapConstraints(constraintRows, keyRows, referentialRows) {
  const result = {};
  const columnEntries = new Map();
  for (const row of constraintRows || []) {
    const name = normalizeName(nativeValue(row, 'CONSTRAINT_NAME'));
    result[name] = {
      type: String(nativeValue(row, 'CONSTRAINT_TYPE') || '').toUpperCase(),
      columns: [],
      referencedTable: null,
      referencedColumns: [],
      matchOption: null,
      updateRule: null,
      deleteRule: null,
    };
    columnEntries.set(name, []);
  }
  for (const row of keyRows || []) {
    const name = normalizeName(nativeValue(row, 'CONSTRAINT_NAME'));
    if (!result[name]) continue;
    const column = normalizeName(nativeValue(row, 'COLUMN_NAME'));
    const referencedTable = normalizeName(nativeValue(row, 'REFERENCED_TABLE_NAME'));
    const referencedColumn = normalizeName(nativeValue(row, 'REFERENCED_COLUMN_NAME'));
    columnEntries.get(name).push({
      ordinal: Number(nativeValue(row, 'ORDINAL_POSITION')),
      column,
      referencedColumn,
    });
    if (referencedTable) result[name].referencedTable = referencedTable;
  }
  for (const row of referentialRows || []) {
    const name = normalizeName(nativeValue(row, 'CONSTRAINT_NAME'));
    if (!result[name]) continue;
    result[name].matchOption = String(nativeValue(row, 'MATCH_OPTION') || '').toUpperCase();
    result[name].updateRule = String(nativeValue(row, 'UPDATE_RULE') || '').toUpperCase();
    result[name].deleteRule = String(nativeValue(row, 'DELETE_RULE') || '').toUpperCase();
  }
  for (const [name, constraint] of Object.entries(result)) {
    const entries = columnEntries.get(name).sort((left, right) => (
      left.ordinal - right.ordinal ||
      left.column.localeCompare(right.column) ||
      left.referencedColumn.localeCompare(right.referencedColumn)
    ));
    constraint.columns = entries.map(entry => entry.column);
    constraint.referencedColumns = entries
      .filter(entry => entry.referencedColumn)
      .map(entry => entry.referencedColumn);
  }
  return result;
}

async function captureTableProof(connection, database, table, log) {
  const discovered = await metadataQuery(
    connection,
    `SHOW FULL TABLES FROM \`${database}\` LIKE ?`,
    [table],
    log
  );
  if (!Array.isArray(discovered) || discovered.length !== 1) fail('typed_lineage_required_table_missing', table);
  const discoveryValues = Object.values(discovered[0]);
  if (normalizeName(discoveryValues[0]) !== table || String(discoveryValues[1] || '').toUpperCase() !== 'BASE TABLE') {
    fail('typed_lineage_table_discovery_mismatch', table);
  }
  const [createRows, columnRows, indexRows, constraintRows, keyRows, referentialRows] = await Promise.all([
    metadataQuery(connection, `SHOW CREATE TABLE \`${table}\``, [], log),
    metadataQuery(connection, `SHOW FULL COLUMNS FROM \`${table}\``, [], log),
    metadataQuery(connection, `SHOW INDEX FROM \`${table}\``, [], log),
    metadataQuery(connection, TABLE_CONSTRAINTS_SQL, [table], log),
    metadataQuery(connection, KEY_COLUMN_USAGE_SQL, [table], log),
    metadataQuery(connection, REFERENTIAL_CONSTRAINTS_SQL, [table], log),
  ]);
  const ddl = nativeValue(createRows?.[0], 'Create Table');
  if (!ddl || !Array.isArray(columnRows) || !columnRows.length) fail('typed_lineage_incomplete_table_proof', table);
  const engineMatch = /\bENGINE=([A-Za-z0-9_]+)/iu.exec(String(ddl));
  const proof = {
    table,
    ddl: String(ddl),
    engine: engineMatch ? engineMatch[1].toLowerCase() : null,
    ddlHash: sha256(String(ddl)),
    columnsHash: hashRows(columnRows),
    indexesHash: hashRows(indexRows),
    constraintsHash: hashRows({ constraintRows, keyRows, referentialRows }),
    columns: mapColumns(columnRows),
    indexes: mapIndexes(indexRows),
    constraints: mapConstraints(constraintRows, keyRows, referentialRows),
    metadata: jsonSafeClone({
      fullColumns: columnRows,
      indexes: indexRows,
      tableConstraints: constraintRows,
      keyColumnUsage: keyRows,
      referentialConstraints: referentialRows,
    }),
  };
  // This comparison deliberately excludes volatile SHOW CREATE table options such as
  // AUTO_INCREMENT=N and SHOW INDEX statistics such as Cardinality. Only normalized
  // topology can stop a partially applied migration as series drift.
  proof.structureHash = sha256(JSON.stringify(canonicalizeStructure({
    engine: proof.engine,
    columns: proof.columns,
    indexes: proof.indexes,
    constraints: proof.constraints,
  })));
  return proof;
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
  assertExactObject(identity, contract.live, 'typed_lineage_live_database_identity_mismatch');
  const tables = {};
  // Deliberately sequential: each table is discovered and proved in isolation.
  for (const table of TABLES) tables[table] = await captureTableProof(connection, contract.live.database, table, metadataLog);
  return { identity, tables };
}

function findColumn(tableProof, name) {
  return tableProof.columns.find(column => column.name === name) || null;
}

function assertNullableBigintUnsigned(column, key) {
  if (!column || column.type !== 'bigint unsigned' || !column.nullable || column.collation !== null || column.defaultValue !== null || column.extra !== '') {
    fail('typed_lineage_column_shape_mismatch', key);
  }
}

function classifyColumn(proof, operation) {
  const columns = proof.tables[operation.table].columns;
  const column = columns.find(item => item.name === operation.column);
  if (!column) return 'absent';
  assertNullableBigintUnsigned(column, operation.key);
  const previous = columns[column.ordinal - 2];
  if (!previous || previous.name !== operation.after) fail('typed_lineage_column_position_mismatch', operation.key);
  return 'target';
}

function assertExactIndexShape(index, key, columns, unique = false) {
  if (!index || index.length !== columns.length) fail('typed_lineage_index_shape_mismatch', key);
  index.forEach((item, position) => {
    if (
      item.sequence !== position + 1 || item.column !== columns[position] ||
      item.nonUnique !== (unique ? 0 : 1) || item.subPart !== null || item.indexType !== 'BTREE' ||
      (item.visible !== null && item.visible !== 'YES') || item.expression !== null
    ) fail('typed_lineage_index_shape_mismatch', key);
  });
}

function assertExactSingleColumnIndex(index, operation, unique = false) {
  assertExactIndexShape(index, operation.key, [operation.column], unique);
}

// MySQL reports an omitted ON UPDATE clause as NO ACTION, while older fixtures
// and some equivalent DDL spell the same immediate restrictive behavior as
// RESTRICT. Preserve the native metadata value in evidence, but accept both
// labels when proving that an FK cannot cascade an update.
function isRestrictiveForeignKeyRule(rule) {
  return rule === 'NO ACTION' || rule === 'RESTRICT';
}

function classifyIndex(proof, operation) {
  const index = proof.tables[operation.table].indexes[operation.index];
  if (!index) return 'absent';
  assertExactSingleColumnIndex(index, operation);
  return 'target';
}

function classifyForeignKey(proof, operation) {
  const constraint = proof.tables[operation.table].constraints[operation.constraint];
  if (!constraint) return 'absent';
  const exact = constraint.type === 'FOREIGN KEY' &&
    JSON.stringify(constraint.columns) === JSON.stringify([operation.column]) &&
    constraint.referencedTable === operation.referencedTable &&
    JSON.stringify(constraint.referencedColumns) === JSON.stringify([operation.referencedColumn]) &&
    constraint.matchOption === 'NONE' &&
    isRestrictiveForeignKeyRule(constraint.updateRule) &&
    isRestrictiveForeignKeyRule(constraint.deleteRule);
  if (!exact) fail('typed_lineage_foreign_key_shape_mismatch', operation.key);
  return 'target';
}

function classifyOperation(proof, operation) {
  if (operation.kind === 'column') return classifyColumn(proof, operation);
  if (operation.kind === 'index') return classifyIndex(proof, operation);
  return classifyForeignKey(proof, operation);
}

function assertBaseAndLedgerShape(proof) {
  for (const table of TABLES) {
    if (proof.tables[table].engine !== 'innodb') fail('typed_lineage_table_engine_mismatch', table);
  }
  const cfaSeries = proof.tables.cfa_series;
  const fundingSeries = proof.tables.funding_overview_series;
  for (const series of [cfaSeries, fundingSeries]) {
    if (findColumn(series, 'application_id') || findColumn(series, 'action_plan_id')) {
      fail('typed_lineage_series_topology_mismatch', series.table);
    }
  }
  for (const series of [cfaSeries, fundingSeries]) {
    const id = findColumn(series, 'id');
    const caseId = findColumn(series, 'case_id');
    const templateKey = findColumn(series, 'template_key');
    if (
      !id || id.type !== 'int' || id.nullable || id.defaultValue !== null || id.extra !== 'auto_increment' ||
      !caseId || caseId.type !== 'bigint unsigned' || caseId.nullable ||
      !templateKey || templateKey.type !== 'varchar(64)' || templateKey.nullable
    ) fail('typed_lineage_series_base_shape_mismatch', series.table);
    assertExactSingleColumnIndex(series.indexes.primary, { key: `${series.table}.PRIMARY`, column: 'id' }, true);
  }
  try {
    assertExactIndexShape(
      fundingSeries.indexes.uniq_funding_overview_series_case_template,
      'funding_overview_series.uniq_funding_overview_series_case_template',
      ['case_id', 'template_key'],
      true
    );
  } catch (error) {
    if (error?.code === 'typed_lineage_index_shape_mismatch') {
      fail('typed_lineage_funding_series_unique_mismatch');
    }
    throw error;
  }

  for (const [table, column, type, nullable] of [
    ['cfa_version', 'series_id', 'int', false],
    ['cfa_version', 'version_number', 'int', false],
    ['funding_overview_version', 'series_id', 'int', false],
    ['funding_overview_version', 'version_number', 'int', false],
    ['iset_application', 'id', 'bigint unsigned'],
    ['iset_case_action_plan', 'id', 'bigint unsigned'],
  ]) {
    const value = findColumn(proof.tables[table], column);
    if (!value || value.type !== type || (nullable !== undefined && value.nullable !== nullable)) {
      fail('typed_lineage_base_column_shape_mismatch', `${table}.${column}`);
    }
  }
  assertExactIndexShape(
    proof.tables.cfa_version.indexes.uniq_cfa_version_series,
    'cfa_version.uniq_cfa_version_series',
    ['series_id', 'version_number'],
    true
  );
  assertExactIndexShape(
    proof.tables.funding_overview_version.indexes.uniq_funding_overview_version_series,
    'funding_overview_version.uniq_funding_overview_version_series',
    ['series_id', 'version_number'],
    true
  );
  for (const spec of [
    {
      table: 'cfa_version',
      name: 'fk_cfa_version_series',
      column: 'series_id',
      referencedTable: 'cfa_series',
    },
    {
      table: 'funding_overview_version',
      name: 'fk_funding_overview_version_series',
      column: 'series_id',
      referencedTable: 'funding_overview_series',
    },
  ]) {
    const constraint = proof.tables[spec.table].constraints[spec.name];
    if (
      !constraint || constraint.type !== 'FOREIGN KEY' ||
      JSON.stringify(constraint.columns) !== JSON.stringify([spec.column]) ||
      constraint.referencedTable !== spec.referencedTable ||
      JSON.stringify(constraint.referencedColumns) !== JSON.stringify(['id']) ||
      constraint.matchOption !== 'NONE' ||
      !isRestrictiveForeignKeyRule(constraint.updateRule) ||
      !isRestrictiveForeignKeyRule(constraint.deleteRule)
    ) fail('typed_lineage_series_foreign_key_mismatch', `${spec.table}.${spec.name}`);
  }
  for (const table of ['iset_application', 'iset_case_action_plan']) {
    const primary = proof.tables[table].indexes.primary;
    if (!primary || primary.length !== 1 || primary[0].column !== 'id' || primary[0].nonUnique !== 0) {
      fail('typed_lineage_reference_key_shape_mismatch', `${table}.id`);
    }
  }

  const ledger = proof.tables.iset_migration;
  for (const [name, type, nullable] of [
    ['id', 'int', false],
    ['filename', 'varchar(255)', false],
    ['checksum', 'char(64)', false],
    ['applied_at', 'datetime', false],
    ['duration_ms', 'int', false],
    ['success', 'tinyint(1)', false],
    ['error_snippet', 'text', true],
  ]) {
    const value = findColumn(ledger, name);
    if (!value || value.type !== type || value.nullable !== nullable) fail('typed_lineage_ledger_shape_mismatch', name);
  }
  const ledgerId = findColumn(ledger, 'id');
  if (ledgerId.defaultValue !== null || ledgerId.extra !== 'auto_increment') {
    fail('typed_lineage_ledger_id_generation_mismatch');
  }
  assertExactSingleColumnIndex(
    ledger.indexes.primary,
    { key: 'iset_migration.PRIMARY', column: 'id' },
    true
  );
  const ledgerUnique = ledger.indexes.uniq_filename_checksum;
  if (
    !ledgerUnique || ledgerUnique.length !== 2 ||
    ledgerUnique[0].sequence !== 1 || ledgerUnique[1].sequence !== 2 ||
    ledgerUnique[0].column !== 'filename' || ledgerUnique[1].column !== 'checksum' ||
    ledgerUnique.some(item => (
      item.nonUnique !== 0 || item.subPart !== null || item.indexType !== 'BTREE' ||
      (item.visible !== null && item.visible !== 'YES') || item.expression !== null
    ))
  ) fail('typed_lineage_ledger_unique_mismatch');
}

function assertNoUnexpectedTypedLineageObjects(proof) {
  const targets = [
    {
      table: 'cfa_version',
      column: 'application_id',
      index: 'idx_cfa_version_application',
      constraint: 'fk_cfa_version_application',
    },
    {
      table: 'cfa_version',
      column: 'action_plan_id',
      index: 'idx_cfa_version_action_plan',
      constraint: 'fk_cfa_version_action_plan',
    },
    {
      table: 'funding_overview_version',
      column: 'application_id',
      index: 'idx_funding_overview_version_application',
      constraint: 'fk_funding_overview_version_application',
    },
  ];
  for (const target of targets) {
    const table = proof.tables[target.table];
    for (const [name, entries] of Object.entries(table.indexes)) {
      if (entries.some(entry => entry.column === target.column) && name !== target.index) {
        fail('typed_lineage_unexpected_index', `${target.table}.${target.column}:${name}`);
      }
    }
    for (const [name, constraint] of Object.entries(table.constraints)) {
      if (
        constraint.type === 'FOREIGN KEY' && constraint.columns.includes(target.column) &&
        name !== target.constraint
      ) {
        fail('typed_lineage_unexpected_foreign_key', `${target.table}.${target.column}:${name}`);
      }
    }
  }
}

function assertAllOperationShapes(proof) {
  assertBaseAndLedgerShape(proof);
  assertNoUnexpectedTypedLineageObjects(proof);
  return Object.fromEntries(OPERATIONS.map(operation => [operation.key, classifyOperation(proof, operation)]));
}

function assertSeriesUnchanged(proof, baseline) {
  for (const table of ['cfa_series', 'funding_overview_series']) {
    if (proof.tables[table].structureHash !== baseline[table]) fail('typed_lineage_series_changed', table);
  }
}

function assertOperationExecutable(proof, operation) {
  const state = classifyOperation(proof, operation);
  if (state !== 'absent') return state;
  if (operation.kind === 'column') {
    if (!findColumn(proof.tables[operation.table], operation.after)) fail('typed_lineage_ddl_identifier_unproved', operation.key);
  } else {
    const source = findColumn(proof.tables[operation.table], operation.column);
    assertNullableBigintUnsigned(source, operation.key);
    if (operation.kind === 'foreignKey') {
      const target = findColumn(proof.tables[operation.referencedTable], operation.referencedColumn);
      if (!target || target.type !== 'bigint unsigned') fail('typed_lineage_ddl_reference_unproved', operation.key);
    }
  }
  return state;
}

function compactProof(proof) {
  return {
    identity: { ...proof.identity },
    tables: Object.fromEntries(TABLES.map(table => [table, {
      structureHash: proof.tables[table].structureHash,
      ddl: proof.tables[table].ddl,
      ddlHash: proof.tables[table].ddlHash,
      columnsHash: proof.tables[table].columnsHash,
      indexesHash: proof.tables[table].indexesHash,
      constraintsHash: proof.tables[table].constraintsHash,
      columns: proof.tables[table].columns.map(column => ({ ...column })),
      indexes: jsonSafeClone(proof.tables[table].indexes),
      constraints: jsonSafeClone(proof.tables[table].constraints),
      metadata: jsonSafeClone(proof.tables[table].metadata),
    }])),
  };
}

async function executeTypedLineageMigration({
  targetEnv,
  configuredIdentity,
  executionContext,
  instanceIdentityProvider,
  // Backward-compatible names used by the original TEST-only caller.
  testExecutionContext,
  testInstanceIdentityProvider,
  connectionFactory,
  migrationPath,
  clock = () => new Date(),
}) {
  const startedAt = clock();
  const evidence = {
    schemaVersion: 1,
    executor: '20260825-typed-lineage-bounded',
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
    executionModel: 'The canonical file is checksum/semantic proof; this bounded executor applies its nine exact DDL literals and only then records the canonical checksum.',
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
    const environment = evidence.targetEnv;
    const contract = ENVIRONMENT_CONTRACTS[environment];
    if (!contract) fail('typed_lineage_environment_invalid');
    if (typeof connectionFactory !== 'function') fail('typed_lineage_connection_factory_required');
    const configured = comparableConfiguredIdentity(configuredIdentity);
    assertExactObject(configured, contract.configured, 'typed_lineage_configured_database_identity_mismatch');
    evidence.configuredDatabase = configured;

    if (environment === 'test' || environment === 'prod') {
      evidence.phase = `${environment}-instance-identity`;
      const remoteExecutionContext = executionContext || testExecutionContext;
      const remoteIdentityProvider = instanceIdentityProvider || testInstanceIdentityProvider;
      const expectedAccountId = String(remoteExecutionContext?.expectedAwsAccountId || '').trim();
      const expectedInstanceId = String(remoteExecutionContext?.expectedSsmInstanceId || '').trim();
      const runToken = String(remoteExecutionContext?.runToken || '').trim();
      if (expectedAccountId !== EXPECTED_AWS_ACCOUNT_IDS[environment]) {
        fail('typed_lineage_outer_account_context_mismatch');
      }
      if (!/^i-[a-f0-9]{8,17}$/u.test(expectedInstanceId)) fail('typed_lineage_outer_instance_context_invalid');
      if (!runToken) fail('typed_lineage_outer_run_token_required');
      if (typeof remoteIdentityProvider !== 'function') fail('typed_lineage_instance_identity_provider_required');
      const awsIdentity = await remoteIdentityProvider();
      const actualAccountId = String(awsIdentity?.Account || awsIdentity?.accountId || '').trim();
      const actualInstanceId = String(awsIdentity?.InstanceId || awsIdentity?.instanceId || '').trim();
      const actualRegion = String(awsIdentity?.Region || awsIdentity?.region || '').trim();
      if (actualAccountId !== expectedAccountId) fail('typed_lineage_aws_account_mismatch');
      if (actualInstanceId !== expectedInstanceId) fail('typed_lineage_ssm_instance_mismatch');
      if (actualRegion !== 'ca-central-1') fail('typed_lineage_instance_region_mismatch');
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
      fail('typed_lineage_connection_invalid');
    }

    evidence.phase = 'schema-preflight';
    let proof = await captureSchemaProof(connection, contract, metadataLog);
    const initialStates = assertAllOperationShapes(proof);
    const seriesBaseline = {
      cfa_series: proof.tables.cfa_series.structureHash,
      funding_overview_series: proof.tables.funding_overview_series.structureHash,
    };
    evidence.preflight = { ...compactProof(proof), operationStates: initialStates, seriesBaseline };

    evidence.phase = 'ledger-precheck';
    // This read is allowed only after the ledger DDL and every other required table have been proved.
    assertBaseAndLedgerShape(proof);
    const [initialLedgerRows] = await connection.execute(LEDGER_READ_SQL, [MIGRATION_FILENAME]);
    const successfulLedgerRows = (initialLedgerRows || []).filter(row => Number(nativeValue(row, 'success')) === 1);
    if (successfulLedgerRows.some(row => String(nativeValue(row, 'checksum')) !== MIGRATION_SHA256)) {
      fail('typed_lineage_ledger_checksum_drift');
    }
    if (successfulLedgerRows.some(row => String(nativeValue(row, 'checksum')) === MIGRATION_SHA256) &&
        Object.values(initialStates).some(state => state !== 'target')) {
      fail('typed_lineage_ledger_schema_contradiction');
    }
    evidence.ledgerPrecheck = {
      rowCount: (initialLedgerRows || []).length,
      successfulChecksums: successfulLedgerRows.map(row => String(nativeValue(row, 'checksum'))),
    };

    // Re-prove the entire schema after the ordinary ledger read so the first DDL also has
    // immediately current metadata evidence rather than relying on an earlier snapshot.
    evidence.phase = 'operation-preflight-refresh';
    proof = await captureSchemaProof(connection, contract, metadataLog);
    assertSeriesUnchanged(proof, seriesBaseline);
    assertAllOperationShapes(proof);

    let totalDdlDurationMs = 0;
    for (const operation of OPERATIONS) {
      evidence.phase = `operation:${operation.key}:precheck`;
      assertSeriesUnchanged(proof, seriesBaseline);
      assertAllOperationShapes(proof);
      const state = assertOperationExecutable(proof, operation);
      const record = {
        key: operation.key,
        stateBefore: state,
        attempted: false,
        executed: false,
        ddlSha256: sha256(operation.ddl),
        durationMs: 0,
        postProof: null,
      };
      evidence.operations.push(record);
      if (state === 'target') continue;

      evidence.phase = `operation:${operation.key}:execute`;
      const ddlStarted = Date.now();
      // MySQL DDL auto-commits. A driver/network error can be ambiguous, so an attempt
      // is evidence of possible mutation even when the await never reports success.
      record.attempted = true;
      await connection.query(operation.ddl);
      record.durationMs = Date.now() - ddlStarted;
      record.executed = true;
      totalDdlDurationMs += record.durationMs;

      evidence.phase = `operation:${operation.key}:post-proof`;
      proof = await captureSchemaProof(connection, contract, metadataLog);
      assertSeriesUnchanged(proof, seriesBaseline);
      assertAllOperationShapes(proof);
      if (classifyOperation(proof, operation) !== 'target') fail('typed_lineage_post_proof_failed', operation.key);
      record.postProof = compactProof(proof);
    }

    evidence.phase = 'final-proof';
    proof = await captureSchemaProof(connection, contract, metadataLog);
    assertSeriesUnchanged(proof, seriesBaseline);
    const finalStates = assertAllOperationShapes(proof);
    if (Object.values(finalStates).some(state => state !== 'target')) fail('typed_lineage_target_incomplete');
    evidence.finalProof = { ...compactProof(proof), operationStates: finalStates };

    evidence.phase = 'ledger-read';
    // Identifiers in both ledger statements were proved in the immediately preceding full DDL capture.
    assertBaseAndLedgerShape(proof);
    const [finalLedgerRows] = await connection.execute(LEDGER_READ_SQL, [MIGRATION_FILENAME]);
    const finalSuccessfulRows = (finalLedgerRows || []).filter(row => Number(nativeValue(row, 'success')) === 1);
    if (finalSuccessfulRows.some(row => String(nativeValue(row, 'checksum')) !== MIGRATION_SHA256)) {
      fail('typed_lineage_ledger_checksum_drift');
    }
    const initiallySuccessfulExact = successfulLedgerRows.filter(
      row => String(nativeValue(row, 'checksum')) === MIGRATION_SHA256
    );
    const finalSuccessfulExact = finalSuccessfulRows.filter(
      row => String(nativeValue(row, 'checksum')) === MIGRATION_SHA256
    );
    if (initiallySuccessfulExact.length > 1 || (initiallySuccessfulExact.length && !finalSuccessfulExact.length)) {
      fail('typed_lineage_ledger_changed_during_execution');
    }
    // Another exact executor may have completed between our precheck and final proof.
    // Preserve that successful row instead of rewriting its applied_at/duration audit facts.
    if (finalSuccessfulExact.length) {
      if (finalSuccessfulExact.length !== 1) fail('typed_lineage_ledger_changed_during_execution');
      const retained = finalSuccessfulExact[0];
      evidence.ledger = {
        priorRowCount: (finalLedgerRows || []).length,
        filename: MIGRATION_FILENAME,
        checksum: MIGRATION_SHA256,
        success: true,
        status: 'already-recorded',
        writePerformed: false,
        appliedAt: nativeValue(retained, 'applied_at') ?? null,
        durationMs: Number(nativeValue(retained, 'duration_ms')) || 0,
      };
      evidence.phase = 'complete';
      evidence.decision = 'COMPLETE';
      return evidence;
    }

    evidence.phase = 'ledger-write';
    assertBaseAndLedgerShape(proof);
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
    assertBaseAndLedgerShape(proof);
    const [verifiedRows] = await connection.execute(LEDGER_READ_SQL, [MIGRATION_FILENAME]);
    const exact = (verifiedRows || []).filter(row => (
      String(nativeValue(row, 'checksum')) === MIGRATION_SHA256 && Number(nativeValue(row, 'success')) === 1
    ));
    const unexpectedSuccessful = (verifiedRows || []).some(row => (
      Number(nativeValue(row, 'success')) === 1 && String(nativeValue(row, 'checksum')) !== MIGRATION_SHA256
    ));
    if (exact.length !== 1 || unexpectedSuccessful) fail('typed_lineage_ledger_verification_failed');
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
    evidence.phase = 'complete';
    evidence.decision = 'COMPLETE';
    return evidence;
  } catch (error) {
    evidence.failure = {
      code: error?.code || 'typed_lineage_migration_failed',
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
      } catch (closeError) {
        evidence.connectionCloseError = {
          code: closeError?.code || 'typed_lineage_connection_close_failed',
          message: String(closeError?.message || closeError),
        };
        evidence.operationalWarnings.push({
          code: 'typed_lineage_connection_close_failed',
          message: 'The guarded work result is preserved, but closing the database session reported an error.',
        });
      }
    }
  }
}

module.exports = {
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
  executeTypedLineageMigration,
  verifyMigrationArtifact,
};
