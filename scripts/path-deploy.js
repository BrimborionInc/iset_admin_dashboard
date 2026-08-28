#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');
const archiver = require('archiver');
const dotenv = require('dotenv');
const { assertMigrationApplySucceeded } = require('../src/lib/sharedSchemaMigrationRunner');
const {
  buildImmutableArtifactRecord,
  buildPreflightPlan,
  createReleaseDescriptor,
  sha256File,
  validatePrebuiltBuild,
  writeBuildManifest,
} = require('./lib/releaseAdmission');
const {
  sha256Files,
  sha256Json,
  validateQualificationEvidence,
} = require('../src/lib/releaseQualification');

const REPO_ROOT = path.resolve(__dirname, '..');
const PORTAL_ROOT = path.resolve(REPO_ROOT, '..', 'ISET-intake');
const SHARED_ROOT = path.resolve(REPO_ROOT, '..', 'shared');
const PROD_ARTIFACT_BUCKET = 'nwac-prod-artifacts';
const PROD_ASG_NAME = 'nwac-prod-asg';
const PROD_INSTANCE_REFRESH_PREFERENCES = 'MinHealthyPercentage=100,InstanceWarmup=180,SkipMatching=false';
const ADMIN_SUPPORT_SCRIPT_FILES = [
  'application-assessment-backfill.js',
  'application-assessment-context-backfill.js',
  'application-assessment-option-b-smoke.js',
];
const RETIRED_RELEASE_ARTIFACT_PATHS = Object.freeze([
  'scripts/cfa-signing-test-smoke.js',
  'scripts/cfa-signing-schema-preflight.js',
  'scripts/path-release-qualify.js',
  'scripts/path-test-runtime-postflight.js',
]);
const EXPECTED_RELEASE_REPO_BASENAMES = Object.freeze({
  adminDashboard: 'admin-dashboard',
  portal: 'ISET-intake',
  shared: 'shared',
});
const ADMIN_REQUIRED_RUNTIME_DIRECTORIES = [
  'src',
  'templates',
  'blocksteps',
  'public',
];
const PORTAL_REQUIRED_RUNTIME_DIRECTORIES = [
  'auth',
  'notifications',
  'pdf',
  'public',
  'src',
];
const PORTAL_OPTIONAL_MANAGED_DIRECTORIES = [
  'db',
];
const PORTAL_REQUIRED_ARTIFACT_FILES = [
  'build/index.html',
  'public/NWAC_logo.png',
  '.path-release-provenance.json',
  'package.json',
  'package-lock.json',
  'server.js',
  'migrationRunner.js',
  'mimeSniff.js',
  'uploadPolicy.js',
  's3Provider.js',
  'sesMailer.js',
];
const PORTAL_TEST_REQUIRED_ARTIFACT_FILES = [
  ...PORTAL_REQUIRED_ARTIFACT_FILES,
  '.env.test',
  '.env',
];
const ADMIN_ENVIRONMENT_CONTRACTS = Object.freeze({
  test: Object.freeze({
    NODE_ENV: 'production',
    API_BASE: 'https://nwac-console-test.awentech.ca',
    REACT_APP_API_BASE_URL: 'https://nwac-console-test.awentech.ca',
    ALLOWED_ORIGIN: 'https://nwac-console-test.awentech.ca,https://nwac-public-test.awentech.ca',
    DB_HOST: 'nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com',
    DB_PORT: '3306',
    DB_USER: 'app_admin',
    DB_NAME: 'iset_intake',
    AUTH_PROVIDER: 'cognito',
    AWS_REGION: 'ca-central-1',
    COGNITO_USER_POOL_ID: 'ca-central-1_uvypDUOwa',
    COGNITO_CLIENT_ID: '28pk6qvqhcmagvhoctas5578i3',
    COGNITO_STAFF_USER_POOL_ID: 'ca-central-1_uvypDUOwa',
    COGNITO_STAFF_CLIENT_ID: '28pk6qvqhcmagvhoctas5578i3',
    REACT_APP_AWS_REGION: 'ca-central-1',
    REACT_APP_COGNITO_DOMAIN_PREFIX: 'nwac-test-admin-d34ebb',
    REACT_APP_COGNITO_CLIENT_ID: '28pk6qvqhcmagvhoctas5578i3',
    REACT_APP_COGNITO_REDIRECT_URI: 'https://nwac-console-test.awentech.ca/auth/callback',
    REACT_APP_COGNITO_LOGOUT_URI: 'https://nwac-console-test.awentech.ca/',
    REACT_APP_USE_DYNAMIC_REDIRECT: 'true',
    REACT_APP_ALLOW_REDIRECT_ORIGIN_MISMATCH: 'false',
    REACT_APP_PORTAL_URL: 'https://nwac-public-test.awentech.ca/',
    UPLOAD_DRIVER: 's3',
    OBJECT_BUCKET: 'nwac-test-uploads-20251014',
    OBJECT_REGION: 'ca-central-1',
    DEV_AUTH_BYPASS: 'false',
    DEV_AUTH_OPEN: 'false',
    DEV_AUTH_RELAXED: 'false',
    DEV_DISABLE_AUTH: 'false',
  }),
  prod: Object.freeze({
    NODE_ENV: 'production',
    API_BASE: 'https://nwac-console.awentech.ca',
    REACT_APP_API_BASE_URL: 'https://nwac-console.awentech.ca',
    ALLOWED_ORIGIN: 'https://nwac-console.awentech.ca,https://iset.nwac.ca,https://nwac-public.awentech.ca',
    AUTH_PROVIDER: 'cognito',
    AWS_REGION: 'ca-central-1',
    COGNITO_USER_POOL_ID: 'ca-central-1_IBtdWzSIW',
    COGNITO_CLIENT_ID: 'vto9m0e32fkao737pva52on5h',
    COGNITO_STAFF_USER_POOL_ID: 'ca-central-1_IBtdWzSIW',
    COGNITO_STAFF_CLIENT_ID: 'vto9m0e32fkao737pva52on5h',
    REACT_APP_AWS_REGION: 'ca-central-1',
    REACT_APP_COGNITO_DOMAIN_PREFIX: 'nwac-prod-admin-458181',
    REACT_APP_COGNITO_CLIENT_ID: 'vto9m0e32fkao737pva52on5h',
    REACT_APP_COGNITO_REDIRECT_URI: 'https://nwac-console.awentech.ca/auth/callback',
    REACT_APP_COGNITO_LOGOUT_URI: 'https://nwac-console.awentech.ca/',
    REACT_APP_USE_DYNAMIC_REDIRECT: 'true',
    REACT_APP_ALLOW_REDIRECT_ORIGIN_MISMATCH: 'false',
    COGNITO_DOMAIN: 'https://nwac-prod-admin-458181.auth.ca-central-1.amazoncognito.com',
    COGNITO_REDIRECT_URI: 'https://nwac-console.awentech.ca/auth/callback',
    REACT_APP_PORTAL_URL: 'https://iset.nwac.ca/',
  }),
});
const ADMIN_ENVIRONMENT_REQUIRED_SECRET_KEYS = Object.freeze({
  test: Object.freeze(['DB_PASS', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']),
  prod: Object.freeze([]),
});
const RELEASE_QUALIFICATION_INVENTORY = path.join(REPO_ROOT, 'docs', 'testing', 'release-coverage-inventory.json');

const ENVIRONMENTS = {
  test: {
    name: 'test',
    profile: 'nwac-test',
    region: 'ca-central-1',
    expectedAccountId: '124355655255',
    dbClusterIdentifier: 'nwac-test-db',
    smokeMode: 'target-group',
    targetGroups: {
      admin: 'nwac-test-admin-tg',
      portal: 'nwac-test-portal-tg',
    },
  },
  prod: {
    name: 'prod',
    profile: 'nwac-prod',
    region: 'ca-central-1',
    expectedAccountId: '468278742295',
    dbClusterIdentifier: 'nwac-prod-db',
    smokeMode: 'public-http',
    adminSmokeUrl: 'https://nwac-console.awentech.ca/readyz',
    portalSmokeUrls: [
      'https://iset.nwac.ca/readyz',
      'https://nwac-public.awentech.ca/readyz',
    ],
  },
};

function usage() {
  console.log([
    'Usage: node scripts/path-deploy.js [plan|run|smoke|recover-test] --env <test|prod> [options]',
    '',
    'Examples:',
    '  node scripts/path-deploy.js plan --env test --skip-data',
    '  node scripts/path-deploy.js --env test --skip-data --release-id <release-id> --qualification-evidence <DEV-GO.json>',
    '  node scripts/path-deploy.js --env test --refresh-test-db --skip-data --release-id <release-id> --qualification-evidence <DEV-GO.json> --yes',
    '  node scripts/path-deploy.js run --env prod --skip-data --release-id <release-id> --qualification-evidence <TEST-GO.json> --yes',
    '  node scripts/path-deploy.js run --env prod --skip-schema --skip-data --release-id <release-id> --qualification-evidence <KNOWN-EVIDENCE.json> --emergency-release --emergency-release-reason <reason> --yes',
    '  node scripts/path-deploy.js run --env prod --dataset intake-release --workflow-id 21 --release-id <release-id> --qualification-evidence <TEST-GO.json> --yes  # explicit runtime/config promotion only',
    '  node scripts/path-deploy.js run --env test --skip-data --release-id <release-id> --skip-qualification --yes  # qualification system unavailable',
    '  node scripts/path-deploy.js recover-test --env test --release-id <failed-release-id> --yes',
    '  node scripts/path-deploy.js run --env prod --skip-schema --skip-data --release-id <release-id> --skip-qualification --yes  # qualification system unavailable',
    '',
    'Options:',
    '  --env NAME             Target environment: test or prod',
    '  --release-id ID        Optional operator-friendly release label',
    '  --profile NAME         AWS profile override for the target environment',
    '  --region REGION        AWS region override. Default: ca-central-1',
    '  --dataset NAME         Optional allowlisted data-sync dataset to apply',
    '  --workflow-id ID       Required for intake-release / workflow-authoring',
    '  --source-env NAME      Data-sync source env. Default: dev',
    '  --source-env-file PATH Data-sync source env file. Default: .env',
    '  --admin-env-file PATH  Exact external admin build/runtime config artifact for the target',
    '  --admin-env-sha256 HEX Required reviewed SHA-256 for --admin-env-file',
    '  --refresh-test-db      Rebuild TEST DB from the source env before data/app deploy steps',
    '  --skip-schema          Do not apply canonical schema migrations',
    '  --skip-data            Do not apply allowlisted data promotion',
    '  --skip-admin           Do not deploy the admin app',
    '  --skip-portal          Do not deploy the portal app',
    '  --skip-shared          Do not upload shared for prod',
    '  --skip-build           Pass through to the app deploy scripts',
    '  --skip-smoke           Skip post-deploy health checks',
    '  --skip-qualification   Bypass GO evidence gate when qualification system is unavailable; records UNQUALIFIED in manifest and provenance',
    '  --compatibility-only   PROD recovery: update live *-latest.zip artifacts without immutable release objects',
    '  --qualification-evidence PATH  Required GO evidence: DEV for TEST, TEST for PROD',
    '  --emergency-release    PROD app-only override of qualification admission; preserves supplied evidence and normal preflight/smoke controls',
    '  --emergency-release-reason TEXT  Required explicit operator reason for --emergency-release',
    '  --yes                  Required for prod run',
    '  --json                 Emit machine-readable JSON',
    '  --help                 Show this help',
    '',
    'Notes:',
    '  - If no command is provided, `run` is assumed.',
    '  - TEST app deploys stage both candidates, preserve the running apps on-host, and cut over through a recoverable SSM transaction.',
    '  - App releases require clean committed detached sibling worktrees; dirty-source overrides are not accepted.',
    '  - Prod app deploys upload artifacts, then run a waited ASG instance refresh.',
    '  - TEST runs with --refresh-test-db are destructive and therefore also require --yes.',
    '  - Prod runs that change schema or allowlisted data capture an RDS cluster snapshot restore point before mutation.',
    '  - --skip-qualification bypasses only the GO evidence gate; source checks, builds, lint, privacy, smoke, and rollback recording still run.',
    '  - --skip-qualification cannot be combined with --qualification-evidence.',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = {
    command: null,
    env: null,
    releaseId: null,
    profile: null,
    region: null,
    dataset: null,
    workflowId: null,
    sourceEnv: 'dev',
    sourceEnvFile: null,
    adminEnvFile: null,
    adminEnvSha256: null,
    refreshTestDb: false,
    skipSchema: false,
    skipData: false,
    skipAdmin: false,
    skipPortal: false,
    skipShared: false,
    skipBuild: false,
    skipSmoke: false,
    compatibilityOnly: false,
    allowDirty: false,
    dirtyReason: null,
    qualificationEvidence: null,
    skipQualification: false,
    emergencyRelease: false,
    emergencyReleaseReason: null,
    yes: false,
    json: false,
  };

  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--env') {
      args.env = String(argv[++index] || '').toLowerCase();
    } else if (token === '--release-id') {
      args.releaseId = argv[++index];
    } else if (token === '--profile') {
      args.profile = argv[++index];
    } else if (token === '--region') {
      args.region = argv[++index];
    } else if (token === '--dataset') {
      args.dataset = argv[++index];
    } else if (token === '--workflow-id') {
      args.workflowId = argv[++index];
    } else if (token === '--source-env') {
      args.sourceEnv = argv[++index];
    } else if (token === '--source-env-file') {
      args.sourceEnvFile = argv[++index];
    } else if (token === '--admin-env-file') {
      args.adminEnvFile = argv[++index];
    } else if (token === '--admin-env-sha256') {
      args.adminEnvSha256 = argv[++index];
    } else if (token === '--refresh-test-db') {
      args.refreshTestDb = true;
    } else if (token === '--skip-schema') {
      args.skipSchema = true;
    } else if (token === '--skip-data') {
      args.skipData = true;
    } else if (token === '--skip-admin') {
      args.skipAdmin = true;
    } else if (token === '--skip-portal') {
      args.skipPortal = true;
    } else if (token === '--skip-shared') {
      args.skipShared = true;
    } else if (token === '--skip-build') {
      args.skipBuild = true;
    } else if (token === '--skip-smoke') {
      args.skipSmoke = true;
    } else if (token === '--skip-qualification') {
      args.skipQualification = true;
    } else if (token === '--compatibility-only') {
      args.compatibilityOnly = true;
    } else if (token === '--allow-dirty') {
      args.allowDirty = true;
    } else if (token === '--dirty-reason') {
      args.dirtyReason = argv[++index];
    } else if (token === '--qualification-evidence') {
      args.qualificationEvidence = path.resolve(argv[++index] || '');
    } else if (token === '--emergency-release') {
      args.emergencyRelease = true;
    } else if (token === '--emergency-release-reason') {
      args.emergencyReleaseReason = argv[++index];
    } else if (token === '--yes') {
      args.yes = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--help' || token === '-h') {
      args.command = 'help';
    } else {
      positional.push(token);
    }
  }

  if (!args.command && positional.length && !positional[0].startsWith('--')) {
    const possibleCommand = String(positional[0]).toLowerCase();
    if (possibleCommand === 'plan' || possibleCommand === 'run' || possibleCommand === 'smoke' || possibleCommand === 'recover-test') {
      args.command = possibleCommand;
      positional.shift();
    }
  }

  if (!args.command) {
    args.command = 'run';
  }

  return args;
}

function validateQualificationModeArgs(args) {
  if (!args.skipQualification) return;
  if (args.qualificationEvidence) {
    throw new Error('--skip-qualification and --qualification-evidence are mutually exclusive');
  }
  if (args.emergencyRelease || args.emergencyReleaseReason) {
    throw new Error('--skip-qualification cannot be combined with --emergency-release or --emergency-release-reason');
  }
  if (!args.yes) {
    throw new Error('--skip-qualification requires --yes to acknowledge the unqualified deployment record');
  }
}

function assertTestRuntimeSmokeRequired(args, envConfig, appPlan = buildAppPlan(args, envConfig)) {
  const changesTestRuntime = envConfig.name === 'test' && Boolean(
    appPlan.deployAdmin || appPlan.deployPortal || appPlan.deployShared
  );
  if (changesTestRuntime && args.skipSmoke) {
    throw new Error('A TEST runtime deployment cannot use --skip-smoke; exact readiness, provenance, and target-group smoke are mandatory.');
  }
  return { required: changesTestRuntime, skipped: !changesTestRuntime };
}

function getEnvironmentConfig(args) {
  const base = ENVIRONMENTS[args.env];
  if (!base) {
    throw new Error(`Unsupported environment: ${args.env || '<missing>'}`);
  }
  const region = args.region || base.region;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/u.test(String(region || '')) || String(region).length > 63) {
    throw new Error('--region must be a valid literal AWS region name.');
  }
  return {
    ...base,
    profile: args.profile || base.profile,
    region,
  };
}

function needsAdminDeployConfig(appPlan) {
  return Boolean(appPlan?.deployAdmin || appPlan?.deployShared);
}

function assertAdminEnvironmentContract(environmentName, parsedConfig) {
  const contract = ADMIN_ENVIRONMENT_CONTRACTS[environmentName];
  if (!contract) throw new Error(`No admin environment contract is registered for '${environmentName}'.`);
  const mismatches = Object.entries(contract)
    .filter(([key, expected]) => String(parsedConfig?.[key] || '') !== String(expected))
    .map(([key]) => key);
  if (mismatches.length) {
    throw new Error(
      `Admin deploy configuration does not match the proven ${environmentName.toUpperCase()} target contract: ${mismatches.join(', ')}`
    );
  }
  const missingSecretKeys = (ADMIN_ENVIRONMENT_REQUIRED_SECRET_KEYS[environmentName] || [])
    .filter(key => !String(parsedConfig?.[key] || '').trim());
  if (missingSecretKeys.length) {
    throw new Error(
      `Admin deploy configuration is missing required ${environmentName.toUpperCase()} secret inputs: ${missingSecretKeys.join(', ')}`
    );
  }
}

function captureAdminDeployConfig(args, envConfig, { snapshot = false } = {}) {
  const sourcePath = path.resolve(
    args.adminEnvFile || path.join(REPO_ROOT, envConfig.name === 'prod' ? '.env.production' : '.env.test')
  );
  const expectedSha256 = String(args.adminEnvSha256 || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256)) {
    throw new Error('--admin-env-sha256 must be the reviewed 64-character SHA-256 of the exact admin config artifact.');
  }
  let sourceStat;
  try {
    sourceStat = fs.lstatSync(sourcePath);
  } catch (_) {
    throw new Error(`Admin deploy configuration not found: ${sourcePath}`);
  }
  if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) {
    throw new Error('Admin deploy configuration must be a regular, non-symlink file.');
  }
  if (sourceStat.mode & 0o077) {
    throw new Error('Admin deploy configuration must not be readable or writable by group/other users.');
  }
  const content = fs.readFileSync(sourcePath);
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  if (sha256 !== expectedSha256) {
    throw new Error(`Admin deploy configuration SHA-256 mismatch: found ${sha256}, expected ${expectedSha256}.`);
  }
  let parsedConfig;
  try {
    parsedConfig = dotenv.parse(content);
  } catch (_) {
    throw new Error('Admin deploy configuration could not be parsed.');
  }
  assertAdminEnvironmentContract(envConfig.name, parsedConfig);

  let snapshotRoot = null;
  let snapshotPath = null;
  if (snapshot) {
    snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'path-admin-config-'));
    snapshotPath = path.join(snapshotRoot, 'admin.env');
    fs.writeFileSync(snapshotPath, content, { flag: 'wx', mode: 0o600 });
    const snapshotStat = fs.statSync(snapshotPath);
    if (snapshotStat.mode & 0o077) {
      removePath(snapshotRoot);
      throw new Error('Frozen admin deploy configuration permissions are not private.');
    }
  }
  return {
    environment: envConfig.name,
    purpose: envConfig.name === 'prod'
      ? 'admin_frontend_build_config'
      : 'admin_frontend_build_and_runtime_config',
    sha256,
    bytes: content.length,
    sourcePath,
    snapshotRoot,
    snapshotPath,
  };
}

function adminDeployConfigEvidence(configState) {
  if (!configState) return null;
  return {
    environment: configState.environment,
    purpose: configState.purpose,
    sha256: configState.sha256,
    bytes: configState.bytes,
  };
}

function assertAdminDeployConfigSourceUnchanged(configState) {
  if (!configState) return { skipped: true };
  const current = fs.lstatSync(configState.sourcePath);
  if (current.isSymbolicLink() || !current.isFile()) {
    throw new Error('Admin deploy configuration changed type after admission.');
  }
  const currentSha256 = sha256File(configState.sourcePath);
  if (currentSha256 !== configState.sha256 || current.size !== configState.bytes) {
    throw new Error('Admin deploy configuration changed after admission.');
  }
  if (configState.snapshotPath) {
    const snapshotSha256 = sha256File(configState.snapshotPath);
    const snapshotStat = fs.statSync(configState.snapshotPath);
    if (snapshotSha256 !== configState.sha256 || snapshotStat.size !== configState.bytes) {
      throw new Error('Frozen admin deploy configuration changed after admission.');
    }
  }
  return { status: 'passed', sha256: configState.sha256, bytes: configState.bytes };
}

function buildSanitizedFrontendEnvironment(extra = {}) {
  const allowedKeys = [
    'PATH', 'SystemRoot', 'WINDIR', 'HOME', 'USER', 'LOGNAME',
    'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ',
  ];
  const clean = {};
  allowedKeys.forEach(key => {
    if (typeof process.env[key] === 'string') clean[key] = process.env[key];
  });
  return { ...clean, ...extra };
}

function assertSafeReleaseId(value) {
  const releaseId = String(value || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(releaseId)) {
    throw new Error('--release-id must be 1-128 characters using only letters, numbers, dot, underscore, or hyphen, and must start with a letter or number.');
  }
  return releaseId;
}

function buildReleaseId(args) {
  if (args.releaseId) {
    return assertSafeReleaseId(args.releaseId);
  }
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return assertSafeReleaseId(`${yyyy}${mm}${dd}-${hh}${mi}${ss}`);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    encoding: options.encoding || 'utf8',
    env: options.env || process.env,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.status !== 0) {
    const output = options.capture
      ? (result.stderr || result.stdout || `${command} ${args.join(' ')} failed`).trim()
      : `${command} ${args.join(' ')} failed with exit code ${result.status}`;
    throw new Error(output);
  }

  return options.capture ? result : null;
}

function quoteCmdArgument(value) {
  if (/[\s"]/u.test(value)) {
    return `"${String(value).replace(/"/g, '\\"')}"`;
  }
  return value;
}

function quoteBashArgument(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runJsonNodeScript(scriptPath, scriptArgs, cwd = REPO_ROOT) {
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs, '--json'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let parsed = null;
  try {
    parsed = JSON.parse(String(result.stdout || '').trim() || '{}');
  } catch (_) {
    parsed = null;
  }
  if (result.status !== 0) {
    const structuredMessage = parsed?.error?.message || parsed?.message || null;
    const stderr = sanitizeSsmOutput(String(result.stderr || '').trim());
    const error = new Error(structuredMessage || stderr || `${path.basename(scriptPath)} failed with exit code ${result.status}`);
    error.details = {
      script: path.basename(scriptPath),
      exitCode: result.status,
      result: parsed,
      stderr: stderr || null,
    };
    throw error;
  }
  if (!parsed) throw new Error(`${path.basename(scriptPath)} did not emit valid JSON.`);
  return parsed;
}

function runAwsRaw(args, envConfig) {
  const awsCommand = [
    'aws',
    ...args,
    '--profile',
    envConfig.profile,
    '--region',
    envConfig.region,
    '--output',
    'json',
  ].map(quoteBashArgument).join(' ');
  const commandText = `AWS_PAGER='' AWS_CLI_AUTO_PROMPT=off ${awsCommand}`;
  const result = runCommand('bash', ['-lc', commandText], { capture: true });
  return result.stdout || '';
}

function runAwsJson(args, envConfig) {
  const stdout = runAwsRaw(args, envConfig);
  return JSON.parse(stdout || '{}');
}

function runAwsNoOutput(args, envConfig) {
  const awsCommand = [
    'aws',
    ...args,
    '--profile',
    envConfig.profile,
    '--region',
    envConfig.region,
  ].map(quoteBashArgument).join(' ');
  const commandText = `AWS_PAGER='' AWS_CLI_AUTO_PROMPT=off ${awsCommand}`;
  runCommand('bash', ['-lc', commandText], { capture: true });
}

function normalizeSnapshotIdentifier(value) {
  const normalized = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const trimmed = normalized.slice(0, 63).replace(/-+$/g, '');
  return trimmed || 'path-prod-restore-point';
}

function buildRestorePointPlan(plan, envConfig) {
  if (envConfig.name !== 'prod') {
    return {
      skipped: true,
      reason: 'non-prod',
    };
  }

  const schemaWillChange = Number(plan.schema && plan.schema.pendingCount) > 0;
  const dataWillChange = Boolean(plan.data && !plan.data.skipped);
  if (!schemaWillChange && !dataWillChange) {
    return {
      skipped: true,
      reason: 'no-db-mutation-planned',
      dbClusterIdentifier: envConfig.dbClusterIdentifier,
    };
  }

  const releaseToken = normalizeSnapshotIdentifier(plan.releaseId);
  const timestampSuffix = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const snapshotIdentifier = normalizeSnapshotIdentifier(`path-prod-${releaseToken}-${timestampSuffix}`);
  return {
    skipped: false,
    dbClusterIdentifier: envConfig.dbClusterIdentifier,
    snapshotIdentifier,
    reason: schemaWillChange && dataWillChange
      ? 'schema-and-data'
      : schemaWillChange
        ? 'schema'
        : 'data',
  };
}

function captureProdRestorePoint(restorePointPlan, envConfig) {
  const created = runAwsJson([
    'rds',
    'create-db-cluster-snapshot',
    '--db-cluster-identifier',
    restorePointPlan.dbClusterIdentifier,
    '--db-cluster-snapshot-identifier',
    restorePointPlan.snapshotIdentifier,
  ], envConfig);

  runAwsNoOutput([
    'rds',
    'wait',
    'db-cluster-snapshot-available',
    '--db-cluster-snapshot-identifier',
    restorePointPlan.snapshotIdentifier,
  ], envConfig);

  const described = runAwsJson([
    'rds',
    'describe-db-cluster-snapshots',
    '--db-cluster-snapshot-identifier',
    restorePointPlan.snapshotIdentifier,
  ], envConfig);

  const snapshot = ((described.DBClusterSnapshots || [])[0] || (created.DBClusterSnapshot || null));
  return {
    dbClusterIdentifier: restorePointPlan.dbClusterIdentifier,
    snapshotIdentifier: restorePointPlan.snapshotIdentifier,
    status: snapshot && snapshot.Status ? snapshot.Status : 'available',
    snapshotArn: snapshot && snapshot.DBClusterSnapshotArn ? snapshot.DBClusterSnapshotArn : null,
    snapshotCreateTime: snapshot && snapshot.SnapshotCreateTime ? snapshot.SnapshotCreateTime : null,
    reason: restorePointPlan.reason,
  };
}

function printRestorePointSummary(restorePoint) {
  if (!restorePoint || restorePoint.skipped) {
    console.log(`Restore point: skipped (${restorePoint && restorePoint.reason ? restorePoint.reason : 'n/a'})`);
    return;
  }
  console.log(`Restore point: ${restorePoint.snapshotIdentifier} (${restorePoint.reason})`);
}

function getAwsIdentity(envConfig) {
  return runAwsJson(['sts', 'get-caller-identity'], envConfig);
}

function assertAwsIdentity(identity, envConfig) {
  if (String(identity.Account) !== String(envConfig.expectedAccountId)) {
    throw new Error(
      `AWS profile ${envConfig.profile} resolved to account ${identity.Account}, expected ${envConfig.expectedAccountId} for ${envConfig.name}`
    );
  }
}

function getGitHead(repoPath) {
  if (!fs.existsSync(repoPath)) {
    return null;
  }
  try {
    const result = runCommand('git', ['-C', repoPath, 'rev-parse', 'HEAD'], {
      capture: true,
      cwd: REPO_ROOT,
    });
    return (result.stdout || '').trim() || null;
  } catch (_) {
    return null;
  }
}

function getGitWorkingTreeFingerprint(repoPath) {
  if (!fs.existsSync(repoPath)) return null;
  const result = spawnSync('git', ['-C', repoPath, 'ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) return null;
  const files = result.stdout.toString('utf8').split('\0').filter(Boolean).sort();
  const hash = crypto.createHash('sha256');
  files.forEach(relative => {
    const full = path.join(repoPath, relative);
    hash.update(relative.split(path.sep).join('/'));
    hash.update('\0');
    try {
      const stat = fs.lstatSync(full);
      const entryType = stat.isSymbolicLink()
        ? 'symlink'
        : (stat.isFile() ? 'file' : 'unsupported');
      hash.update(entryType);
      hash.update('\0');
      hash.update(String(stat.mode & 0o7777));
      hash.update('\0');
      hash.update(stat.isSymbolicLink() ? fs.readlinkSync(full) : fs.readFileSync(full));
    } catch (_) {
      hash.update('<missing>');
    }
    hash.update('\0');
  });
  return hash.digest('hex');
}

function getGitStatusLines(repoPath) {
  if (!fs.existsSync(repoPath)) {
    return [];
  }
  try {
    const result = runCommand('git', ['-C', repoPath, 'status', '--porcelain'], {
      capture: true,
      cwd: REPO_ROOT,
    });
    return String(result.stdout || '')
      .split(/\r?\n/)
      .map(line => line.trimEnd())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function buildGitRepoState(repoPath, expectedBasename = null) {
  const resolvedPath = path.resolve(repoPath);
  let topLevel = null;
  let statusLines = [];
  let detachedHead = false;
  let branchName = null;
  let specialIndexFlags = [];
  const proofErrors = [];
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
    proofErrors.push('repository_path_missing');
  } else {
    const topLevelResult = spawnSync('git', ['-C', resolvedPath, 'rev-parse', '--show-toplevel'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (topLevelResult.status !== 0) {
      proofErrors.push('git_toplevel_unavailable');
    } else {
      topLevel = String(topLevelResult.stdout || '').trim() || null;
      let exactTopLevel = null;
      try {
        exactTopLevel = topLevel ? fs.realpathSync(topLevel) : null;
      } catch (_) {
        exactTopLevel = null;
      }
      if (!exactTopLevel || exactTopLevel !== fs.realpathSync(resolvedPath)) {
        proofErrors.push('git_toplevel_mismatch');
      }
    }
    if (expectedBasename && path.basename(resolvedPath) !== expectedBasename) {
      proofErrors.push('repository_basename_mismatch');
    }
    const symbolicRefResult = spawnSync('git', ['-C', resolvedPath, 'symbolic-ref', '-q', '--short', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (symbolicRefResult.status === 0) {
      branchName = String(symbolicRefResult.stdout || '').trim() || null;
      proofErrors.push('head_not_detached');
    } else if (symbolicRefResult.status === 1) {
      detachedHead = true;
    } else {
      proofErrors.push('detached_head_unavailable');
    }
    const statusResult = spawnSync('git', ['-C', resolvedPath, 'status', '--porcelain', '--untracked-files=all'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (statusResult.status !== 0) {
      proofErrors.push('git_status_unavailable');
    } else {
      statusLines = String(statusResult.stdout || '')
        .split(/\r?\n/u)
        .map(line => line.trimEnd())
        .filter(Boolean);
    }
    const specialFlagsResult = spawnSync('git', ['-C', resolvedPath, 'ls-files', '-v', '-z'], {
      cwd: REPO_ROOT,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (specialFlagsResult.status !== 0) {
      proofErrors.push('git_index_flags_unavailable');
    } else {
      specialIndexFlags = specialFlagsResult.stdout
        .toString('utf8')
        .split('\0')
        .filter(Boolean)
        .filter(record => {
          const tag = record.charAt(0);
          return tag === 'S' || (tag && tag === tag.toLowerCase());
        })
        .map(record => ({
          flag: record.charAt(0),
          path: record.slice(2),
        }));
      if (specialIndexFlags.length) {
        proofErrors.push('git_special_index_flags_present');
      }
    }
  }
  const gitHead = getGitHead(resolvedPath);
  const treeFingerprint = getGitWorkingTreeFingerprint(resolvedPath);
  if (!gitHead) proofErrors.push('git_head_unavailable');
  if (!treeFingerprint) proofErrors.push('git_tree_fingerprint_unavailable');
  return {
    path: resolvedPath,
    expectedBasename,
    basename: path.basename(resolvedPath),
    gitTopLevel: topLevel,
    repositoryValid: proofErrors.length === 0,
    repositoryProofErrors: proofErrors,
    gitHead,
    gitDetached: detachedHead,
    gitBranch: branchName,
    gitSpecialIndexFlagCount: specialIndexFlags.length,
    gitSpecialIndexFlags: specialIndexFlags.slice(0, 200),
    treeFingerprint,
    gitDirty: statusLines.length > 0,
    gitStatusCount: statusLines.length,
    gitStatus: statusLines.slice(0, 200),
  };
}

function slugify(value) {
  return String(value)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'release';
}

function getManifestPath(envName, releaseId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(REPO_ROOT, 'tmp', 'path-deploy', envName);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${slugify(releaseId)}--${stamp}.json`);
}

function serializeError(error) {
  return {
    message: error && error.message ? error.message : String(error),
    stack: error && error.stack ? error.stack : null,
    details: error && error.details ? error.details : null,
  };
}

function writeManifest(pathname, manifest) {
  fs.mkdirSync(path.dirname(pathname), { recursive: true });
  fs.writeFileSync(pathname, JSON.stringify(manifest, null, 2), 'utf8');
}

async function runStep(manifest, manifestPath, name, fn) {
  const step = {
    name,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  manifest.steps.push(step);
  writeManifest(manifestPath, manifest);

  try {
    const result = await fn();
    step.status = 'successful';
    step.finishedAt = new Date().toISOString();
    step.durationMs = Date.parse(step.finishedAt) - Date.parse(step.startedAt);
    if (result !== undefined) {
      step.result = result;
    }
    writeManifest(manifestPath, manifest);
    return result;
  } catch (error) {
    step.status = 'failed';
    step.finishedAt = new Date().toISOString();
    step.durationMs = Date.parse(step.finishedAt) - Date.parse(step.startedAt);
    step.error = serializeError(error);
    writeManifest(manifestPath, manifest);
    throw error;
  }
}

function buildTestDbRefreshPlan(args, envConfig) {
  if (envConfig.name !== 'test' || !args.refreshTestDb) {
    return {
      skipped: true,
      reason: envConfig.name !== 'test' ? 'non-test' : 'not-requested',
    };
  }

  const scriptArgs = [
    'plan',
    '--profile',
    envConfig.profile,
    '--region',
    envConfig.region,
    '--source-env',
    args.sourceEnv,
    '--skip-smoke',
  ];
  if (args.sourceEnvFile) {
    scriptArgs.push('--source-env-file', args.sourceEnvFile);
  }
  if (args.skipSchema) {
    scriptArgs.push('--skip-schema');
  }

  return runJsonNodeScript(path.join(REPO_ROOT, 'scripts', 'path-test-db-refresh.js'), scriptArgs);
}

function buildSchemaPlan(args, envConfig, testDbRefreshPlan) {
  if (args.skipSchema) {
    return {
      skipped: true,
      reason: 'skip-schema',
    };
  }
  if (envConfig.name === 'test' && testDbRefreshPlan && !testDbRefreshPlan.skipped) {
    return {
      skipped: true,
      reason: 'handled-by-test-db-refresh',
    };
  }
  return runJsonNodeScript(path.join(REPO_ROOT, 'scripts', 'path-schema-migrate.js'), [
    'plan',
    '--target-env',
    envConfig.name,
    '--profile',
    envConfig.profile,
    '--region',
    envConfig.region,
  ]);
}

function buildDataPlan(args, envConfig) {
  if (args.skipData || !args.dataset) {
    return {
      skipped: true,
      reason: args.skipData ? 'skip-data' : 'no-dataset',
    };
  }

  const scriptArgs = [
    'plan',
    '--dataset',
    args.dataset,
    '--source-env',
    args.sourceEnv,
    '--target-env',
    envConfig.name,
  ];
  if (args.workflowId) {
    scriptArgs.push('--workflow-id', args.workflowId);
  }
  if (args.sourceEnvFile) {
    scriptArgs.push('--env-file', args.sourceEnvFile);
  }

  return runJsonNodeScript(path.join(REPO_ROOT, 'scripts', 'path-data-sync.js'), scriptArgs);
}

function buildAppPlan(args, envConfig) {
  const deployShared = envConfig.name === 'prod' && !args.skipShared;
  const deployAdmin = !args.skipAdmin;
  const deployPortal = !args.skipPortal;
  const refreshProd = envConfig.name === 'prod' && (deployShared || deployAdmin || deployPortal);

  return {
    deployShared,
    deployAdmin,
    deployPortal,
    refreshProd,
    skipBuild: args.skipBuild,
    artifactMode: args.compatibilityOnly ? 'compatibility-only' : 'immutable-and-compatibility',
  };
}

function buildSmokeTargets(envConfig, args) {
  if (args.skipSmoke) {
    return [];
  }

  const includeAdmin = !args.skipAdmin || (envConfig.name === 'prod' && !args.skipShared);
  const includePortal = !args.skipPortal || (envConfig.name === 'prod' && !args.skipShared);
  const targets = [];
  if (envConfig.smokeMode === 'target-group') {
    if (includeAdmin) {
      targets.push({ service: 'admin', type: 'target-group', targetGroupName: envConfig.targetGroups.admin });
    }
    if (includePortal) {
      targets.push({ service: 'portal', type: 'target-group', targetGroupName: envConfig.targetGroups.portal });
    }
    return targets;
  }

  if (includeAdmin) {
    targets.push({ service: 'admin', type: 'url', url: envConfig.adminSmokeUrl });
  }
  if (includePortal) {
    envConfig.portalSmokeUrls.forEach(url => {
      targets.push({ service: 'portal', type: 'url', url });
    });
  }
  return targets;
}

function buildRollbackGuidance(envConfig) {
  if (envConfig.name !== 'prod') {
    return [
      'TEST app rollout failures automatically restore both on-host application backups and re-run readiness/target-group smoke.',
      'If automatic recovery cannot be proven, the manifest records recovery_required; resume it with recover-test for the exact release ID.',
      'If a schema migration fails in TEST, restore/reset TEST and re-run canonical migrations rather than patching by hand.',
    ];
  }

  return [
    'Default prod rollback is application rollback: re-upload the previous known-good artifacts and run a new prod instance refresh.',
    'Do not restore a prod DB snapshot after reopening traffic unless there is an explicit maintenance window and approval for potential data loss.',
    'If prod schema migration fails before app rollout, stop there, correct the migration, and re-run schema apply before refreshing instances.',
  ];
}

function buildPlanIntent(args, envConfig, identity) {
  const testDbRefreshRequested = envConfig.name === 'test' && args.refreshTestDb;
  const plan = {
    releaseId: buildReleaseId(args),
    command: args.command,
    environment: envConfig.name,
    profile: envConfig.profile,
    region: envConfig.region,
    identity: {
      account: identity.Account,
      arn: identity.Arn,
      userId: identity.UserId,
    },
    testDbRefresh: testDbRefreshRequested
      ? { skipped: false, resolved: false, sourceEnv: args.sourceEnv }
      : { skipped: true, reason: envConfig.name !== 'test' ? 'non-test' : 'not-requested' },
    schema: args.skipSchema
      ? { skipped: true, reason: 'skip-schema' }
      : (testDbRefreshRequested
          ? { skipped: true, reason: 'handled-by-test-db-refresh' }
          : { skipped: false, resolved: false, pendingCount: null }),
    data: args.skipData || !args.dataset
      ? { skipped: true, reason: args.skipData ? 'skip-data' : 'no-dataset' }
      : { skipped: false, resolved: false, dataset: { name: args.dataset } },
    app: buildAppPlan(args, envConfig),
    smoke: {
      targets: buildSmokeTargets(envConfig, args),
    },
    rollbackGuidance: buildRollbackGuidance(envConfig),
  };
  plan.restorePoint = { skipped: true, reason: 'awaiting-resolved-plan' };
  return plan;
}

function resolvePlan(args, envConfig, planIntent) {
  const testDbRefresh = buildTestDbRefreshPlan(args, envConfig);
  const resolved = {
    ...planIntent,
    testDbRefresh,
    schema: buildSchemaPlan(args, envConfig, testDbRefresh),
    data: buildDataPlan(args, envConfig),
  };
  resolved.restorePoint = buildRestorePointPlan(resolved, envConfig);
  return resolved;
}

function runNpmScript(scriptName, extraArgs, cwd) {
  if (process.platform === 'win32') {
    const cmd = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
    const commandText = ['npm', 'run', scriptName, '--', ...extraArgs].map(quoteCmdArgument).join(' ');
    runCommand(cmd, ['/d', '/s', '/c', commandText], { cwd });
    return;
  }
  runCommand('npm', ['run', scriptName, '--', ...extraArgs], { cwd });
}

function createIsolatedFrontendBuildProject(repoRoot, label = 'frontend') {
  const sourceFilesResult = spawnSync(
    'git',
    ['-C', repoRoot, 'ls-files', '-co', '--exclude-standard', '-z'],
    {
      cwd: REPO_ROOT,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  if (sourceFilesResult.status !== 0) {
    throw new Error(`Unable to enumerate ${label} source for isolated frontend build.`);
  }
  const nodeModulesPath = path.join(repoRoot, 'node_modules');
  if (!fs.existsSync(nodeModulesPath) || !fs.statSync(nodeModulesPath).isDirectory()) {
    throw new Error(`${label} node_modules is required for an isolated frontend build.`);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `path-${slugify(label)}-frontend-`));
  const projectRoot = path.join(tempRoot, 'project');
  fs.mkdirSync(projectRoot, { recursive: true });
  try {
    const sourceFiles = sourceFilesResult.stdout
      .toString('utf8')
      .split('\0')
      .filter(Boolean)
      .sort();
    sourceFiles.forEach(relativePath => {
      const normalized = relativePath.replace(/\\/gu, '/');
      if (
        !normalized ||
        path.isAbsolute(normalized) ||
        normalized === '..' ||
        normalized.startsWith('../') ||
        /^\.env(?:\.|$)/u.test(normalized)
      ) {
        return;
      }
      const sourcePath = path.join(repoRoot, normalized);
      let sourceStat;
      try {
        sourceStat = fs.lstatSync(sourcePath);
      } catch (error) {
        if (error?.code === 'ENOENT') return;
        throw error;
      }
      const destinationPath = path.join(projectRoot, normalized);
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      if (sourceStat.isSymbolicLink()) {
        fs.symlinkSync(fs.readlinkSync(sourcePath), destinationPath);
      } else if (sourceStat.isFile()) {
        fs.copyFileSync(sourcePath, destinationPath);
        fs.chmodSync(destinationPath, sourceStat.mode & 0o777);
      }
    });
    fs.symlinkSync(nodeModulesPath, path.join(projectRoot, 'node_modules'), 'dir');
    return { tempRoot, projectRoot };
  } catch (error) {
    removePath(tempRoot);
    throw error;
  }
}

function buildAdminFrontendBuildExpectation(args, envConfig, releaseId) {
  const configState = args.adminDeployConfigState;
  if (!configState?.snapshotPath) {
    throw new Error('A frozen admin deploy configuration is required before building or admitting admin artifacts.');
  }
  return {
    buildTarget: envConfig.name === 'prod' ? 'production' : 'test',
    releaseId,
    gitCommit: getGitHead(REPO_ROOT),
    allowDirty: envConfig.name === 'prod' && args.allowDirty,
    externalInputs: {
      adminEnvironment: adminDeployConfigEvidence(configState),
    },
  };
}

function buildPortalFrontendBuildExpectation(args, envConfig, releaseId) {
  return {
    buildTarget: envConfig.name === 'prod' ? 'production' : 'test',
    releaseId,
    gitCommit: getGitHead(PORTAL_ROOT),
    allowDirty: envConfig.name === 'prod' && args.allowDirty,
  };
}

function prepareAdminFrontendBuild(args, envConfig, releaseId) {
  const buildPath = path.join(REPO_ROOT, 'build');
  const expected = buildAdminFrontendBuildExpectation(args, envConfig, releaseId);
  const expectedBuildTarget = expected.buildTarget;
  const configState = args.adminDeployConfigState;
  const externalInputs = expected.externalInputs;
  if (!args.skipBuild && !args.preflightBuilds) {
    removePath(buildPath);
    const buildEnvironment = buildSanitizedFrontendEnvironment({
      BUILD_PATH: buildPath,
      PATH_DEPLOY_ENV: envConfig.name,
      PATH_RELEASE_ID: releaseId || '',
    });
    runCommand(process.execPath, [
      path.join(REPO_ROOT, 'scripts', 'write-build-info.js'),
      '--build-target',
      expectedBuildTarget,
    ], {
      cwd: REPO_ROOT,
      env: buildEnvironment,
    });
    const isolatedProject = createIsolatedFrontendBuildProject(REPO_ROOT, 'admin');
    try {
      runCommand(process.execPath, [
        path.join(REPO_ROOT, 'node_modules', 'env-cmd', 'bin', 'env-cmd.js'),
        '-f',
        configState.snapshotPath,
        process.execPath,
        path.join(REPO_ROOT, 'node_modules', 'react-scripts', 'bin', 'react-scripts.js'),
        'build',
      ], {
        cwd: isolatedProject.projectRoot,
        env: buildEnvironment,
      });
    } finally {
      removePath(isolatedProject.tempRoot);
    }
    assertAdminDeployConfigSourceUnchanged(configState);
    writeBuildManifest({ repoRoot: REPO_ROOT, buildPath, externalInputs });
  }
  if (!fs.existsSync(buildPath)) {
    throw new Error(`Build output not found at '${buildPath}'. Remove --skip-build or run the build step first.`);
  }
  validatePrebuiltBuild({
    repoRoot: REPO_ROOT,
    buildPath,
    expected,
  });
  return buildPath;
}

function preparePortalFrontendBuild(args, envConfig, releaseId) {
  const buildOutputDir = envConfig.name === 'test' ? 'build-test' : 'build';
  const shouldBuildIsolatedTestOutput = envConfig.name === 'test' && !args.skipBuild;
  const isolatedBuildKey = crypto.createHash('sha256')
    .update(String(releaseId || 'unlabelled-release'))
    .digest('hex')
    .slice(0, 16);
  const buildPath = args.portalBuildPath || (shouldBuildIsolatedTestOutput
    ? path.join(REPO_ROOT, 'tmp', 'path-deploy-builds', isolatedBuildKey, 'portal')
    : path.join(PORTAL_ROOT, buildOutputDir));
  const expected = buildPortalFrontendBuildExpectation(args, envConfig, releaseId);
  const expectedBuildTarget = expected.buildTarget;
  if (shouldBuildIsolatedTestOutput) {
    args.portalBuildPath = buildPath;
    args.portalBuildCleanupRoot = path.dirname(buildPath);
  }
  if (!args.skipBuild && !args.preflightBuilds) {
    removePath(buildPath);
    if (envConfig.name === 'test') {
      runCommand(process.execPath, [path.join(PORTAL_ROOT, 'scripts', 'write-build-info.js'), '--build-target', 'test'], {
        cwd: PORTAL_ROOT,
        env: buildSanitizedFrontendEnvironment({ PATH_DEPLOY_ENV: 'test', PATH_RELEASE_ID: releaseId || '' }),
      });
      const isolatedProject = createIsolatedFrontendBuildProject(PORTAL_ROOT, 'portal');
      try {
        runCommand(process.execPath, [
          path.join(PORTAL_ROOT, 'node_modules', 'env-cmd', 'bin', 'env-cmd.js'),
          '-f',
          path.join(PORTAL_ROOT, '.env.test'),
          process.execPath,
          path.join(PORTAL_ROOT, 'node_modules', '@craco', 'craco', 'dist', 'bin', 'craco.js'),
          'build',
        ], {
          cwd: isolatedProject.projectRoot,
          env: buildSanitizedFrontendEnvironment({
            BUILD_PATH: buildPath,
            PATH_DEPLOY_ENV: 'test',
            PATH_RELEASE_ID: releaseId || '',
          }),
        });
      } finally {
        removePath(isolatedProject.tempRoot);
      }
    } else {
      const buildEnvironment = buildSanitizedFrontendEnvironment({
        PATH_DEPLOY_ENV: 'prod',
        PATH_RELEASE_ID: releaseId || '',
      });
      runCommand(process.execPath, [
        path.join(PORTAL_ROOT, 'scripts', 'write-build-info.js'),
        '--build-target',
        'production',
      ], {
        cwd: PORTAL_ROOT,
        env: buildEnvironment,
      });
      const isolatedProject = createIsolatedFrontendBuildProject(PORTAL_ROOT, 'portal');
      try {
        runCommand(process.execPath, [
          path.join(PORTAL_ROOT, 'node_modules', 'env-cmd', 'bin', 'env-cmd.js'),
          '-f',
          path.join(PORTAL_ROOT, '.env.production'),
          process.execPath,
          path.join(PORTAL_ROOT, 'node_modules', '@craco', 'craco', 'dist', 'bin', 'craco.js'),
          'build',
        ], {
          cwd: isolatedProject.projectRoot,
          env: { ...buildEnvironment, BUILD_PATH: buildPath },
        });
      } finally {
        removePath(isolatedProject.tempRoot);
      }
    }
    writeBuildManifest({ repoRoot: PORTAL_ROOT, buildPath });
  }
  const resolvedPath = fs.existsSync(buildPath)
    ? buildPath
    : envConfig.name === 'test' && fs.existsSync(path.join(PORTAL_ROOT, 'build'))
      ? path.join(PORTAL_ROOT, 'build')
      : null;
  if (!resolvedPath) throw new Error('Portal build output not found. Remove --skip-build or run the build step first.');
  validatePrebuiltBuild({
    repoRoot: PORTAL_ROOT,
    buildPath: resolvedPath,
    expected,
  });
  return resolvedPath;
}

function joinS3Key(prefix, name) {
  if (!prefix) {
    return name;
  }
  return `${String(prefix).replace(/\/+$/u, '')}/${name}`;
}

function formatDeployTimestamp() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function removePath(pathname) {
  fs.rmSync(pathname, { recursive: true, force: true });
}

function copyFileIfExists(source, destination) {
  if (!fs.existsSync(source)) {
    return false;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
}

function copyDirectoryIfExists(source, destination) {
  if (!fs.existsSync(source)) {
    return false;
  }
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    filter: src => path.basename(src) !== '.git',
  });
  return true;
}

function copyRequiredFile(source, destination, label) {
  if (!copyFileIfExists(source, destination)) {
    throw new Error(`Required ${label} file not found: ${source}`);
  }
  return true;
}

function copyRequiredDirectory(source, destination, label) {
  if (!copyDirectoryIfExists(source, destination)) {
    throw new Error(`Required ${label} directory not found: ${source}`);
  }
  const entries = fs.readdirSync(destination);
  if (!entries.length) {
    throw new Error(`Required ${label} directory is empty: ${source}`);
  }
  return true;
}

function copyValidatedFrontendBuild({
  repoRoot,
  sourceBuildPath,
  destinationBuildPath,
  expected,
  label,
} = {}) {
  const sourceBefore = validatePrebuiltBuild({
    repoRoot,
    buildPath: sourceBuildPath,
    expected,
  });
  copyRequiredDirectory(sourceBuildPath, destinationBuildPath, `${label} build`);
  const sourceAfter = validatePrebuiltBuild({
    repoRoot,
    buildPath: sourceBuildPath,
    expected,
  });
  const staged = validatePrebuiltBuild({
    repoRoot,
    buildPath: destinationBuildPath,
    expected,
  });
  if (
    sourceBefore.assets.sha256 !== sourceAfter.assets.sha256 ||
    sourceBefore.assets.fileCount !== sourceAfter.assets.fileCount ||
    sourceAfter.assets.sha256 !== staged.assets.sha256 ||
    sourceAfter.assets.fileCount !== staged.assets.fileCount
  ) {
    throw new Error(`${label} build changed while it was frozen for artifact staging.`);
  }
  return staged;
}

function listGitAdmittedSourceFiles(repoRoot) {
  const result = spawnSync('git', ['-C', repoRoot, 'ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`Unable to enumerate admitted Git source files in ${repoRoot}.`);
  }
  return result.stdout
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map(relativePath => relativePath.replace(/\\/gu, '/'))
    .sort();
}

function listSourceDirectoryFiles(root, current = root) {
  return fs.readdirSync(current, { withFileTypes: true })
    .filter(entry => !(current === root && entry.name === '.git'))
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap(entry => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) return listSourceDirectoryFiles(root, fullPath);
      if (!entry.isFile() && !entry.isSymbolicLink()) return [];
      return [path.relative(root, fullPath).split(path.sep).join('/')];
    });
}

function copyAdmittedGitSourceDirectory(repoRoot, relativeDirectory, destination, label, { required = true } = {}) {
  const requestedDirectory = String(relativeDirectory || '.')
    .replace(/\\/gu, '/')
    .replace(/^\.\//u, '')
    .replace(/\/+$/u, '');
  const normalizedDirectory = requestedDirectory === '.' ? '' : requestedDirectory;
  const sourceDirectory = path.join(repoRoot, normalizedDirectory || '.');
  if (!fs.existsSync(sourceDirectory) || !fs.statSync(sourceDirectory).isDirectory()) {
    if (!required) return false;
    throw new Error(`Required ${label} directory not found: ${sourceDirectory}`);
  }
  const prefix = normalizedDirectory ? `${normalizedDirectory}/` : '';
  const admitted = listGitAdmittedSourceFiles(repoRoot)
    .filter(relativePath => !prefix || relativePath.startsWith(prefix));
  const admittedSet = new Set(admitted);
  const actual = listSourceDirectoryFiles(sourceDirectory)
    .map(relativePath => `${prefix}${relativePath}`);
  const unadmitted = actual.filter(relativePath => !admittedSet.has(relativePath));
  if (unadmitted.length) {
    throw new Error(
      `${label} contains ignored or otherwise unadmitted source files: ${unadmitted.slice(0, 20).join(', ')}`
    );
  }
  if (!admitted.length) {
    if (!required) return false;
    throw new Error(`Required ${label} directory has no admitted source files: ${sourceDirectory}`);
  }

  removePath(destination);
  let copiedFileCount = 0;
  for (const repoRelativePath of admitted) {
    const withinDirectory = prefix ? repoRelativePath.slice(prefix.length) : repoRelativePath;
    const sourcePath = path.join(repoRoot, repoRelativePath);
    let sourceStat;
    try {
      sourceStat = fs.lstatSync(sourcePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(`Admitted ${label} source file is missing: ${repoRelativePath}`);
      }
      throw error;
    }
    const destinationPath = path.join(destination, withinDirectory);
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    if (sourceStat.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(sourcePath), destinationPath);
      copiedFileCount += 1;
    } else if (sourceStat.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
      fs.chmodSync(destinationPath, sourceStat.mode & 0o777);
      copiedFileCount += 1;
    } else {
      throw new Error(`Admitted ${label} source entry is not a file or symlink: ${repoRelativePath}`);
    }
  }
  if (copiedFileCount !== admitted.length) {
    throw new Error(
      `${label} staging copied ${copiedFileCount} admitted files, expected ${admitted.length}.`
    );
  }
  return true;
}

function listArtifactFilePaths(root, current = root) {
  return fs.readdirSync(current, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap(entry => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) return listArtifactFilePaths(root, fullPath);
      if (!entry.isFile()) return [];
      return [path.relative(root, fullPath).split(path.sep).join('/')];
    });
}

function copyAdminSupportScripts(stagingPath) {
  const scriptsPath = path.join(stagingPath, 'scripts');
  ADMIN_SUPPORT_SCRIPT_FILES.forEach(file => {
    copyRequiredFile(
      path.join(REPO_ROOT, 'scripts', file),
      path.join(scriptsPath, file),
      'admin support script'
    );
  });
  return true;
}

function listAdminRuntimeMigrationArtifactPaths(repoRoot = REPO_ROOT) {
  const migrationsPath = path.join(repoRoot, 'sql', 'migrations');
  if (!fs.existsSync(migrationsPath)) {
    throw new Error(`Required admin migrations directory not found: ${migrationsPath}`);
  }
  const migrationFiles = fs.readdirSync(migrationsPath)
    .filter(file => file.endsWith('.sql'))
    .sort();
  if (!migrationFiles.length) {
    throw new Error(`Required admin migrations directory is empty: ${migrationsPath}`);
  }
  return migrationFiles.map(file => `sql/migrations/${file}`);
}

function copyAdminRuntimeSql(stagingPath, repoRoot = REPO_ROOT) {
  const copied = copyAdmittedGitSourceDirectory(
    repoRoot,
    'sql/migrations',
    path.join(stagingPath, 'sql', 'migrations'),
    'admin runtime SQL'
  );
  if (!copied) {
    throw new Error('Required admin runtime SQL directory not found: sql/migrations');
  }
  return true;
}

function writeStagingReleaseProvenance(stagingPath, {
  releaseId,
  environment,
  component,
  qualification,
  externalInputs = {},
}) {
  const provenance = {
    schemaVersion: 1,
    releaseId,
    environment,
    component,
    qualificationDecision: qualification?.decision || null,
    qualificationEvidenceId: qualification?.evidenceId || null,
    source: qualification?.candidate?.source || {},
    externalInputs,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(stagingPath, '.path-release-provenance.json'),
    `${JSON.stringify(provenance, null, 2)}\n`,
    'utf8'
  );
  return provenance;
}

function createZipFromDirectory(sourceDir, destinationZip) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destinationZip), { recursive: true });
    const output = fs.createWriteStream(destinationZip);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve({
      path: destinationZip,
      bytes: archive.pointer(),
    }));
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function listArchiveEntries(archivePath, component) {
  const listing = spawnSync('unzip', ['-Z1', archivePath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
  if (listing.status !== 0) {
    throw new Error(`Unable to inspect staged ${component} archive: ${String(listing.stderr || listing.error || '').trim()}`);
  }
  return new Set(
    String(listing.stdout || '')
      .split(/\r?\n/u)
      .map(value => value.replace(/^\.\//u, '').replace(/\\/gu, '/').replace(/\/$/u, ''))
      .filter(Boolean)
  );
}

function assertArchiveContains(archivePath, requiredPaths, component) {
  const entries = listArchiveEntries(archivePath, component);
  const missing = requiredPaths.filter(requiredPath => !entries.has(requiredPath));
  if (missing.length) {
    throw new Error(`Staged ${component} archive is missing required runtime/test content: ${missing.join(', ')}`);
  }
  return {
    component,
    status: 'passed',
    entryCount: entries.size,
    requiredPaths: [...requiredPaths],
  };
}

function assertArchiveExcludesPrefixes(archivePath, excludedPrefixes, component) {
  const entries = listArchiveEntries(archivePath, component);
  const normalizedPrefixes = excludedPrefixes
    .map(prefix => String(prefix || '').replace(/^\.\//u, '').replace(/\\/gu, '/').replace(/\/+$/u, ''))
    .filter(Boolean);
  const forbidden = Array.from(entries).filter(entry => normalizedPrefixes.some(prefix => (
    entry === prefix || entry.startsWith(`${prefix}/`)
  )));
  if (forbidden.length) {
    throw new Error(`Staged ${component} archive contains forbidden content: ${forbidden.join(', ')}`);
  }
  return {
    component,
    status: 'passed',
    entryCount: entries.size,
    excludedPrefixes: normalizedPrefixes,
  };
}

function assertArchiveScriptAllowlist(archivePath, allowedScriptFiles, component) {
  const entries = listArchiveEntries(archivePath, component);
  const allowed = new Set((allowedScriptFiles || []).map(file => `scripts/${String(file).replace(/\\/gu, '/')}`));
  const unexpected = Array.from(entries).filter(entry => (
    entry.startsWith('scripts/') && !allowed.has(entry)
  ));
  const missing = Array.from(allowed).filter(entry => !entries.has(entry));
  if (unexpected.length || missing.length) {
    throw new Error([
      `Staged ${component} archive does not match the exact runtime support-script allowlist.`,
      unexpected.length ? `Unexpected: ${unexpected.join(', ')}` : null,
      missing.length ? `Missing: ${missing.join(', ')}` : null,
    ].filter(Boolean).join(' '));
  }
  return {
    component,
    status: 'passed',
    allowedScriptFiles: Array.from(allowed).sort(),
  };
}

function assertArchiveEntrySha256(archivePath, entryPath, expectedSha256, component) {
  const extracted = spawnSync('unzip', ['-p', archivePath, entryPath], {
    cwd: REPO_ROOT,
    encoding: null,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
  if (extracted.status !== 0) {
    throw new Error(`Unable to read ${entryPath} from staged ${component} archive.`);
  }
  const actualSha256 = crypto.createHash('sha256').update(extracted.stdout).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Staged ${component} archive entry checksum mismatch: ${entryPath}`);
  }
  return { component, entryPath, sha256: actualSha256, status: 'passed' };
}

function sanitizeSsmOutput(value) {
  if (!value) {
    return value;
  }
  return String(value).replace(/[^\u0009\u000A\u000D\u0020-\u007E]/gu, '?');
}

function uploadArtifactToS3(archivePath, bucket, key, envConfig, { sha256 = null } = {}) {
  const args = ['s3', 'cp', archivePath, `s3://${bucket}/${key}`];
  if (sha256) args.push('--metadata', `sha256=${sha256}`);
  runAwsNoOutput(args, envConfig);
}

function uploadContentAddressedArtifact({ archivePath, bucket, component, releaseId, envConfig }) {
  const immutable = buildImmutableArtifactRecord({ component, releaseId, archivePath });
  uploadArtifactToS3(archivePath, bucket, immutable.key, envConfig, { sha256: immutable.sha256 });
  const head = runAwsJson([
    's3api',
    'head-object',
    '--bucket', bucket,
    '--key', immutable.key,
  ], envConfig);
  if (
    Number(head?.ContentLength) !== immutable.bytes ||
    String(head?.Metadata?.sha256 || '').toLowerCase() !== immutable.sha256
  ) {
    throw new Error(`Uploaded immutable ${component} artifact failed S3 checksum/size verification.`);
  }
  return immutable;
}

function buildVerifiedS3ArtifactCopyArgs({ bucket, sourceKey, destinationKey }) {
  return [
    's3', 'cp',
    `s3://${bucket}/${sourceKey}`,
    `s3://${bucket}/${destinationKey}`,
    '--copy-props', 'metadata-directive',
  ];
}

function copyVerifiedS3Artifact({ bucket, sourceKey, destinationKey, sha256, bytes, envConfig }) {
  runAwsNoOutput(buildVerifiedS3ArtifactCopyArgs({
    bucket,
    sourceKey,
    destinationKey,
  }), envConfig);
  const head = runAwsJson([
    's3api', 'head-object', '--bucket', bucket, '--key', destinationKey,
  ], envConfig);
  if (
    Number(head?.ContentLength) !== Number(bytes) ||
    String(head?.Metadata?.sha256 || '').toLowerCase() !== sha256
  ) {
    throw new Error(`Promoted artifact failed S3 checksum/size verification: ${destinationKey}`);
  }
  return `s3://${bucket}/${destinationKey}`;
}

function verifyS3Artifact({ bucket, key, sha256, bytes, envConfig, label }) {
  const head = runAwsJson([
    's3api', 'head-object', '--bucket', bucket, '--key', key,
  ], envConfig);
  if (
    Number(head?.ContentLength) !== Number(bytes) ||
    String(head?.Metadata?.sha256 || '').toLowerCase() !== sha256
  ) {
    throw new Error(`${label || 'S3 artifact'} failed checksum/size verification: ${key}`);
  }
  return `s3://${bucket}/${key}`;
}

function promoteTestArtifactAliases(artifact, envConfig) {
  const promoted = {};
  if (artifact?.timestampKey) {
    promoted.timestampedArtifact = copyVerifiedS3Artifact({
      bucket: artifact.bucket,
      sourceKey: artifact.immutableKey,
      destinationKey: artifact.timestampKey,
      sha256: artifact.sha256,
      bytes: artifact.archiveBytes,
      envConfig,
    });
  }
  if (artifact?.bootstrapCompatibilityKey) {
    promoted.bootstrapCompatibilityArtifact = copyVerifiedS3Artifact({
      bucket: artifact.bucket,
      sourceKey: artifact.immutableKey,
      destinationKey: artifact.bootstrapCompatibilityKey,
      sha256: artifact.sha256,
      bytes: artifact.archiveBytes,
      envConfig,
    });
  }
  return promoted;
}

function snapshotTestBootstrapArtifactAlias(artifact, envConfig, snapshotRoot, component) {
  if (!artifact?.bootstrapCompatibilityKey) return null;
  const snapshotPath = path.join(snapshotRoot, `${slugify(component)}-bootstrap-prior.zip`);
  runAwsNoOutput([
    's3', 'cp',
    `s3://${artifact.bucket}/${artifact.bootstrapCompatibilityKey}`,
    snapshotPath,
  ], envConfig);
  return {
    bucket: artifact.bucket,
    key: artifact.bootstrapCompatibilityKey,
    path: snapshotPath,
    sha256: sha256File(snapshotPath),
    bytes: fs.statSync(snapshotPath).size,
  };
}

function restoreTestBootstrapArtifactAlias(snapshot, envConfig, component) {
  if (!snapshot) return null;
  uploadArtifactToS3(snapshot.path, snapshot.bucket, snapshot.key, envConfig, {
    sha256: snapshot.sha256,
  });
  return verifyS3Artifact({
    bucket: snapshot.bucket,
    key: snapshot.key,
    sha256: snapshot.sha256,
    bytes: snapshot.bytes,
    envConfig,
    label: `Restored prior TEST ${component} bootstrap artifact`,
  });
}

function stageProdArtifactPair({
  archivePath,
  component,
  releaseId,
  compatibilityKey,
  stagingRoot,
  compatibilityOnly = false,
}) {
  if (!stagingRoot) {
    throw new Error('A release-scoped PROD artifact staging directory is required.');
  }
  const stagedArchivePath = path.join(stagingRoot, `${slugify(component)}.zip`);
  copyRequiredFile(archivePath, stagedArchivePath, `${component} PROD artifact staging`);
  const immutable = buildImmutableArtifactRecord({ component, releaseId, archivePath: stagedArchivePath });
  return {
    artifact: null,
    bucket: PROD_ARTIFACT_BUCKET,
    compatibilityKey,
    localArchivePath: stagedArchivePath,
    immutableArtifact: null,
    immutableKey: null,
    plannedImmutableKey: immutable.key,
    compatibilityOnly,
    sha256: immutable.sha256,
    archiveBytes: immutable.bytes,
  };
}

function uploadStagedProdImmutableArtifact(artifact, component, releaseId, envConfig) {
  const immutable = uploadContentAddressedArtifact({
    archivePath: artifact.localArchivePath,
    bucket: PROD_ARTIFACT_BUCKET,
    component,
    releaseId,
    envConfig,
  });
  if (
    immutable.key !== artifact.plannedImmutableKey ||
    immutable.sha256 !== artifact.sha256 ||
    immutable.bytes !== artifact.archiveBytes
  ) {
    throw new Error(`Staged ${component} immutable artifact changed before upload.`);
  }
  artifact.immutableKey = immutable.key;
  artifact.immutableArtifact = `s3://${PROD_ARTIFACT_BUCKET}/${immutable.key}`;
  return artifact;
}

function assertStagedArtifactUnchanged(artifact, component) {
  if (!artifact?.localArchivePath || !fs.existsSync(artifact.localArchivePath)) {
    throw new Error(`Staged ${component} artifact is missing before upload.`);
  }
  const currentBytes = fs.statSync(artifact.localArchivePath).size;
  const currentSha256 = sha256File(artifact.localArchivePath);
  if (currentBytes !== artifact.archiveBytes || currentSha256 !== artifact.sha256) {
    throw new Error(`Staged ${component} artifact changed before upload.`);
  }
  return { sha256: currentSha256, bytes: currentBytes };
}

function promoteProdCompatibilityArtifacts(artifacts, envConfig, { compatibilityOnly = false } = {}) {
  const entries = Object.entries(artifacts || {});
  if (!entries.length) return { promoted: {}, prior: {} };
  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-compatibility-snapshot-'));
  const snapshots = {};
  const attempted = [];
  try {
    for (const [component, artifact] of entries) {
      const snapshotPath = path.join(snapshotRoot, `${slugify(component)}-prior.zip`);
      runAwsNoOutput([
        's3', 'cp',
        `s3://${PROD_ARTIFACT_BUCKET}/${artifact.compatibilityKey}`,
        snapshotPath,
      ], envConfig);
      snapshots[component] = {
        path: snapshotPath,
        key: artifact.compatibilityKey,
        sha256: sha256File(snapshotPath),
        bytes: fs.statSync(snapshotPath).size,
      };
    }

    const promoted = {};
    for (const [component, artifact] of entries) {
      attempted.push(component);
      assertStagedArtifactUnchanged(artifact, component);
      if (compatibilityOnly) {
        uploadArtifactToS3(
          artifact.localArchivePath,
          PROD_ARTIFACT_BUCKET,
          artifact.compatibilityKey,
          envConfig,
          { sha256: artifact.sha256 }
        );
        promoted[component] = verifyS3Artifact({
          bucket: PROD_ARTIFACT_BUCKET,
          key: artifact.compatibilityKey,
          sha256: artifact.sha256,
          bytes: artifact.archiveBytes,
          envConfig,
          label: `Promoted PROD ${component} compatibility artifact`,
        });
      } else {
        promoted[component] = copyVerifiedS3Artifact({
          bucket: PROD_ARTIFACT_BUCKET,
          sourceKey: artifact.immutableKey,
          destinationKey: artifact.compatibilityKey,
          sha256: artifact.sha256,
          bytes: artifact.archiveBytes,
          envConfig,
        });
      }
      artifact.artifact = promoted[component];
      artifact.compatibilityArtifact = promoted[component];
    }
    return {
      promoted,
      prior: Object.fromEntries(Object.entries(snapshots).map(([component, snapshot]) => [component, {
        key: snapshot.key,
        sha256: snapshot.sha256,
        bytes: snapshot.bytes,
      }])),
    };
  } catch (error) {
    const rollbackErrors = [];
    for (const component of attempted.reverse()) {
      const snapshot = snapshots[component];
      if (!snapshot) continue;
      try {
        uploadArtifactToS3(
          snapshot.path,
          PROD_ARTIFACT_BUCKET,
          snapshot.key,
          envConfig,
          { sha256: snapshot.sha256 }
        );
        verifyS3Artifact({
          bucket: PROD_ARTIFACT_BUCKET,
          key: snapshot.key,
          sha256: snapshot.sha256,
          bytes: snapshot.bytes,
          envConfig,
          label: `Restored prior PROD ${component} compatibility artifact`,
        });
      } catch (rollbackError) {
        rollbackErrors.push(`${component}: ${rollbackError.message}`);
      }
    }
    if (rollbackErrors.length) {
      error.message += `; compatibility rollback failed (${rollbackErrors.join('; ')})`;
    }
    throw error;
  } finally {
    removePath(snapshotRoot);
  }
}

function uploadProdReleaseDescriptor(descriptor, envConfig) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'path-release-descriptor-'));
  try {
    const filename = path.join(tempRoot, 'release-descriptor.json');
    fs.writeFileSync(filename, `${JSON.stringify(descriptor, null, 2)}\n`, 'utf8');
    const key = `releases/${descriptor.releaseId}/release-descriptor.json`;
    uploadArtifactToS3(filename, PROD_ARTIFACT_BUCKET, key, envConfig);
    return { key, uri: `s3://${PROD_ARTIFACT_BUCKET}/${key}`, sha256: descriptor.descriptorSha256 };
  } finally {
    removePath(tempRoot);
  }
}

function discoverAsgInstances(autoScalingGroupName, envConfig) {
  const payload = runAwsJson([
    'autoscaling',
    'describe-auto-scaling-groups',
    '--auto-scaling-group-names',
    autoScalingGroupName,
  ], envConfig);
  const groups = payload.AutoScalingGroups || [];
  if (!groups.length) {
    throw new Error(`Auto Scaling Group '${autoScalingGroupName}' not found in region ${envConfig.region}.`);
  }
  const instances = (groups[0].Instances || [])
    .filter(instance => instance.LifecycleState === 'InService' && instance.HealthStatus === 'Healthy')
    .map(instance => instance.InstanceId)
    .filter(Boolean);
  if (!instances.length) {
    throw new Error(`No healthy, in-service instances found in Auto Scaling Group '${autoScalingGroupName}'.`);
  }
  return instances;
}

function sendSsmCommand(instanceId, commands, envConfig) {
  const payload = {
    DocumentName: 'AWS-RunShellScript',
    InstanceIds: [instanceId],
    Parameters: { commands },
    CloudWatchOutputConfig: {
      CloudWatchOutputEnabled: false,
    },
  };
  const tempPath = path.join(
    os.tmpdir(),
    `path-deploy-ssm-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
  );
  fs.writeFileSync(tempPath, JSON.stringify(payload), 'utf8');
  try {
    const response = runAwsJson([
      'ssm',
      'send-command',
      '--cli-input-json',
      `file://${tempPath}`,
    ], envConfig);
    const commandId = response.Command && response.Command.CommandId;
    if (!commandId) {
      throw new Error(`SSM send-command did not return a command id for ${instanceId}`);
    }
    return commandId;
  } finally {
    try { fs.unlinkSync(tempPath); } catch (_) {}
  }
}

function waitSsmCommand(commandId, instanceId, envConfig, options = {}) {
  let failureCount = 0;
  while (true) {
    runCommand('bash', ['-lc', 'sleep 5'], { capture: true });
    const payload = runAwsJson([
      'ssm',
      'get-command-invocation',
      '--command-id',
      commandId,
      '--instance-id',
      instanceId,
    ], envConfig);
    if (!payload || !payload.Status) {
      failureCount += 1;
      if (failureCount >= 10) {
        throw new Error(`Failed to poll SSM command ${commandId} after ${failureCount} attempts.`);
      }
      continue;
    }
    failureCount = 0;
    if (payload.Status === 'Pending' || payload.Status === 'InProgress' || payload.Status === 'Delayed') {
      continue;
    }
    if (payload.Status === 'Success') {
      if (options.showRemoteLogs && payload.StandardOutputContent) {
        console.log(sanitizeSsmOutput(payload.StandardOutputContent));
      }
      return payload;
    }
    const stderr = sanitizeSsmOutput(payload.StandardErrorContent) || '<no stderr provided>';
    const stdout = sanitizeSsmOutput(payload.StandardOutputContent);
    throw new Error(
      `SSM command ${commandId} failed on ${instanceId} with status ${payload.Status}.\n${stderr}${stdout ? `\n--- STDOUT ---\n${stdout}` : ''}`
    );
  }
}

function buildRemoteServiceHealthCommands({
  pm2Name,
  port,
  serviceLabel,
  attempts = 15,
  delaySeconds = 2,
} = {}) {
  if (!/^[A-Za-z0-9._-]+$/u.test(String(pm2Name || ''))) {
    throw new Error('A safe PM2 service name is required for remote health verification.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('A valid local service port is required for remote health verification.');
  }
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 60) {
    throw new Error('Remote health verification attempts must be between 1 and 60.');
  }
  if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 10) {
    throw new Error('Remote health verification delay must be between 0 and 10 seconds.');
  }
  const label = String(serviceLabel || pm2Name);
  return [
    'PATH_SERVICE_HEALTHY=0',
    'PATH_HEALTH_ATTEMPT=1',
    `while [ "$PATH_HEALTH_ATTEMPT" -le ${attempts} ]; do`,
    `  PATH_PM2_PID=$("$PM2_BIN" pid ${pm2Name} 2>/dev/null | tail -n 1 | tr -d '[:space:]' || true)`,
    `  if printf '%s' "$PATH_PM2_PID" | grep -Eq '^[1-9][0-9]*$' && kill -0 "$PATH_PM2_PID" 2>/dev/null && curl -fsS --max-time 3 http://127.0.0.1:${port}/healthz >/dev/null; then PATH_SERVICE_HEALTHY=1; break; fi`,
    `  if [ "$PATH_HEALTH_ATTEMPT" -lt ${attempts} ]; then sleep ${delaySeconds}; fi`,
    '  PATH_HEALTH_ATTEMPT=$((PATH_HEALTH_ATTEMPT + 1))',
    'done',
    `if [ "$PATH_SERVICE_HEALTHY" != 1 ]; then echo "${label} failed PM2/process/local health verification"; "$PM2_BIN" describe ${pm2Name} || true; exit 1; fi`,
  ];
}

function buildAdminTestRemoteCommands(bucket, s3Key, region, _stagedDirectories, expectedSha256) {
  if (!/^[a-f0-9]{64}$/u.test(String(expectedSha256 || ''))) {
    throw new Error('A valid admin archive SHA-256 is required for TEST deployment.');
  }
  const commands = [
    'set -euo pipefail',
    'umask 077',
    `PATH_DEPLOY_S3_URI=${quoteBashArgument(`s3://${bucket}/${s3Key}`)}`,
    `PATH_DEPLOY_REGION=${quoteBashArgument(region)}`,
    'DEPLOY_ROOT=$(mktemp -d /tmp/admin-deploy.XXXXXX)',
    'trap \'rm -rf "$DEPLOY_ROOT"\' EXIT',
    'TMPDIR="$DEPLOY_ROOT/staging"',
    'ARCHIVE="$DEPLOY_ROOT/admin.zip"',
    'mkdir -p "$TMPDIR"',
    'aws s3 cp "$PATH_DEPLOY_S3_URI" "$ARCHIVE" --region "$PATH_DEPLOY_REGION"',
    `printf '%s  %s\n' '${expectedSha256}' "$ARCHIVE" | sha256sum -c -`,
    'unzip -qo "$ARCHIVE" -d "$TMPDIR"',
    'for required_file in build/index.html isetadminserver.js package.json package-lock.json .path-release-provenance.json .env.test public/nwac-logo.png public/nwac-consent-logo.png; do test -f "$TMPDIR/$required_file" || { echo "missing admin artifact file: $required_file"; exit 1; }; done',
    'for required_dir in src shared templates blocksteps public scripts sql/migrations; do test -d "$TMPDIR/$required_dir" || { echo "missing admin artifact directory: $required_dir"; exit 1; }; done',
    'test -d /opt/nwac/portal || { echo "portal runtime required by admin is missing"; exit 1; }',
    'ln -sfnT /opt/nwac/portal /opt/nwac/ISET-intake',
    'test "$(readlink -f /opt/nwac/ISET-intake)" = "/opt/nwac/portal" || { echo "portal sibling link is not coherent"; exit 1; }',
    'mkdir -p /home/ec2-user/admin-dashboard',
    'mkdir -p /opt/nwac/admin-dashboard',
    'rm -rf /home/ec2-user/admin-dashboard/build',
    'rm -rf /opt/nwac/admin-dashboard/build',
    'cp -r "$TMPDIR/build" /home/ec2-user/admin-dashboard/',
    'cp -r "$TMPDIR/build" /opt/nwac/admin-dashboard/',
    'cp "$TMPDIR/isetadminserver.js" /opt/nwac/admin-dashboard/isetadminserver.js',
    'cp "$TMPDIR/package.json" /opt/nwac/admin-dashboard/package.json',
    'cp "$TMPDIR/package-lock.json" /opt/nwac/admin-dashboard/package-lock.json',
    'cp "$TMPDIR/.path-release-provenance.json" /opt/nwac/admin-dashboard/.path-release-provenance.json',
    'cp "$TMPDIR/.env.test" /home/ec2-user/admin-dashboard/.env',
    'cp "$TMPDIR/.env.test" /opt/nwac/admin-dashboard/.env',
    'cp "$TMPDIR/.env.test" /opt/nwac/admin-dashboard/.env.test',
    'SECRET_NAME="nwac-test-admin-openrouter-api-key"',
    'SECRET_REGION="$PATH_DEPLOY_REGION"',
    'echo "Fetching $SECRET_NAME from Secrets Manager..."',
    'SECRET_VAL_RAW=$(aws secretsmanager get-secret-value --region "$SECRET_REGION" --secret-id "$SECRET_NAME" --query SecretString --output text 2>/dev/null || true)',
    'SECRET_VAL="$SECRET_VAL_RAW"',
    'if echo "$SECRET_VAL_RAW" | grep -q "^{"; then',
    '  SECRET_VAL=$(SECRET_VAL_RAW="$SECRET_VAL_RAW" python3 - <<PY',
    'import json, os',
    'val = os.environ.get("SECRET_VAL_RAW", "")',
    'out = val',
    'try:',
    '    data = json.loads(val)',
    '    if isinstance(data, dict):',
    '        out = data.get("OPENROUTER_API_KEY") or data.get("openrouter_api_key")',
    '        if not out:',
    '            out = next((v for k, v in data.items() if "openrouter" in k.lower() and "key" in k.lower()), out)',
    'except Exception:',
    '    pass',
    'print(out or "")',
    'PY',
    '  )',
    'fi',
    'if [ -n "$SECRET_VAL" ]; then',
    '  for target in /home/ec2-user/admin-dashboard/.env /opt/nwac/admin-dashboard/.env; do',
    '    if [ -f "$target" ]; then',
    '      grep -v "^OPENROUTER_API_KEY=" "$target" > "$target.tmp" && mv "$target.tmp" "$target"',
    '    fi',
    '    echo "OPENROUTER_API_KEY=$SECRET_VAL" >> "$target"',
    '  done',
    'else',
    '  echo "WARNING: Secret $SECRET_NAME not found or empty; AI will remain disabled."',
    'fi',
    'for target in /home/ec2-user/admin-dashboard/.env /opt/nwac/admin-dashboard/.env /opt/nwac/admin-dashboard/.env.test; do',
    '  if [ -f "$target" ]; then',
    '    grep -v "^DISABLE_AUTO_MIGRATIONS=" "$target" > "$target.tmp" && mv "$target.tmp" "$target"',
    '  fi',
    '  echo "DISABLE_AUTO_MIGRATIONS=true" >> "$target"',
    'done',
  ];

  commands.push(
    'rm -rf /opt/nwac/admin-dashboard/src /opt/nwac/admin-dashboard/shared /opt/nwac/admin-dashboard/templates /opt/nwac/admin-dashboard/blocksteps /opt/nwac/admin-dashboard/public /opt/nwac/admin-dashboard/scripts /opt/nwac/admin-dashboard/sql',
    'cp -r "$TMPDIR/src" "$TMPDIR/shared" "$TMPDIR/templates" "$TMPDIR/blocksteps" "$TMPDIR/public" "$TMPDIR/scripts" "$TMPDIR/sql" /opt/nwac/admin-dashboard/',
    'rm -rf /opt/nwac/shared',
    'mkdir -p /opt/nwac',
    'cp -r "$TMPDIR/shared" /opt/nwac/'
  );

  commands.push(
    'CHROME_PACKAGES="alsa-lib atk at-spi2-atk at-spi2-core cairo cups-libs gtk3 libX11 libXcomposite libXdamage libXext libXfixes libXrandr libxcb libxkbcommon mesa-libgbm nss nspr pango"',
    'if command -v dnf >/dev/null 2>&1; then sudo dnf install -y $CHROME_PACKAGES >/dev/null; elif command -v yum >/dev/null 2>&1; then sudo yum install -y $CHROME_PACKAGES >/dev/null; else echo "supported package manager not found; cannot install Chromium dependencies"; exit 1; fi',
    'NPM_BIN="$(command -v npm 2>/dev/null || command -v /usr/local/bin/npm 2>/dev/null || command -v /usr/bin/npm 2>/dev/null)"',
    'if [ -z "$NPM_BIN" ]; then',
    '  echo "npm not found on PATH; deployment aborting"',
    '  exit 1',
    'fi',
    'cd /opt/nwac/admin-dashboard',
    'if [ -d node_modules ]; then chmod -R u+w node_modules || true; fi',
    'rm -rf node_modules',
    'rm -rf /tmp/npm-cache-admin-deploy',
    'if [ -f package-lock.json ]; then NPM_CONFIG_CACHE=/tmp/npm-cache-admin-deploy "$NPM_BIN" ci --omit=dev --no-audit --no-fund; else NPM_CONFIG_CACHE=/tmp/npm-cache-admin-deploy "$NPM_BIN" install --omit=dev --no-audit --no-fund; fi',
    'node -e "let puppeteer; try { puppeteer = require(\\"puppeteer\\"); } catch (error) { if (error && error.code === \\"MODULE_NOT_FOUND\\") process.exit(0); throw error; } (async () => { const browser = await puppeteer.launch({ headless: \\"new\\", args: [\\"--no-sandbox\\", \\"--disable-setuid-sandbox\\"] }); await browser.close(); })().catch((error) => { console.error(error && error.stack ? error.stack : error); process.exit(1); });"',
    'PM2_BIN="$(command -v pm2 2>/dev/null || true)"',
    'if [ -z "$PM2_BIN" ]; then',
    '  echo "pm2 not found on PATH; installing globally"',
    '  "$NPM_BIN" install -g pm2',
    '  PM2_BIN="$(command -v pm2 2>/dev/null || echo /usr/bin/pm2)"',
    'fi',
    'if [ ! -x "$PM2_BIN" ]; then',
    '  echo "pm2 binary not executable at $PM2_BIN"',
    '  exit 1',
    'fi',
    'export NODE_ENV=production',
    'export HOME=/root',
    'export PM2_HOME=/root/.pm2',
    'if "$PM2_BIN" describe nwac-admin >/dev/null 2>&1; then "$PM2_BIN" restart nwac-admin --update-env; else "$PM2_BIN" start /opt/nwac/admin-dashboard/isetadminserver.js --name nwac-admin --cwd /opt/nwac/admin-dashboard --update-env; fi',
    ...buildRemoteServiceHealthCommands({
      pm2Name: 'nwac-admin',
      port: 5001,
      serviceLabel: 'admin',
    }),
    '"$PM2_BIN" save >/dev/null || true',
    'LOG_DIR="/root/.pm2/logs"',
    'echo "--- nwac-admin stderr (tail) ---"',
    'tail -n 200 "$LOG_DIR/nwac-admin-error.log" || true',
    'echo "--- nwac-admin stdout (tail) ---"',
    'tail -n 200 "$LOG_DIR/nwac-admin-out.log" || true',
    'rm -rf "$DEPLOY_ROOT"',
    'trap - EXIT'
  );

  return commands;
}

function buildPortalTestRemoteCommands(bucket, s3Key, region, expectedSha256) {
  if (!/^[a-f0-9]{64}$/u.test(String(expectedSha256 || ''))) {
    throw new Error('A valid portal archive SHA-256 is required for TEST deployment.');
  }
  const requiredFiles = [...PORTAL_TEST_REQUIRED_ARTIFACT_FILES].join(' ');
  return [
    'set -euo pipefail',
    `PATH_DEPLOY_S3_URI=${quoteBashArgument(`s3://${bucket}/${s3Key}`)}`,
    `PATH_DEPLOY_REGION=${quoteBashArgument(region)}`,
    'DEPLOY_ROOT=$(mktemp -d /tmp/portal-deploy.XXXXXX)',
    'trap \'rm -rf "$DEPLOY_ROOT"\' EXIT',
    'TMPDIR="$DEPLOY_ROOT/staging"',
    'ARCHIVE="$DEPLOY_ROOT/portal.zip"',
    'mkdir -p "$TMPDIR"',
    'aws s3 cp "$PATH_DEPLOY_S3_URI" "$ARCHIVE" --region "$PATH_DEPLOY_REGION"',
    `printf '%s  %s\n' '${expectedSha256}' "$ARCHIVE" | sha256sum -c -`,
    'unzip -oq "$ARCHIVE" -d "$TMPDIR"',
    `for required_file in ${requiredFiles}; do test -f "$TMPDIR/$required_file" || { echo "missing portal artifact file: $required_file"; exit 1; }; done`,
    'for required_dir in build auth notifications pdf public src shared; do test -d "$TMPDIR/$required_dir" || { echo "missing portal artifact directory: $required_dir"; exit 1; }; done',
    'mkdir -p /opt/nwac',
    'mkdir -p /opt/nwac/portal',
    'ln -sfnT /opt/nwac/portal /opt/nwac/ISET-intake',
    'test "$(readlink -f /opt/nwac/ISET-intake)" = "/opt/nwac/portal" || { echo "portal sibling link is not coherent"; exit 1; }',
    'rm -rf /opt/nwac/shared',
    'if [ -d "$TMPDIR/shared" ]; then cp -r "$TMPDIR/shared" /opt/nwac/; fi',
    'rm -rf /opt/nwac/portal/build /opt/nwac/portal/db /opt/nwac/portal/notifications /opt/nwac/portal/pdf /opt/nwac/portal/public /opt/nwac/portal/src /opt/nwac/portal/auth /opt/nwac/portal/scripts',
    'if [ -d "$TMPDIR/build" ]; then cp -r "$TMPDIR/build" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/db" ]; then cp -r "$TMPDIR/db" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/notifications" ]; then cp -r "$TMPDIR/notifications" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/pdf" ]; then cp -r "$TMPDIR/pdf" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/public" ]; then cp -r "$TMPDIR/public" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/src" ]; then cp -r "$TMPDIR/src" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/auth" ]; then cp -r "$TMPDIR/auth" /opt/nwac/portal/; fi',
    'rm -f /opt/nwac/portal/server.js /opt/nwac/portal/package.json /opt/nwac/portal/package-lock.json /opt/nwac/portal/.path-release-provenance.json /opt/nwac/portal/.env.test /opt/nwac/portal/.env /opt/nwac/portal/migrationRunner.js /opt/nwac/portal/mimeSniff.js /opt/nwac/portal/uploadPolicy.js /opt/nwac/portal/s3Provider.js /opt/nwac/portal/sesMailer.js',
    'if [ -f "$TMPDIR/server.js" ]; then cp "$TMPDIR/server.js" /opt/nwac/portal/server.js; fi',
    'if [ -f "$TMPDIR/package.json" ]; then cp "$TMPDIR/package.json" /opt/nwac/portal/package.json; fi',
    'if [ -f "$TMPDIR/package-lock.json" ]; then cp "$TMPDIR/package-lock.json" /opt/nwac/portal/package-lock.json; fi',
    'if [ -f "$TMPDIR/.path-release-provenance.json" ]; then cp "$TMPDIR/.path-release-provenance.json" /opt/nwac/portal/.path-release-provenance.json; fi',
    'if [ -f "$TMPDIR/.env.test" ]; then cp "$TMPDIR/.env.test" /opt/nwac/portal/.env.test; fi',
    'if [ -f "$TMPDIR/.env" ]; then cp "$TMPDIR/.env" /opt/nwac/portal/.env; fi',
    'if [ -f "$TMPDIR/migrationRunner.js" ]; then cp "$TMPDIR/migrationRunner.js" /opt/nwac/portal/migrationRunner.js; fi',
    'if [ -f "$TMPDIR/mimeSniff.js" ]; then cp "$TMPDIR/mimeSniff.js" /opt/nwac/portal/mimeSniff.js; fi',
    'if [ -f "$TMPDIR/uploadPolicy.js" ]; then cp "$TMPDIR/uploadPolicy.js" /opt/nwac/portal/uploadPolicy.js; fi',
    'if [ -f "$TMPDIR/s3Provider.js" ]; then cp "$TMPDIR/s3Provider.js" /opt/nwac/portal/s3Provider.js; fi',
    'if [ -f "$TMPDIR/sesMailer.js" ]; then cp "$TMPDIR/sesMailer.js" /opt/nwac/portal/sesMailer.js; fi',
    'SECRET_NAME="nwac-test-admin-openrouter-api-key"',
    'SECRET_REGION="$PATH_DEPLOY_REGION"',
    'echo "Fetching $SECRET_NAME from Secrets Manager..."',
    'SECRET_VAL_RAW=$(aws secretsmanager get-secret-value --region "$SECRET_REGION" --secret-id "$SECRET_NAME" --query SecretString --output text 2>/dev/null || true)',
    'SECRET_VAL="$SECRET_VAL_RAW"',
    'if echo "$SECRET_VAL_RAW" | grep -q "^{"; then',
    '  SECRET_VAL=$(SECRET_VAL_RAW="$SECRET_VAL_RAW" python3 - <<PY',
    'import json, os',
    'val = os.environ.get("SECRET_VAL_RAW", "")',
    'out = val',
    'try:',
    '    data = json.loads(val)',
    '    if isinstance(data, dict):',
    '        out = data.get("OPENROUTER_API_KEY") or data.get("openrouter_api_key")',
    '        if not out:',
    '            out = next((v for k, v in data.items() if "openrouter" in k.lower() and "key" in k.lower()), out)',
    'except Exception:',
    '    pass',
    'print(out or "")',
    'PY',
    '  )',
    'fi',
    'if [ -n "$SECRET_VAL" ]; then',
    '  for target in /opt/nwac/portal/.env /opt/nwac/portal/.env.test; do',
    '    if [ -f "$target" ]; then',
    '      grep -v "^OPENROUTER_API_KEY=" "$target" > "$target.tmp" && mv "$target.tmp" "$target"',
    '    fi',
    '    echo "OPENROUTER_API_KEY=$SECRET_VAL" >> "$target"',
    '  done',
    'else',
    '  echo "WARNING: Secret $SECRET_NAME not found or empty; AI will remain disabled."',
    'fi',
    'for target in /opt/nwac/portal/.env /opt/nwac/portal/.env.test; do',
    '  if [ -f "$target" ]; then',
    '    grep -v "^AUTO_MIGRATE=" "$target" > "$target.tmp" && mv "$target.tmp" "$target"',
    '  fi',
    '  echo "AUTO_MIGRATE=false" >> "$target"',
    'done',
    'cd /opt/nwac/portal',
    'if [ -d node_modules ]; then chmod -R u+w node_modules || true; fi',
    'rm -rf node_modules',
    'rm -rf /tmp/npm-cache-portal-deploy',
    'if [ -f package-lock.json ]; then NPM_CONFIG_CACHE=/tmp/npm-cache-portal-deploy npm ci --omit=dev --no-audit --no-fund; else NPM_CONFIG_CACHE=/tmp/npm-cache-portal-deploy npm install --omit=dev --no-audit --no-fund; fi',
    'if [ -f /opt/nwac/portal/.env.test ]; then cp /opt/nwac/portal/.env.test /opt/nwac/portal/.env; fi',
    'export NODE_ENV=production',
    'export HOME=/root',
    'export PM2_HOME=/root/.pm2',
    'PM2_BIN="$(command -v pm2 2>/dev/null || true)"',
    'test -n "$PM2_BIN" && test -x "$PM2_BIN" || { echo "pm2 is unavailable for portal restart"; exit 1; }',
    'if "$PM2_BIN" describe nwac-portal >/dev/null 2>&1; then "$PM2_BIN" restart nwac-portal --update-env; else "$PM2_BIN" start /opt/nwac/portal/server.js --name nwac-portal --update-env; fi',
    ...buildRemoteServiceHealthCommands({
      pm2Name: 'nwac-portal',
      port: 5000,
      serviceLabel: 'portal',
    }),
    '"$PM2_BIN" save >/dev/null || true',
    'rm -rf "$DEPLOY_ROOT"',
    'trap - EXIT',
  ];
}

function buildTestAtomicPrepareCommands(context) {
  const { releaseId, artifacts = {}, region } = context || {};
  assertSafeReleaseId(releaseId);
  const components = Object.keys(artifacts).filter(component => ['admin', 'portal'].includes(component));
  if (!components.length) throw new Error('TEST atomic preparation requires at least one staged component.');
  components.forEach(component => {
    const artifact = artifacts[component];
    if (!artifact?.bucket || !artifact?.immutableKey || !/^[a-f0-9]{64}$/u.test(String(artifact.sha256 || ''))) {
      throw new Error(`TEST atomic preparation is missing immutable ${component} artifact proof.`);
    }
  });
  const record = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    releaseId,
    components,
    artifacts: Object.fromEntries(components.map(component => [component, {
      bucket: artifacts[component].bucket,
      key: artifacts[component].immutableKey,
      sha256: artifacts[component].sha256,
    }])),
  })).toString('base64');
  const commands = [
    'set -euo pipefail',
    'umask 077',
    `PATH_RELEASE_ID=${quoteBashArgument(releaseId)}`,
    `PATH_DEPLOY_REGION=${quoteBashArgument(region)}`,
    `PATH_RECOVERY_CONTEXT_B64=${quoteBashArgument(record)}`,
    'TX_ROOT="/opt/nwac/.path-release-transactions/$PATH_RELEASE_ID"',
    'mkdir -p /opt/nwac/.path-release-transactions',
    'if [ -f "$TX_ROOT/state" ]; then PATH_TX_STATE=$(cat "$TX_ROOT/state"); else PATH_TX_STATE=""; fi',
    'if [ "$PATH_TX_STATE" = "prepared" ] || [ "$PATH_TX_STATE" = "cutover-complete" ] || [ "$PATH_TX_STATE" = "accepted" ]; then printf "%s" "$PATH_RECOVERY_CONTEXT_B64" | base64 -d | cmp -s - "$TX_ROOT/recovery-context.json" || { echo "TEST transaction context differs for reused release ID"; exit 1; }; exit 0; fi',
    'if [ -n "$PATH_TX_STATE" ] && [ "$PATH_TX_STATE" != "preparing" ] && [ "$PATH_TX_STATE" != "aborted-before-cutover" ]; then echo "TEST release transaction cannot be prepared from state $PATH_TX_STATE"; exit 1; fi',
    'mkdir -p "$TX_ROOT"',
    'printf "%s\n" preparing > "$TX_ROOT/state"',
    'printf "%s" "$PATH_RECOVERY_CONTEXT_B64" | base64 -d > "$TX_ROOT/recovery-context.json"',
    'rm -rf "$TX_ROOT/candidate-admin" "$TX_ROOT/candidate-portal" "$TX_ROOT/candidate-shared" "$TX_ROOT/candidate-home-admin-build" "$TX_ROOT/archives"',
    'mkdir -p "$TX_ROOT/archives"',
    'export HOME=/root',
    'export PM2_HOME=/root/.pm2',
    'PM2_BIN="$(command -v pm2 2>/dev/null || true)"',
    'test -n "$PM2_BIN" && test -x "$PM2_BIN" || { echo "pm2 is unavailable for TEST recovery preparation"; exit 1; }',
    'for service in admin portal; do if "$PM2_BIN" pid "nwac-$service" 2>/dev/null | tail -n 1 | grep -Eq "^[1-9][0-9]*$"; then echo 1; else echo 0; fi > "$TX_ROOT/prior-$service-running"; done',
    'for component in admin portal; do ROOT="/opt/nwac/$([ "$component" = admin ] && echo admin-dashboard || echo portal)"; if [ -f "$ROOT/.path-release-provenance.json" ]; then sha256sum "$ROOT/.path-release-provenance.json" | awk "{print \\$1}"; else echo MISSING; fi > "$TX_ROOT/prior-$component-provenance.sha256"; done',
    'test "$(cat "$TX_ROOT/prior-admin-running")" = 1 && test "$(cat "$TX_ROOT/prior-portal-running")" = 1 || { echo "both prior TEST services must be running before atomic preparation"; exit 1; }',
    'curl -fsS --retry 5 --retry-delay 2 --retry-all-errors http://127.0.0.1:5001/readyz >/dev/null || { echo "prior TEST admin readiness failed"; exit 1; }',
    'curl -fsS --retry 5 --retry-delay 2 --retry-all-errors http://127.0.0.1:5000/readyz >/dev/null || { echo "prior TEST portal readiness failed"; exit 1; }',
    'PATH_SECRET_RAW=$(aws secretsmanager get-secret-value --region "$PATH_DEPLOY_REGION" --secret-id nwac-test-admin-openrouter-api-key --query SecretString --output text 2>/dev/null || true)',
    `PATH_SECRET_VALUE=$(PATH_SECRET_RAW="$PATH_SECRET_RAW" node -e ${quoteBashArgument("const raw=process.env.PATH_SECRET_RAW||'';let value=raw;try{const parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object'){value=parsed.OPENROUTER_API_KEY||parsed.openrouter_api_key||Object.entries(parsed).find(([k])=>/openrouter.*key/i.test(k))?.[1]||'';}}catch{}process.stdout.write(String(value||''));")})`,
  ];

  if (artifacts.portal) {
    commands.push(
      `PATH_PORTAL_URI=${quoteBashArgument(`s3://${artifacts.portal.bucket}/${artifacts.portal.immutableKey}`)}`,
      'aws s3 cp "$PATH_PORTAL_URI" "$TX_ROOT/archives/portal.zip" --region "$PATH_DEPLOY_REGION"',
      `printf '%s  %s\n' '${artifacts.portal.sha256}' "$TX_ROOT/archives/portal.zip" | sha256sum -c -`,
      'mkdir -p "$TX_ROOT/candidate-portal"',
      'unzip -oq "$TX_ROOT/archives/portal.zip" -d "$TX_ROOT/candidate-portal"',
      `for required_file in ${PORTAL_TEST_REQUIRED_ARTIFACT_FILES.join(' ')}; do test -f "$TX_ROOT/candidate-portal/$required_file" || { echo "missing portal candidate file: $required_file"; exit 1; }; done`,
      'for required_dir in build auth notifications pdf public src shared; do test -d "$TX_ROOT/candidate-portal/$required_dir" || { echo "missing portal candidate directory: $required_dir"; exit 1; }; done',
      'test ! -e "$TX_ROOT/candidate-portal/scripts" || { echo "retired portal scripts were packaged"; exit 1; }',
      'cp "$TX_ROOT/candidate-portal/.env.test" "$TX_ROOT/candidate-portal/.env"',
      'for target in "$TX_ROOT/candidate-portal/.env" "$TX_ROOT/candidate-portal/.env.test"; do grep -v "^AUTO_MIGRATE=" "$target" > "$target.tmp" || true; mv "$target.tmp" "$target"; echo "AUTO_MIGRATE=false" >> "$target"; done',
      'if [ -n "$PATH_SECRET_VALUE" ]; then for target in "$TX_ROOT/candidate-portal/.env" "$TX_ROOT/candidate-portal/.env.test"; do grep -v "^OPENROUTER_API_KEY=" "$target" > "$target.tmp" || true; mv "$target.tmp" "$target"; printf "OPENROUTER_API_KEY=%s\\n" "$PATH_SECRET_VALUE" >> "$target"; done; fi',
      'cd "$TX_ROOT/candidate-portal"',
      'rm -rf node_modules',
      'if [ -f package-lock.json ]; then NPM_CONFIG_CACHE="$TX_ROOT/npm-cache-portal" npm ci --omit=dev --no-audit --no-fund; else NPM_CONFIG_CACHE="$TX_ROOT/npm-cache-portal" npm install --omit=dev --no-audit --no-fund; fi',
      'node --check server.js'
    );
  }
  if (artifacts.admin) {
    commands.push(
      `PATH_ADMIN_URI=${quoteBashArgument(`s3://${artifacts.admin.bucket}/${artifacts.admin.immutableKey}`)}`,
      'aws s3 cp "$PATH_ADMIN_URI" "$TX_ROOT/archives/admin.zip" --region "$PATH_DEPLOY_REGION"',
      `printf '%s  %s\n' '${artifacts.admin.sha256}' "$TX_ROOT/archives/admin.zip" | sha256sum -c -`,
      'mkdir -p "$TX_ROOT/candidate-admin"',
      'unzip -oq "$TX_ROOT/archives/admin.zip" -d "$TX_ROOT/candidate-admin"',
      'for required_file in build/index.html isetadminserver.js package.json package-lock.json .path-release-provenance.json .env.test public/nwac-logo.png public/nwac-consent-logo.png; do test -f "$TX_ROOT/candidate-admin/$required_file" || { echo "missing admin candidate file: $required_file"; exit 1; }; done',
      'for required_dir in src shared templates blocksteps public scripts sql/migrations; do test -d "$TX_ROOT/candidate-admin/$required_dir" || { echo "missing admin candidate directory: $required_dir"; exit 1; }; done',
      `PATH_ALLOWED_ADMIN_SCRIPTS=${quoteBashArgument(ADMIN_SUPPORT_SCRIPT_FILES.slice().sort().join('\n'))}`,
      'PATH_ACTUAL_ADMIN_SCRIPTS=$(cd "$TX_ROOT/candidate-admin/scripts" && find . -type f -printf "%P\\n" | sort)',
      'test "$PATH_ACTUAL_ADMIN_SCRIPTS" = "$PATH_ALLOWED_ADMIN_SCRIPTS" || { echo "admin candidate support-script surface is not the exact runtime allowlist"; exit 1; }',
      'cp "$TX_ROOT/candidate-admin/.env.test" "$TX_ROOT/candidate-admin/.env"',
      'for target in "$TX_ROOT/candidate-admin/.env" "$TX_ROOT/candidate-admin/.env.test"; do grep -v "^DISABLE_AUTO_MIGRATIONS=" "$target" > "$target.tmp" || true; mv "$target.tmp" "$target"; echo "DISABLE_AUTO_MIGRATIONS=true" >> "$target"; done',
      'if [ -n "$PATH_SECRET_VALUE" ]; then for target in "$TX_ROOT/candidate-admin/.env" "$TX_ROOT/candidate-admin/.env.test"; do grep -v "^OPENROUTER_API_KEY=" "$target" > "$target.tmp" || true; mv "$target.tmp" "$target"; printf "OPENROUTER_API_KEY=%s\\n" "$PATH_SECRET_VALUE" >> "$target"; done; fi',
      'cd "$TX_ROOT/candidate-admin"',
      'rm -rf node_modules',
      'if [ -f package-lock.json ]; then NPM_CONFIG_CACHE="$TX_ROOT/npm-cache-admin" npm ci --omit=dev --no-audit --no-fund; else NPM_CONFIG_CACHE="$TX_ROOT/npm-cache-admin" npm install --omit=dev --no-audit --no-fund; fi',
      'node --check isetadminserver.js',
      'cp -a build "$TX_ROOT/candidate-home-admin-build"'
    );
  }
  const sharedSource = artifacts.admin ? 'candidate-admin' : 'candidate-portal';
  commands.push(
    `cp -a "$TX_ROOT/${sharedSource}/shared" "$TX_ROOT/candidate-shared"`,
    ...(artifacts.admin && artifacts.portal
      ? ['diff -qr "$TX_ROOT/candidate-admin/shared" "$TX_ROOT/candidate-portal/shared" >/dev/null || { echo "admin and portal shared runtime trees differ"; exit 1; }']
      : []),
    'printf "%s\n" prepared > "$TX_ROOT/state"'
  );
  return commands;
}

function buildTestAtomicCutoverCommands(context) {
  const { releaseId, artifacts = {} } = context || {};
  assertSafeReleaseId(releaseId);
  const deployAdmin = Boolean(artifacts.admin);
  const deployPortal = Boolean(artifacts.portal);
  if (!deployAdmin && !deployPortal) throw new Error('TEST atomic cutover requires a staged component.');
  const commands = [
    'set -euo pipefail',
    'umask 077',
    `PATH_RELEASE_ID=${quoteBashArgument(releaseId)}`,
    'TX_ROOT="/opt/nwac/.path-release-transactions/$PATH_RELEASE_ID"',
    'test "$(cat "$TX_ROOT/state")" = prepared || { echo "TEST transaction is not prepared"; exit 1; }',
    'mkdir -p "$TX_ROOT/backup" "$TX_ROOT/failed"',
    'printf "%s\n" cutover-started > "$TX_ROOT/state"',
    'export HOME=/root',
    'export PM2_HOME=/root/.pm2',
    'PM2_BIN="$(command -v pm2 2>/dev/null || true)"',
    'test -n "$PM2_BIN" && test -x "$PM2_BIN" || { echo "pm2 is unavailable for TEST cutover"; exit 1; }',
    '"$PM2_BIN" stop nwac-admin >/dev/null 2>&1 || true',
    '"$PM2_BIN" stop nwac-portal >/dev/null 2>&1 || true',
  ];
  if (deployAdmin) {
    commands.push(
      'test -d /opt/nwac/admin-dashboard && test ! -e "$TX_ROOT/backup/admin-dashboard"',
      'mv /opt/nwac/admin-dashboard "$TX_ROOT/backup/admin-dashboard"',
      'mv "$TX_ROOT/candidate-admin" /opt/nwac/admin-dashboard',
      'mkdir -p /home/ec2-user/admin-dashboard',
      'if [ -e /home/ec2-user/admin-dashboard/build ]; then mv /home/ec2-user/admin-dashboard/build "$TX_ROOT/backup/home-admin-build"; fi',
      'mv "$TX_ROOT/candidate-home-admin-build" /home/ec2-user/admin-dashboard/build',
      'if [ -e /home/ec2-user/admin-dashboard/.env ]; then mv /home/ec2-user/admin-dashboard/.env "$TX_ROOT/backup/home-admin.env"; fi',
      'cp /opt/nwac/admin-dashboard/.env.test /home/ec2-user/admin-dashboard/.env'
    );
  }
  if (deployPortal) {
    commands.push(
      'test -d /opt/nwac/portal && test ! -e "$TX_ROOT/backup/portal"',
      'mv /opt/nwac/portal "$TX_ROOT/backup/portal"',
      'mv "$TX_ROOT/candidate-portal" /opt/nwac/portal'
    );
  }
  commands.push(
    'if [ -e /opt/nwac/shared ]; then mv /opt/nwac/shared "$TX_ROOT/backup/shared"; fi',
    'mv "$TX_ROOT/candidate-shared" /opt/nwac/shared',
    'ln -sfnT /opt/nwac/portal /opt/nwac/ISET-intake',
    'test "$(readlink -f /opt/nwac/ISET-intake)" = /opt/nwac/portal || { echo "portal sibling link is not coherent"; exit 1; }',
    'if "$PM2_BIN" describe nwac-portal >/dev/null 2>&1; then "$PM2_BIN" restart nwac-portal --update-env; else "$PM2_BIN" start /opt/nwac/portal/server.js --name nwac-portal --cwd /opt/nwac/portal --update-env; fi',
    'if "$PM2_BIN" describe nwac-admin >/dev/null 2>&1; then "$PM2_BIN" restart nwac-admin --update-env; else "$PM2_BIN" start /opt/nwac/admin-dashboard/isetadminserver.js --name nwac-admin --cwd /opt/nwac/admin-dashboard --update-env; fi',
    '"$PM2_BIN" save >/dev/null || true',
    'printf "%s\n" cutover-complete > "$TX_ROOT/state"'
  );
  return commands;
}

function buildTestExactPostflightCommands(context) {
  const expected = {
    releaseId: context.releaseId,
    qualificationDecision: context.qualificationDecision,
    components: {},
  };
  if (context.artifacts.admin) {
    expected.components.admin = {
      root: '/opt/nwac/admin-dashboard',
      sourceKey: 'admin',
      gitHead: context.repos.adminDashboard.gitHead,
      treeFingerprint: context.repos.adminDashboard.treeFingerprint,
      buildTarget: 'test',
    };
  }
  if (context.artifacts.portal) {
    expected.components.portal = {
      root: '/opt/nwac/portal',
      sourceKey: 'portal',
      gitHead: context.repos.portal.gitHead,
      treeFingerprint: context.repos.portal.treeFingerprint,
      buildTarget: 'test',
    };
  }
  const encoded = Buffer.from(JSON.stringify(expected)).toString('base64');
  const nodeScript = [
    "const fs=require('fs');",
    `const expected=JSON.parse(Buffer.from('${encoded}','base64').toString('utf8'));`,
    "const fail=m=>{throw new Error(m)};",
    "for(const [component,wanted] of Object.entries(expected.components)){",
    " const provenance=JSON.parse(fs.readFileSync(`${wanted.root}/.path-release-provenance.json`,'utf8'));",
    " if(provenance.releaseId!==expected.releaseId||provenance.environment!=='test'||provenance.component!==component) fail(`${component} provenance identity mismatch`);",
    " if(provenance.qualificationDecision!==expected.qualificationDecision) fail(`${component} qualification provenance mismatch`);",
    " const source=provenance.source&&provenance.source[wanted.sourceKey];",
    " if(!source||source.gitHead!==wanted.gitHead||source.treeFingerprint!==wanted.treeFingerprint) fail(`${component} source provenance mismatch`);",
    " const build=JSON.parse(fs.readFileSync(`${wanted.root}/build/path-build-manifest.json`,'utf8'));",
    " const info=build.buildInfo||{};",
    " if(info.releaseId!==expected.releaseId||info.buildTarget!==wanted.buildTarget||info.gitCommit!==wanted.gitHead||info.gitDirty) fail(`${component} build provenance mismatch`);",
    "}",
  ].join('');
  return [
    'set -euo pipefail',
    'umask 077',
    'export HOME=/root',
    'export PM2_HOME=/root/.pm2',
    'PM2_BIN="$(command -v pm2 2>/dev/null || true)"',
    'test -n "$PM2_BIN" && test -x "$PM2_BIN"',
    ...buildRemoteServiceHealthCommands({ pm2Name: 'nwac-admin', port: 5001, serviceLabel: 'admin readiness' })
      .map(command => command.replace('/healthz', '/readyz')),
    ...buildRemoteServiceHealthCommands({ pm2Name: 'nwac-portal', port: 5000, serviceLabel: 'portal readiness' })
      .map(command => command.replace('/healthz', '/readyz')),
    `node -e ${quoteBashArgument(nodeScript)}`,
  ];
}

function buildTestRecoveryCommands(context, { markAccepted = false } = {}) {
  const { releaseId } = context || {};
  assertSafeReleaseId(releaseId);
  if (markAccepted) {
    return [
      'set -euo pipefail',
      'umask 077',
      `PATH_RELEASE_ID=${quoteBashArgument(releaseId)}`,
      'TX_ROOT="/opt/nwac/.path-release-transactions/$PATH_RELEASE_ID"',
      'test "$(cat "$TX_ROOT/state")" = cutover-complete',
      'printf "%s\n" accepted > "$TX_ROOT/state"',
    ];
  }
  return [
    'set -euo pipefail',
    'umask 077',
    `PATH_RELEASE_ID=${quoteBashArgument(releaseId)}`,
    'TX_ROOT="/opt/nwac/.path-release-transactions/$PATH_RELEASE_ID"',
    'test -d "$TX_ROOT" || { echo "TEST recovery transaction does not exist"; exit 1; }',
    'export HOME=/root',
    'export PM2_HOME=/root/.pm2',
    'PM2_BIN="$(command -v pm2 2>/dev/null || true)"',
    'test -n "$PM2_BIN" && test -x "$PM2_BIN" || { echo "pm2 is unavailable for TEST recovery"; exit 1; }',
    '"$PM2_BIN" stop nwac-admin >/dev/null 2>&1 || true',
    '"$PM2_BIN" stop nwac-portal >/dev/null 2>&1 || true',
    'mkdir -p "$TX_ROOT/failed"',
    'PATH_FAILED_TOKEN=$(date +%s%N)',
    'if [ -d "$TX_ROOT/backup/admin-dashboard" ]; then if [ -e /opt/nwac/admin-dashboard ]; then mv /opt/nwac/admin-dashboard "$TX_ROOT/failed/admin-dashboard-$PATH_FAILED_TOKEN"; fi; mv "$TX_ROOT/backup/admin-dashboard" /opt/nwac/admin-dashboard; fi',
    'if [ -d "$TX_ROOT/backup/portal" ]; then if [ -e /opt/nwac/portal ]; then mv /opt/nwac/portal "$TX_ROOT/failed/portal-$PATH_FAILED_TOKEN"; fi; mv "$TX_ROOT/backup/portal" /opt/nwac/portal; fi',
    'if [ -d "$TX_ROOT/backup/shared" ]; then if [ -e /opt/nwac/shared ]; then mv /opt/nwac/shared "$TX_ROOT/failed/shared-$PATH_FAILED_TOKEN"; fi; mv "$TX_ROOT/backup/shared" /opt/nwac/shared; fi',
    'if [ -d "$TX_ROOT/backup/home-admin-build" ]; then if [ -e /home/ec2-user/admin-dashboard/build ]; then mv /home/ec2-user/admin-dashboard/build "$TX_ROOT/failed/home-admin-build-$PATH_FAILED_TOKEN"; fi; mv "$TX_ROOT/backup/home-admin-build" /home/ec2-user/admin-dashboard/build; fi',
    'if [ -f "$TX_ROOT/backup/home-admin.env" ]; then if [ -e /home/ec2-user/admin-dashboard/.env ]; then mv /home/ec2-user/admin-dashboard/.env "$TX_ROOT/failed/home-admin.env-$PATH_FAILED_TOKEN"; fi; mv "$TX_ROOT/backup/home-admin.env" /home/ec2-user/admin-dashboard/.env; fi',
    'ln -sfnT /opt/nwac/portal /opt/nwac/ISET-intake',
    'if [ "$(cat "$TX_ROOT/prior-portal-running")" = 1 ]; then if "$PM2_BIN" describe nwac-portal >/dev/null 2>&1; then "$PM2_BIN" restart nwac-portal --update-env; else "$PM2_BIN" start /opt/nwac/portal/server.js --name nwac-portal --cwd /opt/nwac/portal --update-env; fi; fi',
    'if [ "$(cat "$TX_ROOT/prior-admin-running")" = 1 ]; then if "$PM2_BIN" describe nwac-admin >/dev/null 2>&1; then "$PM2_BIN" restart nwac-admin --update-env; else "$PM2_BIN" start /opt/nwac/admin-dashboard/isetadminserver.js --name nwac-admin --cwd /opt/nwac/admin-dashboard --update-env; fi; fi',
    '"$PM2_BIN" save >/dev/null || true',
    'for component in admin portal; do ROOT="/opt/nwac/$([ "$component" = admin ] && echo admin-dashboard || echo portal)"; EXPECTED=$(cat "$TX_ROOT/prior-$component-provenance.sha256"); if [ "$EXPECTED" = MISSING ]; then test ! -e "$ROOT/.path-release-provenance.json" || { echo "$component prior provenance was not restored"; exit 1; }; else ACTUAL=$(sha256sum "$ROOT/.path-release-provenance.json" | awk "{print \\$1}"); test "$ACTUAL" = "$EXPECTED" || { echo "$component prior provenance checksum mismatch"; exit 1; }; fi; done',
    'if [ "$(cat "$TX_ROOT/prior-admin-running")" = 1 ]; then curl -fsS --retry 15 --retry-delay 2 --retry-all-errors http://127.0.0.1:5001/readyz >/dev/null; fi',
    'if [ "$(cat "$TX_ROOT/prior-portal-running")" = 1 ]; then curl -fsS --retry 15 --retry-delay 2 --retry-all-errors http://127.0.0.1:5000/readyz >/dev/null; fi',
    'printf "%s\n" recovered > "$TX_ROOT/state"',
  ];
}

function buildTestRetentionCleanupCommands(context) {
  const { releaseId } = context || {};
  assertSafeReleaseId(releaseId);
  return [
    'set -euo pipefail',
    'umask 077',
    `PATH_RELEASE_ID=${quoteBashArgument(releaseId)}`,
    'TX_ROOT="/opt/nwac/.path-release-transactions/$PATH_RELEASE_ID"',
    'test "$(cat "$TX_ROOT/state")" = accepted',
    'rm -rf "$TX_ROOT/backup" "$TX_ROOT/failed" "$TX_ROOT/archives" "$TX_ROOT/npm-cache-admin" "$TX_ROOT/npm-cache-portal" "$TX_ROOT/candidate-admin" "$TX_ROOT/candidate-portal" "$TX_ROOT/candidate-shared" "$TX_ROOT/candidate-home-admin-build"',
    'du -sk "$TX_ROOT"',
  ];
}

function runTestSsmPhase(context, envConfig, label, commandBuilder) {
  const results = [];
  for (const instanceId of context.instanceIds) {
    const commandId = sendSsmCommand(instanceId, commandBuilder(context), envConfig);
    const result = waitSsmCommand(commandId, instanceId, envConfig);
    results.push({ instanceId, commandId, status: result.Status, statusDetails: result.StatusDetails });
  }
  return { label, instances: results };
}

async function stageAdminForTestNative(args, envConfig, releaseId, releaseContext = {}) {
  const bucket = 'nwac-test-artifacts';
  const keyPrefix = 'admin-dashboard';
  const timestamp = formatDeployTimestamp();
  let tempRoot = null;
  const configState = releaseContext.adminConfigState || args.adminDeployConfigState;

  assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'before admin TEST staging');
  assertAdminDeployConfigSourceUnchanged(configState);
  const buildPath = prepareAdminFrontendBuild(args, envConfig, releaseId);

  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-deploy-'));
    const stagingPath = path.join(tempRoot, 'staging');
    fs.mkdirSync(stagingPath, { recursive: true });

    copyValidatedFrontendBuild({
      repoRoot: REPO_ROOT,
      sourceBuildPath: buildPath,
      destinationBuildPath: path.join(stagingPath, 'build'),
      expected: buildAdminFrontendBuildExpectation(args, envConfig, releaseId),
      label: 'admin',
    });
    [
      'isetadminserver.js',
      'package.json',
      'package-lock.json',
    ].forEach(file => {
      copyRequiredFile(path.join(REPO_ROOT, file), path.join(stagingPath, file), 'admin deploy');
    });
    copyRequiredFile(configState.snapshotPath, path.join(stagingPath, '.env.test'), 'frozen admin TEST config');

    ADMIN_REQUIRED_RUNTIME_DIRECTORIES.forEach(dir => {
      copyAdmittedGitSourceDirectory(REPO_ROOT, dir, path.join(stagingPath, dir), 'admin runtime');
    });
    copyAdminRuntimeSql(stagingPath);
    copyAdminSupportScripts(stagingPath);
    copyAdmittedGitSourceDirectory(SHARED_ROOT, '.', path.join(stagingPath, 'shared'), 'shared runtime');
    writeStagingReleaseProvenance(stagingPath, {
      releaseId,
      environment: envConfig.name,
      component: 'admin',
      qualification: releaseContext.qualification,
      externalInputs: { adminEnvironment: adminDeployConfigEvidence(configState) },
    });
    assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'after admin TEST staging');
    assertAdminDeployConfigSourceUnchanged(configState);
    const stagedFilePaths = listArtifactFilePaths(stagingPath);

    const archiveName = `admin-dashboard-${timestamp}.zip`;
    const archivePath = path.join(tempRoot, archiveName);
    const archive = await createZipFromDirectory(stagingPath, archivePath);
    const archiveContentPreflight = assertArchiveContains(
      archivePath,
      stagedFilePaths,
      'admin'
    );
    const archiveExclusionPreflight = assertArchiveExcludesPrefixes(
      archivePath,
      ['sql/ops', ...RETIRED_RELEASE_ARTIFACT_PATHS],
      'admin'
    );
    archiveContentPreflight.excludedPrefixes = archiveExclusionPreflight.excludedPrefixes;
    archiveContentPreflight.supportScripts = assertArchiveScriptAllowlist(
      archivePath,
      ADMIN_SUPPORT_SCRIPT_FILES,
      'admin'
    );
    archiveContentPreflight.adminConfig = assertArchiveEntrySha256(
      archivePath,
      '.env.test',
      configState.sha256,
      'admin'
    );
    assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'before admin TEST upload');
    assertAdminDeployConfigSourceUnchanged(configState);
    const immutable = uploadContentAddressedArtifact({
      archivePath,
      bucket,
      component: 'admin',
      releaseId,
      envConfig,
    });
    const timestampKey = joinS3Key(keyPrefix, archiveName);
    const bootstrapCompatibilityKey = 'bootstrap/admin-dashboard-latest.zip';

    return {
      artifact: `s3://${bucket}/${immutable.key}`,
      bucket,
      immutableKey: immutable.key,
      timestampKey,
      bootstrapCompatibilityKey,
      sha256: immutable.sha256,
      archiveBytes: immutable.bytes,
      archiveContentPreflight,
    };
  } finally {
    if (tempRoot) {
      removePath(tempRoot);
    }
  }
}

async function stagePortalForTestNative(args, envConfig, releaseId, releaseContext = {}) {
  const bucket = 'nwac-test-artifacts';
  const keyPrefix = 'portal';
  const timestamp = formatDeployTimestamp();
  let tempRoot = null;
  assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'before portal TEST staging');
  const buildPath = preparePortalFrontendBuild(args, envConfig, releaseId);

  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-deploy-'));
    const stagingPath = path.join(tempRoot, 'staging');
    fs.mkdirSync(stagingPath, { recursive: true });

    copyValidatedFrontendBuild({
      repoRoot: PORTAL_ROOT,
      sourceBuildPath: buildPath,
      destinationBuildPath: path.join(stagingPath, 'build'),
      expected: buildPortalFrontendBuildExpectation(args, envConfig, releaseId),
      label: 'portal',
    });
    PORTAL_REQUIRED_RUNTIME_DIRECTORIES.forEach(directory => {
      copyAdmittedGitSourceDirectory(
        PORTAL_ROOT,
        directory,
        path.join(stagingPath, directory),
        'portal runtime'
      );
    });
    PORTAL_OPTIONAL_MANAGED_DIRECTORIES.forEach(directory => {
      copyAdmittedGitSourceDirectory(
        PORTAL_ROOT,
        directory,
        path.join(stagingPath, directory),
        'optional portal runtime',
        { required: false }
      );
    });
    copyAdmittedGitSourceDirectory(SHARED_ROOT, '.', path.join(stagingPath, 'shared'), 'shared runtime');
    [
      '.env.test',
      'server.js',
      'package.json',
      'package-lock.json',
      'migrationRunner.js',
      'mimeSniff.js',
      'uploadPolicy.js',
      's3Provider.js',
      'sesMailer.js',
    ].forEach(file => {
      copyRequiredFile(path.join(PORTAL_ROOT, file), path.join(stagingPath, file), 'portal runtime');
    });
    copyRequiredFile(path.join(stagingPath, '.env.test'), path.join(stagingPath, '.env'), 'portal TEST runtime');
    writeStagingReleaseProvenance(stagingPath, {
      releaseId,
      environment: envConfig.name,
      component: 'portal',
      qualification: releaseContext.qualification,
    });
    assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'after portal TEST staging');
    const stagedFilePaths = listArtifactFilePaths(stagingPath);

    const archiveName = `portal-${timestamp}.zip`;
    const archivePath = path.join(tempRoot, archiveName);
    const archive = await createZipFromDirectory(stagingPath, archivePath);
    const archiveContentPreflight = assertArchiveContains(
      archivePath,
      stagedFilePaths,
      'portal'
    );
    const archiveExclusionPreflight = assertArchiveExcludesPrefixes(
      archivePath,
      ['scripts'],
      'portal'
    );
    archiveContentPreflight.excludedPrefixes = archiveExclusionPreflight.excludedPrefixes;
    assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'before portal TEST upload');
    const immutable = uploadContentAddressedArtifact({
      archivePath,
      bucket,
      component: 'portal',
      releaseId,
      envConfig,
    });
    const timestampKey = joinS3Key(keyPrefix, archiveName);
    const bootstrapCompatibilityKey = 'bootstrap/portal-latest.zip';

    return {
      artifact: `s3://${bucket}/${immutable.key}`,
      bucket,
      immutableKey: immutable.key,
      timestampKey,
      bootstrapCompatibilityKey,
      sha256: immutable.sha256,
      archiveBytes: immutable.bytes,
      archiveContentPreflight,
    };
  } finally {
    if (tempRoot) {
      removePath(tempRoot);
    }
  }
}

async function deploySharedToProdNative(args, envConfig, releaseId, releaseContext = {}) {
  const keyPrefix = 'shared';
  const archiveName = 'shared-latest.zip';
  let tempRoot = null;

  if (!fs.existsSync(SHARED_ROOT)) {
    throw new Error(`Shared repo not found at '${SHARED_ROOT}'.`);
  }
  assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'before shared PROD staging');

  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-prod-deploy-'));
    const stagingPath = path.join(tempRoot, 'staging');
    fs.mkdirSync(stagingPath, { recursive: true });
    copyAdmittedGitSourceDirectory(SHARED_ROOT, '.', path.join(stagingPath, 'shared'), 'shared runtime');
    writeStagingReleaseProvenance(stagingPath, {
      releaseId,
      environment: envConfig.name,
      component: 'shared',
      qualification: releaseContext.qualification,
    });
    assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'after shared PROD staging');
    const stagedFilePaths = listArtifactFilePaths(stagingPath);

    const archivePath = path.join(tempRoot, archiveName);
    await createZipFromDirectory(stagingPath, archivePath);
    assertArchiveContains(archivePath, stagedFilePaths, 'shared');
    assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'before shared PROD upload');
    const s3Key = joinS3Key(keyPrefix, archiveName);
    return stageProdArtifactPair({
      archivePath,
      component: 'shared',
      releaseId,
      compatibilityKey: s3Key,
      stagingRoot: releaseContext.prodArtifactStagingRoot,
      compatibilityOnly: args.compatibilityOnly,
    });
  } finally {
    if (tempRoot) {
      removePath(tempRoot);
    }
  }
}

async function deployAdminToProdNative(args, envConfig, releaseId, releaseContext = {}) {
  const keyPrefix = 'admin';
  const archiveName = 'admin-dashboard-latest.zip';
  let tempRoot = null;
  const configState = releaseContext.adminConfigState || args.adminDeployConfigState;

  assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'before admin PROD staging');
  assertAdminDeployConfigSourceUnchanged(configState);
  const buildPath = prepareAdminFrontendBuild(args, envConfig, releaseId);

  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-prod-deploy-'));
    const stagingPath = path.join(tempRoot, 'staging');
    fs.mkdirSync(stagingPath, { recursive: true });

    copyValidatedFrontendBuild({
      repoRoot: REPO_ROOT,
      sourceBuildPath: buildPath,
      destinationBuildPath: path.join(stagingPath, 'build'),
      expected: buildAdminFrontendBuildExpectation(args, envConfig, releaseId),
      label: 'admin',
    });
    [
      'isetadminserver.js',
      'package.json',
      'package-lock.json',
    ].forEach(file => {
      copyRequiredFile(path.join(REPO_ROOT, file), path.join(stagingPath, file), 'admin deploy');
    });

    ADMIN_REQUIRED_RUNTIME_DIRECTORIES.forEach(dir => {
      copyAdmittedGitSourceDirectory(REPO_ROOT, dir, path.join(stagingPath, dir), 'admin runtime');
    });
    copyAdminRuntimeSql(stagingPath);
    copyAdminSupportScripts(stagingPath);
    copyAdmittedGitSourceDirectory(SHARED_ROOT, '.', path.join(stagingPath, 'shared'), 'shared runtime');
    writeStagingReleaseProvenance(stagingPath, {
      releaseId,
      environment: envConfig.name,
      component: 'admin',
      qualification: releaseContext.qualification,
      externalInputs: { adminEnvironment: adminDeployConfigEvidence(configState) },
    });
    assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'after admin PROD staging');
    assertAdminDeployConfigSourceUnchanged(configState);
    const stagedFilePaths = listArtifactFilePaths(stagingPath);

    const archivePath = path.join(tempRoot, archiveName);
    await createZipFromDirectory(stagingPath, archivePath);
    const archiveContentPreflight = assertArchiveContains(
      archivePath,
      stagedFilePaths,
      'admin'
    );
    const archiveExclusionPreflight = assertArchiveExcludesPrefixes(
      archivePath,
      ['sql/ops', '.env.production', '.env.test', ...RETIRED_RELEASE_ARTIFACT_PATHS],
      'admin'
    );
    archiveContentPreflight.excludedPrefixes = archiveExclusionPreflight.excludedPrefixes;
    archiveContentPreflight.supportScripts = assertArchiveScriptAllowlist(
      archivePath,
      ADMIN_SUPPORT_SCRIPT_FILES,
      'admin'
    );
    assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'before admin PROD upload');
    assertAdminDeployConfigSourceUnchanged(configState);
    const s3Key = joinS3Key(keyPrefix, archiveName);
    return {
      ...stageProdArtifactPair({
        archivePath,
        component: 'admin',
        releaseId,
        compatibilityKey: s3Key,
        stagingRoot: releaseContext.prodArtifactStagingRoot,
        compatibilityOnly: args.compatibilityOnly,
      }),
      archiveContentPreflight,
    };
  } finally {
    if (tempRoot) {
      removePath(tempRoot);
    }
  }
}

async function deployPortalToProdNative(args, envConfig, releaseId, releaseContext = {}) {
  const keyPrefix = 'portal';
  const archiveName = 'portal-latest.zip';
  let tempRoot = null;

  assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'before portal PROD staging');
  const buildPath = preparePortalFrontendBuild(args, envConfig, releaseId);

  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-prod-deploy-'));
    const stagingPath = path.join(tempRoot, 'staging');
    fs.mkdirSync(stagingPath, { recursive: true });

    copyValidatedFrontendBuild({
      repoRoot: PORTAL_ROOT,
      sourceBuildPath: buildPath,
      destinationBuildPath: path.join(stagingPath, 'build'),
      expected: buildPortalFrontendBuildExpectation(args, envConfig, releaseId),
      label: 'portal',
    });
    PORTAL_REQUIRED_RUNTIME_DIRECTORIES.forEach(directory => {
      copyAdmittedGitSourceDirectory(
        PORTAL_ROOT,
        directory,
        path.join(stagingPath, directory),
        'portal runtime'
      );
    });
    PORTAL_OPTIONAL_MANAGED_DIRECTORIES.forEach(directory => {
      copyAdmittedGitSourceDirectory(
        PORTAL_ROOT,
        directory,
        path.join(stagingPath, directory),
        'optional portal runtime',
        { required: false }
      );
    });
    copyAdmittedGitSourceDirectory(SHARED_ROOT, '.', path.join(stagingPath, 'shared'), 'shared runtime');

    [
      'server.js',
      'package.json',
      'package-lock.json',
      '.env.production',
      'migrationRunner.js',
      'mimeSniff.js',
      'uploadPolicy.js',
      's3Provider.js',
      'sesMailer.js',
    ].forEach(file => {
      copyRequiredFile(path.join(PORTAL_ROOT, file), path.join(stagingPath, file), 'portal runtime');
    });
    writeStagingReleaseProvenance(stagingPath, {
      releaseId,
      environment: envConfig.name,
      component: 'portal',
      qualification: releaseContext.qualification,
    });
    assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'after portal PROD staging');
    const stagedFilePaths = listArtifactFilePaths(stagingPath);

    const archivePath = path.join(tempRoot, archiveName);
    await createZipFromDirectory(stagingPath, archivePath);
    const archiveContentPreflight = assertArchiveContains(
      archivePath,
      stagedFilePaths,
      'portal'
    );
    const archiveExclusionPreflight = assertArchiveExcludesPrefixes(
      archivePath,
      ['scripts'],
      'portal'
    );
    archiveContentPreflight.excludedPrefixes = archiveExclusionPreflight.excludedPrefixes;
    assertReleaseSourceSnapshotUnchanged(releaseContext.initialRepos, buildAppPlan(args, envConfig), 'before portal PROD upload');
    const s3Key = joinS3Key(keyPrefix, archiveName);
    return {
      ...stageProdArtifactPair({
        archivePath,
        component: 'portal',
        releaseId,
        compatibilityKey: s3Key,
        stagingRoot: releaseContext.prodArtifactStagingRoot,
        compatibilityOnly: args.compatibilityOnly,
      }),
      archiveContentPreflight,
    };
  } finally {
    if (tempRoot) {
      removePath(tempRoot);
    }
  }
}

function startProdInstanceRefresh(envConfig) {
  const response = runAwsJson([
    'autoscaling',
    'start-instance-refresh',
    '--auto-scaling-group-name',
    PROD_ASG_NAME,
    '--preferences',
    PROD_INSTANCE_REFRESH_PREFERENCES,
  ], envConfig);
  const refreshId = response.InstanceRefreshId;
  if (!refreshId) {
    throw new Error('Failed to start prod instance refresh.');
  }
  console.log(`Started prod instance refresh: ${refreshId}`);
  return refreshId;
}

function waitProdInstanceRefresh(refreshId, envConfig) {
  const nonTerminalStatuses = new Set(['Pending', 'InProgress', 'Cancelling', 'RollbackInProgress']);

  while (true) {
    runCommand('bash', ['-lc', 'sleep 15'], { capture: true });
    const response = runAwsJson([
      'autoscaling',
      'describe-instance-refreshes',
      '--auto-scaling-group-name',
      PROD_ASG_NAME,
      '--instance-refresh-ids',
      refreshId,
    ], envConfig);
    const refresh = (response.InstanceRefreshes || [])[0];
    if (!refresh) {
      throw new Error(`Prod instance refresh not found: ${refreshId}`);
    }

    const percent = refresh.PercentageComplete == null ? 0 : refresh.PercentageComplete;
    console.log(`Prod refresh status: ${refresh.Status} (${percent}% complete)`);
    if (refresh.StatusReason) {
      console.log(refresh.StatusReason);
    }

    if (nonTerminalStatuses.has(refresh.Status)) {
      continue;
    }
    if (refresh.Status !== 'Successful') {
      throw new Error(`Prod instance refresh ${refreshId} ended with status ${refresh.Status}`);
    }
    return {
      autoScalingGroupName: PROD_ASG_NAME,
      instanceRefreshId: refreshId,
      status: refresh.Status,
      percentageComplete: refresh.PercentageComplete,
      statusReason: refresh.StatusReason || null,
      startTime: refresh.StartTime || null,
      endTime: refresh.EndTime || null,
    };
  }
}

async function deployProdApplicationsNative(args, envConfig, appPlan, releaseId, releaseContext = {}) {
  const prodArtifactStagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-release-artifacts-'));
  const prodReleaseContext = { ...releaseContext, prodArtifactStagingRoot };
  const result = {
    ...appPlan,
    runner: 'wsl-native-node-artifacts-asg-refresh',
    artifacts: {},
  };

  try {
    if (appPlan.deployShared) {
      result.artifacts.shared = await deploySharedToProdNative(args, envConfig, releaseId, prodReleaseContext);
    }
    if (appPlan.deployAdmin) {
      result.artifacts.admin = await deployAdminToProdNative(args, envConfig, releaseId, prodReleaseContext);
    }
    if (appPlan.deployPortal) {
      result.artifacts.portal = await deployPortalToProdNative(args, envConfig, releaseId, prodReleaseContext);
    }

    if (!args.compatibilityOnly) {
      for (const [component, artifact] of Object.entries(result.artifacts)) {
        uploadStagedProdImmutableArtifact(artifact, component, releaseId, envConfig);
      }
    }

    const descriptorComponents = ['shared', 'admin', 'portal'];
    if (args.compatibilityOnly) {
      result.releaseDescriptor = {
        skipped: true,
        reason: 'compatibility-only-operator-recovery',
      };
    } else if (descriptorComponents.every(component => result.artifacts[component])) {
      const descriptor = createReleaseDescriptor({
        releaseId,
        environment: envConfig.name,
        requiredComponents: descriptorComponents,
        artifacts: Object.fromEntries(descriptorComponents.map(component => [component, {
          key: result.artifacts[component].immutableKey,
          sha256: result.artifacts[component].sha256,
          bytes: result.artifacts[component].archiveBytes,
        }])),
        source: releaseContext.repos || {},
        preflight: releaseContext.preflight || {},
        externalInputs: releaseContext.adminConfig
          ? { adminEnvironment: releaseContext.adminConfig }
          : {},
      });
      result.releaseDescriptor = uploadProdReleaseDescriptor(descriptor, envConfig);
    } else {
      result.releaseDescriptor = {
        skipped: true,
        reason: 'partial-release-requires-current-descriptor-merge-before-activation',
      };
    }

    result.compatibilityPromotion = promoteProdCompatibilityArtifacts(
      result.artifacts,
      envConfig,
      { compatibilityOnly: args.compatibilityOnly }
    );
    if (appPlan.refreshProd) {
      const refreshId = startProdInstanceRefresh(envConfig);
      result.refresh = waitProdInstanceRefresh(refreshId, envConfig);
    }

    Object.values(result.artifacts).forEach(artifact => {
      delete artifact.localArchivePath;
    });
    return result;
  } finally {
    removePath(prodArtifactStagingRoot);
  }
}

function seedWindowsAwsCredentials(envConfig) {
  if (process.platform !== 'win32') {
    return;
  }

  const commandText = [
    'AWS_PAGER=\'\'',
    'AWS_CLI_AUTO_PROMPT=off',
    'aws',
    'configure',
    'export-credentials',
    '--profile',
    quoteBashArgument(envConfig.profile),
    '--format',
    'env-no-export',
  ].join(' ');

  const result = runCommand('bash', ['-lc', commandText], { capture: true });
  const lines = String(result.stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  lines.forEach(line => {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      return;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    if (key) {
      process.env[key] = value;
    }
  });

  process.env.AWS_REGION = envConfig.region;
  process.env.AWS_DEFAULT_REGION = envConfig.region;
}

function applySchema(args, envConfig) {
  const scriptArgs = [
    'apply',
    '--target-env',
    envConfig.name,
    '--profile',
    envConfig.profile,
    '--region',
    envConfig.region,
  ];
  if (envConfig.name === 'prod') {
    scriptArgs.push('--yes');
  }
  const result = runJsonNodeScript(path.join(REPO_ROOT, 'scripts', 'path-schema-migrate.js'), scriptArgs);
  return assertMigrationApplySucceeded(result, {
    context: `Deploy schema apply on ${envConfig.name}`,
  });
}

function runTestDbRefresh(args, envConfig) {
  const scriptArgs = [
    'run',
    '--profile',
    envConfig.profile,
    '--region',
    envConfig.region,
    '--source-env',
    args.sourceEnv,
    '--skip-smoke',
    '--yes',
  ];
  if (args.sourceEnvFile) {
    scriptArgs.push('--source-env-file', args.sourceEnvFile);
  }
  if (args.skipSchema) {
    scriptArgs.push('--skip-schema');
  }
  return runJsonNodeScript(path.join(REPO_ROOT, 'scripts', 'path-test-db-refresh.js'), scriptArgs);
}

function applyData(args, envConfig) {
  const scriptArgs = [
    'apply',
    '--dataset',
    args.dataset,
    '--source-env',
    args.sourceEnv,
    '--target-env',
    envConfig.name,
    '--profile',
    envConfig.profile,
    '--region',
    envConfig.region,
  ];
  if (args.workflowId) {
    scriptArgs.push('--workflow-id', args.workflowId);
  }
  if (args.sourceEnvFile) {
    scriptArgs.push('--env-file', args.sourceEnvFile);
  }
  if (envConfig.name === 'prod') {
    scriptArgs.push('--yes');
  }
  return runJsonNodeScript(path.join(REPO_ROOT, 'scripts', 'path-data-sync.js'), scriptArgs);
}

async function deployApplications(args, envConfig, appPlan, releaseId, releaseContext = {}) {
  if (envConfig.name === 'test') {
    const result = {
      ...appPlan,
      runner: 'wsl-native-atomic-stage',
      artifacts: {},
    };
    if (appPlan.deployPortal) {
      result.artifacts.portal = await stagePortalForTestNative(args, envConfig, releaseId, releaseContext);
    }
    if (appPlan.deployAdmin) {
      result.artifacts.admin = await stageAdminForTestNative(args, envConfig, releaseId, releaseContext);
    }
    return result;
  }

  if (envConfig.name === 'prod') {
    return deployProdApplicationsNative(args, envConfig, appPlan, releaseId, releaseContext);
  }

  return appPlan;
}

function buildTestAtomicContext({ releaseId, appResult, releaseContext, envConfig }) {
  const artifacts = Object.fromEntries(Object.entries(appResult?.artifacts || {}).map(([component, artifact]) => [component, {
    bucket: artifact.bucket,
    immutableKey: artifact.immutableKey,
    sha256: artifact.sha256,
    archiveBytes: artifact.archiveBytes,
  }]));
  if (!Object.keys(artifacts).length) throw new Error('TEST recovery context requires staged artifacts.');
  return {
    schemaVersion: 1,
    releaseId,
    environment: 'test',
    region: envConfig.region,
    autoScalingGroup: 'nwac-test-asg',
    instanceIds: discoverAsgInstances('nwac-test-asg', envConfig),
    artifacts,
    repos: releaseContext.initialRepos,
    qualificationDecision: releaseContext.qualification?.decision || null,
    transactionRoot: `/opt/nwac/.path-release-transactions/${releaseId}`,
    state: 'planned',
  };
}

function prepareTestAtomicRollout(context, envConfig) {
  return runTestSsmPhase(context, envConfig, 'prepare', buildTestAtomicPrepareCommands);
}

function cutoverTestAtomicRollout(context, envConfig) {
  return runTestSsmPhase(context, envConfig, 'cutover', buildTestAtomicCutoverCommands);
}

function verifyTestAtomicRollout(context, envConfig) {
  return runTestSsmPhase(context, envConfig, 'postflight', buildTestExactPostflightCommands);
}

function acceptTestAtomicRollout(context, envConfig) {
  return runTestSsmPhase(
    context,
    envConfig,
    'accept',
    recoveryContext => buildTestRecoveryCommands(recoveryContext, { markAccepted: true })
  );
}

function cleanupAcceptedTestAtomicRollout(context, envConfig) {
  return runTestSsmPhase(context, envConfig, 'retention-cleanup', buildTestRetentionCleanupCommands);
}

async function recoverTestAtomicRollout(context, envConfig, smokeTargets) {
  const remote = runTestSsmPhase(
    context,
    envConfig,
    'recover',
    recoveryContext => buildTestRecoveryCommands(recoveryContext)
  );
  const smoke = await runSmokeChecksForEnvironment(envConfig, smokeTargets);
  return { remote, smoke, state: 'recovered' };
}

function promoteTestArtifactsAfterSmoke(appResult, smokeResults, envConfig, {
  promoteArtifact = promoteTestArtifactAliases,
  snapshotArtifact = snapshotTestBootstrapArtifactAlias,
  restoreArtifact = restoreTestBootstrapArtifactAlias,
} = {}) {
  const artifacts = Object.values(appResult?.artifacts || {});
  if (!artifacts.length) return { promoted: {}, skipped: true, reason: 'no-test-artifacts' };
  if (!Array.isArray(smokeResults) || !smokeResults.length) {
    throw new Error('TEST mutable artifact aliases require successful post-install smoke evidence.');
  }
  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-bootstrap-snapshot-'));
  const snapshots = {};
  const attempted = [];
  try {
    for (const [component, artifact] of Object.entries(appResult.artifacts)) {
      snapshots[component] = snapshotArtifact(artifact, envConfig, snapshotRoot, component);
    }
    const promoted = {};
    for (const [component, artifact] of Object.entries(appResult.artifacts)) {
      attempted.push(component);
      const promotion = promoteArtifact(artifact, envConfig);
      Object.assign(artifact, promotion);
      promoted[component] = promotion;
    }
    return { promoted, skipped: false };
  } catch (error) {
    const rollbackErrors = [];
    for (const component of attempted.reverse()) {
      try {
        restoreArtifact(snapshots[component], envConfig, component);
      } catch (rollbackError) {
        rollbackErrors.push(`${component}: ${rollbackError.message}`);
      }
    }
    if (rollbackErrors.length) {
      error.message += `; TEST bootstrap rollback failed (${rollbackErrors.join('; ')})`;
    }
    throw error;
  } finally {
    removePath(snapshotRoot);
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({
          url,
          statusCode: response.statusCode || 0,
          ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
          body: body.trim(),
        });
      });
    });

    request.setTimeout(15000, () => {
      request.destroy(new Error(`Timeout fetching ${url}`));
    });
    request.on('error', reject);
  });
}

function describeTargetGroupHealth(target, envConfig) {
  const targetGroup = runAwsJson(
    ['elbv2', 'describe-target-groups', '--names', target.targetGroupName],
    envConfig
  );
  const targetGroupArn = ((targetGroup.TargetGroups || [])[0] || {}).TargetGroupArn;
  if (!targetGroupArn) {
    throw new Error(`Target group not found: ${target.targetGroupName}`);
  }

  const payload = runAwsJson(
    ['elbv2', 'describe-target-health', '--target-group-arn', targetGroupArn],
    envConfig
  );
  const descriptions = payload.TargetHealthDescriptions || [];
  if (!descriptions.length) {
    throw new Error(`Target group has no registered targets: ${target.targetGroupName}`);
  }

  const targets = descriptions.map(item => ({
    id: item.Target && item.Target.Id,
    port: item.Target && item.Target.Port,
    state: item.TargetHealth && item.TargetHealth.State,
    reason: item.TargetHealth && item.TargetHealth.Reason,
    description: item.TargetHealth && item.TargetHealth.Description,
  }));
  const failed = targets.find(item => item.state !== 'healthy');
  if (failed) {
    throw new Error(
      `Target group ${target.targetGroupName} has unhealthy target ${failed.id}:${failed.port} (${failed.state}${failed.reason ? `, ${failed.reason}` : ''})`
    );
  }

  return {
    service: target.service,
    targetGroupName: target.targetGroupName,
    targetGroupArn,
    ok: true,
    targets,
  };
}

async function runSmokeChecksForEnvironment(envConfig, targets) {
  const results = [];
  for (const target of targets) {
    if (target.type === 'target-group') {
      results.push(describeTargetGroupHealth(target, envConfig));
      continue;
    }

    const response = await httpGet(target.url);
    const result = {
      service: target.service,
      url: target.url,
      statusCode: response.statusCode,
      ok: response.ok,
      body: response.body,
    };
    if (!result.ok) {
      throw new Error(`Smoke check failed for ${result.url} (${result.statusCode})`);
    }
    results.push(result);
  }
  return results;
}

function buildRepoState() {
  return {
    adminDashboard: buildGitRepoState(REPO_ROOT, EXPECTED_RELEASE_REPO_BASENAMES.adminDashboard),
    portal: buildGitRepoState(PORTAL_ROOT, EXPECTED_RELEASE_REPO_BASENAMES.portal),
    shared: buildGitRepoState(SHARED_ROOT, EXPECTED_RELEASE_REPO_BASENAMES.shared),
  };
}

function canonicalSchemaFingerprint() {
  const migrationsRoot = path.join(REPO_ROOT, 'sql', 'migrations');
  const files = fs.readdirSync(migrationsRoot)
    .filter(filename => filename.endsWith('.sql'))
    .sort();
  return sha256Files(migrationsRoot, files);
}

function qualificationSourceFromRepoState(repoState) {
  return {
    admin: repoState.adminDashboard,
    portal: repoState.portal,
    shared: repoState.shared,
  };
}

function requiredQualificationOperations(args) {
  const operations = [];
  if (args.refreshTestDb) operations.push('test-db-refresh');
  if (!args.skipData && args.dataset) operations.push(`dataset:${args.dataset}`);
  if (!args.skipData && args.workflowId) operations.push(`workflow:${args.workflowId}`);
  return operations;
}

function admitReleaseQualification(args, envConfig, plan, repoState) {
  if (!args.qualificationEvidence) {
    throw new Error('Release run requires --qualification-evidence. A health check or preflight suite alone cannot authorize deployment.');
  }
  if (!fs.existsSync(args.qualificationEvidence)) {
    throw new Error(`Qualification evidence not found: ${args.qualificationEvidence}`);
  }
  const evidence = JSON.parse(fs.readFileSync(args.qualificationEvidence, 'utf8'));
  const inventory = JSON.parse(fs.readFileSync(RELEASE_QUALIFICATION_INVENTORY, 'utf8'));
  const expectedStage = envConfig.name === 'prod' ? 'test' : 'dev';
  const requiredComponents = ['admin', 'portal', 'shared'];
  const errors = validateQualificationEvidence({
    evidence,
    expectedStage,
    currentSource: qualificationSourceFromRepoState(repoState),
    inventorySha256: sha256Json(inventory),
    schemaSha256: canonicalSchemaFingerprint(),
    requiredComponents,
  });
  if (evidence.releaseId !== plan.releaseId) {
    errors.push(`qualification release ID ${evidence.releaseId || 'missing'} does not match deploy release ID ${plan.releaseId}`);
  }
  const declaredOperations = new Set(evidence.operations || []);
  requiredQualificationOperations(args).forEach(operation => {
    if (!declaredOperations.has(operation)) errors.push(`qualification did not declare required operation ${operation}`);
  });
  if (args.emergencyRelease) {
    const reason = String(args.emergencyReleaseReason || '').trim();
    if (envConfig.name !== 'prod') {
      throw new Error('--emergency-release is available only for PROD');
    }
    if (!args.yes) {
      throw new Error('--emergency-release requires --yes');
    }
    if (!args.skipSchema || !args.skipData || args.dataset || args.workflowId || args.refreshTestDb) {
      throw new Error('--emergency-release is app-only and requires --skip-schema --skip-data with no dataset, workflow, or TEST DB refresh operation');
    }
    if (reason.length < 24) {
      throw new Error('--emergency-release-reason must contain a specific operator authorization and rationale (at least 24 characters)');
    }
    return {
      path: args.qualificationEvidence,
      stage: evidence.stage || null,
      decision: 'EMERGENCY-AUTHORIZED',
      evidenceDecision: evidence.decision || null,
      evidenceId: evidence.evidenceId || null,
      evidenceReleaseId: evidence.releaseId || null,
      releaseId: plan.releaseId,
      emergencyRelease: true,
      emergencyReleaseReason: reason,
      validationErrors: errors,
      domains: evidence.domains || [],
      operations: [],
      candidate: {
        source: qualificationSourceFromRepoState(repoState),
        schemaSha256: canonicalSchemaFingerprint(),
      },
    };
  }
  if (errors.length) throw new Error(`Release qualification rejected: ${errors.join('; ')}`);
  return {
    path: args.qualificationEvidence,
    stage: evidence.stage,
    decision: evidence.decision,
    evidenceId: evidence.evidenceId,
    releaseId: evidence.releaseId,
    expiresAt: evidence.expiresAt,
    domains: evidence.domains,
    operations: evidence.operations || [],
    candidate: evidence.candidate,
  };
}

function repoPathForKey(key) {
  if (key === 'adminDashboard') return REPO_ROOT;
  if (key === 'portal') return PORTAL_ROOT;
  if (key === 'shared') return SHARED_ROOT;
  throw new Error(`Unknown preflight repository key: ${key}`);
}

function snapshotGeneratedBuildMetadata() {
  return [
    path.join(REPO_ROOT, 'src', 'generated', 'buildInfo.js'),
    path.join(REPO_ROOT, 'src', 'generated', 'publicReleaseNotes.js'),
    path.join(PORTAL_ROOT, 'src', 'generated', 'buildInfo.js'),
  ].map(filename => ({
    filename,
    content: fs.existsSync(filename) ? fs.readFileSync(filename) : null,
  }));
}

function restoreGeneratedBuildMetadata(snapshots) {
  (snapshots || []).forEach(snapshot => {
    if (snapshot.content === null) fs.rmSync(snapshot.filename, { force: true });
    else fs.writeFileSync(snapshot.filename, snapshot.content);
  });
}

function runReleasePreflight(args, envConfig, appPlan, releaseId, initialRepoState) {
  const snapshots = snapshotGeneratedBuildMetadata();
  const checks = buildPreflightPlan(appPlan);
  const results = [];
  try {
    const needsBoth = Boolean(appPlan.deployShared);
    if (appPlan.deployAdmin || needsBoth) prepareAdminFrontendBuild(args, envConfig, releaseId);
    if (appPlan.deployPortal || needsBoth) preparePortalFrontendBuild(args, envConfig, releaseId);
    args.preflightBuilds = true;
    for (const check of checks) {
      const startedAt = new Date().toISOString();
      runCommand(check.command, check.args, { cwd: repoPathForKey(check.repo) });
      const finishedAt = new Date().toISOString();
      results.push({
        ...check,
        status: 'successful',
        startedAt,
        finishedAt,
        durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
      });
    }
  } finally {
    restoreGeneratedBuildMetadata(snapshots);
  }
  const finalRepoState = buildRepoState();
  const sourceRepoKeys = new Set(checks.map(check => check.repo));
  buildProdAppSourceRepoKeys(appPlan).forEach(key => sourceRepoKeys.add(key));
  sourceRepoKeys.forEach(key => {
    const before = initialRepoState[key];
    const after = finalRepoState[key];
    if (!before || !after || before.gitHead !== after.gitHead || before.treeFingerprint !== after.treeFingerprint) {
      throw new Error(`Release preflight source changed while checks were running: ${key}`);
    }
  });
  const evidence = {
    schemaVersion: 1,
    originalSource: Object.fromEntries(Array.from(sourceRepoKeys).map(key => [key, {
      gitHead: initialRepoState[key]?.gitHead || null,
      treeFingerprint: initialRepoState[key]?.treeFingerprint || null,
      gitDirty: Boolean(initialRepoState[key]?.gitDirty),
    }])),
    source: Object.fromEntries(Array.from(sourceRepoKeys).map(key => [key, {
      gitHead: finalRepoState[key]?.gitHead || null,
      treeFingerprint: finalRepoState[key]?.treeFingerprint || null,
      gitDirty: Boolean(finalRepoState[key]?.gitDirty),
    }])),
    checks: results,
  };
  evidence.evidenceId = crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
  return evidence;
}

function cleanupPreparedBuilds(args) {
  if (args.adminDeployConfigState?.snapshotRoot) {
    removePath(args.adminDeployConfigState.snapshotRoot);
  }
  args.adminDeployConfigState = null;
  const allowedRoot = path.join(REPO_ROOT, 'tmp', 'path-deploy-builds');
  const cleanupRoot = args.portalBuildCleanupRoot && path.resolve(args.portalBuildCleanupRoot);
  if (!cleanupRoot) return;
  const relative = path.relative(allowedRoot, cleanupRoot);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean prepared build outside '${allowedRoot}': ${cleanupRoot}`);
  }
  removePath(cleanupRoot);
  args.portalBuildPath = null;
  args.portalBuildCleanupRoot = null;
}

function buildProdAppSourceRepoKeys(appPlan) {
  // The orchestrator and every schema/data/app action execute code from the
  // admin repository, even when no admin artifact is selected.
  const keys = new Set(['adminDashboard']);
  if (appPlan.deployAdmin) {
    keys.add('adminDashboard');
    keys.add('shared');
  }
  if (appPlan.deployPortal) {
    keys.add('portal');
    keys.add('shared');
  }
  if (appPlan.deployShared) {
    keys.add('shared');
  }
  return Array.from(keys);
}

function assertDeploySourceState(_args, envConfig, appPlan, repoState) {
  const sourceRepoKeys = buildProdAppSourceRepoKeys(appPlan);
  const missingRepos = sourceRepoKeys.filter(key => !repoState[key]);
  if (missingRepos.length) {
    throw new Error(`Release source state is missing required repositories: ${missingRepos.join(', ')}`);
  }
  const invalidRepos = sourceRepoKeys
    .map(key => ({ key, state: repoState[key] }))
    .filter(({ key, state }) => (
      state.repositoryValid !== true ||
      !state.gitHead ||
      !state.treeFingerprint ||
      state.gitDetached !== true ||
      Number(state.gitSpecialIndexFlagCount || 0) !== 0 ||
      path.basename(path.resolve(state.path || '')) !== EXPECTED_RELEASE_REPO_BASENAMES[key] ||
      path.resolve(state.gitTopLevel || '') !== path.resolve(state.path || '')
    ));
  if (invalidRepos.length) {
    const details = invalidRepos.map(({ key, state }) => (
      `${key} (${state.path || '<missing>'}): ${(state.repositoryProofErrors || ['repository_proof_incomplete']).join(', ')}`
    ));
    throw new Error([
      `Refusing ${String(envConfig.name || 'unknown').toUpperCase()} app deploy without exact Git repository proof.`,
      ...details,
    ].join('\n'));
  }
  const dirtyRepos = sourceRepoKeys
    .map(key => ({ key, state: repoState[key] }))
    .filter(entry => entry.state.gitDirty);

  if (!dirtyRepos.length) {
    return {
      skipped: false,
      clean: true,
      sourceRepoKeys,
    };
  }

  const details = dirtyRepos.map(({ key, state }) => {
    const statusLines = (state.gitStatus || []).slice(0, 40).map(line => `  ${line}`);
    const omitted = Number(state.gitStatusCount || 0) > statusLines.length
      ? [`  ... ${Number(state.gitStatusCount) - statusLines.length} more entries omitted`]
      : [];
    return [`${key} (${state.path})`, ...statusLines, ...omitted].join('\n');
  }).join('\n\n');
  throw new Error([
    `Refusing ${String(envConfig.name || 'unknown').toUpperCase()} app deploy from a dirty source tree.`,
    'Commit the candidate and deploy it from clean, detached sibling worktrees. Dirty-source overrides are not release-admissible.',
    details,
  ].filter(Boolean).join('\n'));
}

function assertReleaseSourceSnapshotUnchanged(initialRepoState, appPlan, phase = 'artifact staging') {
  const currentRepoState = buildRepoState();
  const keys = buildProdAppSourceRepoKeys(appPlan);
  const changed = keys.filter(key => {
    const before = initialRepoState?.[key];
    const after = currentRepoState?.[key];
    return (
      !before || !after ||
      before.repositoryValid !== true || after.repositoryValid !== true ||
      path.resolve(before.gitTopLevel || '') !== path.resolve(after.gitTopLevel || '') ||
      path.resolve(before.path || '') !== path.resolve(after.path || '') ||
      before.gitDetached !== true || after.gitDetached !== true ||
      Number(before.gitSpecialIndexFlagCount || 0) !== 0 ||
      Number(after.gitSpecialIndexFlagCount || 0) !== 0 ||
      before.gitHead !== after.gitHead ||
      before.treeFingerprint !== after.treeFingerprint ||
      Boolean(before.gitDirty) !== Boolean(after.gitDirty) ||
      Number(before.gitStatusCount || 0) !== Number(after.gitStatusCount || 0)
    );
  });
  if (changed.length) {
    throw new Error(`Release source changed after admission during ${phase}: ${changed.join(', ')}`);
  }
  return {
    status: 'passed',
    phase,
    repos: Object.fromEntries(keys.map(key => [key, {
      gitHead: currentRepoState[key].gitHead,
      treeFingerprint: currentRepoState[key].treeFingerprint,
    }])),
  };
}

async function handlePlan(args, envConfig, identity) {
  const repos = buildRepoState();
  const appPlan = buildAppPlan(args, envConfig);
  assertTestRuntimeSmokeRequired(args, envConfig, appPlan);
  const sourceControl = assertDeploySourceState(args, envConfig, appPlan, repos);
  const adminConfigState = needsAdminDeployConfig(appPlan)
    ? captureAdminDeployConfig(args, envConfig)
    : null;
  let plan = buildPlanIntent(args, envConfig, identity);
  const manifestPath = getManifestPath(envConfig.name, plan.releaseId);
  const manifest = {
    generatedAt: new Date().toISOString(),
    status: 'planning',
    ...plan,
    repos,
    sourceControl,
    adminConfig: adminDeployConfigEvidence(adminConfigState),
    steps: [],
  };
  writeManifest(manifestPath, manifest);

  try {
    plan = await runStep(
      manifest,
      manifestPath,
      'plan.resolve',
      async () => resolvePlan(args, envConfig, plan)
    );
    Object.assign(manifest, plan, { status: 'planned' });
    writeManifest(manifestPath, manifest);
  } catch (error) {
    manifest.status = 'failed';
    manifest.finishedAt = new Date().toISOString();
    manifest.error = serializeError(error);
    writeManifest(manifestPath, manifest);
    throw new Error(`${error.message}\nManifest: ${manifestPath}`);
  }

  if (args.json) {
    console.log(JSON.stringify({ ...manifest, manifestPath }, null, 2));
    return;
  }

  console.log(`Release: ${plan.releaseId}`);
  console.log(`Environment: ${plan.environment}`);
  console.log(`AWS identity: ${plan.identity.arn}`);
  if (plan.testDbRefresh && !plan.testDbRefresh.skipped) {
    console.log(`TEST DB refresh: ${plan.testDbRefresh.snapshotSource.sourceEnv} -> test`);
  } else {
    console.log('TEST DB refresh: not requested');
  }
  if (plan.schema && !plan.schema.skipped) {
    console.log(`Schema pending: ${plan.schema.pendingCount || 0}`);
    (plan.schema.specialDispatches || []).forEach(dispatch => {
      console.log(`Schema bounded dispatch: ${dispatch.file} (${dispatch.action})`);
    });
  } else {
    console.log(`Schema pending: skipped (${plan.schema.reason})`);
  }
  printRestorePointSummary(plan.restorePoint);
  if (plan.data && !plan.data.skipped) {
    console.log(`Data dataset: ${plan.data.dataset.name}`);
  } else {
    console.log('Data dataset: none');
  }
  console.log(`App deploy: shared=${plan.app.deployShared} admin=${plan.app.deployAdmin} portal=${plan.app.deployPortal}`);
  if (manifest.adminConfig) {
    console.log(`Admin config SHA-256: ${manifest.adminConfig.sha256}`);
  }
  if (envConfig.name === 'prod' && (plan.app.deployShared || plan.app.deployAdmin || plan.app.deployPortal)) {
    const dirtySourceKeys = buildProdAppSourceRepoKeys(plan.app)
      .filter(key => manifest.repos[key] && manifest.repos[key].gitDirty);
    console.log(`Source tree: ${dirtySourceKeys.length ? `dirty (${dirtySourceKeys.join(', ')})` : 'clean'}`);
  }
  console.log(`Smoke targets: ${plan.smoke.targets.length}`);
  console.log(`Manifest: ${manifestPath}`);
}

async function handleRun(args, envConfig, identity) {
  if (envConfig.name === 'prod' && !args.yes) {
    throw new Error('Prod run requires --yes');
  }
  if (envConfig.name === 'test' && args.refreshTestDb && !args.yes) {
    throw new Error('TEST run with --refresh-test-db requires --yes because it resets the TEST database');
  }
  validateQualificationModeArgs(args);

  const repos = buildRepoState();
  const appPlan = buildAppPlan(args, envConfig);
  assertTestRuntimeSmokeRequired(args, envConfig, appPlan);
  const sourceControl = assertDeploySourceState(args, envConfig, appPlan, repos);
  const adminConfigState = needsAdminDeployConfig(appPlan)
    ? captureAdminDeployConfig(args, envConfig, { snapshot: true })
    : null;
  args.adminDeployConfigState = adminConfigState;
  let plan = buildPlanIntent(args, envConfig, identity);
  const manifestPath = getManifestPath(envConfig.name, plan.releaseId);
  const manifest = {
    generatedAt: new Date().toISOString(),
    status: 'running',
    ...plan,
    repos,
    sourceControl,
    adminConfig: adminDeployConfigEvidence(adminConfigState),
    steps: [],
  };
  writeManifest(manifestPath, manifest);
  let appResult = null;
  let smokeResult = null;

  try {
    manifest.qualification = await runStep(
      manifest,
      manifestPath,
      'release.qualification',
      async () => {
        if (args.skipQualification) {
          process.stderr.write('[path-deploy] WARNING: --skip-qualification active — qualification evidence gate bypassed. This deployment is UNQUALIFIED.\n');
          return {
            decision: 'UNQUALIFIED',
            skipQualification: true,
            candidate: { source: qualificationSourceFromRepoState(manifest.repos) },
          };
        }
        return admitReleaseQualification(args, envConfig, plan, manifest.repos);
      }
    );

    if (plan.app.deployShared || plan.app.deployAdmin || plan.app.deployPortal) {
      manifest.preflight = await runStep(
        manifest,
        manifestPath,
        'release.preflight',
        async () => runReleasePreflight(args, envConfig, plan.app, plan.releaseId, manifest.repos)
      );
    }

    plan = await runStep(
      manifest,
      manifestPath,
      'plan.resolve',
      async () => resolvePlan(args, envConfig, plan)
    );
    Object.assign(manifest, plan);
    writeManifest(manifestPath, manifest);

    if (plan.restorePoint && !plan.restorePoint.skipped) {
      const restorePointResult = await runStep(
        manifest,
        manifestPath,
        'db.restore-point',
        async () => captureProdRestorePoint(plan.restorePoint, envConfig)
      );
      manifest.restorePointCapture = restorePointResult;
    }

    if (plan.testDbRefresh && !plan.testDbRefresh.skipped) {
      const testDbRefreshResult = await runStep(
        manifest,
        manifestPath,
        'test-db.refresh',
        async () => runTestDbRefresh(args, envConfig)
      );
      manifest.testDbRefreshResult = testDbRefreshResult;
    }

    if (plan.schema && !plan.schema.skipped) {
      const schemaResult = await runStep(manifest, manifestPath, 'schema.apply', async () => applySchema(args, envConfig));
      manifest.schemaApply = schemaResult;
    }

    if (!args.skipData && args.dataset) {
      const dataResult = await runStep(manifest, manifestPath, 'data.apply', async () => applyData(args, envConfig));
      manifest.dataApply = dataResult;
    }

    if (plan.app.deployShared || plan.app.deployAdmin || plan.app.deployPortal || plan.app.refreshProd) {
      manifest.sourceRecheck = assertReleaseSourceSnapshotUnchanged(
        manifest.repos,
        plan.app,
        'before application staging'
      );
      manifest.adminConfigRecheck = assertAdminDeployConfigSourceUnchanged(adminConfigState);
      writeManifest(manifestPath, manifest);
      const releaseContext = {
        repos: manifest.preflight?.source || manifest.repos,
        initialRepos: manifest.repos,
        adminConfig: adminDeployConfigEvidence(adminConfigState),
        adminConfigState,
        preflight: manifest.preflight,
        qualification: manifest.qualification,
      };
      if (envConfig.name === 'test') {
        appResult = {
          ...plan.app,
          runner: 'wsl-native-atomic-stage',
          artifacts: {},
        };
        if (plan.app.deployPortal) {
          appResult.artifacts.portal = await runStep(
            manifest,
            manifestPath,
            'app.stage.portal',
            async () => stagePortalForTestNative(args, envConfig, plan.releaseId, releaseContext)
          );
          manifest.appStaging = appResult;
          writeManifest(manifestPath, manifest);
        }
        if (plan.app.deployAdmin) {
          appResult.artifacts.admin = await runStep(
            manifest,
            manifestPath,
            'app.stage.admin',
            async () => stageAdminForTestNative(args, envConfig, plan.releaseId, releaseContext)
          );
        }
        manifest.appStaging = appResult;
        writeManifest(manifestPath, manifest);
        const recoveryContext = await runStep(
          manifest,
          manifestPath,
          'app.recovery-plan',
          async () => buildTestAtomicContext({
            releaseId: plan.releaseId,
            appResult,
            releaseContext,
            envConfig,
          })
        );
        args.testRecoveryContext = recoveryContext;
        manifest.testRecovery = { ...recoveryContext, state: 'planned' };
        writeManifest(manifestPath, manifest);
        manifest.testRecovery.prepare = await runStep(
          manifest,
          manifestPath,
          'app.prepare',
          async () => prepareTestAtomicRollout(recoveryContext, envConfig)
        );
        manifest.testRecovery.state = 'prepared';
        writeManifest(manifestPath, manifest);
        manifest.testRecovery.cutover = await runStep(
          manifest,
          manifestPath,
          'app.cutover',
          async () => cutoverTestAtomicRollout(recoveryContext, envConfig)
        );
        manifest.testRecovery.state = 'cutover-complete';
        writeManifest(manifestPath, manifest);
        manifest.testRecovery.postflight = await runStep(
          manifest,
          manifestPath,
          'app.postflight',
          async () => verifyTestAtomicRollout(recoveryContext, envConfig)
        );
        manifest.appApply = {
          ...appResult,
          instances: recoveryContext.instanceIds,
          atomicCutover: true,
        };
      } else {
        appResult = await runStep(manifest, manifestPath, 'app.deploy', async () => deployApplications(
          args,
          envConfig,
          plan.app,
          plan.releaseId,
          releaseContext
        ));
        manifest.appApply = appResult;
      }
    }

    if (!args.skipSmoke && plan.smoke.targets.length) {
      smokeResult = await runStep(
        manifest,
        manifestPath,
        'smoke.check',
        async () => runSmokeChecksForEnvironment(envConfig, plan.smoke.targets)
      );
      manifest.smokeResults = smokeResult;
    }

    if (envConfig.name === 'test' && Object.keys(appResult?.artifacts || {}).length) {
      manifest.testAliasPromotion = await runStep(
        manifest,
        manifestPath,
        'app.alias-promote',
        async () => promoteTestArtifactsAfterSmoke(appResult, smokeResult, envConfig)
      );
      manifest.testRecovery.acceptance = await runStep(
        manifest,
        manifestPath,
        'app.accept',
        async () => acceptTestAtomicRollout(args.testRecoveryContext, envConfig)
      );
      manifest.testRecovery.state = 'accepted';
      writeManifest(manifestPath, manifest);
      manifest.testRecovery.retentionCleanup = await runStep(
        manifest,
        manifestPath,
        'app.retention-cleanup',
        async () => cleanupAcceptedTestAtomicRollout(args.testRecoveryContext, envConfig)
      );
      writeManifest(manifestPath, manifest);
    }

    manifest.status = 'successful';
    manifest.finishedAt = new Date().toISOString();
    writeManifest(manifestPath, manifest);

    if (args.json) {
      console.log(JSON.stringify({ ...manifest, manifestPath }, null, 2));
      return;
    }

    console.log(`Release: ${plan.releaseId}`);
    console.log(`Environment: ${plan.environment}`);
    console.log(`Status: successful`);
    console.log(`Manifest: ${manifestPath}`);
    return;
  } catch (error) {
    let recoveryError = null;
    if (
      envConfig.name === 'test' &&
      args.testRecoveryContext &&
      manifest.testRecovery?.state !== 'accepted' &&
      manifest.testRecovery?.state !== 'recovered'
    ) {
      try {
        manifest.testRecovery.recovery = await runStep(
          manifest,
          manifestPath,
          'app.recover',
          async () => recoverTestAtomicRollout(args.testRecoveryContext, envConfig, plan.smoke.targets)
        );
        manifest.testRecovery.state = 'recovered';
      } catch (candidateRecoveryError) {
        recoveryError = candidateRecoveryError;
        manifest.testRecovery.state = 'recovery_required';
        manifest.testRecovery.recoveryError = serializeError(candidateRecoveryError);
      }
    }
    manifest.status = recoveryError ? 'recovery_required' : (manifest.testRecovery?.state === 'recovered' ? 'failed_recovered' : 'failed');
    manifest.finishedAt = new Date().toISOString();
    manifest.error = serializeError(error);
    writeManifest(manifestPath, manifest);
    const recoveryMessage = recoveryError
      ? `\nAutomatic TEST recovery failed: ${recoveryError.message}`
      : (manifest.testRecovery?.state === 'recovered' ? '\nThe prior TEST runtime was automatically restored and re-smoked.' : '');
    throw new Error(`${error.message}${recoveryMessage}\nManifest: ${manifestPath}`);
  } finally {
    cleanupPreparedBuilds(args);
  }
}

async function handleSmoke(args, envConfig) {
  const targets = buildSmokeTargets(envConfig, args);
  if (!targets.length) {
    throw new Error('No smoke targets selected');
  }
  const results = await runSmokeChecksForEnvironment(envConfig, targets);
  if (args.json) {
    console.log(JSON.stringify({ environment: envConfig.name, results }, null, 2));
    return;
  }
  results.forEach(result => {
    if (result.targetGroupName) {
      const targetSummary = (result.targets || [])
        .map(target => `${target.id}:${target.port}=${target.state}`)
        .join(', ');
      console.log(`${result.service} target-group ${result.targetGroupName}: ${targetSummary || 'healthy'}`);
      return;
    }
    console.log(`${result.statusCode} ${result.url}`);
  });
}

async function handleTestRecovery(args, envConfig, identity) {
  if (envConfig.name !== 'test') throw new Error('recover-test is available only for TEST.');
  if (!args.yes) throw new Error('recover-test requires --yes.');
  const releaseId = assertSafeReleaseId(args.releaseId);
  const context = {
    releaseId,
    environment: 'test',
    region: envConfig.region,
    instanceIds: discoverAsgInstances('nwac-test-asg', envConfig),
  };
  const manifestPath = getManifestPath('test', `${releaseId}-recovery`);
  const manifest = {
    generatedAt: new Date().toISOString(),
    status: 'recovering',
    command: 'recover-test',
    releaseId,
    environment: 'test',
    identity: { account: identity.Account, arn: identity.Arn, userId: identity.UserId },
    context,
    steps: [],
  };
  writeManifest(manifestPath, manifest);
  try {
    manifest.recovery = await runStep(
      manifest,
      manifestPath,
      'app.recover',
      async () => recoverTestAtomicRollout(context, envConfig, buildSmokeTargets(envConfig, { skipSmoke: false, skipAdmin: false, skipPortal: false }))
    );
    manifest.status = 'recovered';
    manifest.finishedAt = new Date().toISOString();
    writeManifest(manifestPath, manifest);
  } catch (error) {
    manifest.status = 'recovery_required';
    manifest.finishedAt = new Date().toISOString();
    manifest.error = serializeError(error);
    writeManifest(manifestPath, manifest);
    throw new Error(`${error.message}\nManifest: ${manifestPath}`);
  }
  console.log(`TEST release ${releaseId}: prior runtime restored and re-smoked.`);
  console.log(`Manifest: ${manifestPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'help') {
    usage();
    return;
  }

  if (!args.env) {
    throw new Error('--env is required');
  }

  if (args.compatibilityOnly && args.env !== 'prod') {
    throw new Error('--compatibility-only is a PROD recovery option');
  }

  validateQualificationModeArgs(args);

  const envConfig = getEnvironmentConfig(args);
  const identity = getAwsIdentity(envConfig);
  assertAwsIdentity(identity, envConfig);

  if (args.command === 'plan') {
    await handlePlan(args, envConfig, identity);
    return;
  }

  if (args.command === 'smoke') {
    await handleSmoke(args, envConfig);
    return;
  }

  if (args.command === 'recover-test') {
    await handleTestRecovery(args, envConfig, identity);
    return;
  }

  if (args.command !== 'run') {
    throw new Error(`Unknown command: ${args.command}`);
  }

  await handleRun(args, envConfig, identity);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`[path-deploy] ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  ADMIN_SUPPORT_SCRIPT_FILES,
  RETIRED_RELEASE_ARTIFACT_PATHS,
  PORTAL_REQUIRED_ARTIFACT_FILES,
  PORTAL_TEST_REQUIRED_ARTIFACT_FILES,
  ADMIN_ENVIRONMENT_CONTRACTS,
  ADMIN_REQUIRED_RUNTIME_DIRECTORIES,
  PORTAL_REQUIRED_RUNTIME_DIRECTORIES,
  PORTAL_OPTIONAL_MANAGED_DIRECTORIES,
  adminDeployConfigEvidence,
  assertAdminDeployConfigSourceUnchanged,
  assertArchiveEntrySha256,
  assertDeploySourceState,
  assertReleaseSourceSnapshotUnchanged,
  assertArchiveContains,
  assertArchiveExcludesPrefixes,
  assertArchiveScriptAllowlist,
  assertStagedArtifactUnchanged,
  assertSafeReleaseId,
  buildReleaseId,
  buildVerifiedS3ArtifactCopyArgs,
  buildPlanIntent,
  buildRemoteServiceHealthCommands,
  buildTestAtomicContext,
  buildTestAtomicPrepareCommands,
  buildTestAtomicCutoverCommands,
  buildTestExactPostflightCommands,
  buildTestRecoveryCommands,
  buildTestRetentionCleanupCommands,
  copyAdminRuntimeSql,
  copyAdmittedGitSourceDirectory,
  copyValidatedFrontendBuild,
  captureAdminDeployConfig,
  buildAdminTestRemoteCommands,
  buildGitRepoState,
  buildPortalTestRemoteCommands,
  createIsolatedFrontendBuildProject,
  createZipFromDirectory,
  getEnvironmentConfig,
  listAdminRuntimeMigrationArtifactPaths,
  listArtifactFilePaths,
  parseArgs,
  promoteTestArtifactsAfterSmoke,
  runJsonNodeScript,
  assertTestRuntimeSmokeRequired,
  validateQualificationModeArgs,
};
