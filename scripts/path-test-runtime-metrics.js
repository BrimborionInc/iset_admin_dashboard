#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');

const EXPECTED_TEST_IDENTITY = Object.freeze({
  database: 'iset_intake',
  configuredHost: 'nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com',
  configuredUser: 'app_admin',
  serverHostname: 'ip-172-16-0-199',
  port: 3306,
  currentUser: 'app_admin@10.48.%',
  version: '8.0.42',
});

const RUNTIME_METRICS_SQL = `SELECT
  (SELECT COUNT(*) FROM iset_event_delivery AS \`ied\` WHERE \`ied\`.status IN ('pending','processing','sending') AND \`ied\`.updated_at < NOW(3) - INTERVAL 10 MINUTE) AS \`stale_deliveries\`,
  (SELECT COUNT(*) FROM iset_event_delivery AS \`ied\` WHERE \`ied\`.status IN ('dead_letter','ambiguous')) AS \`held_deliveries\`,
  (SELECT COUNT(*) FROM iset_runtime_config AS \`irc\` WHERE \`irc\`.scope='runtime' AND \`irc\`.k='service.announcement' AND JSON_EXTRACT(\`irc\`.v, '$.enabled') = TRUE) AS \`active_announcements\`,
  (SELECT CASE
     WHEN COUNT(*) = 1 AND MAX(JSON_EXTRACT(\`irc\`.v, '$.enabled') = FALSE) = 1 THEN 0
     ELSE 1
   END FROM iset_runtime_config AS \`irc\` WHERE \`irc\`.scope='finance' AND \`irc\`.k='email.routing') AS \`unsafe_finance_routing\`,
  (SELECT COUNT(*) FROM iset_runtime_config AS \`irc\` WHERE \`irc\`.scope='finance' AND \`irc\`.k='intacct.integration' AND (JSON_EXTRACT(\`irc\`.v, '$.enabled') = TRUE OR JSON_UNQUOTE(JSON_EXTRACT(\`irc\`.v, '$.submissionMode')) = 'intacct_rest')) AS \`enabled_intacct\``;

function parseArgs(argv) {
  const args = {
    envFile: '/opt/nwac/admin-dashboard/.env.test',
    json: false,
  };
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function createRuntimeMetricsGuard(connection, configuredIdentity) {
  return createLiveMysqlSchemaGuard({
    connection,
    expectedIdentity: EXPECTED_TEST_IDENTITY,
    configuredIdentity,
    requiredObjects: [
      { name: 'iset_event_delivery', type: 'table' },
      { name: 'iset_runtime_config', type: 'table' },
    ],
    allowedOutputAliases: [
      'stale_deliveries',
      'held_deliveries',
      'active_announcements',
      'unsafe_finance_routing',
      'enabled_intacct',
    ],
    allowedTableAliases: ['ied', 'irc'],
  });
}

async function collectRuntimeMetrics({ envFile }) {
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
    const guard = createRuntimeMetricsGuard(connection, configuredIdentity);
    const preflight = await guard.preflight();
    const [rows] = await guard.execute(RUNTIME_METRICS_SQL);
    const metrics = rows?.[0] || null;
    if (!metrics) throw new Error('TEST runtime metrics query returned no row');
    const normalized = Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, Number(value)])
    );
    if (Object.values(normalized).some(value => !Number.isFinite(value))) {
      throw new Error('TEST runtime metrics query returned a non-numeric value');
    }
    return {
      schemaVersion: 1,
      status: 'passed',
      metrics: normalized,
      schemaSafety: {
        ...preflight,
        ...guard.evidence(),
      },
    };
  } finally {
    await connection.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await collectRuntimeMetrics(args);
  console.log(args.json ? JSON.stringify(result) : JSON.stringify(result.metrics));
}

if (require.main === module) {
  main().catch(error => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  EXPECTED_TEST_IDENTITY,
  RUNTIME_METRICS_SQL,
  createRuntimeMetricsGuard,
  parseArgs,
  readEnv,
};
