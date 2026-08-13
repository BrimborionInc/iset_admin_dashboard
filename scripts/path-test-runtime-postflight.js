#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXPECTED_ACCOUNT_ID = '124355655255';
const DEFAULT_PROFILE = 'nwac-test';
const DEFAULT_REGION = 'ca-central-1';
const DEFAULT_ASG = 'nwac-test-asg';

function usage() {
  console.log([
    'Usage: node scripts/path-test-runtime-postflight.js [options]',
    '',
    'Read-only post-deployment acceptance probes for TEST. This script never targets PROD.',
    '',
    'Options:',
    '  --profile NAME       AWS profile. Default: nwac-test',
    '  --region REGION      AWS region. Default: ca-central-1',
    '  --maintenance-only   Check only the announcement and ALB fallback cleanup contract',
    '  --payment-rollback   Also run the deployed rollback-only payment fixture',
    '  --json               Emit JSON',
    '  --help               Show this help',
    '',
    'Full mode requires PATH_RELEASE_QUALIFICATION_RELEASE_ID plus the expected admin,',
    'portal, and shared tree fingerprints supplied by path-release-qualify.',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = {
    profile: DEFAULT_PROFILE,
    region: DEFAULT_REGION,
    maintenanceOnly: false,
    paymentRollback: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--profile') args.profile = argv[++index];
    else if (token === '--region') args.region = argv[++index];
    else if (token === '--maintenance-only') args.maintenanceOnly = true;
    else if (token === '--payment-rollback') args.paymentRollback = true;
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    } else throw new Error(`Unknown option: ${token}`);
  }
  return args;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || REPO_ROOT,
    env: options.env || process.env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} exited with ${result.status}`).trim());
  }
  return result.stdout || '';
}

function runAws(args, commandArgs) {
  return run('aws', [
    ...commandArgs,
    '--profile', args.profile,
    '--region', args.region,
    '--no-cli-pager',
  ]);
}

function runAwsJson(args, commandArgs) {
  const output = runAws(args, [...commandArgs, '--output', 'json']);
  return JSON.parse(output || '{}');
}

function assertTestIdentity(args) {
  const identity = runAwsJson(args, ['sts', 'get-caller-identity']);
  if (String(identity.Account) !== EXPECTED_ACCOUNT_ID) {
    throw new Error(`AWS profile resolved to ${identity.Account || 'unknown'}, expected TEST account ${EXPECTED_ACCOUNT_ID}`);
  }
  return { account: identity.Account, arn: identity.Arn };
}

function discoverOnlineInstances(args) {
  const asg = runAwsJson(args, [
    'autoscaling', 'describe-auto-scaling-groups',
    '--auto-scaling-group-names', DEFAULT_ASG,
  ]);
  const running = (asg.AutoScalingGroups?.[0]?.Instances || [])
    .filter(instance => instance.LifecycleState === 'InService' && instance.HealthStatus === 'Healthy')
    .map(instance => instance.InstanceId);
  const ssm = runAwsJson(args, ['ssm', 'describe-instance-information']);
  const online = new Set((ssm.InstanceInformationList || [])
    .filter(instance => instance.PingStatus === 'Online')
    .map(instance => instance.InstanceId));
  const instances = running.filter(instanceId => online.has(instanceId));
  if (!instances.length || instances.length !== running.length) {
    throw new Error(`Expected every healthy ${DEFAULT_ASG} instance to be online in SSM; healthy=${running.length}, online=${instances.length}`);
  }
  return instances;
}

function sendSsm(args, instanceId, commands, comment) {
  const sent = runAwsJson(args, [
    'ssm', 'send-command',
    '--instance-ids', instanceId,
    '--document-name', 'AWS-RunShellScript',
    '--comment', comment,
    '--parameters', JSON.stringify({ commands }),
  ]);
  const commandId = sent.Command?.CommandId;
  if (!commandId) throw new Error('SSM did not return a command ID');
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const wait = spawnSync('bash', ['-lc', 'sleep 2'], { encoding: 'utf8' });
    if (wait.status !== 0) throw new Error('Unable to wait for SSM command');
    let invocation;
    try {
      invocation = runAwsJson(args, [
        'ssm', 'get-command-invocation',
        '--command-id', commandId,
        '--instance-id', instanceId,
      ]);
    } catch (error) {
      if (/InvocationDoesNotExist/u.test(error.message)) continue;
      throw error;
    }
    if (['Pending', 'InProgress', 'Delayed'].includes(invocation.Status)) continue;
    if (invocation.Status !== 'Success') {
      throw new Error(`SSM ${comment} failed on ${instanceId}: ${invocation.Status}; ${(invocation.StandardErrorContent || invocation.StandardOutputContent || '').trim()}`);
    }
    return {
      instanceId,
      commandId,
      output: String(invocation.StandardOutputContent || '').trim(),
    };
  }
  throw new Error(`SSM ${comment} timed out on ${instanceId}`);
}

function requiredCandidateEnvironment() {
  const names = [
    'PATH_RELEASE_QUALIFICATION_RELEASE_ID',
    'PATH_RELEASE_QUALIFICATION_ADMIN_FINGERPRINT',
    'PATH_RELEASE_QUALIFICATION_PORTAL_FINGERPRINT',
    'PATH_RELEASE_QUALIFICATION_SHARED_FINGERPRINT',
  ];
  const missing = names.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing qualification context: ${missing.join(', ')}`);
  return {
    releaseId: process.env.PATH_RELEASE_QUALIFICATION_RELEASE_ID,
    deployedComponents: String(process.env.PATH_RELEASE_QUALIFICATION_DEPLOYED_COMPONENTS || '')
      .split(',').map(value => value.trim()).filter(Boolean),
    fingerprints: {
      admin: process.env.PATH_RELEASE_QUALIFICATION_ADMIN_FINGERPRINT,
      portal: process.env.PATH_RELEASE_QUALIFICATION_PORTAL_FINGERPRINT,
      shared: process.env.PATH_RELEASE_QUALIFICATION_SHARED_FINGERPRINT,
    },
  };
}

function runtimeCommands(candidate, paymentRollback) {
  const expected = JSON.stringify(candidate);
  const commands = [
    'set -euo pipefail',
    `test "$(curl -fsS http://127.0.0.1:5001/readyz | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).status||""))')" = ready`,
    `test "$(curl -fsS http://127.0.0.1:5000/readyz | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).status||""))')" = ready`,
    `EXPECTED_CANDIDATE='${expected.replace(/'/gu, `'\\''`)}' node -e "const fs=require('fs'); const e=JSON.parse(process.env.EXPECTED_CANDIDATE); const paths={admin:'/opt/nwac/admin-dashboard/.path-release-provenance.json',portal:'/opt/nwac/portal/.path-release-provenance.json'}; for(const [component,p] of Object.entries(paths)){const v=JSON.parse(fs.readFileSync(p,'utf8')); if(v.component!==component) throw new Error(component+' provenance component mismatch'); if(!e.deployedComponents.includes(component)) continue; if(v.releaseId!==e.releaseId) throw new Error(component+' release id mismatch'); for(const repo of ['admin','portal','shared']) if(v.source?.[repo]?.treeFingerprint!==e.fingerprints[repo]) throw new Error(component+' '+repo+' source mismatch');} console.log('PROVENANCE=passed');"`,
    'node -e "const c=require(\'/opt/nwac/admin-dashboard/src/lib/adminRuntimeSchemaContract\'); const expected=[\'id\',\'cognito_sub\',\'email\',\'primary_role\',\'region_id\']; if(JSON.stringify(c.STAFF_PROFILE_RUNTIME_COLUMNS)!==JSON.stringify(expected)) throw new Error(\'admin authenticated contract drift\'); console.log(\'AUTH_SCHEMA_PARITY=passed\');"',
    'node -e "const fs=require(\'fs\'); const dotenv=require(\'/opt/nwac/admin-dashboard/node_modules/dotenv\'); const pairs=[[\'/opt/nwac/admin-dashboard/.env\',[\'DB_HOST\',\'DB_USER\',\'DB_NAME\',\'AWS_REGION\',\'COGNITO_STAFF_USER_POOL_ID\',\'COGNITO_STAFF_CLIENT_ID\',\'UPLOAD_DRIVER\',\'OBJECT_BUCKET\',\'OBJECT_REGION\',\'OPENROUTER_API_KEY\']],[\'/opt/nwac/portal/.env\',[\'DB_HOST\',\'DB_USER\',\'DB_NAME\',\'COGNITO_REGION\',\'COGNITO_USER_POOL_ID\',\'COGNITO_PORTAL_CLIENT_ID\',\'COGNITO_TRUSTED_POOLS\',\'UPLOAD_DRIVER\',\'OBJECT_BUCKET\',\'OBJECT_REGION\',\'OPENROUTER_API_KEY\']]]; for(const [p,keys] of pairs){const env=dotenv.parse(fs.readFileSync(p)); for(const key of keys) if(!env[key]) throw new Error(p+\' missing \'+key);} const portal=dotenv.parse(fs.readFileSync(\'/opt/nwac/portal/.env\')); if(String(portal.AUTO_MIGRATE).toLowerCase()!==\'false\') throw new Error(\'portal AUTO_MIGRATE must be false\'); console.log(\'RUNTIME_CONFIG=passed\');"',
    'export HOME=/root PM2_HOME=/root/.pm2',
    `pm2 jlist | node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const rows=JSON.parse(s); for(const name of ["nwac-admin","nwac-portal"]){const row=rows.find(v=>v.name===name); if(!row||row.pm2_env?.status!=="online"||Number(row.pid)<=0) throw new Error(name+" is not online"); console.log("PROCESS_"+name.toUpperCase().replace(/-/g,"_")+"=online;restarts="+Number(row.pm2_env?.restart_time||0));}})'`,
  ];
  if (paymentRollback) {
    commands.push('cd /opt/nwac/admin-dashboard && node scripts/payments-workflow-smoke.js --target-env test --json');
  }
  return commands;
}

function runSchemaPlan(args, instanceId) {
  const invocation = sendSsm(args, instanceId, [
    'set -euo pipefail',
    'cd /opt/nwac/admin-dashboard',
    'node scripts/path-test-migration-ledger.js --env-file /opt/nwac/admin-dashboard/.env.test --json',
  ], 'PATH TEST guarded migration ledger');
  let report;
  try {
    report = JSON.parse(invocation.output || '{}');
  } catch (_) {
    throw new Error(`Unable to parse guarded TEST migration ledger: ${String(invocation.output || '').slice(0, 1000)}`);
  }
  if (report.status !== 'passed' || !report.schemaSafety?.preflightComplete) {
    throw new Error(`TEST migration ledger schema proof was incomplete: ${JSON.stringify(report).slice(0, 1000)}`);
  }
  const pendingCount = Number(report.pendingCount);
  const failureCount = Number(report.failureCount);
  if (!Number.isInteger(pendingCount) || !Number.isInteger(failureCount)) {
    throw new Error('TEST migration ledger summary was incomplete.');
  }
  if (pendingCount !== 0) throw new Error(`TEST has ${pendingCount} pending canonical migration(s)`);
  if (failureCount !== 0) throw new Error(`TEST migration ledger has ${failureCount} failed attempt(s)`);
  return {
    pendingCount,
    failureCount,
    trackingTableExists: report.trackingTableExists,
    schemaSafety: report.schemaSafety,
    instanceId,
    commandId: invocation.commandId,
  };
}

function runSqlMetrics(args, instanceId) {
  const invocation = sendSsm(args, instanceId, [
    'set -euo pipefail',
    'cd /opt/nwac/admin-dashboard',
    'node scripts/path-test-runtime-metrics.js --env-file /opt/nwac/admin-dashboard/.env.test --json',
  ], 'PATH TEST guarded runtime metrics');
  let report;
  try {
    report = JSON.parse(invocation.output || '{}');
  } catch (_) {
    throw new Error(`Unable to parse guarded TEST runtime metrics: ${String(invocation.output || '').slice(0, 1000)}`);
  }
  if (report.status !== 'passed' || !report.schemaSafety?.preflightComplete) {
    throw new Error(`TEST runtime metrics schema proof was incomplete: ${JSON.stringify(report).slice(0, 1000)}`);
  }
  const metrics = report.metrics || {};
  const nonZero = Object.entries(metrics).filter(([, value]) => value !== 0);
  if (nonZero.length) throw new Error(`TEST runtime blocker metrics are non-zero: ${JSON.stringify(Object.fromEntries(nonZero))}`);
  return {
    ...metrics,
    schemaSafety: report.schemaSafety,
    instanceId,
    commandId: invocation.commandId,
  };
}

function maintenanceStatus(args) {
  const output = run(process.execPath, [
    path.join(REPO_ROOT, 'scripts', 'path-maintenance-fallback.js'),
    'status', '--env', 'test', '--profile', args.profile, '--region', args.region, '--json',
  ]);
  const result = JSON.parse(output || '{}');
  const entries = (result.surfaces || []).flatMap(surface => surface.entries || []);
  const bad = entries.filter(entry => entry.actionType !== 'forward' || entry.maintenancePageEnabled);
  if (!entries.length || bad.length) throw new Error(`TEST maintenance fallback is not clear: ${JSON.stringify(bad)}`);
  return { hosts: entries.map(entry => entry.host), action: 'forward' };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const identity = assertTestIdentity(args);
  const maintenance = maintenanceStatus(args);
  const onlineInstances = discoverOnlineInstances(args);
  const metrics = runSqlMetrics(args, onlineInstances[0]);
  if (args.maintenanceOnly) {
    const result = { schemaVersion: 1, status: 'passed', mode: 'maintenance-only', identity, maintenance, metrics };
    console.log(args.json ? JSON.stringify(result, null, 2) : 'TEST maintenance cleanup: PASS');
    return;
  }

  const candidate = requiredCandidateEnvironment();
  const schema = runSchemaPlan(args, onlineInstances[0]);
  const instances = onlineInstances.map(instanceId =>
    sendSsm(args, instanceId, runtimeCommands(candidate, args.paymentRollback), 'PATH TEST release postflight')
  );
  const result = {
    schemaVersion: 1,
    status: 'passed',
    mode: args.paymentRollback ? 'full-with-payment-rollback' : 'full',
    identity,
    candidate,
    schema,
    metrics,
    maintenance,
    instances,
  };
  console.log(args.json ? JSON.stringify(result, null, 2) : `TEST runtime postflight: PASS (${instances.length} instance(s))`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`TEST runtime postflight: FAIL (${error.message || error})`);
    process.exitCode = 1;
  }
}

module.exports = { runtimeCommands };
