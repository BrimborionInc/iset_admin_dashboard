#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildSourceSnapshotPlan,
  buildSourceSnapshot,
} = require('../src/lib/testDbSourceSnapshotBuilder');
const { assertMigrationApplySucceeded } = require('../src/lib/sharedSchemaMigrationRunner');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULTS = {
  profile: 'nwac-test',
  region: 'ca-central-1',
  asgName: 'nwac-test-asg',
  snapshotBucket: 'nwac-test-artifacts',
  snapshotKeyPrefix: 'db-refresh',
  dbSecretId: 'nwac-test-db-credentials',
  dbHost: 'nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com',
  dbName: 'iset_intake',
  dbPort: 3306,
};

function usage() {
  console.log([
    'Usage: node scripts/path-test-db-refresh.js <plan|run> [options]',
    '',
    'Options:',
    '  --profile NAME          AWS profile. Default: nwac-test',
    '  --region REGION         AWS region. Default: ca-central-1',
    '  --asg-name NAME         Test ASG name. Default: nwac-test-asg',
    '  --instance-id ID        Override the auto-discovered restore host',
    '  --snapshot-bucket NAME  S3 bucket holding the scrubbed snapshot. Default: nwac-test-artifacts',
    '  --snapshot-key KEY      Existing S3 object key to restore, or upload destination key when used with --snapshot-file',
    '  --snapshot-file PATH    Local scrubbed snapshot (.sql or .sql.gz) to upload then restore',
    '  --source-env NAME       Auto-build the snapshot from a source env. Current supported value: dev',
    '  --source-env-file PATH  Source env file for --source-env. Default: .env',
    '  --db-secret-id ID       Secrets Manager secret for DB credentials. Default: nwac-test-db-credentials',
    '  --db-host HOST          Aurora writer endpoint. Default: nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com',
    '  --db-name NAME          Database name to recreate. Default: iset_intake',
    '  --db-port PORT          Database port. Default: 3306',
    '  --skip-schema           Do not run canonical schema apply after restore',
    '  --skip-smoke            Skip post-restore TEST smoke checks',
    '  --keep-upload           Keep the uploaded snapshot object when --snapshot-file is used',
    '  --keep-generated-snapshot Keep the generated local snapshot when --source-env is used',
    '  --yes                   Required for run (destructive)',
    '  --json                  Emit machine-readable JSON',
    '  --help                  Show this help',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = {
    command: null,
    profile: DEFAULTS.profile,
    region: DEFAULTS.region,
    asgName: DEFAULTS.asgName,
    instanceId: null,
    snapshotBucket: DEFAULTS.snapshotBucket,
    snapshotKeyPrefix: DEFAULTS.snapshotKeyPrefix,
    snapshotKey: null,
    snapshotFile: null,
    sourceEnv: null,
    sourceEnvFile: null,
    dbSecretId: DEFAULTS.dbSecretId,
    dbHost: DEFAULTS.dbHost,
    dbName: DEFAULTS.dbName,
    dbPort: DEFAULTS.dbPort,
    skipSchema: false,
    skipSmoke: false,
    keepUpload: false,
    keepGeneratedSnapshot: false,
    yes: false,
    json: false,
  };

  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--profile') {
      args.profile = argv[++index];
    } else if (token === '--region') {
      args.region = argv[++index];
    } else if (token === '--asg-name') {
      args.asgName = argv[++index];
    } else if (token === '--instance-id') {
      args.instanceId = argv[++index];
    } else if (token === '--snapshot-bucket') {
      args.snapshotBucket = argv[++index];
    } else if (token === '--snapshot-key') {
      args.snapshotKey = argv[++index];
    } else if (token === '--snapshot-file') {
      args.snapshotFile = argv[++index];
    } else if (token === '--source-env') {
      args.sourceEnv = argv[++index];
    } else if (token === '--source-env-file') {
      args.sourceEnvFile = argv[++index];
    } else if (token === '--db-secret-id') {
      args.dbSecretId = argv[++index];
    } else if (token === '--db-host') {
      args.dbHost = argv[++index];
    } else if (token === '--db-name') {
      args.dbName = argv[++index];
    } else if (token === '--db-port') {
      args.dbPort = Number(argv[++index]);
    } else if (token === '--skip-schema') {
      args.skipSchema = true;
    } else if (token === '--skip-smoke') {
      args.skipSmoke = true;
    } else if (token === '--keep-upload') {
      args.keepUpload = true;
    } else if (token === '--keep-generated-snapshot') {
      args.keepGeneratedSnapshot = true;
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

  if (!args.command && positional.length) {
    args.command = positional[0];
  }

  if (args.snapshotFile && args.sourceEnv) {
    throw new Error('Use either --snapshot-file or --source-env, not both');
  }
  if (args.snapshotKey && args.sourceEnv) {
    throw new Error('Use either --snapshot-key or --source-env, not both');
  }

  return args;
}

function quoteBashArgument(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

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

function toNodePath(filePath) {
  if (!filePath) {
    return filePath;
  }
  if (process.platform === 'win32' && /^\/mnt\/[A-Za-z]\//.test(filePath)) {
    const drive = filePath[5].toUpperCase();
    const rest = filePath.slice(7).replace(/\//g, '\\');
    return `${drive}:\\${rest}`;
  }
  return filePath;
}

function resolveInputPath(filePath) {
  const normalized = toNodePath(filePath);
  if (path.isAbsolute(normalized)) {
    return normalized;
  }
  return path.resolve(REPO_ROOT, normalized);
}

function runBashCommand(commandText, { capture = true } = {}) {
  const result = spawnSync('bash', ['-lc', commandText], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || commandText).trim());
  }
  return result;
}

function runAwsRaw(args) {
  const awsCommand = ['aws', ...args].map(quoteBashArgument).join(' ');
  const commandText = `AWS_PAGER='' AWS_CLI_AUTO_PROMPT=off ${awsCommand}`;
  const result = runBashCommand(commandText);
  return (result.stdout || '').trim();
}

function runAwsJson(args) {
  return JSON.parse(runAwsRaw([...args, '--output', 'json']) || '{}');
}

function runJsonNodeScript(scriptPath, scriptArgs) {
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs, '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${scriptPath} failed`).trim());
  }
  return JSON.parse(result.stdout || '{}');
}

function getIdentity(profile) {
  return runAwsJson(['sts', 'get-caller-identity', '--profile', profile]);
}

function getAsg(asgName, region, profile) {
  const payload = runAwsJson([
    'autoscaling',
    'describe-auto-scaling-groups',
    '--auto-scaling-group-names',
    asgName,
    '--region',
    region,
    '--profile',
    profile,
  ]);
  return (payload.AutoScalingGroups || [])[0] || null;
}

function getOnlineSsmIds(region, profile) {
  const payload = runAwsJson([
    'ssm',
    'describe-instance-information',
    '--region',
    region,
    '--profile',
    profile,
  ]);
  return new Set(
    (payload.InstanceInformationList || [])
      .filter(item => item.PingStatus === 'Online')
      .map(item => item.InstanceId)
  );
}

function assertBucketExists(bucketName, region, profile) {
  runAwsRaw([
    's3api',
    'head-bucket',
    '--bucket',
    bucketName,
    '--region',
    region,
    '--profile',
    profile,
  ]);
}

function getObjectHead(bucketName, key, region, profile) {
  return runAwsJson([
    's3api',
    'head-object',
    '--bucket',
    bucketName,
    '--key',
    key,
    '--region',
    region,
    '--profile',
    profile,
  ]);
}

function selectRestoreInstance(instances, explicitInstanceId = null) {
  if (explicitInstanceId) {
    const match = instances.find(instance => instance.instanceId === explicitInstanceId);
    if (!match) {
      throw new Error(`Requested instance ${explicitInstanceId} was not found in the current ASG inventory`);
    }
    if (!match.ssmOnline) {
      throw new Error(`Requested instance ${explicitInstanceId} is not currently SSM-online`);
    }
    return match;
  }

  const preferred = instances.find(
    instance => instance.lifecycleState === 'InService' && instance.healthStatus === 'Healthy' && instance.ssmOnline
  );
  if (preferred) {
    return preferred;
  }

  const anyOnline = instances.find(instance => instance.ssmOnline);
  if (anyOnline) {
    return anyOnline;
  }

  throw new Error('No SSM-online TEST application instance is currently available for DB restore');
}

function sanitizeKeySegment(value) {
  return String(value)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'snapshot';
}

function buildReleaseId() {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function getManifestPath(releaseId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(REPO_ROOT, 'tmp', 'path-test-db-refresh');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${sanitizeKeySegment(releaseId)}--${stamp}.json`);
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

function getSourceEnvOptions(args) {
  if (!args.sourceEnv) {
    return null;
  }
  return {
    sourceEnv: args.sourceEnv,
    envFile: args.sourceEnvFile || '.env',
  };
}

async function resolveSnapshotSource(args, releaseId, { requireConcrete = false } = {}) {
  assertBucketExists(args.snapshotBucket, args.region, args.profile);

  if (args.snapshotFile) {
    const localPath = resolveInputPath(args.snapshotFile);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Snapshot file not found: ${localPath}`);
    }
    const stats = fs.statSync(localPath);
    const key = args.snapshotKey || `${args.snapshotKeyPrefix}/${releaseId}-${sanitizeKeySegment(path.basename(localPath))}`;
    return {
      kind: 'local-file',
      bucket: args.snapshotBucket,
      key,
      localPath,
      localPathForBash: toBashPath(localPath),
      sizeBytes: stats.size,
      uploadedByRun: true,
    };
  }

  if (args.snapshotKey) {
    const head = getObjectHead(args.snapshotBucket, args.snapshotKey, args.region, args.profile);
    return {
      kind: 's3-object',
      bucket: args.snapshotBucket,
      key: args.snapshotKey,
      sizeBytes: Number(head.ContentLength || 0),
      eTag: head.ETag || null,
      lastModified: head.LastModified || null,
      uploadedByRun: false,
    };
  }

  if (args.sourceEnv) {
    const sourceOptions = getSourceEnvOptions(args);
    const snapshotPlan = await buildSourceSnapshotPlan(sourceOptions);
    const generatedName = path.basename(snapshotPlan.outputPath);
    return {
      kind: 'generated-source-env',
      bucket: args.snapshotBucket,
      key: args.snapshotKey || `${args.snapshotKeyPrefix}/${releaseId}-${sanitizeKeySegment(generatedName)}`,
      sourceEnv: snapshotPlan.sourceEnv,
      sourceEnvFile: snapshotPlan.loadedEnvFile,
      snapshotMode: snapshotPlan.snapshotMode,
      database: snapshotPlan.database,
      dataSelection: snapshotPlan.dataSelection,
      uploadedByRun: true,
      generatedByRun: true,
    };
  }

  if (requireConcrete) {
    throw new Error('Run requires --snapshot-file <path>, --snapshot-key <s3-key>, or --source-env <name>');
  }

  return {
    kind: 'unspecified',
    bucket: args.snapshotBucket,
    key: null,
    uploadedByRun: false,
  };
}

async function buildPlan(args, releaseId) {
  const identity = getIdentity(args.profile);
  const asg = getAsg(args.asgName, args.region, args.profile);
  if (!asg) {
    throw new Error(`Auto Scaling Group not found: ${args.asgName}`);
  }

  const onlineSsmIds = getOnlineSsmIds(args.region, args.profile);
  const instances = (asg.Instances || []).map(instance => ({
    instanceId: instance.InstanceId,
    lifecycleState: instance.LifecycleState,
    healthStatus: instance.HealthStatus,
      ssmOnline: onlineSsmIds.has(instance.InstanceId),
  }));
  const restoreInstance = selectRestoreInstance(instances, args.instanceId);
  const snapshotSource = await resolveSnapshotSource(args, releaseId, { requireConcrete: false });

  return {
    releaseId,
    generatedAt: new Date().toISOString(),
    action: 'test-db-refresh',
    restoreImplemented: true,
    destructive: true,
    profile: args.profile,
    region: args.region,
    asgName: args.asgName,
    identity: {
      account: identity.Account,
      arn: identity.Arn,
      userId: identity.UserId,
    },
    autoScalingGroup: {
      name: asg.AutoScalingGroupName,
      minSize: asg.MinSize,
      maxSize: asg.MaxSize,
      desiredCapacity: asg.DesiredCapacity,
    },
    restoreInstance,
    instances,
    snapshotSource,
    dbTarget: {
      secretId: args.dbSecretId,
      host: args.dbHost,
      name: args.dbName,
      port: args.dbPort,
    },
    postActions: {
      schemaApply: !args.skipSchema,
      smokeCheck: !args.skipSmoke,
    },
  };
}

function printPlan(plan) {
  console.log(`Release: ${plan.releaseId}`);
  console.log(`Profile: ${plan.profile}`);
  console.log(`Identity: ${plan.identity.arn}`);
  console.log(`Region: ${plan.region}`);
  console.log(`ASG: ${plan.autoScalingGroup.name} (desired ${plan.autoScalingGroup.desiredCapacity})`);
  console.log(`Restore host: ${plan.restoreInstance.instanceId}`);
  console.log(`Target DB: ${plan.dbTarget.host}:${plan.dbTarget.port}/${plan.dbTarget.name}`);
  if (plan.snapshotSource.kind === 'local-file') {
    console.log(`Snapshot source: local file ${plan.snapshotSource.localPath}`);
    console.log(`Upload target: s3://${plan.snapshotSource.bucket}/${plan.snapshotSource.key}`);
  } else if (plan.snapshotSource.kind === 'generated-source-env') {
    console.log(`Snapshot source: generated from ${plan.snapshotSource.sourceEnv} (${plan.snapshotSource.snapshotMode})`);
    console.log(`Source env file: ${plan.snapshotSource.sourceEnvFile}`);
    console.log(`Upload target: s3://${plan.snapshotSource.bucket}/${plan.snapshotSource.key}`);
    if (plan.snapshotSource.dataSelection) {
      console.log(`Safe data tables: ${plan.snapshotSource.dataSelection.safeTables.length}`);
      console.log(`Filtered tables: ${plan.snapshotSource.dataSelection.filteredTables.length}`);
    }
  } else if (plan.snapshotSource.kind === 's3-object') {
    console.log(`Snapshot source: s3://${plan.snapshotSource.bucket}/${plan.snapshotSource.key}`);
  } else {
    console.log(`Snapshot source: none selected yet (bucket ${plan.snapshotSource.bucket})`);
  }
  console.log(`Post-restore schema apply: ${plan.postActions.schemaApply}`);
  console.log(`Post-restore smoke check: ${plan.postActions.smokeCheck}`);
  console.log('Instances:');
  plan.instances.forEach(instance => {
    console.log(`- ${instance.instanceId} (${instance.lifecycleState}, ${instance.healthStatus}, ssmOnline=${instance.ssmOnline})`);
  });
}

function uploadSnapshot(snapshotSource, args) {
  if (snapshotSource.kind !== 'local-file' && snapshotSource.kind !== 'generated-local-file') {
    return snapshotSource;
  }

  runAwsRaw([
    's3',
    'cp',
    snapshotSource.localPathForBash,
    `s3://${snapshotSource.bucket}/${snapshotSource.key}`,
    '--region',
    args.region,
    '--profile',
    args.profile,
    '--only-show-errors',
  ]);

  const head = getObjectHead(snapshotSource.bucket, snapshotSource.key, args.region, args.profile);
  return {
    ...snapshotSource,
    uploaded: true,
    sizeBytes: Number(head.ContentLength || snapshotSource.sizeBytes || 0),
    eTag: head.ETag || null,
    lastModified: head.LastModified || null,
  };
}

async function buildGeneratedSnapshot(snapshotSource, args) {
  if (snapshotSource.kind !== 'generated-source-env') {
    return snapshotSource;
  }

  const builtSnapshot = await buildSourceSnapshot(getSourceEnvOptions(args));
  return {
    ...snapshotSource,
    kind: 'generated-local-file',
    localPath: builtSnapshot.outputPath,
    localPathForBash: toBashPath(builtSnapshot.outputPath),
    sizeBytes: builtSnapshot.sizeBytes,
    outputFormat: builtSnapshot.outputFormat,
    generatedAt: builtSnapshot.generatedAt,
    generatedByRun: true,
  };
}

function deleteUploadedSnapshot(snapshotSource, args) {
  if (!snapshotSource || !snapshotSource.uploadedByRun) {
    return null;
  }

  runAwsRaw([
    's3',
    'rm',
    `s3://${snapshotSource.bucket}/${snapshotSource.key}`,
    '--region',
    args.region,
    '--profile',
    args.profile,
    '--only-show-errors',
  ]);

  return {
    bucket: snapshotSource.bucket,
    key: snapshotSource.key,
    deleted: true,
  };
}

function deleteGeneratedSnapshot(snapshotSource, args) {
  if (!snapshotSource || !snapshotSource.generatedByRun || !snapshotSource.localPath || args.keepGeneratedSnapshot) {
    return null;
  }

  if (fs.existsSync(snapshotSource.localPath)) {
    fs.unlinkSync(snapshotSource.localPath);
  }

  return {
    localPath: snapshotSource.localPath,
    deleted: true,
  };
}

function runRestore(plan, args) {
  const helperScript = toBashPath(path.join(REPO_ROOT, 'scripts', 'run-test-db-restore-via-ssm.sh'));
  const helperArgs = [
    helperScript,
    '--s3-bucket',
    plan.snapshotSource.bucket,
    '--s3-key',
    plan.snapshotSource.key,
    '--profile',
    args.profile,
    '--region',
    args.region,
    '--asg-name',
    args.asgName,
    '--instance-id',
    plan.restoreInstance.instanceId,
    '--db-secret-id',
    args.dbSecretId,
    '--db-host',
    args.dbHost,
    '--db-name',
    args.dbName,
    '--db-port',
    String(args.dbPort),
  ];

  const result = spawnSync('bash', helperArgs, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'TEST DB restore failed').trim());
  }

  return {
    instanceId: plan.restoreInstance.instanceId,
    bucket: plan.snapshotSource.bucket,
    key: plan.snapshotSource.key,
    stdout: (result.stdout || '').trim() || null,
    stderr: (result.stderr || '').trim() || null,
  };
}

function applyCanonicalSchema(args) {
  const result = runJsonNodeScript(path.join(REPO_ROOT, 'scripts', 'path-schema-migrate.js'), [
    'apply',
    '--target-env',
    'test',
    '--profile',
    args.profile,
    '--region',
    args.region,
  ]);
  return assertMigrationApplySucceeded(result, {
    context: 'TEST refresh canonical schema apply',
  });
}

function runTestSmoke() {
  return runJsonNodeScript(path.join(REPO_ROOT, 'scripts', 'path-deploy.js'), [
    'smoke',
    '--env',
    'test',
  ]);
}

async function handlePlan(args) {
  const releaseId = buildReleaseId();
  const plan = await buildPlan(args, releaseId);
  const manifestPath = getManifestPath(releaseId);
  const manifest = {
    ...plan,
    status: 'planned',
    steps: [],
  };
  writeManifest(manifestPath, manifest);

  if (args.json) {
    console.log(JSON.stringify({ ...manifest, manifestPath }, null, 2));
    return;
  }

  printPlan(plan);
  console.log(`Manifest: ${manifestPath}`);
}

async function handleRun(args) {
  if (!args.yes) {
    throw new Error('Run requires --yes because TEST DB refresh is destructive');
  }

  const releaseId = buildReleaseId();
  const plan = await buildPlan(args, releaseId);
  const concreteSnapshotSource = await resolveSnapshotSource(args, releaseId, { requireConcrete: true });
  plan.snapshotSource = concreteSnapshotSource;

  const manifestPath = getManifestPath(releaseId);
  const manifest = {
    ...plan,
    status: 'running',
    steps: [],
  };
  writeManifest(manifestPath, manifest);

  let generatedSnapshot = null;
  let uploadedSnapshot = null;

  try {
    if (concreteSnapshotSource.kind === 'generated-source-env') {
      generatedSnapshot = await runStep(
        manifest,
        manifestPath,
        'snapshot.build',
        async () => buildGeneratedSnapshot(concreteSnapshotSource, args)
      );
      manifest.generatedSnapshot = generatedSnapshot;
      manifest.snapshotSource = generatedSnapshot;
    }

    const uploadSource = generatedSnapshot || concreteSnapshotSource;
    if (uploadSource.kind === 'local-file' || uploadSource.kind === 'generated-local-file') {
      uploadedSnapshot = await runStep(
        manifest,
        manifestPath,
        'snapshot.upload',
        async () => uploadSnapshot(uploadSource, args)
      );
      manifest.snapshotSource = uploadedSnapshot;
    }

    const effectiveSnapshot = uploadedSnapshot || uploadSource;
    manifest.snapshotSource = effectiveSnapshot;
    writeManifest(manifestPath, manifest);

    const restoreResult = await runStep(manifest, manifestPath, 'db.restore', async () => runRestore({
      ...plan,
      snapshotSource: effectiveSnapshot,
    }, args));
    manifest.restoreResult = restoreResult;

    if (!args.skipSchema) {
      const schemaResult = await runStep(manifest, manifestPath, 'schema.apply', async () => applyCanonicalSchema(args));
      manifest.schemaApply = schemaResult;
    }

    if (!args.skipSmoke) {
      const smokeResult = await runStep(manifest, manifestPath, 'smoke.check', async () => runTestSmoke());
      manifest.smokeResults = smokeResult;
    }

    if (uploadedSnapshot && !args.keepUpload) {
      const cleanupResult = await runStep(
        manifest,
        manifestPath,
        'snapshot.cleanup',
        async () => deleteUploadedSnapshot(uploadedSnapshot, args)
      );
      manifest.snapshotCleanup = cleanupResult;
    }

    if (generatedSnapshot && !args.keepGeneratedSnapshot) {
      const generatedCleanup = await runStep(
        manifest,
        manifestPath,
        'snapshot.local-cleanup',
        async () => deleteGeneratedSnapshot(generatedSnapshot, args)
      );
      manifest.generatedSnapshotCleanup = generatedCleanup;
    }

    manifest.status = 'successful';
    manifest.finishedAt = new Date().toISOString();
    writeManifest(manifestPath, manifest);

    if (args.json) {
      console.log(JSON.stringify({ ...manifest, manifestPath }, null, 2));
      return;
    }

    console.log(`Release: ${releaseId}`);
    console.log('Status: successful');
    console.log(`Manifest: ${manifestPath}`);
  } catch (error) {
    if (generatedSnapshot && !args.keepGeneratedSnapshot) {
      try {
        const generatedCleanup = deleteGeneratedSnapshot(generatedSnapshot, args);
        if (generatedCleanup) {
          manifest.generatedSnapshotCleanup = generatedCleanup;
        }
      } catch (_) {
        // Ignore best-effort cleanup failure on error path.
      }
    }
    manifest.status = 'failed';
    manifest.finishedAt = new Date().toISOString();
    manifest.error = serializeError(error);
    writeManifest(manifestPath, manifest);
    throw new Error(`${error.message}\nManifest: ${manifestPath}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.command === 'help') {
    usage();
    return;
  }

  if (args.command === 'plan') {
    await handlePlan(args);
    return;
  }

  if (args.command === 'run') {
    await handleRun(args);
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
}

main().catch(error => {
  console.error(`[path-test-db-refresh] ${error.message}`);
  process.exit(1);
});
