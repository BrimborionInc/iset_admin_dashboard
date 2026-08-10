const fs = require('fs');
const path = require('path');
const {
  RUNTIME_METRICS_SQL,
  createRuntimeMetricsGuard,
} = require('../scripts/path-test-runtime-metrics');
const {
  MIGRATION_LEDGER_SQL,
  createMigrationLedgerGuard,
} = require('../scripts/path-test-migration-ledger');

function source(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

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

describe('TEST acceptance SQL safety wiring', () => {
  test('applicant-scope preflights before Cognito and guards every ordinary statement', () => {
    const text = source('scripts/applicant-scope-guard-test-smoke.js');

    expect(text).toContain("const { createLiveSchemaGuard } = require('./two-step-review-test-smoke');");
    expect(text.indexOf('const preflight = runRemote({ preflightOnly: true });')).toBeLessThan(
      text.indexOf('applicantA.sub = createCognitoUser({ ...applicantA, poolId }, options);')
    );
    expect(text.indexOf('result.schemaSafety = await schemaGuard.preflight();')).toBeLessThan(
      text.indexOf('await seedFixture();')
    );
    expect(text).toContain('onBeforeStatementExecute: ({ mutating }) => {');
    expect(text).toContain('if (mutating) fixtureMutationStarted = true;');
    expect(text).toContain('return schemaGuard.execute(sql, params);');
    expect(text).not.toMatch(/connection\.(?:query|execute|beginTransaction|commit|rollback)\(/u);
    expect(text).toContain("throw new Error('--keep-fixture is disabled: release smoke must prove zero TEST residue.');");
    expect(text).toContain("await query('START TRANSACTION');");
    expect(text).toContain('await cleanupByMarkerAndEmail({ emails, markerLike });');
    expect(text).toContain("result.cleanup = 'suppressed_after_schema_safety_failure';");
  });

  test('postflight uses deployed guarded readers instead of raw SQL transport', () => {
    const postflight = source('scripts/path-test-runtime-postflight.js');
    const metrics = source('scripts/path-test-runtime-metrics.js');
    const ledger = source('scripts/path-test-migration-ledger.js');
    const deploy = source('scripts/path-deploy.js');

    expect(postflight).not.toContain('run-test-sql-via-ssm.sh');
    expect(postflight).not.toContain('SELECT COUNT(*) FROM iset_event_delivery');
    expect(postflight).toContain('node scripts/path-test-runtime-metrics.js');
    expect(postflight).toContain('node scripts/path-test-migration-ledger.js');
    expect(deploy).toContain("'lib/live-mysql-schema-guard.js'");
    expect(deploy).toContain("'lib/test-instance-aws-identity.js'");
    expect(deploy).toContain("'applicant-scope-guard-test-smoke.js'");
    expect(deploy).toContain("'path-test-migration-ledger.js'");
    expect(deploy).toContain("'path-test-runtime-metrics.js'");
    expect(deploy).toContain("'r1-intake-completion-test-smoke.js'");
    expect(metrics).toContain("const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');");
    expect(ledger).toContain("const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');");
    expect(metrics.indexOf('await guard.preflight();')).toBeLessThan(
      metrics.indexOf('await guard.execute(RUNTIME_METRICS_SQL)')
    );
    expect(ledger.indexOf('await guard.preflight();')).toBeLessThan(
      ledger.indexOf('await guard.execute(MIGRATION_LEDGER_SQL)')
    );
    expect(metrics).toContain("version: '8.0.42'");
    expect(ledger).toContain("version: '8.0.42'");
    expect(ledger).toContain('summarizeMigrationLedger(result)');
    expect(postflight).not.toContain('report.rows');
  });

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
