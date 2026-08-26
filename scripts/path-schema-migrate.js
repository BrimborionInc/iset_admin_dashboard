#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');
const {
  DEFAULT_TRACKING_TABLE,
  buildAppliedMigrationRowsSql,
  getSharedSchemaInventory,
  getCanonicalMigrationFiles,
  planPendingSharedSchemaMigrations,
  applyPendingSharedSchemaMigrations,
  assertMigrationApplySucceeded,
  assertNoMigrationChecksumDrift,
  classifyMigrationFailures,
} = require('../src/lib/sharedSchemaMigrationRunner');
const {
  ENVIRONMENT_CONTRACTS: TYPED_LINEAGE_ENVIRONMENT_CONTRACTS,
  EXPECTED_AWS_ACCOUNT_IDS,
  MIGRATION_FILENAME: TYPED_LINEAGE_MIGRATION_FILENAME,
  MIGRATION_SHA256: TYPED_LINEAGE_MIGRATION_SHA256,
  OPERATIONS: TYPED_LINEAGE_OPERATIONS,
  verifyMigrationArtifact: verifyTypedLineageMigrationArtifact,
} = require('./lib/typed-lineage-migration-executor');
const {
  ENVIRONMENT_CONTRACTS: SECURE_MESSAGE_IDEMPOTENCY_ENVIRONMENT_CONTRACTS,
  MIGRATION_FILENAME: SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_FILENAME,
  MIGRATION_SHA256: SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_SHA256,
  OPERATIONS: SECURE_MESSAGE_IDEMPOTENCY_OPERATIONS,
  verifyMigrationArtifact: verifySecureMessageIdempotencyMigrationArtifact,
} = require('./lib/secure-message-idempotency-migration-executor');
const {
  READER_ID: REMOTE_LEDGER_READER_ID,
  RESULT_MARKER: REMOTE_LEDGER_RESULT_MARKER,
} = require('./read-remote-migration-ledger');

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
    expectedAccountId: EXPECTED_AWS_ACCOUNT_IDS.test,
    artifactBucket: 'nwac-test-artifacts',
    autoScalingGroupName: 'nwac-test-asg',
    remoteEnvFile: '/opt/nwac/admin-dashboard/.env',
  },
  prod: {
    targetEnv: 'prod',
    defaultProfile: 'nwac-prod',
    defaultRegion: 'ca-central-1',
    expectedAccountId: EXPECTED_AWS_ACCOUNT_IDS.prod,
    artifactBucket: 'nwac-prod-artifacts',
    autoScalingGroupName: 'nwac-prod-asg',
    remoteEnvFile: '/opt/nwac/admin-dashboard/.env',
  },
};

// Executor/reader bundles are temporary and must use the operator's established
// deletable SSM staging scope. Durable reviewed evidence remains under the
// immutable releases scope, whose PROD policy intentionally grants no delete.
const TEMP_REMOTE_STAGING_PREFIX = 'ssm-sql/path-schema-migrate';
const DURABLE_SCHEMA_EVIDENCE_PREFIX = 'releases/schema-evidence';

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

function assertApplyAuthorization(args) {
  if (args.targetEnv === 'prod' && args.command === 'apply' && !args.yes) {
    const error = new Error('Prod apply requires --yes');
    error.code = 'prod_schema_apply_confirmation_required';
    throw error;
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

function sha256File(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function quoteBashArgument(value) {
  return `'${String(value).replace(/'/gu, `'\\''`)}'`;
}

function runAwsCli(remoteConfig, args, { parseJson = false } = {}) {
  const command = [
    "AWS_PAGER=''",
    'AWS_CLI_AUTO_PROMPT=off',
    'aws',
    ...args,
    '--profile',
    remoteConfig.profile,
    '--region',
    remoteConfig.region,
  ].map((value, index) => index < 2 ? value : quoteBashArgument(value)).join(' ');
  const result = spawnSync('bash', ['-lc', command], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const message = String(result.stderr || result.stdout || `AWS command failed with status ${result.status}`).trim();
    throw new Error(message);
  }
  const stdout = String(result.stdout || '').trim();
  if (!parseJson) return stdout;
  try {
    return JSON.parse(stdout || '{}');
  } catch (error) {
    throw new Error(`AWS command returned invalid JSON: ${error.message}`);
  }
}

function redactBoundedCommandOutput(value) {
  return String(value || '')
    .replace(
      /^(PATH_(?:TYPED_LINEAGE|SECURE_MESSAGE_IDEMPOTENCY|REMOTE_MIGRATION_LEDGER)_RESULT=).*$/gmu,
      '$1[REDACTED_STRUCTURED_RESULT_MARKER]'
    )
    .replace(/(X-Amz-(?:Credential|Security-Token|Signature)=)[^&\s]+/giu, '$1[REDACTED]')
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu, '[REDACTED_AWS_ACCESS_KEY]')
    .replace(
      /((?:DB_PASS(?:WORD)?|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/giu,
      '$1[REDACTED]'
    )
    .replace(/(Authorization\s*:\s*Bearer\s+)[^\s]+/giu, '$1[REDACTED]')
    .replace(/("(?:password|secretAccessKey|sessionToken|accessKeyId)"\s*:\s*")[^"]*/giu, '$1[REDACTED]');
}

function jsonSafeClone(value) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value, (key, item) => {
      if (/^(?:password|secretAccessKey|sessionToken|accessKeyId|authorization|cookie)$/iu.test(key)) {
        return '[REDACTED]';
      }
      return typeof item === 'string' ? redactBoundedCommandOutput(item) : item;
    }));
  } catch (_) {
    return redactBoundedCommandOutput(value);
  }
}

function serializeMigrationError(error, { includeResult = false } = {}) {
  const serialized = {
    name: String(error?.name || 'Error'),
    code: String(error?.code || 'schema_migration_failed'),
    message: redactBoundedCommandOutput(error?.message || error || 'Schema migration failed'),
  };
  for (const key of [
    'failedFiles',
    'pending',
    'drift',
    'summary',
    'remoteExecution',
    'cleanupFailures',
  ]) {
    if (error?.[key] !== undefined) serialized[key] = jsonSafeClone(error[key]);
  }
  if (includeResult && error?.result !== undefined) {
    serialized.result = jsonSafeClone(error.result);
  }
  return serialized;
}

function attachCleanupFailure(primaryError, cleanupError, context) {
  const failure = {
    context,
    ...serializeMigrationError(cleanupError),
  };
  if (primaryError) {
    primaryError.cleanupFailures = [
      ...(Array.isArray(primaryError.cleanupFailures) ? primaryError.cleanupFailures : []),
      failure,
    ];
    return primaryError;
  }
  const error = new Error(`${context}: ${failure.message}`);
  error.code = 'schema_migration_staging_cleanup_failed';
  error.cleanupFailures = [failure];
  return error;
}

function attachRemoteExecutionEvidence(error, {
  commandId,
  instanceId,
  invocation = null,
}) {
  const evidence = {
    commandId: commandId || null,
    instanceId: instanceId || null,
    status: invocation?.Status || null,
    responseCode: invocation?.ResponseCode !== undefined &&
      invocation?.ResponseCode !== null &&
      Number.isFinite(Number(invocation.ResponseCode))
      ? Number(invocation.ResponseCode)
      : null,
    stdout: redactBoundedCommandOutput(invocation?.StandardOutputContent || ''),
    stderr: redactBoundedCommandOutput(invocation?.StandardErrorContent || ''),
  };
  error.remoteExecution = evidence;
  return error;
}

function deleteStagedS3Object(remoteConfig, key, { runAws = runAwsCli } = {}) {
  if (!key) return { skipped: true, reason: 'missing-key' };
  runAws(remoteConfig, [
    's3api', 'delete-object',
    '--bucket', remoteConfig.artifactBucket,
    '--key', key,
    '--output', 'json',
  ], { parseJson: true });
  return {
    deleted: true,
    bucket: remoteConfig.artifactBucket,
    key,
  };
}

function proveRemoteAwsIdentity(remoteConfig, runAws = runAwsCli) {
  const identity = runAws(remoteConfig, ['sts', 'get-caller-identity', '--output', 'json'], { parseJson: true });
  if (String(identity.Account || '') !== remoteConfig.expectedAccountId) {
    const error = new Error(
      `Remote migration AWS identity mismatch for ${remoteConfig.targetEnv}: ` +
      `${String(identity.Account || '<missing>')} != ${remoteConfig.expectedAccountId}`
    );
    error.code = 'remote_schema_outer_aws_identity_mismatch';
    throw error;
  }
  return {
    Account: String(identity.Account),
    Arn: String(identity.Arn || ''),
    UserId: String(identity.UserId || ''),
  };
}

function discoverRemoteMigrationInstance(remoteConfig, runAws = runAwsCli) {
  const asg = runAws(remoteConfig, [
    'autoscaling',
    'describe-auto-scaling-groups',
    '--auto-scaling-group-names', remoteConfig.autoScalingGroupName,
    '--output', 'json',
  ], { parseJson: true });
  const groups = Array.isArray(asg.AutoScalingGroups) ? asg.AutoScalingGroups : [];
  if (groups.length !== 1) {
    throw new Error(`Expected one Auto Scaling Group named ${remoteConfig.autoScalingGroupName}`);
  }
  const inService = new Set((groups[0].Instances || [])
    .filter(instance => instance.LifecycleState === 'InService' && instance.HealthStatus === 'Healthy')
    .map(instance => String(instance.InstanceId || ''))
    .filter(Boolean));
  const ssm = runAws(remoteConfig, [
    'ssm',
    'describe-instance-information',
    '--output', 'json',
  ], { parseJson: true });
  const candidates = (ssm.InstanceInformationList || [])
    .filter(instance => instance.PingStatus === 'Online' && inService.has(String(instance.InstanceId || '')))
    .map(instance => String(instance.InstanceId))
    .sort();
  if (!candidates.length) {
    throw new Error(`No healthy in-service ${remoteConfig.targetEnv} instance is online in SSM`);
  }
  return candidates[0];
}

function createCandidateBundle({ tempPrefix, archiveName, files }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), tempPrefix));
  const stagingRoot = path.join(tempRoot, 'bundle');
  const archivePath = path.join(tempRoot, archiveName);
  fs.mkdirSync(stagingRoot, { recursive: true, mode: 0o700 });
  const manifest = [];
  for (const [relativePath, sourcePath] of files) {
    const destination = path.join(stagingRoot, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    fs.copyFileSync(sourcePath, destination);
    manifest.push(`${sha256File(destination)}  ${relativePath}`);
  }
  fs.writeFileSync(path.join(stagingRoot, 'MANIFEST.sha256'), `${manifest.join('\n')}\n`, { mode: 0o600 });
  const archive = spawnSync('tar', ['-czf', archivePath, '-C', stagingRoot, '.'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (archive.status !== 0) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(String(archive.stderr || archive.stdout || 'Failed to create typed-lineage executor bundle').trim());
  }
  return {
    tempRoot,
    archivePath,
    sha256: sha256File(archivePath),
    bytes: fs.statSync(archivePath).size,
  };
}

function createTypedLineageExecutorBundle(migration) {
  return createCandidateBundle({
    tempPrefix: 'typed-lineage-dispatch-',
    archiveName: 'typed-lineage-executor.tgz',
    files: [
      ['scripts/apply-20260825-typed-lineage.js', path.join(REPO_ROOT, 'scripts', 'apply-20260825-typed-lineage.js')],
      ['scripts/lib/typed-lineage-migration-executor.js', path.join(REPO_ROOT, 'scripts', 'lib', 'typed-lineage-migration-executor.js')],
      [`sql/migrations/${TYPED_LINEAGE_MIGRATION_FILENAME}`, migration.fullPath],
    ],
  });
}

function createRemoteMigrationLedgerReaderBundle() {
  return createCandidateBundle({
    tempPrefix: 'remote-migration-ledger-reader-',
    archiveName: 'remote-migration-ledger-reader.tgz',
    files: [
      ['scripts/read-remote-migration-ledger.js', path.join(REPO_ROOT, 'scripts', 'read-remote-migration-ledger.js')],
      ['scripts/lib/live-mysql-schema-guard.js', path.join(REPO_ROOT, 'scripts', 'lib', 'live-mysql-schema-guard.js')],
      ['scripts/lib/typed-lineage-migration-executor.js', path.join(REPO_ROOT, 'scripts', 'lib', 'typed-lineage-migration-executor.js')],
      ['src/lib/sharedSchemaMigrationRunner.js', path.join(REPO_ROOT, 'src', 'lib', 'sharedSchemaMigrationRunner.js')],
    ],
  });
}

function createSecureMessageIdempotencyExecutorBundle(migration) {
  return createCandidateBundle({
    tempPrefix: 'secure-message-idempotency-dispatch-',
    archiveName: 'secure-message-idempotency-executor.tgz',
    files: [
      ['scripts/apply-20260825-secure-message-idempotency.js', path.join(REPO_ROOT, 'scripts', 'apply-20260825-secure-message-idempotency.js')],
      ['scripts/lib/secure-message-idempotency-migration-executor.js', path.join(REPO_ROOT, 'scripts', 'lib', 'secure-message-idempotency-migration-executor.js')],
      [`sql/migrations/${SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_FILENAME}`, migration.fullPath],
    ],
  });
}

function encodeAwsUriComponent(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/gu, character => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
}

function createPresignedS3PutUrl(remoteConfig, bucket, key, expiresSeconds = 1800, {
  credentialsProvider = () => runAwsCli(remoteConfig, [
    'configure', 'export-credentials', '--format', 'process', '--output', 'json',
  ], { parseJson: true }),
  clock = () => new Date(),
} = {}) {
  const credentials = credentialsProvider();
  if (!credentials.AccessKeyId || !credentials.SecretAccessKey) {
    throw new Error(`Profile ${remoteConfig.profile} did not return signable credentials`);
  }
  if (!Number.isInteger(expiresSeconds) || expiresSeconds < 60 || expiresSeconds > 1800) {
    throw new Error('Bounded migration evidence upload expiry must be between 60 and 1800 seconds');
  }
  const now = clock();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/gu, '');
  const dateStamp = amzDate.slice(0, 8);
  const service = 's3';
  const scope = `${dateStamp}/${remoteConfig.region}/${service}/aws4_request`;
  const host = `${bucket}.s3.${remoteConfig.region}.amazonaws.com`;
  const canonicalUri = `/${String(key).split('/').map(encodeAwsUriComponent).join('/')}`;
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${credentials.AccessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  if (credentials.SessionToken) params['X-Amz-Security-Token'] = credentials.SessionToken;
  const canonicalQuery = Object.keys(params).sort()
    .map(name => `${encodeAwsUriComponent(name)}=${encodeAwsUriComponent(params[name])}`)
    .join('&');
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const hmac = (keyValue, value) => crypto.createHmac('sha256', keyValue).update(value).digest();
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${credentials.SecretAccessKey}`, dateStamp), remoteConfig.region), service),
    'aws4_request'
  );
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function stageBoundedMigrationExecutorBundle(remoteConfig, bundle, runToken, {
  filename,
  checksum,
  errorCode,
  runAws = runAwsCli,
  deleteStagedObject = deleteStagedS3Object,
}) {
  const key = [
    `${TEMP_REMOTE_STAGING_PREFIX}/schema-executors`,
    filename,
    checksum,
    `${runToken}-${bundle.sha256}.tgz`,
  ].join('/');
  let uploadAttempted = false;
  try {
    uploadAttempted = true;
    runAws(remoteConfig, [
      's3', 'cp', bundle.archivePath, `s3://${remoteConfig.artifactBucket}/${key}`,
      '--metadata', `sha256=${bundle.sha256}`,
      '--only-show-errors',
    ]);
    const head = runAws(remoteConfig, [
      's3api', 'head-object',
      '--bucket', remoteConfig.artifactBucket,
      '--key', key,
      '--output', 'json',
    ], { parseJson: true });
    if (Number(head.ContentLength) !== bundle.bytes || String(head.Metadata?.sha256 || '') !== bundle.sha256) {
      const error = new Error(`Staged bounded executor bundle failed verification: ${filename}`);
      error.code = errorCode;
      throw error;
    }
    const uri = `s3://${remoteConfig.artifactBucket}/${key}`;
    const downloadUrl = runAws(remoteConfig, ['s3', 'presign', uri, '--expires-in', '900']);
    if (!/^https:\/\//u.test(downloadUrl)) {
      throw new Error(`Unable to create a bounded executor download URL: ${filename}`);
    }
    const evidenceKey = [
      DURABLE_SCHEMA_EVIDENCE_PREFIX,
      filename,
      checksum,
      `${runToken}-evidence.json.gz`,
    ].join('/');
    const evidenceUri = `s3://${remoteConfig.artifactBucket}/${evidenceKey}`;
    const evidenceUploadUrl = createPresignedS3PutUrl(
      remoteConfig,
      remoteConfig.artifactBucket,
      evidenceKey
    );
    return {
      key,
      uri,
      downloadUrl,
      sha256: bundle.sha256,
      bytes: bundle.bytes,
      evidenceKey,
      evidenceUri,
      evidenceUploadUrl,
    };
  } catch (error) {
    if (uploadAttempted) {
      try {
        deleteStagedObject(remoteConfig, key, { runAws });
      } catch (cleanupError) {
        attachCleanupFailure(error, cleanupError, `Delete failed bounded executor staging object ${key}`);
      }
    }
    throw error;
  }
}

function stageTypedLineageExecutorBundle(remoteConfig, bundle, runToken) {
  return stageBoundedMigrationExecutorBundle(remoteConfig, bundle, runToken, {
    filename: TYPED_LINEAGE_MIGRATION_FILENAME,
    checksum: TYPED_LINEAGE_MIGRATION_SHA256,
    errorCode: 'typed_lineage_executor_bundle_verification_failed',
  });
}

function stageSecureMessageIdempotencyExecutorBundle(remoteConfig, bundle, runToken) {
  return stageBoundedMigrationExecutorBundle(remoteConfig, bundle, runToken, {
    filename: SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_FILENAME,
    checksum: SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_SHA256,
    errorCode: 'secure_message_idempotency_executor_bundle_verification_failed',
  });
}

function stageRemoteMigrationLedgerReaderBundle(remoteConfig, bundle, runToken, {
  runAws = runAwsCli,
  deleteStagedObject = deleteStagedS3Object,
} = {}) {
  const key = [
    `${TEMP_REMOTE_STAGING_PREFIX}/schema-ledger-readers`,
    REMOTE_LEDGER_READER_ID,
    `${runToken}-${bundle.sha256}.tgz`,
  ].join('/');
  let uploadAttempted = false;
  try {
    uploadAttempted = true;
    runAws(remoteConfig, [
      's3', 'cp', bundle.archivePath, `s3://${remoteConfig.artifactBucket}/${key}`,
      '--metadata', `sha256=${bundle.sha256}`,
      '--only-show-errors',
    ]);
    const head = runAws(remoteConfig, [
      's3api', 'head-object',
      '--bucket', remoteConfig.artifactBucket,
      '--key', key,
      '--output', 'json',
    ], { parseJson: true });
    if (Number(head.ContentLength) !== bundle.bytes || String(head.Metadata?.sha256 || '') !== bundle.sha256) {
      const error = new Error('Staged remote migration ledger reader failed size/checksum metadata verification');
      error.code = 'remote_migration_ledger_bundle_verification_failed';
      throw error;
    }
    const uri = `s3://${remoteConfig.artifactBucket}/${key}`;
    const downloadUrl = runAws(remoteConfig, ['s3', 'presign', uri, '--expires-in', '900']);
    if (!/^https:\/\//u.test(downloadUrl)) {
      throw new Error('Unable to create a bounded remote migration ledger reader download URL');
    }
    return {
      key,
      uri,
      downloadUrl,
      sha256: bundle.sha256,
      bytes: bundle.bytes,
    };
  } catch (error) {
    if (uploadAttempted) {
      try {
        deleteStagedObject(remoteConfig, key, { runAws });
      } catch (cleanupError) {
        attachCleanupFailure(error, cleanupError, `Delete failed remote ledger staging object ${key}`);
      }
    }
    throw error;
  }
}

function sendRemoteMigrationCommand(remoteConfig, instanceId, commands, {
  comment = `Bounded ${TYPED_LINEAGE_MIGRATION_FILENAME} ${remoteConfig.targetEnv} dispatch`,
  filenamePrefix = 'typed-lineage-ssm',
} = {}) {
  const inputPath = path.join(
    os.tmpdir(),
    `${filenamePrefix}-${remoteConfig.targetEnv}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.json`
  );
  const input = {
    DocumentName: 'AWS-RunShellScript',
    InstanceIds: [instanceId],
    TimeoutSeconds: 900,
    Comment: comment,
    Parameters: { commands },
  };
  fs.writeFileSync(inputPath, JSON.stringify(input), { mode: 0o600 });
  try {
    const response = runAwsCli(remoteConfig, [
      'ssm', 'send-command',
      '--cli-input-json', `file://${inputPath}`,
      '--output', 'json',
    ], { parseJson: true });
    const commandId = String(response.Command?.CommandId || '');
    if (!commandId) throw new Error('SSM did not return a command id for bounded schema dispatch');
    return commandId;
  } finally {
    fs.rmSync(inputPath, { force: true });
  }
}

function waitRemoteMigrationCommand(remoteConfig, commandId, instanceId) {
  const deadline = Date.now() + (15 * 60 * 1000);
  while (Date.now() < deadline) {
    const pause = spawnSync('sleep', ['2'], { stdio: 'ignore' });
    if (pause.status !== 0) throw new Error('Unable to wait for bounded schema SSM command');
    let invocation;
    try {
      invocation = runAwsCli(remoteConfig, [
        'ssm', 'get-command-invocation',
        '--command-id', commandId,
        '--instance-id', instanceId,
        '--output', 'json',
      ], { parseJson: true });
    } catch (error) {
      if (/InvocationDoesNotExist/u.test(error.message)) continue;
      throw error;
    }
    if (['Pending', 'InProgress', 'Delayed'].includes(invocation.Status)) continue;
    return invocation;
  }
  throw new Error(`Timed out waiting for bounded schema SSM command ${commandId}`);
}

function parseBoundedMigrationRemoteSummary(output, marker, label) {
  const line = String(output || '').split(/\r?\n/u)
    .find(candidate => candidate.startsWith(marker));
  if (!line) throw new Error(`${label} remote command returned no bounded result marker`);
  try {
    return JSON.parse(Buffer.from(line.slice(marker.length), 'base64').toString('utf8'));
  } catch (error) {
    throw new Error(`${label} remote result marker was invalid: ${error.message}`);
  }
}

function parseTypedLineageRemoteSummary(output) {
  return parseBoundedMigrationRemoteSummary(output, 'PATH_TYPED_LINEAGE_RESULT=', 'Typed-lineage');
}

function parseSecureMessageIdempotencyRemoteSummary(output) {
  return parseBoundedMigrationRemoteSummary(
    output,
    'PATH_SECURE_MESSAGE_IDEMPOTENCY_RESULT=',
    'Secure-message idempotency'
  );
}

function parseBoundedMigrationRemoteEvidenceMarker(output, marker, label) {
  const line = String(output || '').split(/\r?\n/u)
    .find(candidate => candidate.startsWith(marker));
  if (!line) throw new Error(`${label} remote command returned no durable evidence marker`);
  const [sha256, bytesText] = line.slice(marker.length).split(':');
  const bytes = Number(bytesText);
  if (!/^[a-f0-9]{64}$/u.test(String(sha256 || '')) || !Number.isSafeInteger(bytes) || bytes < 1) {
    throw new Error(`${label} durable evidence marker was invalid`);
  }
  return { sha256, bytes };
}

function parseTypedLineageRemoteEvidenceMarker(output) {
  return parseBoundedMigrationRemoteEvidenceMarker(
    output,
    'PATH_TYPED_LINEAGE_EVIDENCE=',
    'Typed-lineage'
  );
}

function parseSecureMessageIdempotencyRemoteEvidenceMarker(output) {
  return parseBoundedMigrationRemoteEvidenceMarker(
    output,
    'PATH_SECURE_MESSAGE_IDEMPOTENCY_EVIDENCE=',
    'Secure-message idempotency'
  );
}

function verifyStagedBoundedMigrationEvidence(remoteConfig, stagedArtifact, marker, summary, {
  tempPrefix,
  errorPrefix,
  label,
}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), tempPrefix));
  const evidencePath = path.join(tempRoot, 'evidence.json.gz');
  try {
    runAwsCli(remoteConfig, [
      's3', 'cp', stagedArtifact.evidenceUri, evidencePath, '--only-show-errors',
    ]);
    const actual = { sha256: sha256File(evidencePath), bytes: fs.statSync(evidencePath).size };
    if (actual.sha256 !== marker.sha256 || actual.bytes !== marker.bytes) {
      const error = new Error(`Persisted ${label} evidence failed local checksum/size verification`);
      error.code = `${errorPrefix}_evidence_verification_failed`;
      throw error;
    }
    let evidence;
    try {
      evidence = JSON.parse(zlib.gunzipSync(fs.readFileSync(evidencePath)).toString('utf8'));
    } catch (error) {
      const invalid = new Error(`Persisted ${label} evidence was not valid gzipped JSON: ${error.message}`);
      invalid.code = `${errorPrefix}_evidence_invalid`;
      throw invalid;
    }
    const matchesSummary = evidence.decision === summary?.decision &&
      evidence.targetEnv === summary?.targetEnv &&
      evidence.awsIdentity?.Account === summary?.awsIdentity?.Account &&
      evidence.awsIdentity?.InstanceId === summary?.awsIdentity?.InstanceId &&
      evidence.executionContext?.runToken === summary?.executionContext?.runToken &&
      evidence.migration?.checksum === summary?.migration?.checksum &&
      evidence.ledger?.checksum === summary?.ledger?.checksum &&
      JSON.stringify(evidence.finalProof?.identity || null) === JSON.stringify(summary?.finalIdentity || null) &&
      JSON.stringify(evidence.finalProof?.operationStates || {}) === JSON.stringify(summary?.finalOperationStates || {});
    if (!matchesSummary) {
      const error = new Error(`Persisted ${label} evidence does not match the SSM result summary`);
      error.code = `${errorPrefix}_evidence_summary_mismatch`;
      throw error;
    }
    return {
      key: stagedArtifact.evidenceKey,
      uri: stagedArtifact.evidenceUri,
      sha256: actual.sha256,
      bytes: actual.bytes,
      canonicalJsonSha256: crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyStagedTypedLineageEvidence(remoteConfig, stagedArtifact, marker, summary) {
  return verifyStagedBoundedMigrationEvidence(remoteConfig, stagedArtifact, marker, summary, {
    tempPrefix: 'typed-lineage-evidence-verify-',
    errorPrefix: 'typed_lineage',
    label: 'typed-lineage',
  });
}

function verifyStagedSecureMessageIdempotencyEvidence(remoteConfig, stagedArtifact, marker, summary) {
  return verifyStagedBoundedMigrationEvidence(remoteConfig, stagedArtifact, marker, summary, {
    tempPrefix: 'secure-message-idempotency-evidence-verify-',
    errorPrefix: 'secure_message_idempotency',
    label: 'secure-message idempotency',
  });
}

function validateTypedLineageDispatchResult(summary, remoteConfig, instanceId, runToken) {
  const expectedStates = TYPED_LINEAGE_OPERATIONS.map(operation => operation.key);
  const contract = TYPED_LINEAGE_ENVIRONMENT_CONTRACTS[remoteConfig.targetEnv];
  const finalIdentity = summary?.finalIdentity || {};
  const identityMatches = contract && Object.entries(contract.live)
    .every(([key, value]) => finalIdentity[key] === value);
  const valid = summary?.decision === 'COMPLETE' &&
    summary?.targetEnv === remoteConfig.targetEnv &&
    summary?.awsIdentity?.Account === remoteConfig.expectedAccountId &&
    summary?.awsIdentity?.InstanceId === instanceId &&
    summary?.awsIdentity?.Region === remoteConfig.region &&
    summary?.executionContext?.runToken === runToken &&
    summary?.migration?.filename === TYPED_LINEAGE_MIGRATION_FILENAME &&
    summary?.migration?.checksum === TYPED_LINEAGE_MIGRATION_SHA256 &&
    Number(summary?.operationCount) === TYPED_LINEAGE_OPERATIONS.length &&
    expectedStates.every(key => summary?.finalOperationStates?.[key] === 'target') &&
    summary?.seriesStructureStable === true &&
    summary?.ledger?.success === true &&
    summary?.ledger?.checksum === TYPED_LINEAGE_MIGRATION_SHA256 &&
    identityMatches &&
    !summary?.failure;
  if (!valid) {
    const error = new Error('Bounded typed-lineage executor result failed local validation');
    error.code = 'typed_lineage_dispatch_result_invalid';
    error.summary = summary;
    throw error;
  }
  return summary;
}

function validateSecureMessageIdempotencyDispatchResult(summary, remoteConfig, instanceId, runToken) {
  const contract = SECURE_MESSAGE_IDEMPOTENCY_ENVIRONMENT_CONTRACTS[remoteConfig.targetEnv];
  const finalIdentity = summary?.finalIdentity || {};
  const identityMatches = contract && Object.entries(contract.live)
    .every(([key, value]) => finalIdentity[key] === value);
  const configuredMatches = contract && Object.entries(contract.configured)
    .every(([key, value]) => summary?.configuredDatabase?.[key] === value);
  const expectedStates = SECURE_MESSAGE_IDEMPOTENCY_OPERATIONS.map(operation => operation.key);
  const valid = summary?.schemaVersion === 1 &&
    summary?.evidencePath === `/opt/nwac/admin-dashboard/.ops/${runToken}/evidence.json` &&
    summary?.executor === '20260825-secure-message-idempotency-bounded' &&
    summary?.decision === 'COMPLETE' &&
    summary?.phase === 'complete' &&
    summary?.targetEnv === remoteConfig.targetEnv &&
    summary?.awsIdentity?.Account === remoteConfig.expectedAccountId &&
    summary?.awsIdentity?.InstanceId === instanceId &&
    summary?.awsIdentity?.Region === remoteConfig.region &&
    summary?.executionContext?.expectedAwsAccountId === remoteConfig.expectedAccountId &&
    summary?.executionContext?.expectedSsmInstanceId === instanceId &&
    summary?.executionContext?.runToken === runToken &&
    summary?.migration?.filename === SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_FILENAME &&
    summary?.migration?.checksum === SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_SHA256 &&
    Number(summary?.metadataStatementCount) > 0 &&
    Number(summary?.operationCount) === SECURE_MESSAGE_IDEMPOTENCY_OPERATIONS.length &&
    expectedStates.every(key => summary?.finalOperationStates?.[key] === 'target') &&
    summary?.ledger?.filename === SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_FILENAME &&
    summary?.ledger?.success === true &&
    summary?.ledger?.checksum === SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_SHA256 &&
    identityMatches &&
    configuredMatches &&
    !summary?.evidenceFallbackUsed &&
    !summary?.failure;
  if (!valid) {
    const error = new Error('Bounded secure-message idempotency executor result failed local validation');
    error.code = 'secure_message_idempotency_dispatch_result_invalid';
    error.summary = summary;
    throw error;
  }
  return summary;
}

function dispatchTypedLineageMigration(remoteConfig, migration, {
  mode = 'apply',
  deleteStagedObject = deleteStagedS3Object,
} = {}) {
  const verified = verifyTypedLineageMigrationArtifact(migration.fullPath);
  if (verified.checksum !== migration.checksum || migration.checksum !== TYPED_LINEAGE_MIGRATION_SHA256) {
    const error = new Error('Typed-lineage canonical descriptor checksum does not match its pinned executor');
    error.code = 'typed_lineage_dispatch_checksum_mismatch';
    throw error;
  }
  const awsIdentity = proveRemoteAwsIdentity(remoteConfig);
  const instanceId = discoverRemoteMigrationInstance(remoteConfig);
  const runToken = [
    'typed-lineage',
    remoteConfig.targetEnv,
    mode,
    Date.now(),
    crypto.randomBytes(8).toString('hex'),
  ].join('-');
  const bundle = createTypedLineageExecutorBundle(migration);
  let stagedArtifact = null;
  let primaryError = null;
  const stagingCleanup = {
    remoteOps: 'shell-exit-trap',
    bundleObjectDeleted: false,
  };
  try {
    stagedArtifact = stageTypedLineageExecutorBundle(remoteConfig, bundle, runToken);
    const remoteOpsDir = `/opt/nwac/admin-dashboard/.ops/${runToken}`;
    const args = [
      'node', 'scripts/apply-20260825-typed-lineage.js',
      '--target-env', remoteConfig.targetEnv,
      '--env-file', remoteConfig.remoteEnvFile,
      '--expected-aws-account-id', remoteConfig.expectedAccountId,
      '--expected-ssm-instance-id', instanceId,
      '--run-token', runToken,
      '--evidence-out', `${remoteOpsDir}/evidence.json`,
      '--compact-output',
      '--yes',
    ].map(quoteBashArgument).join(' ');
    const commands = [
      'set -euo pipefail',
      'umask 077',
      `OPS_DIR=${quoteBashArgument(remoteOpsDir)}`,
      'test ! -e "$OPS_DIR"',
      'install -d -m 700 "$OPS_DIR"',
      "trap 'rm -rf -- \"$OPS_DIR\"' EXIT",
      `curl --fail --silent --show-error --location ${quoteBashArgument(stagedArtifact.downloadUrl)} --output "$OPS_DIR/bundle.tgz"`,
      `printf '%s  %s\\n' ${quoteBashArgument(stagedArtifact.sha256)} "$OPS_DIR/bundle.tgz" | sha256sum -c -`,
      'tar -xzf "$OPS_DIR/bundle.tgz" -C "$OPS_DIR"',
      'cd "$OPS_DIR"',
      'sha256sum -c MANIFEST.sha256',
      `test -s ${quoteBashArgument(remoteConfig.remoteEnvFile)}`,
      "NODE_PATH=/opt/nwac/admin-dashboard/node_modules node -e 'require.resolve(\"mysql2/promise\")'",
      'set +e',
      `NODE_PATH=/opt/nwac/admin-dashboard/node_modules ${args} > "$OPS_DIR/result.json" 2>&1`,
      'EXEC_CODE=$?',
      'set -e',
      'test -s "$OPS_DIR/result.json"',
      'RESULT_B64=$(base64 -w 0 "$OPS_DIR/result.json")',
      'printf "PATH_TYPED_LINEAGE_RESULT=%s\\n" "$RESULT_B64"',
      'test -s "$OPS_DIR/evidence.json"',
      'gzip -c "$OPS_DIR/evidence.json" > "$OPS_DIR/evidence.json.gz"',
      'EVIDENCE_SHA=$(sha256sum "$OPS_DIR/evidence.json.gz" | cut -d " " -f 1)',
      'EVIDENCE_BYTES=$(wc -c < "$OPS_DIR/evidence.json.gz" | tr -d " ")',
      `curl --fail --silent --show-error --request PUT --header 'Content-Type: application/gzip' --upload-file "$OPS_DIR/evidence.json.gz" ${quoteBashArgument(stagedArtifact.evidenceUploadUrl)}`,
      'printf "PATH_TYPED_LINEAGE_EVIDENCE=%s:%s\\n" "$EVIDENCE_SHA" "$EVIDENCE_BYTES"',
      'exit "$EXEC_CODE"',
    ];
    const commandId = sendRemoteMigrationCommand(remoteConfig, instanceId, commands);
    let invocation;
    try {
      invocation = waitRemoteMigrationCommand(remoteConfig, commandId, instanceId);
    } catch (error) {
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId });
    }
    let summary;
    try {
      summary = parseTypedLineageRemoteSummary(invocation.StandardOutputContent);
    } catch (error) {
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    let durableEvidence;
    try {
      const evidenceMarker = parseTypedLineageRemoteEvidenceMarker(invocation.StandardOutputContent);
      durableEvidence = verifyStagedTypedLineageEvidence(
        remoteConfig,
        stagedArtifact,
        evidenceMarker,
        summary
      );
    } catch (error) {
      error.summary = summary;
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    if (invocation.Status !== 'Success') {
      const error = new Error(
        `Bounded typed-lineage SSM command ${commandId} failed with status ${invocation.Status}: ` +
        String(invocation.StandardErrorContent || summary?.failure?.message || '<no error detail>')
      );
      error.code = summary?.failure?.code || 'typed_lineage_remote_dispatch_failed';
      error.summary = { ...summary, durableEvidence };
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    try {
      validateTypedLineageDispatchResult(summary, remoteConfig, instanceId, runToken);
    } catch (error) {
      error.summary = { ...summary, durableEvidence };
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    return {
      mode,
      commandId,
      instanceId,
      awsIdentity,
      stagedArtifact: {
        key: stagedArtifact.key,
        uri: stagedArtifact.uri,
        sha256: stagedArtifact.sha256,
        bytes: stagedArtifact.bytes,
      },
      remoteEvidencePath: summary.evidencePath,
      durableEvidence,
      summary,
      stagingCleanup,
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    let cleanupFailure = primaryError;
    if (stagedArtifact?.key) {
      try {
        deleteStagedObject(remoteConfig, stagedArtifact.key);
        stagingCleanup.bundleObjectDeleted = true;
      } catch (cleanupError) {
        cleanupFailure = attachCleanupFailure(
          cleanupFailure,
          cleanupError,
          `Delete failed typed-lineage staging object ${stagedArtifact.key}`
        );
      }
    }
    try {
      fs.rmSync(bundle.tempRoot, { recursive: true, force: true });
    } catch (cleanupError) {
      cleanupFailure = attachCleanupFailure(
        cleanupFailure,
        cleanupError,
        `Delete failed local typed-lineage bundle ${bundle.tempRoot}`
      );
    }
    if (!primaryError && cleanupFailure) throw cleanupFailure;
  }
}

function dispatchSecureMessageIdempotencyMigration(remoteConfig, migration, {
  mode = 'apply',
  deleteStagedObject = deleteStagedS3Object,
} = {}) {
  const verified = verifySecureMessageIdempotencyMigrationArtifact(migration.fullPath);
  if (
    verified.checksum !== migration.checksum ||
    migration.checksum !== SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_SHA256
  ) {
    const error = new Error(
      'Secure-message idempotency descriptor checksum does not match its pinned executor'
    );
    error.code = 'secure_message_idempotency_dispatch_checksum_mismatch';
    throw error;
  }
  const awsIdentity = proveRemoteAwsIdentity(remoteConfig);
  const instanceId = discoverRemoteMigrationInstance(remoteConfig);
  const runToken = [
    'secure-message-idempotency',
    remoteConfig.targetEnv,
    mode,
    Date.now(),
    crypto.randomBytes(8).toString('hex'),
  ].join('-');
  const bundle = createSecureMessageIdempotencyExecutorBundle(migration);
  let stagedArtifact = null;
  let primaryError = null;
  const stagingCleanup = {
    remoteOps: 'shell-exit-trap',
    bundleObjectDeleted: false,
  };
  try {
    stagedArtifact = stageSecureMessageIdempotencyExecutorBundle(
      remoteConfig,
      bundle,
      runToken
    );
    const remoteOpsDir = `/opt/nwac/admin-dashboard/.ops/${runToken}`;
    const args = [
      'node', 'scripts/apply-20260825-secure-message-idempotency.js',
      '--target-env', remoteConfig.targetEnv,
      '--env-file', remoteConfig.remoteEnvFile,
      '--expected-aws-account-id', remoteConfig.expectedAccountId,
      '--expected-ssm-instance-id', instanceId,
      '--run-token', runToken,
      '--evidence-out', `${remoteOpsDir}/evidence.json`,
      '--compact-output',
      '--yes',
    ].map(quoteBashArgument).join(' ');
    const commands = [
      'set -euo pipefail',
      'umask 077',
      `OPS_DIR=${quoteBashArgument(remoteOpsDir)}`,
      'test ! -e "$OPS_DIR"',
      'install -d -m 700 "$OPS_DIR"',
      "trap 'rm -rf -- \"$OPS_DIR\"' EXIT",
      `curl --fail --silent --show-error --location ${quoteBashArgument(stagedArtifact.downloadUrl)} --output "$OPS_DIR/bundle.tgz"`,
      `printf '%s  %s\\n' ${quoteBashArgument(stagedArtifact.sha256)} "$OPS_DIR/bundle.tgz" | sha256sum -c -`,
      'tar -xzf "$OPS_DIR/bundle.tgz" -C "$OPS_DIR"',
      'cd "$OPS_DIR"',
      'sha256sum -c MANIFEST.sha256',
      `test -s ${quoteBashArgument(remoteConfig.remoteEnvFile)}`,
      "NODE_PATH=/opt/nwac/admin-dashboard/node_modules node -e 'require.resolve(\"mysql2/promise\")'",
      'set +e',
      `NODE_PATH=/opt/nwac/admin-dashboard/node_modules ${args} > "$OPS_DIR/result.json" 2>&1`,
      'EXEC_CODE=$?',
      'set -e',
      'test -s "$OPS_DIR/result.json"',
      'RESULT_B64=$(base64 -w 0 "$OPS_DIR/result.json")',
      'printf "PATH_SECURE_MESSAGE_IDEMPOTENCY_RESULT=%s\\n" "$RESULT_B64"',
      'test -s "$OPS_DIR/evidence.json"',
      'gzip -c "$OPS_DIR/evidence.json" > "$OPS_DIR/evidence.json.gz"',
      'EVIDENCE_SHA=$(sha256sum "$OPS_DIR/evidence.json.gz" | cut -d " " -f 1)',
      'EVIDENCE_BYTES=$(wc -c < "$OPS_DIR/evidence.json.gz" | tr -d " ")',
      `curl --fail --silent --show-error --request PUT --header 'Content-Type: application/gzip' --upload-file "$OPS_DIR/evidence.json.gz" ${quoteBashArgument(stagedArtifact.evidenceUploadUrl)}`,
      'printf "PATH_SECURE_MESSAGE_IDEMPOTENCY_EVIDENCE=%s:%s\\n" "$EVIDENCE_SHA" "$EVIDENCE_BYTES"',
      'exit "$EXEC_CODE"',
    ];
    const commandId = sendRemoteMigrationCommand(remoteConfig, instanceId, commands, {
      comment: `Bounded ${SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_FILENAME} ${remoteConfig.targetEnv} dispatch`,
      filenamePrefix: 'secure-message-idempotency-ssm',
    });
    let invocation;
    try {
      invocation = waitRemoteMigrationCommand(remoteConfig, commandId, instanceId);
    } catch (error) {
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId });
    }
    let summary;
    try {
      summary = parseSecureMessageIdempotencyRemoteSummary(invocation.StandardOutputContent);
    } catch (error) {
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    let durableEvidence;
    try {
      const evidenceMarker = parseSecureMessageIdempotencyRemoteEvidenceMarker(
        invocation.StandardOutputContent
      );
      durableEvidence = verifyStagedSecureMessageIdempotencyEvidence(
        remoteConfig,
        stagedArtifact,
        evidenceMarker,
        summary
      );
    } catch (error) {
      error.summary = summary;
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    if (invocation.Status !== 'Success') {
      const error = new Error(
        `Bounded secure-message idempotency SSM command ${commandId} failed with status ${invocation.Status}: ` +
        String(invocation.StandardErrorContent || summary?.failure?.message || '<no error detail>')
      );
      error.code = summary?.failure?.code || 'secure_message_idempotency_remote_dispatch_failed';
      error.summary = { ...summary, durableEvidence };
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    try {
      validateSecureMessageIdempotencyDispatchResult(summary, remoteConfig, instanceId, runToken);
    } catch (error) {
      error.summary = { ...summary, durableEvidence };
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    return {
      mode,
      commandId,
      instanceId,
      awsIdentity,
      stagedArtifact: {
        key: stagedArtifact.key,
        uri: stagedArtifact.uri,
        sha256: stagedArtifact.sha256,
        bytes: stagedArtifact.bytes,
      },
      remoteEvidencePath: summary.evidencePath,
      durableEvidence,
      summary,
      stagingCleanup,
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    let cleanupFailure = primaryError;
    if (stagedArtifact?.key) {
      try {
        deleteStagedObject(remoteConfig, stagedArtifact.key);
        stagingCleanup.bundleObjectDeleted = true;
      } catch (cleanupError) {
        cleanupFailure = attachCleanupFailure(
          cleanupFailure,
          cleanupError,
          `Delete failed secure-message idempotency staging object ${stagedArtifact.key}`
        );
      }
    }
    try {
      fs.rmSync(bundle.tempRoot, { recursive: true, force: true });
    } catch (cleanupError) {
      cleanupFailure = attachCleanupFailure(
        cleanupFailure,
        cleanupError,
        `Delete failed local secure-message idempotency bundle ${bundle.tempRoot}`
      );
    }
    if (!primaryError && cleanupFailure) throw cleanupFailure;
  }
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
    specialDispatches: plan.specialDispatches || [],
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

function buildSchemaMigrationCliFailurePayload(error, argv = []) {
  let args = null;
  try {
    args = parseArgs(argv);
  } catch (_) {
    // Preserve the original argument/validation failure without replacing it.
  }
  return {
    schemaVersion: 1,
    command: args?.command || argv[0] || null,
    targetEnv: args?.targetEnv || null,
    profile: args?.profile || null,
    region: args?.region || null,
    success: false,
    error: serializeMigrationError(error),
    result: error?.result === undefined ? null : jsonSafeClone(error.result),
  };
}

function reportSchemaMigrationCliFailure(error, argv = [], output = process) {
  const payload = buildSchemaMigrationCliFailurePayload(error, argv);
  if (argv.includes('--json')) {
    output.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    output.stderr.write(`[path-schema-migrate] ${payload.error.message}\n`);
  }
  return payload;
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
  (plan.specialDispatches || []).forEach(item => {
    console.log(`Bounded dispatch: ${item.file} (${item.action})`);
  });
}

function printApply(result) {
  printPlan(result);
  if (!result.attempted.length) {
    console.log('No migrations were applied.');
    return;
  }
  result.attempted.forEach(item => {
    const status = item.success
      ? (item.action === 'revalidate' ? 'revalidated' : 'applied')
      : 'failed';
    const detail = item.errorSnippet ? ` (${item.errorSnippet})` : '';
    console.log(`  - ${item.file}: ${status} in ${item.durationMs}ms${detail}`);
  });
}

async function openPool(dbConfig) {
  return mysql.createPool(dbConfig);
}

function parseRemoteMigrationLedgerResult(output) {
  const line = String(output || '').split(/\r?\n/u)
    .find(candidate => candidate.startsWith(REMOTE_LEDGER_RESULT_MARKER));
  if (!line) {
    const error = new Error('Remote migration ledger command returned no bounded result marker');
    error.code = 'remote_migration_ledger_result_missing';
    throw error;
  }
  try {
    const compressed = Buffer.from(line.slice(REMOTE_LEDGER_RESULT_MARKER.length), 'base64');
    return JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
  } catch (error) {
    const invalid = new Error(`Remote migration ledger result marker was invalid: ${error.message}`);
    invalid.code = 'remote_migration_ledger_result_invalid';
    throw invalid;
  }
}

function assertSha256(value, code) {
  if (!/^[a-f0-9]{64}$/u.test(String(value || ''))) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
}

function validateRemoteMigrationLedgerResult(
  summary,
  remoteConfig,
  instanceId,
  runToken,
  trackingTable = DEFAULT_TRACKING_TABLE
) {
  if (trackingTable !== DEFAULT_TRACKING_TABLE) {
    const error = new Error('Remote migration ledger reader supports only the canonical tracking table');
    error.code = 'remote_migration_ledger_tracking_table_invalid';
    throw error;
  }
  const contract = TYPED_LINEAGE_ENVIRONMENT_CONTRACTS[remoteConfig.targetEnv];
  const guard = summary?.guardEvidence || {};
  const objectProof = guard.objects?.[trackingTable] || null;
  const expectedLedgerSqlHash = crypto.createHash('sha256')
    .update(buildAppliedMigrationRowsSql(trackingTable))
    .digest('hex');
  const identityMatches = contract && Object.entries(contract.live).every(([key, value]) => {
    const guardKey = key === 'host' ? 'host' : key;
    return guard.identity?.[guardKey] === value;
  });
  const configuredMatches = contract && Object.entries(contract.configured).every(
    ([key, value]) => summary?.configuredDatabase?.[key] === value &&
      guard.identity?.configuredTarget?.[key] === value
  );
  const baseValid = summary?.schemaVersion === 1 &&
    summary?.reader === REMOTE_LEDGER_READER_ID &&
    summary?.decision === 'COMPLETE' &&
    summary?.targetEnv === remoteConfig.targetEnv &&
    summary?.awsIdentity?.Account === remoteConfig.expectedAccountId &&
    summary?.awsIdentity?.InstanceId === instanceId &&
    summary?.awsIdentity?.Region === remoteConfig.region &&
    summary?.executionContext?.runToken === runToken &&
    summary?.executionContext?.envFile === remoteConfig.remoteEnvFile &&
    summary?.trackingTable === trackingTable &&
    summary?.ledgerSelectSha256 === expectedLedgerSqlHash &&
    Array.isArray(summary?.rows) &&
    guard.preflightComplete === true &&
    identityMatches &&
    configuredMatches &&
    !summary?.failure;
  if (!baseValid) {
    const error = new Error('Bounded remote migration ledger result failed local context validation');
    error.code = 'remote_migration_ledger_result_context_invalid';
    error.summary = summary;
    throw error;
  }

  if (summary.trackingTableExists === true) {
    if (
      !objectProof ||
      objectProof.type !== 'table' ||
      JSON.stringify(Object.keys(guard.objects || {}).sort()) !== JSON.stringify([trackingTable]) ||
      guard.optionalAbsentObjects?.includes(trackingTable) ||
      guard.ddlHashes?.[trackingTable] !== objectProof.ddlHash ||
      guard.verifiedStatementCount !== 1 ||
      !Array.isArray(guard.verifiedStatements) ||
      guard.verifiedStatements.length !== 1 ||
      guard.verifiedStatements[0]?.sqlHash !== expectedLedgerSqlHash ||
      JSON.stringify(guard.verifiedStatements[0]?.tables || []) !== JSON.stringify([trackingTable]) ||
      (guard.verifiedStatements[0]?.functions || []).length !== 0
    ) {
      const error = new Error('Bounded remote migration ledger object/query evidence was invalid');
      error.code = 'remote_migration_ledger_guard_evidence_invalid';
      error.summary = summary;
      throw error;
    }
    for (const key of ['ddlHash', 'columnsHash', 'indexesHash', 'constraintsHash']) {
      assertSha256(objectProof[key], 'remote_migration_ledger_object_hash_invalid');
    }
  } else if (
    summary.trackingTableExists !== false ||
    summary.rows.length !== 0 ||
    objectProof ||
    Object.keys(guard.objects || {}).length !== 0 ||
    !guard.optionalAbsentObjects?.includes(trackingTable) ||
    guard.verifiedStatementCount !== 0 ||
    (guard.verifiedStatements || []).length !== 0
  ) {
    const error = new Error('Bounded remote migration ledger absence evidence was invalid');
    error.code = 'remote_migration_ledger_absence_evidence_invalid';
    error.summary = summary;
    throw error;
  }

  for (const row of summary.rows) {
    if (
      !row ||
      typeof row.filename !== 'string' ||
      !row.filename ||
      !/^[a-f0-9]{64}$/u.test(String(row.checksum || '')) ||
      ![0, 1].includes(Number(row.success))
    ) {
      const error = new Error('Bounded remote migration ledger returned an invalid row');
      error.code = 'remote_migration_ledger_row_invalid';
      error.summary = summary;
      throw error;
    }
  }
  return summary;
}

function dispatchRemoteMigrationLedgerReader(remoteConfig, {
  trackingTable = DEFAULT_TRACKING_TABLE,
  proveOuterAwsIdentity = proveRemoteAwsIdentity,
  discoverInstance = discoverRemoteMigrationInstance,
  createBundle = createRemoteMigrationLedgerReaderBundle,
  stageBundle = stageRemoteMigrationLedgerReaderBundle,
  sendCommand = sendRemoteMigrationCommand,
  waitCommand = waitRemoteMigrationCommand,
  deleteStagedObject = deleteStagedS3Object,
} = {}) {
  if (trackingTable !== DEFAULT_TRACKING_TABLE) {
    const error = new Error('Remote migration ledger reader supports only iset_migration');
    error.code = 'remote_migration_ledger_tracking_table_invalid';
    throw error;
  }
  const outerAwsIdentity = proveOuterAwsIdentity(remoteConfig);
  const instanceId = discoverInstance(remoteConfig);
  const runToken = [
    'migration-ledger',
    remoteConfig.targetEnv,
    Date.now(),
    crypto.randomBytes(8).toString('hex'),
  ].join('-');
  const bundle = createBundle();
  let stagedArtifact = null;
  let primaryError = null;
  const stagingCleanup = {
    remoteOps: 'shell-exit-trap',
    bundleObjectDeleted: false,
  };
  try {
    stagedArtifact = stageBundle(remoteConfig, bundle, runToken);
    const remoteOpsDir = `/opt/nwac/admin-dashboard/.ops/${runToken}`;
    const args = [
      'node', 'scripts/read-remote-migration-ledger.js',
      '--target-env', remoteConfig.targetEnv,
      '--env-file', remoteConfig.remoteEnvFile,
      '--expected-aws-account-id', remoteConfig.expectedAccountId,
      '--expected-ssm-instance-id', instanceId,
      '--run-token', runToken,
    ].map(quoteBashArgument).join(' ');
    const commands = [
      'set -euo pipefail',
      'umask 077',
      `OPS_DIR=${quoteBashArgument(remoteOpsDir)}`,
      'test ! -e "$OPS_DIR"',
      'install -d -m 700 "$OPS_DIR"',
      "trap 'rm -rf -- \"$OPS_DIR\"' EXIT",
      `curl --fail --silent --show-error --location ${quoteBashArgument(stagedArtifact.downloadUrl)} --output "$OPS_DIR/bundle.tgz"`,
      `printf '%s  %s\\n' ${quoteBashArgument(stagedArtifact.sha256)} "$OPS_DIR/bundle.tgz" | sha256sum -c -`,
      'tar -xzf "$OPS_DIR/bundle.tgz" -C "$OPS_DIR"',
      'cd "$OPS_DIR"',
      'sha256sum -c MANIFEST.sha256',
      `test -s ${quoteBashArgument(remoteConfig.remoteEnvFile)}`,
      "NODE_PATH=/opt/nwac/admin-dashboard/node_modules node -e 'require.resolve(\"mysql2/promise\")'",
      `NODE_PATH=/opt/nwac/admin-dashboard/node_modules ${args}`,
    ];
    const commandId = sendCommand(remoteConfig, instanceId, commands, {
      comment: `Bounded read-only migration ledger proof for ${remoteConfig.targetEnv}`,
      filenamePrefix: 'migration-ledger-reader-ssm',
    });
    let invocation;
    try {
      invocation = waitCommand(remoteConfig, commandId, instanceId);
    } catch (error) {
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId });
    }
    let summary;
    try {
      summary = parseRemoteMigrationLedgerResult(invocation.StandardOutputContent);
    } catch (error) {
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    if (invocation.Status !== 'Success') {
      const error = new Error(
        `Bounded remote migration ledger command ${commandId} failed with status ${invocation.Status}: ` +
        String(invocation.StandardErrorContent || summary?.failure?.message || '<no error detail>')
      );
      error.code = summary?.failure?.code || 'remote_migration_ledger_dispatch_failed';
      error.summary = summary;
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    try {
      validateRemoteMigrationLedgerResult(summary, remoteConfig, instanceId, runToken, trackingTable);
    } catch (error) {
      error.summary = summary;
      throw attachRemoteExecutionEvidence(error, { commandId, instanceId, invocation });
    }
    return {
      trackingTableExists: summary.trackingTableExists,
      rows: summary.rows,
      schemaEvidence: {
        reader: summary.reader,
        outerAwsIdentity,
        remoteAwsIdentity: summary.awsIdentity,
        executionContext: summary.executionContext,
        guard: summary.guardEvidence,
        commandId,
        instanceId,
        stagedArtifact: {
          key: stagedArtifact.key,
          uri: stagedArtifact.uri,
          sha256: stagedArtifact.sha256,
          bytes: stagedArtifact.bytes,
        },
        stagingCleanup,
      },
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    let cleanupFailure = primaryError;
    if (stagedArtifact?.key) {
      try {
        deleteStagedObject(remoteConfig, stagedArtifact.key);
        stagingCleanup.bundleObjectDeleted = true;
      } catch (cleanupError) {
        cleanupFailure = attachCleanupFailure(
          cleanupFailure,
          cleanupError,
          `Delete failed remote ledger staging object ${stagedArtifact.key}`
        );
      }
    }
    try {
      fs.rmSync(bundle.tempRoot, { recursive: true, force: true });
    } catch (cleanupError) {
      cleanupFailure = attachCleanupFailure(
        cleanupFailure,
        cleanupError,
        `Delete failed local remote-ledger bundle ${bundle.tempRoot}`
      );
    }
    if (!primaryError && cleanupFailure) throw cleanupFailure;
  }
}

function fetchRemoteAppliedMigrationRows(remoteConfig, options = {}) {
  return (options.dispatchRemoteMigrationLedgerReader || dispatchRemoteMigrationLedgerReader)(
    remoteConfig,
    { trackingTable: options.trackingTable || DEFAULT_TRACKING_TABLE }
  );
}

function findAndVerifyTypedLineageMigration(migrations) {
  const matches = (migrations || []).filter(migration => migration.file === TYPED_LINEAGE_MIGRATION_FILENAME);
  if (!matches.length) return null;
  if (matches.length !== 1) {
    const error = new Error(`Expected exactly one ${TYPED_LINEAGE_MIGRATION_FILENAME} canonical migration`);
    error.code = 'typed_lineage_dispatch_duplicate_filename';
    throw error;
  }
  const migration = matches[0];
  const verified = verifyTypedLineageMigrationArtifact(migration.fullPath);
  if (migration.checksum !== TYPED_LINEAGE_MIGRATION_SHA256 || verified.checksum !== migration.checksum) {
    const error = new Error('Typed-lineage migration checksum cannot be dispatched or sent to the generic runner');
    error.code = 'typed_lineage_dispatch_checksum_mismatch';
    throw error;
  }
  return migration;
}

function canonicalMigrationOrder(migrations) {
  const ordered = [...(migrations || [])].sort((left, right) => left.file.localeCompare(right.file));
  const duplicate = ordered.find((migration, index) => (
    index > 0 && migration.file === ordered[index - 1].file
  ));
  if (duplicate) {
    const error = new Error(`Canonical migration filename is duplicated: ${duplicate.file}`);
    error.code = 'remote_migration_duplicate_filename';
    throw error;
  }
  return ordered;
}

function createBoundedRemoteMigrationRegistry(options = {}) {
  return new Map([
    [
      TYPED_LINEAGE_MIGRATION_FILENAME,
      Object.freeze({
        file: TYPED_LINEAGE_MIGRATION_FILENAME,
        checksum: TYPED_LINEAGE_MIGRATION_SHA256,
        executor: '20260825-typed-lineage-bounded',
        verifyArtifact: verifyTypedLineageMigrationArtifact,
        dispatch: options.dispatchTypedLineageMigration || dispatchTypedLineageMigration,
        revalidateApplied: true,
      }),
    ],
    [
      SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_FILENAME,
      Object.freeze({
        file: SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_FILENAME,
        checksum: SECURE_MESSAGE_IDEMPOTENCY_MIGRATION_SHA256,
        executor: '20260825-secure-message-idempotency-bounded',
        verifyArtifact: verifySecureMessageIdempotencyMigrationArtifact,
        dispatch: options.dispatchSecureMessageIdempotencyMigration ||
          dispatchSecureMessageIdempotencyMigration,
        revalidateApplied: true,
      }),
    ],
  ]);
}

function verifyBoundedRemoteMigrations(migrations, registry) {
  return canonicalMigrationOrder(migrations).flatMap(migration => {
    const descriptor = registry.get(migration.file);
    if (!descriptor) return [];
    if (
      descriptor.file !== migration.file ||
      !/^[a-f0-9]{64}$/u.test(String(descriptor.checksum || '')) ||
      typeof descriptor.verifyArtifact !== 'function' ||
      typeof descriptor.dispatch !== 'function' ||
      descriptor.revalidateApplied !== true
    ) {
      const error = new Error(`Bounded migration registry entry is invalid: ${migration.file}`);
      error.code = 'bounded_migration_registry_entry_invalid';
      throw error;
    }
    const verified = descriptor.verifyArtifact(migration.fullPath);
    if (migration.checksum !== descriptor.checksum || verified.checksum !== migration.checksum) {
      const error = new Error(`Bounded migration checksum cannot be dispatched: ${migration.file}`);
      error.code = 'bounded_migration_dispatch_checksum_mismatch';
      throw error;
    }
    return [{ migration, descriptor }];
  });
}

function planPendingRemoteSharedSchemaMigrations(remoteConfig, options = {}) {
  const trackingTable = options.trackingTable || DEFAULT_TRACKING_TABLE;
  if (trackingTable !== DEFAULT_TRACKING_TABLE) {
    const error = new Error('Remote migration planning supports only iset_migration');
    error.code = 'remote_migration_ledger_tracking_table_invalid';
    throw error;
  }
  const migrations = canonicalMigrationOrder(
    options.migrations || getCanonicalMigrationFiles({ migrationsDir: options.migrationsDir })
  );
  const boundedRegistry = options.boundedMigrationRegistry || createBoundedRemoteMigrationRegistry(options);
  const boundedMigrations = verifyBoundedRemoteMigrations(migrations, boundedRegistry);
  const readRemoteMigrationLedger = options.readRemoteMigrationLedger || fetchRemoteAppliedMigrationRows;
  const remoteLedger = options.remoteLedger || readRemoteMigrationLedger(remoteConfig, {
    trackingTable,
    dispatchRemoteMigrationLedgerReader: options.dispatchRemoteMigrationLedgerReader,
  });
  const { trackingTableExists, rows: appliedRows, schemaEvidence = null } = remoteLedger;
  assertNoMigrationChecksumDrift(migrations, appliedRows);
  const successfulAppliedMap = new Map(
    appliedRows
      .filter(row => Number(row.success) === 1)
      .map(row => [`${row.filename}|${row.checksum}`, row])
  );
  const pending = migrations.filter(migration => !successfulAppliedMap.has(`${migration.file}|${migration.checksum}`));
  const failures = classifyMigrationFailures(migrations, appliedRows);
  const specialDispatches = boundedMigrations.map(({ migration, descriptor }) => {
    const applied = successfulAppliedMap.has(`${migration.file}|${migration.checksum}`);
    return {
      file: migration.file,
      checksum: migration.checksum,
      executor: descriptor.executor,
      action: applied && descriptor.revalidateApplied ? 'revalidate' : 'apply-and-verify',
      rawSqlFallbackAllowed: false,
    };
  });

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
    specialDispatches,
    schemaEvidence,
  };
}

function applyPendingRemoteSharedSchemaMigrations(remoteConfig, options = {}) {
  const logger = options.logger || console;
  const plan = planPendingRemoteSharedSchemaMigrations(remoteConfig, options);
  const attempted = [];
  let haltedOnFailure = false;
  const migrations = canonicalMigrationOrder(
    options.migrations || getCanonicalMigrationFiles({ migrationsDir: options.migrationsDir })
  );
  const boundedRegistry = options.boundedMigrationRegistry || createBoundedRemoteMigrationRegistry(options);
  const boundedMigrations = verifyBoundedRemoteMigrations(migrations, boundedRegistry);
  const unsupportedPending = plan.pending.filter(
    migration => !boundedRegistry.has(migration.file)
  );
  if (unsupportedPending.length) {
    const error = new Error(
      'Remote schema apply requires a dedicated live-schema-proven bounded executor for: ' +
      unsupportedPending.map(migration => migration.file).join(', ')
    );
    error.code = 'remote_generic_migration_bounded_dispatch_required';
    error.pending = unsupportedPending.map(migration => ({
      file: migration.file,
      checksum: migration.checksum,
    }));
    throw error;
  }

  for (const { migration, descriptor } of boundedMigrations) {
    const dispatchPlan = plan.specialDispatches.find(item => item.file === migration.file);
    const startedAt = Date.now();
    try {
      const dispatchResult = descriptor.dispatch(remoteConfig, migration, {
        mode: dispatchPlan.action === 'revalidate' ? 'revalidate' : 'apply',
      });
      attempted.push({
        file: migration.file,
        checksum: migration.checksum,
        durationMs: Date.now() - startedAt,
        success: true,
        errorSnippet: null,
        execution: 'bounded-dispatch',
        action: dispatchPlan.action,
        dispatchResult,
      });
      logger.log(
        `[migrations] ${dispatchPlan.action === 'revalidate' ? 'Revalidated' : 'Applied'} ` +
        `${migration.file} through ${descriptor.executor} on ${remoteConfig.targetEnv}`
      );
    } catch (error) {
      const errorSnippet = redactBoundedCommandOutput(error?.message || error).slice(0, 500);
      attempted.push({
        file: migration.file,
        checksum: migration.checksum,
        durationMs: Date.now() - startedAt,
        success: false,
        errorSnippet,
        execution: 'bounded-dispatch',
        action: dispatchPlan.action,
        dispatchResult: error?.summary || null,
        error: serializeMigrationError(error),
      });
      haltedOnFailure = true;
      logger.error(`[migrations] FAILED bounded dispatch for ${migration.file}: ${errorSnippet}`);
      return assertMigrationApplySucceeded({
        ...plan,
        attempted,
        haltedOnFailure,
      }, { context: `Schema migration apply on ${remoteConfig.targetEnv}` });
    }
  }

  return assertMigrationApplySucceeded({
    ...plan,
    attempted,
    haltedOnFailure: false,
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

  assertApplyAuthorization(args);

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
    reportSchemaMigrationCliFailure(error, process.argv.slice(2));
    process.exitCode = 1;
  });
}

module.exports = {
  DURABLE_SCHEMA_EVIDENCE_PREFIX,
  REMOTE_TARGETS,
  TEMP_REMOTE_STAGING_PREFIX,
  VERIFIED_DEV_SCHEMA_IDENTITY,
  applyPendingRemoteSharedSchemaMigrations,
  assertApplyAuthorization,
  buildSchemaMigrationCliFailurePayload,
  createBoundedRemoteMigrationRegistry,
  createPresignedS3PutUrl,
  createRemoteMigrationLedgerReaderBundle,
  createSecureMessageIdempotencyExecutorBundle,
  createDevSchemaPlanGuard,
  deleteStagedS3Object,
  discoverRemoteMigrationInstance,
  dispatchRemoteMigrationLedgerReader,
  dispatchSecureMessageIdempotencyMigration,
  dispatchTypedLineageMigration,
  fetchRemoteAppliedMigrationRows,
  findAndVerifyTypedLineageMigration,
  parseRemoteMigrationLedgerResult,
  parseSecureMessageIdempotencyRemoteSummary,
  parseArgs,
  planPendingRemoteSharedSchemaMigrations,
  proveRemoteAwsIdentity,
  reportSchemaMigrationCliFailure,
  serializeMigrationError,
  stageRemoteMigrationLedgerReaderBundle,
  validateRemoteMigrationLedgerResult,
  validateSecureMessageIdempotencyDispatchResult,
  validateTypedLineageDispatchResult,
  verifyBoundedRemoteMigrations,
};
