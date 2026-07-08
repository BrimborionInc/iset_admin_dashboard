#!/usr/bin/env node
'use strict';

/*
 * DEV end-to-end smoke for post-submission Application Assessment EI correction.
 *
 * Uses real DEV Cognito staff users, local DEV MySQL, the local admin backend,
 * and the local React bundle. It refuses to run unless the admin .env resolves
 * to the DEV AWS account.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const puppeteer = require('puppeteer');
const {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const DEV_AWS_ACCOUNT_ID = '124355655255';
const DEFAULT_ADMIN_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_ADMIN_API_BASE = 'http://localhost:5001';
const DEFAULT_SCREENSHOT_ROOT = path.join(process.cwd(), 'tmp', 'application-assessment-ei-correction-dev-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';
const REGION_ID_NUNAVUT = 8;
const REVIEW_WORKFLOW_TYPE = 'application_assessment';
const REVIEW_STAGE_RM_REVIEW = 'rm_review';

function parseArgs(argv) {
  const args = {
    adminEnv: path.join(process.cwd(), '.env'),
    adminFrontendBase: process.env.EI_CORRECTION_SMOKE_ADMIN_FRONTEND_BASE || DEFAULT_ADMIN_FRONTEND_BASE,
    adminApiBase: process.env.EI_CORRECTION_SMOKE_ADMIN_API_BASE || DEFAULT_ADMIN_API_BASE,
    screenshotDir: process.env.EI_CORRECTION_SMOKE_SCREENSHOT_DIR || '',
    headed: false,
    skipBrowser: false,
    keepFixture: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--admin-env') {
      args.adminEnv = argv[++index] || args.adminEnv;
    } else if (token === '--admin-frontend-base') {
      args.adminFrontendBase = argv[++index] || args.adminFrontendBase;
    } else if (token === '--admin-api-base') {
      args.adminApiBase = argv[++index] || args.adminApiBase;
    } else if (token === '--screenshot-dir') {
      args.screenshotDir = argv[++index] || args.screenshotDir;
    } else if (token === '--headed') {
      args.headed = true;
    } else if (token === '--skip-browser') {
      args.skipBrowser = true;
    } else if (token === '--keep-fixture') {
      args.keepFixture = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--help' || token === '-h') {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  args.adminFrontendBase = String(args.adminFrontendBase || DEFAULT_ADMIN_FRONTEND_BASE).replace(/\/+$/, '');
  args.adminApiBase = String(args.adminApiBase || DEFAULT_ADMIN_API_BASE).replace(/\/+$/, '');
  if (!args.screenshotDir) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    args.screenshotDir = path.join(DEFAULT_SCREENSHOT_ROOT, stamp);
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/application-assessment-ei-correction-dev-smoke.js [options]',
    '',
    'Creates disposable DEV Cognito users and a synthetic Application Assessment',
    'fixture, verifies EI correction through the real backend and browser UI,',
    'then cleans up Cognito and DB rows.',
    '',
    'Options:',
    '  --admin-env PATH             Admin .env file. Default: .env',
    '  --admin-frontend-base URL    Admin React origin. Default: http://localhost:3001',
    '  --admin-api-base URL         Admin API origin. Default: http://localhost:5001',
    '  --screenshot-dir DIR         Screenshot output directory.',
    '  --skip-browser               Run authenticated API/DB checks only.',
    '  --keep-fixture               Leave synthetic DB/Cognito rows in place.',
    '  --headed                     Run Chrome visibly.',
    '  --json                       Emit JSON summary.',
  ].join('\n');
}

function parseEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
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

function mysqlConfigFromEnv(env) {
  return {
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS || env.DB_PASSWORD || '',
    database: env.DB_NAME,
    port: Number(env.DB_PORT || 3306),
    multipleStatements: false,
  };
}

async function assertDevAwsAccount(label, env) {
  const client = new STSClient(awsConfigFromEnv(env));
  const identity = await client.send(new GetCallerIdentityCommand({}));
  if (identity.Account !== DEV_AWS_ACCOUNT_ID) {
    throw new Error(`${label} credentials resolved to AWS account ${identity.Account}; expected DEV ${DEV_AWS_ACCOUNT_ID}`);
  }
  return identity;
}

function randomSuffix() {
  return `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function randomPassword() {
  return `EiSmoke-${crypto.randomBytes(6).toString('hex')}Aa1!`;
}

function json(value) {
  return JSON.stringify(value);
}

function subjectKeyForApplication(applicationId) {
  return `${REVIEW_WORKFLOW_TYPE}:application:${applicationId}`;
}

function addResult(results, status, name, details = {}) {
  results.push({ status, name, details });
}

function pass(results, name, details = {}) {
  addResult(results, 'PASS', name, details);
}

function fail(results, name, details = {}) {
  addResult(results, 'FAIL', name, details);
}

function expectResult(results, name, condition, details = {}) {
  if (condition) pass(results, name, details);
  else fail(results, name, details);
}

async function createCognitoUser({ client, userPoolId, username, email, password, groupName, givenName, familyName }) {
  await client.send(new AdminCreateUserCommand({
    UserPoolId: userPoolId,
    Username: username,
    MessageAction: 'SUPPRESS',
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'preferred_username', Value: email },
      { Name: 'given_name', Value: givenName },
      { Name: 'family_name', Value: familyName },
    ],
  }));
  await client.send(new AdminSetUserPasswordCommand({
    UserPoolId: userPoolId,
    Username: username,
    Password: password,
    Permanent: true,
  }));
  if (groupName) {
    await client.send(new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: groupName,
    }));
  }
  const user = await client.send(new AdminGetUserCommand({
    UserPoolId: userPoolId,
    Username: username,
  }));
  const sub = user.UserAttributes?.find(attribute => attribute.Name === 'sub')?.Value || null;
  assert(sub, `Unable to resolve Cognito sub for ${username}`);
  return { sub };
}

async function deleteCognitoUserQuietly(client, userPoolId, username) {
  if (!client || !userPoolId || !username) return;
  try {
    await client.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: username }));
  } catch (error) {
    if (error?.name !== 'UserNotFoundException') {
      console.warn(`[cleanup] Cognito delete failed for ${username}: ${error?.name || error?.message || error}`);
    }
  }
}

function buildAdminAuthorizeUrl(adminEnv) {
  const rawDomain = adminEnv.COGNITO_DOMAIN;
  if (!rawDomain) throw new Error('admin env missing COGNITO_DOMAIN');
  const domain = rawDomain.startsWith('http') ? rawDomain : `https://${rawDomain}`;
  const redirectUri = adminEnv.COGNITO_REDIRECT_URI;
  if (!redirectUri) throw new Error('admin env missing COGNITO_REDIRECT_URI');
  const clientId = adminEnv.COGNITO_CLIENT_ID || adminEnv.COGNITO_STAFF_CLIENT_ID || adminEnv.REACT_APP_COGNITO_CLIENT_ID;
  if (!clientId) throw new Error('admin env missing Cognito client id');
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'email openid profile',
    redirect_uri: redirectUri,
  });
  return `${domain.replace(/\/+$/, '')}/oauth2/authorize?${params.toString()}`;
}

async function loginStaffViaHostedUi({ adminEnv, args, username, password, expectedRole }) {
  ensureLocalChromeLibraryPath();
  const executablePath = findChromeExecutable();
  assert(executablePath, 'Could not find local Chrome for Puppeteer');
  const browser = await puppeteer.launch({
    headless: args.headed ? false : 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  try {
    await page.goto(buildAdminAuthorizeUrl(adminEnv), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="username"], input[type="email"]', { timeout: 45_000 });
    const usernameSelector = await page.$('input[name="username"]') ? 'input[name="username"]' : 'input[type="email"]';
    await page.click(usernameSelector, { clickCount: 3 });
    await page.type(usernameSelector, username);
    await page.click('input[name="password"], input[type="password"]', { clickCount: 3 });
    await page.type('input[name="password"], input[type="password"]', password);
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
    const me = await httpJson(`${args.adminApiBase}/api/auth/me`, { token: session.idToken });
    if (!me.ok) {
      throw new Error(`Hosted UI token did not hydrate /api/auth/me: ${me.status} ${JSON.stringify(me.body)}`);
    }
    if (expectedRole && me.body?.auth?.role !== expectedRole) {
      throw new Error(`Hosted UI login role mismatch: expected ${expectedRole}, got ${me.body?.auth?.role}`);
    }
    const now = Math.floor(Date.now() / 1000);
    return {
      idToken: session.idToken,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken || null,
      expiresAt: session.expiresAt || now + 3300,
      flow: 'HOSTED_UI',
      me: me.body,
    };
  } finally {
    await browser.close();
  }
}

async function authenticateStaffUser({ client, userPoolId, clientId, username, password, adminEnv, args, expectedRole }) {
  const flows = [
    {
      label: 'ADMIN_USER_PASSWORD_AUTH',
      command: () => new AdminInitiateAuthCommand({
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: username, PASSWORD: password },
      }),
    },
    {
      label: 'USER_PASSWORD_AUTH',
      command: () => new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: username, PASSWORD: password },
      }),
    },
  ];
  const errors = [];
  for (const flow of flows) {
    try {
      const response = await client.send(flow.command());
      if (response?.ChallengeName) {
        throw new Error(`Unexpected Cognito auth challenge: ${response.ChallengeName}`);
      }
      const auth = response?.AuthenticationResult;
      if (!auth?.IdToken || !auth?.AccessToken) {
        throw new Error('Cognito auth response did not include ID/access tokens.');
      }
      const now = Math.floor(Date.now() / 1000);
      return {
        idToken: auth.IdToken,
        accessToken: auth.AccessToken,
        refreshToken: auth.RefreshToken || null,
        expiresAt: now + Number(auth.ExpiresIn || 3600) - 60,
        flow: flow.label,
      };
    } catch (error) {
      errors.push(`${flow.label}: ${error?.name || error?.message || String(error)}`);
    }
  }
  if (adminEnv && args) {
    try {
      const hosted = await loginStaffViaHostedUi({ adminEnv, args, username, password, expectedRole });
      hosted.directAuthErrors = errors;
      return hosted;
    } catch (hostedError) {
      errors.push(`HOSTED_UI: ${hostedError?.message || hostedError}`);
    }
  }
  throw new Error(`Unable to authenticate ${username}. ${errors.join(' | ')}`);
}

async function httpJson(url, { method = 'GET', token, body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_) {
    parsed = { raw: text.slice(0, 1000) };
  }
  return { status: response.status, ok: response.ok, body: parsed };
}

async function acquireLock(args, fixture, token) {
  const result = await httpJson(`${args.adminApiBase}/api/locks/application/${fixture.applicationId}`, {
    method: 'POST',
    token,
    body: { ttlMinutes: 5 },
  });
  assert(result.ok, `Failed to acquire application lock: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body?.lock || null;
}

async function releaseLock(args, fixture, token) {
  await httpJson(`${args.adminApiBase}/api/locks/application/${fixture.applicationId}`, {
    method: 'DELETE',
    token,
  }).catch(() => null);
}

async function waitForDbValue(db, label, predicate, timeoutMs = 20_000) {
  const started = Date.now();
  let lastValue = null;
  while (Date.now() - started < timeoutMs) {
    lastValue = await predicate();
    if (lastValue?.ok) return lastValue;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}; last=${JSON.stringify(lastValue)}`);
}

async function fetchAssessmentState(db, fixture) {
  const [[row]] = await db.query(
    `SELECT a.row_version, aa.esdc_eligibility,
            (SELECT COUNT(*) FROM iset_case_event WHERE case_id = ? AND event_type = 'data_repair') AS repair_events,
            (SELECT COUNT(*) FROM iset_case_action_plan WHERE case_id = ? AND archived_at IS NULL) AS action_plans
       FROM iset_application a
       JOIN iset_application_assessment aa ON aa.application_id = a.id
      WHERE a.id = ?
      LIMIT 1`,
    [fixture.caseId, fixture.caseId, fixture.applicationId]
  );
  return row || null;
}

async function createFixtureRows({ db, suffix, staff }) {
  const marker = { applicationAssessmentEiCorrectionDevSmoke: true, suffix };
  const referenceNumber = `EIC-${suffix.replace(/[^a-z0-9]/gi, '').slice(-14).toUpperCase()}`;
  const caseNumber = `EI-SMOKE-${suffix.replace(/[^a-z0-9]/gi, '').slice(-12).toUpperCase()}`;
  const applicantEmail = `codex.ei.${suffix}.applicant@example.com`;
  const applicationAnswers = {
    'first-name': 'Ei',
    'last-name': `Correction ${suffix}`,
    'preferred-name': 'Ei',
    email: applicantEmail,
    'contact-email-address': applicantEmail,
    'telephone-day': '613-555-0142',
    'address-line-1': '1 Smoke Test Lane',
    'address-city': 'Iqaluit',
    'address-province': 'NU',
    'address-postal-code': 'X0A 0H0',
    'long-term-goal': 'Complete training and return to work.',
    'requested-supports': ['tuition'],
    'training-institution': 'Smoke Training College',
    'program-name': 'Smoke Certificate',
  };

  await db.beginTransaction();
  try {
    for (const user of Object.values(staff)) {
      const staffUserId = await insert(db,
        `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
         VALUES (?, ?, ?, 1, 0, 'en')`,
        [user.displayName, user.email, user.sub]
      );
      const staffProfileId = await insert(db,
        `INSERT INTO staff_profiles
           (cognito_sub, email, name, display_name, primary_role, status, region_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())`,
        [user.sub, user.email, user.displayName, user.displayName, user.role, REGION_ID_NUNAVUT]
      );
      await db.query(
        `INSERT INTO staff_region (staff_profile_id, region_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [staffProfileId, REGION_ID_NUNAVUT]
      );
      user.userId = staffUserId;
      user.staffProfileId = staffProfileId;
    }

    const applicantUserId = await insert(db,
      `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
       VALUES (?, ?, ?, 1, 0, 'en')`,
      [`EI Correction Applicant ${suffix}`, applicantEmail, `ei-correction-applicant-${suffix}`]
    );
    const clientId = await insert(db,
      `INSERT INTO client
         (first_name, last_name, dob, gender, aboriginal_group, address_json,
          applicant_cognito_sub, applicant_cognito_username, applicant_account_status,
          applicant_account_email, applicant_activated_at)
       VALUES (?, ?, '1990-04-12', 'Woman', 'First Nations', CAST(? AS JSON),
          ?, ?, 'activated', ?, NOW())`,
      [
        'Ei',
        `Correction ${suffix}`,
        json({ line1: '1 Smoke Test Lane', city: 'Iqaluit', province: 'NU', postalCode: 'X0A 0H0', country: 'Canada' }),
        `ei-correction-applicant-${suffix}`,
        applicantEmail,
        applicantEmail,
      ]
    );
    const submissionId = await insert(db,
      `INSERT INTO iset_application_submission
         (user_id, workflow_id, reference_number, status, submitted_at, intake_payload,
          schema_snapshot, history, doc_refs, locale, source_ip, user_agent, checksum_sha256)
       VALUES (?, 'iset-v1', ?, 'submitted', NOW(), CAST(? AS JSON), CAST(? AS JSON),
          CAST(? AS JSON), CAST(? AS JSON), 'en', '127.0.0.1',
          'application-assessment-ei-correction-dev-smoke', ?)`,
      [
        applicantUserId,
        referenceNumber,
        json({ ...marker, answers: applicationAnswers, submission_snapshot: { user_id: applicantUserId, reference_number: referenceNumber } }),
        json({ smoke: true }),
        json([]),
        json([]),
        crypto.createHash('sha256').update(`${suffix}:${applicantEmail}`).digest('hex'),
      ]
    );
    const caseId = await insert(db,
      `INSERT INTO iset_case
         (case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, stage,
          opened_at, portfolio_region_id, case_context_json, created_by_staff_profile_id, updated_by_staff_profile_id)
       VALUES (?, ?, ?, 'intake', 'intake', 'ei_correction_smoke',
          NOW(), ?, CAST(? AS JSON), ?, ?)`,
      [
        caseNumber,
        clientId,
        staff.coordinator.staffProfileId,
        REGION_ID_NUNAVUT,
        json({ ...marker, applicationAnswers }),
        staff.coordinator.staffProfileId,
        staff.coordinator.staffProfileId,
      ]
    );
    const applicationId = await insert(db,
      `INSERT INTO iset_application
         (submission_id, client_id, case_id, payload_json, status, lifecycle_status,
          decision_outcome, awaiting_reason, version, row_version, created_at, updated_at)
       VALUES (?, ?, ?, CAST(? AS JSON), 'pending_approval', 'pending_decision',
          NULL, NULL, 1, 1, NOW(), NOW())`,
      [submissionId, clientId, caseId, json({ ...marker, answers: applicationAnswers, submission_snapshot: { user_id: applicantUserId, reference_number: referenceNumber } })]
    );
    await db.query(
      `INSERT INTO iset_application_assessment
         (application_id, case_id, date_of_assessment, overview, employment_goals,
          previous_iset, employment_barriers, local_area_priorities, other_funding_details,
          esdc_eligibility, intervention_start_date, intervention_end_date, posting_context,
          intervention_code, intervention_outcome_code, intervention_duration_days,
          intervention_cost_total, institution, program_name, itp_payload, wage_payload,
          recommendation, justification, proposed_interventions, childcare_need, created_at, updated_at)
       VALUES (?, ?, CURRENT_DATE(), ?, ?, 0, CAST(? AS JSON), CAST(? AS JSON), ?,
          'EI Active Claim', '2026-09-01', '2026-12-15', 'external',
          4, 1, 106, 100, 'Smoke Training College', 'Smoke Certificate',
          CAST(? AS JSON), CAST(? AS JSON), 'recommend', ?, CAST(? AS JSON),
          0, NOW(), NOW())`,
      [
        applicationId,
        caseId,
        'Synthetic assessment for EI correction smoke.',
        'Complete short training and return to work.',
        json(['Lack of Marketable Skills']),
        json(['Off Reserve']),
        'No other funding identified.',
        json({ tuition: '', books: '', materials: '', living: '', childcare: '', otherLabel: '', otherAmount: '', details: 'Training plan details.' }),
        json({ wages: '', mercs: '', nonwages: '', other1Label: '', other1Amount: '', other2Label: '', other2Amount: '', subsidyDetails: '' }),
        'Synthetic recommendation is aligned with employment goals.',
        json([{ id: `ei-correction-${suffix}`, code: '4', startDate: '2026-09-01', endDate: '2026-12-15', deliveryMode: 'partner', institution: 'Smoke Training College', programName: 'Smoke Certificate', itpDetails: 'Training details.', costLines: [] }]),
      ]
    );
    await db.query(
      `INSERT INTO iset_review_workflow
         (workflow_type, subject_key, case_id, application_id, current_stage,
          current_owner_role, current_owner_staff_profile_id, submitted_by_staff_profile_id,
          submitted_at, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'Regional Manager', ?, ?, NOW(), CAST(? AS JSON), NOW(), NOW())`,
      [
        REVIEW_WORKFLOW_TYPE,
        subjectKeyForApplication(applicationId),
        caseId,
        applicationId,
        REVIEW_STAGE_RM_REVIEW,
        staff.regionalManager.staffProfileId,
        staff.coordinator.staffProfileId,
        json(marker),
      ]
    );
    await db.query(
      `INSERT INTO iset_case_conflict_declaration
         (case_id, staff_profile_id, declaration_choice, signed_at, signed_ip, signed_user_agent)
       VALUES (?, ?, 'no_conflict', NOW(), '127.0.0.1', 'application-assessment-ei-correction-dev-smoke')`,
      [caseId, staff.regionalManager.staffProfileId]
    );
    const documentId = await insert(db,
      `INSERT INTO iset_document
         (user_id, applicant_user_id, client_id, application_id, case_id, source,
          file_name, file_path, mime_type, label, metadata, size_bytes,
          checksum_sha256, status, document_category, visibility)
       VALUES (?, ?, ?, ?, ?, 'manual_upload', ?, ?, 'application/pdf',
          'EI Verification Smoke Document', CAST(? AS JSON), 12, ?, 'active',
          'ei_verification', 'internal')`,
      [
        staff.regionalManager.userId,
        applicantUserId,
        clientId,
        applicationId,
        caseId,
        `ei-verification-${suffix}.pdf`,
        `smoke/ei-correction/${suffix}/ei-verification.pdf`,
        json({ ...marker, document_type: 'ei_verification', label: 'EI Verification Smoke Document' }),
        crypto.createHash('sha256').update(`ei-doc:${suffix}`).digest('hex'),
      ]
    );

    await db.commit();
    return {
      suffix,
      marker,
      applicantUserId,
      clientId,
      submissionId,
      caseId,
      applicationId,
      caseNumber,
      referenceNumber,
      documentId,
      staff,
    };
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

async function insert(db, sql, params = []) {
  const [result] = await db.query(sql, params);
  return Number(result.insertId);
}

async function runApiSmoke({ args, db, fixture, auth, results }) {
  const rmToken = auth.regionalManager.idToken;
  const coordinatorToken = auth.coordinator.idToken;

  const rmMe = await httpJson(`${args.adminApiBase}/api/auth/me`, { token: rmToken });
  expectResult(results, 'RM token hydrates as Regional Manager', rmMe.ok && rmMe.body?.auth?.role === 'Regional Manager', {
    status: rmMe.status,
    role: rmMe.body?.auth?.role,
    staffProfileId: rmMe.body?.auth?.staffProfileId,
  });

  const coordMe = await httpJson(`${args.adminApiBase}/api/auth/me`, { token: coordinatorToken });
  expectResult(results, 'Coordinator token hydrates as ISET Coordinator', coordMe.ok && coordMe.body?.auth?.role === 'ISET Coordinator', {
    status: coordMe.status,
    role: coordMe.body?.auth?.role,
    staffProfileId: coordMe.body?.auth?.staffProfileId,
  });

  await acquireLock(args, fixture, rmToken);
  const positive = await httpJson(`${args.adminApiBase}/api/cases/${fixture.caseId}`, {
    method: 'PUT',
    token: rmToken,
    body: {
      applicationId: fixture.applicationId,
      expectedRowVersion: 1,
      assessment_esdc_eligibility: 'EI Reach Back',
    },
  });
  await releaseLock(args, fixture, rmToken);
  expectResult(results, 'RM can correct EI status through real backend before dependencies', positive.ok && positive.body?.success && positive.body?.application_row_version === 2, {
    status: positive.status,
    body: positive.body,
  });
  const afterPositive = await fetchAssessmentState(db, fixture);
  expectResult(results, 'Backend persisted RM correction and audit event', afterPositive?.esdc_eligibility === 'EI Reach Back' && Number(afterPositive?.row_version) === 2 && Number(afterPositive?.repair_events) >= 1, afterPositive || {});

  return afterPositive;
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

async function clickByText(page, selector, text) {
  const clicked = await page.evaluate(({ selector: innerSelector, text: innerText }) => {
    const visible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const candidates = Array.from(document.querySelectorAll(innerSelector))
      .filter(visible)
      .filter(element => normalize(element.innerText || element.textContent || element.getAttribute('aria-label') || '') === innerText);
    const target = candidates[candidates.length - 1];
    if (!target) return false;
    target.click();
    return true;
  }, { selector, text });
  if (!clicked) throw new Error(`Could not click visible ${selector} with text "${text}"`);
}

async function skipTutorialIfVisible(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const clicked = await page.evaluate(() => {
      const visible = element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
      const button = Array.from(document.querySelectorAll('button')).find(element => visible(element) && normalize(element.innerText || element.textContent) === 'Skip');
      if (!button) return false;
      button.click();
      return true;
    });
    if (!clicked) return;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

async function getEligibilityControlState(page) {
  return page.evaluate(() => {
    const visible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const label = Array.from(document.querySelectorAll('*'))
      .filter(visible)
      .find(element => normalize(element.textContent) === 'Employment Insurance Status');
    let root = label;
    for (let depth = 0; root && depth < 8; depth += 1) {
      const text = normalize(root.textContent);
      if (text.includes('Employment Insurance Status') && text.includes('EI Reach Back')) break;
      root = root.parentElement;
    }
    const candidates = Array.from((root || document).querySelectorAll('[aria-label="Employment Insurance Status"], [role="button"], [role="combobox"], button, input'))
      .filter(visible);
    const control = candidates.find(element =>
      element.getAttribute('aria-label') === 'Employment Insurance Status' ||
      normalize(element.innerText || element.textContent).includes('EI Reach Back') ||
      normalize(element.innerText || element.textContent).includes('EI Active Claim')
    ) || candidates[0] || null;
    if (!control) {
      return { found: false, labelFound: Boolean(label), rootText: root ? normalize(root.textContent).slice(0, 500) : null };
    }
    return {
      found: true,
      text: normalize(control.innerText || control.textContent || control.value || ''),
      tag: control.tagName,
      role: control.getAttribute('role'),
      ariaDisabled: control.getAttribute('aria-disabled'),
      disabled: Boolean(control.disabled),
      readOnly: Boolean(control.readOnly),
    };
  });
}

async function openEligibilitySelect(page) {
  const rect = await page.evaluate(() => {
    const visible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const label = Array.from(document.querySelectorAll('*'))
      .filter(visible)
      .find(element => normalize(element.textContent) === 'Employment Insurance Status');
    let root = label;
    for (let depth = 0; root && depth < 8; depth += 1) {
      const text = normalize(root.textContent);
      if (text.includes('Employment Insurance Status') && text.includes('EI Reach Back')) break;
      root = root.parentElement;
    }
    const candidates = Array.from((root || document).querySelectorAll('[aria-label="Employment Insurance Status"], [role="button"], [role="combobox"], button, div'))
      .filter(visible);
    const control = candidates.find(element =>
      element.getAttribute('aria-label') === 'Employment Insurance Status' ||
      normalize(element.innerText || element.textContent).includes('EI Reach Back') ||
      normalize(element.innerText || element.textContent).includes('EI Active Claim')
    ) || candidates[0] || null;
    if (!control) return null;
    const controlRect = control.getBoundingClientRect();
    return {
      x: controlRect.x,
      y: controlRect.y,
      width: controlRect.width,
      height: controlRect.height,
    };
  });
  if (!rect) throw new Error('Could not locate Employment Insurance Status select');
  await page.mouse.click(rect.x + Math.max(8, rect.width - 22), rect.y + (rect.height / 2));
}

async function clickSelectOption(page, optionText) {
  await page.waitForFunction((label) => {
    const visible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(document.querySelectorAll('[role="option"], li, div, span'))
      .some(element => visible(element) && normalize(element.innerText || element.textContent) === label);
  }, { timeout: 10_000 }, optionText);
  const rect = await page.evaluate((label) => {
    const visible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const candidates = Array.from(document.querySelectorAll('[role="option"], li, div, span'))
      .filter(element => visible(element) && normalize(element.innerText || element.textContent) === label);
    const preferred = candidates.find(element => element.getAttribute('role') === 'option') || candidates[candidates.length - 1];
    if (!preferred) return null;
    const optionRect = preferred.getBoundingClientRect();
    return {
      x: optionRect.x,
      y: optionRect.y,
      width: optionRect.width,
      height: optionRect.height,
    };
  }, optionText);
  if (!rect) throw new Error(`Could not locate select option "${optionText}"`);
  await page.mouse.click(rect.x + (rect.width / 2), rect.y + (rect.height / 2));
}

async function runBrowserSmoke({ args, db, fixture, auth, results }) {
  ensureLocalChromeLibraryPath();
  const executablePath = findChromeExecutable();
  assert(executablePath, 'Could not find local Chrome for Puppeteer');
  fs.mkdirSync(args.screenshotDir, { recursive: true });
  const failures = [];
  const casePuts = [];
  const browser = await puppeteer.launch({
    headless: args.headed ? false : 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 1100, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Each child in a list should have a unique "key" prop')) return;
    if (msg.type() === 'error') failures.push({ type: 'console', text: text.slice(0, 1000) });
  });
  page.on('pageerror', error => failures.push({ type: 'pageerror', text: error?.message || String(error) }));
  page.on('request', request => {
    if (request.method() === 'PUT' && request.url().includes(`/api/cases/${fixture.caseId}`)) {
      const postData = request.postData();
      let body = null;
      try { body = postData ? JSON.parse(postData) : null; } catch (_) {}
      casePuts.push({ url: request.url(), body });
    }
  });
  page.on('response', response => {
    const status = response.status();
    if (status >= 500) {
      failures.push({ type: 'response', status, url: response.url() });
    }
  });

  const session = {
    idToken: auth.regionalManager.idToken,
    accessToken: auth.regionalManager.accessToken,
    refreshToken: auth.regionalManager.refreshToken || null,
    expiresAt: auth.regionalManager.expiresAt,
  };
  await page.evaluateOnNewDocument((authSession, apiBase) => {
    window.__API_BASE__ = apiBase;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
    sessionStorage.removeItem('iset.tutorial.resetApplicationLayout');
    localStorage.setItem('application-assessment-dashboard-layout.v2', JSON.stringify([
      { id: 'coordinator-assessment', rowSpan: 7, columnSpan: 4 },
    ]));
  }, session, args.adminApiBase);

  const url = `${args.adminFrontendBase}/application-case/${fixture.caseId}?applicationId=${fixture.applicationId}`;
  let screenshot = null;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await skipTutorialIfVisible(page);
    await page.waitForFunction(() => {
      const text = document.body?.innerText || '';
      return text.includes('Application Assessment') && text.includes('Employment Insurance Status');
    }, { timeout: 60_000 });
    await skipTutorialIfVisible(page);
    await clickByText(page, 'button, a, [role="button"]', 'Assess Eligibility').catch(() => null);
    await page.waitForFunction(() => (document.body?.innerText || '').includes('Employment Insurance Status'), { timeout: 20_000 });
    await skipTutorialIfVisible(page);
    const controlState = await getEligibilityControlState(page);
    expectResult(results, 'Browser shows EI dropdown enabled for RM after submission', controlState.found && controlState.ariaDisabled !== 'true' && !controlState.disabled && !controlState.readOnly, controlState);

    await openEligibilitySelect(page);
    await clickSelectOption(page, 'EI Active Claim');
    await page.waitForFunction(() => (document.body?.innerText || '').includes('EI Active Claim'), { timeout: 10_000 });
    await clickByText(page, 'button', 'Next');
    await waitForDbValue(db, 'browser EI Active Claim save', async () => {
      const state = await fetchAssessmentState(db, fixture);
      return { ok: state?.esdc_eligibility === 'EI Active Claim' && Number(state?.row_version) >= 3, state };
    });
    screenshot = path.join(args.screenshotDir, `ei-correction-${fixture.suffix}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    const uiPut = casePuts.find(entry => entry.body?.assessment_esdc_eligibility === 'EI Active Claim');
    expectResult(results, 'Browser changed EI status through real PUT payload', Boolean(uiPut), { casePuts, screenshot });
  } catch (error) {
    try {
      screenshot = path.join(args.screenshotDir, `ei-correction-failure-${fixture.suffix}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
    } catch (_) {}
    fail(results, 'Browser EI correction flow', {
      message: error?.message || String(error),
      url: page.url(),
      screenshot,
      bodyText: await page.evaluate(() => (document.body?.innerText || '').slice(0, 2000)).catch(() => null),
      casePuts,
    });
  } finally {
    await browser.close();
  }
  expectResult(results, 'Browser saw no console/page/server failures', failures.length === 0, { failures });
}

async function runNegativeApiChecks({ args, db, fixture, auth, results }) {
  const coordinatorToken = auth.coordinator.idToken;
  const rmToken = auth.regionalManager.idToken;
  const current = await fetchAssessmentState(db, fixture);
  const currentVersion = Number(current?.row_version || 0);

  await acquireLock(args, fixture, coordinatorToken);
  const coordinatorAttempt = await httpJson(`${args.adminApiBase}/api/cases/${fixture.caseId}`, {
    method: 'PUT',
    token: coordinatorToken,
    body: {
      applicationId: fixture.applicationId,
      expectedRowVersion: currentVersion,
      assessment_esdc_eligibility: current?.esdc_eligibility === 'EI Reach Back'
        ? 'EI Active Claim'
        : 'EI Reach Back',
    },
  });
  await releaseLock(args, fixture, coordinatorToken);
  const afterCoordinator = await fetchAssessmentState(db, fixture);
  expectResult(results, 'Coordinator is blocked from changing existing EI status', coordinatorAttempt.status === 403 && coordinatorAttempt.body?.error === 'ei_eligibility_forbidden' && afterCoordinator?.esdc_eligibility === current.esdc_eligibility, {
    status: coordinatorAttempt.status,
    body: coordinatorAttempt.body,
    afterCoordinator,
  });

  const actionPlanId = await insert(db,
    `INSERT INTO iset_case_action_plan
       (case_id, application_id, name, status, budget_pot, funding_stream,
        owner_staff_profile_id, effective_date, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, 'active', '1780058672308', 'EI', ?, CURRENT_DATE(), CAST(? AS JSON), NOW(), NOW())`,
    [
      fixture.caseId,
      fixture.applicationId,
      `EI correction dependency smoke ${fixture.suffix}`,
      fixture.staff.coordinator.staffProfileId,
      json(fixture.marker),
    ]
  );
  fixture.actionPlanId = actionPlanId;

  await acquireLock(args, fixture, rmToken);
  const dependencyAttempt = await httpJson(`${args.adminApiBase}/api/cases/${fixture.caseId}`, {
    method: 'PUT',
    token: rmToken,
    body: {
      applicationId: fixture.applicationId,
      expectedRowVersion: Number(afterCoordinator?.row_version || currentVersion),
      assessment_esdc_eligibility: afterCoordinator?.esdc_eligibility === 'EI Active Claim' ? 'EI Reach Back' : 'EI Active Claim',
    },
  });
  await releaseLock(args, fixture, rmToken);
  const afterDependency = await fetchAssessmentState(db, fixture);
  expectResult(results, 'RM EI correction is blocked once action plan dependency exists', dependencyAttempt.status === 409 && dependencyAttempt.body?.error === 'ei_eligibility_dependency_blocked' && afterDependency?.esdc_eligibility === afterCoordinator?.esdc_eligibility, {
    status: dependencyAttempt.status,
    body: dependencyAttempt.body,
    afterDependency,
  });
}

async function cleanupFixture({ db, fixture, cognito, userPoolId }) {
  if (!fixture) return null;
  const staffUsers = Object.values(fixture.staff || {});
  await db.query('DELETE FROM application_lock WHERE application_id = ?', [fixture.applicationId]).catch(() => null);
  await db.query('DELETE FROM iset_case_event WHERE case_id = ?', [fixture.caseId]).catch(() => null);
  await db.query('DELETE FROM iset_review_workflow_event WHERE subject_key = ?', [subjectKeyForApplication(fixture.applicationId)]).catch(() => null);
  await db.query('DELETE FROM iset_review_workflow WHERE application_id = ?', [fixture.applicationId]).catch(() => null);
  await db.query('DELETE FROM esdc_participant_submission WHERE case_id = ?', [fixture.caseId]).catch(() => null);
  await db.query('DELETE FROM iset_document WHERE case_id = ?', [fixture.caseId]).catch(() => null);
  await db.query('DELETE FROM iset_case_action_plan WHERE case_id = ?', [fixture.caseId]).catch(() => null);
  await db.query('DELETE FROM iset_application_assessment WHERE application_id = ?', [fixture.applicationId]).catch(() => null);
  await db.query('DELETE FROM iset_application WHERE id = ?', [fixture.applicationId]).catch(() => null);
  await db.query('DELETE FROM iset_case WHERE id = ?', [fixture.caseId]).catch(() => null);
  await db.query('DELETE FROM iset_application_submission WHERE id = ?', [fixture.submissionId]).catch(() => null);
  await db.query('DELETE FROM client WHERE id = ?', [fixture.clientId]).catch(() => null);
  await db.query('DELETE FROM staff_region WHERE staff_profile_id IN (?)', [staffUsers.map(user => user.staffProfileId).filter(Boolean)]).catch(() => null);
  await db.query('DELETE FROM staff_profiles WHERE id IN (?)', [staffUsers.map(user => user.staffProfileId).filter(Boolean)]).catch(() => null);
  await db.query('DELETE FROM user WHERE id IN (?)', [[fixture.applicantUserId, ...staffUsers.map(user => user.userId).filter(Boolean)]]).catch(() => null);
  for (const user of staffUsers) {
    await deleteCognitoUserQuietly(cognito, userPoolId, user.username);
  }
  const [[counts]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM iset_application WHERE id = ?) AS applications,
       (SELECT COUNT(*) FROM iset_case WHERE id = ?) AS cases,
       (SELECT COUNT(*) FROM iset_document WHERE case_id = ?) AS documents,
       (SELECT COUNT(*) FROM staff_profiles WHERE email IN (?, ?)) AS staff_profiles,
       (SELECT COUNT(*) FROM user WHERE email IN (?, ?, ?)) AS users`,
    [
      fixture.applicationId,
      fixture.caseId,
      fixture.caseId,
      fixture.staff.regionalManager.email,
      fixture.staff.coordinator.email,
      fixture.staff.regionalManager.email,
      fixture.staff.coordinator.email,
      `codex.ei.${fixture.suffix}.applicant@example.com`,
    ]
  );
  return counts;
}

function renderHuman(summary) {
  const lines = [];
  lines.push(`Application Assessment EI correction DEV smoke: ${summary.pass ? 'PASS' : 'FAIL'}`);
  lines.push(`Fixture: ${summary.fixture ? `case ${summary.fixture.caseId}, application ${summary.fixture.applicationId}` : 'not created'}`);
  lines.push(`AWS identity: ${summary.awsIdentity?.Arn || 'unknown'}`);
  if (summary.cleanupCounts) lines.push(`Cleanup counts: ${JSON.stringify(summary.cleanupCounts)}`);
  if (summary.fixtureKept) lines.push('Fixture kept for inspection.');
  lines.push('');
  for (const result of summary.results) {
    lines.push(`${result.status} ${result.name}`);
    if (result.status !== 'PASS') {
      lines.push(`  ${JSON.stringify(result.details)}`);
    }
  }
  return lines.join('\n');
}

async function main() {
  if (typeof fetch !== 'function') {
    throw new Error('Node.js global fetch is required. Use Node 18+.');
  }
  const args = parseArgs(process.argv.slice(2));
  const adminEnv = parseEnvFile(args.adminEnv);
  const awsIdentity = await assertDevAwsAccount('admin .env', adminEnv);
  const userPoolId = adminEnv.COGNITO_STAFF_USER_POOL_ID || adminEnv.COGNITO_USER_POOL_ID;
  const clientId = adminEnv.COGNITO_STAFF_CLIENT_ID || adminEnv.COGNITO_CLIENT_ID || adminEnv.REACT_APP_COGNITO_CLIENT_ID;
  assert(userPoolId, 'COGNITO_STAFF_USER_POOL_ID or COGNITO_USER_POOL_ID missing from admin env');
  assert(clientId, 'COGNITO_STAFF_CLIENT_ID or COGNITO_CLIENT_ID missing from admin env');

  const db = await mysql.createConnection(mysqlConfigFromEnv(adminEnv));
  const cognito = new CognitoIdentityProviderClient(awsConfigFromEnv(adminEnv));
  const suffix = randomSuffix();
  const staff = {
    regionalManager: {
      username: `codex.ei.${suffix}.rm@example.com`,
      email: `codex.ei.${suffix}.rm@example.com`,
      password: randomPassword(),
      displayName: `Codex EI RM ${suffix}`,
      role: 'Regional Manager',
      groupName: 'Regional_Manager',
    },
    coordinator: {
      username: `codex.ei.${suffix}.coord@example.com`,
      email: `codex.ei.${suffix}.coord@example.com`,
      password: randomPassword(),
      displayName: `Codex EI Coordinator ${suffix}`,
      role: 'ISET Coordinator',
      groupName: 'ISET_Coordinator',
    },
  };
  const results = [];
  let fixture = null;
  let cleanupCounts = null;

  try {
    for (const user of Object.values(staff)) {
      const created = await createCognitoUser({
        client: cognito,
        userPoolId,
        username: user.username,
        email: user.email,
        password: user.password,
        groupName: user.groupName,
        givenName: 'Codex',
        familyName: user.role.replace(/\s+/g, ''),
      });
      user.sub = created.sub;
    }
    fixture = await createFixtureRows({ db, suffix, staff });
    pass(results, 'Disposable DEV Cognito and DB fixture created', {
      caseId: fixture.caseId,
      applicationId: fixture.applicationId,
      documentId: fixture.documentId,
    });

    const auth = {
      regionalManager: await authenticateStaffUser({
        client: cognito,
        userPoolId,
        clientId,
        username: staff.regionalManager.username,
        password: staff.regionalManager.password,
        adminEnv,
        args,
        expectedRole: 'Regional Manager',
      }),
      coordinator: await authenticateStaffUser({
        client: cognito,
        userPoolId,
        clientId,
        username: staff.coordinator.username,
        password: staff.coordinator.password,
        adminEnv,
        args,
        expectedRole: 'ISET Coordinator',
      }),
    };
    pass(results, 'Disposable DEV staff users authenticated with real Cognito tokens', {
      rmFlow: auth.regionalManager.flow,
      coordinatorFlow: auth.coordinator.flow,
    });

    await runApiSmoke({ args, db, fixture, auth, results });
    if (!args.skipBrowser) {
      await runBrowserSmoke({ args, db, fixture, auth, results });
    }
    await runNegativeApiChecks({ args, db, fixture, auth, results });
  } finally {
    if (fixture && !args.keepFixture) {
      cleanupCounts = await cleanupFixture({ db, fixture, cognito, userPoolId });
      expectResult(
        results,
        'Cleanup removed disposable DEV fixture rows',
        cleanupCounts && Object.values(cleanupCounts).every(value => Number(value) === 0),
        cleanupCounts || {}
      );
    } else if (fixture) {
      for (const user of Object.values(staff)) {
        console.warn(`[keep-fixture] Cognito user kept: ${user.username}`);
      }
    } else {
      for (const user of Object.values(staff)) {
        await deleteCognitoUserQuietly(cognito, userPoolId, user.username);
      }
    }
    await db.end();
  }

  const summary = {
    pass: results.every(result => result.status === 'PASS'),
    awsIdentity,
    fixture: fixture ? {
      suffix: fixture.suffix,
      caseId: fixture.caseId,
      applicationId: fixture.applicationId,
      caseNumber: fixture.caseNumber,
      referenceNumber: fixture.referenceNumber,
    } : null,
    fixtureKept: Boolean(fixture && args.keepFixture),
    cleanupCounts,
    results,
  };
  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(renderHuman(summary));
  }
  if (!summary.pass) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
