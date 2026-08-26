#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const mysql = require('mysql2/promise');
const {
  ENVIRONMENT_CONTRACTS,
  EXPECTED_AWS_ACCOUNT_IDS,
  MIGRATION_FILENAME,
  executeSecureMessageIdempotencyMigration,
} = require('./lib/secure-message-idempotency-migration-executor');

const REPO_ROOT = path.resolve(__dirname, '..');

function usage() {
  return [
    'Usage: node scripts/apply-20260825-secure-message-idempotency.js --target-env <dev|test|prod> --env-file <path> --yes [options]',
    '',
    'This executor is checksum-pinned to one migration and one CREATE TABLE literal.',
    'It proves the exact live database identity, messages reference, migration ledger,',
    'and final operation-table shape before recording the canonical checksum.',
    '',
    'Options:',
    '  --target-env <dev|test|prod>         Required explicit target.',
    '  --env-file <path>                    Required file containing DB_* configuration.',
    `  --expected-aws-account-id <id>       Remote only; TEST=${EXPECTED_AWS_ACCOUNT_IDS.test}, PROD=${EXPECTED_AWS_ACCOUNT_IDS.prod}.`,
    '  --expected-ssm-instance-id <id>      Remote only; exact outer-control SSM target.',
    '  --run-token <token>                  Remote only; nonempty outer command/run nonce.',
    '  --evidence-out <path>                JSON evidence output path.',
    '  --compact-output                     Emit a bounded result summary.',
    '  --yes                                Required mutation acknowledgement.',
  ].join('\n');
}

function parseArgs(argv) {
  const result = {
    targetEnv: null,
    envFile: null,
    expectedAwsAccountId: null,
    expectedSsmInstanceId: null,
    runToken: null,
    evidenceOut: null,
    compactOutput: false,
    yes: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--yes') result.yes = true;
    else if (token === '--compact-output') result.compactOutput = true;
    else if (token === '--help' || token === '-h') result.help = true;
    else if ([
      '--target-env',
      '--env-file',
      '--expected-aws-account-id',
      '--expected-ssm-instance-id',
      '--run-token',
      '--evidence-out',
    ].includes(token)) {
      if (index + 1 >= argv.length) throw new Error(`${token} requires a value`);
      const value = argv[++index];
      if (token === '--target-env') result.targetEnv = String(value).toLowerCase();
      if (token === '--env-file') result.envFile = value;
      if (token === '--expected-aws-account-id') result.expectedAwsAccountId = value;
      if (token === '--expected-ssm-instance-id') result.expectedSsmInstanceId = value;
      if (token === '--run-token') result.runToken = value;
      if (token === '--evidence-out') result.evidenceOut = value;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return result;
}

function unquote(value) {
  const trimmed = String(value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) return trimmed.slice(1, -1);
  return trimmed;
}

function readDbConfig(envFile) {
  const absolute = path.resolve(envFile);
  if (!fs.existsSync(absolute)) throw new Error(`Env file not found: ${absolute}`);
  const values = {};
  for (const rawLine of fs.readFileSync(absolute, 'utf8').split(/\r?\n/u)) {
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
    !config.host || !config.user || !config.password || !config.database ||
    !Number.isInteger(config.port)
  ) throw new Error('DB_HOST, DB_PORT, DB_USER, DB_PASS, and DB_NAME must be configured');
  return config;
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
        const status = Number(response.statusCode || 0);
        if (status < 200 || status >= 300) {
          reject(new Error(`EC2 instance identity metadata returned HTTP ${status}`));
          return;
        }
        resolve(body);
      });
    });
    request.setTimeout(timeoutMs, () => (
      request.destroy(new Error('EC2 instance identity metadata timed out'))
    ));
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
    if (!token) throw new Error('EC2 IMDSv2 token was empty');
    const documentText = await requestImpl({
      method: 'GET',
      requestPath: '/latest/dynamic/instance-identity/document',
      headers: { 'X-aws-ec2-metadata-token': token },
    });
    let document;
    try {
      document = JSON.parse(documentText);
    } catch (_) {
      throw new Error('EC2 instance identity document was not valid JSON');
    }
    const identity = {
      Account: String(document?.accountId || '').trim(),
      InstanceId: String(document?.instanceId || '').trim(),
      Region: String(document?.region || '').trim(),
    };
    if (!identity.Account || !identity.InstanceId || !identity.Region) {
      throw new Error('EC2 instance identity document was incomplete');
    }
    return identity;
  };
}

function defaultEvidencePath(targetEnv) {
  const timestamp = new Date().toISOString().replace(/[:.]/gu, '-');
  return path.join(
    REPO_ROOT,
    'tmp',
    'migration-evidence',
    `${targetEnv}-${MIGRATION_FILENAME}-${timestamp}.json`
  );
}

function validateArgs(args) {
  if (!args.targetEnv || !args.envFile) throw new Error(usage());
  if (!ENVIRONMENT_CONTRACTS[args.targetEnv]) {
    throw new Error('--target-env must be dev, test, or prod');
  }
  if (!args.yes) throw new Error('--yes is required because this command applies schema DDL');
  if (args.targetEnv === 'test' || args.targetEnv === 'prod') {
    const label = args.targetEnv.toUpperCase();
    const expectedAccountId = EXPECTED_AWS_ACCOUNT_IDS[args.targetEnv];
    if (String(args.expectedAwsAccountId || '').trim() !== expectedAccountId) {
      throw new Error(`${label} requires --expected-aws-account-id ${expectedAccountId}`);
    }
    if (!/^i-[a-f0-9]{8,17}$/u.test(String(args.expectedSsmInstanceId || '').trim())) {
      throw new Error(`${label} requires a valid --expected-ssm-instance-id`);
    }
    if (!String(args.runToken || '').trim()) {
      throw new Error(`${label} requires a nonempty --run-token`);
    }
  }
  if (
    args.targetEnv === 'dev' &&
    (args.expectedAwsAccountId || args.expectedSsmInstanceId || args.runToken)
  ) throw new Error('Remote execution-context options do not apply to local DEV');
  return args;
}

function summarizeEvidence(evidence, output = {}) {
  return {
    evidencePath: output.evidencePath || null,
    evidenceFallbackUsed: Boolean(output.evidenceFallbackUsed),
    schemaVersion: evidence?.schemaVersion || 1,
    executor: evidence?.executor || '20260825-secure-message-idempotency-bounded',
    targetEnv: evidence?.targetEnv || null,
    decision: evidence?.decision || 'FAILED',
    phase: evidence?.phase || null,
    awsIdentity: evidence?.awsIdentity || null,
    executionContext: evidence?.executionContext || null,
    configuredDatabase: evidence?.configuredDatabase || null,
    migration: evidence?.migration || null,
    metadataStatementCount: Number(evidence?.metadataStatementCount || 0),
    operationCount: Array.isArray(evidence?.operations) ? evidence.operations.length : 0,
    finalIdentity: evidence?.finalProof?.identity || null,
    finalOperationStates: evidence?.finalProof?.operationStates || {},
    ledger: evidence?.ledger || null,
    failure: evidence?.failure || null,
    operationalWarnings: evidence?.operationalWarnings || [],
  };
}

function writeEvidence(filePath, evidence) {
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  const temporary = path.join(
    path.dirname(absolute),
    `.${path.basename(absolute)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, absolute);
  return absolute;
}

function persistEvidenceWithFallback({
  requestedPath,
  evidence,
  writeEvidenceImpl = writeEvidence,
  fallbackDirectory = os.tmpdir(),
}) {
  try {
    return {
      evidence,
      evidencePath: writeEvidenceImpl(requestedPath, evidence),
      usedFallback: false,
      requestedWriteError: null,
    };
  } catch (error) {
    const fallbackEvidence = {
      ...evidence,
      evidenceOutput: {
        status: 'fallback',
        requestedPath: path.resolve(requestedPath),
        requestedWriteError: String(error?.message || error),
      },
    };
    const fallbackPath = path.join(
      fallbackDirectory,
      `secure-message-idempotency-${String(evidence?.decision || 'UNKNOWN').toLowerCase()}-${process.pid}-${Date.now()}.json`
    );
    return {
      evidence: fallbackEvidence,
      evidencePath: writeEvidenceImpl(fallbackPath, fallbackEvidence),
      usedFallback: true,
      requestedWriteError: String(error?.message || error),
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  validateArgs(args);
  const dbConfig = readDbConfig(args.envFile);
  const remote = args.targetEnv === 'test' || args.targetEnv === 'prod';
  const evidencePath = args.evidenceOut || defaultEvidencePath(args.targetEnv);
  let evidence;
  let executionError = null;
  try {
    evidence = await executeSecureMessageIdempotencyMigration({
      targetEnv: args.targetEnv,
      configuredIdentity: dbConfig,
      executionContext: remote ? {
        expectedAwsAccountId: args.expectedAwsAccountId,
        expectedSsmInstanceId: args.expectedSsmInstanceId,
        runToken: args.runToken,
      } : null,
      instanceIdentityProvider: remote ? createEc2InstanceIdentityProvider() : null,
      connectionFactory: () => mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        charset: 'utf8mb4_unicode_ci',
        multipleStatements: false,
      }),
      migrationPath: path.join(REPO_ROOT, 'sql', 'migrations', MIGRATION_FILENAME),
    });
  } catch (error) {
    executionError = error;
    evidence = error.evidence || {
      schemaVersion: 1,
      executor: '20260825-secure-message-idempotency-bounded',
      targetEnv: args.targetEnv,
      decision: 'FAILED',
      failure: {
        code: error.code || 'secure_message_idempotency_cli_failed',
        message: error.message,
      },
    };
  }
  const persisted = persistEvidenceWithFallback({ requestedPath: evidencePath, evidence });
  const fullOutput = {
    evidencePath: persisted.evidencePath,
    evidenceFallbackUsed: persisted.usedFallback,
    ...persisted.evidence,
  };
  const output = JSON.stringify(
    args.compactOutput ? summarizeEvidence(persisted.evidence, fullOutput) : fullOutput,
    null,
    2
  );
  if (executionError || persisted.usedFallback) {
    console.error(output);
    process.exitCode = 1;
  } else {
    console.log(output);
  }
}

if (require.main === module) {
  main().catch(error => {
    const fallback = path.join(
      os.tmpdir(),
      `secure-message-idempotency-cli-failure-${process.pid}.json`
    );
    writeEvidence(fallback, {
      schemaVersion: 1,
      executor: '20260825-secure-message-idempotency-bounded',
      decision: 'FAILED',
      failure: {
        code: error.code || 'secure_message_idempotency_cli_failed',
        message: error.message,
      },
    });
    console.error(`${error.message}\nEvidence: ${fallback}`);
    process.exitCode = 1;
  });
}

module.exports = {
  createEc2InstanceIdentityProvider,
  imdsRequest,
  parseArgs,
  persistEvidenceWithFallback,
  readDbConfig,
  summarizeEvidence,
  validateArgs,
  writeEvidence,
};
