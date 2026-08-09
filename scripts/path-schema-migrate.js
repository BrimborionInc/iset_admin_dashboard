#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');
const {
  DEFAULT_TRACKING_TABLE,
  getSharedSchemaInventory,
  getCanonicalMigrationFiles,
  planPendingSharedSchemaMigrations,
  applyPendingSharedSchemaMigrations,
  assertMigrationApplySucceeded,
  assertNoMigrationChecksumDrift,
  classifyMigrationFailures,
} = require('../src/lib/sharedSchemaMigrationRunner');

const REPO_ROOT = path.resolve(__dirname, '..');
// Revalidated against local DEV metadata on 2026-08-09. Drift is a hard stop:
// update this contract only from a fresh identity-only metadata probe.
const VERIFIED_DEV_SCHEMA_IDENTITY = Object.freeze({
  database: 'iset_intake',
  configuredHost: '172.26.176.1',
  configuredUser: 'root',
  serverHostname: 'DESKTOP-PDFA51K',
  port: 3306,
  currentUser: 'root@172.26.%',
  version: '8.0.40',
});
const REMOTE_TARGETS = {
  test: {
    targetEnv: 'test',
    defaultProfile: 'nwac-test',
    defaultRegion: 'ca-central-1',
    helperScript: path.join(REPO_ROOT, 'scripts', 'run-test-sql-via-ssm.sh'),
  },
  prod: {
    targetEnv: 'prod',
    defaultProfile: 'nwac-prod',
    defaultRegion: 'ca-central-1',
    helperScript: path.join(REPO_ROOT, 'scripts', 'run-prod-sql-via-ssm.sh'),
  },
};

function toBashPath(filePath) {
  if (!filePath) {
    return filePath;
  }
  if (filePath.startsWith('/')) {
    return filePath;
  }
  if (/^[A-Za-z]:\\/.test(filePath)) {
    const drive = filePath[0].toLowerCase();
    const rest = filePath.slice(2).replace(/\\/g, '/').replace(/^\/+/, '');
    return `/mnt/${drive}/${rest}`;
  }
  return filePath.replace(/\\/g, '/');
}

function printUsage() {
  console.log([
    'Usage: node scripts/path-schema-migrate.js <inventory|plan|apply> [options]',
    '',
    'Commands:',
    '  inventory   Show canonical/legacy/ops SQL directories and file counts',
    '  plan        Show pending canonical migrations for dev, test, or prod',
    '  apply       Apply pending canonical migrations for dev, test, or prod',
    '',
    'Flags:',
    '  --target-env NAME  Target environment: dev, test, or prod. Default: dev',
    '  --env-file PATH    Load DB_* values from a specific env file for dev mode',
    '  --profile NAME     AWS profile override for test/prod',
    '  --region REGION    AWS region override for test/prod. Default: ca-central-1',
    '  --json             Emit machine-readable JSON instead of human-readable logs',
    '  --yes              Required for prod apply',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = {
    command: null,
    targetEnv: 'dev',
    envFile: null,
    profile: null,
    region: null,
    json: false,
    yes: false,
  };

  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--yes') {
      args.yes = true;
      continue;
    }
    if (token === '--env-file') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--env-file requires a path');
      }
      args.envFile = argv[index];
      continue;
    }
    if (token === '--target-env') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--target-env requires a value');
      }
      args.targetEnv = String(argv[index]).toLowerCase();
      continue;
    }
    if (token === '--profile') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--profile requires a value');
      }
      args.profile = argv[index];
      continue;
    }
    if (token === '--region') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--region requires a value');
      }
      args.region = argv[index];
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.command = 'help';
      continue;
    }
    positional.push(token);
  }

  if (!args.command && positional.length) {
    args.command = positional[0];
  }

  return args;
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(envFilePath) {
  const absolutePath = path.isAbsolute(envFilePath)
    ? envFilePath
    : path.resolve(REPO_ROOT, envFilePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Env file not found: ${absolutePath}`);
  }

  const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const normalized = line.startsWith('export ') ? line.slice(7) : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(normalized.slice(separatorIndex + 1));
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return absolutePath;
}

function loadDefaultEnvIfPresent() {
  const defaultEnvPath = path.join(REPO_ROOT, '.env');
  if (fs.existsSync(defaultEnvPath)) {
    loadEnvFile(defaultEnvPath);
    return defaultEnvPath;
  }
  return null;
}

function isRemoteTarget(targetEnv) {
  return targetEnv === 'test' || targetEnv === 'prod';
}

function getRemoteTargetConfig(args) {
  const base = REMOTE_TARGETS[args.targetEnv];
  if (!base) {
    throw new Error(`Unsupported remote target environment: ${args.targetEnv}`);
  }
  return {
    ...base,
    profile: args.profile || base.defaultProfile,
    region: args.region || base.defaultRegion,
  };
}

function getDbConfig() {
  const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: 'utf8mb4_unicode_ci',
    multipleStatements: false,
  };

  if (!config.host || !config.user || !config.database) {
    throw new Error('DB_HOST, DB_USER, and DB_NAME must be set before running plan/apply');
  }

  return config;
}

function createDevSchemaPlanGuard(connection, dbConfig, {
  trackingTable = DEFAULT_TRACKING_TABLE,
} = {}) {
  return createLiveMysqlSchemaGuard({
    connection,
    expectedIdentity: VERIFIED_DEV_SCHEMA_IDENTITY,
    configuredIdentity: {
      host: dbConfig.host,
      user: dbConfig.user,
      database: dbConfig.database,
      port: dbConfig.port,
    },
    requiredObjects: [],
    optionalObjects: [{ name: trackingTable, type: 'table' }],
    allowedFunctions: [],
  });
}

function buildEnsureTrackingTableSql(trackingTable) {
  return `CREATE TABLE IF NOT EXISTS ${trackingTable} (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    checksum CHAR(64) NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_ms INT NOT NULL,
    success TINYINT(1) NOT NULL DEFAULT 1,
    error_snippet TEXT NULL,
    UNIQUE KEY uniq_filename_checksum (filename, checksum)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
}

function sqlStringLiteral(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function runRemoteSql(remoteConfig, sqlText) {
  const tempPath = path.join(
    os.tmpdir(),
    `path-schema-migrate-${remoteConfig.targetEnv}-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`
  );
  fs.writeFileSync(tempPath, sqlText, 'utf8');

  const args = [
    toBashPath(remoteConfig.helperScript),
    '--sql-file',
    toBashPath(tempPath),
    '--profile',
    remoteConfig.profile,
    '--region',
    remoteConfig.region,
  ];

  const result = spawnSync('bash', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  fs.rmSync(tempPath, { force: true });

  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `bash ${args.join(' ')} failed`).trim();
    throw new Error(message);
  }

  return {
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function parseTsvTable(output) {
  const lines = String(output || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index] : '';
    });
    return row;
  });
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function toBooleanFromSql(value) {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return Number(value) === 1 || String(value).toLowerCase() === 'true';
}

function summarizePendingMigrations(pending) {
  return (pending || []).map(item => ({
    file: item.file,
    checksum: item.checksum,
    fullPath: item.fullPath,
  }));
}

function summarizePlanForJson(plan) {
  return {
    trackingTable: plan.trackingTable,
    trackingTableExists: plan.trackingTableExists,
    migrationsDir: plan.migrationsDir,
    targetEnv: plan.targetEnv || 'dev',
    profile: plan.profile || null,
    region: plan.region || null,
    totalFilesystemMigrations: plan.totalFilesystemMigrations,
    appliedCount: plan.appliedCount,
    failureCount: plan.failureCount,
    failures: plan.failures || [],
    historicalFailureCount: plan.historicalFailureCount || 0,
    historicalFailures: plan.historicalFailures || [],
    pendingCount: plan.pendingCount,
    applied: plan.applied,
    pending: summarizePendingMigrations(plan.pending),
    schemaEvidence: plan.schemaEvidence || null,
  };
}

function summarizeApplyForJson(result) {
  return {
    ...summarizePlanForJson(result),
    attempted: result.attempted,
    haltedOnFailure: result.haltedOnFailure,
  };
}

function createQuietLogger() {
  return {
    log() {},
    warn() {},
    error() {},
  };
}

function printInventory(inventory) {
  console.log(`Tracking table: ${inventory.trackingTable}`);
  console.log(`Canonical migrations: ${inventory.canonical.count} file(s) in ${inventory.canonical.dir}`);
  inventory.canonical.files.forEach(file => console.log(`  - ${file}`));
  console.log(`Ops-only SQL: ${inventory.ops.count} file(s) in ${inventory.ops.dir}`);
  inventory.ops.files.forEach(file => console.log(`  - ${file}`));
  console.log(`Legacy archive: ${inventory.legacyArchive.count} file(s) in ${inventory.legacyArchive.dir}`);
  inventory.legacyArchive.files.forEach(file => console.log(`  - ${file}`));
  console.log(`Retired portal path: ${inventory.retiredPortal.count} file(s) in ${inventory.retiredPortal.dir}`);
  inventory.retiredPortal.files.forEach(file => console.log(`  - ${file}`));
}

function printPlan(plan) {
  console.log(`Tracking table: ${plan.trackingTable}`);
  console.log(`Tracking table exists: ${plan.trackingTableExists ? 'yes' : 'no'}`);
  if (plan.targetEnv && plan.targetEnv !== 'dev') {
    console.log(`Target env: ${plan.targetEnv}`);
    console.log(`Profile: ${plan.profile}`);
    console.log(`Region: ${plan.region}`);
  }
  console.log(`Canonical dir: ${plan.migrationsDir}`);
  console.log(`Pending migrations: ${plan.pendingCount}`);
  if (plan.pending.length) {
    plan.pending.forEach(item => console.log(`  - ${item.file}`));
  }
}

function printApply(result) {
  printPlan(result);
  if (!result.attempted.length) {
    console.log('No migrations were applied.');
    return;
  }
  result.attempted.forEach(item => {
    const status = item.success ? 'applied' : 'failed';
    const detail = item.errorSnippet ? ` (${item.errorSnippet})` : '';
    console.log(`  - ${item.file}: ${status} in ${item.durationMs}ms${detail}`);
  });
}

async function openPool(dbConfig) {
  return mysql.createPool(dbConfig);
}

function remoteQueryRows(remoteConfig, sqlText) {
  const { stdout } = runRemoteSql(remoteConfig, sqlText);
  return parseTsvTable(stdout);
}

function remoteTrackingTableExists(remoteConfig, trackingTable) {
  const rows = remoteQueryRows(
    remoteConfig,
    [
      'SELECT COUNT(*) AS table_count',
      '  FROM information_schema.tables',
      ' WHERE table_schema = DATABASE()',
      `   AND table_name = ${sqlStringLiteral(trackingTable)};`,
    ].join('\n')
  );
  return Number(rows[0] && rows[0].table_count) > 0;
}

function fetchRemoteAppliedMigrationRows(remoteConfig, { trackingTable = DEFAULT_TRACKING_TABLE } = {}) {
  const trackingTableExists = remoteTrackingTableExists(remoteConfig, trackingTable);
  if (!trackingTableExists) {
    return {
      trackingTableExists: false,
      rows: [],
    };
  }

  const rows = remoteQueryRows(
    remoteConfig,
    [
      'SELECT filename, checksum, success, applied_at, duration_ms, COALESCE(error_snippet, \'\') AS error_snippet',
      `  FROM ${trackingTable}`,
      ' ORDER BY applied_at ASC, id ASC;',
    ].join('\n')
  ).map(row => ({
    filename: row.filename,
    checksum: row.checksum,
    success: toBooleanFromSql(row.success) ? 1 : 0,
    applied_at: row.applied_at || null,
    duration_ms: toNumberOrNull(row.duration_ms),
    error_snippet: row.error_snippet || null,
  }));

  return {
    trackingTableExists: true,
    rows,
  };
}

function planPendingRemoteSharedSchemaMigrations(remoteConfig, options = {}) {
  const trackingTable = options.trackingTable || DEFAULT_TRACKING_TABLE;
  const migrations = getCanonicalMigrationFiles({ migrationsDir: options.migrationsDir });
  const { trackingTableExists, rows: appliedRows } = fetchRemoteAppliedMigrationRows(remoteConfig, { trackingTable });
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
    trackingTableExists,
    migrationsDir: options.migrationsDir || path.join(REPO_ROOT, 'sql', 'migrations'),
    targetEnv: remoteConfig.targetEnv,
    profile: remoteConfig.profile,
    region: remoteConfig.region,
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

function ensureRemoteTrackingTable(remoteConfig, trackingTable) {
  runRemoteSql(remoteConfig, buildEnsureTrackingTableSql(trackingTable));
}

function insertRemoteTrackingRow(remoteConfig, trackingTable, payload) {
  const sql = [
    `INSERT INTO ${trackingTable} (filename, checksum, duration_ms, success, error_snippet)`,
    'VALUES (',
    `  ${sqlStringLiteral(payload.filename)},`,
    `  ${sqlStringLiteral(payload.checksum)},`,
    `  ${payload.durationMs},`,
    `  ${payload.success ? 1 : 0},`,
    `  ${payload.errorSnippet ? sqlStringLiteral(payload.errorSnippet) : 'NULL'}`,
    ')',
    'ON DUPLICATE KEY UPDATE',
    '  applied_at = CURRENT_TIMESTAMP,',
    '  duration_ms = VALUES(duration_ms),',
    '  success = VALUES(success),',
    '  error_snippet = VALUES(error_snippet);',
  ].join('\n');
  runRemoteSql(remoteConfig, sql);
}

function applyPendingRemoteSharedSchemaMigrations(remoteConfig, options = {}) {
  const logger = options.logger || console;
  const trackingTable = options.trackingTable || DEFAULT_TRACKING_TABLE;

  ensureRemoteTrackingTable(remoteConfig, trackingTable);
  const plan = planPendingRemoteSharedSchemaMigrations(remoteConfig, options);

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
    const startedAt = Date.now();
    let success = false;
    let errorSnippet = null;

    try {
      runRemoteSql(remoteConfig, migration.content);
      success = true;
      logger.log(`[migrations] Applied ${migration.file} to ${remoteConfig.targetEnv}`);
    } catch (error) {
      errorSnippet = (error && error.message ? error.message : String(error)).slice(0, 500);
      logger.error(`[migrations] FAILED ${migration.file} on ${remoteConfig.targetEnv}: ${errorSnippet}`);
    }

    const durationMs = Date.now() - startedAt;
    insertRemoteTrackingRow(remoteConfig, trackingTable, {
      filename: migration.file,
      checksum: migration.checksum,
      durationMs,
      success,
      errorSnippet,
    });

    attempted.push({
      file: migration.file,
      checksum: migration.checksum,
      durationMs,
      success,
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
    trackingTableExists: true,
    attempted,
    haltedOnFailure,
  }, { context: `Schema migration apply on ${remoteConfig.targetEnv}` });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.command === 'help') {
    printUsage();
    return;
  }

  if (args.command === 'inventory') {
    const payload = {
      command: 'inventory',
      loadedEnvFile: null,
      trackingTable: DEFAULT_TRACKING_TABLE,
      ...getSharedSchemaInventory(),
    };
    if (args.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    printInventory(payload);
    return;
  }

  if (args.command !== 'plan' && args.command !== 'apply') {
    throw new Error(`Unknown command: ${args.command}`);
  }

  if (args.targetEnv === 'prod' && args.command === 'apply' && !args.yes) {
    throw new Error('Prod apply requires --yes');
  }

  if (isRemoteTarget(args.targetEnv)) {
    const remoteConfig = getRemoteTargetConfig(args);
    const logger = args.json ? createQuietLogger() : console;
    if (args.command === 'plan') {
      const plan = planPendingRemoteSharedSchemaMigrations(remoteConfig);
      const payload = {
        command: 'plan',
        loadedEnvFile: null,
        inventory: getSharedSchemaInventory(),
        ...summarizePlanForJson(plan),
      };
      if (args.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }
      printPlan(plan);
      return;
    }

    const result = applyPendingRemoteSharedSchemaMigrations(remoteConfig, { logger });
    const payload = {
      command: 'apply',
      loadedEnvFile: null,
      inventory: getSharedSchemaInventory(),
      ...summarizeApplyForJson(result),
    };
    if (args.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    printApply(result);
    return;
  }

  if (args.targetEnv !== 'dev') {
    throw new Error(`Unsupported target environment: ${args.targetEnv}`);
  }

  let loadedEnvFile = null;
  if (args.envFile) {
    loadedEnvFile = loadEnvFile(args.envFile);
  } else {
    loadedEnvFile = loadDefaultEnvIfPresent();
  }

  const dbConfig = getDbConfig();
  const pool = await openPool(dbConfig);
  try {
    const inventory = getSharedSchemaInventory();
    const logger = args.json ? createQuietLogger() : console;
    if (args.command === 'plan') {
      const schemaGuard = createDevSchemaPlanGuard(pool, dbConfig);
      const plan = await planPendingSharedSchemaMigrations(pool, { schemaGuard });
      const payload = {
        command: 'plan',
        loadedEnvFile,
        inventory,
        ...summarizePlanForJson(plan),
      };
      if (args.json) {
        console.log(JSON.stringify(payload, null, 2));
        return;
      }
      if (loadedEnvFile) {
        console.log(`Loaded env file: ${loadedEnvFile}`);
      }
      printPlan(plan);
      return;
    }

    const result = await applyPendingSharedSchemaMigrations(pool, { logger });
    const payload = {
      command: 'apply',
      loadedEnvFile,
      inventory,
      ...summarizeApplyForJson(result),
    };
    if (args.json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    if (loadedEnvFile) {
      console.log(`Loaded env file: ${loadedEnvFile}`);
    }
    printApply(result);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[path-schema-migrate] ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  VERIFIED_DEV_SCHEMA_IDENTITY,
  createDevSchemaPlanGuard,
  planPendingRemoteSharedSchemaMigrations,
};
