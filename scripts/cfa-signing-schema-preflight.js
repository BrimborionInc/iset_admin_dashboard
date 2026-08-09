#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const { createLiveSchemaGuard } = require('./two-step-review-test-smoke');

const REQUIRED_TABLES = Object.freeze([
  'user',
  'client',
  'iset_case',
  'iset_application_submission',
  'iset_application',
  'messages',
  'signing_request',
  'message_signing_request',
  'cfa_series',
  'cfa_version',
  'cfa_version_documents',
  'iset_document',
  'iset_event_entry',
  'workflow',
]);

function parseArgs(argv) {
  const args = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--env-file') args.envFile = path.resolve(argv[++index]);
    else if (token === '--expected-database') args.expectedDatabase = argv[++index];
    else if (token === '--expected-db-host') args.expectedDbHost = argv[++index];
    else if (token === '--expected-db-user') args.expectedDbUser = argv[++index];
    else if (token === '--expected-db-server-hostname') args.expectedDbServerHostname = argv[++index];
    else if (token === '--expected-db-port') args.expectedDbPort = Number(argv[++index]);
    else if (token === '--expected-db-principal') args.expectedDbPrincipal = argv[++index];
    else if (token === '--expected-db-version') args.expectedDbVersion = argv[++index];
    else if (token === '--json') args.json = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  for (const key of [
    'envFile',
    'expectedDatabase',
    'expectedDbHost',
    'expectedDbUser',
    'expectedDbServerHostname',
    'expectedDbPrincipal',
    'expectedDbVersion',
  ]) {
    if (!String(args[key] || '').trim()) throw new Error(`Missing required ${key}`);
  }
  if (!Number.isInteger(args.expectedDbPort) || args.expectedDbPort <= 0) {
    throw new Error('Missing or invalid expectedDbPort');
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = readEnv(args.envFile);
  const configuredPort = Number(env.DB_PORT || 3306);
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: configuredPort,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    multipleStatements: false,
  });
  try {
    const guard = createLiveSchemaGuard({
      connection,
      expectedDatabase: args.expectedDatabase,
      expectedHost: args.expectedDbHost,
      expectedUser: args.expectedDbUser,
      expectedDatabaseHostname: args.expectedDbServerHostname,
      expectedPort: args.expectedDbPort,
      expectedPrincipal: args.expectedDbPrincipal,
      expectedVersion: args.expectedDbVersion,
      configuredDatabase: env.DB_NAME,
      configuredHost: env.DB_HOST,
      configuredUser: env.DB_USER,
      configuredPort,
      requiredTables: REQUIRED_TABLES,
      absentColumns: ['signing_request.application_id'],
      cryptoModule: crypto,
    });
    const evidence = await guard.preflight();
    const result = {
      status: 'PASS',
      identity: evidence.identity,
      ddlHashes: evidence.ddlHashes,
      verifiedStatementCount: evidence.verifiedStatementCount,
    };
    if (args.json) console.log(JSON.stringify(result));
    else console.log(`PASS ${result.identity.database} ${Object.keys(result.ddlHashes).length} tables`);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}

module.exports = { REQUIRED_TABLES, parseArgs, readEnv };
