const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

const {
  applyPendingSharedSchemaMigrations,
  assertMigrationApplySucceeded,
  assertNoMigrationChecksumDrift,
  planPendingSharedSchemaMigrations,
} = require('../src/lib/sharedSchemaMigrationRunner');

function createFailingPool() {
  const trackingWrites = [];
  const executedStatements = [];
  const connection = {
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn(),
    query: jest.fn(async statement => {
      executedStatements.push(String(statement));
      if (String(statement).includes('FAIL_MIGRATION')) {
        const error = new Error('forced migration syntax failure');
        error.code = 'ER_PARSE_ERROR';
        throw error;
      }
      return [[], []];
    }),
  };

  const pool = {
    query: jest.fn(async (statement, params) => {
      const sql = String(statement);
      if (/^\s*SELECT filename,/u.test(sql)) {
        return [[], []];
      }
      if (/^\s*INSERT INTO/u.test(sql)) {
        trackingWrites.push(params);
      }
      return [[], []];
    }),
    getConnection: jest.fn(async () => connection),
  };

  return { pool, connection, trackingWrites, executedStatements };
}

describe('schema migration failure contract', () => {
  test('records a failed migration, rejects the apply, and does not execute later files', async () => {
    const migrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-migration-failure-'));
    fs.writeFileSync(path.join(migrationsDir, '001_fail.sql'), 'FAIL_MIGRATION;\n', 'utf8');
    fs.writeFileSync(path.join(migrationsDir, '002_must_not_run.sql'), 'SELECT 2;\n', 'utf8');
    const { pool, trackingWrites, executedStatements } = createFailingPool();

    try {
      await expect(
        applyPendingSharedSchemaMigrations(pool, {
          migrationsDir,
          logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        })
      ).rejects.toMatchObject({
        code: 'schema_migration_apply_failed',
        result: {
          haltedOnFailure: true,
          attempted: [expect.objectContaining({ file: '001_fail.sql', success: false })],
        },
      });

      expect(trackingWrites).toHaveLength(1);
      expect(trackingWrites[0][3]).toBe(0);
      expect(executedStatements.some(statement => statement.includes('SELECT 2'))).toBe(false);
    } finally {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }
  });

  test('parent orchestration validator rejects a zero-exit failure payload defensively', () => {
    expect(typeof assertMigrationApplySucceeded).toBe('function');
    expect(() => assertMigrationApplySucceeded({})).toThrow(/invalid result/u);
    expect(() => assertMigrationApplySucceeded({
      command: 'apply',
      haltedOnFailure: true,
      attempted: [{ file: '001_fail.sql', success: false, errorSnippet: 'forced failure' }],
    })).toThrow(/001_fail\.sql/u);
  });

  test('an applied filename is immutable while a new filename remains eligible', () => {
    const applied = [{ filename: '001_applied.sql', checksum: 'old-checksum', success: 1 }];
    expect(() => assertNoMigrationChecksumDrift([
      { file: '001_applied.sql', checksum: 'changed-checksum' },
      { file: '002_forward_fix.sql', checksum: 'new-checksum' },
    ], applied)).toThrow(expect.objectContaining({
      code: 'schema_migration_checksum_drift',
      drift: [expect.objectContaining({ file: '001_applied.sql' })],
    }));
    expect(assertNoMigrationChecksumDrift([
      { file: '001_applied.sql', checksum: 'old-checksum' },
      { file: '002_forward_fix.sql', checksum: 'new-checksum' },
    ], applied)).toBe(true);
  });

  test('a clean replay plan matches a long-lived ledger and accepts only a forward filename', async () => {
    const migrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-migration-replay-'));
    const original = 'SELECT 1;\n';
    const checksum = crypto.createHash('sha256').update(original).digest('hex');
    fs.writeFileSync(path.join(migrationsDir, '001_applied.sql'), original);
    const applied = [{ filename: '001_applied.sql', checksum, success: 1 }];
    const pool = { query: jest.fn(async sql => [/^\s*SELECT filename,/u.test(String(sql)) ? applied : [], []]) };
    try {
      await expect(planPendingSharedSchemaMigrations(pool, { migrationsDir })).resolves.toMatchObject({ pendingCount: 0 });
      fs.writeFileSync(path.join(migrationsDir, '002_forward_fix.sql'), 'SELECT 2;\n');
      await expect(planPendingSharedSchemaMigrations(pool, { migrationsDir })).resolves.toMatchObject({
        pendingCount: 1,
        pending: [expect.objectContaining({ file: '002_forward_fix.sql' })],
      });
      fs.writeFileSync(path.join(migrationsDir, '001_applied.sql'), 'SELECT 99;\n');
      await expect(planPendingSharedSchemaMigrations(pool, { migrationsDir })).rejects.toMatchObject({
        code: 'schema_migration_checksum_drift',
      });
    } finally {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }
  });

  test('deploy and TEST-refresh parents validate schema child results before continuing', () => {
    const deploySource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const refreshSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-test-db-refresh.js'), 'utf8');
    const schemaCliSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-schema-migrate.js'), 'utf8');

    expect(deploySource).toMatch(/return assertMigrationApplySucceeded\(result,/u);
    expect(refreshSource).toMatch(/return assertMigrationApplySucceeded\(result,/u);
    expect(schemaCliSource).toMatch(/return assertMigrationApplySucceeded\(\{/u);
    expect(schemaCliSource).toMatch(/assertNoMigrationChecksumDrift\(migrations, appliedRows\)/u);
  });
});
