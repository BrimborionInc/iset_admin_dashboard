#!/usr/bin/env node
/*
 * DEV browser smoke for Intervention Assessment recall.
 *
 * This loads the real local Case Workspace bundle with deterministic mocked API
 * data and verifies a submitted intervention proposal is read-only, can be
 * recalled by an ISET Coordinator, posts the recall endpoint, and returns to a
 * draft/resubmission state.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'intervention-assessment-recall-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';
const CONSOLE_SNIPPET_LIMIT = 1500;

const CASE_ID = 1;
const APPLICATION_ID = 2;
const APPLICANT_USER_ID = 42;
const ACTION_PLAN_ID = 10;
const INTERVENTION_ID = 101;
const CURRENT_USER_ID = 'smoke-coordinator-sub';
const FRONTEND_PATH = `/cases/${CASE_ID}?entry=approval&approvalType=intervention&step=decision&interventionId=${INTERVENTION_ID}&planId=${ACTION_PLAN_ID}`;

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.INTERVENTION_ASSESSMENT_RECALL_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.INTERVENTION_ASSESSMENT_RECALL_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--frontend-base') {
      args.frontendBase = argv[index + 1] || args.frontendBase;
      index += 1;
    } else if (token === '--screenshot-dir') {
      args.screenshotDir = argv[index + 1] || args.screenshotDir;
      index += 1;
    } else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/intervention-assessment-recall-browser-smoke.js [options]',
        '',
        'Options:',
        '  --frontend-base URL     React app origin. Default: http://localhost:3001',
        '  --screenshot-dir DIR    Directory for browser screenshots.',
      ].join('\n'));
      process.exit(0);
    }
  }
  args.frontendBase = String(args.frontendBase || DEFAULT_FRONTEND_BASE).replace(/\/+$/, '');
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
  const current = process.env.LD_LIBRARY_PATH || '';
  const entries = current.split(':').filter(Boolean);
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
  const issuedAt = Math.floor(Date.now() / 1000);
  return [
    base64UrlEncode({ alg: 'none', typ: 'JWT' }),
    base64UrlEncode({
      sub: CURRENT_USER_ID,
      email: 'quebec.coordinator.1@awentech.ca',
      name: 'Quebec Coordinator',
      role: 'ISET Coordinator',
      'cognito:groups': ['ISET_Coordinator'],
      iat: issuedAt,
      exp: issuedAt + 3600,
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitUntil(predicate, label, timeoutMs = 45_000, intervalMs = 100) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = predicate();
    if (result) return result;
    await delay(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function buildProposedIntervention() {
  return {
    id: 'proposal-line-1',
    code: '4',
    startDate: '2026-09-01',
    endDate: '2027-04-30',
    deliveryMode: 'partner',
    institution: 'Example College',
    programName: 'Administrative Assistant Certificate',
    itpDetails: 'Training plan, milestones, and support needs are documented.',
    wageSubsidyDetails: '',
    interventionNoc: '',
    interventionNocVersion: '',
    suggestionsSeeded: true,
    costLines: [],
  };
}

function buildIntervention(status = 'submitted') {
  return {
    id: INTERVENTION_ID,
    actionPlanId: ACTION_PLAN_ID,
    action_plan_id: ACTION_PLAN_ID,
    title: 'Administrative Assistant Certificate',
    code: '4',
    status,
    reviewStatus: status,
    review_status: status,
    deliveryStatus: null,
    delivery_status: null,
    startDate: '2026-09-01',
    endDate: '2027-04-30',
    institution: 'Example College',
    programName: 'Administrative Assistant Certificate',
    notes: 'Training aligns with the employment plan.',
    createdAt: '2026-06-14T15:00:00.000Z',
    updatedAt: status === 'draft' ? '2026-06-16T17:00:00.000Z' : '2026-06-15T15:00:00.000Z',
    metadata: {
      rationale: 'Training aligns with the applicant employment goal and local opportunities.',
      childcareNeed: 'no',
      proposedInterventions: [buildProposedIntervention()],
      review: {
        eiStatus: 'eligible',
        eiNotes: '',
        decision: '',
        decisionNotes: '',
      },
    },
  };
}

function buildCasePayload(interventionStatus = 'submitted') {
  return {
    id: CASE_ID,
    case_id: CASE_ID,
    application_id: APPLICATION_ID,
    applicationId: APPLICATION_ID,
    application_row_version: 7,
    applicationRowVersion: 7,
    applicant_user_id: APPLICANT_USER_ID,
    applicantUserId: APPLICANT_USER_ID,
    tracking_id: 'ISET-20260508-A02882',
    applicant_name: 'Jacqueline Joanne Sillery',
    first_name: 'Jacqueline',
    preferred_name: 'Jacqueline',
    last_name: 'Sillery',
    applicant_email: 'jack@sillery.co.uk',
    email: 'jack@sillery.co.uk',
    applicant_phone: '(514) 782-4396',
    phone: '(514) 782-4396',
    address_province: 'QC',
    application_address_province: 'QC',
    status: 'initiated',
    lifecycle_status: 'active',
    applicationStatus: 'approved',
    application_status: 'approved',
    applicationStatusRaw: 'approved',
    application_lifecycle_status: 'active',
    applicationLifecycleStatus: 'active',
    decision_outcome: 'approved',
    assigned_staff_profile_id: 1,
    assigned_user_email: 'quebec.coordinator.1@awentech.ca',
    assigned_user_display_name: 'Quebec Coordinator',
    submitted_at: '2026-05-08T16:24:00Z',
    created_at: '2026-05-08T16:24:00Z',
    updated_at: '2026-06-15T15:00:00Z',
    docs_requested_active: 0,
    lock_owner_id: null,
    lock_owner_name: null,
    lock_owner_email: null,
    lock_expires_at: null,
    payload_json: JSON.stringify({
      'first-name': 'Jacqueline',
      'last-name': 'Sillery',
      'preferred-name': 'Jacqueline',
      email: 'jack@sillery.co.uk',
      'requested-supports': ['tuition'],
      'training-institution': 'Example College',
      'program-name': 'Administrative Assistant Certificate',
    }),
    caseContext: {
      applicationAssessmentContext: { [APPLICATION_ID]: {} },
      applicationReportingArtifacts: {},
    },
    actionPlans: [
      {
        id: ACTION_PLAN_ID,
        case_id: CASE_ID,
        title: '2026 employment plan',
        name: '2026 employment plan',
        status: 'active',
        lifecycle_status: 'active',
        createdAt: '2026-06-01T15:00:00.000Z',
        updatedAt: '2026-06-15T15:00:00.000Z',
        interventions: [buildIntervention(interventionStatus)],
        interventionCount: 1,
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
    applicant_name: 'Jacqueline Joanne Sillery',
    tracking_id: 'ISET-20260508-A02882',
    submitted_at: '2026-05-08T16:24:00Z',
    created_at: '2026-05-08T16:24:00Z',
    updated_at: '2026-06-15T15:00:00Z',
  };
}

function applyRecall(state) {
  state.casePayload = buildCasePayload('draft');
  return {
    success: true,
    intervention: buildIntervention('draft'),
    archivedDocumentIds: [901],
    eventType: 'assessment_recalled',
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

    const requestRecord = {
      method: request.method(),
      path: url.pathname,
      search: url.search,
      postData: request.postData() || null,
    };
    state.apiCalls.push(requestRecord);

    if (request.method() === 'OPTIONS') {
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

    const pathname = url.pathname;
    const method = request.method();
    if (pathname === '/api/auth/me') {
      request.respond(jsonResponse({
        auth: {
          sub: CURRENT_USER_ID,
          email: 'quebec.coordinator.1@awentech.ca',
          name: 'Quebec Coordinator',
          role: 'ISET Coordinator',
          groups: ['ISET_Coordinator'],
          staffProfileId: 1,
          regionIds: [1],
        },
        profile: {
          id: 1,
          email: 'quebec.coordinator.1@awentech.ca',
          name: 'Quebec Coordinator',
          role: 'ISET Coordinator',
          region_id: 1,
          region_ids: [1],
        },
      }));
      return;
    }
    if ((pathname === `/api/cases/${CASE_ID}` || pathname === `/api/cases/${CASE_ID}/workspace`) && method === 'GET') {
      request.respond(jsonResponse(state.casePayload));
      return;
    }
    if (pathname === `/api/interventions/${INTERVENTION_ID}/assessment/recall` && method === 'POST') {
      const body = request.postData() ? JSON.parse(request.postData()) : {};
      state.mutations.assessmentRecalls.push({ path: `${pathname}${url.search}`, body });
      request.respond(jsonResponse(applyRecall(state)));
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
      request.respond(jsonResponse({
        items: [
          { tutorialId: 'case-workspace-overview-v3', status: 'dismissed' },
          { tutorialId: 'iset-coordinator-intro-v2', status: 'dismissed' },
        ],
      }));
      return;
    }
    if (pathname === '/api/me/notifications') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === '/api/me/staff-messages/counts') {
      request.respond(jsonResponse({ unread: 0, total: 0 }));
      return;
    }
    if (pathname === '/api/admin/contact-messages') {
      request.respond(jsonResponse({ items: [], total: 0 }));
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
      request.respond(jsonResponse([
        { code: 'case_assessment', label: 'Assessment PDF', scope: 'case' },
      ]));
      return;
    }
    if (pathname === `/api/cases/${CASE_ID}/messages`) {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === `/api/cases/${CASE_ID}/notes`) {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/reminders') {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === `/api/cases/${CASE_ID}/events`) {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/reference/intervention-codes') {
      request.respond(jsonResponse([{ code: '4', name: 'Occupational skills training' }]));
      return;
    }
    if (pathname === '/api/reference/noc-versions') {
      request.respond(jsonResponse([]));
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
    if (pathname === '/api/reference/budget-pots-lite' || pathname === '/api/finance/budget-pots') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }
    if (pathname === '/api/reference/noc-codes') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }

    request.respond(jsonResponse({ items: [], rows: [], total: 0, count: 0 }));
  });
}

async function installBrowserSession(page, frontendBase) {
  const session = {
    idToken: fakeJwt(),
    accessToken: fakeJwt(),
    refreshToken: null,
    expiresAt: Math.floor(Date.now() / 1000) + 3300,
  };
  await page.evaluateOnNewDocument((authSession, baseUrl) => {
    window.__API_BASE__ = baseUrl;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
    localStorage.removeItem('iset-case-workspace-layout-v14');
  }, session, frontendBase);
}

async function visibleEnabledButtons(page, text) {
  return page.evaluate(targetText => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    return Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(button => isVisible(button))
      .filter(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true')
      .map((button, index) => ({ index, text: normalize(button.innerText || button.textContent || '') }))
      .filter(button => button.text === targetText);
  }, text);
}

async function clickButtonByText(page, text, options = {}) {
  const clicked = await page.evaluate(({ targetText, preferLast }) => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(button => isVisible(button))
      .filter(button => !button.disabled && button.getAttribute('aria-disabled') !== 'true');
    const matches = buttons.filter(button => normalize(button.innerText || button.textContent || '') === targetText);
    const target = preferLast ? matches[matches.length - 1] : matches[0];
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return true;
  }, { targetText: text, preferLast: Boolean(options.preferLast) });
  if (!clicked) {
    const available = await visibleEnabledButtons(page, text);
    throw new Error(`Could not click button "${text}". Matching visible enabled buttons: ${JSON.stringify(available)}`);
  }
}

async function waitForText(page, text, timeout = 45_000) {
  await page.waitForFunction(
    targetText => Boolean(document.body && document.body.innerText.includes(targetText)),
    { timeout },
    text
  );
}

async function waitForButtonEnabled(page, text) {
  await page.waitForFunction(targetText => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = element => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    return Array.from(document.querySelectorAll('button, [role="button"]')).some(button => {
      if (!isVisible(button) || button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
      return normalize(button.innerText || button.textContent || '') === targetText;
    });
  }, {}, text);
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
  await page.setViewport({ width: 1360, height: 940, deviceScaleFactor: 1 });

  const state = {
    casePayload: buildCasePayload('submitted'),
    apiCalls: [],
    mutations: {
      assessmentRecalls: [],
    },
    consoleLines: [],
    failures: [],
  };

  page.on('pageerror', error => state.failures.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => {
    const text = message.text();
    const snippet = text.slice(0, CONSOLE_SNIPPET_LIMIT);
    state.consoleLines.push({ type: message.type(), text: snippet });
    if (/ReferenceError|TypeError|Unhandled|Cannot update a component|Failed to load|failed with status|ERR_FAILED|CORS/i.test(text)) {
      state.failures.push({ type: 'console', level: message.type(), text: snippet });
    }
  });
  page.on('requestfailed', request => {
    if (request.url().includes('/api/')) {
      state.failures.push({
        type: 'requestfailed',
        method: request.method(),
        url: request.url(),
        failure: request.failure()?.errorText || null,
      });
    }
  });
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      state.failures.push({ type: 'api', status: response.status(), url: response.url() });
    }
  });

  const screenshotPath = path.join(args.screenshotDir, 'intervention-recall.png');
  try {
    await installApiStubs(page, state);
    await installBrowserSession(page, args.frontendBase);
    await page.goto(`${args.frontendBase}${FRONTEND_PATH}`, { waitUntil: 'domcontentloaded' });
    await waitForText(page, 'Review intervention proposal');
    await waitForText(page, 'Viewing this submitted proposal in read-only mode.');
    await waitForButtonEnabled(page, 'Recall submission');
    const editableButtons = [
      ...(await visibleEnabledButtons(page, 'Save Progress')),
      ...(await visibleEnabledButtons(page, 'Save progress')),
      ...(await visibleEnabledButtons(page, 'Submit proposal')),
    ];
    if (editableButtons.length) {
      throw new Error(`Submitted intervention proposal exposed edit controls: ${JSON.stringify(editableButtons)}`);
    }
    await clickButtonByText(page, 'Recall submission');
    await waitForText(page, 'Recall submission?');
    await clickButtonByText(page, 'Recall submission', { preferLast: true });
    const recallPost = await waitUntil(
      () => state.mutations.assessmentRecalls[0],
      'intervention assessment recall POST'
    );
    if (recallPost.path !== `/api/interventions/${INTERVENTION_ID}/assessment/recall`) {
      throw new Error(`Recall used wrong endpoint: ${recallPost.path}`);
    }
    await waitForText(page, 'Submission recalled. You can make corrections and submit it again when ready.');
    await waitForText(page, 'Draft');
    await waitForText(page, 'Save progress');
    await delay(800);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (error) {
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    state.failures.push({ type: 'scenario', message: error.message, stack: error.stack });
  } finally {
    await page.close().catch(() => {});
    await browser.close();
  }

  const summary = {
    pass: state.failures.length === 0,
    screenshot: screenshotPath,
    apiCalls: state.apiCalls.map(call => `${call.method} ${call.path}${call.search}`),
    assessmentRecalls: state.mutations.assessmentRecalls.map(entry => entry.body),
    failures: state.failures,
    consoleWarnings: state.consoleLines.filter(line => line.type === 'warning' || line.type === 'error').slice(-10),
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
