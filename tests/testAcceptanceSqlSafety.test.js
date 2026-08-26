const {
  RUNTIME_METRICS_SQL,
  createRuntimeMetricsGuard,
} = require('../scripts/path-test-runtime-metrics');
const {
  MIGRATION_LEDGER_SQL,
  createMigrationLedgerGuard,
} = require('../scripts/path-test-migration-ledger');

function column(Field, Type = 'varchar(255)') {
  return {
    Field,
    Type,
    Collation: Type.includes('char') ? 'utf8mb4_unicode_ci' : null,
    Null: 'NO',
    Key: '',
    Default: null,
    Extra: '',
  };
}

function guardedReaderDriver() {
  const objects = {
    iset_event_delivery: {
      columns: [column('status'), column('updated_at', 'datetime(3)')],
    },
    iset_runtime_config: {
      columns: [column('scope'), column('k'), column('v', 'json')],
    },
    iset_migration: {
      columns: [
        column('id', 'int'),
        column('filename'),
        column('checksum', 'char(64)'),
        column('success', 'tinyint(1)'),
        column('applied_at', 'datetime'),
        column('duration_ms', 'int'),
        column('error_snippet', 'text'),
      ],
    },
  };
  for (const [name, object] of Object.entries(objects)) {
    object.ddl = `CREATE TABLE \`${name}\` (${object.columns.map(item => `\`${item.Field}\` ${item.Type}`).join(', ')})`;
  }
  const query = jest.fn(async (sql, params = []) => {
    const normalized = String(sql).trim().replace(/\s+/gu, ' ');
    if (normalized === 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()') {
      return [[{
        'DATABASE()': 'iset_intake',
        '@@hostname': 'ip-172-16-0-199',
        '@@port': 3306,
        'CURRENT_USER()': 'app_admin@10.48.%',
        'VERSION()': '8.0.42',
      }], []];
    }
    if (normalized.startsWith('SHOW FULL TABLES FROM `iset_intake` LIKE ?')) {
      return [objects[params[0]] ? [{ Tables_in_iset_intake: params[0], Table_type: 'BASE TABLE' }] : [], []];
    }
    const create = /^SHOW CREATE TABLE `([^`]+)`$/u.exec(normalized);
    if (create) return [[{ Table: create[1], 'Create Table': objects[create[1]].ddl }], []];
    const columns = /^SHOW FULL COLUMNS FROM `([^`]+)`$/u.exec(normalized);
    if (columns) return [objects[columns[1]].columns, []];
    if (/^SHOW INDEX FROM /u.test(normalized)) return [[], []];
    if (normalized.includes('information_schema.TABLE_CONSTRAINTS')) return [[], []];
    if (normalized.includes('information_schema.KEY_COLUMN_USAGE')) return [[], []];
    if (normalized.includes('information_schema.KEYWORDS')) return [[], []];
    throw new Error(`unexpected metadata query: ${normalized}`);
  });
  const execute = jest.fn(async sql => {
    if (sql === RUNTIME_METRICS_SQL) return [[{
      stale_deliveries: 0,
      held_deliveries: 0,
      active_announcements: 0,
      unsafe_finance_routing: 0,
      enabled_intacct: 0,
    }], []];
    if (sql === MIGRATION_LEDGER_SQL) return [[], []];
    throw new Error('unexpected ordinary SQL');
  });
  return { query, execute };
}

const configuredTestIdentity = Object.freeze({
  host: 'nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com',
  port: 3306,
  user: 'app_admin',
  database: 'iset_intake',
});

describe('operational SQL reader safety', () => {
  test('canonical guard validates the finished runtime metrics SQL before execution', async () => {
    const connection = guardedReaderDriver();
    const guard = createRuntimeMetricsGuard(connection, configuredTestIdentity);

    await guard.preflight();
    await guard.execute(RUNTIME_METRICS_SQL);

    expect(connection.execute).toHaveBeenCalledWith(RUNTIME_METRICS_SQL, []);
    expect(guard.evidence().verifiedStatementCount).toBe(1);
  });

  test('canonical guard validates the finished migration-ledger SQL before execution', async () => {
    const connection = guardedReaderDriver();
    const guard = createMigrationLedgerGuard(connection, configuredTestIdentity);

    await guard.preflight();
    await guard.execute(MIGRATION_LEDGER_SQL);

    expect(connection.execute).toHaveBeenCalledWith(MIGRATION_LEDGER_SQL, []);
    expect(guard.evidence().verifiedStatementCount).toBe(1);
  });
});
