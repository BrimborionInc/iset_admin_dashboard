

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PORTAL_ROOT = path.resolve(REPO_ROOT, '..', 'ISET-intake');

const DEFAULT_TRACKING_TABLE = 'iset_migration';
const CANONICAL_MIGRATIONS_DIR = path.join(REPO_ROOT, 'sql', 'migrations');
const OPS_SQL_DIR = path.join(REPO_ROOT, 'sql', 'ops');
const LEGACY_ARCHIVE_DIR = path.join(REPO_ROOT, 'db', 'migrations');
const RETIRED_PORTAL_MIGRATIONS_DIR = path.join(PORTAL_ROOT, 'db', 'migrations');

class SchemaMigrationApplyError extends Error {
  constructor(result, context = 'Schema migration apply') {
    const failedAttempts = Array.isArray(result?.attempted)
      ? result.attempted.filter(attempt => attempt?.success !== true)
      : [];
    const failedFiles = failedAttempts
      .map(attempt => attempt?.file)
      .filter(Boolean);
    const suffix = failedFiles.length
      ? `: ${failedFiles.join(', ')}`
      : '';
    super(`${context} failed${suffix}`);
    this.name = 'SchemaMigrationApplyError';
    this.code = 'schema_migration_apply_failed';
    this.result = result;
    this.failedFiles = failedFiles;
  }
}

class MigrationChecksumDriftError extends Error {
  constructor(drift) {
    super(`Applied migration checksum drift detected: ${drift.map(item => item.file).join(', ')}`);
    this.name = 'MigrationChecksumDriftError';
    this.code = 'schema_migration_checksum_drift';
    this.drift = drift;
  }
}

function assertNoMigrationChecksumDrift(migrations, appliedRows) {
  const successfulByFilename = new Map();
  (appliedRows || []).filter(row => Number(row.success) === 1).forEach(row => {
    if (!successfulByFilename.has(row.filename)) successfulByFilename.set(row.filename, new Set());
    successfulByFilename.get(row.filename).add(row.checksum);
  });
  const drift = (migrations || []).flatMap(migration => {
    const appliedChecksums = successfulByFilename.get(migration.file);
    if (!appliedChecksums || appliedChecksums.has(migration.checksum)) return [];
    return [{
      file: migration.file,
      filesystemChecksum: migration.checksum,
      appliedChecksums: Array.from(appliedChecksums).sort(),
    }];
  });
  if (drift.length) throw new MigrationChecksumDriftError(drift);
  return true;
}

function classifyMigrationFailures(migrations, appliedRows) {
  const canonicalKeys = new Set((migrations || []).map(migration => `${migration.file}|${migration.checksum}`));
  const successfulKeys = new Set((appliedRows || [])
    .filter(row => Number(row.success) === 1)
    .map(row => `${row.filename}|${row.checksum}`));
  const failed = (appliedRows || []).filter(row => Number(row.success) !== 1);
  const unresolved = failed.filter(row => {
    const key = `${row.filename}|${row.checksum}`;
    return canonicalKeys.has(key) && !successfulKeys.has(key);
  });
  const unresolvedSet = new Set(unresolved);
  return {
    unresolved,
    historical: failed.filter(row => !unresolvedSet.has(row)),
  };
}

function assertMigrationApplySucceeded(result, options = {}) {
  const context = options.context || 'Schema migration apply';
  if (
    !result ||
    typeof result !== 'object' ||
    !Array.isArray(result.attempted) ||
    typeof result.haltedOnFailure !== 'boolean'
  ) {
    throw new SchemaMigrationApplyError(result, `${context} returned an invalid result`);
  }
  const failedAttempts = Array.isArray(result.attempted)
    ? result.attempted.filter(attempt => attempt?.success !== true)
    : [];
  if (result.haltedOnFailure === true || failedAttempts.length > 0) {
    throw new SchemaMigrationApplyError(result, context);
  }
  return result;
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return String(value).toLowerCase() === 'true';
}

function listSqlFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.sql'))
    .sort();
}

function getSharedSchemaInventory() {
  const canonicalFiles = listSqlFiles(CANONICAL_MIGRATIONS_DIR);
  const opsFiles = listSqlFiles(OPS_SQL_DIR);
  const legacyArchiveFiles = listSqlFiles(LEGACY_ARCHIVE_DIR);
  const retiredPortalFiles = listSqlFiles(RETIRED_PORTAL_MIGRATIONS_DIR);

  return {
    trackingTable: DEFAULT_TRACKING_TABLE,
    canonical: {
      dir: CANONICAL_MIGRATIONS_DIR,
      files: canonicalFiles,
      count: canonicalFiles.length,
    },
    ops: {
      dir: OPS_SQL_DIR,
      files: opsFiles,
      count: opsFiles.length,
    },
    legacyArchive: {
      dir: LEGACY_ARCHIVE_DIR,
      files: legacyArchiveFiles,
      count: legacyArchiveFiles.length,
    },
    retiredPortal: {
      dir: RETIRED_PORTAL_MIGRATIONS_DIR,
      files: retiredPortalFiles,
      count: retiredPortalFiles.length,
    },
  };
}

function getCanonicalMigrationFiles({ migrationsDir = CANONICAL_MIGRATIONS_DIR } = {}) {
  return listSqlFiles(migrationsDir).map(file => {
    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const checksum = crypto.createHash('sha256').update(content).digest('hex');
    return {
      file,
      fullPath,
      content,
      checksum,
    };
  });
}

async function ensureTrackingTable(pool, { trackingTable = DEFAULT_TRACKING_TABLE } = {}) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${trackingTable} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      duration_ms INT NOT NULL,
      success TINYINT(1) NOT NULL DEFAULT 1,
      error_snippet TEXT NULL,
      UNIQUE KEY uniq_filename_checksum (filename, checksum)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );
}

async function fetchAppliedMigrationRows(pool, { trackingTable = DEFAULT_TRACKING_TABLE } = {}) {
  const [rows] = await pool.query(
    `SELECT filename, checksum, success, applied_at, duration_ms, error_snippet
       FROM ${trackingTable}
      ORDER BY applied_at ASC, id ASC`
  );
  return rows || [];
}

async function planPendingSharedSchemaMigrations(pool, options = {}) {
  const trackingTable = options.trackingTable || DEFAULT_TRACKING_TABLE;
  const migrationsDir = options.migrationsDir || CANONICAL_MIGRATIONS_DIR;

  await ensureTrackingTable(pool, { trackingTable });

  const appliedRows = await fetchAppliedMigrationRows(pool, { trackingTable });
  const migrations = getCanonicalMigrationFiles({ migrationsDir });
  assertNoMigrationChecksumDrift(migrations, appliedRows);
  const successfulAppliedMap = new Map(
    appliedRows
      .filter(row => Number(row.success) === 1)
      .map(row => [`${row.filename}|${row.checksum}`, row])
  );
  const pending = migrations.filter(migration => !successfulAppliedMap.has(`${migration.file}|${migration.checksum}`));
  const failures = classifyMigrationFailures(migrations, appliedRows);

  return {
    trackingTable,
    migrationsDir,
    totalFilesystemMigrations: migrations.length,
    appliedCount: appliedRows.filter(row => Number(row.success) === 1).length,
    failureCount: failures.unresolved.length,
    failures: failures.unresolved,
    historicalFailureCount: failures.historical.length,
    historicalFailures: failures.historical,
    pendingCount: pending.length,
    applied: appliedRows,
    pending,
  };
}

function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map(statement => statement.trim())
    .filter(Boolean);
}

function isSkippableStatementError(error) {
  const message = error && error.message ? error.message : '';
  const code = error && error.code ? error.code : '';

  if (/Duplicate column name/i.test(message)) {
    return { skippable: true, reason: 'duplicate column' };
  }
  if (/Duplicate key name/i.test(message)) {
    return { skippable: true, reason: 'duplicate index' };
  }
  if (/ER_NO_SUCH_TABLE/.test(code) || /ER_NO_SUCH_TABLE/.test(message)) {
    return { skippable: true, reason: 'missing table' };
  }

  return { skippable: false, reason: null };
}

async function applyPendingSharedSchemaMigrations(pool, options = {}) {
  const logger = options.logger || console;
  const plan = await planPendingSharedSchemaMigrations(pool, options);

  if (!plan.pending.length) {
    return {
      ...plan,
      attempted: [],
      haltedOnFailure: false,
    };
  }

  const attempted = [];
  let haltedOnFailure = false;

  for (const migration of plan.pending) {
    const start = Date.now();
    let success = 0;
    let errorSnippet = null;
    const connection = await pool.getConnection();

    try {
      const statements = splitStatements(migration.content);
      await connection.beginTransaction();
      for (const statement of statements) {
        try {
          await connection.query(statement);
        } catch (inner) {
          const classification = isSkippableStatementError(inner);
          if (classification.skippable) {
            logger.warn(`[migrations] Skipping ${classification.reason} statement in ${migration.file}`);
            continue;
          }
          throw inner;
        }
      }
      await connection.commit();
      success = 1;
      logger.log(`[migrations] Applied ${migration.file}`);
    } catch (error) {
      errorSnippet = (error && error.message ? error.message : String(error)).slice(0, 500);
      try {
        await connection.rollback();
      } catch (_) {
        // Ignore rollback errors after a failed statement.
      }
      logger.error(`[migrations] FAILED ${migration.file}: ${errorSnippet}`);
    } finally {
      connection.release();
    }

    const duration = Date.now() - start;
    await pool.query(
      `INSERT INTO ${plan.trackingTable} (filename, checksum, duration_ms, success, error_snippet)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         applied_at = CURRENT_TIMESTAMP,
         duration_ms = VALUES(duration_ms),
         success = VALUES(success),
         error_snippet = VALUES(error_snippet)`,
      [migration.file, migration.checksum, duration, success, errorSnippet]
    );

    attempted.push({
      file: migration.file,
      checksum: migration.checksum,
      durationMs: duration,
      success: Boolean(success),
      errorSnippet,
    });

    if (!success) {
      haltedOnFailure = true;
      logger.error('[migrations] Halting further migrations due to failure');
      break;
    }
  }

  return assertMigrationApplySucceeded({
    ...plan,
    attempted,
    haltedOnFailure,
  });
}

async function runStartupSharedSchemaMigrations(pool, options = {}) {
  const logger = options.logger || console;

  if (toBoolean(process.env.DISABLE_AUTO_MIGRATIONS, false)) {
    logger.log('[migrations] Auto migration runner disabled via DISABLE_AUTO_MIGRATIONS');
    return {
      skipped: true,
      reason: 'disabled',
    };
  }

  if (!fs.existsSync(CANONICAL_MIGRATIONS_DIR)) {
    logger.log('[migrations] No canonical migrations directory present, skipping');
    return {
      skipped: true,
      reason: 'missing-canonical-dir',
    };
  }

  const dryRun = toBoolean(process.env.AUTO_MIGRATIONS_DRY_RUN, false);
  const plan = await planPendingSharedSchemaMigrations(pool, options);

  if (!plan.pending.length) {
    logger.log('[migrations] No pending migrations');
    return {
      skipped: false,
      dryRun,
      ...plan,
      attempted: [],
      haltedOnFailure: false,
    };
  }

  if (dryRun) {
    logger.log('[migrations] DRY RUN pending migrations:', plan.pending.map(item => item.file));
    return {
      skipped: false,
      dryRun: true,
      ...plan,
      attempted: [],
      haltedOnFailure: false,
    };
  }

  logger.log(
    '[migrations] Applying',
    plan.pending.length,
    'migration(s) from',
    plan.migrationsDir + ':',
    plan.pending.map(item => item.file).join(', ')
  );
  return applyPendingSharedSchemaMigrations(pool, options);
}

module.exports = {
  DEFAULT_TRACKING_TABLE,
  CANONICAL_MIGRATIONS_DIR,
  OPS_SQL_DIR,
  LEGACY_ARCHIVE_DIR,
  RETIRED_PORTAL_MIGRATIONS_DIR,
  MigrationChecksumDriftError,
  SchemaMigrationApplyError,
  assertNoMigrationChecksumDrift,
  assertMigrationApplySucceeded,
  classifyMigrationFailures,
  ensureTrackingTable,
  fetchAppliedMigrationRows,
  getSharedSchemaInventory,
  getCanonicalMigrationFiles,
  splitStatements,
  isSkippableStatementError,
  planPendingSharedSchemaMigrations,
  applyPendingSharedSchemaMigrations,
  runStartupSharedSchemaMigrations,
};
