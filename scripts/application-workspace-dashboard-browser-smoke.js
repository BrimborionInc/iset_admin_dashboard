#!/usr/bin/env node
/*
 * DEV browser smoke for the Application Workspace dashboard shell.
 *
 * This loads the real local React bundle with deterministic mocked API data and
 * checks the default widget set, request-loop settling, Supporting Documents
 * search, Secure Messaging sorting, and Notes refresh behavior.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'application-workspace-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';
const CONSOLE_SNIPPET_LIMIT = 1500;

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.APPLICATION_WORKSPACE_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.APPLICATION_WORKSPACE_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
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
        'Usage: node scripts/application-workspace-dashboard-browser-smoke.js [options]',
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
  const now = Math.floor(Date.now() / 1000);
  return [
    base64UrlEncode({ alg: 'none', typ: 'JWT' }),
    base64UrlEncode({
      sub: 'smoke-admin-sub',
      email: 'program.admin@awentech.ca',
      name: 'System Administrator',
      role: 'System Administrator',
      'cognito:groups': ['System_Administrator'],
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

const now = new Date();
const lockExpiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();

const applicationAnswers = {
  'first-name': 'Jacqueline',
  'middle-names': 'Joanne',
  'last-name': 'Sillery',
  'preferred-name': 'Jacqueline',
  email: 'jack@sillery.co.uk',
  'contact-email-address': 'jack@sillery.co.uk',
  'telephone-day': '(514) 782-4396',
  'address-province': 'QC',
  'long-term-goal': 'Complete training and move into full-time employment.',
  'requested-supports': ['tuition', 'living_allowance'],
  'training-institution': 'Example College',
  'program-name': 'Administrative Assistant Certificate',
};

function buildCasePayload() {
  return {
    id: 1,
    case_id: 1,
    application_id: 2,
    applicationId: 2,
    application_row_version: 7,
    applicant_user_id: 42,
    applicantUserId: 42,
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
    status: 'in_review',
    lifecycle_status: 'active',
    applicationStatus: 'in_review',
    application_status: 'in_review',
    applicationStatusRaw: 'in_review',
    application_lifecycle_status: 'assessment',
    applicationLifecycleStatus: 'assessment',
    decision_outcome: null,
    assessment_esdc_eligibility: 'eligible',
    assigned_staff_profile_id: 1,
    assigned_user_email: 'program.admin@awentech.ca',
    assigned_user_display_name: 'System Administrator',
    submitted_at: '2026-05-08T16:24:00Z',
    created_at: '2026-05-08T16:24:00Z',
    updated_at: '2026-05-08T17:06:42Z',
    docs_requested_active: 0,
    lock_owner_id: 'smoke-admin-sub',
    lock_owner_name: 'System Administrator',
    lock_owner_email: 'program.admin@awentech.ca',
    lock_expires_at: lockExpiresAt,
    payload_json: JSON.stringify(applicationAnswers),
    assessment_json: JSON.stringify({
      overview: 'Applicant is ready to proceed with training assessment.',
      employmentGoals: 'Employment goal is aligned with local opportunities.',
      recommendation: '',
      nwacReviewStatus: '',
      proposedInterventions: [],
    }),
    caseContext: {
      applicationAssessmentContext: { 2: {} },
      applicationReportingArtifacts: {},
    },
    actionPlans: [],
  };
}

function buildApplicationPayload() {
  return {
    id: 2,
    case_id: 1,
    applicant_user_id: 42,
    row_version: 6,
    payload_json: JSON.stringify(applicationAnswers),
    status: 'in_review',
    lifecycle_status: 'assessment',
    applicant_name: 'Jacqueline Joanne Sillery',
    tracking_id: 'ISET-20260508-A02882',
    submitted_at: '2026-05-08T16:24:00Z',
    created_at: '2026-05-08T16:24:00Z',
    updated_at: '2026-05-08T17:06:42Z',
    docs_requested_active: 0,
    lock_owner_id: 'smoke-admin-sub',
    lock_owner_name: 'System Administrator',
    lock_owner_email: 'program.admin@awentech.ca',
    lock_expires_at: lockExpiresAt,
  };
}

const documents = [
  {
    id: 501,
    label: 'Government ID',
    file_name: 'government-id.pdf',
    file_path: 'documents/government-id.pdf',
    document_type: 'identity_document',
    document_type_label: 'Government ID',
    source: 'application_submission',
    scope: 'client',
    application_id: 2,
    case_id: 1,
    uploaded_at: '2026-05-08T16:30:00Z',
  },
  {
    id: 502,
    label: 'Acceptance letter',
    file_name: 'acceptance-letter.pdf',
    file_path: 'documents/acceptance-letter.pdf',
    document_type: 'acceptance_letter',
    document_type_label: 'Acceptance letter',
    source: 'secure_message_attachment',
    scope: 'application',
    application_id: 2,
    case_id: 1,
    uploaded_at: '2026-05-09T14:20:00Z',
  },
  {
    id: 503,
    label: 'Fee statement',
    file_name: 'fee-statement.pdf',
    file_path: 'documents/fee-statement.pdf',
    document_type: 'fee_statement',
    document_type_label: 'Fee statement',
    source: 'manual_upload',
    scope: 'application',
    application_id: 2,
    case_id: 1,
    uploaded_at: '2026-05-10T10:00:00Z',
  },
];

const checklist = {
  items: [
    { id: 'identity', label: 'Government ID', required: true, status: 'complete' },
    { id: 'acceptance', label: 'Acceptance letter', required: true, status: 'complete' },
    { id: 'fees', label: 'Fee statement', required: true, status: 'missing' },
  ],
  missingRequiredCount: 1,
  gateLabel: 'Gate 6 - Approve and Commence',
};

const messages = {
  items: [
    {
      id: 301,
      case_id: 1,
      subject: 'Older applicant question',
      body: 'I have a question about the program.',
      created_at: '2026-05-08T13:00:00Z',
      sender_actor_type: 'applicant_user',
      sender_user_id: 42,
      sender_name: 'Jacqueline Sillery',
      recipient_actor_type: 'staff_user',
      recipient_user_id: 'smoke-admin-sub',
      recipient_name: 'System Administrator',
      mailbox_status: 'read',
      attachments: [],
    },
    {
      id: 302,
      case_id: 1,
      subject: 'Recent applicant reply',
      body: 'I uploaded the acceptance letter.',
      created_at: '2026-05-10T15:30:00Z',
      sender_actor_type: 'applicant_user',
      sender_user_id: 42,
      sender_name: 'Jacqueline Sillery',
      recipient_actor_type: 'staff_user',
      recipient_user_id: 'smoke-admin-sub',
      recipient_name: 'System Administrator',
      mailbox_status: 'unread',
      urgent: true,
      attachments: [{ workflow_id: 'wf-1', status: 'signed' }],
    },
    {
      id: 303,
      case_id: 1,
      subject: 'Staff follow-up',
      body: 'Please send the fee statement.',
      created_at: '2026-05-09T12:00:00Z',
      sender_actor_type: 'staff_user',
      sender_user_id: 'smoke-admin-sub',
      sender_name: 'System Administrator',
      recipient_actor_type: 'applicant_user',
      recipient_user_id: 42,
      recipient_name: 'Jacqueline Sillery',
      mailbox_status: 'sent',
      recipient_status: 'read',
      attachments: [],
    },
  ],
};

const notes = [
  {
    id: 601,
    case_id: 1,
    body: 'Called applicant about missing fee statement.',
    created_at: '2026-05-09T13:05:00Z',
    author: { displayName: 'System Administrator', role: 'System Administrator' },
    followUpAt: '2026-05-15',
  },
];

const reminders = [
  {
    id: 701,
    case_id: 1,
    title: 'Follow up on fee statement',
    description: 'Applicant to upload fee statement.',
    due_date: '2026-05-15',
    category: 'Document follow-up',
    status: 'open',
    source: 'case_note',
    note_id: 601,
  },
];

const events = [
  {
    id: 401,
    event_type: 'status_changed',
    event_type_label: 'Status changed',
    created_at: '2026-05-08T17:00:00Z',
    actorDisplay: 'System Administrator',
    event_data: { from: 'submitted', to: 'in_review' },
  },
  {
    id: 402,
    event_type: 'note_created',
    event_type_label: 'Note created',
    created_at: '2026-05-09T13:05:00Z',
    actorDisplay: 'System Administrator',
    event_data: { description: 'Called applicant about missing fee statement.' },
  },
];

function countCalls(apiCalls, pathWithSearch) {
  return apiCalls.filter(call => `${call.method} ${call.path}${call.search}` === pathWithSearch).length;
}

async function installApiStubs(page, apiCalls) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      request.continue();
      return;
    }

    apiCalls.push({
      method: request.method(),
      path: url.pathname,
      search: url.search,
      postData: request.postData() || null,
    });

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
    if (pathname === '/api/auth/me') {
      request.respond(jsonResponse({
        auth: {
          sub: 'smoke-admin-sub',
          email: 'program.admin@awentech.ca',
          name: 'System Administrator',
          role: 'System Administrator',
          groups: ['System_Administrator'],
          staffProfileId: 1,
          regionIds: [1],
        },
        profile: {
          id: 1,
          email: 'program.admin@awentech.ca',
          name: 'System Administrator',
          role: 'System Administrator',
          region_id: 1,
          region_ids: [1],
        },
      }));
      return;
    }
    if (pathname === '/api/cases/1' && request.method() === 'GET') {
      request.respond(jsonResponse(buildCasePayload()));
      return;
    }
    if (pathname === '/api/cases/1' && request.method() === 'PUT') {
      request.respond(jsonResponse({ ...buildCasePayload(), application_row_version: 8, success: true }));
      return;
    }
    if (pathname === '/api/applications/2') {
      request.respond(jsonResponse(buildApplicationPayload()));
      return;
    }
    if (pathname === '/api/locks/application/2' && request.method() === 'POST') {
      request.respond(jsonResponse({
        success: true,
        lock: {
          application_id: 2,
          owner_user_id: 'smoke-admin-sub',
          owner_display_name: 'System Administrator',
          owner_email: 'program.admin@awentech.ca',
          expires_at: lockExpiresAt,
        },
      }));
      return;
    }
    if (pathname === '/api/locks/application/2' && request.method() === 'DELETE') {
      request.respond(jsonResponse({ released: true, lock: null }));
      return;
    }
    if (pathname === '/api/access-control/matrix') {
      request.respond(jsonResponse({ default: 'allow', routes: {} }));
      return;
    }
    if (pathname === '/api/me/tutorial-progress') {
      request.respond(jsonResponse({ completed: [] }));
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
    if (pathname === '/api/applications/2/watchlist-hit') {
      request.respond(jsonResponse({ hasHit: false, hit: null }));
      return;
    }
    if (/^\/api\/applicants\/42\/document-checklist$/.test(pathname)) {
      request.respond(jsonResponse(checklist));
      return;
    }
    if (pathname === '/api/document-types') {
      request.respond(jsonResponse([
        { code: 'identity_document', label: 'Government ID', scope: 'client' },
        { code: 'acceptance_letter', label: 'Acceptance letter', scope: 'application' },
        { code: 'fee_statement', label: 'Fee statement', scope: 'application' },
      ]));
      return;
    }
    if (pathname === '/api/applicants/42/applications') {
      request.respond(jsonResponse([
        {
          id: 2,
          application_id: 2,
          case_id: 1,
          tracking_id: 'ISET-20260508-A02882',
          status: 'in_review',
          description: 'Current application',
        },
      ]));
      return;
    }
    if (pathname === '/api/applicants/42/documents' || pathname === '/api/cases/1/documents') {
      request.respond(jsonResponse(documents));
      return;
    }
    if (pathname === '/api/cases/1/messages') {
      request.respond(jsonResponse(messages));
      return;
    }
    if (pathname === '/api/cases/1/notes') {
      request.respond(jsonResponse(notes));
      return;
    }
    if (pathname === '/api/reminders') {
      request.respond(jsonResponse(reminders));
      return;
    }
    if (pathname === '/api/cases/1/events') {
      request.respond(jsonResponse(events));
      return;
    }
    if (pathname === '/api/workflows') {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/reference/intervention-codes' || pathname === '/api/reference/noc-versions') {
      request.respond(jsonResponse([]));
      return;
    }
    if (pathname === '/api/finance/payment-intervention-type-map') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }
    if (pathname === '/api/config/runtime/assessment-costing') {
      request.respond(jsonResponse({ paymentTypes: [], payeeTypes: [] }));
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
    if (pathname.includes('/presign-download')) {
      request.respond(jsonResponse({ url: 'https://example.invalid/document.pdf' }));
      return;
    }

    request.respond(jsonResponse({ items: [], rows: [], total: 0, count: 0 }));
  });
}

async function getWidgetText(page, heading) {
  return page.evaluate(target => {
    const headings = Array.from(document.querySelectorAll('h2,h3'));
    const element = headings.find(item => (item.innerText || '').trim().includes(target));
    if (!element) return '';
    let node = element;
    for (let depth = 0; depth < 8 && node; depth += 1) {
      if (node.innerText && node.innerText.includes(target) && node.querySelector('table, tbody, [role="tablist"]')) {
        return node.innerText;
      }
      node = node.parentElement;
    }
    return element.innerText || '';
  }, heading);
}

async function getWidgetRows(page, heading) {
  return page.evaluate(target => {
    const headings = Array.from(document.querySelectorAll('h2,h3'));
    const element = headings.find(item => (item.innerText || '').trim().includes(target));
    if (!element) return [];
    let node = element;
    for (let depth = 0; depth < 10 && node; depth += 1) {
      const rows = Array.from(node.querySelectorAll('tbody tr'));
      if (rows.length) {
        return rows.map(row =>
          Array.from(row.querySelectorAll('td'))
            .map(cell => (cell.innerText || '').trim())
            .filter(Boolean)
        );
      }
      node = node.parentElement;
    }
    return [];
  }, heading);
}

async function clickTableHeader(page, heading, headerText) {
  return page.evaluate(({ heading: targetHeading, headerText: targetHeader }) => {
    const headings = Array.from(document.querySelectorAll('h2,h3'));
    const element = headings.find(item => (item.innerText || '').trim().includes(targetHeading));
    if (!element) return false;
    let node = element;
    for (let depth = 0; depth < 10 && node; depth += 1) {
      const headerCells = Array.from(node.querySelectorAll('th, [role="columnheader"]'));
      const header = headerCells.find(item => (item.innerText || item.textContent || '').trim().includes(targetHeader));
      if (header) {
        const target =
          header.querySelector('button, [role="button"], [tabindex]:not([tabindex="-1"])') ||
          header;
        target.click();
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }, { heading, headerText });
}

async function clickWidgetButtonByAriaLabel(page, heading, ariaLabel) {
  return page.evaluate(({ heading: targetHeading, ariaLabel: targetAriaLabel }) => {
    const headings = Array.from(document.querySelectorAll('h2,h3'));
    const element = headings.find(item => (item.innerText || '').trim().includes(targetHeading));
    if (!element) return false;
    let node = element;
    for (let depth = 0; depth < 10 && node; depth += 1) {
      const target = Array.from(node.querySelectorAll('button')).find(
        button => button.getAttribute('aria-label') === targetAriaLabel
      );
      if (target) {
        target.click();
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }, { heading, ariaLabel });
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
  page.setDefaultTimeout(60000);
  await page.setViewport({ width: 1360, height: 920, deviceScaleFactor: 1 });

  const failures = [];
  const apiCalls = [];
  const consoleLines = [];

  page.on('pageerror', error => failures.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => {
    const text = message.text();
    const snippet = text.slice(0, CONSOLE_SNIPPET_LIMIT);
    consoleLines.push({ type: message.type(), text: snippet });
    if (/ReferenceError|TypeError|Unhandled|Cannot update a component|Failed to load|failed with status|ERR_FAILED|CORS/i.test(text)) {
      failures.push({ type: 'console', level: message.type(), text: snippet });
    }
  });
  page.on('requestfailed', request => {
    if (request.url().includes('/api/')) {
      failures.push({
        type: 'requestfailed',
        method: request.method(),
        url: request.url(),
        failure: request.failure()?.errorText || null,
      });
    }
  });
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      failures.push({ type: 'api', status: response.status(), url: response.url() });
    }
  });

  await installApiStubs(page, apiCalls);

  const session = {
    idToken: fakeJwt(),
    accessToken: fakeJwt(),
    refreshToken: null,
    expiresAt: Math.floor(Date.now() / 1000) + 3300,
  };
  await page.evaluateOnNewDocument((authSession, frontendBase) => {
    window.__API_BASE__ = frontendBase;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
    localStorage.removeItem('application-assessment-dashboard-layout.v2');
  }, session, args.frontendBase);

  await page.goto(`${args.frontendBase}/application-case/1?applicationId=2`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    return text.includes('Application Overview') &&
      text.includes('ISET Application Form') &&
      text.includes('Application assessment') &&
      text.includes('Supporting Documents') &&
      text.includes('Secure Messaging') &&
      text.includes('Notes and Reminders') &&
      text.includes('Case calendar') &&
      text.includes('Events Timeline');
  });

  await new Promise(resolve => setTimeout(resolve, 3000));
  const callsBeforeIdle = apiCalls.length;
  await new Promise(resolve => setTimeout(resolve, 2500));
  const callsAfterIdle = apiCalls.length;
  if (callsAfterIdle !== callsBeforeIdle) {
    failures.push({
      type: 'assertion',
      message: 'Application Workspace kept calling APIs after initial render settled.',
      idleCalls: callsAfterIdle - callsBeforeIdle,
    });
  }

  const documentFilter = await page.$('input[placeholder="Find documents"]');
  if (!documentFilter) {
    failures.push({ type: 'assertion', message: 'Supporting Documents search filter was not found.' });
  } else {
    await documentFilter.type('acceptance');
    await page.waitForFunction(() => document.body && document.body.innerText.includes('1 match'));
    const documentText = await getWidgetText(page, 'Supporting Documents');
    if (!documentText.includes('Acceptance letter') || documentText.includes('Fee statement')) {
      failures.push({
        type: 'assertion',
        message: 'Supporting Documents search did not narrow the table to the matching document.',
        documentText: documentText.slice(0, 1000),
      });
    }
  }

  const initialMessageRows = await getWidgetRows(page, 'Secure Messaging');
  const firstInitialSubject = initialMessageRows[0]?.find(cell => /applicant/i.test(cell)) || '';
  if (!firstInitialSubject.includes('Recent applicant reply')) {
    failures.push({
      type: 'assertion',
      message: 'Secure Messaging default sort did not show newest inbox message first.',
      initialMessageRows,
    });
  }
  const clickedDateHeader = await clickTableHeader(page, 'Secure Messaging', 'Date/Time');
  if (!clickedDateHeader) {
    failures.push({ type: 'assertion', message: 'Could not click Secure Messaging Date/Time header.' });
  } else {
    await new Promise(resolve => setTimeout(resolve, 500));
    const sortedMessageRows = await getWidgetRows(page, 'Secure Messaging');
    const firstSortedSubject = sortedMessageRows[0]?.find(cell => /applicant/i.test(cell)) || '';
    if (!firstSortedSubject.includes('Older applicant question')) {
      failures.push({
        type: 'assertion',
        message: 'Secure Messaging Date/Time sort did not toggle to oldest first.',
        sortedMessageRows,
      });
    }
  }

  const notesCallBefore = countCalls(apiCalls, 'GET /api/cases/1/notes');
  const clickedNotesRefresh = await clickWidgetButtonByAriaLabel(page, 'Notes and Reminders', 'Refresh notes');
  if (!clickedNotesRefresh) {
    failures.push({ type: 'assertion', message: 'Could not click Notes and Reminders refresh.' });
  } else {
    await new Promise(resolve => setTimeout(resolve, 800));
    const notesCallAfter = countCalls(apiCalls, 'GET /api/cases/1/notes');
    if (notesCallAfter - notesCallBefore !== 1) {
      failures.push({
        type: 'assertion',
        message: 'Notes refresh should call the notes endpoint exactly once.',
        notesCallBefore,
        notesCallAfter,
      });
    }
  }

  const screenshot = path.join(args.screenshotDir, 'application-workspace-default-layout.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await browser.close();

  const result = {
    pass: failures.length === 0,
    screenshot,
    apiCallCount: apiCalls.length,
    idleCalls: callsAfterIdle - callsBeforeIdle,
    apiCalls: apiCalls.map(call => `${call.method} ${call.path}${call.search}`),
    consoleWarnings: consoleLines.filter(line => line.type === 'warning' || line.type === 'error').slice(-10),
  };

  if (failures.length) {
    console.error(JSON.stringify({ ...result, failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
