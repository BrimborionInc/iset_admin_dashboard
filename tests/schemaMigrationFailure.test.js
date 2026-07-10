const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  applyPendingSharedSchemaMigrations,
  assertMigrationApplySucceeded,
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

  test('deploy and TEST-refresh parents validate schema child results before continuing', () => {
    const deploySource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const refreshSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-test-db-refresh.js'), 'utf8');
    const schemaCliSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-schema-migrate.js'), 'utf8');

    expect(deploySource).toMatch(/return assertMigrationApplySucceeded\(result,/u);
    expect(refreshSource).toMatch(/return assertMigrationApplySucceeded\(result,/u);
    expect(schemaCliSource).toMatch(/return assertMigrationApplySucceeded\(\{/u);
  });
});
