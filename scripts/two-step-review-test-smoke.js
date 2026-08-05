#!/usr/bin/env node

/*
 * Live TEST smoke for the Regional Manager two-step review workflow.
 *
 * The script creates disposable TEST Cognito staff users, runs a remote runner on
 * the TEST admin host against the deployed backend/bundle, then deletes Cognito,
 * DB, and generated object-storage residue. It intentionally treats the business
 * roles as ISET Coordinator, Regional Manager, and NWAC Administrator.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_PROFILE = 'nwac-test';
const DEFAULT_REGION = 'ca-central-1';
const DEFAULT_BUCKET = 'nwac-test-artifacts';
const DEFAULT_ADMIN_ENV = path.resolve(__dirname, '..', '.env.test');
const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:5001';

function parseArgs(argv) {
  const args = {
    profile: process.env.AWS_PROFILE || DEFAULT_PROFILE,
    region: process.env.AWS_REGION || DEFAULT_REGION,
    bucket: process.env.TWO_STEP_REVIEW_SMOKE_BUCKET || DEFAULT_BUCKET,
    instanceId: process.env.TWO_STEP_REVIEW_SMOKE_INSTANCE_ID || '',
    adminEnv: process.env.TWO_STEP_REVIEW_SMOKE_ADMIN_ENV || DEFAULT_ADMIN_ENV,
    keepFixture: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--profile') args.profile = argv[++index];
    else if (token === '--region') args.region = argv[++index];
    else if (token === '--bucket') args.bucket = argv[++index];
    else if (token === '--instance-id') args.instanceId = argv[++index];
    else if (token === '--admin-env') args.adminEnv = argv[++index];
    else if (token === '--keep-fixture') args.keepFixture = true;
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
    'Usage: node scripts/two-step-review-test-smoke.js [options]',
    '',
    'Creates disposable TEST staff users and fixtures, exercises deployed TEST',
    'two-step review behavior, verifies artifacts/notifications, then cleans up.',
    '',
    'Options:',
    '  --instance-id ID   Run on a specific online nwac-test-app instance.',
    '  --profile NAME     AWS profile. Default: nwac-test.',
    '  --region REGION    AWS region. Default: ca-central-1.',
    '  --bucket NAME      Temporary S3 bucket. Default: nwac-test-artifacts.',
    '  --admin-env PATH   Admin .env.test used for staff pool values.',
    '  --keep-fixture     Keep DB fixture and Cognito users for inspection.',
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
    maxBuffer: 30 * 1024 * 1024,
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
  return `TwoStep#${crypto.randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}aA1!`;
}

function discoverInstanceId(options) {
  if (options.instanceId) return options.instanceId;
  const online = new Set(
    awsText([
      'ssm',
      'describe-instance-information',
      '--query',
      'InstanceInformationList[?PingStatus==`Online`].InstanceId',
    ], options).split(/\s+/).filter(Boolean)
  );
  const running = awsText([
    'ec2',
    'describe-instances',
    '--filters',
    'Name=tag:Name,Values=nwac-test-app',
    'Name=instance-state-name,Values=running',
    '--query',
    'Reservations[].Instances[].InstanceId',
  ], options).split(/\s+/).filter(Boolean);
  const match = running.find(instanceId => online.has(instanceId));
  if (!match) throw new Error('No online SSM-managed nwac-test-app instance found.');
  return match;
}

function createStaffUser({ email, password, givenName, familyName, poolId, groupName }, options) {
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

function authenticateStaffUser({ email, password, poolId, clientId }, options) {
  if (!clientId) throw new Error('Cognito staff client id not found in admin env.');
  const flows = [
    ['admin-initiate-auth', 'ADMIN_USER_PASSWORD_AUTH', ['--user-pool-id', poolId]],
    ['initiate-auth', 'USER_PASSWORD_AUTH', []],
  ];
  const errors = [];
  for (const [command, flow, extraArgs] of flows) {
    try {
      const response = awsJson([
        'cognito-idp',
        command,
        ...extraArgs,
        '--client-id',
        clientId,
        '--auth-flow',
        flow,
        '--auth-parameters',
        `USERNAME=${email},PASSWORD=${password}`,
      ], options);
      if (response?.ChallengeName) {
        throw new Error(`Unexpected Cognito auth challenge: ${response.ChallengeName}`);
      }
      const auth = response?.AuthenticationResult;
      if (!auth?.IdToken || !auth?.AccessToken) {
        throw new Error('Cognito auth response did not include ID/access tokens.');
      }
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = Number(auth.ExpiresIn || 3600);
      return {
        idToken: auth.IdToken,
        accessToken: auth.AccessToken,
        refreshToken: auth.RefreshToken || null,
        expiresAt: now + expiresIn - 60,
      };
    } catch (error) {
      const message = String(error.stderr || error.message || error).split('\n')[0];
      errors.push(`${flow}: ${message}`);
    }
  }
  throw new Error(`Unable to authenticate ${email} through TEST Cognito client. ${errors.join(' | ')}`);
}

function deleteStaffUser({ email, poolId }, options) {
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
      console.warn(`[two-step-smoke] Cognito cleanup warning for ${email}: ${message.split('\n')[0]}`);
    }
  }
}

function uploadRemoteScript(remoteScript, key, options) {
  const tempFile = path.join(os.tmpdir(), `two-step-review-smoke-${process.pid}-${Date.now()}.js`);
  fs.writeFileSync(tempFile, remoteScript, 'utf8');
  try {
    aws([
      's3',
      'cp',
      tempFile,
      `s3://${options.bucket}/${key}`,
      '--only-show-errors',
    ], options);
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

function deleteRemoteScript(key, options) {
  try {
    aws([
      's3',
      'rm',
      `s3://${options.bucket}/${key}`,
      '--only-show-errors',
    ], options);
  } catch (_) {
    // Best effort only.
  }
}

function sendRemoteCommand(instanceId, commandLines, comment, options) {
  const paramsFile = path.join(os.tmpdir(), `two-step-review-params-${process.pid}-${Date.now()}.json`);
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
      execFileSync('sleep', ['2.5']);
      continue;
    }
    return invocation;
  }
}

function parseRemoteResult(stdout) {
  const marker = '@@TWO_STEP_REVIEW_SMOKE_RESULT@@';
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
  if (!fs.existsSync(options.adminEnv)) {
    throw new Error(`Admin env file not found: ${options.adminEnv}`);
  }
  const adminEnv = readEnvFile(options.adminEnv);
  const poolId =
    adminEnv.COGNITO_STAFF_USER_POOL_ID ||
    adminEnv.COGNITO_USER_POOL_ID;
  if (!poolId) throw new Error('COGNITO_STAFF_USER_POOL_ID not found in admin env.');
  const clientId =
    adminEnv.COGNITO_STAFF_CLIENT_ID ||
    adminEnv.COGNITO_CLIENT_ID ||
    adminEnv.REACT_APP_COGNITO_CLIENT_ID;
  if (!clientId) throw new Error('COGNITO_STAFF_CLIENT_ID not found in admin env.');

  const suffix = randomSuffix();
  const stamp = `two-step-${Date.now()}-${suffix}`;
  const staffUsers = [
    {
      key: 'coordinator',
      email: `codex.twostep.${suffix}.coord@example.com`,
      password: randomPassword(),
      givenName: 'Codex',
      familyName: `Coordinator ${suffix}`,
      role: 'ISET Coordinator',
      groupName: 'ISET_Coordinator',
    },
    {
      key: 'manager',
      email: `codex.twostep.${suffix}.rm@example.com`,
      password: randomPassword(),
      givenName: 'Codex',
      familyName: `Manager ${suffix}`,
      role: 'Regional Manager',
      groupName: 'Regional_Manager',
    },
    {
      key: 'decisionMaker',
      email: `codex.twostep.${suffix}.nwac@example.com`,
      password: randomPassword(),
      givenName: 'Codex',
      familyName: `Decision ${suffix}`,
      role: 'NWAC Administrator',
      groupName: 'NWAC_Administrator',
    },
  ];
  const createdUsers = [];
  let remoteKey = null;
  let result = null;

  try {
    console.log('[two-step-smoke] Discovering TEST app instance...');
    const instanceId = discoverInstanceId(options);
    console.log(`[two-step-smoke] Using ${instanceId}`);

    console.log('[two-step-smoke] Creating disposable TEST staff Cognito users...');
    for (const user of staffUsers) {
      user.sub = createStaffUser({ ...user, poolId }, options);
      user.session = authenticateStaffUser({ ...user, poolId, clientId }, options);
      createdUsers.push(user);
    }

    remoteKey = `ssm-scripts/two-step-review-smoke-${stamp}.js`;
    uploadRemoteScript(`(${remoteRunner.toString()})();\n`, remoteKey, options);

    const remotePath = `/tmp/two-step-review-smoke-${stamp}.js`;
    const commandLines = [
      'set -euo pipefail',
      `aws s3 cp ${shellQuote(`s3://${options.bucket}/${remoteKey}`)} ${shellQuote(remotePath)} --region ${shellQuote(options.region)} --only-show-errors`,
      `trap 'rm -f ${shellQuote(remotePath)}' EXIT`,
      'cd /opt/nwac/admin-dashboard',
      [
        `FIXTURE_STAMP=${shellQuote(stamp)}`,
        `KEEP_FIXTURE=${options.keepFixture ? '1' : '0'}`,
        `LOCAL_BASE_URL=${shellQuote(DEFAULT_LOCAL_BASE_URL)}`,
        `STAFF_USERS_JSON=${shellQuote(JSON.stringify(staffUsers.map(user => ({
          key: user.key,
          email: user.email,
          password: user.password,
          sub: user.sub,
          role: user.role,
          session: user.session,
        }))))}`,
        `node ${shellQuote(remotePath)}`,
      ].join(' '),
      `rm -f ${shellQuote(remotePath)}`,
    ];

    console.log('[two-step-smoke] Running deployed TEST two-step review smoke through SSM...');
    const commandId = sendRemoteCommand(instanceId, commandLines, 'Codex two-step review TEST smoke', options);
    console.log(`[two-step-smoke] SSM command ${commandId}`);
    const invocation = waitForCommand(instanceId, commandId, options);
    result = parseRemoteResult(invocation?.Stdout);
    if (invocation?.Status !== 'Success') {
      const stderr = invocation?.Stderr ? `\n${invocation.Stderr}` : '';
      const failedChecks = (result?.checks || []).filter(check => check.status === 'FAIL');
      const details = failedChecks.length ? `\n${JSON.stringify(failedChecks)}` : '';
      throw new Error(`Remote smoke failed with status ${invocation?.Status || 'unknown'}${stderr}${details}`);
    }
    if (!result) {
      throw new Error(`Remote smoke finished but did not emit a parseable result.\n${invocation?.Stdout || ''}`);
    }
    if (!options.json) {
      console.log(summarizeResult(result));
      console.log(`[two-step-smoke] Fixture IDs: ${JSON.stringify(result.fixtureIds)}`);
    }
    const failures = (result.checks || []).filter(check => check.status === 'FAIL');
    if (failures.length) {
      throw new Error(`${failures.length} two-step review smoke check(s) failed.`);
    }
  } finally {
    if (remoteKey) deleteRemoteScript(remoteKey, options);
    if (!options.keepFixture) {
      for (const user of createdUsers.reverse()) {
        deleteStaffUser({ email: user.email, poolId }, options);
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

function remoteRunner() {
  const fs = require('fs');
  const path = require('path');
  const { createRequire } = require('module');
  const adminRequire = createRequire('/opt/nwac/admin-dashboard/package.json');
  const mysql = adminRequire('mysql2/promise');
  const puppeteer = adminRequire('puppeteer');

  try {
    adminRequire('dotenv').config({ path: '/opt/nwac/admin-dashboard/.env.test' });
    adminRequire('dotenv').config({ path: '/opt/nwac/admin-dashboard/.env' });
  } catch (_) {
    // Runtime environment is already available to PM2; dotenv is for ad hoc SSM.
  }

  const result = {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    checks: [],
    fixtureIds: {},
    cleanup: null,
    browserIssues: [],
    evidence: {},
  };

  const config = {
    stamp: requiredEnv('FIXTURE_STAMP'),
    keepFixture: process.env.KEEP_FIXTURE === '1',
    localBaseUrl: stripTrailingSlash(process.env.LOCAL_BASE_URL || 'http://127.0.0.1:5001'),
    staffUsers: JSON.parse(requiredEnv('STAFF_USERS_JSON')),
    regionId: Number(process.env.TWO_STEP_REVIEW_REGION_ID || 1),
  };

  const fixture = {
    suffix: config.stamp.replace(/[^a-zA-Z0-9]+/g, '').slice(-12),
    marker: { fixture: 'two-step-review-test-smoke', stamp: config.stamp },
    staff: {},
    cases: {},
    applications: {},
    submissions: {},
    actionPlans: {},
    interventions: {},
    proposals: {},
    workflows: {},
    documents: [],
  };

  const smokeDates = {
    sourceStart: dateFromNow(30),
    sourceEnd: dateFromNow(60),
    proposalStart: dateFromNow(90),
    proposalEnd: dateFromNow(120),
    revisionStart: dateFromNow(150),
    revisionEnd: dateFromNow(180),
    assessmentStart: dateFromNow(90),
    assessmentEnd: dateFromNow(195),
  };

  let connection = null;
  let browser = null;
  let finalCleanupComplete = false;

  main()
    .then(() => {
      result.status = result.checks.some(check => check.status === 'FAIL') ? 'failed' : 'passed';
      result.finishedAt = new Date().toISOString();
      console.log('@@TWO_STEP_REVIEW_SMOKE_RESULT@@' + JSON.stringify(result));
      if (result.status !== 'passed') process.exitCode = 1;
    })
    .catch(async error => {
      fail('remote runner completed without crashing', {
        error: error && error.stack ? error.stack : String(error),
      });
      if (!config.keepFixture && connection && !finalCleanupComplete) {
        try {
          await cleanupFixture();
        } catch (cleanupError) {
          fail('TEST synthetic fixture cleanup after failure completed', {
            error: cleanupError && cleanupError.stack ? cleanupError.stack : String(cleanupError),
          });
        }
      } else if (config.keepFixture) {
        result.cleanup = 'kept-after-failure';
      }
      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }
      if (connection) {
        await connection.end().catch(() => {});
        connection = null;
      }
      result.status = 'failed';
      result.finishedAt = new Date().toISOString();
      console.log('@@TWO_STEP_REVIEW_SMOKE_RESULT@@' + JSON.stringify(result));
      process.exitCode = 1;
    });

  async function main() {
    progress('remote runner starting');
    connection = await mysql.createConnection(dbConfig());
    progress('db connected');
    await cleanupFixture({ quiet: true });
    await seedFixture();
    await verifyRuntimeConfig();
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const auth = await loginAllRoles();
    await runApplicationAssessmentWorkflow(auth);
    await runInterventionProposalWorkflow(auth);
    await runInterventionRevisionWorkflow(auth);
    await verifyNoKnownFixtureMismatches();
    if (!config.keepFixture) {
      await cleanupFixture();
      finalCleanupComplete = true;
    } else {
      result.cleanup = 'kept';
      progress('fixture kept');
    }
    if (browser) await browser.close();
    browser = null;
    await connection.end();
    progress('db connection closed');
  }

  function progress(message) {
    const line = `${new Date().toISOString()} ${message}\n`;
    try {
      fs.appendFileSync(`/tmp/two-step-review-smoke-${config.stamp}.progress.log`, line, 'utf8');
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

  function dateFromNow(days) {
    const value = new Date(Date.now() + (Number(days) * 24 * 60 * 60 * 1000));
    return value.toISOString().slice(0, 10);
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

  function expect(name, condition, details = {}) {
    if (condition) pass(name, details);
    else fail(name, details);
  }

  async function query(sql, params = []) {
    return connection.query(sql, params);
  }

  async function insert(sql, params = []) {
    const [res] = await query(sql, params);
    return Number(res.insertId);
  }

  function json(value) {
    return JSON.stringify(value);
  }

  function markerJson(extra = {}) {
    return json({ ...fixture.marker, ...extra });
  }

  function authHeaders(auth) {
    return { Authorization: `Bearer ${auth.session.idToken}` };
  }

  async function fetchJson(urlOrPath, options = {}) {
    const url = String(urlOrPath).startsWith('http')
      ? urlOrPath
      : `${config.localBaseUrl}${urlOrPath}`;
    const response = await fetch(url, options);
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_) {
      body = { raw: text.slice(0, 500) };
    }
    if (!response.ok) {
      const error = new Error(`${response.status} ${body?.error || body?.message || body?.raw || response.statusText}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  async function fetchExpectingFailure(urlOrPath, options = {}) {
    try {
      const body = await fetchJson(urlOrPath, options);
      return { ok: true, status: 200, body };
    } catch (error) {
      return { ok: false, status: error.status || 0, body: error.body || { error: error.message } };
    }
  }

  function buildAuthorizeUrl() {
    const rawDomain = process.env.COGNITO_DOMAIN || process.env.COGNITO_STAFF_DOMAIN;
    const domain = rawDomain.startsWith('http') ? rawDomain : `https://${rawDomain}`;
    const redirectUri = process.env.COGNITO_REDIRECT_URI || process.env.REACT_APP_COGNITO_REDIRECT_URI;
    const params = new URLSearchParams({
      client_id: process.env.COGNITO_CLIENT_ID || process.env.COGNITO_STAFF_CLIENT_ID || process.env.REACT_APP_COGNITO_CLIENT_ID,
      response_type: 'code',
      scope: 'email openid profile',
      redirect_uri: redirectUri,
      state: Buffer.from(`${config.localBaseUrl}/`).toString('base64'),
    });
    return `${domain.replace(/\/+$/, '')}/oauth2/authorize?${params.toString()}`;
  }

  async function loginViaHostedUi(user) {
    const context = typeof browser.createBrowserContext === 'function'
      ? await browser.createBrowserContext()
      : (typeof browser.createIncognitoBrowserContext === 'function'
        ? await browser.createIncognitoBrowserContext()
        : null);
    const page = context ? await context.newPage() : await browser.newPage();
    page.setDefaultTimeout(60_000);
    try {
      await page.goto(buildAuthorizeUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const usernameSelectorList = [
        'input[name="username"]',
        'input[name="email"]',
        'input[id="username"]',
        'input[id="signInFormUsername"]',
        'input[type="email"]',
        'input[type="text"]',
      ].join(', ');
      const passwordSelector = [
        'input[name="password"]',
        'input[id="password"]',
        'input[id="signInFormPassword"]',
        'input[type="password"]',
      ].join(', ');
      await page.waitForSelector(usernameSelectorList, { timeout: 60_000 });
      const usernameHandle = await page.evaluateHandle(selectorList => {
        const visible = element => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        return Array.from(document.querySelectorAll(selectorList))
          .find(input => visible(input) && input.type !== 'password') || null;
      }, usernameSelectorList);
      const usernameElement = usernameHandle.asElement();
      if (!usernameElement) throw new Error('Hosted UI username field was not visible.');
      await usernameElement.click({ clickCount: 3 });
      await usernameElement.type(user.email);
      await page.click(passwordSelector, { clickCount: 3 });
      await page.type(passwordSelector, user.password);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => null),
        page.keyboard.press('Enter'),
      ]);
      await page.waitForFunction(() => {
        const raw = window.sessionStorage?.getItem('authSession');
        if (!raw) return false;
        try {
          const parsed = JSON.parse(raw);
          return Boolean(parsed?.idToken && parsed?.accessToken);
        } catch (_) {
          return false;
        }
      }, { timeout: 60_000 });
      const session = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('authSession')));
      const me = await fetchJson('/api/auth/me', {
        headers: authHeaders({ session }),
      });
      return {
        key: user.key,
        email: user.email,
        expectedRole: user.role,
        session,
        role: me?.auth?.role || me?.profile?.primary_role || me?.profile?.role || null,
        staffProfileId: Number(me?.auth?.staffProfileId || me?.profile?.id || 0) || null,
        me,
      };
    } catch (error) {
      const safeName = String(user.email || 'login').replace(/[^a-z0-9_.-]+/gi, '_');
      const screenshot = `/tmp/two-step-review-login-failure-${config.stamp}-${safeName}.png`;
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      const url = page.url();
      const text = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '');
      error.message = `${error.message} (url=${url}, screenshot=${screenshot}, pageText=${JSON.stringify(text.slice(0, 240))})`;
      throw error;
    } finally {
      await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  async function loginAllRoles() {
    const auth = {};
    for (const user of config.staffUsers) {
      auth[user.key] = user.session
        ? await loginWithExistingSession(user)
        : await loginViaHostedUi(user);
      expect(`TEST Cognito login resolved ${user.role}`, auth[user.key].role === user.role, {
        email: user.email,
        resolvedRole: auth[user.key].role,
        staffProfileId: auth[user.key].staffProfileId,
      });
    }
    return auth;
  }

  async function loginWithExistingSession(user) {
    const me = await fetchJson('/api/auth/me', {
      headers: authHeaders({ session: user.session }),
    });
    return {
      key: user.key,
      email: user.email,
      expectedRole: user.role,
      session: user.session,
      role: me?.auth?.role || me?.profile?.primary_role || me?.profile?.role || null,
      staffProfileId: Number(me?.auth?.staffProfileId || me?.profile?.id || 0) || null,
      me,
    };
  }

  async function authedPage(auth) {
    const page = await browser.newPage();
    page.setDefaultTimeout(60_000);
    await page.setViewport({ width: 1360, height: 940, deviceScaleFactor: 1 });
    page.on('pageerror', error => {
      result.browserIssues.push({ type: 'pageerror', message: error.message });
    });
    page.on('console', message => {
      const text = message.text();
      if (/ReferenceError|TypeError|Unhandled|Cannot update a component/i.test(text)) {
        result.browserIssues.push({ type: 'console', level: message.type(), text: text.slice(0, 700) });
      }
    });
    page.on('response', response => {
      if (response.url().startsWith(config.localBaseUrl) && response.status() >= 500) {
        result.browserIssues.push({ type: 'api', status: response.status(), url: response.url() });
      }
    });
    await page.evaluateOnNewDocument((session, apiBase) => {
      window.__API_BASE__ = apiBase;
      sessionStorage.setItem('authSession', JSON.stringify(session));
      sessionStorage.removeItem('iset.tutorial.resetApplicationLayout');
      localStorage.setItem('application-assessment-dashboard-layout.v2', JSON.stringify([
        { id: 'coordinator-assessment', rowSpan: 10, columnSpan: 4 },
      ]));
    }, auth.session, config.localBaseUrl);
    return page;
  }

  async function assertRouteText(auth, routePath, expectedTexts, label) {
    const page = await authedPage(auth);
    try {
      await page.goto(`${config.localBaseUrl}${routePath}`, { waitUntil: 'domcontentloaded' });
      await dismissTutorialPromptIfPresent(page);
      try {
        const found = await page.waitForFunction(candidates => {
          const body = document.body?.innerText || '';
          return candidates.find(text => body.includes(text)) || false;
        }, { timeout: 60_000 }, expectedTexts).then(handle => handle.jsonValue());
        pass(`browser route: ${label}`, { routePath, found });
      } catch (error) {
        const screenshot = `/tmp/two-step-review-route-failure-${config.stamp}-${String(label).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
        await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
        const pageText = await page.evaluate(() => document.body?.innerText?.slice(0, 1200) || '').catch(() => '');
        fail(`browser route: ${label}`, {
          routePath,
          url: page.url(),
          expectedTexts,
          pageText,
          screenshot,
          error: error.message || String(error),
        });
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  async function dismissTutorialPromptIfPresent(page) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const clicked = await page.evaluate(() => {
        const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
        const visible = element => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(visible);
        const skip = buttons.find(button => normalize(button.innerText || button.textContent || button.getAttribute('aria-label') || '') === 'Skip');
        if (!skip) return false;
        skip.click();
        return true;
      });
      if (!clicked) return;
      await delay(300);
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function seedFixture() {
    progress('seed fixture starting');
    await connection.beginTransaction();
    try {
      const suffix = fixture.suffix;
      for (const user of config.staffUsers) {
        const displayName = `${user.role} Smoke ${suffix}`;
        const staffUserId = await insert(
          `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
           VALUES (?, ?, ?, 1, 0, 'en')`,
          [displayName, user.email, user.sub]
        );
        const staffProfileId = await insert(
          `INSERT INTO staff_profiles
             (cognito_sub, email, name, display_name, primary_role, status, region_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
          [user.sub, user.email, displayName, displayName, user.role, config.regionId]
        );
        await query(
          `INSERT INTO staff_region (staff_profile_id, region_id)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE updated_at = NOW()`,
          [staffProfileId, config.regionId]
        );
        fixture.staff[user.key] = { staffUserId, staffProfileId, email: user.email, role: user.role, sub: user.sub };
      }

      fixture.applicantUser = await insert(
        `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
         VALUES (?, ?, ?, 1, 0, 'en')`,
        [`Two Step Applicant ${suffix}`, `codex.twostep.${suffix}.applicant@example.com`, `two-step-applicant-${suffix}`]
      );
      fixture.client = await insert(
        `INSERT INTO client
           (first_name, last_name, applicant_cognito_sub, applicant_cognito_username,
            applicant_account_status, applicant_account_email, applicant_activated_at, address_json)
         VALUES (?, ?, ?, ?, 'activated', ?, NOW(), CAST(? AS JSON))`,
        ['Two Step', `Applicant ${suffix}`, `two-step-applicant-${suffix}`, `codex.twostep.${suffix}.applicant@example.com`, `codex.twostep.${suffix}.applicant@example.com`, markerJson()]
      );

      await seedApplicationAssessmentCase('application');
      await seedInterventionCase('proposal');
      await seedInterventionCase('revision');
      await seedInterventionCase('rmProposal');

      await connection.commit();
      result.fixtureIds = {
        stamp: config.stamp,
        staff: Object.fromEntries(Object.entries(fixture.staff).map(([key, value]) => [key, value.staffProfileId])),
        cases: fixture.cases,
        applications: fixture.applications,
        actionPlans: fixture.actionPlans,
        interventions: fixture.interventions,
      };
      pass('TEST synthetic two-step fixture seeded', result.fixtureIds);
      progress('seed fixture committed');
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  async function seedApplicationAssessmentCase(label) {
    const suffix = fixture.suffix;
    const reference = `TSTEPA-${suffix}`.slice(0, 32);
    const answers = {
      'first-name': 'Two',
      'last-name': `Assessment ${suffix}`,
      'preferred-name': 'Two',
      email: `codex.twostep.${suffix}.assessment@example.com`,
      'address-province': 'QC',
    };
    const payload = { ...fixture.marker, answers, submission_snapshot: { reference_number: reference } };
    const submissionId = await insert(
      `INSERT INTO iset_application_submission
         (user_id, workflow_id, reference_number, status, submitted_at, intake_payload, schema_snapshot, history, doc_refs, locale)
       VALUES (?, 'iset-v1', ?, 'submitted', NOW(), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), 'en')`,
      [fixture.applicantUser, reference, json(answers), markerJson(), json([]), json([])]
    );
    const caseId = await insert(
      `INSERT INTO iset_case
         (case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, stage,
          opened_at, portfolio_region_id, case_context_json, created_by_staff_profile_id, updated_by_staff_profile_id)
       VALUES (?, ?, ?, 'intake', 'intake', 'two_step_smoke', NOW(), ?, CAST(? AS JSON), ?, ?)`,
      [
        `TSTEP-APP-${suffix}`.slice(0, 32),
        fixture.client,
        fixture.staff.coordinator.staffProfileId,
        config.regionId,
        markerJson({ kind: label }),
        fixture.staff.coordinator.staffProfileId,
        fixture.staff.coordinator.staffProfileId,
      ]
    );
    const applicationId = await insert(
      `INSERT INTO iset_application
         (submission_id, client_id, case_id, payload_json, status, lifecycle_status,
          decision_outcome, awaiting_reason, created_at, updated_at, row_version)
       VALUES (?, ?, ?, CAST(? AS JSON), 'in_review', 'in_review', NULL, NULL, NOW(), NOW(), 1)`,
      [submissionId, fixture.client, caseId, json(payload)]
    );
    await query(
      `INSERT INTO iset_application_assessment
         (application_id, case_id, date_of_assessment, overview, employment_goals,
          previous_iset, employment_barriers, local_area_priorities, other_funding_details,
          esdc_eligibility, intervention_start_date, intervention_end_date,
          intervention_budget_pot_id, posting_context, intervention_code,
          intervention_outcome_code, intervention_duration_days, intervention_cost_total,
          institution, program_name, itp_payload, wage_payload, recommendation,
          justification, proposed_interventions, childcare_need, created_at, updated_at)
       VALUES (?, ?, CURRENT_DATE(), ?, ?, 0, CAST(? AS JSON), CAST(? AS JSON), ?,
          'CRF', ?, ?, ?, 'external', 4, 1, 106, 100,
          'Smoke College', 'Smoke Certificate', CAST(? AS JSON), CAST(? AS JSON),
          'recommend', ?, CAST(? AS JSON), 0, NOW(), NOW())`,
      [
        applicationId,
        caseId,
        'Synthetic assessment case for two-step review smoke.',
        'Complete short training and move into employment.',
        json(['Lack of Marketable Skills']),
        json(['Off Reserve']),
        'No other funding identified.',
        smokeDates.assessmentStart,
        smokeDates.assessmentEnd,
        1780058672308,
        json({ tuition: '', books: '', materials: '', living: '', childcare: '', otherLabel: '', otherAmount: '', details: 'Training plan details.' }),
        json({ wages: '', mercs: '', nonwages: '', other1Label: '', other1Amount: '', other2Label: '', other2Amount: '', subsidyDetails: '' }),
        'Synthetic recommendation is aligned with employment goals.',
        json([
          {
            id: `two-step-assessment-${suffix}`,
            code: '4',
            startDate: smokeDates.assessmentStart,
            endDate: smokeDates.assessmentEnd,
            deliveryMode: 'partner',
            institution: 'Smoke College',
            programName: 'Smoke Certificate',
            itpDetails: 'Training plan details.',
            costLines: [{ id: 'tuition', label: 'Tuition', paymentType: 'tuition', payeeType: 'institution', payeeName: 'Smoke College', amount: '100' }],
          },
        ]),
      ]
    );
    fixture.submissions[label] = submissionId;
    fixture.cases[label] = caseId;
    fixture.applications[label] = applicationId;
  }

  async function seedInterventionCase(label) {
    const suffix = fixture.suffix;
    const reference = `TSTEPI-${label}-${suffix}`.slice(0, 32);
    const answers = {
      'first-name': 'Two',
      'last-name': `${label} ${suffix}`,
      email: `codex.twostep.${suffix}.${label}@example.com`,
      'address-province': 'QC',
    };
    const payload = { ...fixture.marker, answers, submission_snapshot: { reference_number: reference } };
    const submissionId = await insert(
      `INSERT INTO iset_application_submission
         (user_id, workflow_id, reference_number, status, submitted_at, intake_payload, schema_snapshot, history, doc_refs, locale)
       VALUES (?, 'iset-v1', ?, 'submitted', NOW(), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), 'en')`,
      [fixture.applicantUser, reference, json(answers), markerJson(), json([]), json([])]
    );
    const caseId = await insert(
      `INSERT INTO iset_case
         (case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, stage,
          opened_at, portfolio_region_id, case_context_json, created_by_staff_profile_id, updated_by_staff_profile_id)
       VALUES (?, ?, ?, 'active', 'active', 'two_step_smoke', NOW(), ?, CAST(? AS JSON), ?, ?)`,
      [
        `TSTEP-${label}-${suffix}`.slice(0, 32),
        fixture.client,
        fixture.staff.coordinator.staffProfileId,
        config.regionId,
        markerJson({ kind: label }),
        fixture.staff.coordinator.staffProfileId,
        fixture.staff.coordinator.staffProfileId,
      ]
    );
    const applicationId = await insert(
      `INSERT INTO iset_application
         (submission_id, client_id, case_id, payload_json, status, lifecycle_status,
          decision_outcome, awaiting_reason, created_at, updated_at, row_version)
       VALUES (?, ?, ?, CAST(? AS JSON), 'approved', 'decision_recorded', 'approved', NULL, NOW(), NOW(), 1)`,
      [submissionId, fixture.client, caseId, json(payload)]
    );
    const actionPlanId = await insert(
      `INSERT INTO iset_case_action_plan
         (case_id, application_id, name, status, budget_pot, funding_stream,
          owner_staff_profile_id, effective_date, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, 'CRF', ?, CURRENT_DATE(), CAST(? AS JSON), NOW(), NOW())`,
      [
        caseId,
        applicationId,
        `Two-step smoke plan ${label}`,
        '1780058672308',
        fixture.staff.coordinator.staffProfileId,
        markerJson({ kind: label, postingContext: 'external' }),
      ]
    );
    fixture.submissions[label] = submissionId;
    fixture.cases[label] = caseId;
    fixture.applications[label] = applicationId;
    fixture.actionPlans[label] = actionPlanId;

    if (label === 'revision') {
      const sourceInterventionId = await insert(
        `INSERT INTO iset_case_intervention
           (case_id, action_plan_id, intervention_code, status, delivery_status,
            start_date, end_date, duration_days, budget_amount, approved_amount,
            intervention_cost, notes, metadata_json, esdc_intervention_json,
            created_by_staff_profile_id, reviewed_by_staff_profile_id, reviewed_at,
            eligibility_result, funding_stream_decision)
         VALUES (?, ?, 3, 'approved', 'planned', ?, ?, 31,
            100.00, 100.00, 100.00, 'Synthetic approved source intervention.',
            CAST(? AS JSON), CAST(? AS JSON), ?, ?, NOW(), 'eligible', 'CRF')`,
        [
          caseId,
          actionPlanId,
          smokeDates.sourceStart,
          smokeDates.sourceEnd,
          markerJson({ kind: label, title: 'Approved source intervention', code: '3', cost: 100, postingContext: 'external' }),
          json({ interventionCode: '3', interventionStartDate: smokeDates.sourceStart, interventionEndDate: smokeDates.sourceEnd, interventionCost: 100 }),
          fixture.staff.coordinator.staffProfileId,
          fixture.staff.decisionMaker.staffProfileId,
        ]
      );
      fixture.interventions.revisionSource = sourceInterventionId;
    }
  }

  async function verifyRuntimeConfig() {
    const [rows] = await query(
      `SELECT scope, k, CAST(v AS CHAR) AS value_json
         FROM iset_runtime_config
        WHERE k = 'workflow.two_step_rm_review.enabled'`
    );
    const value = rows[0]?.value_json || '';
    expect('TEST runtime flag includes all three two-step workflows', (
      value.includes('application_assessment') &&
      value.includes('intervention_proposal') &&
      value.includes('intervention_revision')
    ), { value });
    const [settings] = await query(
      `SELECT event, role, enabled, email_alert, bell_alert
         FROM notification_setting
        WHERE event IN ('assessment_submitted','rm_review_requested','rm_review_returned_to_submitter',
                        'rm_review_changes_forwarded','rm_review_submitted_to_nwac','nwac_review_changes_requested')
        ORDER BY event, role`
    );
    const rmRequested = settings.find(row => row.event === 'rm_review_requested' && row.role === 'Regional Manager');
    const legacyAdmin = settings.filter(row => row.event === 'assessment_submitted' && ['NWAC Administrator', 'Regional Manager'].includes(row.role));
    expect('TEST notification config uses RM review events', Boolean(rmRequested && Number(rmRequested.enabled) === 1 && Number(rmRequested.bell_alert) === 1), { rmRequested });
    expect('TEST legacy assessment_submitted admin/RM rows are disabled', legacyAdmin.every(row => Number(row.enabled) === 0 && Number(row.bell_alert) === 0), { legacyAdmin });
  }

  function completeAssessmentPayload(applicationId, expectedRowVersion = null, overrides = {}) {
    const payload = {
      applicationId,
      expectedRowVersion,
      case_summary: 'Synthetic assessment case for two-step review smoke.',
      assessment_employment_goals: 'Complete short training and move into employment.',
      assessment_previous_iset: 'no',
      assessment_employment_barriers: ['Lack of Marketable Skills'],
      assessment_local_area_priorities: ['Off Reserve'],
      assessment_other_funding_details: 'No other funding identified.',
      assessment_esdc_eligibility: 'CRF',
      assessment_intervention_start_date: smokeDates.assessmentStart,
      assessment_intervention_end_date: smokeDates.assessmentEnd,
      assessment_institution: 'Smoke College',
      assessment_program_name: 'Smoke Certificate',
      assessment_itp: { tuition: '', books: '', materials: '', living: '', childcare: '', otherLabel: '', otherAmount: '', details: 'Training plan details.' },
      assessment_wage: { wages: '', mercs: '', nonwages: '', other1Label: '', other1Amount: '', other2Label: '', other2Amount: '', subsidyDetails: '' },
      assessment_recommendation: 'recommend',
      assessment_justification: 'Synthetic recommendation is aligned with employment goals.',
      assessment_intervention_code: '4',
      assessment_intervention_outcome_code: '1',
      assessment_intervention_duration_days: '106',
      assessment_intervention_cost_total: '100',
      assessment_intervention_pot_id: '1780058672308',
      postingContext: 'external',
      assessment_childcare_need: 'no',
      assessment_proposed_interventions: [
        {
          id: `two-step-assessment-${fixture.suffix}`,
          code: '4',
          startDate: smokeDates.assessmentStart,
          endDate: smokeDates.assessmentEnd,
          deliveryMode: 'partner',
          institution: 'Smoke College',
          programName: 'Smoke Certificate',
          itpDetails: 'Training plan details.',
          costLines: [{ id: 'tuition', label: 'Tuition', paymentType: 'tuition', payeeType: 'institution', payeeName: 'Smoke College', amount: '100' }],
        },
      ],
      ...overrides,
    };
    if (!expectedRowVersion) delete payload.expectedRowVersion;
    return payload;
  }

  async function getApplicationState(applicationId) {
    const [[row]] = await query(
      `SELECT a.id, a.case_id, a.status, a.lifecycle_status, a.decision_outcome, a.row_version,
              rw.id AS workflow_id, rw.current_stage, rw.current_owner_role, rw.nwac_decision
         FROM iset_application a
         LEFT JOIN iset_review_workflow rw
           ON rw.workflow_type = 'application_assessment'
          AND rw.application_id = a.id
          AND rw.archived_at IS NULL
        WHERE a.id = ?
        LIMIT 1`,
      [applicationId]
    );
    return row || null;
  }

  async function getInterventionState(interventionId) {
    const [[row]] = await query(
      `SELECT ci.id, ci.case_id, ci.action_plan_id, ci.status, ci.delivery_status,
              p.id AS proposal_id, p.proposal_kind, p.review_status, p.submitted_at,
              rw.id AS workflow_id, rw.workflow_type, rw.current_stage, rw.current_owner_role, rw.nwac_decision
         FROM iset_case_intervention ci
         LEFT JOIN iset_intervention_proposal p ON p.legacy_intervention_id = ci.id
         LEFT JOIN iset_review_workflow rw
           ON rw.archived_at IS NULL
          AND (
            (p.proposal_kind = 'revision' AND rw.workflow_type = 'intervention_revision' AND rw.proposal_id = p.id)
            OR ((p.proposal_kind IS NULL OR p.proposal_kind <> 'revision') AND rw.workflow_type = 'intervention_proposal' AND rw.proposal_id = p.id)
          )
        WHERE ci.id = ?
        LIMIT 1`,
      [interventionId]
    );
    return row || null;
  }

  async function satisfySubmitChecklist(auth) {
    const caseId = fixture.cases.application;
    const applicationId = fixture.applications.application;
    const url = `/api/applicants/${fixture.applicantUser}/document-checklist?applicationId=${applicationId}&stage=submit_assessment`;
    const before = await fetchJson(url, { headers: authHeaders(auth) });
    const missing = (before.items || []).filter(item => item.required !== false && item.status !== 'complete');
    for (const item of missing) {
      const type = Array.isArray(item.documentTypes) && item.documentTypes.length
        ? item.documentTypes[0]
        : item.id;
      const filePath = `/tmp/two-step-review-${config.stamp}-${type}.pdf`;
      makePdf(filePath, `Two-step smoke ${type}`);
      await uploadDocument(auth, filePath, type, item.label || type, caseId, applicationId);
    }
    const after = await fetchJson(url, { headers: authHeaders(auth) });
    const stillMissing = (after.items || []).filter(item => item.required !== false && item.status !== 'complete');
    expect('application assessment submit checklist satisfied', stillMissing.length === 0, {
      missingBefore: missing.map(item => item.label || item.id),
      missingAfter: stillMissing.map(item => item.label || item.id),
    });
  }

  function makePdf(filePath, title) {
    fs.writeFileSync(
      filePath,
      Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >> endobj\n4 0 obj << /Length ${title.length + 44} >> stream\nBT /F1 12 Tf 20 90 Td (${title}) Tj ET\nendstream endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`)
    );
  }

  async function uploadDocument(auth, filePath, documentType, label, caseId, applicationId) {
    const form = new FormData();
    const blob = new Blob([fs.readFileSync(filePath)], { type: 'application/pdf' });
    form.append('file', blob, path.basename(filePath));
    form.append('label', label);
    form.append('documentType', documentType);
    form.append('caseId', String(caseId));
    form.append('applicationId', String(applicationId));
    return fetchJson(`/api/applicants/${fixture.applicantUser}/documents/upload`, {
      method: 'POST',
      headers: authHeaders(auth),
      body: form,
    });
  }

  async function runApplicationAssessmentWorkflow(auth) {
    const caseId = fixture.cases.application;
    const applicationId = fixture.applications.application;
    await satisfySubmitChecklist(auth.coordinator);

    let state = await getApplicationState(applicationId);
    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(completeAssessmentPayload(applicationId, state.row_version, {
        assessment_submit_action: true,
        status: 'intake',
        applicationStatus: 'pending_approval',
      })),
    });
    state = await getApplicationState(applicationId);
    fixture.workflows.application = state.workflow_id;
    expect('application assessment: Coordinator submit moves to RM review', state.current_stage === 'rm_review', state);
    await assertNotification('rm_review_requested', fixture.staff.manager.staffProfileId, { caseId, applicationId });
    await assertRouteText(
      auth.manager,
      `/application-case/${caseId}?applicationId=${applicationId}&entry=approval&approvalType=application&step=decision`,
      ['Regional Manager review', 'Submit to NWAC approval', 'Submit for final decision'],
      'application assessment RM review'
    );

    const lockedEdit = await fetchExpectingFailure(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json({ applicationId, case_summary: 'This edit should be locked during RM review.' }),
    });
    expect('application assessment: submitter body edit is locked at RM review', lockedEdit.status === 409, lockedEdit);

    await fetchJson(`/api/cases/${caseId}/assessment/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ applicationId, action: 'rm_return_to_submitter', note: 'Please clarify the training rationale.' }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: RM return moves to returned_to_submitter', state.current_stage === 'returned_to_submitter' && state.status === 'in_review', state);
    await assertNotification('rm_review_returned_to_submitter', fixture.staff.coordinator.staffProfileId, { caseId, applicationId });

    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(completeAssessmentPayload(applicationId, state.row_version, {
        assessment_submit_action: true,
        status: 'intake',
        applicationStatus: 'pending_approval',
      })),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: Coordinator resubmit returns to RM review', state.current_stage === 'rm_review', state);

    await fetchJson(`/api/cases/${caseId}/assessment/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ applicationId, action: 'rm_submit_to_nwac', note: 'Regional Manager sign-off for final decision.' }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: RM submit moves to Decision Maker review', state.current_stage === 'nwac_review', state);
    await assertNotification('rm_review_submitted_to_nwac', null, { caseId, applicationId, audienceRole: 'NWAC Administrator' });
    await assertRouteText(
      auth.decisionMaker,
      `/application-case/${caseId}?applicationId=${applicationId}&entry=approval&approvalType=application&step=decision`,
      ['NWAC approval review', 'Decision Maker', 'Commit'],
      'application assessment Decision Maker review'
    );

    const rmFinalAttempt = await fetchExpectingFailure(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({
        applicationId,
        assessment_nwac_review_status: 'approve',
        assessment_nwac_review: 'yes',
        assessment_nwac_reason: 'RM must not final approve.',
        applicationStatus: 'approved',
      }),
    });
    expect('application assessment: RM cannot record final decision', rmFinalAttempt.status === 403, rmFinalAttempt);

    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({
        applicationId,
        assessment_nwac_review_status: 'push_back',
        assessment_nwac_reason: 'Please add funding-source detail.',
      }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: Decision Maker request changes returns to RM', state.current_stage === 'returned_to_rm', state);
    await assertNotification('nwac_review_changes_requested', fixture.staff.manager.staffProfileId, { caseId, applicationId });

    await fetchJson(`/api/cases/${caseId}/assessment/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ applicationId, action: 'rm_forward_changes_to_submitter', note: 'Coordinator, please address Decision Maker note.' }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: RM forward returns to submitter', state.current_stage === 'returned_to_submitter' && state.status === 'in_review', state);
    await assertNotification('rm_review_changes_forwarded', fixture.staff.coordinator.staffProfileId, { caseId, applicationId });

    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(completeAssessmentPayload(applicationId, state.row_version, {
        assessment_submit_action: true,
        status: 'intake',
        applicationStatus: 'pending_approval',
      })),
    });
    await fetchJson(`/api/cases/${caseId}/assessment/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ applicationId, action: 'rm_submit_to_nwac', note: 'Final RM sign-off.' }),
    });
    state = await getApplicationState(applicationId);
    await fetchJson(`/api/cases/${caseId}`, {
      method: 'PUT',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({
        applicationId,
        assessment_nwac_review_status: 'approve',
        assessment_nwac_review: 'yes',
        assessment_nwac_reason: 'Approved by Decision Maker.',
        assessment_intervention_cost_total: '100',
        assessment_intervention_pot_id: '1780058672308',
        postingContext: 'external',
        applicationStatus: 'approved',
        status: 'initiated',
      }),
    });
    state = await getApplicationState(applicationId);
    expect('application assessment: final decision recorded by Decision Maker', state.current_stage === 'final_decision_recorded' && state.decision_outcome === 'approved', state);
    await assertGeneratedDocuments({ caseId, applicationId, workflow: 'application_assessment', minCount: 2 });
  }

  function interventionSubmitPayload(title, overrides = {}) {
    return {
      code: '3',
      title,
      status: 'submitted',
      startDate: smokeDates.proposalStart,
      endDate: smokeDates.proposalEnd,
      durationDays: 30,
      cost: '100',
      notes: 'Synthetic two-step review intervention.',
      metadata: {
        ...fixture.marker,
        title,
        rationale: 'Synthetic intervention proposal rationale.',
        proposedInterventions: [
          {
            id: `two-step-intervention-${fixture.suffix}`,
            code: '3',
            startDate: smokeDates.proposalStart,
            endDate: smokeDates.proposalEnd,
            deliveryMode: 'partner',
            institution: 'Smoke College',
            programName: title,
            itpDetails: 'Synthetic plan.',
            costLines: [{ id: 'tuition', label: 'Tuition', paymentType: 'tuition', payeeType: 'institution', payeeName: 'Smoke College', amount: '100' }],
          },
        ],
        review: { eiStatus: 'CRF', decision: '', decisionNotes: '' },
      },
      ...overrides,
    };
  }

  async function runInterventionProposalWorkflow(auth) {
    const planId = fixture.actionPlans.proposal;
    const caseId = fixture.cases.proposal;
    const nwacStartAttempt = await fetchExpectingFailure(`/api/action-plans/${planId}/interventions`, {
      method: 'POST',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json(interventionSubmitPayload('NWAC forbidden proposal start')),
    });
    expect('intervention proposal: NWAC Administrator cannot start review', nwacStartAttempt.status === 403, nwacStartAttempt);

    const rmPlanId = fixture.actionPlans.rmProposal;
    const rmStart = await fetchJson(`/api/action-plans/${rmPlanId}/interventions`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json(interventionSubmitPayload('RM-started proposal smoke')),
    });
    const rmStartState = await getInterventionState(rmStart.id);
    fixture.interventions.rmProposal = rmStart.id;
    fixture.proposals.rmProposal = rmStartState.proposal_id;
    fixture.workflows.rmProposal = rmStartState.workflow_id;
    expect('intervention proposal: Regional Manager can start own draft review', rmStartState.current_stage === 'rm_review', rmStartState);

    const created = await fetchJson(`/api/action-plans/${planId}/interventions`, {
      method: 'POST',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(interventionSubmitPayload('Coordinator proposal smoke')),
    });
    fixture.interventions.proposal = created.id;
    let state = await getInterventionState(created.id);
    fixture.proposals.proposal = state.proposal_id;
    fixture.workflows.proposal = state.workflow_id;
    expect('intervention proposal: Coordinator submit moves to RM review', state.current_stage === 'rm_review' && state.workflow_type === 'intervention_proposal', state);
    await assertNotification('rm_review_requested', fixture.staff.manager.staffProfileId, { caseId, interventionId: created.id });
    await assertRouteText(
      auth.manager,
      `/cases/${caseId}?entry=approval&approvalType=intervention&interventionId=${created.id}&planId=${planId}`,
      ['Regional Manager', 'Submit to NWAC approval', 'Submit for final decision', 'Return'],
      'intervention proposal RM review'
    );

    const lockedEdit = await fetchExpectingFailure(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json({ title: 'This edit should be locked during RM review.' }),
    });
    expect('intervention proposal: submitter body edit is locked at RM review', lockedEdit.status === 409, lockedEdit);

    await fetchJson(`/api/interventions/${created.id}/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ action: 'rm_return_to_submitter', note: 'Please clarify proposed intervention.' }),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: RM return moves to returned_to_submitter', state.current_stage === 'returned_to_submitter' && state.status === 'changes_requested', state);

    await fetchJson(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(interventionSubmitPayload('Coordinator proposal smoke resubmitted', { status: 'submitted' })),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: resubmit returns to RM review', state.current_stage === 'rm_review', state);

    await fetchJson(`/api/interventions/${created.id}/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ action: 'rm_submit_to_nwac', note: 'RM sign-off for proposal.' }),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: RM submit moves to Decision Maker review', state.current_stage === 'nwac_review', state);
    await assertNotification('rm_review_submitted_to_nwac', null, { caseId, interventionId: created.id, audienceRole: 'NWAC Administrator' });

    const rmDecisionAttempt = await fetchExpectingFailure(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ status: 'approved', approvedAmount: '100', potId: '1780058672308', metadata: { review: { decisionNotes: 'RM must not approve.' } } }),
    });
    expect('intervention proposal: RM cannot record final decision', rmDecisionAttempt.status === 403, rmDecisionAttempt);

    await fetchJson(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({ status: 'changes_requested', metadata: { review: { decisionNotes: 'Please add clearer need.' } } }),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: Decision Maker request changes returns to RM', state.current_stage === 'returned_to_rm', state);
    await assertNotification('nwac_review_changes_requested', fixture.staff.manager.staffProfileId, { caseId, interventionId: created.id });

    await fetchJson(`/api/interventions/${created.id}/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ action: 'rm_forward_changes_to_submitter', note: 'Coordinator, please address Decision Maker note.' }),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: RM forward returns to submitter', state.current_stage === 'returned_to_submitter', state);
    await assertNotification('rm_review_changes_forwarded', fixture.staff.coordinator.staffProfileId, { caseId, interventionId: created.id });

    await fetchJson(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json(interventionSubmitPayload('Coordinator proposal smoke final resubmit', { status: 'submitted' })),
    });
    await fetchJson(`/api/interventions/${created.id}/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ action: 'rm_submit_to_nwac', note: 'Final RM proposal sign-off.' }),
    });
    await fetchJson(`/api/interventions/${created.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({
        status: 'approved',
        approvedAmount: '100',
        potId: '1780058672308',
        metadata: { review: { decisionNotes: 'Approved proposal.' } },
      }),
    });
    state = await getInterventionState(created.id);
    expect('intervention proposal: final decision recorded by Decision Maker', state.current_stage === 'final_decision_recorded' && state.status === 'approved', state);
    await assertGeneratedDocuments({ caseId, interventionId: created.id, workflow: 'intervention_proposal', minCount: 2, requireInterventionLink: true });
  }

  async function runInterventionRevisionWorkflow(auth) {
    const caseId = fixture.cases.revision;
    const planId = fixture.actionPlans.revision;
    const sourceId = fixture.interventions.revisionSource;
    const draft = await fetchJson(`/api/interventions/${sourceId}/revise`, {
      method: 'POST',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json({}),
    });
    fixture.interventions.revisionDraft = draft.id;

    const nwacStartAttempt = await fetchExpectingFailure(`/api/interventions/${draft.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({ status: 'submitted' }),
    });
    expect('intervention revision: NWAC Administrator cannot start review', nwacStartAttempt.status === 403, nwacStartAttempt);

    await fetchJson(`/api/interventions/${draft.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.coordinator), 'Content-Type': 'application/json' },
      body: json({
        status: 'submitted',
        title: 'Coordinator revision smoke',
        startDate: smokeDates.revisionStart,
        endDate: smokeDates.revisionEnd,
        durationDays: 31,
        cost: '100',
        metadata: {
          ...fixture.marker,
          review: { eiStatus: 'CRF', decisionNotes: '' },
          proposedInterventions: [
            {
              id: `two-step-revision-${fixture.suffix}`,
              code: '3',
              startDate: smokeDates.revisionStart,
              endDate: smokeDates.revisionEnd,
              programName: 'Revised smoke plan',
              costLines: [{ id: 'tuition', label: 'Tuition', paymentType: 'tuition', payeeType: 'institution', payeeName: 'Smoke College', amount: '100' }],
            },
          ],
        },
      }),
    });
    let state = await getInterventionState(draft.id);
    fixture.proposals.revision = state.proposal_id;
    fixture.workflows.revision = state.workflow_id;
    expect('intervention revision: Coordinator submit moves to RM review', state.current_stage === 'rm_review' && state.workflow_type === 'intervention_revision', state);
    await assertGeneratedDocuments({ caseId, interventionId: draft.id, workflow: 'intervention_revision_submitted', minCount: 1, requireInterventionLink: true });
    await assertRouteText(
      auth.manager,
      `/cases/${caseId}?entry=approval&approvalType=intervention&interventionId=${draft.id}&planId=${planId}`,
      ['Regional Manager', 'revision', 'Submit to NWAC approval', 'Submit for final decision'],
      'intervention revision RM review'
    );

    await fetchJson(`/api/interventions/${draft.id}/review-workflow/action`, {
      method: 'POST',
      headers: { ...authHeaders(auth.manager), 'Content-Type': 'application/json' },
      body: json({ action: 'rm_submit_to_nwac', note: 'RM sign-off for revision.' }),
    });
    state = await getInterventionState(draft.id);
    expect('intervention revision: RM submit moves to Decision Maker review', state.current_stage === 'nwac_review', state);

    await fetchJson(`/api/interventions/${sourceId}`, {
      method: 'PATCH',
      headers: { ...authHeaders(auth.decisionMaker), 'Content-Type': 'application/json' },
      body: json({
        revisionAppliedFromInterventionId: draft.id,
        metadata: { review: { decisionNotes: 'Approved revision.' } },
      }),
    });
    state = await getInterventionState(draft.id);
    expect('intervention revision: final decision recorded by Decision Maker', state.current_stage === 'final_decision_recorded', state);
    await assertGeneratedDocuments({ caseId, interventionId: sourceId, workflow: 'intervention_revision_final_source', minCount: 1, requireInterventionLink: true });
  }

  async function assertNotification(eventKey, audienceStaffProfileId, {
    caseId = null,
    applicationId = null,
    interventionId = null,
    audienceRole = null,
  } = {}) {
    const filters = ['event_key = ?'];
    const params = [eventKey];
    if (audienceStaffProfileId) {
      filters.push('audience_staff_profile_id = ?');
      params.push(audienceStaffProfileId);
    }
    if (audienceRole) {
      filters.push("audience_type = 'role'", 'audience_role = ?');
      params.push(audienceRole);
    }
    if (caseId) {
      filters.push("(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.caseId')) AS UNSIGNED) = ? OR CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.case_id')) AS UNSIGNED) = ?)");
      params.push(caseId, caseId);
    }
    let rows = [];
    for (let attempt = 0; attempt < 31; attempt += 1) {
      [rows] = await query(
        `SELECT id, event_key, title, audience_type, audience_role, audience_staff_profile_id, metadata
           FROM iset_internal_notification
          WHERE ${filters.join(' AND ')}
          ORDER BY id DESC
          LIMIT 5`,
        params
      );
      if (rows.length) break;
      if (attempt < 30) await delay(1000);
    }
    const audienceLabel = audienceRole || `staff ${audienceStaffProfileId}`;
    expect(`notification ${eventKey} routed to ${audienceLabel}`, rows.length > 0, {
      caseId,
      applicationId,
      interventionId,
      rows: rows.map(row => ({
        id: row.id,
        title: row.title,
        audienceType: row.audience_type,
        audienceRole: row.audience_role,
        audienceStaffProfileId: row.audience_staff_profile_id,
      })),
    });
  }

  async function assertGeneratedDocuments({ caseId, applicationId = null, interventionId = null, workflow, minCount = 1, requireInterventionLink = false }) {
    const params = [caseId];
    const where = ['d.case_id = ?', "d.source = 'system_generated'", "d.status = 'active'"];
    if (applicationId) {
      where.push("(d.application_id = ? OR CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.application_id')) AS UNSIGNED) = ?)");
      params.push(applicationId, applicationId);
    }
    if (interventionId) {
      where.push("(di.intervention_id = ? OR CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) AS UNSIGNED) = ?)");
      params.push(interventionId, interventionId);
    }
    const [rows] = await query(
      `SELECT d.id, d.file_path, d.document_category, d.metadata, di.intervention_id
         FROM iset_document d
         LEFT JOIN iset_document_intervention di ON di.document_id = d.id
        WHERE ${where.join(' AND ')}
        ORDER BY d.id`,
      params
    );
    rows.forEach(row => {
      if (row.file_path) fixture.documents.push(row.file_path);
    });
    const linkOk = !requireInterventionLink || rows.some(row => Number(row.intervention_id) === Number(interventionId));
    expect(`generated documents present for ${workflow}`, rows.length >= minCount && linkOk, {
      caseId,
      applicationId,
      interventionId,
      count: rows.length,
      linkOk,
      documentIds: rows.map(row => row.id),
      categories: rows.map(row => row.document_category),
    });
  }

  async function verifyNoKnownFixtureMismatches() {
    const caseIds = Object.values(fixture.cases).filter(Boolean);
    if (!caseIds.length) return;
    const placeholders = caseIds.map(() => '?').join(',');
    const [badStages] = await query(
      `SELECT id, workflow_type, current_stage
         FROM iset_review_workflow
        WHERE case_id IN (${placeholders})
          AND current_stage NOT IN ('rm_review','returned_to_submitter','nwac_review','returned_to_rm','final_decision_recorded','withdrawn')`,
      caseIds
    );
    expect('fixture workflows have only valid two-step stages', badStages.length === 0, { badStages });
    const [missingLinks] = await query(
      `SELECT d.id, d.file_path, JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) AS metadata_intervention_id
         FROM iset_document d
         LEFT JOIN iset_document_intervention di
           ON di.document_id = d.id
          AND di.intervention_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) AS UNSIGNED)
        WHERE d.case_id IN (${placeholders})
          AND d.status = 'active'
          AND JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.intervention_id')) IS NOT NULL
          AND di.document_id IS NULL`,
      caseIds
    );
    expect('fixture generated intervention documents have normalized links', missingLinks.length === 0, { missingLinks });
    expect('browser run had no serious console/page/API errors', result.browserIssues.length === 0, {
      browserIssues: result.browserIssues.slice(0, 10),
    });
  }

  async function cleanupFixture(options = {}) {
    progress('cleanup starting');
    const stampLike = `%${config.stamp}%`;
    const staffEmails = config.staffUsers.map(user => user.email);
    try {
      await collectFixtureDocumentPaths(stampLike);
      await deleteFixtureObjects();

      const [caseRows] = await query(
        `SELECT id FROM iset_case WHERE CAST(case_context_json AS CHAR) LIKE ?`,
        [stampLike]
      );
      const caseIds = Array.from(new Set([
        ...Object.values(fixture.cases).filter(Boolean),
        ...caseRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const [applicationRows] = await query(
        `SELECT id FROM iset_application WHERE CAST(payload_json AS CHAR) LIKE ?`,
        [stampLike]
      );
      const applicationIds = Array.from(new Set([
        ...Object.values(fixture.applications).filter(Boolean),
        ...applicationRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const [interventionRows] = await query(
        `SELECT id FROM iset_case_intervention WHERE CAST(metadata_json AS CHAR) LIKE ?`,
        [stampLike]
      );
      const interventionIds = Array.from(new Set([
        ...Object.values(fixture.interventions).filter(Boolean),
        ...interventionRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const [proposalRows] = interventionIds.length
        ? await query(`SELECT id FROM iset_intervention_proposal WHERE legacy_intervention_id IN (${interventionIds.map(() => '?').join(',')})`, interventionIds)
        : [[]];
      const proposalIds = Array.from(new Set([
        ...Object.values(fixture.proposals).filter(Boolean),
        ...proposalRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const [staffRows] = staffEmails.length
        ? await query(`SELECT id FROM staff_profiles WHERE email IN (${staffEmails.map(() => '?').join(',')})`, staffEmails)
        : [[]];
      const staffProfileIds = Array.from(new Set([
        ...Object.values(fixture.staff).map(row => row.staffProfileId).filter(Boolean),
        ...staffRows.map(row => Number(row.id)).filter(Boolean),
      ]));
      const [userRows] = await query(
        `SELECT id FROM user WHERE email LIKE ? OR cognito_sub LIKE ? ${staffEmails.length ? `OR email IN (${staffEmails.map(() => '?').join(',')})` : ''}`,
        [`codex.twostep.${fixture.suffix}%`, `two-step-applicant-${fixture.suffix}%`, ...staffEmails]
      );
      const userIds = Array.from(new Set([
        fixture.applicantUser,
        ...Object.values(fixture.staff).map(row => row.staffUserId).filter(Boolean),
        ...userRows.map(row => Number(row.id)).filter(Boolean),
      ].filter(Boolean)));

      await deleteWhereIn('iset_document_intervention', 'document_id', await idsForDocuments(caseIds, stampLike));
      if (interventionIds.length) await deleteWhereIn('iset_document_intervention', 'intervention_id', interventionIds);
      await deleteWhereIn('iset_event_entry', 'subject_id', caseIds.map(String), "subject_type = 'case'");
      if (staffProfileIds.length) await deleteWhereIn('iset_event_entry', 'actor_staff_profile_id', staffProfileIds);
      await deleteWhereLike('iset_event_entry', 'payload_json', stampLike);
      if (staffProfileIds.length) await deleteWhereIn('iset_internal_notification', 'audience_staff_profile_id', staffProfileIds);
      await deleteWhereLike('iset_internal_notification', 'metadata', stampLike);
      await deleteWhereIn('iset_case_note', 'case_id', caseIds);
      await deleteWorkflowRows(caseIds, applicationIds, interventionIds, proposalIds);
      await deleteWhereIn('application_lock', 'application_id', applicationIds);
      const documentIds = await idsForDocuments(caseIds, stampLike);
      await deleteGeneratedAgreementRows(caseIds, documentIds);
      await deleteWhereIn('iset_document', 'id', documentIds);
      await deleteWhereIn('iset_intervention_proposal', 'id', proposalIds);
      await deleteWhereIn('iset_case_intervention', 'id', interventionIds);
      await deleteWhereIn('iset_case_action_plan', 'id', Object.values(fixture.actionPlans).filter(Boolean));
      await deleteWhereIn('iset_application_assessment', 'application_id', applicationIds);
      await deleteWhereIn('iset_application', 'id', applicationIds);
      await deleteWhereIn('iset_application_submission', 'id', Object.values(fixture.submissions).filter(Boolean));
      await deleteWhereIn('iset_case', 'id', caseIds);
      if (fixture.client) await deleteWhereIn('client', 'id', [fixture.client]);
      await query('DELETE FROM client WHERE address_json IS NOT NULL AND CAST(address_json AS CHAR) LIKE ?', [stampLike]);
      await deleteWhereIn('staff_region', 'staff_profile_id', staffProfileIds);
      await deleteWhereIn('staff_profiles', 'id', staffProfileIds);
      await deleteWhereIn('input_json_state', 'user_id', userIds);
      await deleteWhereIn('iset_application_draft_dynamic', 'user_id', userIds);
      await deleteWhereIn('pending_uploads', 'user_id', userIds);
      await deleteWhereIn('user', 'id', userIds);

      const leftovers = await countFixtureLeftovers(stampLike, staffEmails);
      if (!options.quiet) {
        result.cleanup = leftovers;
        expect('TEST synthetic fixture cleaned up', Object.values(leftovers).every(count => count === 0), leftovers);
      }
      progress('cleanup complete');
    } catch (error) {
      if (!options.quiet) fail('TEST synthetic fixture cleaned up', { error: error.message || String(error) });
      progress(`cleanup failed: ${error.message || String(error)}`);
      throw error;
    }
  }

  async function collectFixtureDocumentPaths(stampLike) {
    const caseIds = Object.values(fixture.cases).filter(Boolean);
    const params = [stampLike];
    const clauses = ['CAST(metadata AS CHAR) LIKE ?'];
    if (caseIds.length) {
      clauses.push(`case_id IN (${caseIds.map(() => '?').join(',')})`);
      params.push(...caseIds);
    }
    const [rows] = await query(
      `SELECT file_path FROM iset_document WHERE ${clauses.join(' OR ')}`,
      params
    );
    rows.forEach(row => {
      if (row.file_path) fixture.documents.push(row.file_path);
    });
    fixture.documents = Array.from(new Set(fixture.documents.filter(Boolean)));
  }

  async function deleteFixtureObjects() {
    const bucket = process.env.OBJECT_BUCKET || '';
    if (!bucket) return;
    for (const key of fixture.documents) {
      if (!key || /^https?:\/\//i.test(key)) continue;
      try {
        const { execFileSync } = require('child_process');
        execFileSync('aws', ['s3', 'rm', `s3://${bucket}/${key}`, '--region', process.env.OBJECT_REGION || process.env.AWS_REGION || 'ca-central-1', '--only-show-errors'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 1024 * 1024,
        });
      } catch (_) {
        // Object cleanup is best effort; DB cleanup below removes live references.
      }
    }
  }

  async function idsForDocuments(caseIds, stampLike) {
    const params = [stampLike];
    const clauses = ['CAST(metadata AS CHAR) LIKE ?'];
    if (caseIds.length) {
      clauses.push(`case_id IN (${caseIds.map(() => '?').join(',')})`);
      params.push(...caseIds);
    }
    const [rows] = await query(`SELECT id FROM iset_document WHERE ${clauses.join(' OR ')}`, params);
    return rows.map(row => Number(row.id)).filter(Boolean);
  }

  async function deleteWorkflowRows(caseIds, applicationIds, interventionIds, proposalIds) {
    const clauses = [];
    const params = [];
    if (caseIds.length) {
      clauses.push(`case_id IN (${caseIds.map(() => '?').join(',')})`);
      params.push(...caseIds);
    }
    if (applicationIds.length) {
      clauses.push(`application_id IN (${applicationIds.map(() => '?').join(',')})`);
      params.push(...applicationIds);
    }
    if (interventionIds.length) {
      clauses.push(`intervention_id IN (${interventionIds.map(() => '?').join(',')})`);
      params.push(...interventionIds);
    }
    if (proposalIds.length) {
      clauses.push(`proposal_id IN (${proposalIds.map(() => '?').join(',')})`);
      params.push(...proposalIds);
    }
    if (!clauses.length) return;
    const [rows] = await query(`SELECT id FROM iset_review_workflow WHERE ${clauses.join(' OR ')}`, params);
    const workflowIds = rows.map(row => Number(row.id)).filter(Boolean);
    await deleteWhereIn('iset_review_workflow_event', 'review_workflow_id', workflowIds);
    await deleteWhereIn('iset_review_workflow', 'id', workflowIds);
  }

  async function deleteGeneratedAgreementRows(caseIds, documentIds) {
    await deleteWhereIn('cfa_version_documents', 'document_id', documentIds);
    await deleteWhereIn('funding_overview_version_documents', 'document_id', documentIds);

    const cfaSeriesIds = await idsFromQuery('SELECT id FROM cfa_series', 'case_id', caseIds);
    const cfaVersionIds = await idsFromQuery('SELECT id FROM cfa_version', 'series_id', cfaSeriesIds);
    await deleteWhereIn('cfa_version_documents', 'cfa_version_id', cfaVersionIds);
    await deleteWhereIn('cfa_version', 'id', cfaVersionIds);
    await deleteWhereIn('cfa_series', 'id', cfaSeriesIds);

    const fundingSeriesIds = await idsFromQuery('SELECT id FROM funding_overview_series', 'case_id', caseIds);
    const fundingVersionIds = await idsFromQuery('SELECT id FROM funding_overview_version', 'series_id', fundingSeriesIds);
    await deleteWhereIn('funding_overview_version_documents', 'funding_overview_version_id', fundingVersionIds);
    await deleteWhereIn('funding_overview_version', 'id', fundingVersionIds);
    await deleteWhereIn('funding_overview_series', 'id', fundingSeriesIds);
  }

  async function idsFromQuery(baseSql, column, values) {
    const filtered = (values || []).filter(value => value !== null && typeof value !== 'undefined');
    if (!filtered.length) return [];
    const [rows] = await query(`${baseSql} WHERE ${column} IN (${filtered.map(() => '?').join(',')})`, filtered);
    return rows.map(row => Number(row.id)).filter(Boolean);
  }

  async function deleteWhereIn(table, column, values, extra = '') {
    const filtered = (values || []).filter(value => value !== null && typeof value !== 'undefined');
    if (!filtered.length) return;
    const sql = `DELETE FROM ${table} WHERE ${extra ? `${extra} AND ` : ''}${column} IN (${filtered.map(() => '?').join(',')})`;
    await query(sql, filtered);
  }

  async function deleteWhereLike(table, column, value) {
    await query(`DELETE FROM ${table} WHERE CAST(${column} AS CHAR) LIKE ?`, [value]);
  }

  async function countFixtureLeftovers(stampLike, staffEmails) {
    const counts = {};
    const [[caseCount]] = await query('SELECT COUNT(*) AS count FROM iset_case WHERE case_context_json IS NOT NULL AND CAST(case_context_json AS CHAR) LIKE ?', [stampLike]);
    counts.cases = Number(caseCount.count || 0);
    const [[appCount]] = await query('SELECT COUNT(*) AS count FROM iset_application WHERE payload_json IS NOT NULL AND CAST(payload_json AS CHAR) LIKE ?', [stampLike]);
    counts.applications = Number(appCount.count || 0);
    const [[interventionCount]] = await query('SELECT COUNT(*) AS count FROM iset_case_intervention WHERE metadata_json IS NOT NULL AND CAST(metadata_json AS CHAR) LIKE ?', [stampLike]);
    counts.interventions = Number(interventionCount.count || 0);
    const [[docCount]] = await query('SELECT COUNT(*) AS count FROM iset_document WHERE metadata IS NOT NULL AND CAST(metadata AS CHAR) LIKE ?', [stampLike]);
    counts.documents = Number(docCount.count || 0);
    const [[notificationCount]] = await query('SELECT COUNT(*) AS count FROM iset_internal_notification WHERE metadata IS NOT NULL AND CAST(metadata AS CHAR) LIKE ?', [stampLike]);
    counts.notifications = Number(notificationCount.count || 0);
    if (staffEmails.length) {
      const [[staffCount]] = await query(`SELECT COUNT(*) AS count FROM staff_profiles WHERE email IN (${staffEmails.map(() => '?').join(',')})`, staffEmails);
      counts.staffProfiles = Number(staffCount.count || 0);
      const [[userCount]] = await query(`SELECT COUNT(*) AS count FROM user WHERE email IN (${staffEmails.map(() => '?').join(',')}) OR email LIKE ?`, [...staffEmails, `codex.twostep.${fixture.suffix}%`]);
      counts.users = Number(userCount.count || 0);
    }
    return counts;
  }
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
