#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');
const archiver = require('archiver');
const { assertMigrationApplySucceeded } = require('../src/lib/sharedSchemaMigrationRunner');
const {
  buildImmutableArtifactRecord,
  buildPreflightPlan,
  createReleaseDescriptor,
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
  'payments-workflow-smoke.js',
  'privacy-route-denial-smoke.js',
];
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
    'Usage: node scripts/path-deploy.js [plan|run|smoke] --env <test|prod> [options]',
    '',
    'Examples:',
    '  node scripts/path-deploy.js plan --env test --skip-data',
    '  node scripts/path-deploy.js --env test --skip-data --release-id <release-id> --qualification-evidence <DEV-GO.json>',
    '  node scripts/path-deploy.js --env test --refresh-test-db --skip-data --release-id <release-id> --qualification-evidence <DEV-GO.json> --yes',
    '  node scripts/path-deploy.js run --env prod --skip-data --release-id <release-id> --qualification-evidence <TEST-GO.json> --yes',
    '  node scripts/path-deploy.js run --env prod --dataset intake-release --workflow-id 21 --release-id <release-id> --qualification-evidence <TEST-GO.json> --yes  # explicit runtime/config promotion only',
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
    '  --refresh-test-db      Rebuild TEST DB from the source env before data/app deploy steps',
    '  --skip-schema          Do not apply canonical schema migrations',
    '  --skip-data            Do not apply allowlisted data promotion',
    '  --skip-admin           Do not deploy the admin app',
    '  --skip-portal          Do not deploy the portal app',
    '  --skip-shared          Do not upload shared for prod',
    '  --skip-build           Pass through to the app deploy scripts',
    '  --skip-smoke           Skip post-deploy health checks',
    '  --compatibility-only   PROD recovery: update live *-latest.zip artifacts without immutable release objects',
    '  --allow-dirty          Permit a dirty PROD app source tree when paired with --dirty-reason',
    '  --dirty-reason TEXT    Required explanation when overriding the PROD dirty-source guard',
    '  --qualification-evidence PATH  Required GO evidence: DEV for TEST, TEST for PROD',
    '  --yes                  Required for prod run',
    '  --json                 Emit machine-readable JSON',
    '  --help                 Show this help',
    '',
    'Notes:',
    '  - If no command is provided, `run` is assumed.',
    '  - Test app deploys use WSL-native in-place SSM rollout steps from this orchestrator.',
    '  - Prod app deploys upload artifacts, then run a waited ASG instance refresh.',
    '  - TEST runs with --refresh-test-db are destructive and therefore also require --yes.',
    '  - Prod runs that change schema or allowlisted data capture an RDS cluster snapshot restore point before mutation.',
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
    } else if (token === '--compatibility-only') {
      args.compatibilityOnly = true;
    } else if (token === '--allow-dirty') {
      args.allowDirty = true;
    } else if (token === '--dirty-reason') {
      args.dirtyReason = argv[++index];
    } else if (token === '--qualification-evidence') {
      args.qualificationEvidence = path.resolve(argv[++index] || '');
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
    if (possibleCommand === 'plan' || possibleCommand === 'run' || possibleCommand === 'smoke') {
      args.command = possibleCommand;
      positional.shift();
    }
  }

  if (!args.command) {
    args.command = 'run';
  }

  return args;
}

function getEnvironmentConfig(args) {
  const base = ENVIRONMENTS[args.env];
  if (!base) {
    throw new Error(`Unsupported environment: ${args.env || '<missing>'}`);
  }
  return {
    ...base,
    profile: args.profile || base.profile,
    region: args.region || base.region,
  };
}

function buildReleaseId(args) {
  if (args.releaseId) {
    return args.releaseId;
  }
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
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
  const result = runCommand(process.execPath, [scriptPath, ...scriptArgs, '--json'], {
    cwd,
    capture: true,
  });
  return JSON.parse(result.stdout || '{}');
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

function buildGitRepoState(repoPath) {
  const statusLines = getGitStatusLines(repoPath);
  return {
    path: repoPath,
    gitHead: getGitHead(repoPath),
    treeFingerprint: getGitWorkingTreeFingerprint(repoPath),
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
      'If app rollout fails in TEST, fix forward or redeploy the prior build. TEST data is disposable.',
      'If a schema migration fails in TEST, restore/reset TEST and re-run canonical migrations rather than patching by hand.',
    ];
  }

  return [
    'Default prod rollback is application rollback: re-upload the previous known-good artifacts and run a new prod instance refresh.',
    'Do not restore a prod DB snapshot after reopening traffic unless there is an explicit maintenance window and approval for potential data loss.',
    'If prod schema migration fails before app rollout, stop there, correct the migration, and re-run schema apply before refreshing instances.',
  ];
}

function buildPlan(args, envConfig, identity) {
  const testDbRefresh = buildTestDbRefreshPlan(args, envConfig);
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
    testDbRefresh,
    schema: buildSchemaPlan(args, envConfig, testDbRefresh),
    data: buildDataPlan(args, envConfig),
    app: buildAppPlan(args, envConfig),
    smoke: {
      targets: buildSmokeTargets(envConfig, args),
    },
    rollbackGuidance: buildRollbackGuidance(envConfig),
  };
  plan.restorePoint = buildRestorePointPlan(plan, envConfig);
  return plan;
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

function prepareAdminFrontendBuild(args, envConfig, releaseId) {
  const buildPath = path.join(REPO_ROOT, 'build');
  const expectedBuildTarget = envConfig.name === 'prod' ? 'production' : 'test';
  if (!args.skipBuild && !args.preflightBuilds) {
    removePath(buildPath);
    runCommand('npm', ['run', envConfig.name === 'test' ? 'build:test' : 'build:production'], {
      cwd: REPO_ROOT,
      env: { ...process.env, PATH_DEPLOY_ENV: envConfig.name, PATH_RELEASE_ID: releaseId || '' },
    });
    writeBuildManifest({ repoRoot: REPO_ROOT, buildPath });
  }
  if (!fs.existsSync(buildPath)) {
    throw new Error(`Build output not found at '${buildPath}'. Remove --skip-build or run the build step first.`);
  }
  validatePrebuiltBuild({
    repoRoot: REPO_ROOT,
    buildPath,
    expected: {
      buildTarget: expectedBuildTarget,
      releaseId,
      gitCommit: getGitHead(REPO_ROOT),
      allowDirty: envConfig.name === 'test' && !args.skipBuild,
    },
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
  const expectedBuildTarget = envConfig.name === 'prod' ? 'production' : 'test';
  if (shouldBuildIsolatedTestOutput) {
    args.portalBuildPath = buildPath;
    args.portalBuildCleanupRoot = path.dirname(buildPath);
  }
  if (!args.skipBuild && !args.preflightBuilds) {
    removePath(buildPath);
    if (envConfig.name === 'test') {
      runCommand(process.execPath, [path.join(PORTAL_ROOT, 'scripts', 'write-build-info.js'), '--build-target', 'test'], {
        cwd: PORTAL_ROOT,
        env: { ...process.env, PATH_DEPLOY_ENV: 'test', PATH_RELEASE_ID: releaseId || '' },
      });
      runCommand('npx', ['env-cmd', '-f', '.env.test', 'craco', 'build'], {
        cwd: PORTAL_ROOT,
        env: { ...process.env, BUILD_PATH: buildPath, PATH_DEPLOY_ENV: 'test', PATH_RELEASE_ID: releaseId || '' },
      });
    } else {
      runCommand('npm', ['run', 'build:production'], {
        cwd: PORTAL_ROOT,
        env: { ...process.env, PATH_DEPLOY_ENV: 'prod', PATH_RELEASE_ID: releaseId || '' },
      });
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
    expected: {
      buildTarget: expectedBuildTarget,
      releaseId,
      gitCommit: getGitHead(PORTAL_ROOT),
      allowDirty: envConfig.name === 'test' && !args.skipBuild,
    },
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

function copyAdminSupportScripts(stagingPath) {
  const scriptsPath = path.join(stagingPath, 'scripts');
  let copied = false;
  ADMIN_SUPPORT_SCRIPT_FILES.forEach(file => {
    copied = copyFileIfExists(path.join(REPO_ROOT, 'scripts', file), path.join(scriptsPath, file)) || copied;
  });
  return copied;
}

function writeStagingReleaseProvenance(stagingPath, { releaseId, environment, component, qualification }) {
  const provenance = {
    schemaVersion: 1,
    releaseId,
    environment,
    component,
    qualificationEvidenceId: qualification?.evidenceId || null,
    source: qualification?.candidate?.source || {},
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

function sanitizeSsmOutput(value) {
  if (!value) {
    return value;
  }
  return String(value).replace(/[^\u0009\u000A\u000D\u0020-\u007E]/gu, '?');
}

function uploadArtifactToS3(archivePath, bucket, key, envConfig) {
  runAwsNoOutput(['s3', 'cp', archivePath, `s3://${bucket}/${key}`], envConfig);
}

function findLatestS3Artifact(bucket, prefix, envConfig) {
  const response = runAwsJson([
    's3api',
    'list-objects-v2',
    '--bucket', bucket,
    '--prefix', prefix.endsWith('/') ? prefix : `${prefix}/`,
  ], envConfig);
  const latest = (response.Contents || [])
    .filter(item => item.Key && Number(item.Size) > 0)
    .sort((left, right) => Date.parse(right.LastModified || 0) - Date.parse(left.LastModified || 0))[0];
  return latest ? {
    uri: `s3://${bucket}/${latest.Key}`,
    key: latest.Key,
    bytes: Number(latest.Size),
    lastModified: latest.LastModified,
  } : null;
}

function uploadProdArtifactPair({
  archivePath,
  component,
  releaseId,
  compatibilityKey,
  envConfig,
  compatibilityOnly = false,
}) {
  const immutable = buildImmutableArtifactRecord({ component, releaseId, archivePath });
  if (compatibilityOnly) {
    console.warn(
      `Compatibility-only recovery: not staging immutable ${component} artifact at ` +
      `s3://${PROD_ARTIFACT_BUCKET}/${immutable.key}.`
    );
  } else {
    console.log(`Staging immutable ${component} artifact at s3://${PROD_ARTIFACT_BUCKET}/${immutable.key}...`);
    uploadArtifactToS3(archivePath, PROD_ARTIFACT_BUCKET, immutable.key, envConfig);
  }
  console.log(`Updating compatibility artifact at s3://${PROD_ARTIFACT_BUCKET}/${compatibilityKey}...`);
  uploadArtifactToS3(archivePath, PROD_ARTIFACT_BUCKET, compatibilityKey, envConfig);
  return {
    artifact: `s3://${PROD_ARTIFACT_BUCKET}/${compatibilityKey}`,
    immutableArtifact: compatibilityOnly ? null : `s3://${PROD_ARTIFACT_BUCKET}/${immutable.key}`,
    immutableKey: compatibilityOnly ? null : immutable.key,
    plannedImmutableKey: immutable.key,
    compatibilityOnly,
    sha256: immutable.sha256,
    archiveBytes: immutable.bytes,
  };
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

function buildAdminTestRemoteCommands(bucket, s3Key, region, stagedDirectories) {
  const commands = [
    'set -euo pipefail',
    'STAMP=$(date +%s)',
    'TMPDIR="/tmp/admin-deploy-$STAMP"',
    'mkdir -p "$TMPDIR"',
    `aws s3 cp s3://${bucket}/${s3Key} /tmp/admin.zip --region ${region}`,
    'if ! unzip -qo /tmp/admin.zip -d "$TMPDIR"; then code=$?; if [ "$code" -ne 1 ]; then exit "$code"; fi; fi',
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
    `SECRET_REGION=${region}`,
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

  if (stagedDirectories.includes('src')) {
    commands.push('rm -rf /opt/nwac/admin-dashboard/src');
    commands.push('cp -r "$TMPDIR/src" /opt/nwac/admin-dashboard/');
  }
  if (stagedDirectories.includes('shared')) {
    commands.push('rm -rf /opt/nwac/admin-dashboard/shared');
    commands.push('cp -r "$TMPDIR/shared" /opt/nwac/admin-dashboard/');
    commands.push('rm -rf /opt/nwac/shared');
    commands.push('mkdir -p /opt/nwac');
    commands.push('cp -r "$TMPDIR/shared" /opt/nwac/');
  }
  if (stagedDirectories.includes('templates')) {
    commands.push('rm -rf /opt/nwac/admin-dashboard/templates');
    commands.push('cp -r "$TMPDIR/templates" /opt/nwac/admin-dashboard/');
  }
  if (stagedDirectories.includes('blocksteps')) {
    commands.push('rm -rf /opt/nwac/admin-dashboard/blocksteps');
    commands.push('cp -r "$TMPDIR/blocksteps" /opt/nwac/admin-dashboard/');
  }
  if (stagedDirectories.includes('public')) {
    commands.push('rm -rf /opt/nwac/admin-dashboard/public');
    commands.push('cp -r "$TMPDIR/public" /opt/nwac/admin-dashboard/');
  }
  if (stagedDirectories.includes('scripts')) {
    commands.push('rm -rf /opt/nwac/admin-dashboard/scripts');
    commands.push('cp -r "$TMPDIR/scripts" /opt/nwac/admin-dashboard/');
  }

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
    '"$PM2_BIN" save >/dev/null || true',
    'sleep 10',
    '"$PM2_BIN" describe nwac-admin || true',
    'LOG_DIR="/root/.pm2/logs"',
    'echo "--- nwac-admin stderr (tail) ---"',
    'tail -n 200 "$LOG_DIR/nwac-admin-error.log" || true',
    'echo "--- nwac-admin stdout (tail) ---"',
    'tail -n 200 "$LOG_DIR/nwac-admin-out.log" || true',
    'rm -rf "$TMPDIR" /tmp/admin.zip'
  );

  return commands;
}

function buildPortalTestRemoteCommands(bucket, s3Key, region) {
  return [
    'set -euo pipefail',
    'STAMP=$(date +%s)',
    'TMPDIR="/tmp/portal-deploy-$STAMP"',
    'mkdir -p "$TMPDIR"',
    `aws s3 cp s3://${bucket}/${s3Key} /tmp/portal.zip --region ${region}`,
    'if ! unzip -oq /tmp/portal.zip -d "$TMPDIR"; then code=$?; if [ "$code" -ne 1 ]; then exit "$code"; fi; fi',
    'mkdir -p /opt/nwac',
    'mkdir -p /opt/nwac/portal',
    'if [ -d "$TMPDIR/shared" ]; then rm -rf /opt/nwac/shared && cp -r "$TMPDIR/shared" /opt/nwac/; fi',
    'rm -rf /opt/nwac/portal/build',
    'if [ -d "$TMPDIR/build" ]; then cp -r "$TMPDIR/build" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/db" ]; then cp -r "$TMPDIR/db" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/notifications" ]; then cp -r "$TMPDIR/notifications" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/pdf" ]; then cp -r "$TMPDIR/pdf" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/public" ]; then cp -r "$TMPDIR/public" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/src" ]; then cp -r "$TMPDIR/src" /opt/nwac/portal/; fi',
    'if [ -d "$TMPDIR/auth" ]; then rm -rf /opt/nwac/portal/auth && cp -r "$TMPDIR/auth" /opt/nwac/portal/; fi',
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
    `SECRET_REGION=${region}`,
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
    'if pm2 describe nwac-portal >/dev/null 2>&1; then pm2 restart nwac-portal --update-env; else pm2 start /opt/nwac/portal/server.js --name nwac-portal --update-env; fi',
    'pm2 save >/dev/null || true',
    'rm -rf "$TMPDIR" /tmp/portal.zip',
  ];
}

async function deployAdminToTestNative(args, envConfig, releaseId, releaseContext = {}) {
  const bucket = 'nwac-test-artifacts';
  const keyPrefix = 'admin-dashboard';
  const autoScalingGroup = 'nwac-test-asg';
  const timestamp = formatDeployTimestamp();
  const rollbackArtifact = findLatestS3Artifact(bucket, keyPrefix, envConfig);
  let tempRoot = null;

  const buildPath = prepareAdminFrontendBuild(args, envConfig, releaseId);

  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-deploy-'));
    const stagingPath = path.join(tempRoot, 'staging');
    fs.mkdirSync(stagingPath, { recursive: true });

    copyDirectoryIfExists(buildPath, path.join(stagingPath, 'build'));
    [
      'isetadminserver.js',
      'package.json',
      'package-lock.json',
      '.env.test',
    ].forEach(file => {
      const copied = copyFileIfExists(path.join(REPO_ROOT, file), path.join(stagingPath, file));
      if (!copied) {
        throw new Error(`Required admin deploy file not found: ${file}`);
      }
    });

    const stagedDirectories = [];
    ['src', 'shared', 'templates', 'blocksteps', 'public', 'sql'].forEach(dir => {
      if (copyDirectoryIfExists(path.join(REPO_ROOT, dir), path.join(stagingPath, dir))) {
        stagedDirectories.push(dir);
      }
    });
    if (copyAdminSupportScripts(stagingPath)) {
      stagedDirectories.push('scripts');
    }
    if (copyDirectoryIfExists(SHARED_ROOT, path.join(stagingPath, 'shared')) && !stagedDirectories.includes('shared')) {
      stagedDirectories.push('shared');
    }
    writeStagingReleaseProvenance(stagingPath, {
      releaseId,
      environment: envConfig.name,
      component: 'admin',
      qualification: releaseContext.qualification,
    });

    const archiveName = `admin-dashboard-${timestamp}.zip`;
    const archivePath = path.join(tempRoot, archiveName);
    const archive = await createZipFromDirectory(stagingPath, archivePath);
    const s3Key = joinS3Key(keyPrefix, archiveName);
    console.log(`Uploading admin artifact to s3://${bucket}/${s3Key}...`);
    uploadArtifactToS3(archivePath, bucket, s3Key, envConfig);

    const instanceIds = discoverAsgInstances(autoScalingGroup, envConfig);
    console.log(`Admin TEST instances: ${instanceIds.join(', ')}`);
    const commands = buildAdminTestRemoteCommands(bucket, s3Key, envConfig.region, stagedDirectories);
    const commandResults = [];
    for (const instanceId of instanceIds) {
      console.log(`Deploying admin to ${instanceId}...`);
      const commandId = sendSsmCommand(instanceId, commands, envConfig);
      const result = waitSsmCommand(commandId, instanceId, envConfig);
      commandResults.push({
        instanceId,
        commandId,
        status: result.Status,
        statusDetails: result.StatusDetails,
      });
    }

    return {
      artifact: `s3://${bucket}/${s3Key}`,
      rollbackArtifact,
      archiveBytes: archive.bytes,
      instances: commandResults,
    };
  } finally {
    if (tempRoot) {
      removePath(tempRoot);
    }
  }
}

async function deployPortalToTestNative(args, envConfig, releaseId, releaseContext = {}) {
  const bucket = 'nwac-test-artifacts';
  const keyPrefix = 'portal';
  const autoScalingGroup = 'nwac-test-asg';
  const timestamp = formatDeployTimestamp();
  const rollbackArtifact = findLatestS3Artifact(bucket, keyPrefix, envConfig);
  let tempRoot = null;
  const buildPath = preparePortalFrontendBuild(args, envConfig, releaseId);

  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-deploy-'));
    const stagingPath = path.join(tempRoot, 'staging');
    fs.mkdirSync(stagingPath, { recursive: true });

    copyDirectoryIfExists(buildPath, path.join(stagingPath, 'build'));
    [
      ['db', 'db'],
      ['notifications', 'notifications'],
      ['src', 'src'],
      ['pdf', 'pdf'],
      ['public', 'public'],
      ['auth', 'auth'],
    ].forEach(([source, destination]) => {
      copyDirectoryIfExists(path.join(PORTAL_ROOT, source), path.join(stagingPath, destination));
    });
    copyDirectoryIfExists(SHARED_ROOT, path.join(stagingPath, 'shared'));

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
      copyFileIfExists(path.join(PORTAL_ROOT, file), path.join(stagingPath, file));
    });
    copyFileIfExists(path.join(stagingPath, '.env.test'), path.join(stagingPath, '.env'));
    writeStagingReleaseProvenance(stagingPath, {
      releaseId,
      environment: envConfig.name,
      component: 'portal',
      qualification: releaseContext.qualification,
    });

    const archiveName = `portal-${timestamp}.zip`;
    const archivePath = path.join(tempRoot, archiveName);
    const archive = await createZipFromDirectory(stagingPath, archivePath);
    const s3Key = joinS3Key(keyPrefix, archiveName);
    console.log(`Uploading portal artifact to s3://${bucket}/${s3Key}...`);
    uploadArtifactToS3(archivePath, bucket, s3Key, envConfig);

    const instanceIds = discoverAsgInstances(autoScalingGroup, envConfig);
    console.log(`Portal TEST instances: ${instanceIds.join(', ')}`);
    const commands = buildPortalTestRemoteCommands(bucket, s3Key, envConfig.region);
    const commandResults = [];
    for (const instanceId of instanceIds) {
      console.log(`Deploying portal to ${instanceId}...`);
      const commandId = sendSsmCommand(instanceId, commands, envConfig);
      const result = waitSsmCommand(commandId, instanceId, envConfig);
      commandResults.push({
        instanceId,
        commandId,
        status: result.Status,
        statusDetails: result.StatusDetails,
      });
    }

    return {
      artifact: `s3://${bucket}/${s3Key}`,
      rollbackArtifact,
      archiveBytes: archive.bytes,
      instances: commandResults,
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

  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-prod-deploy-'));
    const stagingPath = path.join(tempRoot, 'staging');
    fs.mkdirSync(stagingPath, { recursive: true });
    copyDirectoryIfExists(SHARED_ROOT, path.join(stagingPath, 'shared'));
    writeStagingReleaseProvenance(stagingPath, {
      releaseId,
      environment: envConfig.name,
      component: 'shared',
      qualification: releaseContext.qualification,
    });

    const archivePath = path.join(tempRoot, archiveName);
    await createZipFromDirectory(stagingPath, archivePath);
    const s3Key = joinS3Key(keyPrefix, archiveName);
    return uploadProdArtifactPair({
      archivePath,
      component: 'shared',
      releaseId,
      compatibilityKey: s3Key,
      envConfig,
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

  const buildPath = prepareAdminFrontendBuild(args, envConfig, releaseId);

  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-prod-deploy-'));
    const stagingPath = path.join(tempRoot, 'staging');
    fs.mkdirSync(stagingPath, { recursive: true });

    copyDirectoryIfExists(buildPath, path.join(stagingPath, 'build'));
    [
      'isetadminserver.js',
      'package.json',
      'package-lock.json',
    ].forEach(file => {
      const copied = copyFileIfExists(path.join(REPO_ROOT, file), path.join(stagingPath, file));
      if (!copied) {
        throw new Error(`Required admin deploy file not found: ${file}`);
      }
    });
    copyFileIfExists(path.join(REPO_ROOT, '.env.production'), path.join(stagingPath, '.env.production'));

    ['src', 'shared', 'templates', 'blocksteps', 'public', 'sql'].forEach(dir => {
      copyDirectoryIfExists(path.join(REPO_ROOT, dir), path.join(stagingPath, dir));
    });
    copyAdminSupportScripts(stagingPath);
    copyDirectoryIfExists(SHARED_ROOT, path.join(stagingPath, 'shared'));
    writeStagingReleaseProvenance(stagingPath, {
      releaseId,
      environment: envConfig.name,
      component: 'admin',
      qualification: releaseContext.qualification,
    });

    const archivePath = path.join(tempRoot, archiveName);
    await createZipFromDirectory(stagingPath, archivePath);
    const s3Key = joinS3Key(keyPrefix, archiveName);
    return uploadProdArtifactPair({
      archivePath,
      component: 'admin',
      releaseId,
      compatibilityKey: s3Key,
      envConfig,
      compatibilityOnly: args.compatibilityOnly,
    });
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

  const buildPath = preparePortalFrontendBuild(args, envConfig, releaseId);

  try {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-prod-deploy-'));
    const stagingPath = path.join(tempRoot, 'staging');
    fs.mkdirSync(stagingPath, { recursive: true });

    [
      ['build', 'build'],
      ['db', 'db'],
      ['notifications', 'notifications'],
      ['src', 'src'],
      ['pdf', 'pdf'],
      ['public', 'public'],
      ['auth', 'auth'],
    ].forEach(([source, destination]) => {
      copyDirectoryIfExists(path.join(PORTAL_ROOT, source), path.join(stagingPath, destination));
    });
    copyDirectoryIfExists(SHARED_ROOT, path.join(stagingPath, 'shared'));

    [
      'server.js',
      'package.json',
      'package-lock.json',
    ].forEach(file => {
      const copied = copyFileIfExists(path.join(PORTAL_ROOT, file), path.join(stagingPath, file));
      if (!copied) {
        throw new Error(`Required portal deploy file not found: ${file}`);
      }
    });
    [
      '.env.production',
      'migrationRunner.js',
      'mimeSniff.js',
      'uploadPolicy.js',
      's3Provider.js',
      'sesMailer.js',
    ].forEach(file => {
      copyFileIfExists(path.join(PORTAL_ROOT, file), path.join(stagingPath, file));
    });
    writeStagingReleaseProvenance(stagingPath, {
      releaseId,
      environment: envConfig.name,
      component: 'portal',
      qualification: releaseContext.qualification,
    });

    const archivePath = path.join(tempRoot, archiveName);
    await createZipFromDirectory(stagingPath, archivePath);
    const s3Key = joinS3Key(keyPrefix, archiveName);
    return uploadProdArtifactPair({
      archivePath,
      component: 'portal',
      releaseId,
      compatibilityKey: s3Key,
      envConfig,
      compatibilityOnly: args.compatibilityOnly,
    });
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
  const result = {
    ...appPlan,
    runner: 'wsl-native-node-artifacts-asg-refresh',
    artifacts: {},
  };

  if (appPlan.deployShared) {
    result.artifacts.shared = await deploySharedToProdNative(args, envConfig, releaseId, releaseContext);
  }
  if (appPlan.deployAdmin) {
    result.artifacts.admin = await deployAdminToProdNative(args, envConfig, releaseId, releaseContext);
  }
  if (appPlan.deployPortal) {
    result.artifacts.portal = await deployPortalToProdNative(args, envConfig, releaseId, releaseContext);
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
    });
    result.releaseDescriptor = uploadProdReleaseDescriptor(descriptor, envConfig);
  } else {
    result.releaseDescriptor = {
      skipped: true,
      reason: 'partial-release-requires-current-descriptor-merge-before-activation',
    };
  }
  if (appPlan.refreshProd) {
    const refreshId = startProdInstanceRefresh(envConfig);
    result.refresh = waitProdInstanceRefresh(refreshId, envConfig);
  }

  return result;
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
      runner: 'wsl-native-node-ssm',
      artifacts: {},
    };
    if (appPlan.deployAdmin) {
      result.artifacts.admin = await deployAdminToTestNative(args, envConfig, releaseId, releaseContext);
    }
    if (appPlan.deployPortal) {
      result.artifacts.portal = await deployPortalToTestNative(args, envConfig, releaseId, releaseContext);
    }
    return result;
  }

  if (envConfig.name === 'prod') {
    return deployProdApplicationsNative(args, envConfig, appPlan, releaseId, releaseContext);
  }

  return appPlan;
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
    adminDashboard: buildGitRepoState(REPO_ROOT),
    portal: buildGitRepoState(PORTAL_ROOT),
    shared: buildGitRepoState(SHARED_ROOT),
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
  const keys = new Set();
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

function assertProdDeploySourceState(args, envConfig, appPlan, repoState) {
  if (envConfig.name !== 'prod') {
    return { skipped: true, reason: 'non-prod' };
  }
  if (!appPlan.deployAdmin && !appPlan.deployPortal && !appPlan.deployShared) {
    return { skipped: true, reason: 'no-prod-app-artifact' };
  }

  const sourceRepoKeys = buildProdAppSourceRepoKeys(appPlan);
  const dirtyRepos = sourceRepoKeys
    .map(key => ({ key, state: repoState[key] }))
    .filter(entry => entry.state && entry.state.gitDirty);

  if (!dirtyRepos.length) {
    return {
      skipped: false,
      clean: true,
      sourceRepoKeys,
    };
  }

  const reason = String(args.dirtyReason || '').trim();
  if (args.allowDirty && reason.length >= 12) {
    return {
      skipped: false,
      clean: false,
      override: true,
      overrideReason: reason,
      sourceRepoKeys,
      dirtyRepos: dirtyRepos.map(({ key, state }) => ({
        key,
        path: state.path,
        gitHead: state.gitHead,
        gitStatusCount: state.gitStatusCount,
        gitStatus: state.gitStatus,
      })),
    };
  }

  const details = dirtyRepos.map(({ key, state }) => {
    const statusLines = (state.gitStatus || []).slice(0, 40).map(line => `  ${line}`);
    const omitted = Number(state.gitStatusCount || 0) > statusLines.length
      ? [`  ... ${Number(state.gitStatusCount) - statusLines.length} more entries omitted`]
      : [];
    return [`${key} (${state.path})`, ...statusLines, ...omitted].join('\n');
  }).join('\n\n');
  const overrideHint = args.allowDirty
    ? 'The --allow-dirty override also requires --dirty-reason with a specific explanation.'
    : 'Commit, stash, or isolate the deploy source before retrying. Emergency override requires --allow-dirty --dirty-reason "<specific approved reason>".';
  throw new Error([
    'Refusing PROD app deploy from a dirty source tree.',
    'The app artifact packages the current WSL working tree, not only committed files.',
    overrideHint,
    details,
  ].filter(Boolean).join('\n'));
}

async function handlePlan(args, envConfig, identity) {
  const plan = buildPlan(args, envConfig, identity);
  const manifestPath = getManifestPath(envConfig.name, plan.releaseId);
  const manifest = {
    generatedAt: new Date().toISOString(),
    status: 'planned',
    ...plan,
    repos: buildRepoState(),
    steps: [],
  };
  writeManifest(manifestPath, manifest);

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

  const plan = buildPlan(args, envConfig, identity);
  const manifestPath = getManifestPath(envConfig.name, plan.releaseId);
  const manifest = {
    generatedAt: new Date().toISOString(),
    status: 'running',
    ...plan,
    repos: buildRepoState(),
    steps: [],
  };
  writeManifest(manifestPath, manifest);

  try {
    manifest.sourceControl = assertProdDeploySourceState(args, envConfig, plan.app, manifest.repos);
    writeManifest(manifestPath, manifest);

    manifest.qualification = await runStep(
      manifest,
      manifestPath,
      'release.qualification',
      async () => admitReleaseQualification(args, envConfig, plan, manifest.repos)
    );

    if (plan.app.deployShared || plan.app.deployAdmin || plan.app.deployPortal) {
      manifest.preflight = await runStep(
        manifest,
        manifestPath,
        'release.preflight',
        async () => runReleasePreflight(args, envConfig, plan.app, plan.releaseId, manifest.repos)
      );
    }

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
      const appResult = await runStep(manifest, manifestPath, 'app.deploy', async () => deployApplications(
        args,
        envConfig,
        plan.app,
        plan.releaseId,
        {
          repos: manifest.preflight?.source || manifest.repos,
          preflight: manifest.preflight,
          qualification: manifest.qualification,
        }
      ));
      manifest.appApply = appResult;
    }

    if (!args.skipSmoke && plan.smoke.targets.length) {
      const smokeResult = await runStep(
        manifest,
        manifestPath,
        'smoke.check',
        async () => runSmokeChecksForEnvironment(envConfig, plan.smoke.targets)
      );
      manifest.smokeResults = smokeResult;
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
    manifest.status = 'failed';
    manifest.finishedAt = new Date().toISOString();
    manifest.error = serializeError(error);
    writeManifest(manifestPath, manifest);
    throw new Error(`${error.message}\nManifest: ${manifestPath}`);
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

  if (args.command !== 'run') {
    throw new Error(`Unknown command: ${args.command}`);
  }

  await handleRun(args, envConfig, identity);
}

main().catch(error => {
  console.error(`[path-deploy] ${error.message}`);
  process.exit(1);
});
