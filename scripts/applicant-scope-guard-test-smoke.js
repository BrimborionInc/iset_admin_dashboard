#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createLiveSchemaGuard } = require('./two-step-review-test-smoke');
const { discoverVerifiedTestInstanceAwsIdentity } = require('./lib/test-instance-aws-identity');

const EXPECTED_AWS_ACCOUNT = '124355655255';
const EXPECTED_AWS_ARN = 'arn:aws:iam::124355655255:user/CODEX_CLI_Admin';
const DEFAULT_PROFILE = 'nwac-test';
const DEFAULT_REGION = 'ca-central-1';
const DEFAULT_BUCKET = 'nwac-test-artifacts';
const DEFAULT_PORTAL_ENV = path.resolve(__dirname, '..', '..', 'ISET-intake', '.env.test');
const DEFAULT_ADMIN_ENV = path.resolve(__dirname, '..', '.env.test');
const DEFAULT_PUBLIC_API_ORIGIN = 'https://nwac-public-test.awentech.ca';
const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:5000';
const EXPECTED_TEST_DATABASE = 'iset_intake';
const EXPECTED_TEST_DATABASE_HOSTNAME = 'ip-172-16-0-199';
const EXPECTED_TEST_DATABASE_PORT = 3306;
const EXPECTED_TEST_DATABASE_PRINCIPAL = 'app_admin@10.48.%';
const EXPECTED_TEST_DATABASE_VERSION = '8.0.42';

function parseArgs(argv) {
  const args = {
    profile: process.env.AWS_PROFILE || DEFAULT_PROFILE,
    region: process.env.AWS_REGION || DEFAULT_REGION,
    bucket: process.env.APPLICANT_SCOPE_SMOKE_BUCKET || DEFAULT_BUCKET,
    instanceId: process.env.APPLICANT_SCOPE_SMOKE_INSTANCE_ID || '',
    portalEnv: process.env.APPLICANT_SCOPE_SMOKE_PORTAL_ENV || DEFAULT_PORTAL_ENV,
    adminEnv: process.env.APPLICANT_SCOPE_SMOKE_ADMIN_ENV || DEFAULT_ADMIN_ENV,
    keepFixture: false,
    skipBrowser: false,
    privacyDenials: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--profile') args.profile = argv[++index];
    else if (token === '--region') args.region = argv[++index];
    else if (token === '--bucket') args.bucket = argv[++index];
    else if (token === '--instance-id') args.instanceId = argv[++index];
    else if (token === '--portal-env') args.portalEnv = argv[++index];
    else if (token === '--admin-env') args.adminEnv = argv[++index];
    else if (token === '--keep-fixture') {
      throw new Error('--keep-fixture is disabled: release smoke must prove zero TEST residue.');
    }
    else if (token === '--skip-browser') args.skipBrowser = true;
    else if (token === '--privacy-denials') args.privacyDenials = true;
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

function usage() {
  console.log([
    'Usage: node scripts/applicant-scope-guard-test-smoke.js [options]',
    '',
    'Creates temporary TEST Cognito applicant users, seeds a wrong-applicant',
    'case/application fixture on a TEST app host, exercises the deployed public',
    'portal through authenticated API checks and Puppeteer, then cleans up.',
    '',
    'Options:',
    '  --instance-id ID   Run on a specific online nwac-test-app instance.',
    '  --profile NAME     AWS profile. Default: nwac-test.',
    '  --region REGION    AWS region. Default: ca-central-1.',
    '  --bucket NAME      Temporary S3 bucket. Default: nwac-test-artifacts.',
    '  --portal-env PATH  Portal .env.test used for applicant pool values.',
    '  --admin-env PATH   Admin .env.test used for staff pool values.',
    '  --skip-browser     Run API/data checks only.',
    '  --privacy-denials  Provision staff identities and run strict live denials before cleanup.',
    '  --json             Emit JSON summary.',
  ].join('\n'));
}

function readEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equals = trimmed.indexOf('=');
    if (equals < 0) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function aws(args, options) {
  const allArgs = [
    ...args,
    '--region',
    options.region,
    '--profile',
    options.profile,
  ];
  return execFileSync('aws', allArgs, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
}

function awsJson(args, options) {
  const out = aws([...args, '--output', 'json'], options).trim();
  return out ? JSON.parse(out) : null;
}

function awsText(args, options) {
  return aws([...args, '--output', 'text'], options).trim();
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function randomSuffix() {
  return crypto.randomBytes(5).toString('hex');
}

function randomPassword() {
  return `Scope#${crypto.randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}aA1!`;
}

function discoverInstanceId(options) {
  if (options.instanceId) return options.instanceId;
  const online = new Set(
    awsText([
      'ssm',
      'describe-instance-information',
      '--query',
      'InstanceInformationList[?PingStatus==`Online`].InstanceId',
    ], options)
      .split(/\s+/)
      .filter(Boolean)
  );
  const running = awsText([
    'ec2',
    'describe-instances',
    '--filters',
    'Name=tag:Name,Values=nwac-test-app',
    'Name=instance-state-name,Values=running',
    '--query',
    'Reservations[].Instances[].InstanceId',
  ], options)
    .split(/\s+/)
    .filter(Boolean);
  const match = running.find(instanceId => online.has(instanceId));
  if (!match) throw new Error('No online SSM-managed nwac-test-app instance found.');
  return match;
}

function createCognitoUser({ email, password, givenName, familyName, poolId }, options) {
  aws([
    'cognito-idp',
    'admin-create-user',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--message-action',
    'SUPPRESS',
    '--user-attributes',
    `Name=email,Value=${email}`,
    'Name=email_verified,Value=true',
    `Name=preferred_username,Value=${email}`,
    `Name=given_name,Value=${givenName}`,
    `Name=family_name,Value=${familyName}`,
  ], options);
  aws([
    'cognito-idp',
    'admin-set-user-password',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--password',
    password,
    '--permanent',
  ], options);
  const user = awsJson([
    'cognito-idp',
    'admin-get-user',
    '--user-pool-id',
    poolId,
    '--username',
    email,
  ], options);
  const sub = (user.UserAttributes || []).find(attribute => attribute.Name === 'sub')?.Value;
  if (!sub) throw new Error(`Unable to resolve Cognito sub for ${email}`);
  return sub;
}

function createStaffCognitoUser({ email, password, givenName, familyName, poolId, groupName }, options) {
  const sub = createCognitoUser({ email, password, givenName, familyName, poolId }, options);
  aws([
    'cognito-idp',
    'admin-add-user-to-group',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--group-name',
    groupName,
  ], options);
  return sub;
}

function authenticateStaffUser({ email, password, poolId, clientId }, options) {
  const flows = [
    ['admin-initiate-auth', 'ADMIN_USER_PASSWORD_AUTH', ['--user-pool-id', poolId]],
    ['initiate-auth', 'USER_PASSWORD_AUTH', []],
  ];
  const errors = [];
  for (const [command, flow, extraArgs] of flows) {
    try {
      const response = awsJson([
        'cognito-idp', command, ...extraArgs,
        '--client-id', clientId,
        '--auth-flow', flow,
        '--auth-parameters', `USERNAME=${email},PASSWORD=${password}`,
      ], options);
      const auth = response?.AuthenticationResult;
      if (response?.ChallengeName || !auth?.IdToken || !auth?.AccessToken) {
        throw new Error(`Cognito authentication did not return tokens${response?.ChallengeName ? ` (${response.ChallengeName})` : ''}`);
      }
      return { idToken: auth.IdToken, accessToken: auth.AccessToken };
    } catch (error) {
      errors.push(String(error.stderr || error.message || error).split('\n')[0]);
    }
  }
  throw new Error(`Unable to authenticate TEST staff user ${email}: ${errors.join('; ')}`);
}

function deleteCognitoUser({ email, poolId }, options) {
  try {
    aws([
      'cognito-idp',
      'admin-delete-user',
      '--user-pool-id',
      poolId,
      '--username',
      email,
    ], options);
  } catch (error) {
    const message = String(error.stderr || error.message || error);
    if (!/UserNotFoundException/.test(message)) {
      console.warn(`[applicant-scope-smoke] Cognito cleanup warning for ${email}: ${message.split('\n')[0]}`);
    }
  }
}

function sendRemoteCommand(instanceId, commandLines, comment, options) {
  const paramsFile = path.join(os.tmpdir(), `applicant-scope-params-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(paramsFile, JSON.stringify({ commands: commandLines }), 'utf8');
  try {
    return awsText([
      'ssm',
      'send-command',
      '--instance-ids',
      instanceId,
      '--document-name',
      'AWS-RunShellScript',
      '--parameters',
      `file://${paramsFile}`,
      '--comment',
      comment,
      '--query',
      'Command.CommandId',
    ], options);
  } finally {
    fs.rmSync(paramsFile, { force: true });
  }
}

function waitForCommand(instanceId, commandId, options) {
  for (;;) {
    let invocation = null;
    try {
      invocation = awsJson([
        'ssm',
        'get-command-invocation',
        '--command-id',
        commandId,
        '--instance-id',
        instanceId,
        '--query',
        '{Status:Status,Stdout:StandardOutputContent,Stderr:StandardErrorContent}',
      ], options);
    } catch (_) {
      invocation = null;
    }
    const status = invocation?.Status || '';
    if (['Pending', 'InProgress', 'Delayed', ''].includes(status)) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500);
      continue;
    }
    return invocation;
  }
}

function parseRemoteResult(stdout) {
  const marker = '@@APPLICANT_SCOPE_SMOKE_RESULT@@';
  const index = String(stdout || '').lastIndexOf(marker);
  if (index < 0) return null;
  const jsonText = String(stdout).slice(index + marker.length).trim();
  try {
    return JSON.parse(jsonText);
  } catch (_) {
    return null;
  }
}

function summarizeResult(result) {
  const rows = [];
  for (const item of result?.checks || []) {
    rows.push(`${item.status.padEnd(4)} ${item.name}`);
  }
  return rows.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  options.bucket = options.bucket || DEFAULT_BUCKET;
  if (options.region !== DEFAULT_REGION) {
    throw new Error(`Region ${options.region} did not match expected TEST region ${DEFAULT_REGION}.`);
  }
  if (options.bucket !== DEFAULT_BUCKET) {
    throw new Error(`Staging bucket ${options.bucket} did not match expected TEST artifact bucket ${DEFAULT_BUCKET}.`);
  }
  const identity = awsJson(['sts', 'get-caller-identity'], options);
  if (identity?.Account !== EXPECTED_AWS_ACCOUNT || identity?.Arn !== EXPECTED_AWS_ARN) {
    throw new Error(
      `AWS identity ${identity?.Account || 'unknown'} / ${identity?.Arn || 'unknown'} did not match the authorized TEST operator.`
    );
  }
  if (!fs.existsSync(options.portalEnv)) {
    throw new Error(`Portal env file not found: ${options.portalEnv}`);
  }
  const portalEnv = readEnvFile(options.portalEnv);
  const poolId =
    portalEnv.COGNITO_APPLICANT_USER_POOL_ID ||
    portalEnv.COGNITO_PORTAL_USER_POOL_ID ||
    portalEnv.COGNITO_USER_POOL_ID;
  if (!poolId) throw new Error('COGNITO_USER_POOL_ID not found in portal env.');
  const expectedDbName = String(portalEnv.DB_NAME || '').trim();
  const expectedDbHost = String(portalEnv.DB_HOST || '').trim();
  const expectedDbUser = String(portalEnv.DB_USER || '').trim();
  const expectedDbPort = Number(portalEnv.DB_PORT || 3306);
  if (
    expectedDbName !== EXPECTED_TEST_DATABASE ||
    !expectedDbHost ||
    !expectedDbUser ||
    expectedDbPort !== EXPECTED_TEST_DATABASE_PORT
  ) {
    throw new Error('Portal TEST database target did not match the exact expected release-smoke target.');
  }

  let staffPoolId = '';
  let staffClientId = '';
  if (options.privacyDenials) {
    if (!fs.existsSync(options.adminEnv)) throw new Error(`Admin env file not found: ${options.adminEnv}`);
    const adminEnv = readEnvFile(options.adminEnv);
    staffPoolId = adminEnv.COGNITO_STAFF_USER_POOL_ID || adminEnv.COGNITO_USER_POOL_ID || '';
    staffClientId = adminEnv.COGNITO_STAFF_CLIENT_ID || adminEnv.COGNITO_CLIENT_ID || adminEnv.REACT_APP_COGNITO_CLIENT_ID || '';
    if (!staffPoolId || !staffClientId) throw new Error('Staff Cognito pool/client not found in admin env.');
  }

  const suffix = randomSuffix();
  const stamp = `scope-${Date.now()}-${suffix}`;
  const applicantA = {
    label: 'rightful',
    email: `codex.portal.scope.${suffix}.rightful@example.com`,
    password: randomPassword(),
    givenName: 'Scope',
    familyName: `Rightful ${suffix}`,
  };
  const applicantB = {
    label: 'wrong',
    email: `codex.portal.scope.${suffix}.wrong@example.com`,
    password: randomPassword(),
    givenName: 'Scope',
    familyName: `Wrong ${suffix}`,
  };
  const staffUsers = options.privacyDenials ? [
    {
      key: 'coordinator',
      email: `codex.portal.scope.${suffix}.coord@example.com`,
      password: randomPassword(),
      givenName: 'Scope',
      familyName: `Coordinator ${suffix}`,
      role: 'ISET Coordinator',
      groupName: 'ISET_Coordinator',
    },
    {
      key: 'decisionMaker',
      email: `codex.portal.scope.${suffix}.decision@example.com`,
      password: randomPassword(),
      givenName: 'Scope',
      familyName: `Decision ${suffix}`,
      role: 'NWAC Administrator',
      groupName: 'NWAC_Administrator',
    },
  ] : [];
  const createdUsers = [];
  let result = null;

  try {
    console.log('[applicant-scope-smoke] Discovering TEST app instance...');
    const instanceId = discoverInstanceId(options);
    const remoteAwsIdentity = await discoverVerifiedTestInstanceAwsIdentity({
      expectedAccountId: EXPECTED_AWS_ACCOUNT,
      issueCommand: (commands, comment) => sendRemoteCommand(instanceId, commands, comment, options),
      waitForCommand: commandId => waitForCommand(instanceId, commandId, options),
    });
    console.log(`[applicant-scope-smoke] Using ${instanceId}`);

    const runRemote = ({ preflightOnly }) => {
      const commandLines = [
        'set -euo pipefail',
        `test "$(aws sts get-caller-identity --query Arn --output text --region ${shellQuote(options.region)})" = ${shellQuote(remoteAwsIdentity.arn)}`,
        'cd /opt/nwac/portal',
        [
          `FIXTURE_STAMP=${shellQuote(preflightOnly ? `${stamp}-preflight` : stamp)}`,
          `SCHEMA_PREFLIGHT_ONLY=${preflightOnly ? '1' : '0'}`,
          `APPLICANT_SCOPE_EXPECTED_DB_NAME=${shellQuote(expectedDbName)}`,
          `APPLICANT_SCOPE_EXPECTED_DB_HOST=${shellQuote(expectedDbHost)}`,
          `APPLICANT_SCOPE_EXPECTED_DB_USER=${shellQuote(expectedDbUser)}`,
          `APPLICANT_SCOPE_EXPECTED_DB_SERVER_HOSTNAME=${shellQuote(EXPECTED_TEST_DATABASE_HOSTNAME)}`,
          `APPLICANT_SCOPE_EXPECTED_DB_PORT=${shellQuote(expectedDbPort)}`,
          `APPLICANT_SCOPE_EXPECTED_DB_PRINCIPAL=${shellQuote(EXPECTED_TEST_DATABASE_PRINCIPAL)}`,
          `APPLICANT_SCOPE_EXPECTED_DB_VERSION=${shellQuote(EXPECTED_TEST_DATABASE_VERSION)}`,
          `KEEP_FIXTURE=0`,
          `RUN_BROWSER=${options.skipBrowser ? '0' : '1'}`,
          `RUN_PRIVACY_DENIALS=${options.privacyDenials ? '1' : '0'}`,
          `PRIVACY_STAFF_USERS_JSON=${shellQuote(preflightOnly ? '[]' : JSON.stringify(staffUsers.map(user => ({
            key: user.key,
            email: user.email,
            sub: user.sub,
            role: user.role,
            session: user.session,
          }))))}`,
          `PORTAL_LOCAL_BASE_URL=${shellQuote(DEFAULT_LOCAL_BASE_URL)}`,
          `PUBLIC_API_ORIGIN=${shellQuote(DEFAULT_PUBLIC_API_ORIGIN)}`,
          ...(preflightOnly ? [] : [
            `APPLICANT_A_EMAIL=${shellQuote(applicantA.email)}`,
            `APPLICANT_A_PASSWORD=${shellQuote(applicantA.password)}`,
            `APPLICANT_A_SUB=${shellQuote(applicantA.sub)}`,
            `APPLICANT_B_EMAIL=${shellQuote(applicantB.email)}`,
            `APPLICANT_B_PASSWORD=${shellQuote(applicantB.password)}`,
            `APPLICANT_B_SUB=${shellQuote(applicantB.sub)}`,
          ]),
          `node ${shellQuote('/opt/nwac/admin-dashboard/scripts/applicant-scope-guard-test-smoke.js')} --remote-runner`,
        ].join(' '),
      ];
      const commandId = sendRemoteCommand(
        instanceId,
        commandLines,
        preflightOnly
          ? 'Codex applicant scope guard TEST schema preflight'
          : 'Codex applicant scope guard TEST smoke',
        options
      );
      console.log(`[applicant-scope-smoke] SSM command ${commandId}`);
      const invocation = waitForCommand(instanceId, commandId, options);
      const remoteResult = parseRemoteResult(invocation?.Stdout);
      if (invocation?.Status !== 'Success') {
        const stderr = invocation?.Stderr ? `\n${invocation.Stderr}` : '';
        throw new Error(`Remote smoke failed with status ${invocation?.Status || 'unknown'}${stderr}`);
      }
      if (!remoteResult) {
        throw new Error(`Remote smoke finished but did not emit a parseable result.\n${invocation?.Stdout || ''}`);
      }
      const failures = (remoteResult.checks || []).filter(check => check.status === 'FAIL');
      if (failures.length) throw new Error(`${failures.length} applicant scope smoke check(s) failed.`);
      return remoteResult;
    };

    console.log('[applicant-scope-smoke] Proving TEST target and live schema before creating any fixture...');
    const preflight = runRemote({ preflightOnly: true });
    if (!preflight?.schemaSafety?.preflightComplete) {
      throw new Error('Remote TEST schema preflight did not return complete live-DDL evidence.');
    }

    console.log('[applicant-scope-smoke] Creating temporary TEST applicant Cognito users...');
    applicantA.sub = createCognitoUser({ ...applicantA, poolId }, options);
    createdUsers.push(applicantA);
    applicantB.sub = createCognitoUser({ ...applicantB, poolId }, options);
    createdUsers.push(applicantB);
    for (const user of staffUsers) {
      user.poolId = staffPoolId;
      user.sub = createStaffCognitoUser({ ...user, poolId: staffPoolId }, options);
      user.session = authenticateStaffUser({ ...user, poolId: staffPoolId, clientId: staffClientId }, options);
      createdUsers.push(user);
    }
    console.log('[applicant-scope-smoke] Running deployed TEST portal smoke through SSM...');
    result = runRemote({ preflightOnly: false });
    if (!options.json) {
      console.log(summarizeResult(result));
      console.log(`[applicant-scope-smoke] Fixture IDs: ${JSON.stringify(result.fixtureIds)}`);
    }
  } finally {
    if (!options.keepFixture) {
      for (const user of createdUsers.reverse()) {
        deleteCognitoUser({ email: user.email, poolId: user.poolId || poolId }, options);
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

function remoteRunner() {
  'use strict';

  const fs = require('fs');
  const path = require('path');
  const { createRequire } = require('module');
  const { spawnSync } = require('child_process');
  const portalRequire = createRequire('/opt/nwac/portal/package.json');
  const mysql = portalRequire('mysql2/promise');

  try {
    portalRequire('dotenv').config({ path: '/opt/nwac/portal/.env.test' });
    portalRequire('dotenv').config({ path: '/opt/nwac/portal/.env' });
  } catch (_) {
    // The deployed process has these envs; dotenv is only for ad hoc SSM runs.
  }

  const result = {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    checks: [],
    fixtureIds: {},
    cleanup: null,
    schemaSafety: null,
  };

  const preflightOnly = process.env.SCHEMA_PREFLIGHT_ONLY === '1';
  const config = {
    stamp: requiredEnv('FIXTURE_STAMP'),
    preflightOnly,
    keepFixture: process.env.KEEP_FIXTURE === '1',
    runBrowser: process.env.RUN_BROWSER !== '0',
    runPrivacyDenials: process.env.RUN_PRIVACY_DENIALS === '1',
    privacyStaffUsers: JSON.parse(process.env.PRIVACY_STAFF_USERS_JSON || '[]'),
    localBaseUrl: stripTrailingSlash(process.env.PORTAL_LOCAL_BASE_URL || 'http://127.0.0.1:5000'),
    publicApiOrigin: stripTrailingSlash(process.env.PUBLIC_API_ORIGIN || 'https://nwac-public-test.awentech.ca'),
    expectedDatabase: requiredEnv('APPLICANT_SCOPE_EXPECTED_DB_NAME'),
    expectedDbHost: requiredEnv('APPLICANT_SCOPE_EXPECTED_DB_HOST'),
    expectedDbUser: requiredEnv('APPLICANT_SCOPE_EXPECTED_DB_USER'),
    expectedDbServerHostname: requiredEnv('APPLICANT_SCOPE_EXPECTED_DB_SERVER_HOSTNAME'),
    expectedDbPort: Number(requiredEnv('APPLICANT_SCOPE_EXPECTED_DB_PORT')),
    expectedDbPrincipal: requiredEnv('APPLICANT_SCOPE_EXPECTED_DB_PRINCIPAL'),
    expectedDbVersion: requiredEnv('APPLICANT_SCOPE_EXPECTED_DB_VERSION'),
    applicantA: preflightOnly ? null : {
      email: requiredEnv('APPLICANT_A_EMAIL'),
      password: requiredEnv('APPLICANT_A_PASSWORD'),
      sub: requiredEnv('APPLICANT_A_SUB'),
    },
    applicantB: preflightOnly ? null : {
      email: requiredEnv('APPLICANT_B_EMAIL'),
      password: requiredEnv('APPLICANT_B_PASSWORD'),
      sub: requiredEnv('APPLICANT_B_SUB'),
    },
  };

  const REQUIRED_TABLES = Object.freeze([
    'canada_region',
    'client',
    'input_json_state',
    'iset_application',
    'iset_application_draft_dynamic',
    'iset_application_file',
    'iset_application_submission',
    'iset_case',
    'iset_case_intervention',
    'iset_document',
    'message_item',
    'message_signing_request',
    'messages',
    'payment_packet',
    'pending_uploads',
    'signing_request',
    'staff_profiles',
    'staff_region',
    'user',
  ]);

  const fixture = {
    suffix: config.stamp.replace(/[^a-zA-Z0-9]+/g, '').slice(-12),
    marker: { fixture: 'applicant-scope-guard-smoke', stamp: config.stamp },
    refs: {},
  };

  let connection = null;
  let schemaGuard = null;
  let seeded = false;
  let fixtureMutationStarted = false;
  let cleanupSuppressedForSchemaSafety = false;

  main()
    .then(() => {
      result.status = result.checks.some(check => check.status === 'FAIL') ? 'failed' : 'passed';
      result.finishedAt = new Date().toISOString();
      console.log('@@APPLICANT_SCOPE_SMOKE_RESULT@@' + JSON.stringify(result));
      if (result.status !== 'passed') process.exitCode = 1;
    })
    .catch(error => {
      fail('remote runner completed without crashing', {
        error: error && error.stack ? error.stack : String(error),
      });
      result.status = 'failed';
      result.finishedAt = new Date().toISOString();
      console.log('@@APPLICANT_SCOPE_SMOKE_RESULT@@' + JSON.stringify(result));
      process.exitCode = 1;
    });

  async function main() {
    progress('remote runner starting');
    connection = await mysql.createConnection(dbConfig());
    progress('db connected');
    try {
      schemaGuard = createLiveSchemaGuard({
        connection,
        expectedDatabase: config.expectedDatabase,
        expectedHost: config.expectedDbHost,
        expectedUser: config.expectedDbUser,
        expectedDatabaseHostname: config.expectedDbServerHostname,
        expectedPort: config.expectedDbPort,
        expectedPrincipal: config.expectedDbPrincipal,
        expectedVersion: config.expectedDbVersion,
        configuredDatabase: requiredEnv('DB_NAME'),
        configuredHost: requiredEnv('DB_HOST'),
        configuredUser: requiredEnv('DB_USER'),
        configuredPort: Number(process.env.DB_PORT || 3306),
        requiredTables: REQUIRED_TABLES,
        cryptoModule: require('crypto'),
      });
      result.schemaSafety = await schemaGuard.preflight();
      pass('TEST DB identity and live schema preflight proved', {
        identity: result.schemaSafety.identity,
        ddlHashes: result.schemaSafety.ddlHashes,
      });
      if (config.preflightOnly) return;
      fixtureMutationStarted = true;
      await seedFixture();
      seeded = true;
      progress('fixture seeded');
      await runApiChecks();
      progress('api checks complete');
      if (config.runBrowser) {
        await runBrowserChecks();
        progress('browser checks complete');
      } else {
        skip('browser dashboard/messages smoke skipped by operator option');
        progress('browser checks skipped');
      }
      if (config.runPrivacyDenials) {
        await runPrivacyDenialChecks();
        progress('privacy denial checks complete');
      }
      if (config.keepFixture) {
        result.cleanup = 'kept';
        progress('fixture kept');
      }
    } catch (error) {
      const code = String(error?.code || '');
      cleanupSuppressedForSchemaSafety =
        !fixtureMutationStarted && (
          code.startsWith('schema_guard_') ||
          String(error?.message || '').startsWith('schema_guard_')
        );
      throw error;
    } finally {
      if (!config.keepFixture && fixtureMutationStarted && !cleanupSuppressedForSchemaSafety) {
        await cleanupFixture();
        progress('fixture cleaned up');
      } else if (cleanupSuppressedForSchemaSafety) {
        result.cleanup = 'suppressed_after_schema_safety_failure';
      }
      if (schemaGuard) result.schemaSafety = schemaGuard.evidence();
      if (connection) {
        await connection.end();
        progress('db connection closed');
      }
    }
  }

  function progress(message) {
    const line = `${new Date().toISOString()} ${message}\n`;
    try {
      fs.appendFileSync(`/tmp/applicant-scope-smoke-${config.stamp}.progress.log`, line, 'utf8');
    } catch (_) {
      // Progress breadcrumbs are diagnostic only.
    }
  }

  function requiredEnv(key) {
    const value = String(process.env[key] || '').trim();
    if (!value) throw new Error(`Missing env ${key}`);
    return value;
  }

  function stripTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
  }

  function dbConfig() {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'iset_intake',
      multipleStatements: false,
      connectTimeout: 10000,
    };
  }

  function addCheck(status, name, details = {}) {
    result.checks.push({ status, name, details });
  }

  function pass(name, details = {}) {
    addCheck('PASS', name, details);
  }

  function fail(name, details = {}) {
    addCheck('FAIL', name, details);
  }

  function skip(name, details = {}) {
    addCheck('SKIP', name, details);
  }

  function expect(name, condition, details = {}) {
    if (condition) pass(name, details);
    else fail(name, details);
  }

  async function query(sql, params = []) {
    if (!schemaGuard) throw new Error('schema_guard_not_initialized');
    return schemaGuard.execute(sql, params);
  }

  async function insert(sql, params = []) {
    const [res] = await query(sql, params);
    return Number(res.insertId);
  }

  function json(value) {
    return JSON.stringify(value);
  }

  async function seedFixture() {
    progress('seed cleanup starting');
    await cleanupFixture({ quiet: true });
    progress('seed cleanup complete');
    await query('START TRANSACTION');
    try {
      const suffix = fixture.suffix;
      fixture.staffEmail = `codex.portal.scope.${suffix}.staff@example.com`;
      fixture.staffSub = `scope-staff-${suffix}`;
      fixture.refs.applicantA = `SCOPEA-${suffix}`.slice(0, 32);
      fixture.refs.applicantB = `SCOPEB-${suffix}`.slice(0, 32);
      fixture.caseNumber = `SCOPE-${suffix}`.slice(0, 32);
      fixture.interventionTitle = `Scope guard plan ${suffix}`;
      fixture.subjectA = `Scope guard rightful message ${suffix}`;
      fixture.subjectB = `Scope guard stale message ${suffix}`;

      const [regionRows] = await query('SELECT region_id FROM canada_region ORDER BY region_id ASC LIMIT 2');
      if (!Array.isArray(regionRows) || regionRows.length < 2) throw new Error('TEST requires two canada_region rows for out-of-scope denial fixtures');
      fixture.staffRegionId = Number(regionRows[0].region_id);
      fixture.fixtureRegionId = Number(regionRows[1].region_id);
      fixture.privacyStaff = {};
      for (const user of config.privacyStaffUsers) {
        const displayName = `${user.role} Privacy ${suffix}`;
        const staffUserId = await insert(
          `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
           VALUES (?, ?, ?, 1, 0, 'en')`,
          [displayName, user.email, user.sub]
        );
        const staffProfileId = await insert(
          `INSERT INTO staff_profiles
             (cognito_sub, email, name, display_name, primary_role, status, region_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
          [user.sub, user.email, displayName, displayName, user.role, fixture.staffRegionId]
        );
        await query(
          `INSERT INTO staff_region (staff_profile_id, region_id) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE updated_at = NOW()`,
          [staffProfileId, fixture.staffRegionId]
        );
        fixture.privacyStaff[user.key] = { staffUserId, staffProfileId, email: user.email };
      }

      fixture.userA = await insert(
        `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
         VALUES (?, ?, ?, 1, 0, 'en')`,
        [`Scope Rightful ${suffix}`, config.applicantA.email, config.applicantA.sub]
      );
      fixture.userB = await insert(
        `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
         VALUES (?, ?, ?, 1, 0, 'en')`,
        [`Scope Wrong ${suffix}`, config.applicantB.email, config.applicantB.sub]
      );
      fixture.staffUser = await insert(
        `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
         VALUES (?, ?, ?, 1, 0, 'en')`,
        [`Scope Staff ${suffix}`, fixture.staffEmail, fixture.staffSub]
      );
      fixture.staffProfile = await insert(
        `INSERT INTO staff_profiles (cognito_sub, email, name, display_name, primary_role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'ISET Coordinator', 'active', NOW(), NOW())`,
        [fixture.staffSub, fixture.staffEmail, `Scope Staff ${suffix}`, `Scope Staff ${suffix}`]
      );
      progress('seed users and staff complete');
      fixture.clientA = await insert(
        `INSERT INTO client
           (first_name, last_name, applicant_cognito_sub, applicant_cognito_username, applicant_account_status, applicant_account_email, applicant_activated_at, address_json)
         VALUES (?, ?, ?, ?, 'activated', ?, NOW(), CAST(? AS JSON))`,
        ['Scope', `Rightful ${suffix}`, config.applicantA.sub, config.applicantA.email, config.applicantA.email, json({ fixture: fixture.marker })]
      );
      fixture.clientB = await insert(
        `INSERT INTO client
           (first_name, last_name, applicant_cognito_sub, applicant_cognito_username, applicant_account_status, applicant_account_email, applicant_activated_at, address_json)
         VALUES (?, ?, ?, ?, 'activated', ?, NOW(), CAST(? AS JSON))`,
        ['Scope', `Wrong ${suffix}`, config.applicantB.sub, config.applicantB.email, config.applicantB.email, json({ fixture: fixture.marker })]
      );
      fixture.caseA = await insert(
        `INSERT INTO iset_case
           (case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, stage, portfolio_region_id, opened_at, case_context_json)
         VALUES (?, ?, ?, 'active', 'active', 'scope_guard_smoke', ?, NOW(), CAST(? AS JSON))`,
        [fixture.caseNumber, fixture.clientA, fixture.staffProfile, fixture.fixtureRegionId, json({ ...fixture.marker, applicant: 'A' })]
      );
      progress('seed clients and case complete');

      const payloadA = {
        ...fixture.marker,
        applicant: 'A',
        answers: {
          firstName: 'Scope',
          lastName: `Rightful ${suffix}`,
          email: config.applicantA.email,
        },
      };
      const payloadB = {
        ...fixture.marker,
        applicant: 'B',
        answers: {
          firstName: 'Scope',
          lastName: `Wrong ${suffix}`,
          email: config.applicantB.email,
        },
      };

      fixture.submissionB = await insert(
        `INSERT INTO iset_application_submission
           (user_id, workflow_id, reference_number, status, submitted_at, intake_payload, schema_snapshot, history, doc_refs, locale)
         VALUES (?, 'iset-v1', ?, 'submitted', DATE_SUB(NOW(), INTERVAL 2 MINUTE), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), 'en')`,
        [fixture.userB, fixture.refs.applicantB, json(payloadB), json({ fixture: fixture.marker }), json([]), json([])]
      );
      fixture.wrongApplication = await insert(
        `INSERT INTO iset_application
           (submission_id, client_id, case_id, payload_json, status, lifecycle_status, decision_outcome, awaiting_reason, created_at, updated_at)
         VALUES (?, ?, ?, CAST(? AS JSON), 'approved', 'decision_recorded', 'approved', 'none', DATE_SUB(NOW(), INTERVAL 2 MINUTE), DATE_SUB(NOW(), INTERVAL 2 MINUTE))`,
        [fixture.submissionB, fixture.clientA, fixture.caseA, json(payloadB)]
      );
      fixture.submissionA = await insert(
        `INSERT INTO iset_application_submission
           (user_id, workflow_id, reference_number, status, submitted_at, intake_payload, schema_snapshot, history, doc_refs, locale)
         VALUES (?, 'iset-v1', ?, 'submitted', NOW(), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), 'en')`,
        [fixture.userA, fixture.refs.applicantA, json(payloadA), json({ fixture: fixture.marker }), json([]), json([])]
      );
      fixture.applicationA = await insert(
        `INSERT INTO iset_application
           (submission_id, client_id, case_id, payload_json, status, lifecycle_status, decision_outcome, awaiting_reason, created_at, updated_at)
         VALUES (?, ?, ?, CAST(? AS JSON), 'approved', 'decision_recorded', 'approved', 'none', NOW(), NOW())`,
        [fixture.submissionA, fixture.clientA, fixture.caseA, json(payloadA)]
      );
      progress('seed submissions and applications complete');
      fixture.intervention = await insert(
        `INSERT INTO iset_case_intervention
           (case_id, intervention_code, status, delivery_status, start_date, end_date, intervention_cost, budget_amount, approved_amount, notes, metadata_json, eligibility_result, funding_stream_decision, created_by_staff_profile_id)
         VALUES (?, 1, 'approved', 'planned', CURRENT_DATE(), DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY), 100.00, 100.00, 100.00, 'Synthetic applicant scope smoke intervention.', CAST(? AS JSON), 'eligible', 'CRF', ?)`,
        [fixture.caseA, json({ ...fixture.marker, title: fixture.interventionTitle }), fixture.staffProfile]
      );
      progress('seed intervention complete');
      fixture.messageA = await insert(
        `INSERT INTO messages
           (sender_actor_type, sender_user_id, sender_staff_profile_id, recipient_actor_type, recipient_user_id, recipient_staff_profile_id, case_id, application_id, subject, body, status, urgent, deleted, created_at)
         VALUES ('staff_profile', ?, ?, 'applicant_user', ?, NULL, ?, ?, ?, 'Rightful applicant message body.', 'unread', 1, 0, NOW())`,
        [fixture.staffUser, fixture.staffProfile, fixture.userA, fixture.caseA, fixture.applicationA, fixture.subjectA]
      );
      fixture.messageB = await insert(
        `INSERT INTO messages
           (sender_actor_type, sender_user_id, sender_staff_profile_id, recipient_actor_type, recipient_user_id, recipient_staff_profile_id, case_id, application_id, subject, body, status, urgent, deleted, created_at)
         VALUES ('staff_profile', ?, ?, 'applicant_user', ?, NULL, ?, ?, ?, 'Stale wrong-applicant message body.', 'unread', 1, 0, NOW())`,
        [fixture.staffUser, fixture.staffProfile, fixture.userB, fixture.caseA, fixture.applicationA, fixture.subjectB]
      );
      progress('seed messages complete');
      await query(
        `INSERT INTO message_item (message_id, owner_user_id, folder, folder_before_deleted, read_at, deleted_at, purged_at)
         VALUES (?, ?, 'inbox', NULL, NULL, NULL, NULL), (?, ?, 'inbox', NULL, NULL, NULL, NULL)`,
        [fixture.messageA, fixture.userA, fixture.messageB, fixture.userB]
      );
      progress('seed message items complete');

      fixture.portalDocument = await insert(
        `INSERT INTO iset_application_file
           (user_id, file_path, original_filename, document_type, status, virus_scan_status, detected_mime, scan_notes)
         VALUES (?, ?, ?, 'privacy_denial_smoke', 'clean', 'clean', 'text/plain', 'TEST privacy denial fixture')`,
        [fixture.userA, `privacy-denial-test/${config.stamp}/portal-document.txt`, `privacy-denial-${suffix}.txt`]
      );
      fixture.adminDocument = await insert(
        `INSERT INTO iset_document
           (user_id, applicant_user_id, client_id, application_id, case_id, source, file_name, file_path, mime_type, label, metadata, status, document_category, visibility)
         VALUES (?, ?, ?, ?, ?, 'manual_upload', ?, ?, 'application/pdf', 'TEST privacy denial fixture', CAST(? AS JSON), 'active', 'privacy_denial_smoke', 'internal')`,
        [fixture.staffUser, fixture.userA, fixture.clientA, fixture.applicationA, fixture.caseA,
          `privacy-denial-${suffix}.pdf`, `privacy-denial-test/${config.stamp}/admin-document.pdf`, json(fixture.marker)]
      );
      fixture.paymentPacket = await insert(
        `INSERT INTO payment_packet
           (case_id, client_id, reporting_unit, status, requester_user_id, notes_internal, metadata)
         VALUES (?, ?, 'privacy-denial-smoke', 'draft', ?, 'TEST privacy denial fixture', CAST(? AS JSON))`,
        [fixture.caseA, fixture.clientA, fixture.staffUser, json(fixture.marker)]
      );
      progress('seed strict denial fixtures complete');

      const signingSchema = {
        meta: { fixture: fixture.marker, title: 'Scope guard acknowledgement' },
        steps: [
          {
            id: 'acknowledgement',
            title: 'Scope guard acknowledgement',
            components: [
              {
                id: 'ack',
                type: 'content',
                text: 'Synthetic signing request for applicant scope smoke.',
              },
            ],
          },
        ],
      };
      fixture.signingA = await insert(
        `INSERT INTO signing_request
           (workflow_id, workflow_name, workflow_type, case_id, participant_user_id, created_by_user_id, status, due_at, resolved_schema_json, checklist_doc_type)
         VALUES (44, 'Client Acknowledgement of Funding Source', 'client_acknowledgement', ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY), CAST(? AS JSON), 'client_acknowledgement')`,
        [fixture.caseA, fixture.userA, fixture.staffUser, json(signingSchema)]
      );
      fixture.signingB = await insert(
        `INSERT INTO signing_request
           (workflow_id, workflow_name, workflow_type, case_id, participant_user_id, created_by_user_id, status, due_at, resolved_schema_json, checklist_doc_type)
         VALUES (44, 'Client Acknowledgement of Funding Source', 'client_acknowledgement', ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY), CAST(? AS JSON), 'client_acknowledgement')`,
        [fixture.caseA, fixture.userB, fixture.staffUser, json(signingSchema)]
      );
      progress('seed signing requests complete');
      await query(
        `INSERT INTO message_signing_request (message_id, signing_request_id)
         VALUES (?, ?), (?, ?)`,
        [fixture.messageA, fixture.signingA, fixture.messageB, fixture.signingB]
      );
      progress('seed signing links complete');

      await query('COMMIT');
      progress('seed transaction committed');
      result.fixtureIds = {
        userA: fixture.userA,
        userB: fixture.userB,
        clientA: fixture.clientA,
        clientB: fixture.clientB,
        caseA: fixture.caseA,
        applicationA: fixture.applicationA,
        wrongApplication: fixture.wrongApplication,
        messageA: fixture.messageA,
        messageB: fixture.messageB,
        signingA: fixture.signingA,
        signingB: fixture.signingB,
        intervention: fixture.intervention,
        portalDocument: fixture.portalDocument,
        adminDocument: fixture.adminDocument,
        paymentPacket: fixture.paymentPacket,
      };
      pass('TEST synthetic wrong-applicant fixture seeded', result.fixtureIds);
    } catch (error) {
      progress(`seed failed: ${error.message || String(error)}`);
      await query('ROLLBACK');
      throw error;
    }
  }

  async function cleanupFixture(options = {}) {
    const emails = [
      config.applicantA.email,
      config.applicantB.email,
      fixture.staffEmail || `codex.portal.scope.${fixture.suffix}.staff@example.com`,
    ];
    const markerLike = `%"stamp":"${config.stamp}"%`;
    let transactionStarted = false;
    try {
      progress('cleanup starting');
      await query('START TRANSACTION');
      transactionStarted = true;
      // Re-resolve exact smoke ownership inside the cleanup transaction instead
      // of trusting insert IDs retained from an earlier transaction.
      await cleanupByMarkerAndEmail({ emails, markerLike });
      const allEmails = [...emails, ...config.privacyStaffUsers.map(user => user.email)];
      const emailPlaceholders = allEmails.map(() => '?').join(',');
      const [residueRows] = await query(
        `SELECT
           (SELECT COUNT(*) FROM user u WHERE u.email IN (${emailPlaceholders})) AS \`user_rows\`,
           (SELECT COUNT(*) FROM staff_profiles sp WHERE sp.email IN (${emailPlaceholders})) AS \`staff_rows\`,
           (SELECT COUNT(*) FROM iset_case ic WHERE ic.case_context_json IS NOT NULL AND CAST(ic.case_context_json AS CHAR) LIKE ?) AS \`case_rows\`,
           (SELECT COUNT(*) FROM iset_application_file iaf WHERE iaf.file_path LIKE ?) AS \`portal_document_rows\`,
           (SELECT COUNT(*) FROM iset_document idoc WHERE idoc.file_path LIKE ?) AS \`admin_document_rows\`,
           (SELECT COUNT(*) FROM payment_packet pp WHERE CAST(COALESCE(pp.metadata, JSON_OBJECT()) AS CHAR) LIKE ?) AS \`payment_rows\``,
        [
          ...allEmails,
          ...allEmails,
          markerLike,
          `privacy-denial-test/${config.stamp}/%`,
          `privacy-denial-test/${config.stamp}/%`,
          markerLike,
        ]
      );
      const residue = residueRows?.[0] || {};
      const nonZeroResidue = Object.fromEntries(Object.entries(residue).filter(([, value]) => Number(value) !== 0));
      if (Object.keys(nonZeroResidue).length) throw new Error(`TEST fixture residue remains: ${JSON.stringify(nonZeroResidue)}`);
      await query('COMMIT');
      transactionStarted = false;
      if (!options.quiet) {
        result.cleanup = 'deleted';
        pass('TEST synthetic fixture cleaned up with zero residue', residue);
      }
      progress('cleanup complete');
    } catch (error) {
      if (transactionStarted) await query('ROLLBACK').catch(() => {});
      if (!options.quiet) {
        fail('TEST synthetic fixture cleaned up', { error: error.message || String(error) });
      }
      progress(`cleanup failed: ${error.message || String(error)}`);
      throw error;
    }
  }

  async function cleanupByFixtureIds() {
    const privacyStaffRows = Object.values(fixture.privacyStaff || {});
    const userIds = [fixture.userA, fixture.userB, fixture.staffUser, ...privacyStaffRows.map(row => row.staffUserId)].filter(Boolean);
    const privacyStaffProfileIds = privacyStaffRows.map(row => row.staffProfileId).filter(Boolean);
    const messageIds = [fixture.messageA, fixture.messageB].filter(Boolean);
    const signingIds = [fixture.signingA, fixture.signingB].filter(Boolean);
    progress('cleanup exact strict denial fixtures');
    if (fixture.paymentPacket) await query('DELETE FROM payment_packet WHERE id = ?', [fixture.paymentPacket]);
    if (fixture.adminDocument) await query('DELETE FROM iset_document WHERE id = ?', [fixture.adminDocument]);
    if (fixture.portalDocument) await query('DELETE FROM iset_application_file WHERE id = ?', [fixture.portalDocument]);
    progress('cleanup exact signing links');
    if (messageIds.length || signingIds.length) {
      await query(
        `DELETE FROM message_signing_request
          WHERE ${messageIds.length ? `message_id IN (${messageIds.map(() => '?').join(',')})` : 'FALSE'}
             OR ${signingIds.length ? `signing_request_id IN (${signingIds.map(() => '?').join(',')})` : 'FALSE'}`,
        [...messageIds, ...signingIds]
      );
    }
    progress('cleanup exact signing requests');
    if (signingIds.length) {
      await query(`DELETE FROM signing_request WHERE id IN (${signingIds.map(() => '?').join(',')})`, signingIds);
    }
    progress('cleanup exact message items');
    if (messageIds.length || userIds.length) {
      await query(
        `DELETE FROM message_item
          WHERE ${messageIds.length ? `message_id IN (${messageIds.map(() => '?').join(',')})` : 'FALSE'}
             OR ${userIds.length ? `owner_user_id IN (${userIds.map(() => '?').join(',')})` : 'FALSE'}`,
        [...messageIds, ...userIds]
      );
    }
    progress('cleanup exact messages');
    if (messageIds.length) {
      await query(`DELETE FROM messages WHERE id IN (${messageIds.map(() => '?').join(',')})`, messageIds);
    }
    progress('cleanup exact intervention');
    if (fixture.intervention) await query('DELETE FROM iset_case_intervention WHERE id = ?', [fixture.intervention]);
    progress('cleanup exact applications');
    const applicationIds = [fixture.wrongApplication, fixture.applicationA].filter(Boolean);
    if (applicationIds.length) {
      await query(`DELETE FROM iset_application WHERE id IN (${applicationIds.map(() => '?').join(',')})`, applicationIds);
    }
    progress('cleanup exact submissions');
    const submissionIds = [fixture.submissionB, fixture.submissionA].filter(Boolean);
    if (submissionIds.length) {
      await query(`DELETE FROM iset_application_submission WHERE id IN (${submissionIds.map(() => '?').join(',')})`, submissionIds);
    }
    progress('cleanup exact case');
    if (fixture.caseA) await query('DELETE FROM iset_case WHERE id = ?', [fixture.caseA]);
    progress('cleanup exact clients');
    const clientIds = [fixture.clientA, fixture.clientB].filter(Boolean);
    if (clientIds.length) {
      await query(`DELETE FROM client WHERE id IN (${clientIds.map(() => '?').join(',')})`, clientIds);
    }
    progress('cleanup exact staff profile');
    if (privacyStaffProfileIds.length) {
      await query(`DELETE FROM staff_region WHERE staff_profile_id IN (${privacyStaffProfileIds.map(() => '?').join(',')})`, privacyStaffProfileIds);
      await query(`DELETE FROM staff_profiles WHERE id IN (${privacyStaffProfileIds.map(() => '?').join(',')})`, privacyStaffProfileIds);
    }
    if (fixture.staffProfile) await query('DELETE FROM staff_profiles WHERE id = ?', [fixture.staffProfile]);
    progress('cleanup exact user dependents');
    if (userIds.length) {
      await query(`DELETE FROM input_json_state WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
      await query(`DELETE FROM iset_application_draft_dynamic WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
      await query(`DELETE FROM pending_uploads WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
    }
    progress('cleanup exact users');
    if (userIds.length) {
      await query(`DELETE FROM user WHERE id IN (${userIds.map(() => '?').join(',')})`, userIds);
    }
  }

  async function cleanupByMarkerAndEmail({ emails, markerLike }) {
    const privacyEmails = config.privacyStaffUsers.map(user => user.email);
    progress('cleanup fallback signing links');
    await query('DELETE FROM message_signing_request AS msr WHERE msr.signing_request_id IN (SELECT sr.id FROM signing_request AS sr WHERE sr.created_by_user_id IN (SELECT u.id FROM user AS u WHERE u.email IN (?, ?, ?)))', emails);
    await query('DELETE FROM message_signing_request AS msr WHERE msr.message_id IN (SELECT m.id FROM messages AS m WHERE m.subject IN (?, ?))', [fixture.subjectA || '', fixture.subjectB || '']);
    progress('cleanup fallback signing requests');
    await query('DELETE FROM signing_request AS sr WHERE sr.created_by_user_id IN (SELECT u.id FROM user AS u WHERE u.email IN (?, ?, ?)) OR sr.participant_user_id IN (SELECT u.id FROM user AS u WHERE u.email IN (?, ?, ?))', [...emails, ...emails]);
    progress('cleanup fallback messages');
    await query('DELETE FROM message_item AS mi WHERE mi.owner_user_id IN (SELECT u.id FROM user AS u WHERE u.email IN (?, ?, ?))', emails);
    await query('DELETE FROM messages AS m WHERE m.subject IN (?, ?) OR m.sender_user_id IN (SELECT u.id FROM user AS u WHERE u.email IN (?, ?, ?)) OR m.recipient_user_id IN (SELECT u.id FROM user AS u WHERE u.email IN (?, ?, ?))', [
      fixture.subjectA || '',
      fixture.subjectB || '',
      ...emails,
      ...emails,
    ]);
    progress('cleanup fallback app/case rows');
    await query("DELETE FROM payment_packet AS pp WHERE CAST(COALESCE(pp.metadata, JSON_OBJECT()) AS CHAR) LIKE ?", [markerLike]);
    await query("DELETE FROM iset_document AS idoc WHERE CAST(COALESCE(idoc.metadata, JSON_OBJECT()) AS CHAR) LIKE ? OR idoc.file_path LIKE ?", [markerLike, `privacy-denial-test/${config.stamp}/%`]);
    await query('DELETE FROM iset_application_file AS iaf WHERE iaf.file_path LIKE ?', [`privacy-denial-test/${config.stamp}/%`]);
    await query('DELETE FROM iset_case_intervention AS ici WHERE CAST(ici.metadata_json AS CHAR) LIKE ?', [markerLike]);
    await query('DELETE FROM iset_application AS ia WHERE CAST(ia.payload_json AS CHAR) LIKE ?', [markerLike]);
    await query('DELETE FROM iset_application_submission AS ias WHERE CAST(ias.intake_payload AS CHAR) LIKE ?', [markerLike]);
    await query('DELETE FROM iset_case AS ic WHERE ic.case_context_json IS NOT NULL AND CAST(ic.case_context_json AS CHAR) LIKE ?', [markerLike]);
    progress('cleanup fallback identity rows');
    await query('DELETE FROM client AS c WHERE c.applicant_account_email IN (?, ?) OR c.applicant_cognito_sub IN (?, ?)', [
      config.applicantA.email,
      config.applicantB.email,
      config.applicantA.sub,
      config.applicantB.sub,
    ]);
    await query('DELETE FROM staff_profiles AS sp WHERE sp.email = ? OR sp.cognito_sub = ?', [
      fixture.staffEmail || `codex.portal.scope.${fixture.suffix}.staff@example.com`,
      fixture.staffSub || `scope-staff-${fixture.suffix}`,
    ]);
    if (privacyEmails.length) {
      const placeholders = privacyEmails.map(() => '?').join(',');
      await query(`DELETE FROM staff_region AS sr WHERE sr.staff_profile_id IN (SELECT sp.id FROM staff_profiles AS sp WHERE sp.email IN (${placeholders}))`, privacyEmails);
      await query(`DELETE FROM staff_profiles AS sp WHERE sp.email IN (${placeholders})`, privacyEmails);
      await query(`DELETE FROM user AS u WHERE u.email IN (${placeholders})`, privacyEmails);
    }
    await query('DELETE FROM input_json_state AS ijs WHERE ijs.user_id IN (SELECT u.id FROM user AS u WHERE u.email IN (?, ?, ?))', emails);
    await query('DELETE FROM iset_application_draft_dynamic AS iadd WHERE iadd.user_id IN (SELECT u.id FROM user AS u WHERE u.email IN (?, ?, ?))', emails);
    await query('DELETE FROM pending_uploads AS pu WHERE pu.user_id IN (SELECT u.id FROM user AS u WHERE u.email IN (?, ?, ?))', emails);
    await query('DELETE FROM user AS u WHERE u.email IN (?, ?, ?)', emails);
  }

  const responseTimeouts = new WeakMap();

  async function fetchImpl(url, options = {}) {
    const timeoutMs = options.timeoutMs || 30000;
    const requestOptions = { ...options };
    delete requestOptions.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    requestOptions.signal = requestOptions.signal || controller.signal;
    try {
      const response = typeof fetch === 'function'
        ? await fetch(url, requestOptions)
        : await portalRequire('node-fetch')(url, requestOptions);
      responseTimeouts.set(response, { controller, timer });
      return response;
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
  }

  async function readTimedResponse(response, reader, timeoutMs = 30000) {
    let bodyTimer = null;
    const timeout = new Promise((_, reject) => {
      bodyTimer = setTimeout(() => reject(new Error(`Timed out reading HTTP response body after ${timeoutMs}ms`)), timeoutMs);
    });
    const requestTimeout = responseTimeouts.get(response);
    try {
      return await Promise.race([reader(), timeout]);
    } catch (error) {
      requestTimeout?.controller?.abort();
      throw error;
    } finally {
      clearTimeout(bodyTimer);
      clearTimeout(requestTimeout?.timer);
      responseTimeouts.delete(response);
    }
  }

  async function responseBody(response) {
    const text = await readTimedResponse(response, () => response.text());
    try {
      return { text, json: text ? JSON.parse(text) : null };
    } catch (_) {
      return { text, json: null };
    }
  }

  function setCookies(response) {
    if (response.headers && typeof response.headers.raw === 'function') {
      return response.headers.raw()['set-cookie'] || [];
    }
    if (response.headers && typeof response.headers.getSetCookie === 'function') {
      return response.headers.getSetCookie();
    }
    const single = response.headers && response.headers.get ? response.headers.get('set-cookie') : null;
    return single ? [single] : [];
  }

  function cookieHeaderFromSetCookies(cookies) {
    return cookies
      .map(cookie => String(cookie).split(';')[0])
      .filter(Boolean)
      .join('; ');
  }

  async function apiRequest(session, route, options = {}) {
    const url = `${config.localBaseUrl}${route}`;
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    let body = options.body;
    if (body && typeof body !== 'string' && !Buffer.isBuffer(body)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    if (session?.cookieHeader) headers.Cookie = session.cookieHeader;
    const response = await fetchImpl(url, {
      method: options.method || 'GET',
      headers,
      body,
      redirect: 'manual',
    });
    const parsed = await responseBody(response);
    return {
      status: response.status,
      headers: response.headers,
      text: parsed.text,
      json: parsed.json,
    };
  }

  async function login(applicant, expectedUserId) {
    const response = await fetchImpl(`${config.localBaseUrl}/api/auth/password-login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: applicant.email, password: applicant.password }),
      redirect: 'manual',
    });
    const body = await responseBody(response);
    const cookieHeader = cookieHeaderFromSetCookies(setCookies(response));
    const session = { cookieHeader };
    const me = await apiRequest(session, '/api/me');
    expect(`authenticated login for ${expectedUserId === fixture.userA ? 'rightful' : 'wrong'} applicant`, response.status === 200 && body.json?.success === true && me.json?.authenticated === true && Number(me.json?.id) === Number(expectedUserId), {
      loginStatus: response.status,
      meStatus: me.status,
      meId: me.json?.id || null,
    });
    return session;
  }

  async function runApiChecks() {
    const sessionA = await login(config.applicantA, fixture.userA);
    const sessionB = await login(config.applicantB, fixture.userB);
    fixture.sessionA = sessionA;
    fixture.sessionB = sessionB;

    const contextA = await apiRequest(sessionA, '/api/messages/context');
    expect('rightful applicant messaging context remains usable', contextA.status === 200 && contextA.json?.canCompose === true && Number(contextA.json?.caseId) === fixture.caseA && Number(contextA.json?.applicationId) === fixture.applicationA && !contextA.json?.applicantIdentityConflict, {
      status: contextA.status,
      context: redactContext(contextA.json),
    });

    const contextB = await apiRequest(sessionB, '/api/messages/context');
    expect('wrong applicant messaging context is conflict-blocked', contextB.status === 200 && contextB.json?.canCompose === false && contextB.json?.applicantIdentityConflict === true && !contextB.json?.caseId && !contextB.json?.applicationId, {
      status: contextB.status,
      context: redactContext(contextB.json),
    });

    const composeB = await apiRequest(sessionB, '/api/messages/reply-with-attachments', {
      method: 'POST',
      body: {
        compose_mode: 'new',
        recipient_id: fixture.staffUser,
        case_id: fixture.caseA,
        application_id: fixture.applicationA,
        subject: 'Should be blocked',
        body: 'This should not send.',
      },
    });
    expect('wrong applicant cannot compose into mismatched case', composeB.status === 409 && composeB.json?.error === 'applicant_identity_conflict', {
      status: composeB.status,
      error: composeB.json?.error || null,
    });

    const submissionsA = await apiRequest(sessionA, '/api/submissions');
    const subA = Array.isArray(submissionsA.json) ? submissionsA.json.find(item => item.tracking_id === fixture.refs.applicantA) : null;
    expect('rightful applicant dashboard submission status uses owned application', submissionsA.status === 200 && subA && !['submitted', 'unknown'].includes(String(subA.external_status || '').toLowerCase()), {
      status: submissionsA.status,
      externalStatus: subA?.external_status || null,
    });

    const byRefA = await apiRequest(sessionA, `/api/submissions/by-reference?ref=${encodeURIComponent(fixture.refs.applicantA)}`);
    expect('rightful applicant submission detail includes application status', byRefA.status === 200 && byRefA.json?.application_status === 'approved', {
      status: byRefA.status,
      applicationStatus: byRefA.json?.application_status || null,
      caseStatus: byRefA.json?.case_status || null,
    });

    const submissionsB = await apiRequest(sessionB, '/api/submissions');
    const subB = Array.isArray(submissionsB.json) ? submissionsB.json.find(item => item.tracking_id === fixture.refs.applicantB) : null;
    expect('wrong applicant submission list does not inherit other client status', submissionsB.status === 200 && subB && String(subB.external_status || '').toLowerCase() !== 'approved', {
      status: submissionsB.status,
      externalStatus: subB?.external_status || null,
    });

    const byRefB = await apiRequest(sessionB, `/api/submissions/by-reference?ref=${encodeURIComponent(fixture.refs.applicantB)}`);
    expect('wrong applicant submission detail strips mismatched application/case', byRefB.status === 200 && !byRefB.json?.application_status && byRefB.json?.case_status === 'submitted' && byRefB.json?.status === 'submitted', {
      status: byRefB.status,
      applicationStatus: byRefB.json?.application_status || null,
      caseStatus: byRefB.json?.case_status || null,
      statusValue: byRefB.json?.status || null,
    });

    const interventionsA = await apiRequest(sessionA, '/api/my/interventions');
    expect('rightful applicant can see own active plan activity', interventionsA.status === 200 && Array.isArray(interventionsA.json?.items) && interventionsA.json.items.some(item => item.intervention_id === fixture.intervention), {
      status: interventionsA.status,
      count: interventionsA.json?.items?.length || 0,
    });

    const interventionsB = await apiRequest(sessionB, '/api/my/interventions');
    expect('wrong applicant cannot see other client plan activity', interventionsB.status === 200 && Array.isArray(interventionsB.json?.items) && interventionsB.json.items.length === 0, {
      status: interventionsB.status,
      count: interventionsB.json?.items?.length || 0,
    });

    const inboxA = await apiRequest(sessionA, '/api/messages?folder=inbox');
    expect('rightful applicant inbox shows own case message only', inboxA.status === 200 && Array.isArray(inboxA.json?.items) && inboxA.json.items.some(item => item.id === fixture.messageA) && !inboxA.json.items.some(item => item.id === fixture.messageB), {
      status: inboxA.status,
      ids: (inboxA.json?.items || []).map(item => item.id),
    });

    const inboxB = await apiRequest(sessionB, '/api/messages?folder=inbox');
    expect('wrong applicant inbox hides stale case message rows', inboxB.status === 200 && Array.isArray(inboxB.json?.items) && inboxB.json.items.length === 0, {
      status: inboxB.status,
      ids: (inboxB.json?.items || []).map(item => item.id),
    });

    const messageA = await apiRequest(sessionA, `/api/messages/${fixture.messageA}`);
    expect('rightful applicant can open own message detail', messageA.status === 200 && messageA.json?.id === fixture.messageA && messageA.json?.subject === fixture.subjectA, {
      status: messageA.status,
      id: messageA.json?.id || null,
    });

    const wrongReadsMessageA = await apiRequest(sessionB, `/api/messages/${fixture.messageA}`);
    const wrongReadsMessageB = await apiRequest(sessionB, `/api/messages/${fixture.messageB}`);
    expect('wrong applicant cannot open rightful applicant message detail', wrongReadsMessageA.status === 404, {
      status: wrongReadsMessageA.status,
    });
    expect('wrong applicant cannot open stale message even when addressed to them', wrongReadsMessageB.status === 404, {
      status: wrongReadsMessageB.status,
    });

    const signingA = await apiRequest(sessionA, '/api/signing-requests');
    expect('rightful applicant can see own signing request', signingA.status === 200 && Array.isArray(signingA.json) && signingA.json.some(item => Number(item.id) === fixture.signingA) && !signingA.json.some(item => Number(item.id) === fixture.signingB), {
      status: signingA.status,
      ids: Array.isArray(signingA.json) ? signingA.json.map(item => item.id) : [],
    });

    const signingADetail = await apiRequest(sessionA, `/api/signing-requests/${fixture.signingA}`);
    expect('rightful applicant can open own signing request detail', signingADetail.status === 200 && signingADetail.json?.id === fixture.signingA && Array.isArray(signingADetail.json?.steps), {
      status: signingADetail.status,
      id: signingADetail.json?.id || null,
    });

    const signingB = await apiRequest(sessionB, '/api/signing-requests');
    expect('wrong applicant signing request list hides mismatched case request', signingB.status === 200 && Array.isArray(signingB.json) && !signingB.json.some(item => Number(item.id) === fixture.signingB || Number(item.id) === fixture.signingA), {
      status: signingB.status,
      ids: Array.isArray(signingB.json) ? signingB.json.map(item => item.id) : [],
    });

    const signingBDetail = await apiRequest(sessionB, `/api/signing-requests/${fixture.signingB}`);
    expect('wrong applicant cannot open stale signing request detail', signingBDetail.status === 404, {
      status: signingBDetail.status,
    });
  }

  function cookieToken(session, name) {
    const prefix = `${name}=`;
    const part = String(session?.cookieHeader || '').split(/;\s*/u).find(value => value.startsWith(prefix));
    return part ? decodeURIComponent(part.slice(prefix.length)) : '';
  }

  async function runPrivacyDenialChecks() {
    const coordinator = config.privacyStaffUsers.find(user => user.key === 'coordinator');
    const decisionMaker = config.privacyStaffUsers.find(user => user.key === 'decisionMaker');
    const applicantAToken = cookieToken(fixture.sessionA, 'iset_access');
    const applicantBToken = cookieToken(fixture.sessionB, 'iset_access');
    if (!coordinator?.session?.idToken || !decisionMaker?.session?.idToken || !applicantAToken || !applicantBToken) {
      fail('strict live privacy denials have complete real Cognito tokens');
      return;
    }
    const script = '/opt/nwac/admin-dashboard/scripts/privacy-route-denial-smoke.js';
    const child = spawnSync(process.execPath, [
      script,
      '--require-live',
      '--json',
      '--admin-base', 'http://127.0.0.1:5001',
      '--portal-base', 'http://127.0.0.1:5000',
    ], {
      cwd: '/opt/nwac/admin-dashboard',
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        OPENROUTER_API_KEY: 'deployed-configured',
        PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN: coordinator.session.idToken,
        PRIVACY_DENIAL_FINANCE_OR_ADMIN_TOKEN: decisionMaker.session.idToken,
        PRIVACY_DENIAL_CASEWORK_PAYMENTS_TOKEN: coordinator.session.idToken,
        PRIVACY_DENIAL_APPLICANT_A_TOKEN: applicantAToken,
        PRIVACY_DENIAL_APPLICANT_B_TOKEN: applicantBToken,
        PRIVACY_DENIAL_PORTAL_DOCUMENT_ID: String(fixture.portalDocument),
        PRIVACY_DENIAL_PORTAL_MESSAGE_ID: String(fixture.messageA),
        PRIVACY_DENIAL_ADMIN_CASE_ID: String(fixture.caseA),
        PRIVACY_DENIAL_ADMIN_APPLICATION_ID: String(fixture.applicationA),
        PRIVACY_DENIAL_ADMIN_DOCUMENT_ID: String(fixture.adminDocument),
        PRIVACY_DENIAL_PAYMENT_PACKET_ID: String(fixture.paymentPacket),
      },
    });
    let denialResult = null;
    try {
      denialResult = JSON.parse(String(child.stdout || '').trim());
    } catch (_) {
      fail('strict live privacy denials emitted parseable evidence', {
        status: child.status,
        stderr: String(child.stderr || '').slice(0, 1000),
      });
      return;
    }
    for (const check of denialResult.results || []) {
      const details = { detail: check.detail || null };
      if (check.status === 'PASS') pass(`privacy denial: ${check.name}`, details);
      else if (check.status === 'SKIP') fail(`privacy denial unavailable: ${check.name}`, details);
      else fail(`privacy denial: ${check.name}`, details);
    }
    expect(
      'strict live privacy denial suite completed with no failure or skip',
      child.status === 0 && denialResult.summary?.fail === 0 && denialResult.summary?.skip === 0,
      { status: child.status, summary: denialResult.summary || null, stderr: String(child.stderr || '').slice(0, 1000) }
    );
  }

  function redactContext(context) {
    if (!context || typeof context !== 'object') return context || null;
    return {
      hasSubmittedApplication: Boolean(context.hasSubmittedApplication),
      submissionId: context.submissionId || null,
      applicationId: context.applicationId || null,
      caseId: context.caseId || null,
      canCompose: Boolean(context.canCompose),
      applicantIdentityConflict: Boolean(context.applicantIdentityConflict),
    };
  }

  async function runBrowserChecks() {
    let puppeteer;
    try {
      puppeteer = portalRequire('puppeteer');
    } catch (error) {
      fail('Puppeteer available on deployed TEST portal host', { error: error.message || String(error) });
      return;
    }

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      await browserDashboardCheck(browser, 'rightful', fixture.sessionA, {
        dashboardMustContain: [fixture.interventionTitle],
        messagesMustContain: [fixture.subjectA],
        mustNotContain: [fixture.subjectB],
      });
      await browserDashboardCheck(browser, 'wrong', fixture.sessionB, {
        dashboardMustContain: ['My PATH dashboard'],
        messagesMustContain: ['Secure messages'],
        mustNotContain: [fixture.interventionTitle, fixture.subjectA, fixture.subjectB],
      });
    } finally {
      await browser.close().catch(() => {});
    }
  }

  async function browserDashboardCheck(browser, label, session, assertions) {
    const page = await browser.newPage();
    const diagnostics = {
      consoleErrors: [],
      failedRequests: [],
      failedResponses: [],
    };
    page.on('console', message => {
      if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
    });
    page.on('requestfailed', request => {
      if (/\/api\//.test(request.url())) {
        diagnostics.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || 'failed' });
      }
    });
    page.on('response', response => {
      if (response.status() >= 400 && /\/api\//.test(response.url())) {
        diagnostics.failedResponses.push({ url: response.url(), status: response.status() });
      }
    });
    await interceptApi(page, session);
    await page.goto(`${config.localBaseUrl}/dashboard`, { waitUntil: 'networkidle2', timeout: 45000 });
    await waitForBodyText(page, /My PATH dashboard|Mon tableau de bord PATH/);
    const dashboardText = await page.evaluate(() => document.body ? document.body.innerText : '');
    await page.goto(`${config.localBaseUrl}/messages`, { waitUntil: 'networkidle2', timeout: 45000 });
    await waitForBodyText(page, /Secure messages|Messages sécurisés/);
    const messagesText = await page.evaluate(() => document.body ? document.body.innerText : '');
    const combinedText = `${dashboardText}\n${messagesText}`;
    const dashboardHasRequired = (assertions.dashboardMustContain || []).every(text => dashboardText.includes(text));
    const messagesHasRequired = (assertions.messagesMustContain || []).every(text => messagesText.includes(text));
    const hasRequired = dashboardHasRequired && messagesHasRequired;
    const hasForbidden = (assertions.mustNotContain || []).some(text => combinedText.includes(text));
    expect(`Puppeteer ${label} applicant page content is scoped`, hasRequired && !hasForbidden && diagnostics.failedRequests.length === 0 && diagnostics.failedResponses.length === 0, {
      dashboardHasRequired,
      messagesHasRequired,
      hasForbidden,
      failedRequests: diagnostics.failedRequests,
      failedResponses: diagnostics.failedResponses,
      consoleErrors: diagnostics.consoleErrors.slice(0, 5),
    });
    await page.close().catch(() => {});
  }

  async function interceptApi(page, session) {
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const requestUrl = request.url();
      const isApi =
        requestUrl.startsWith(`${config.publicApiOrigin}/api/`) ||
        requestUrl.startsWith(`${config.localBaseUrl}/api/`);
      if (!isApi) {
        request.continue();
        return;
      }
      const parsed = new URL(requestUrl);
      const targetUrl = `${config.localBaseUrl}${parsed.pathname}${parsed.search}`;
      if (request.method() === 'OPTIONS') {
        request.respond({
          status: 204,
          headers: corsHeaders(),
          body: '',
        });
        return;
      }
      try {
        const headers = {
          Accept: request.headers().accept || 'application/json',
          Cookie: session.cookieHeader,
        };
        const contentType = request.headers()['content-type'];
        if (contentType) headers['Content-Type'] = contentType;
        const response = await fetchImpl(targetUrl, {
          method: request.method(),
          headers,
          body: ['GET', 'HEAD'].includes(request.method()) ? undefined : request.postData(),
          redirect: 'manual',
        });
        const buffer = await readResponseBuffer(response);
        const responseHeaders = {
          ...corsHeaders(),
          'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8',
        };
        request.respond({
          status: response.status,
          headers: responseHeaders,
          body: buffer,
        });
      } catch (error) {
        request.respond({
          status: 599,
          headers: corsHeaders(),
          body: JSON.stringify({ error: 'intercept_failed', message: error.message || String(error) }),
        });
      }
    });
  }

  function corsHeaders() {
    return {
      'access-control-allow-origin': config.localBaseUrl,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,x-access-token',
    };
  }

  async function readResponseBuffer(response) {
    if (typeof response.arrayBuffer === 'function') {
      return Buffer.from(await readTimedResponse(response, () => response.arrayBuffer()));
    }
    if (typeof response.buffer === 'function') {
      return readTimedResponse(response, () => response.buffer());
    }
    return Buffer.from(await readTimedResponse(response, () => response.text()), 'utf8');
  }

  async function waitForBodyText(page, pattern) {
    const source = pattern.source;
    const flags = pattern.flags;
    await page.waitForFunction(
      ({ source, flags }) => {
        const regex = new RegExp(source, flags);
        return regex.test(document.body ? document.body.innerText : '');
      },
      { timeout: 30000 },
      { source, flags }
    );
  }
}

if (process.argv.includes('--remote-runner')) {
  remoteRunner();
} else {
  main().catch(error => {
    console.error('[applicant-scope-smoke] Failed:', error.message || error);
    process.exitCode = 1;
  });
}
