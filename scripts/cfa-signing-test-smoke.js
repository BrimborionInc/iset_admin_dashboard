#!/usr/bin/env node

/*
 * Runs the authenticated CFA signing smoke against the deployed TEST portal.
 * Cognito provisioning is performed with the nwac-test operator profile; the
 * database fixture and HTTP checks run on the TEST app host through SSM.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { discoverVerifiedTestInstanceAwsIdentity } = require('./lib/test-instance-aws-identity');

const EXPECTED_AWS_ACCOUNT = '124355655255';
const EXPECTED_AWS_ARN = 'arn:aws:iam::124355655255:user/CODEX_CLI_Admin';
const DEFAULT_PROFILE = 'nwac-test';
const DEFAULT_REGION = 'ca-central-1';
const DEFAULT_BUCKET = 'nwac-test-artifacts';
const EXPECTED_TEST_DB_HOST = 'nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com';
const EXPECTED_TEST_DB_USER = 'app_admin';
const EXPECTED_TEST_DB_SERVER_HOSTNAME = 'ip-172-16-0-199';
const EXPECTED_TEST_DB_PORT = 3306;
const EXPECTED_TEST_DB_PRINCIPAL = 'app_admin@10.48.%';
const EXPECTED_TEST_DB_VERSION = '8.0.42';

function parseArgs(argv) {
  const args = {
    profile: process.env.AWS_PROFILE || DEFAULT_PROFILE,
    region: process.env.AWS_REGION || DEFAULT_REGION,
    bucket: process.env.CFA_SIGNING_TEST_BUCKET || DEFAULT_BUCKET,
    instanceId: '',
    portalEnv: path.resolve(__dirname, '..', '..', 'ISET-intake', '.env.test'),
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--profile') args.profile = argv[++index];
    else if (token === '--region') args.region = argv[++index];
    else if (token === '--bucket') args.bucket = argv[++index];
    else if (token === '--instance-id') args.instanceId = argv[++index];
    else if (token === '--portal-env') args.portalEnv = path.resolve(argv[++index]);
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      console.log('Usage: node scripts/cfa-signing-test-smoke.js [--profile nwac-test] [--region ca-central-1] [--instance-id ID] [--json]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function aws(args, options) {
  return execFileSync('aws', [...args, '--region', options.region, '--profile', options.profile], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  });
}

function awsJson(args, options) {
  const output = aws([...args, '--output', 'json'], options).trim();
  return output ? JSON.parse(output) : null;
}

function awsText(args, options) {
  return aws([...args, '--output', 'text'], options).trim();
}

function readEnvFile(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/gu, `'\\''`)}'`;
}

function discoverInstanceId(options) {
  if (options.instanceId) return options.instanceId;
  const online = new Set(awsText([
    'ssm', 'describe-instance-information',
    '--query', 'InstanceInformationList[?PingStatus==`Online`].InstanceId',
  ], options).split(/\s+/u).filter(Boolean));
  const running = awsText([
    'ec2', 'describe-instances',
    '--filters', 'Name=tag:Name,Values=nwac-test-app', 'Name=instance-state-name,Values=running',
    '--query', 'Reservations[].Instances[].InstanceId',
  ], options).split(/\s+/u).filter(Boolean);
  const instanceId = running.find(id => online.has(id));
  if (!instanceId) throw new Error('No online SSM-managed nwac-test-app instance found');
  return instanceId;
}

function waitForCommand(instanceId, commandId, options) {
  for (;;) {
    let result = null;
    try {
      result = awsJson([
        'ssm', 'get-command-invocation', '--command-id', commandId, '--instance-id', instanceId,
        '--query', '{Status:Status,Stdout:StandardOutputContent,Stderr:StandardErrorContent}',
      ], options);
    } catch (_) {
      result = null;
    }
    if (!result || ['Pending', 'InProgress', 'Delayed'].includes(result.Status)) {
      spawnSync('sleep', ['2.5']);
      continue;
    }
    return result;
  }
}

function sendCommand(instanceId, commands, options) {
  const paramsFile = path.join(os.tmpdir(), `cfa-signing-test-params-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(paramsFile, JSON.stringify({ commands }), 'utf8');
  try {
    return awsText([
      'ssm', 'send-command', '--instance-ids', instanceId,
      '--document-name', 'AWS-RunShellScript', '--parameters', `file://${paramsFile}`,
      '--comment', 'PATH CFA signing TEST acceptance', '--query', 'Command.CommandId',
    ], options);
  } finally {
    fs.rmSync(paramsFile, { force: true });
  }
}

function createApplicant({ email, password, poolId }, options) {
  aws([
    'cognito-idp', 'admin-create-user', '--user-pool-id', poolId, '--username', email,
    '--message-action', 'SUPPRESS', '--user-attributes',
    `Name=email,Value=${email}`, 'Name=email_verified,Value=true',
    'Name=given_name,Value=CFA', 'Name=family_name,Value=SigningSmoke',
  ], options);
  aws([
    'cognito-idp', 'admin-set-user-password', '--user-pool-id', poolId,
    '--username', email, '--password', password, '--permanent',
  ], options);
  const user = awsJson([
    'cognito-idp', 'admin-get-user', '--user-pool-id', poolId, '--username', email,
  ], options);
  const sub = (user.UserAttributes || []).find(attribute => attribute.Name === 'sub')?.Value;
  if (!sub) throw new Error('TEST Cognito user did not return a sub');
  return sub;
}

function deleteApplicant(email, poolId, options) {
  if (!email || !poolId) return;
  try {
    aws(['cognito-idp', 'admin-delete-user', '--user-pool-id', poolId, '--username', email], options);
  } catch (error) {
    if (!/UserNotFoundException/u.test(String(error.stderr || error.message || error))) throw error;
  }
}

function randomPassword() {
  return `CfaTest-${crypto.randomBytes(8).toString('hex')}Aa1!`;
}

function parseSmokeJson(stdout) {
  const text = String(stdout || '').trim();
  const start = text.indexOf('{');
  if (start < 0) throw new Error(`TEST smoke emitted no JSON: ${text.slice(0, 1000)}`);
  return JSON.parse(text.slice(start));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const identity = awsJson(['sts', 'get-caller-identity'], options);
  if (identity?.Account !== EXPECTED_AWS_ACCOUNT || identity?.Arn !== EXPECTED_AWS_ARN) {
    throw new Error(`AWS identity did not match authorized TEST operator ${EXPECTED_AWS_ARN}`);
  }
  if (!fs.existsSync(options.portalEnv)) throw new Error(`Portal TEST env not found: ${options.portalEnv}`);
  const portalEnv = readEnvFile(options.portalEnv);
  const poolId = portalEnv.COGNITO_USER_POOL_ID;
  if (!poolId) throw new Error('COGNITO_USER_POOL_ID not found in portal TEST env');

  const suffix = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const applicant = {
    email: `cfa-signing-test-${suffix}@example.test`,
    password: randomPassword(),
    sub: null,
  };
  const sourceScript = path.resolve(__dirname, '..', '..', 'ISET-intake', 'scripts', 'cfa-signing-smoke.js');
  if (!fs.existsSync(sourceScript)) throw new Error(`CFA signing smoke source not found: ${sourceScript}`);
  const remoteKey = `ssm-scripts/cfa-signing-smoke-${suffix}.js`;
  const remotePath = `/opt/nwac/portal/scripts/cfa-signing-smoke-${suffix}.js`;
  const instanceId = discoverInstanceId(options);
  const remoteAwsIdentity = await discoverVerifiedTestInstanceAwsIdentity({
    expectedAccountId: EXPECTED_AWS_ACCOUNT,
    issueCommand: commands => sendCommand(instanceId, commands, options),
    waitForCommand: commandId => waitForCommand(instanceId, commandId, options),
  });
  let report = null;
  let scriptUploaded = false;
  try {
    const preflightCommandId = sendCommand(instanceId, [
      'set -euo pipefail',
      `test "$(aws sts get-caller-identity --query Arn --output text --region ${shellQuote(options.region)})" = ${shellQuote(remoteAwsIdentity.arn)}`,
      [
        'node', shellQuote('/opt/nwac/admin-dashboard/scripts/cfa-signing-schema-preflight.js'),
        '--env-file', shellQuote('/opt/nwac/portal/.env.test'),
        '--expected-database', shellQuote('iset_intake'),
        '--expected-db-host', shellQuote(EXPECTED_TEST_DB_HOST),
        '--expected-db-user', shellQuote(EXPECTED_TEST_DB_USER),
        '--expected-db-server-hostname', shellQuote(EXPECTED_TEST_DB_SERVER_HOSTNAME),
        '--expected-db-port', shellQuote(EXPECTED_TEST_DB_PORT),
        '--expected-db-principal', shellQuote(EXPECTED_TEST_DB_PRINCIPAL),
        '--expected-db-version', shellQuote(EXPECTED_TEST_DB_VERSION),
        '--json',
      ].join(' '),
    ], options);
    const preflightInvocation = waitForCommand(instanceId, preflightCommandId, options);
    if (preflightInvocation.Status !== 'Success') {
      throw new Error(`Remote TEST schema preflight failed (${preflightInvocation.Status}): ${String(preflightInvocation.Stderr || preflightInvocation.Stdout || '').slice(0, 4000)}`);
    }
    const preflight = parseSmokeJson(preflightInvocation.Stdout);
    if (preflight.status !== 'PASS' || Number(preflight.verifiedStatementCount) !== 0) {
      throw new Error(`Remote TEST schema preflight did not fail closed: ${JSON.stringify(preflight).slice(0, 1000)}`);
    }

    applicant.sub = createApplicant({ ...applicant, poolId }, options);
    aws(['s3', 'cp', sourceScript, `s3://${options.bucket}/${remoteKey}`, '--only-show-errors'], options);
    scriptUploaded = true;
    const commands = [
      'set -euo pipefail',
      'mkdir -p /opt/nwac/portal/scripts',
      `aws s3 cp ${shellQuote(`s3://${options.bucket}/${remoteKey}`)} ${shellQuote(remotePath)} --region ${shellQuote(options.region)} --only-show-errors`,
      `trap 'rm -f ${shellQuote(remotePath)}' EXIT`,
      'cd /opt/nwac/portal',
      [
        'node', shellQuote(remotePath),
        '--env-file', shellQuote('/opt/nwac/portal/.env.test'),
        '--base-url', shellQuote('http://127.0.0.1:5000'),
        '--expected-database', shellQuote('iset_intake'),
        '--expected-db-host', shellQuote(EXPECTED_TEST_DB_HOST),
        '--expected-db-user', shellQuote(EXPECTED_TEST_DB_USER),
        '--expected-db-server-hostname', shellQuote(EXPECTED_TEST_DB_SERVER_HOSTNAME),
        '--expected-db-port', shellQuote(EXPECTED_TEST_DB_PORT),
        '--expected-db-principal', shellQuote(EXPECTED_TEST_DB_PRINCIPAL),
        '--expected-db-version', shellQuote(EXPECTED_TEST_DB_VERSION),
        '--expected-aws-account', shellQuote(EXPECTED_AWS_ACCOUNT),
        '--expected-aws-arn', shellQuote(remoteAwsIdentity.arn),
        '--applicant-email', shellQuote(applicant.email),
        '--applicant-password', shellQuote(applicant.password),
        '--applicant-sub', shellQuote(applicant.sub),
        '--json',
      ].join(' '),
    ];
    const commandId = sendCommand(instanceId, commands, options);
    const invocation = waitForCommand(instanceId, commandId, options);
    if (invocation.Status !== 'Success') {
      throw new Error(`Remote TEST smoke failed (${invocation.Status}): ${String(invocation.Stderr || invocation.Stdout || '').slice(0, 4000)}`);
    }
    report = parseSmokeJson(invocation.Stdout);
    if (!report.ok) throw new Error('Remote TEST CFA signing smoke returned ok=false');
    report.test = {
      instanceId,
      commandId,
      preflightCommandId,
      preflight,
      operatorArn: identity.Arn,
    };
  } finally {
    if (scriptUploaded) {
      try {
        aws(['s3', 'rm', `s3://${options.bucket}/${remoteKey}`, '--only-show-errors'], options);
      } catch (_) {}
    }
    if (applicant.sub) deleteApplicant(applicant.email, poolId, options);
  }

  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const check of report.checks || []) console.log(`[PASS] ${check}`);
    console.log('[PASS] TEST fixture, Cognito identity, and object cleaned up');
  }
}

main().catch(error => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
