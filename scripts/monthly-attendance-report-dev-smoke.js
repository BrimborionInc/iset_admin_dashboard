#!/usr/bin/env node
/*
 * Real DEV end-to-end smoke for the Client Monthly Attendance Report.
 *
 * The smoke refuses non-DEV AWS credentials, creates disposable Cognito and
 * MySQL fixtures, sends workflow 54 through the admin secure-message API,
 * completes the absence branch in the participant portal, and verifies the
 * signed report plus its uploaded supporting document before cleaning up.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');
const {
  CognitoIdentityProviderClient,
} = require('@aws-sdk/client-cognito-identity-provider');
const {
  ATTENDANCE_ABSENCE_ROWS,
  ATTENDANCE_REPORT_KEYS,
} = require('../../shared/attendanceReport');
const {
  asJson,
  assert,
  assertDevAwsAccount,
  awsConfigFromEnv,
  cleanupFixture,
  clickByText,
  createCognitoUser,
  createFixtureRows,
  deleteObjectQuietly,
  ensureLocalChromeLibraryPath,
  findChromeExecutable,
  getJson,
  loginAdminViaHostedUi,
  makePassword,
  makeSuffix,
  mysqlConfig,
  parseEnvFile,
  portalPasswordLogin,
  screenshot,
  setPortalCookies,
  typeInto,
  waitForText,
} = require('./financial-overview-editable-dev-smoke');

const ATTENDANCE_WORKFLOW_ID = 54;
const DEFAULT_SCREENSHOT_ROOT = path.join(process.cwd(), 'tmp', 'monthly-attendance-report-dev-smoke');
const PREFILL_INSTITUTION = 'North Star Skills Institute';
const PREFILL_PROGRAM = 'Community Employment Practitioner Diploma';
const EDITED_INSTITUTION = 'North Star Skills Institute - Downtown Campus';
const SUPPORTING_DOCUMENT_NAME = 'Synthetic-attendance-absence-proof.png';

function parseArgs(argv) {
  const args = {
    adminApiBase: process.env.ATTENDANCE_SMOKE_ADMIN_API_BASE || 'http://localhost:5001',
    portalFrontendBase: process.env.ATTENDANCE_SMOKE_PORTAL_FRONTEND_BASE || 'http://localhost:3000',
    portalApiBase: process.env.ATTENDANCE_SMOKE_PORTAL_API_BASE || 'http://localhost:5000',
    screenshotDir: process.env.ATTENDANCE_SMOKE_SCREENSHOT_DIR || '',
    keepFixture: false,
    headed: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--admin-api-base') {
      args.adminApiBase = argv[++index] || args.adminApiBase;
    } else if (token === '--portal-frontend-base') {
      args.portalFrontendBase = argv[++index] || args.portalFrontendBase;
    } else if (token === '--portal-api-base') {
      args.portalApiBase = argv[++index] || args.portalApiBase;
    } else if (token === '--screenshot-dir') {
      args.screenshotDir = argv[++index] || args.screenshotDir;
    } else if (token === '--keep-fixture') {
      args.keepFixture = true;
    } else if (token === '--headed') {
      args.headed = true;
    } else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/monthly-attendance-report-dev-smoke.js [options]',
        '',
        'The local DEV admin API, portal API, portal frontend, and MinIO must be running.',
        '',
        'Options:',
        '  --admin-api-base URL          Default: http://localhost:5001',
        '  --portal-frontend-base URL    Default: http://localhost:3000',
        '  --portal-api-base URL         Default: http://localhost:5000',
        '  --screenshot-dir DIR          Override the timestamped evidence directory.',
        '  --keep-fixture                Leave disposable fixture data for inspection.',
        '  --headed                      Run Chrome visibly.',
      ].join('\n'));
      process.exit(0);
    }
  }
  for (const key of ['adminApiBase', 'portalFrontendBase', 'portalApiBase']) {
    args[key] = String(args[key] || '').replace(/\/+$/, '');
  }
  if (!args.screenshotDir) {
    args.screenshotDir = path.join(
      DEFAULT_SCREENSHOT_ROOT,
      new Date().toISOString().replace(/[:.]/g, '-')
    );
  }
  return args;
}

async function assertLocalStack(args) {
  for (const [label, url] of [
    ['admin API', `${args.adminApiBase}/healthz`],
    ['portal API', `${args.portalApiBase}/healthz`],
    ['portal frontend', args.portalFrontendBase],
  ]) {
    const response = await fetch(url);
    assert(response.ok, `${label} is not healthy at ${url} (${response.status})`);
  }
  console.log('[stack] local DEV admin, portal, and frontend are healthy');
}

async function createAttendanceIntervention(db, fixture, staffProfileId) {
  const [result] = await db.query(
    `INSERT INTO iset_case_intervention
      (case_id, intervention_code, status, start_date, end_date, metadata_json,
       created_by_staff_profile_id, reviewed_by_staff_profile_id, reviewed_at)
     VALUES (?, 12, 'approved', '2026-07-01', '2027-03-31', CAST(? AS JSON), ?, ?, NOW())`,
    [
      fixture.caseId,
      JSON.stringify({
        attendanceReportSmoke: true,
        institution: PREFILL_INSTITUTION,
        programName: PREFILL_PROGRAM,
        snapshot: {
          institution: 'Lower-priority snapshot institution',
          programName: 'Lower-priority snapshot program',
        },
      }),
      staffProfileId,
      staffProfileId,
    ]
  );
  return Number(result.insertId);
}

async function sendAttendanceReport({ adminApiBase, adminIdToken, fixture, interventionId }) {
  const { body } = await getJson(`${adminApiBase}/api/cases/${fixture.caseId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminIdToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: 'Complete your Client Monthly Attendance Report',
      body: 'Please complete and sign your attendance report for the reporting month.',
      urgent: false,
      toDisplayName: fixture.applicantName,
      fromDisplayName: 'Codex DEV Smoke Tester',
      applicationId: fixture.applicationId,
      interventionId,
      attachments: [{ workflow_id: ATTENDANCE_WORKFLOW_ID }],
    }),
  });
  return body;
}

async function fetchAttendanceRequest(db, caseId) {
  const [[row]] = await db.query(
    `SELECT sr.*, msr.message_id
       FROM signing_request sr
       LEFT JOIN message_signing_request msr ON msr.signing_request_id = sr.id
      WHERE sr.case_id = ? AND sr.workflow_id = ?
      ORDER BY sr.id DESC
      LIMIT 1`,
    [caseId, ATTENDANCE_WORKFLOW_ID]
  );
  assert(row?.id, 'No monthly attendance signing request was created');
  return row;
}

function assertAttendanceSchema(row, fixture) {
  assert(row.status === 'pending', `attendance request expected pending, got ${row.status}`);
  assert(row.workflow_type === 'consent-cm-prefill', `unexpected workflow type ${row.workflow_type}`);
  assert(row.checklist_doc_type === 'attendance_form', `unexpected document type ${row.checklist_doc_type}`);
  const schema = asJson(row.resolved_schema_json, {});
  const initial = schema.initialValues || schema.meta?.initialValues || {};
  assert(initial[ATTENDANCE_REPORT_KEYS.clientName] === fixture.applicantName, 'participant name prefill was not resolved');
  assert(initial[ATTENDANCE_REPORT_KEYS.institution] === PREFILL_INSTITUTION, 'selected intervention institution prefill was not resolved');
  assert(initial[ATTENDANCE_REPORT_KEYS.programName] === PREFILL_PROGRAM, 'selected intervention program prefill was not resolved');
  assert(schema.meta?.attendanceReport === true, 'attendance report schema marker is missing');

  const steps = Array.isArray(schema.steps) ? schema.steps : [];
  assert(steps.length === 3, `expected 3 attendance steps, got ${steps.length}`);
  const details = steps.find(step => step.stepId === 'monthly-attendance-details');
  const absence = steps.find(step => step.stepId === 'monthly-attendance-absences');
  assert(details?.branching?.length === 2, 'details step is missing its attendance branch rules');
  const absenceFields = absence?.components?.filter(component => (
    component.repeatable?.group === 'attendance-absences'
  )) || [];
  assert(absenceFields.length === 8, `expected 8 repeatable absence fields, got ${absenceFields.length}`);
  assert(absenceFields.every(component => component.repeatable?.maxItems === 4), 'absence repeatable limit is not 4');
  const upload = absence?.components?.find(component => component.storageKey === ATTENDANCE_REPORT_KEYS.supportingDocuments);
  assert(upload?.required === true && upload?.multiple === true, 'supporting document upload is not required/multiple');
  assert(upload?.documentType === 'medical_documentation', `unexpected supporting document type ${upload?.documentType}`);
  return schema;
}

function cookieHeader(cookies) {
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

async function assertMalformedSubmissionRejected({ portalApiBase, cookies, signingRequestId, db }) {
  const response = await fetch(`${portalApiBase}/api/signing-requests/${signingRequestId}/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({
      [ATTENDANCE_REPORT_KEYS.clientName]: 'Fiona Attendance',
      [ATTENDANCE_REPORT_KEYS.attendanceStatus]: 'absences',
    }),
  });
  const body = await response.json().catch(() => null);
  assert(response.status === 422, `malformed attendance submit expected 422, got ${response.status}`);
  assert(body?.error === 'invalid_attendance_report', `unexpected validation response ${JSON.stringify(body)}`);
  assert(Array.isArray(body?.fields) && body.fields.includes('signature_required'), 'server validation did not require a signature');
  const [[row]] = await db.query('SELECT status FROM signing_request WHERE id = ? LIMIT 1', [signingRequestId]);
  assert(row?.status !== 'signed', 'malformed submission changed the request to signed');
  console.log('[assert] malformed direct submission rejected with 422 and no signing transition');
}

async function setNativeValue(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: 20000 });
  await page.$eval(selector, (element, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter.call(element, nextValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function driveParticipantForm({ page, portalFrontendBase, signingRequestId, screenshotDir, supportingDocumentPath }) {
  const evidenceDir = path.join(screenshotDir, 'email-assets');
  fs.mkdirSync(evidenceDir, { recursive: true });
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(`${portalFrontendBase}/documents/${signingRequestId}`, { waitUntil: 'networkidle2' });
  await waitForText(page, 'Client Monthly Attendance Report');
  await page.waitForSelector(`#${ATTENDANCE_REPORT_KEYS.clientName}`, { visible: true, timeout: 30000 });

  const prefilled = await page.evaluate(keys => ({
    clientName: document.getElementById(keys.clientName)?.value,
    institution: document.getElementById(keys.institution)?.value,
    programName: document.getElementById(keys.programName)?.value,
  }), ATTENDANCE_REPORT_KEYS);
  assert(prefilled.clientName === 'Fiona Attendance', `participant name prefill not visible: ${prefilled.clientName}`);
  assert(prefilled.institution === PREFILL_INSTITUTION, `institution prefill not visible: ${prefilled.institution}`);
  assert(prefilled.programName === PREFILL_PROGRAM, `program prefill not visible: ${prefilled.programName}`);
  const pageText = await page.evaluate(() => document.body?.innerText || '');
  assert(pageText.includes('Enter your full legal name.'), 'client-name guidance is missing');
  assert(
    pageText.includes('Enter the name of the school or training provider you attended this month.'),
    'institution guidance is missing'
  );
  assert(
    pageText.includes('Enter the name of the program or course you attended this month.'),
    'program guidance is missing'
  );
  assert(!pageText.includes('PATH has filled this'), 'obsolete PATH prefill wording is still visible');
  await screenshot(page, path.join(evidenceDir, '01-attendance-prefilled-details.png'));

  await typeInto(page, `#${ATTENDANCE_REPORT_KEYS.institution}`, EDITED_INSTITUTION);
  await setNativeValue(page, `#${ATTENDANCE_REPORT_KEYS.reportingMonth}`, '2026-06');
  const absenceSelector = `input[name="${ATTENDANCE_REPORT_KEYS.attendanceStatus}"][value="absences"]`;
  await page.waitForSelector(absenceSelector, { visible: true, timeout: 15000 });
  await page.click(absenceSelector);
  await clickByText(page, 'button', 'Next');

  await page.waitForSelector(`#${ATTENDANCE_REPORT_KEYS.absenceDate1}`, { visible: true, timeout: 20000 });
  const firstDateBounds = await page.$eval(`#${ATTENDANCE_REPORT_KEYS.absenceDate1}`, element => ({
    min: element.min,
    max: element.max,
  }));
  assert(firstDateBounds.min === '2026-06-01', `first absence minimum was ${firstDateBounds.min}`);
  assert(firstDateBounds.max === '2026-06-30', `first absence maximum was ${firstDateBounds.max}`);
  const secondAbsence = ATTENDANCE_ABSENCE_ROWS[1];
  const thirdAbsence = ATTENDANCE_ABSENCE_ROWS[2];
  assert(await page.$(`#${secondAbsence.dateKey}`) === null, 'second absence row was shown before it was requested');
  await setNativeValue(page, `#${ATTENDANCE_REPORT_KEYS.absenceDate1}`, '2026-06-17');
  await typeInto(page, `#${ATTENDANCE_REPORT_KEYS.absenceReason1}`, 'Medical appointment; documentation attached.');
  await clickByText(page, 'button', 'Add another absence');
  await page.waitForSelector(`#${secondAbsence.dateKey}`, { visible: true, timeout: 15000 });
  const secondDateBounds = await page.$eval(`#${secondAbsence.dateKey}`, element => ({
    min: element.min,
    max: element.max,
  }));
  assert(secondDateBounds.min === '2026-06-01', `second absence minimum was ${secondDateBounds.min}`);
  assert(secondDateBounds.max === '2026-06-30', `second absence maximum was ${secondDateBounds.max}`);
  assert(await page.$(`#${thirdAbsence.dateKey}`) === null, 'third absence row was shown before it was requested');
  await setNativeValue(page, `#${secondAbsence.dateKey}`, '2026-06-24');
  await typeInto(page, `#${secondAbsence.reasonKey}`, 'Second documented medical appointment.');
  const input = await page.$(`#${ATTENDANCE_REPORT_KEYS.supportingDocuments}-picker`);
  assert(input, 'supporting document picker was not rendered');
  await input.uploadFile(supportingDocumentPath);
  await waitForText(page, SUPPORTING_DOCUMENT_NAME, 60000);
  await page.waitForFunction(() => !(document.body?.innerText || '').includes('Uploading…'), { timeout: 60000 });
  await screenshot(page, path.join(evidenceDir, '02-attendance-absence-and-upload.png'));
  await clickByText(page, 'button', 'Next');

  await page.waitForSelector(`#${ATTENDANCE_REPORT_KEYS.signature}`, { visible: true, timeout: 20000 });
  await typeInto(page, `#${ATTENDANCE_REPORT_KEYS.signature}`, 'Fiona Attendance');
  await clickByText(page, 'button', 'Sign report');
  await screenshot(page, path.join(evidenceDir, '03-attendance-signed-declaration.png'));
  await clickByText(page, 'button', 'Submit');
  await waitForText(page, 'Submitted', 60000);
  await screenshot(page, path.join(evidenceDir, '04-attendance-submitted.png'));
  return evidenceDir;
}

async function assertSignedState({ db, signingRequestId, fixture, portalApiBase, cookies, artifactOutputPath }) {
  const [[row]] = await db.query('SELECT * FROM signing_request WHERE id = ? LIMIT 1', [signingRequestId]);
  assert(row?.status === 'signed', `attendance request expected signed, got ${row?.status}`);
  assert(row?.signed_at, 'attendance request signed_at was not stored');
  assert(row?.artifact_url, 'attendance request artifact URL was not stored');
  assert(row?.completion_artifact_key, 'attendance request artifact key was not stored');
  const payload = asJson(row.signed_payload_json, {});
  assert(payload[ATTENDANCE_REPORT_KEYS.institution] === EDITED_INSTITUTION, 'edited institution was not preserved');
  assert(payload[ATTENDANCE_REPORT_KEYS.reportingMonth] === '2026-06', 'reporting month was not preserved');
  assert(payload[ATTENDANCE_REPORT_KEYS.attendanceStatus] === 'absences', 'absence branch status was not preserved');
  assert(payload[ATTENDANCE_REPORT_KEYS.absenceDate1] === '2026-06-17', 'absence date was not preserved');
  assert(payload[ATTENDANCE_ABSENCE_ROWS[1].dateKey] === '2026-06-24', 'added absence date was not preserved');
  assert(payload[ATTENDANCE_ABSENCE_ROWS[1].reasonKey] === 'Second documented medical appointment.', 'added absence reason was not preserved');
  assert(Array.isArray(payload[ATTENDANCE_REPORT_KEYS.supportingDocuments]), 'supporting upload payload was not preserved');
  assert(payload[ATTENDANCE_REPORT_KEYS.signature]?.signed === true, 'signature acknowledgement was not preserved');

  const [documents] = await db.query(
    `SELECT id, source, file_name, file_path, mime_type, label, metadata,
            document_category, signing_request_id
       FROM iset_document
      WHERE case_id = ?
      ORDER BY id`,
    [fixture.caseId]
  );
  const signed = documents.find(document => Number(document.signing_request_id) === Number(signingRequestId));
  assert(signed?.source === 'system_generated', 'signed attendance PDF was not materialized as system_generated');
  assert(signed?.document_category === 'attendance_form', `signed document category was ${signed?.document_category}`);
  assert(signed?.mime_type === 'application/pdf', `signed artifact MIME type was ${signed?.mime_type}`);
  const supporting = documents.find(document => {
    const metadata = asJson(document.metadata, {});
    return metadata.materialized_from === 'signing_request_payload' &&
      Number(metadata.signing_request_id) === Number(signingRequestId);
  });
  assert(supporting?.source === 'application_submission', 'supporting upload was not materialized to the case/application');
  assert(supporting?.document_category === 'medical_documentation', `supporting document category was ${supporting?.document_category}`);
  assert(supporting?.file_name === SUPPORTING_DOCUMENT_NAME, `supporting file name was ${supporting?.file_name}`);

  const { body: download } = await getJson(`${portalApiBase}/api/signing-requests/${signingRequestId}/download`, {
    headers: { Cookie: cookieHeader(cookies) },
  });
  assert(download?.download_url, 'signed artifact download URL was not resolved');
  const artifactResponse = await fetch(download.download_url);
  const artifact = Buffer.from(await artifactResponse.arrayBuffer());
  assert(artifactResponse.ok, `signed artifact fetch failed ${artifactResponse.status}`);
  assert(artifact.subarray(0, 5).toString('ascii') === '%PDF-', 'signed artifact is not a PDF');
  assert(artifact.length > 1000, `signed artifact is unexpectedly small (${artifact.length} bytes)`);
  if (artifactOutputPath) fs.writeFileSync(artifactOutputPath, artifact);
  console.log(`[assert] signed PDF document=${signed.id}, supporting document=${supporting.id}, artifactBytes=${artifact.length}`);
  return { row, payload, signed, supporting, documents };
}

async function assertRepeatSigningIdempotent({ portalApiBase, cookies, signingRequestId, db, signedState }) {
  const repeatPayload = {
    ...signedState.payload,
    [ATTENDANCE_REPORT_KEYS.institution]: 'Must not replace signed payload',
  };
  const response = await fetch(`${portalApiBase}/api/signing-requests/${signingRequestId}/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(cookies),
    },
    body: JSON.stringify(repeatPayload),
  });
  const body = await response.json().catch(() => null);
  assert(response.ok && body?.alreadySigned === true, `repeat signing was not idempotent: ${response.status} ${JSON.stringify(body)}`);
  const [[after]] = await db.query('SELECT signed_payload_json, completion_artifact_key FROM signing_request WHERE id = ? LIMIT 1', [signingRequestId]);
  const [afterDocuments] = await db.query('SELECT id FROM iset_document WHERE case_id = ? ORDER BY id', [signedState.signed.case_id || 0]);
  assert(JSON.stringify(asJson(after.signed_payload_json, {})) === JSON.stringify(signedState.payload), 'repeat signing changed the signed payload');
  assert(after.completion_artifact_key === signedState.row.completion_artifact_key, 'repeat signing changed the artifact key');
  if (afterDocuments.length) {
    assert(afterDocuments.length === signedState.documents.length, 'repeat signing changed the case document count');
  }
  console.log('[assert] repeat signing returned alreadySigned and preserved the signed snapshot');
}

async function cleanupAttendanceUploads({ db, fixture, portalEnv, keepFixture }) {
  if (keepFixture || !fixture?.userId) return;
  const [files] = await db.query('SELECT file_path FROM iset_application_file WHERE user_id = ?', [fixture.userId]);
  await db.query('DELETE FROM iset_application_file WHERE user_id = ?', [fixture.userId]);
  return (files || []).map(file => file.file_path).filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.screenshotDir, { recursive: true });
  const supportingDocumentPath = path.join(args.screenshotDir, SUPPORTING_DOCUMENT_NAME);

  const adminEnv = parseEnvFile(path.join(process.cwd(), '.env'));
  const portalEnv = parseEnvFile(path.join(process.cwd(), '..', 'ISET-intake', '.env'));
  await assertDevAwsAccount('admin .env', adminEnv);
  await assertDevAwsAccount('portal .env', portalEnv);
  await assertLocalStack(args);

  const adminCognito = new CognitoIdentityProviderClient(awsConfigFromEnv(adminEnv));
  const portalCognito = new CognitoIdentityProviderClient(awsConfigFromEnv(portalEnv));
  const db = await mysql.createConnection(mysqlConfig(adminEnv));
  ensureLocalChromeLibraryPath();
  const executablePath = findChromeExecutable();
  assert(executablePath, 'Could not find local Chrome for Puppeteer');
  const browser = await puppeteer.launch({
    headless: args.headed ? false : 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 1100, deviceScaleFactor: 1 },
  });
  const supportingEvidencePage = await browser.newPage();
  await supportingEvidencePage.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });
  await supportingEvidencePage.setContent(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Synthetic attendance evidence</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 72px; color: #1f2933; }
          .notice { border: 8px solid #b10e1e; padding: 44px; }
          h1 { color: #b10e1e; font-size: 42px; margin-top: 0; }
          p { font-size: 28px; line-height: 1.45; }
          strong { text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="notice">
          <h1>Synthetic test evidence</h1>
          <p><strong>Not a real participant or medical document.</strong></p>
          <p>Attendance report smoke-test fixture for an example absence on June 17, 2026.</p>
          <p>Contains no real personal, health, educational, or employment information.</p>
        </div>
      </body>
    </html>`);
  await supportingEvidencePage.screenshot({ path: supportingDocumentPath, fullPage: true });
  await supportingEvidencePage.close();

  const suffix = makeSuffix();
  const staff = {
    username: `attendance-smoke-staff-${suffix}`,
    email: `attendance-smoke-staff-${suffix}@example.test`,
    password: makePassword(),
    sub: null,
    userId: null,
  };
  const applicant = {
    email: `attendance-smoke-applicant-${suffix}@example.test`,
    password: makePassword(),
    firstName: 'Fiona',
    lastName: 'Attendance',
    sub: null,
  };
  applicant.username = applicant.email;
  let fixture = null;
  let uploadedObjectKeys = [];
  let adminPage = null;
  let portalPage = null;
  try {
    console.log(`[fixture] suffix ${suffix}`);
    staff.sub = (await createCognitoUser({
      client: adminCognito,
      userPoolId: adminEnv.COGNITO_STAFF_USER_POOL_ID || adminEnv.COGNITO_USER_POOL_ID,
      username: staff.username,
      email: staff.email,
      password: staff.password,
      group: 'System_Administrator',
      givenName: 'Codex',
      familyName: 'Attendance Smoke',
    })).sub;
    applicant.sub = (await createCognitoUser({
      client: portalCognito,
      userPoolId: portalEnv.COGNITO_USER_POOL_ID,
      username: applicant.username,
      email: applicant.email,
      password: applicant.password,
      givenName: applicant.firstName,
      familyName: applicant.lastName,
    })).sub;
    console.log('[cognito] disposable DEV staff and applicant created');

    adminPage = await browser.newPage();
    adminPage.on('console', message => {
      if (message.type() === 'error') console.warn(`[admin browser] ${message.text().slice(0, 500)}`);
    });
    const adminAuth = await loginAdminViaHostedUi({
      page: adminPage,
      adminEnv,
      username: staff.username,
      password: staff.password,
      adminApiBase: args.adminApiBase,
    });
    const staffProfileId = Number(adminAuth.me?.auth?.staffProfileId);
    const [[staffUserRow]] = await db.query('SELECT id FROM user WHERE cognito_sub = ? LIMIT 1', [staff.sub]);
    staff.userId = Number(staffUserRow?.id || adminAuth.me?.auth?.userId || 0) || null;
    fixture = await createFixtureRows({ db, suffix, staffProfileId, staffUserId: staff.userId, applicant });
    const interventionId = await createAttendanceIntervention(db, fixture, staffProfileId);
    console.log(`[fixture] case=${fixture.caseId} application=${fixture.applicationId} intervention=${interventionId}`);

    await sendAttendanceReport({
      adminApiBase: args.adminApiBase,
      adminIdToken: adminAuth.session.idToken,
      fixture,
      interventionId,
    });
    const request = await fetchAttendanceRequest(db, fixture.caseId);
    assertAttendanceSchema(request, fixture);
    console.log(`[admin] secure message created signingRequest=${request.id} with selected-intervention prefill`);

    const cookies = await portalPasswordLogin({
      portalApiBase: args.portalApiBase,
      email: applicant.email,
      password: applicant.password,
    });
    await assertMalformedSubmissionRejected({
      portalApiBase: args.portalApiBase,
      cookies,
      signingRequestId: request.id,
      db,
    });

    portalPage = await browser.newPage();
    portalPage.on('console', message => {
      if (message.type() === 'error') console.warn(`[portal browser] ${message.text().slice(0, 500)}`);
    });
    await setPortalCookies(portalPage, args.portalFrontendBase, cookies);
    const evidenceDir = await driveParticipantForm({
      page: portalPage,
      portalFrontendBase: args.portalFrontendBase,
      signingRequestId: request.id,
      screenshotDir: args.screenshotDir,
      supportingDocumentPath,
    });
    const signedState = await assertSignedState({
      db,
      signingRequestId: request.id,
      fixture,
      portalApiBase: args.portalApiBase,
      cookies,
      artifactOutputPath: path.join(args.screenshotDir, 'Client Monthly Attendance Report - signed DEV smoke.pdf'),
    });
    await assertRepeatSigningIdempotent({
      portalApiBase: args.portalApiBase,
      cookies,
      signingRequestId: request.id,
      db,
      signedState: { ...signedState, signed: { ...signedState.signed, case_id: fixture.caseId } },
    });

    const report = {
      ok: true,
      suffix,
      screenshotDir: args.screenshotDir,
      evidenceDir,
      caseId: fixture.caseId,
      applicationId: fixture.applicationId,
      interventionId,
      signingRequestId: Number(request.id),
      signedDocumentId: Number(signedState.signed.id),
      supportingDocumentId: Number(signedState.supporting.id),
      artifactKey: signedState.row.completion_artifact_key,
    };
    fs.writeFileSync(path.join(args.screenshotDir, 'smoke-result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (adminPage) await adminPage.close().catch(() => null);
    if (portalPage) await portalPage.close().catch(() => null);
    await browser.close().catch(() => null);
    uploadedObjectKeys = await cleanupAttendanceUploads({
      db,
      fixture,
      portalEnv,
      keepFixture: args.keepFixture,
    }).catch(error => {
      console.warn(`[cleanup] application uploads failed: ${error?.message || error}`);
      return [];
    });
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
    }).catch(error => console.warn(`[cleanup] fixture cleanup failed: ${error?.stack || error}`));
    if (!args.keepFixture) {
      for (const key of uploadedObjectKeys || []) {
        await deleteObjectQuietly(portalEnv, key);
      }
    }
    await db.end().catch(() => null);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}
