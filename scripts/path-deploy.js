#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PORTAL_ROOT = path.resolve(REPO_ROOT, '..', 'ISET-intake');
const SHARED_ROOT = path.resolve(REPO_ROOT, '..', 'shared');

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
    adminSmokeUrl: 'https://nwac-console.awentech.ca/healthz',
    portalSmokeUrls: [
      'https://iset.nwac.ca/healthz',
      'https://nwac-public.awentech.ca/healthz',
    ],
  },
};

function usage() {
  console.log([
    'Usage: node scripts/path-deploy.js [plan|run|smoke] --env <test|prod> [options]',
    '',
    'Examples:',
    '  node scripts/path-deploy.js plan --env test --dataset intake-release --workflow-id 21',
    '  node scripts/path-deploy.js --env test --dataset intake-release --workflow-id 21',
    '  node scripts/path-deploy.js --env test --refresh-test-db --dataset intake-release --workflow-id 21 --yes',
    '  node scripts/path-deploy.js run --env prod --dataset intake-release --workflow-id 21 --yes',
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
    '  --yes                  Required for prod run',
    '  --json                 Emit machine-readable JSON',
    '  --help                 Show this help',
    '',
    'Notes:',
    '  - If no command is provided, `run` is assumed.',
    '  - Test app deploys currently use the existing in-place SSM rollout scripts.',
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
  return runJsonNodeScript(path.join(REPO_ROOT, 'scripts', 'path-schema-migrate.js'), scriptArgs);
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

function deployApplications(args, envConfig, appPlan, releaseId) {
  seedWindowsAwsCredentials(envConfig);

  const sharedArgs = ['-Profile', envConfig.profile, '-Region', envConfig.region];
  const adminArgs = envConfig.name === 'prod'
    ? ['-Profile', envConfig.profile, '-Region', envConfig.region]
    : ['-AwsProfile', envConfig.profile, '-Region', envConfig.region];
  const portalArgs = envConfig.name === 'prod'
    ? ['-Profile', envConfig.profile, '-Region', envConfig.region]
    : ['-AwsProfile', envConfig.profile, '-Region', envConfig.region];

  if (releaseId) {
    adminArgs.push('-ReleaseId', releaseId);
    portalArgs.push('-ReleaseId', releaseId);
  }

  if (args.skipBuild) {
    adminArgs.push('-SkipBuild');
    portalArgs.push('-SkipBuild');
  }

  if (envConfig.name === 'prod' && appPlan.deployShared) {
    runNpmScript('deploy-shared-to-prod', sharedArgs, REPO_ROOT);
  }
  if (envConfig.name === 'prod' && appPlan.deployAdmin) {
    runNpmScript('deploy-admin-to-prod', adminArgs, REPO_ROOT);
  }
  if (envConfig.name === 'prod' && appPlan.deployPortal) {
    runNpmScript('deploy-portal-to-prod', portalArgs, PORTAL_ROOT);
  }
  if (envConfig.name === 'prod' && appPlan.refreshProd) {
    runNpmScript('refresh-prod', ['-Profile', envConfig.profile, '-Region', envConfig.region, '-Wait'], REPO_ROOT);
  }

  if (envConfig.name === 'test' && appPlan.deployAdmin) {
    runNpmScript('deploy-admin-to-test', adminArgs, REPO_ROOT);
  }
  if (envConfig.name === 'test' && appPlan.deployPortal) {
    runNpmScript('deploy-portal-to-test', portalArgs, PORTAL_ROOT);
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
    adminDashboard: {
      path: REPO_ROOT,
      gitHead: getGitHead(REPO_ROOT),
    },
    portal: {
      path: PORTAL_ROOT,
      gitHead: getGitHead(PORTAL_ROOT),
    },
    shared: {
      path: SHARED_ROOT,
      gitHead: getGitHead(SHARED_ROOT),
    },
  };
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
      const appResult = await runStep(manifest, manifestPath, 'app.deploy', async () => deployApplications(args, envConfig, plan.app, plan.releaseId));
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
