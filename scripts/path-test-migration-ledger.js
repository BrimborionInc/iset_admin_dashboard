#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');
const {
  assertNoMigrationChecksumDrift,
  classifyMigrationFailures,
  getCanonicalMigrationFiles,
} = require('../src/lib/sharedSchemaMigrationRunner');

const EXPECTED_TEST_IDENTITY = Object.freeze({
  database: 'iset_intake',
  configuredHost: 'nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com',
  configuredUser: 'app_admin',
  serverHostname: 'ip-172-16-0-199',
  port: 3306,
  currentUser: 'app_admin@10.48.%',
  version: '8.0.42',
});

const MIGRATION_LEDGER_SQL = `SELECT
  \`im\`.filename,
  \`im\`.checksum,
  \`im\`.success,
  \`im\`.applied_at,
  \`im\`.duration_ms,
  COALESCE(\`im\`.error_snippet, '') AS \`error_snippet\`
FROM iset_migration AS \`im\`
ORDER BY \`im\`.applied_at ASC, \`im\`.id ASC`;

function parseArgs(argv) {
  const args = { envFile: '/opt/nwac/admin-dashboard/.env.test', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--env-file') args.envFile = path.resolve(argv[++index]);
    else if (token === '--json') args.json = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function readEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

function createMigrationLedgerGuard(connection, configuredIdentity) {
  return createLiveMysqlSchemaGuard({
    connection,
    expectedIdentity: EXPECTED_TEST_IDENTITY,
    configuredIdentity,
    optionalObjects: [{ name: 'iset_migration', type: 'table' }],
    allowedOutputAliases: ['error_snippet'],
    allowedTableAliases: ['im'],
  });
}

async function readMigrationLedger({ envFile }) {
  const env = readEnv(envFile);
  const configuredIdentity = {
    host: String(env.DB_HOST || '').trim(),
    port: Number(env.DB_PORT || 3306),
    user: String(env.DB_USER || '').trim(),
    database: String(env.DB_NAME || '').trim(),
  };
  const connection = await mysql.createConnection({
    host: configuredIdentity.host,
    port: configuredIdentity.port,
    user: configuredIdentity.user,
    password: env.DB_PASS || '',
    database: configuredIdentity.database,
    multipleStatements: false,
  });
  try {
    const guard = createMigrationLedgerGuard(connection, configuredIdentity);
    await guard.preflight();
    const trackingTableExists = guard.objectExists('iset_migration', 'table');
    const rows = trackingTableExists
      ? (await guard.execute(MIGRATION_LEDGER_SQL))[0]
      : [];
    return {
      schemaVersion: 1,
      status: 'passed',
      trackingTableExists,
      rows,
      schemaSafety: guard.evidence(),
    };
  } finally {
    await connection.end();
  }
}

function summarizeMigrationLedger(result) {
  const migrations = getCanonicalMigrationFiles();
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  assertNoMigrationChecksumDrift(migrations, rows);
  const successful = new Set(
    rows
      .filter(row => Number(row.success) === 1)
      .map(row => `${row.filename}|${row.checksum}`)
  );
  const pendingCount = migrations.filter(
    migration => !successful.has(`${migration.file}|${migration.checksum}`)
  ).length;
  const failures = classifyMigrationFailures(migrations, rows);
  return {
    schemaVersion: result.schemaVersion,
    status: result.status,
    trackingTableExists: result.trackingTableExists,
    canonicalCount: migrations.length,
    ledgerRowCount: rows.length,
    pendingCount,
    failureCount: failures.unresolved.length,
    historicalFailureCount: failures.historical.length,
    schemaSafety: result.schemaSafety,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await readMigrationLedger(args);
  const summary = summarizeMigrationLedger(result);
  console.log(args.json ? JSON.stringify(summary) : JSON.stringify(summary));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  EXPECTED_TEST_IDENTITY,
  MIGRATION_LEDGER_SQL,
  createMigrationLedgerGuard,
  parseArgs,
  readEnv,
  summarizeMigrationLedger,
};
