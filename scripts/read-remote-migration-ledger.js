#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');
const mysql = require('mysql2/promise');
const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');
const {
  DEFAULT_TRACKING_TABLE,
  buildAppliedMigrationRowsSql,
} = require('../src/lib/sharedSchemaMigrationRunner');
const {
  ENVIRONMENT_CONTRACTS,
  EXPECTED_AWS_ACCOUNT_IDS,
} = require('./lib/typed-lineage-migration-executor');

const READER_ID = 'bounded-remote-migration-ledger-v1';
const RESULT_MARKER = 'PATH_REMOTE_MIGRATION_LEDGER_RESULT=';
const REMOTE_ENV_FILE = '/opt/nwac/admin-dashboard/.env';
const ENVIRONMENT_REGIONS = Object.freeze({
  test: 'ca-central-1',
  prod: 'ca-central-1',
});

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function parseArgs(argv) {
  const args = {
    targetEnv: null,
    envFile: null,
    expectedAwsAccountId: null,
    expectedSsmInstanceId: null,
    runToken: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (![
      '--target-env',
      '--env-file',
      '--expected-aws-account-id',
      '--expected-ssm-instance-id',
      '--run-token',
    ].includes(token)) {
      throw new Error(`Unknown argument: ${token}`);
    }
    if (index + 1 >= argv.length) throw new Error(`${token} requires a value`);
    const value = argv[++index];
    if (token === '--target-env') args.targetEnv = String(value).toLowerCase();
    if (token === '--env-file') args.envFile = value;
    if (token === '--expected-aws-account-id') args.expectedAwsAccountId = value;
    if (token === '--expected-ssm-instance-id') args.expectedSsmInstanceId = value;
    if (token === '--run-token') args.runToken = value;
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/read-remote-migration-ledger.js --target-env <test|prod> --env-file <path> [options]',
    '',
    'This read-only candidate-bundled helper proves its exact EC2 and database target,',
    'preflights the optional canonical migration ledger through the live schema guard,',
    'and emits one compressed base64 result marker.',
  ].join('\n');
}

function validateArgs(args, { expectedEnvFile = REMOTE_ENV_FILE } = {}) {
  if (!args.targetEnv || !args.envFile) throw new Error(usage());
  if (!['test', 'prod'].includes(args.targetEnv)) {
    fail('remote_migration_ledger_target_invalid');
  }
  if (path.resolve(args.envFile) !== path.resolve(expectedEnvFile)) {
    fail('remote_migration_ledger_env_file_mismatch');
  }
  if (String(args.expectedAwsAccountId || '') !== EXPECTED_AWS_ACCOUNT_IDS[args.targetEnv]) {
    fail('remote_migration_ledger_expected_account_mismatch');
  }
  if (!/^i-[a-f0-9]{8,17}$/u.test(String(args.expectedSsmInstanceId || ''))) {
    fail('remote_migration_ledger_expected_instance_invalid');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(String(args.runToken || ''))) {
    fail('remote_migration_ledger_run_token_invalid');
  }
  return args;
}

function unquote(value) {
  const trimmed = String(value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readDbConfig(envFile, { fsModule = fs } = {}) {
  const absolutePath = path.resolve(envFile);
  if (!fsModule.existsSync(absolutePath)) fail('remote_migration_ledger_env_file_missing');
  const values = {};
  for (const rawLine of fsModule.readFileSync(absolutePath, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice(7) : line;
    const separator = normalized.indexOf('=');
    if (separator < 1) continue;
    values[normalized.slice(0, separator).trim()] = unquote(normalized.slice(separator + 1));
  }
  const config = {
    host: String(values.DB_HOST || '').trim(),
    port: Number(values.DB_PORT || 3306),
    user: String(values.DB_USER || '').trim(),
    password: String(values.DB_PASS || ''),
    database: String(values.DB_NAME || '').trim(),
  };
  if (
    !config.host ||
    !config.user ||
    !config.password ||
    !config.database ||
    !Number.isInteger(config.port) ||
    config.port < 1
  ) {
    fail('remote_migration_ledger_database_config_incomplete');
  }
  return config;
}

function comparableConfiguredIdentity(config) {
  return {
    host: String(config?.host || '').trim(),
    port: Number(config?.port),
    user: String(config?.user || '').trim(),
    database: String(config?.database || '').trim(),
  };
}

function assertExactObject(actual, expected, code) {
  for (const [key, expectedValue] of Object.entries(expected || {})) {
    if (actual?.[key] !== expectedValue) {
      fail(code, `${code}:${key}:${String(actual?.[key])}:${String(expectedValue)}`);
    }
  }
}

function imdsRequest({ method, requestPath, headers = {}, timeoutMs = 2000, httpModule = http }) {
  return new Promise((resolve, reject) => {
    const request = httpModule.request({
      host: '169.254.169.254',
      port: 80,
      method,
      path: requestPath,
      headers,
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
          reject(new Error(`EC2 instance identity metadata returned HTTP ${response.statusCode || 0}`));
          return;
        }
        resolve(body);
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('EC2 instance identity metadata timed out')));
    request.on('error', reject);
    request.end();
  });
}

function createEc2InstanceIdentityProvider({ requestImpl = imdsRequest } = {}) {
  return async () => {
    const token = String(await requestImpl({
      method: 'PUT',
      requestPath: '/latest/api/token',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '60' },
    }) || '').trim();
    if (!token) fail('remote_migration_ledger_imds_token_empty');
    const documentText = await requestImpl({
      method: 'GET',
      requestPath: '/latest/dynamic/instance-identity/document',
      headers: { 'X-aws-ec2-metadata-token': token },
    });
    let document;
    try {
      document = JSON.parse(documentText);
    } catch (_error) {
      fail('remote_migration_ledger_imds_document_invalid');
    }
    const identity = {
      Account: String(document?.accountId || '').trim(),
      InstanceId: String(document?.instanceId || '').trim(),
      Region: String(document?.region || '').trim(),
    };
    if (!identity.Account || !identity.InstanceId || !identity.Region) {
      fail('remote_migration_ledger_imds_document_incomplete');
    }
    return identity;
  };
}

function jsonSafeClone(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') return item.toString();
    if (item instanceof Date) return item.toISOString();
    return item;
  }));
}

function assertLedgerSelectShape(sql) {
  if (/\bAS\b/iu.test(sql) || /\b[A-Za-z_][A-Za-z0-9_]*\s*\(/u.test(sql)) {
    fail('remote_migration_ledger_select_shape_invalid');
  }
  return sql;
}

async function readRemoteMigrationLedger(args, {
  expectedEnvFile = REMOTE_ENV_FILE,
  readDbConfigImpl = readDbConfig,
  instanceIdentityProvider = createEc2InstanceIdentityProvider(),
  createConnection = mysql.createConnection,
  createSchemaGuard = createLiveMysqlSchemaGuard,
} = {}) {
  validateArgs(args, { expectedEnvFile });
  const contract = ENVIRONMENT_CONTRACTS[args.targetEnv];
  const dbConfig = readDbConfigImpl(args.envFile);
  const configuredIdentity = comparableConfiguredIdentity(dbConfig);
  assertExactObject(
    configuredIdentity,
    contract.configured,
    'remote_migration_ledger_configured_identity_mismatch'
  );

  const awsIdentity = await instanceIdentityProvider();
  assertExactObject(awsIdentity, {
    Account: args.expectedAwsAccountId,
    InstanceId: args.expectedSsmInstanceId,
    Region: ENVIRONMENT_REGIONS[args.targetEnv],
  }, 'remote_migration_ledger_instance_identity_mismatch');

  const connection = await createConnection({
    ...dbConfig,
    charset: 'utf8mb4_unicode_ci',
    multipleStatements: false,
  });
  try {
    const guard = createSchemaGuard({
      connection,
      expectedIdentity: {
        database: contract.live.database,
        configuredHost: contract.configured.host,
        configuredUser: contract.configured.user,
        serverHostname: contract.live.host,
        port: contract.live.port,
        currentUser: contract.live.currentUser,
        version: contract.live.version,
      },
      configuredIdentity,
      requiredObjects: [],
      optionalObjects: [{ name: DEFAULT_TRACKING_TABLE, type: 'table' }],
      allowedFunctions: [],
    });
    await guard.preflight();
    const trackingTableExists = guard.objectExists(DEFAULT_TRACKING_TABLE, 'table');
    const ledgerSql = assertLedgerSelectShape(buildAppliedMigrationRowsSql(DEFAULT_TRACKING_TABLE));
    const rows = trackingTableExists
      ? ((await guard.execute(ledgerSql, []))[0] || [])
      : [];
    const guardEvidence = guard.evidence();
    return jsonSafeClone({
      schemaVersion: 1,
      reader: READER_ID,
      decision: 'COMPLETE',
      targetEnv: args.targetEnv,
      awsIdentity,
      executionContext: {
        runToken: args.runToken,
        envFile: path.resolve(args.envFile),
      },
      configuredDatabase: configuredIdentity,
      trackingTable: DEFAULT_TRACKING_TABLE,
      trackingTableExists,
      ledgerSelectSha256: crypto.createHash('sha256').update(ledgerSql).digest('hex'),
      rows,
      guardEvidence,
      failure: null,
    });
  } finally {
    await connection.end();
  }
}

function encodeResultMarker(result) {
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(jsonSafeClone(result)), 'utf8'));
  return `${RESULT_MARKER}${compressed.toString('base64')}`;
}

async function main() {
  let args = null;
  let result;
  try {
    args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }
    result = await readRemoteMigrationLedger(args);
  } catch (error) {
    result = {
      schemaVersion: 1,
      reader: READER_ID,
      decision: 'FAILED',
      targetEnv: args?.targetEnv || null,
      executionContext: {
        runToken: args?.runToken || null,
        envFile: args?.envFile ? path.resolve(args.envFile) : null,
      },
      failure: {
        code: String(error?.code || 'remote_migration_ledger_reader_failed'),
        message: String(error?.message || error).slice(0, 500),
      },
    };
    process.exitCode = 1;
  }
  console.log(encodeResultMarker(result));
}

if (require.main === module) {
  main();
}

module.exports = {
  ENVIRONMENT_REGIONS,
  READER_ID,
  REMOTE_ENV_FILE,
  RESULT_MARKER,
  assertLedgerSelectShape,
  createEc2InstanceIdentityProvider,
  encodeResultMarker,
  parseArgs,
  readDbConfig,
  readRemoteMigrationLedger,
  validateArgs,
};
