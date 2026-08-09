#!/usr/bin/env node
/*
 * Deterministic browser regression for existing-intervention Paid from state.
 *
 * Loads the compiled Case Workspace with an internal manual-backload
 * intervention under an external action plan, then proves edit/save/reopen
 * preserve the intervention's own posting context. It separately proves an
 * exact finally decided review-workflow record remains read-only.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'intervention-posting-context-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';
const CASE_ID = 1;
const APPLICATION_ID = 2;
const APPLICANT_USER_ID = 42;
const ACTION_PLAN_ID = 10;
const INTERVENTION_ID = 17;

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.INTERVENTION_POSTING_CONTEXT_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.INTERVENTION_POSTING_CONTEXT_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--frontend-base') {
      args.frontendBase = argv[++index] || args.frontendBase;
    } else if (token === '--screenshot-dir') {
      args.screenshotDir = argv[++index] || args.screenshotDir;
    } else if (token === '--help' || token === '-h') {
      console.log('Usage: node scripts/intervention-posting-context-browser-smoke.js [--frontend-base URL] [--screenshot-dir DIR]');
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }
  args.frontendBase = String(args.frontendBase).replace(/\/+$/, '');
  return args;
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
  const entries = String(process.env.LD_LIBRARY_PATH || '').split(':').filter(Boolean);
  if (!entries.includes(LOCAL_CHROME_LIBRARY_PATH)) {
    process.env.LD_LIBRARY_PATH = [LOCAL_CHROME_LIBRARY_PATH, ...entries].join(':');
  }
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fakeJwt() {
  const now = Math.floor(Date.now() / 1000);
  return [
    base64UrlEncode({ alg: 'none', typ: 'JWT' }),
    base64UrlEncode({
      sub: 'smoke-regional-manager-sub',
      email: 'regional.manager@awentech.ca',
      name: 'Regional Manager',
      role: 'Regional Manager',
      'cognito:groups': ['Regional_Manager'],
      iat: now,
      exp: now + 3600,
    }),
    'signature',
  ].join('.');
}

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitUntil(predicate, label, timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = predicate();
    if (result) return result;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function buildIntervention(overrides = {}) {
  return {
    id: INTERVENTION_ID,
    actionPlanId: ACTION_PLAN_ID,
    code: '10',
    title: 'Existing training intervention',
    status: 'in_progress',
    deliveryStatus: 'in_progress',
    startDate: '2026-07-01',
    endDate: '2026-12-31',
    durationDays: 184,
    cost: 2500,
    fundingStream: 'EI',
    postingContext: 'internal',
    noc: '13100',
    nocVersion: '2021',
    deliveryMode: 'partner',
    institution: 'Example College',
    programName: 'Legal Paraprofessional Diploma',
    metadata: {
      source: 'manual_backload',
      postingContext: 'internal',
      deliveryMode: 'partner',
      institution: 'Example College',
      programName: 'Legal Paraprofessional Diploma',
    },
    compliance: { ilmp: 'ok', finance: 'ok' },
    createdAt: '2026-07-22T17:30:00Z',
    updatedAt: '2026-07-22T17:38:29Z',
    ...overrides,
  };
}

function buildCasePayload(intervention) {
  return {
    id: CASE_ID,
    case_id: CASE_ID,
    application_id: APPLICATION_ID,
    applicationId: APPLICATION_ID,
    application_row_version: 7,
    applicant_user_id: APPLICANT_USER_ID,
    tracking_id: 'ISET-SMOKE-POSTING-CONTEXT',
    applicant_name: 'Posting Context Smoke',
    first_name: 'Posting',
    last_name: 'Smoke',
    applicant_email: 'posting-context@example.invalid',
    address_province: 'QC',
    status: 'initiated',
    lifecycle_status: 'active',
    applicationStatus: 'approved',
    application_lifecycle_status: 'active',
    decision_outcome: 'approved',
    assigned_staff_profile_id: 1,
    assigned_user_email: 'regional.manager@awentech.ca',
    assigned_user_display_name: 'Regional Manager',
    payload_json: '{}',
    counts: { openInterventions: 1, totalInterventions: 1 },
    caseContext: {
      applicationAssessmentContext: { [APPLICATION_ID]: {} },
      applicationReportingArtifacts: {},
    },
    actionPlans: [
      {
        id: ACTION_PLAN_ID,
        caseId: CASE_ID,
        ...(intervention.applicationId
          ? { applicationId: intervention.applicationId, application_id: intervention.applicationId }
          : {}),
        name: 'Existing external action plan',
        status: 'active',
        effectiveDate: '2026-06-01',
        reviewDate: '2027-03-31',
        fundingStream: 'EI',
        postingContext: 'external',
        budgetPotId: 126,
        budgetPotCode: 'SMOKE-EI',
        budgetPotName: 'Smoke EI clients',
        interventions: [intervention],
        interventionCount: 1,
        createdAt: '2026-06-01T12:00:00Z',
        updatedAt: '2026-07-22T17:38:29Z',
      },
    ],
  };
}

function buildApplicationPayload() {
  return {
    id: APPLICATION_ID,
    case_id: CASE_ID,
    applicant_user_id: APPLICANT_USER_ID,
    row_version: 7,
    payload_json: '{}',
    status: 'approved',
    lifecycle_status: 'active',
    applicant_name: 'Posting Context Smoke',
    tracking_id: 'ISET-SMOKE-POSTING-CONTEXT',
  };
}

async function installApiStubs(page, state) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      request.continue();
      return;
    }

    const record = {
      method: request.method(),
      path: url.pathname,
      search: url.search,
      postData: request.postData() || null,
    };
    state.apiCalls.push(record);

    if (record.method === 'OPTIONS') {
      request.respond({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'authorization,x-access-token,content-type',
        },
      });
      return;
    }

    const { path: pathname, method } = record;
    if (pathname === '/api/auth/me') {
      request.respond(jsonResponse({
        auth: {
          sub: 'smoke-regional-manager-sub',
          email: 'regional.manager@awentech.ca',
          name: 'Regional Manager',
          role: 'Regional Manager',
          groups: ['Regional_Manager'],
          staffProfileId: 1,
          regionIds: [1],
        },
        profile: {
          id: 1,
          email: 'regional.manager@awentech.ca',
          name: 'Regional Manager',
          role: 'Regional Manager',
          region_id: 1,
          region_ids: [1],
        },
      }));
      return;
    }
    if ((pathname === `/api/cases/${CASE_ID}` || pathname === `/api/cases/${CASE_ID}/workspace`) && method === 'GET') {
      request.respond(jsonResponse(buildCasePayload(state.intervention)));
      return;
    }
    if (pathname === `/api/interventions/${INTERVENTION_ID}` && method === 'PATCH') {
      const submitted = JSON.parse(record.postData || '{}');
      state.savedPayloads.push(submitted);
      state.intervention = buildIntervention({
        ...submitted,
        id: INTERVENTION_ID,
        actionPlanId: ACTION_PLAN_ID,
        metadata: {
          ...state.intervention.metadata,
          ...(submitted.metadata || {}),
          postingContext: submitted.postingContext,
        },
        updatedAt: '2026-07-23T12:00:00Z',
      });
      request.respond(jsonResponse(state.intervention));
      return;
    }
    if (pathname === `/api/applications/${APPLICATION_ID}`) {
      request.respond(jsonResponse(buildApplicationPayload()));
      return;
    }
    if (pathname === '/api/access-control/matrix') {
      request.respond(jsonResponse({ default: 'allow', routes: {} }));
      return;
    }
    if (pathname === '/api/me/tutorial-progress') {
      request.respond(jsonResponse({ items: [{ tutorialId: 'case-workspace-overview-v3', status: 'dismissed' }] }));
      return;
    }
    if (pathname === '/api/me/notifications' || pathname === '/api/admin/contact-messages') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === '/api/me/staff-messages/counts') {
      request.respond(jsonResponse({ unread: 0, total: 0 }));
      return;
    }
    if (pathname === '/api/me/staff-profiles') {
      request.respond(jsonResponse({ items: [], profiles: [] }));
      return;
    }
    if (pathname === '/api/service-announcement/current') {
      request.respond(jsonResponse({ announcement: null }));
      return;
    }
    if (pathname === '/api/config/runtime/demo-navigation') {
      request.respond(jsonResponse({ enabled: false }));
      return;
    }
    if (pathname === '/api/regions/canada') {
      request.respond(jsonResponse([{ code: 'QC', name: 'Quebec' }]));
      return;
    }
    if (pathname === '/api/config/sla-targets') {
      request.respond(jsonResponse({ targets: [] }));
      return;
    }
    if (pathname === '/api/escalations') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }
    if (pathname === `/api/applications/${APPLICATION_ID}/watchlist-hit`) {
      request.respond(jsonResponse({ hasHit: false, hit: null }));
      return;
    }
    if (pathname === `/api/applicants/${APPLICANT_USER_ID}/document-checklist`) {
      request.respond(jsonResponse({ items: [], missingRequiredCount: 0 }));
      return;
    }
    if (pathname === `/api/applicants/${APPLICANT_USER_ID}/applications`) {
      request.respond(jsonResponse([{ id: APPLICATION_ID, application_id: APPLICATION_ID, case_id: CASE_ID }]));
      return;
    }
    if (pathname === `/api/applicants/${APPLICANT_USER_ID}/documents` || pathname === `/api/cases/${CASE_ID}/documents`) {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/document-types') {
      request.respond(jsonResponse([]));
      return;
    }
    if (
      pathname === `/api/cases/${CASE_ID}/messages` ||
      pathname === `/api/cases/${CASE_ID}/notes` ||
      pathname === `/api/cases/${CASE_ID}/events` ||
      pathname === '/api/reminders'
    ) {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/reference/intervention-codes') {
      request.respond(jsonResponse({
        codes: [{ code: '10', label: 'Occupational skills training - Diploma' }],
      }));
      return;
    }
    if (pathname === '/api/reference/intervention-outcomes') {
      request.respond(jsonResponse({
        outcomes: [{ code: '1', label: 'Employed' }],
      }));
      return;
    }
    if (pathname === '/api/reference/funding-streams') {
      request.respond(jsonResponse({
        streams: [{ code: 'EI', label: 'Employment Insurance' }],
      }));
      return;
    }
    if (pathname === '/api/reference/noc-versions') {
      request.respond(jsonResponse({
        versions: [{ code: '2021', label: 'NOC 2021' }],
      }));
      return;
    }
    if (pathname === '/api/reference/noc-codes') {
      request.respond(jsonResponse({ items: [{ code: '13100', title: 'Administrative officers' }] }));
      return;
    }
    if (pathname === '/api/reference/budget-pots-lite' || pathname === '/api/finance/budget-pots') {
      request.respond(jsonResponse({
        items: [{ id: 126, code: 'SMOKE-EI', name: 'Smoke EI clients', funding_stream: 'EI' }],
      }));
      return;
    }
    if (pathname === `/api/interventions/${INTERVENTION_ID}/payment-lines`) {
      request.respond(jsonResponse({ lines: [] }));
      return;
    }
    if (pathname === '/api/finance/payment-intervention-type-map') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }
    if (pathname === '/api/config/runtime/assessment-costing') {
      request.respond(jsonResponse({ paymentTypes: [], payeeTypes: [], interventions: [] }));
      return;
    }

    request.respond(jsonResponse({ items: [], rows: [], total: 0, count: 0 }));
  });
}

async function installBrowserSession(page, frontendBase) {
  const token = fakeJwt();
  const session = {
    idToken: token,
    accessToken: token,
    refreshToken: null,
    expiresAt: Math.floor(Date.now() / 1000) + 3300,
  };
  await page.evaluateOnNewDocument((authSession, baseUrl) => {
    window.__API_BASE__ = baseUrl;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
    localStorage.setItem('iset-case-workspace-layout-v14', JSON.stringify([
      { id: 'actionPlans', rowSpan: 4, columnSpan: 2 },
      { id: 'interventions', rowSpan: 4, columnSpan: 2 },
    ]));
  }, session, frontendBase);
}

async function clickByText(page, selector, label) {
  const clicked = await page.evaluate(({ targetSelector, targetLabel }) => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const target = Array.from(document.querySelectorAll(targetSelector)).find(
      element =>
        normalize(element.innerText || element.textContent) === targetLabel &&
        !element.disabled &&
        element.getAttribute('aria-disabled') !== 'true'
    );
    if (!target) return false;
    target.scrollIntoView({ block: 'center' });
    target.click();
    return true;
  }, { targetSelector: selector, targetLabel: label });
  if (!clicked) throw new Error(`Could not click ${selector} with text "${label}"`);
}

async function assertFinalRecordReadOnly(page, stage) {
  const state = await page.evaluate(() => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const buttons = Array.from(document.querySelectorAll('button'));
    const enabledLabels = buttons
      .filter(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true')
      .map(button => normalize(button.innerText || button.textContent))
      .filter(Boolean);
    const programNameInput = Array.from(document.querySelectorAll('input')).find(
      input => input.value === 'Legal Paraprofessional Diploma'
    );
    return {
      enabledLabels,
      programNamePresent: Boolean(programNameInput),
      programNameReadOnly: Boolean(
        programNameInput &&
        (programNameInput.readOnly || programNameInput.disabled || programNameInput.getAttribute('aria-readonly') === 'true')
      ),
    };
  });
  if (state.enabledLabels.includes('Edit') || state.enabledLabels.includes('Save changes')) {
    throw new Error(`${stage} exposed an edit/save control for a final intervention: ${JSON.stringify(state.enabledLabels)}`);
  }
  if (!state.programNamePresent || !state.programNameReadOnly) {
    throw new Error(`${stage} did not render the final intervention facts read-only: ${JSON.stringify(state)}`);
  }
}

async function openIntervention(page) {
  const opened = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a')).find(
      element => String(element.getAttribute('aria-label') || '').startsWith('View intervention ')
    );
    if (!link) return false;
    link.click();
    return true;
  });
  if (!opened) throw new Error('Could not find the existing intervention link.');
  await page.waitForFunction(() => {
    const headings = Array.from(document.querySelectorAll('h2'));
    return headings.some(heading => (heading.innerText || '').trim() === 'View intervention') &&
      (document.body?.innerText || '').includes('Paid from');
  });
}

async function readPaidFromText(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || '';
    const start = text.indexOf('Paid from');
    return start >= 0 ? text.slice(start, start + 240) : '';
  });
}

function assertInternalPaidFrom(text, stage) {
  if (!text.includes('Internal (NWAC)') || text.includes('External (region/PTMA)')) {
    throw new Error(`${stage} did not show the intervention's Internal (NWAC) value: ${JSON.stringify(text)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.screenshotDir, { recursive: true });
  ensureLocalChromeLibraryPath();

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: findChromeExecutable(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60_000);
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  const state = {
    intervention: buildIntervention(),
    apiCalls: [],
    savedPayloads: [],
    failures: [],
    consoleLines: [],
  };
  page.on('pageerror', error => state.failures.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => {
    const text = message.text();
    state.consoleLines.push({ type: message.type(), text: text.slice(0, 1500) });
    if (/ReferenceError|TypeError|Unhandled|Cannot update a component|Failed to load|failed with status|ERR_FAILED|CORS/i.test(text)) {
      state.failures.push({ type: 'console', level: message.type(), text: text.slice(0, 1500) });
    }
  });
  page.on('requestfailed', request => {
    if (request.url().includes('/api/')) {
      state.failures.push({ type: 'requestfailed', method: request.method(), url: request.url() });
    }
  });
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      state.failures.push({ type: 'api', status: response.status(), url: response.url() });
    }
  });

  const screenshot = path.join(args.screenshotDir, 'intervention-posting-context.png');
  try {
    await installApiStubs(page, state);
    await installBrowserSession(page, args.frontendBase);
    await page.goto(`${args.frontendBase}/cases/${CASE_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const text = document.body?.innerText || '';
      return text.includes('Action plans') &&
        text.includes('Interventions - Existing external action plan') &&
        Boolean(document.querySelector('a[aria-label^="View intervention "]'));
    });

    await openIntervention(page);
    assertInternalPaidFrom(await readPaidFromText(page), 'Initial view');

    await clickByText(page, 'button', 'Edit');
    await page.waitForFunction(() => {
      return (document.body?.innerText || '').includes('Save changes');
    });
    assertInternalPaidFrom(await readPaidFromText(page), 'Edit view');

    const programNameInput = await page.$('input[value="Legal Paraprofessional Diploma"]');
    if (!programNameInput) throw new Error('Could not find the editable program name field.');
    await programNameInput.type(' updated');
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('button')).some(button =>
        (button.innerText || '').trim() === 'Save changes' &&
        !button.disabled &&
        button.getAttribute('aria-disabled') !== 'true'
      )
    );

    await clickByText(page, 'button', 'Save changes');
    await waitUntil(() => state.savedPayloads.length === 1, 'manual-backload intervention PATCH');
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('h2')).some(heading => {
      const label = (heading.innerText || '').trim();
      return label === 'View intervention' || label === 'Edit intervention';
    }));
    if (state.savedPayloads.length !== 1 || state.savedPayloads[0].postingContext !== 'internal') {
      throw new Error(`Manual-backload save did not preserve internal postingContext: ${JSON.stringify(state.savedPayloads)}`);
    }

    await page.waitForFunction(() => Boolean(document.querySelector('a[aria-label^="View intervention "]')));
    await openIntervention(page);
    assertInternalPaidFrom(await readPaidFromText(page), 'Reopened view');
    await clickByText(page, 'button', 'Cancel');

    state.intervention = buildIntervention({
      applicationId: APPLICATION_ID,
      application_id: APPLICATION_ID,
      title: 'Finally reviewed training intervention',
      reviewWorkflow: {
        id: 90,
        workflowType: 'intervention_proposal',
        currentStage: 'final_decision_recorded',
        current_stage: 'final_decision_recorded',
      },
      metadata: {
        source: 'intervention_proposal',
        postingContext: 'internal',
        deliveryMode: 'partner',
        institution: 'Example College',
        programName: 'Legal Paraprofessional Diploma',
      },
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const text = document.body?.innerText || '';
      return text.includes('Interventions - Existing external action plan') &&
        Boolean(document.querySelector('a[aria-label^="View intervention "]'));
    });
    await openIntervention(page);
    assertInternalPaidFrom(await readPaidFromText(page), 'Final reviewed view');
    await assertFinalRecordReadOnly(page, 'Final reviewed view');
    await clickByText(page, 'button', 'Cancel');
    if (state.savedPayloads.length !== 1) {
      throw new Error(`Final reviewed intervention emitted an unexpected PATCH: ${JSON.stringify(state.savedPayloads)}`);
    }

    const callsBeforeIdle = state.apiCalls.length;
    await delay(2000);
    if (state.apiCalls.length !== callsBeforeIdle) {
      throw new Error(`Case Workspace made ${state.apiCalls.length - callsBeforeIdle} unexpected API calls after settling.`);
    }
    await page.screenshot({ path: screenshot, fullPage: true });
  } catch (error) {
    state.failures.push({ type: 'scenario', message: error.message, stack: error.stack });
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
  } finally {
    await page.close().catch(() => {});
    await browser.close();
  }

  const apiCallCounts = state.apiCalls.reduce((counts, call) => {
    const key = `${call.method} ${call.path}${call.search}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const summary = {
    pass: state.failures.length === 0,
    screenshot,
    savedPostingContexts: state.savedPayloads.slice(0, 1).map(payload => payload.postingContext),
    finalRecordReadOnlyVerified: state.savedPayloads.length === 1,
    unexpectedFinalPatchCount: Math.max(0, state.savedPayloads.length - 1),
    apiCallCount: state.apiCalls.length,
    apiCallCounts,
    failures: state.failures,
    consoleWarnings: state.consoleLines.filter(line => ['warning', 'error'].includes(line.type)).slice(-10),
  };
  if (!summary.pass) {
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
