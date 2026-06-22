#!/usr/bin/env node
/*
 * DEV end-to-end smoke for editable Financial Overview signing.
 *
 * Uses real DEV Cognito identities, local DEV MySQL, local MinIO, the admin
 * secure-message API, and the public portal document UI. The script refuses to
 * run unless the credentials in the DEV env files resolve to the DEV AWS
 * account, because DEV/TEST and PROD use separate accounts and IAM identities.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');
const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { spawnSync } = require('child_process');

const DEV_AWS_ACCOUNT_ID = '124355655255';
const FINANCIAL_OVERVIEW_WORKFLOW_ID = 52;
const INTAKE_WORKFLOW_ID = 21;
const DEFAULT_SCREENSHOT_ROOT = path.join(process.cwd(), 'tmp', 'financial-overview-editable-dev-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';

function parseArgs(argv) {
  const args = {
    adminFrontendBase: process.env.FO_SMOKE_ADMIN_FRONTEND_BASE || 'http://localhost:3001',
    adminApiBase: process.env.FO_SMOKE_ADMIN_API_BASE || 'http://localhost:5001',
    portalFrontendBase: process.env.FO_SMOKE_PORTAL_FRONTEND_BASE || 'http://localhost:3000',
    portalApiBase: process.env.FO_SMOKE_PORTAL_API_BASE || 'http://localhost:5000',
    screenshotDir: process.env.FO_SMOKE_SCREENSHOT_DIR || '',
    keepFixture: false,
    headed: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--admin-frontend-base') {
      args.adminFrontendBase = argv[index + 1] || args.adminFrontendBase;
      index += 1;
    } else if (token === '--admin-api-base') {
      args.adminApiBase = argv[index + 1] || args.adminApiBase;
      index += 1;
    } else if (token === '--portal-frontend-base') {
      args.portalFrontendBase = argv[index + 1] || args.portalFrontendBase;
      index += 1;
    } else if (token === '--portal-api-base') {
      args.portalApiBase = argv[index + 1] || args.portalApiBase;
      index += 1;
    } else if (token === '--screenshot-dir') {
      args.screenshotDir = argv[index + 1] || args.screenshotDir;
      index += 1;
    } else if (token === '--keep-fixture') {
      args.keepFixture = true;
    } else if (token === '--headed') {
      args.headed = true;
    } else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/financial-overview-editable-dev-smoke.js [options]',
        '',
        'Options:',
        '  --screenshot-dir DIR          Where to write screenshots.',
        '  --admin-frontend-base URL     Admin React origin. Default: http://localhost:3001',
        '  --admin-api-base URL          Admin API origin. Default: http://localhost:5001',
        '  --portal-frontend-base URL    Portal React origin. Default: http://localhost:3000',
        '  --portal-api-base URL         Portal API origin. Default: http://localhost:5000',
        '  --keep-fixture                Leave synthetic DB/Cognito data in place for manual inspection.',
        '  --headed                      Run Chrome visibly.',
      ].join('\n'));
      process.exit(0);
    }
  }
  for (const key of ['adminFrontendBase', 'adminApiBase', 'portalFrontendBase', 'portalApiBase']) {
    args[key] = String(args[key] || '').replace(/\/+$/, '');
  }
  if (!args.screenshotDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    args.screenshotDir = path.join(DEFAULT_SCREENSHOT_ROOT, stamp);
  }
  return args;
}

function parseEnvFile(file) {
  const out = {};
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

function awsConfigFromEnv(env) {
  const credentials = env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;
  return {
    region: env.AWS_REGION || env.COGNITO_REGION || 'ca-central-1',
    ...(credentials ? { credentials } : {}),
  };
}

async function assertDevAwsAccount(label, env) {
  const client = new STSClient(awsConfigFromEnv(env));
  const identity = await client.send(new GetCallerIdentityCommand({}));
  if (identity.Account !== DEV_AWS_ACCOUNT_ID) {
    throw new Error(`${label} credentials resolved to AWS account ${identity.Account}; expected DEV ${DEV_AWS_ACCOUNT_ID}`);
  }
  console.log(`[aws] ${label} DEV account verified: ${identity.Account}`);
}

function makePassword() {
  return `FoSmoke-${crypto.randomBytes(6).toString('hex')}Aa1!`;
}

function makeSuffix() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function mysqlConfig(env) {
  return {
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    port: Number(env.DB_PORT || 3306),
    multipleStatements: false,
  };
}

function requireEnv(env, key, label) {
  if (!env[key]) throw new Error(`${label} missing ${key}`);
  return env[key];
}

function findChromeExecutable() {
  return [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/home/bill/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-142.0.7444.59/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
  ].filter(Boolean).find(candidate => fs.existsSync(candidate));
}

function ensureLocalChromeLibraryPath() {
  if (!fs.existsSync(LOCAL_CHROME_LIBRARY_PATH)) return;
  const current = process.env.LD_LIBRARY_PATH || '';
  const entries = current.split(':').filter(Boolean);
  if (!entries.includes(LOCAL_CHROME_LIBRARY_PATH)) {
    process.env.LD_LIBRARY_PATH = [LOCAL_CHROME_LIBRARY_PATH, ...entries].join(':');
  }
}

function decodeJwtPayload(token) {
  const payload = String(token || '').split('.')[1] || '';
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(Buffer.from(b64 + pad, 'base64').toString('utf8'));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function moneyNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '');
  return cleaned ? Number(cleaned) : NaN;
}

function assertMoneyEquals(actual, expected, message) {
  const actualNumber = moneyNumber(actual);
  const expectedNumber = moneyNumber(expected);
  assert(
    Number.isFinite(actualNumber) &&
      Number.isFinite(expectedNumber) &&
      Math.abs(actualNumber - expectedNumber) < 0.005,
    `${message}: expected ${expected}, got ${actual}`
  );
}

function asJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${url} failed ${response.status}: ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body)}`);
  }
  return { response, body };
}

async function createCognitoUser({ client, userPoolId, username, email, password, group, givenName, familyName }) {
  await client.send(new AdminCreateUserCommand({
    UserPoolId: userPoolId,
    Username: username,
    MessageAction: 'SUPPRESS',
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      ...(givenName ? [{ Name: 'given_name', Value: givenName }] : []),
      ...(familyName ? [{ Name: 'family_name', Value: familyName }] : []),
    ],
  }));
  if (group) {
    await client.send(new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: group,
    }));
  }
  await client.send(new AdminSetUserPasswordCommand({
    UserPoolId: userPoolId,
    Username: username,
    Password: password,
    Permanent: true,
  }));
  const out = await client.send(new AdminGetUserCommand({
    UserPoolId: userPoolId,
    Username: username,
  }));
  const sub = out.UserAttributes?.find(attr => attr.Name === 'sub')?.Value || null;
  assert(sub, `Cognito user ${username} did not return a sub`);
  return { sub };
}

async function deleteCognitoUserQuietly(client, userPoolId, username) {
  if (!client || !userPoolId || !username) return;
  try {
    await client.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }));
  } catch (err) {
    if (err?.name !== 'UserNotFoundException') {
      console.warn(`[cleanup] Cognito delete failed for ${username}: ${err?.name || err?.message || err}`);
    }
  }
}

function buildAdminAuthorizeUrl(adminEnv) {
  const rawDomain = requireEnv(adminEnv, 'COGNITO_DOMAIN', 'admin .env');
  const domain = rawDomain.startsWith('http') ? rawDomain : `https://${rawDomain}`;
  const redirectUri = requireEnv(adminEnv, 'COGNITO_REDIRECT_URI', 'admin .env');
  const params = new URLSearchParams({
    client_id: requireEnv(adminEnv, 'COGNITO_CLIENT_ID', 'admin .env'),
    response_type: 'code',
    scope: 'email openid profile',
    redirect_uri: redirectUri,
  });
  return `${domain.replace(/\/+$/, '')}/oauth2/authorize?${params.toString()}`;
}

async function loginAdminViaHostedUi({ page, adminEnv, username, password, adminApiBase }) {
  await page.goto(buildAdminAuthorizeUrl(adminEnv), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 30000 });
  const usernameSelector = await page.$('input[name="username"]') ? 'input[name="username"]' : 'input[type="email"]';
  await page.click(usernameSelector, { clickCount: 3 });
  await page.type(usernameSelector, username);
  await page.click('input[name="password"], input[type="password"]', { clickCount: 3 });
  await page.type('input[name="password"], input[type="password"]', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
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
  }, { timeout: 60000 });
  const session = await page.evaluate(() => JSON.parse(window.sessionStorage.getItem('authSession')));
  const { body: me } = await getJson(`${adminApiBase}/api/auth/me`, {
    headers: { Authorization: `Bearer ${session.idToken}` },
  });
  assert(me?.auth?.role === 'System Administrator', `admin login returned unexpected role ${me?.auth?.role}`);
  assert(Number(me?.auth?.staffProfileId) > 0, 'admin login did not hydrate staffProfileId');
  return { session, me };
}

async function createFixtureRows({ db, suffix, staffProfileId, staffUserId, applicant }) {
  const email = applicant.email;
  const name = `${applicant.firstName} ${applicant.lastName}`;
  const referenceNumber = `FO-${suffix.replace(/[^a-z0-9]/gi, '').slice(-14).toUpperCase()}`;
  const caseNumber = `FO-SMOKE-${suffix.replace(/[^a-z0-9]/gi, '').slice(-12).toUpperCase()}`;
  const marker = { financialOverviewEditableSmoke: true, suffix };
  const applicationAnswers = {
    'first-name': applicant.firstName,
    'last-name': applicant.lastName,
    email,
    'contact-email-address': email,
    'telephone-day': '613-555-0142',
    'address-line-1': '22 Cedar Street',
    'address-city': 'Ottawa',
    'address-province': 'ON',
    'address-postal-code': 'K1A 0B1',
    'long-term-goal': 'Complete training and return to full-time employment.',
    'income-employment': '1200.00',
    'income-spousal': '300.00',
    'income-social-assist': '150.00',
    'income-child-support': '210.00',
    'income-child-benefit': '180.00',
    'expenses-rent': '875.00',
    'expenses-electricity': '155.00',
    'expenses-phone': '60.00',
    'expenses-childcare': '320.00',
    'expenses-groceries': '430.00',
    'expenses-transport': 'own_vehicle',
    'social-assistance': 'no',
    'loan-grant': 'no',
    'requested-supports': ['tuition', 'books'],
    'training-institution': 'Example Training College',
    'program-name': 'Community Support Worker Certificate',
  };
  const caseContext = {
    ...marker,
    applicationAnswers,
    applicationAssessmentContext: {},
  };

  await db.query(
    `INSERT INTO user
      (name, email, cognito_sub, email_verified, suspended, preferred_language)
     VALUES (?, ?, ?, 1, 0, 'en')`,
    [name, email, applicant.sub]
  );
  const [[userRow]] = await db.query('SELECT id FROM user WHERE cognito_sub = ? LIMIT 1', [applicant.sub]);
  const userId = Number(userRow.id);

  const [clientResult] = await db.query(
    `INSERT INTO client
      (first_name, last_name, dob, gender, aboriginal_group, address_json,
       applicant_cognito_sub, applicant_cognito_username, applicant_account_status,
       applicant_account_email, applicant_activated_at)
     VALUES (?, ?, '1990-04-12', 'Woman', 'First Nations', CAST(? AS JSON), ?, ?, 'activated', ?, NOW())`,
    [
      applicant.firstName,
      applicant.lastName,
      JSON.stringify({
        line1: '22 Cedar Street',
        city: 'Ottawa',
        province: 'ON',
        postalCode: 'K1A 0B1',
        country: 'Canada',
      }),
      applicant.sub,
      email,
      email,
    ]
  );
  const clientId = Number(clientResult.insertId);

  const [submissionResult] = await db.query(
    `INSERT INTO iset_application_submission
      (user_id, workflow_id, reference_number, status, submitted_at, intake_payload,
       schema_snapshot, history, doc_refs, locale, source_ip, user_agent, checksum_sha256)
     VALUES (?, ?, ?, 'submitted', NOW(), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON),
       CAST(? AS JSON), 'en', '127.0.0.1', 'financial-overview-editable-dev-smoke', ?)`,
    [
      userId,
      String(INTAKE_WORKFLOW_ID),
      referenceNumber,
      JSON.stringify({
        ...marker,
        answers: applicationAnswers,
        submission_snapshot: {
          user_id: userId,
          reference_number: referenceNumber,
        },
      }),
      JSON.stringify({ smoke: true }),
      JSON.stringify([]),
      JSON.stringify([]),
      crypto.createHash('sha256').update(`${suffix}:${email}`).digest('hex'),
    ]
  );
  const submissionId = Number(submissionResult.insertId);

  const [caseResult] = await db.query(
    `INSERT INTO iset_case
      (case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, stage,
       opened_at, case_context_json, created_by_staff_profile_id, updated_by_staff_profile_id)
     VALUES (?, ?, ?, 'active', 'active', 'case_management', NOW(), CAST(? AS JSON), ?, ?)`,
    [caseNumber, clientId, staffProfileId, JSON.stringify(caseContext), staffProfileId, staffProfileId]
  );
  const caseId = Number(caseResult.insertId);

  const [applicationResult] = await db.query(
    `INSERT INTO iset_application
      (submission_id, client_id, case_id, payload_json, status, lifecycle_status, version, row_version)
     VALUES (?, ?, ?, CAST(? AS JSON), 'in_review', 'assessment', 1, 1)`,
    [submissionId, clientId, caseId, JSON.stringify({ ...marker, answers: applicationAnswers })]
  );
  const applicationId = Number(applicationResult.insertId);

  return {
    userId,
    clientId,
    submissionId,
    caseId,
    applicationId,
    caseNumber,
    referenceNumber,
    applicantName: name,
    applicationAnswers,
    marker,
    staffUserId,
  };
}

async function sendFinancialOverview({ adminApiBase, adminIdToken, fixture, mode, subjectSuffix }) {
  const payload = {
    subject: `Financial Overview editable smoke ${subjectSuffix}`,
    body: `Please review and complete the Financial Overview (${subjectSuffix}).`,
    urgent: false,
    toDisplayName: fixture.applicantName,
    fromDisplayName: 'Codex DEV Smoke Tester',
    applicationId: fixture.applicationId,
    attachments: [
      {
        workflow_id: FINANCIAL_OVERVIEW_WORKFLOW_ID,
        financial_overview_mode: mode,
      },
    ],
  };
  const { body } = await getJson(`${adminApiBase}/api/cases/${fixture.caseId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminIdToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return body;
}

async function fetchLatestFinancialOverviewRequest(db, caseId) {
  const [[row]] = await db.query(
    `SELECT sr.*, msr.message_id, fov.id AS funding_overview_version_id,
            fov.version_number, fov.status AS funding_overview_status, fov.metadata_json
       FROM signing_request sr
       LEFT JOIN message_signing_request msr ON msr.signing_request_id = sr.id
       LEFT JOIN funding_overview_version fov
         ON fov.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(sr.resolved_schema_json, '$.meta.fundingOverviewVersionId')) AS UNSIGNED)
      WHERE sr.case_id = ?
        AND sr.workflow_id = ?
      ORDER BY sr.id DESC
      LIMIT 1`,
    [caseId, FINANCIAL_OVERVIEW_WORKFLOW_ID]
  );
  assert(row?.id, 'No Financial Overview signing_request found');
  return row;
}

function assertFinancialOverviewSchema(row, expectedMode, expectedInitialValues) {
  const schema = asJson(row.resolved_schema_json, {});
  assert(schema?.meta?.fundingOverviewEditable === true, 'schema meta did not mark Financial Overview editable');
  assert(schema?.meta?.fundingOverviewMode === expectedMode, `schema mode expected ${expectedMode}, got ${schema?.meta?.fundingOverviewMode}`);
  const stepIds = Array.isArray(schema?.steps) ? schema.steps.map(step => step?.stepId).filter(Boolean) : [];
  assert(
    ['financial-overview-income', 'financial-overview-expenses', 'financial-overview-signature']
      .every(stepId => stepIds.includes(stepId)),
    `editable schema did not include the expected steps: ${stepIds.join(', ')}`
  );
  const componentIds = (schema.steps || [])
    .flatMap(step => step?.components || [])
    .map(component => component?.storageKey || component?.id)
    .filter(Boolean);
  ['income-employment', 'income-spousal', 'income-social-assist', 'expenses-rent', 'expenses-electricity', 'client-sig']
    .forEach(componentId => {
      assert(componentIds.includes(componentId), `editable schema missing ${componentId}`);
    });
  assert(!componentIds.includes('requested-supports'), 'editable Financial Overview should not include requested-supports');
  const initial = schema.initial_values || schema.initialValues || schema.meta?.initialValues || {};
  for (const [key, expected] of Object.entries(expectedInitialValues)) {
    const actual = initial[key];
    if (Array.isArray(expected)) {
      assert(Array.isArray(actual) && expected.every(item => actual.includes(item)), `initial ${key} missing expected ${expected.join(',')}`);
    } else {
      assert(String(actual ?? '') === String(expected), `initial ${key} expected ${expected}, got ${actual}`);
    }
  }
  return { schema, initial };
}

async function portalPasswordLogin({ portalApiBase, email, password }) {
  const response = await fetch(`${portalApiBase}/api/auth/password-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`portal password login failed ${response.status}: ${text.slice(0, 500)}`);
  }
  const setCookie = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  assert(setCookie.length >= 2, 'portal password login did not return auth cookies');
  return setCookie.map(header => {
    const [pair] = header.split(';');
    const [name, ...valueParts] = pair.split('=');
    return { name, value: valueParts.join('=') };
  });
}

async function setPortalCookies(page, portalFrontendBase, cookies) {
  const url = new URL(portalFrontendBase);
  await page.setCookie(...cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: url.hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: url.protocol === 'https:',
  })));
}

async function waitForText(page, text, timeout = 30000) {
  await page.waitForFunction(
    expected => (document.body?.innerText || '').includes(expected),
    { timeout },
    text
  );
}

async function clickByText(page, selector, text) {
  const clicked = await page.evaluate((sel, expected) => {
    const nodes = Array.from(document.querySelectorAll(sel));
    const node = nodes.find(el => (el.innerText || el.textContent || '').trim().includes(expected));
    if (!node) return false;
    node.click();
    return true;
  }, selector, text);
  assert(clicked, `Could not click ${selector} containing ${text}`);
}

async function typeInto(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 15000 });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type(selector, String(value));
}

async function chooseRadioOrCheckbox(page, selector) {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`missing selector ${sel}`);
    if (!el.checked) el.click();
  }, selector);
}

async function screenshot(page, file, options = {}) {
  await page.screenshot({
    path: file,
    fullPage: options.fullPage !== false,
  });
  console.log(`[screenshot] ${file}`);
}

async function driveParticipantForm({ page, portalFrontendBase, signingRequestId, screenshotDir }) {
  const emailDir = path.join(screenshotDir, 'email-assets');
  fs.mkdirSync(emailDir, { recursive: true });
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(`${portalFrontendBase}/documents/${signingRequestId}`, { waitUntil: 'networkidle2' });
  await waitForText(page, 'Financial Overview');
  await page.waitForSelector('#income-employment', { visible: true, timeout: 30000 });
  const initialEmployment = await page.$eval('#income-employment', el => el.value);
  assert(/1200|1,200/.test(initialEmployment), `prefilled employment income not visible, got ${initialEmployment}`);
  await screenshot(page, path.join(emailDir, '01-participant-income-prefilled.png'));

  await typeInto(page, '#income-employment', '1640.50');
  await typeInto(page, '#income-spousal', '250.00');
  await typeInto(page, '#income-social-assist', '0.00');
  await clickByText(page, 'button', 'Next');

  await page.waitForSelector('#expenses-rent', { visible: true, timeout: 15000 });
  await typeInto(page, '#expenses-rent', '925.00');
  await typeInto(page, '#expenses-electricity', '185.25');
  await typeInto(page, '#expenses-groceries', '465.00');
  await screenshot(page, path.join(emailDir, '02-participant-expenses-edited.png'));
  await clickByText(page, 'button', 'Next');

  await page.waitForSelector('#client-sig', { visible: true, timeout: 15000 });
  await typeInto(page, '#client-sig', 'Fiona Overview');
  await clickByText(page, 'button', 'Sign Now');
  await screenshot(page, path.join(emailDir, '04-participant-signature-ready.png'));
  await clickByText(page, 'button', 'Submit');
  await waitForText(page, 'Submitted');
  await screenshot(page, path.join(emailDir, '05-participant-submitted.png'));
  return emailDir;
}

async function assertSignedState({ db, signingRequestId, fixture }) {
  const [[row]] = await db.query(
    `SELECT sr.*, fov.status AS funding_overview_status, fov.metadata_json,
            fov.signed_by_participant_id, fov.signed_at AS funding_overview_signed_at
       FROM signing_request sr
       LEFT JOIN funding_overview_version fov
         ON fov.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(sr.resolved_schema_json, '$.meta.fundingOverviewVersionId')) AS UNSIGNED)
      WHERE sr.id = ?
      LIMIT 1`,
    [signingRequestId]
  );
  assert(row?.status === 'signed', `signing request status expected signed, got ${row?.status}`);
  assert(row?.artifact_url, 'signing request artifact_url was not persisted');
  assert(row?.funding_overview_status === 'signed', `funding overview version expected signed, got ${row?.funding_overview_status}`);
  assert(Number(row?.signed_by_participant_id) === Number(fixture.userId), 'funding overview signed_by_participant_id did not match participant');
  const payload = asJson(row.signed_payload_json, {});
  assertMoneyEquals(payload['income-employment'], '1640.50', 'signed payload did not preserve edited employment income');
  assertMoneyEquals(payload['expenses-rent'], '925.00', 'signed payload did not preserve edited rent');

  const [[caseRow]] = await db.query('SELECT case_context_json FROM iset_case WHERE id = ? LIMIT 1', [fixture.caseId]);
  const context = asJson(caseRow.case_context_json, {});
  assertMoneyEquals(context?.applicationAnswers?.['income-employment'], '1640.50', 'case context applicationAnswers not updated');
  assertMoneyEquals(context?.applicationAnswers?.['expenses-rent'], '925.00', 'case context applicationAnswers rent not updated');
  assertMoneyEquals(context?.incomeEmployment, '1640.50', 'case context participant income field not updated');
  assertMoneyEquals(context?.expensesRent, '925.00', 'case context participant rent field not updated');

  const metadata = asJson(row.metadata_json, {});
  assertMoneyEquals(metadata?.sourceAnswers?.['income-employment'], '1640.50', 'funding overview metadata sourceAnswers not refreshed');

  const resolvedSchema = asJson(row.resolved_schema_json, {});
  const fundingOverviewVersionId = Number.parseInt(
    resolvedSchema?.meta?.fundingOverviewVersionId ?? resolvedSchema?.meta?.funding_overview_version_id ?? '',
    10
  );
  assert(Number.isInteger(fundingOverviewVersionId) && fundingOverviewVersionId > 0, 'signed request did not retain funding overview version id');
  const [docs] = await db.query(
    `SELECT d.id, d.file_path, d.label, d.file_name, fovd.document_type
       FROM funding_overview_version_documents fovd
       JOIN iset_document d ON d.id = fovd.document_id
      WHERE fovd.funding_overview_version_id = ?
        AND fovd.document_type = 'signed'`,
    [fundingOverviewVersionId]
  );
  assert(docs.length === 1, `expected one signed Financial Overview document link, got ${docs.length}`);
  assert(docs[0].file_path, 'signed document did not store object key');
  return { row, document: docs[0], fundingOverviewVersionId };
}

function serializeDbValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value == null ? null : String(value);
}

async function assertRepeatSignIsIdempotent({ db, portalApiBase, cookies, signingRequestId, fundingOverviewVersionId }) {
  const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  const [[beforeRequest]] = await db.query(
    'SELECT signed_payload_json, artifact_url FROM signing_request WHERE id = ? LIMIT 1',
    [signingRequestId]
  );
  const [[beforeVersion]] = await db.query(
    'SELECT metadata_json, snapshot_hash, signed_at FROM funding_overview_version WHERE id = ? LIMIT 1',
    [fundingOverviewVersionId]
  );
  const [[beforeDocs]] = await db.query(
    `SELECT COUNT(*) AS document_count, MAX(id) AS max_document_id
       FROM iset_document
      WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.funding_overview_version_id')) AS UNSIGNED) = ?`,
    [fundingOverviewVersionId]
  );

  const response = await fetch(`${portalApiBase}/api/signing-requests/${signingRequestId}/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      'income-employment': '9999.99',
      'expenses-rent': '111.11',
      signature: {
        signed: true,
        name: 'Should Not Replace Signed Snapshot',
      },
    }),
  });
  const body = await response.json().catch(() => null);
  assert(response.ok, `repeat sign returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.alreadySigned === true, `repeat sign expected alreadySigned response, got ${JSON.stringify(body)}`);

  const [[afterRequest]] = await db.query(
    'SELECT signed_payload_json, artifact_url FROM signing_request WHERE id = ? LIMIT 1',
    [signingRequestId]
  );
  const [[afterVersion]] = await db.query(
    'SELECT metadata_json, snapshot_hash, signed_at FROM funding_overview_version WHERE id = ? LIMIT 1',
    [fundingOverviewVersionId]
  );
  const [[afterDocs]] = await db.query(
    `SELECT COUNT(*) AS document_count, MAX(id) AS max_document_id
       FROM iset_document
      WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.funding_overview_version_id')) AS UNSIGNED) = ?`,
    [fundingOverviewVersionId]
  );

  assert(
    Number(afterDocs.document_count) === Number(beforeDocs.document_count) &&
      Number(afterDocs.max_document_id) === Number(beforeDocs.max_document_id),
    'repeat sign created or replaced a Financial Overview document'
  );
  assert(
    serializeDbValue(afterRequest.signed_payload_json) === serializeDbValue(beforeRequest.signed_payload_json),
    'repeat sign changed the signed request payload'
  );
  assert(
    serializeDbValue(afterRequest.artifact_url) === serializeDbValue(beforeRequest.artifact_url),
    'repeat sign changed the signed request artifact'
  );
  assert(
    serializeDbValue(afterVersion.metadata_json) === serializeDbValue(beforeVersion.metadata_json) &&
      serializeDbValue(afterVersion.snapshot_hash) === serializeDbValue(beforeVersion.snapshot_hash) &&
      serializeDbValue(afterVersion.signed_at) === serializeDbValue(beforeVersion.signed_at),
    'repeat sign changed the Financial Overview version snapshot'
  );
  console.log(`[assert] repeat signing request=${signingRequestId} was idempotent`);
}

async function deleteObjectQuietly(env, key) {
  if (!key || env.UPLOAD_MODE !== 's3' || !env.OBJECT_BUCKET) return;
  try {
    const mc = path.join(process.cwd(), '..', 'ISET-intake', 'minio', 'mc');
    if (!fs.existsSync(mc) || !env.OBJECT_ENDPOINT || !env.OBJECT_ACCESS_KEY || !env.OBJECT_SECRET_KEY) return;
    const alias = spawnSync(mc, ['alias', 'set', 'local', env.OBJECT_ENDPOINT, env.OBJECT_ACCESS_KEY, env.OBJECT_SECRET_KEY], {
      encoding: 'utf8',
    });
    if (alias.status !== 0) throw new Error(alias.stderr || alias.stdout || `mc alias exited ${alias.status}`);
    const rm = spawnSync(mc, ['rm', `local/${env.OBJECT_BUCKET}/${key}`], {
      encoding: 'utf8',
    });
    if (rm.status !== 0 && !/not found|does not exist/i.test(`${rm.stderr}\n${rm.stdout}`)) {
      throw new Error(rm.stderr || rm.stdout || `mc rm exited ${rm.status}`);
    }
  } catch (err) {
    console.warn(`[cleanup] object delete failed for ${key}: ${err?.name || err?.message || err}`);
  }
}

async function cleanupFixture({ db, adminCognito, portalCognito, adminEnv, portalEnv, fixture, staff, applicant, keepFixture }) {
  if (keepFixture) {
    console.warn('[cleanup] --keep-fixture set; leaving synthetic DB and Cognito records in place');
    return;
  }
  const caseId = fixture?.caseId || null;
  const userId = fixture?.userId || null;
  const clientId = fixture?.clientId || null;
  const applicationId = fixture?.applicationId || null;
  const submissionId = fixture?.submissionId || null;
  try {
    if (db && caseId) {
      const [objectRows] = await db.query(
        `SELECT file_path FROM iset_document
          WHERE case_id = ?
             OR applicant_user_id = ?
             OR application_id = ?`,
        [caseId, userId || 0, applicationId || 0]
      );
      for (const row of objectRows || []) {
        await deleteObjectQuietly(portalEnv, row.file_path);
      }

      const [versionRows] = await db.query(
        `SELECT v.id, v.series_id
           FROM funding_overview_version v
           JOIN funding_overview_series s ON s.id = v.series_id
          WHERE s.case_id = ?`,
        [caseId]
      );
      const versionIds = versionRows.map(row => Number(row.id)).filter(Boolean);
      const seriesIds = [...new Set(versionRows.map(row => Number(row.series_id)).filter(Boolean))];
      if (versionIds.length) {
        await db.query(
          `DELETE FROM funding_overview_version_documents WHERE funding_overview_version_id IN (${versionIds.map(() => '?').join(',')})`,
          versionIds
        );
      }
      await db.query('DELETE FROM message_signing_request WHERE signing_request_id IN (SELECT id FROM signing_request WHERE case_id = ?)', [caseId]);
      await db.query('DELETE FROM message_item WHERE message_id IN (SELECT id FROM messages WHERE case_id = ?)', [caseId]);
      await db.query('DELETE FROM signing_request WHERE case_id = ?', [caseId]);
      await db.query('DELETE FROM messages WHERE case_id = ?', [caseId]);
      await db.query(
        `DELETE FROM iset_event_entry
          WHERE (subject_type = 'case' AND subject_id = ?)
             OR actor_applicant_user_id = ?
             OR actor_staff_profile_id IN (SELECT id FROM staff_profiles WHERE cognito_sub = ?)`,
        [String(caseId), userId || 0, staff?.sub || '']
      ).catch(() => null);
      await db.query('DELETE FROM iset_document WHERE case_id = ? OR applicant_user_id = ? OR application_id = ?', [caseId, userId || 0, applicationId || 0]);
      if (versionIds.length) {
        await db.query(`DELETE FROM funding_overview_version WHERE id IN (${versionIds.map(() => '?').join(',')})`, versionIds);
      }
      if (seriesIds.length) {
        await db.query(`DELETE FROM funding_overview_series WHERE id IN (${seriesIds.map(() => '?').join(',')})`, seriesIds);
      }
      await db.query('DELETE FROM iset_application WHERE id = ?', [applicationId]);
      await db.query('DELETE FROM iset_case WHERE id = ?', [caseId]);
      await db.query('DELETE FROM iset_application_submission WHERE id = ?', [submissionId]);
      await db.query('DELETE FROM client_applicant_account_event WHERE client_id = ?', [clientId]).catch(() => null);
      await db.query('DELETE FROM client WHERE id = ?', [clientId]);
      await db.query('DELETE FROM user_session_audit WHERE user_id IN (?, ?)', [userId || 0, staff?.userId || 0]).catch(() => null);
      await db.query('DELETE FROM user WHERE id IN (?, ?)', [userId || 0, staff?.userId || 0]);
    }
    if (db && staff?.sub) {
      await db.query(
        `DELETE FROM iset_event_entry
          WHERE actor_staff_profile_id IN (SELECT id FROM staff_profiles WHERE cognito_sub = ?)
             OR actor_id = ?
             OR captured_by = ?`,
        [staff.sub, staff.sub, staff.sub]
      ).catch(() => null);
      await db.query('DELETE FROM user_session_audit WHERE user_id IN (SELECT id FROM user WHERE cognito_sub = ?)', [staff.sub]).catch(() => null);
      await db.query('DELETE FROM staff_region WHERE staff_profile_id IN (SELECT id FROM staff_profiles WHERE cognito_sub = ?)', [staff.sub]).catch(() => null);
      await db.query('DELETE FROM staff_profiles WHERE cognito_sub = ?', [staff.sub]).catch(() => null);
      await db.query('DELETE FROM user WHERE cognito_sub = ?', [staff.sub]).catch(() => null);
    }
  } finally {
    await deleteCognitoUserQuietly(adminCognito, adminEnv.COGNITO_STAFF_USER_POOL_ID || adminEnv.COGNITO_USER_POOL_ID, staff?.username);
    await deleteCognitoUserQuietly(portalCognito, portalEnv.COGNITO_USER_POOL_ID, applicant?.username);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.screenshotDir, { recursive: true });

  const adminEnv = parseEnvFile(path.join(process.cwd(), '.env'));
  const portalEnv = parseEnvFile(path.join(process.cwd(), '..', 'ISET-intake', '.env'));
  await assertDevAwsAccount('admin .env', adminEnv);
  await assertDevAwsAccount('portal .env', portalEnv);

  const adminCognito = new CognitoIdentityProviderClient(awsConfigFromEnv(adminEnv));
  const portalCognito = new CognitoIdentityProviderClient(awsConfigFromEnv(portalEnv));
  const db = await mysql.createConnection(mysqlConfig(adminEnv));
  ensureLocalChromeLibraryPath();
  const chromeExecutable = findChromeExecutable();
  assert(chromeExecutable, 'Could not find local Chrome for Puppeteer');
  const browser = await puppeteer.launch({
    headless: args.headed ? false : 'new',
    executablePath: chromeExecutable,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 1100, deviceScaleFactor: 1 },
  });

  const suffix = makeSuffix();
    const staff = {
    username: `fo-smoke-staff-${suffix}`,
    email: `fo-smoke-staff-${suffix}@example.test`,
    password: makePassword(),
    sub: null,
    userId: null,
  };
  const applicant = {
    email: `fo-smoke-applicant-${suffix}@example.test`,
    password: makePassword(),
    firstName: 'Fiona',
    lastName: 'Overview',
    sub: null,
  };
  applicant.username = applicant.email;
  let fixture = null;
  let adminPage = null;
  let portalPage = null;
  try {
    console.log(`[fixture] suffix ${suffix}`);
    const staffCreated = await createCognitoUser({
      client: adminCognito,
      userPoolId: adminEnv.COGNITO_STAFF_USER_POOL_ID || adminEnv.COGNITO_USER_POOL_ID,
      username: staff.username,
      email: staff.email,
      password: staff.password,
      group: 'System_Administrator',
      givenName: 'Codex',
      familyName: 'Smoke',
    });
    staff.sub = staffCreated.sub;
    const applicantCreated = await createCognitoUser({
      client: portalCognito,
      userPoolId: portalEnv.COGNITO_USER_POOL_ID,
      username: applicant.username,
      email: applicant.email,
      password: applicant.password,
      givenName: applicant.firstName,
      familyName: applicant.lastName,
    });
    applicant.sub = applicantCreated.sub;
    console.log('[cognito] disposable DEV staff and applicant created');

    adminPage = await browser.newPage();
    adminPage.on('console', msg => {
      if (['error'].includes(msg.type())) console.warn(`[admin browser] ${msg.text().slice(0, 500)}`);
    });
    const adminAuth = await loginAdminViaHostedUi({
      page: adminPage,
      adminEnv,
      username: staff.username,
      password: staff.password,
      adminApiBase: args.adminApiBase,
    });
    staff.userId = Number(adminAuth.me?.auth?.userId || adminAuth.me?.profile?.user_id || 0) || null;
    const staffProfileId = Number(adminAuth.me?.auth?.staffProfileId);
    console.log(`[admin] Hosted UI login succeeded as staffProfileId=${staffProfileId}`);

    const [[staffUserRow]] = await db.query('SELECT id FROM user WHERE cognito_sub = ? LIMIT 1', [staff.sub]);
    staff.userId = Number(staffUserRow?.id || staff.userId || 0) || null;
    fixture = await createFixtureRows({
      db,
      suffix,
      staffProfileId,
      staffUserId: staff.userId,
      applicant,
    });
    console.log(`[fixture] case=${fixture.caseId} application=${fixture.applicationId} applicantUser=${fixture.userId}`);

    await sendFinancialOverview({
      adminApiBase: args.adminApiBase,
      adminIdToken: adminAuth.session.idToken,
      fixture,
      mode: 'blank',
      subjectSuffix: `${suffix} blank`,
    });
    const blankRequest = await fetchLatestFinancialOverviewRequest(db, fixture.caseId);
    const blank = assertFinancialOverviewSchema(blankRequest, 'blank', {});
    assert(Object.keys(blank.initial || {}).length === 0, 'blank Financial Overview had initial values');
    assert(blankRequest.funding_overview_status === 'sent', `blank funding overview expected sent, got ${blankRequest.funding_overview_status}`);
    console.log(`[blank] signingRequest=${blankRequest.id} version=${blankRequest.version_number} verified empty initial values`);

    await sendFinancialOverview({
      adminApiBase: args.adminApiBase,
      adminIdToken: adminAuth.session.idToken,
      fixture,
      mode: 'prefill',
      subjectSuffix: `${suffix} prefill`,
    });
    const prefillRequest = await fetchLatestFinancialOverviewRequest(db, fixture.caseId);
    const prefill = assertFinancialOverviewSchema(prefillRequest, 'prefill', {
      'income-employment': '1200.00',
      'expenses-rent': '875.00',
    });
    assert(prefillRequest.funding_overview_status === 'sent', `prefill funding overview expected sent, got ${prefillRequest.funding_overview_status}`);
    const [[oldBlank]] = await db.query('SELECT status FROM signing_request WHERE id = ? LIMIT 1', [blankRequest.id]);
    assert(oldBlank?.status === 'cancelled', `blank signing request expected cancelled after replacement, got ${oldBlank?.status}`);
    console.log(`[prefill] signingRequest=${prefillRequest.id} version=${prefillRequest.version_number} verified pre-populated values`);

    const cookies = await portalPasswordLogin({
      portalApiBase: args.portalApiBase,
      email: applicant.email,
      password: applicant.password,
    });
    portalPage = await browser.newPage();
    portalPage.on('console', msg => {
      if (['error'].includes(msg.type())) console.warn(`[portal browser] ${msg.text().slice(0, 500)}`);
    });
    await setPortalCookies(portalPage, args.portalFrontendBase, cookies);
    const emailAssetsDir = await driveParticipantForm({
      page: portalPage,
      portalFrontendBase: args.portalFrontendBase,
      signingRequestId: prefillRequest.id,
      screenshotDir: args.screenshotDir,
    });
    console.log(`[portal] participant completed editable form; screenshots in ${emailAssetsDir}`);

    const signed = await assertSignedState({
      db,
      signingRequestId: prefillRequest.id,
      fixture,
    });
    console.log(`[assert] signed request=${prefillRequest.id} artifact=${signed.row.artifact_url}`);
    console.log(`[assert] signed document=${signed.document.id} key=${signed.document.file_path}`);
    await assertRepeatSignIsIdempotent({
      db,
      portalApiBase: args.portalApiBase,
      cookies,
      signingRequestId: prefillRequest.id,
      fundingOverviewVersionId: signed.fundingOverviewVersionId,
    });

    const report = {
      ok: true,
      suffix,
      screenshotDir: args.screenshotDir,
      emailAssetsDir,
      caseId: fixture.caseId,
      applicationId: fixture.applicationId,
      blankSigningRequestId: blankRequest.id,
      prefillSigningRequestId: prefillRequest.id,
      signedDocumentId: signed.document.id,
      signedObjectKey: signed.document.file_path,
    };
    fs.writeFileSync(path.join(args.screenshotDir, 'smoke-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (adminPage) await adminPage.close().catch(() => null);
    if (portalPage) await portalPage.close().catch(() => null);
    await browser.close().catch(() => null);
    await cleanupFixture({
      db,
      adminCognito,
      portalCognito,
      adminEnv,
      portalEnv,
      fixture,
      staff,
      applicant,
      keepFixture: args.keepFixture,
    }).catch(err => {
      console.warn(`[cleanup] failed: ${err?.stack || err?.message || err}`);
    });
    await db.end().catch(() => null);
  }
}

main().catch(err => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
