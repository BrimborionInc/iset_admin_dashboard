const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildAppliedMigrationRowsSql,
  planPendingSharedSchemaMigrations,
} = require('../src/lib/sharedSchemaMigrationRunner');
const {
  VERIFIED_DEV_SCHEMA_IDENTITY,
  createDevSchemaPlanGuard,
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

function createFakePool({
  identityFailure = null,
  ddlFailure = null,
  trackingTableExists = true,
  appliedRows = [],
} = {}) {
  const query = jest.fn(async (statement, params = []) => {
    const sql = String(statement).trim().replace(/\s+/gu, ' ');
    if (sql === 'SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION()') {
      if (identityFailure) throw identityFailure;
      return [[{
        'DATABASE()': VERIFIED_DEV_SCHEMA_IDENTITY.database,
        '@@hostname': VERIFIED_DEV_SCHEMA_IDENTITY.serverHostname,
        '@@port': VERIFIED_DEV_SCHEMA_IDENTITY.port,
        'CURRENT_USER()': VERIFIED_DEV_SCHEMA_IDENTITY.currentUser,
        'VERSION()': '8.0.40',
      }], []];
    }
    if (/^SHOW FULL TABLES FROM `iset_intake` LIKE \?$/u.test(sql)) {
      expect(params).toEqual(['iset_migration']);
      return trackingTableExists
        ? [[{ Tables_in_iset_intake: 'iset_migration', Table_type: 'BASE TABLE' }], []]
        : [[], []];
    }
    if (sql === 'SHOW CREATE TABLE `iset_migration`') {
      if (ddlFailure) throw ddlFailure;
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
    if (/FROM information_schema\.TABLE_CONSTRAINTS/u.test(sql)) {
      return [[
        { CONSTRAINT_NAME: 'PRIMARY', CONSTRAINT_TYPE: 'PRIMARY KEY' },
        { CONSTRAINT_NAME: 'uniq_filename_checksum', CONSTRAINT_TYPE: 'UNIQUE' },
      ], []];
    }
    if (/FROM information_schema\.KEY_COLUMN_USAGE/u.test(sql)) {
      return [[
        { CONSTRAINT_NAME: 'PRIMARY', COLUMN_NAME: 'id', REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null, ORDINAL_POSITION: 1 },
        { CONSTRAINT_NAME: 'uniq_filename_checksum', COLUMN_NAME: 'filename', REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null, ORDINAL_POSITION: 1 },
        { CONSTRAINT_NAME: 'uniq_filename_checksum', COLUMN_NAME: 'checksum', REFERENCED_TABLE_NAME: null, REFERENCED_COLUMN_NAME: null, ORDINAL_POSITION: 2 },
      ], []];
    }
    throw new Error(`Unexpected metadata SQL: ${sql}`);
  });
  const execute = jest.fn(async () => [appliedRows, []]);
  return { query, execute };
}

function withMigrationDirectory(testFn) {
  const migrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-schema-plan-safety-'));
  const content = 'SELECT 1;\n';
  const file = '001_example.sql';
  fs.writeFileSync(path.join(migrationsDir, file), content, 'utf8');
  const checksum = crypto.createHash('sha256').update(content).digest('hex');
  return Promise.resolve()
    .then(() => testFn({ migrationsDir, file, checksum }))
    .finally(() => fs.rmSync(migrationsDir, { recursive: true, force: true }));
}

function createGuard(pool) {
  return createDevSchemaPlanGuard(pool, {
    host: VERIFIED_DEV_SCHEMA_IDENTITY.configuredHost,
    user: VERIFIED_DEV_SCHEMA_IDENTITY.configuredUser,
    database: VERIFIED_DEV_SCHEMA_IDENTITY.database,
    port: VERIFIED_DEV_SCHEMA_IDENTITY.port,
  });
}

describe('read-only schema migration planning', () => {
  test('fails closed after identity failure without CREATE or ordinary SQL', async () => withMigrationDirectory(async ({ migrationsDir }) => {
    const identityFailure = Object.assign(new Error('identity unavailable'), { code: 'ER_ACCESS_DENIED_ERROR' });
    const pool = createFakePool({ identityFailure });

    await expect(planPendingSharedSchemaMigrations(pool, {
      migrationsDir,
      schemaGuard: createGuard(pool),
    })).rejects.toBe(identityFailure);

    expect(pool.execute).not.toHaveBeenCalled();
    expect(pool.query.mock.calls.map(([sql]) => String(sql)))
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/^\s*CREATE\s+TABLE/iu)]));
    expect(pool.query).toHaveBeenCalledTimes(1);
  }));

  test('fails closed after DDL discovery failure without CREATE or ordinary SQL', async () => withMigrationDirectory(async ({ migrationsDir }) => {
    const ddlFailure = Object.assign(new Error('DDL unavailable'), { code: 'ER_TABLEACCESS_DENIED_ERROR' });
    const pool = createFakePool({ ddlFailure });

    await expect(planPendingSharedSchemaMigrations(pool, {
      migrationsDir,
      schemaGuard: createGuard(pool),
    })).rejects.toBe(ddlFailure);

    expect(pool.execute).not.toHaveBeenCalled();
    expect(pool.query.mock.calls.map(([sql]) => String(sql)))
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/^\s*CREATE\s+TABLE/iu)]));
    expect(pool.query.mock.calls.map(([sql]) => String(sql)))
      .toEqual(expect.arrayContaining([expect.stringMatching(/^SHOW CREATE TABLE `iset_migration`$/u)]));
  }));

  test('reports every canonical migration pending when the optional ledger is absent', async () => withMigrationDirectory(async ({ migrationsDir, file }) => {
    const pool = createFakePool({ trackingTableExists: false });

    await expect(planPendingSharedSchemaMigrations(pool, {
      migrationsDir,
      schemaGuard: createGuard(pool),
    })).resolves.toMatchObject({
      trackingTableExists: false,
      appliedCount: 0,
      pendingCount: 1,
      pending: [expect.objectContaining({ file })],
      schemaEvidence: expect.objectContaining({
        optionalAbsentObjects: ['iset_migration'],
        verifiedStatementCount: 0,
      }),
    });

    expect(pool.execute).not.toHaveBeenCalled();
    expect(pool.query.mock.calls.map(([sql]) => String(sql)))
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/^\s*CREATE\s+TABLE/iu)]));
  }));

  test('proves full ledger metadata before one fully-qualified guarded SELECT', async () => withMigrationDirectory(async ({ migrationsDir, file, checksum }) => {
    const appliedRows = [{
      filename: file,
      checksum,
      success: 1,
      applied_at: '2026-08-09 12:00:00',
      duration_ms: 5,
      error_snippet: null,
    }];
    const pool = createFakePool({ appliedRows });

    await expect(planPendingSharedSchemaMigrations(pool, {
      migrationsDir,
      schemaGuard: createGuard(pool),
    })).resolves.toMatchObject({
      trackingTableExists: true,
      appliedCount: 1,
      pendingCount: 0,
      schemaEvidence: expect.objectContaining({ verifiedStatementCount: 1 }),
    });

    expect(pool.query.mock.calls.map(([sql]) => String(sql))).toEqual(expect.arrayContaining([
      'SHOW CREATE TABLE `iset_migration`',
      'SHOW FULL COLUMNS FROM `iset_migration`',
      'SHOW INDEX FROM `iset_migration`',
      expect.stringContaining('information_schema.TABLE_CONSTRAINTS'),
      expect.stringContaining('information_schema.KEY_COLUMN_USAGE'),
    ]));
    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.execute).toHaveBeenCalledWith(buildAppliedMigrationRowsSql('iset_migration'), []);
    expect(buildAppliedMigrationRowsSql('iset_migration')).not.toMatch(/\bAS\b/u);
    expect(buildAppliedMigrationRowsSql('iset_migration')).not.toMatch(/[A-Za-z_]\w*\s*\(/u);
  }));

  test('the mandatory qualifier invokes the hardened DEV planner', () => {
    const inventory = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '..', 'docs', 'testing', 'release-coverage-inventory.json'),
      'utf8'
    ));
    expect(inventory.checks['schema-plan-dev'].command).toEqual([
      'npm', 'run', 'db:migrate:plan', '--', '--target-env', 'dev',
    ]);
    expect(inventory.checks['schema-plan-dev'].effects).toMatch(/metadata-only/iu);
    expect(inventory.checks['schema-plan-dev'].effects).toMatch(/never creates/iu);
  });
});
