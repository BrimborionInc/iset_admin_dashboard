#!/usr/bin/env node
/*
 * DEV browser smoke for the Manage ISET Applications / Case Assignment dashboard.
 *
 * This checks the real React dev bundle with deterministic mocked API data so
 * dashboard chrome, table wiring, route filters, and request-loop behavior can
 * be tested without requiring a reusable Cognito smoke token.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'case-assignment-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.CASE_ASSIGNMENT_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.CASE_ASSIGNMENT_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
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
        'Usage: node scripts/case-assignment-dashboard-browser-smoke.js [options]',
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
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/home/bill/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-142.0.7444.59/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate));
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
      sub: 'smoke-rm-sub',
      email: 'smoke.rm@example.invalid',
      name: 'Smoke Regional Manager',
      role: 'Regional Manager',
      'cognito:groups': ['Regional_Manager'],
      iat: now,
      exp: now + 3600,
    }),
    'signature',
  ].join('.');
}

const baseRows = [
  { name: 'Anika Submitted', lifecycle: 'submitted', status: 'Submitted', province: 'on', assigned: null, daysAgo: 1 },
  { name: 'Bruno Review', lifecycle: 'assessment', status: 'In Review', province: 'bc', assigned: 1, daysAgo: 2 },
  { name: 'Chloe Validation', lifecycle: 'awaiting_ei_validation', status: 'Awaiting EI Validation', province: 'ab', assigned: 2, daysAgo: 3 },
  { name: 'Diego Applicant', lifecycle: 'awaiting_applicant', status: 'Docs Requested', province: 'mb', assigned: 3, daysAgo: 4, docs: true },
  { name: 'Elena Hold', lifecycle: 'on_hold', status: 'On Hold', province: 'ns', assigned: 4, daysAgo: 5 },
  { name: 'Farah Active', lifecycle: 'assessment', status: 'In Review', province: 'qc', assigned: 5, daysAgo: 6 },
  { name: 'Gregory Active', lifecycle: 'assessment', status: 'In Review', province: 'sk', assigned: 6, daysAgo: 7 },
  { name: 'Hana Active', lifecycle: 'assessment', status: 'In Review', province: 'nl', assigned: 7, daysAgo: 8 },
  { name: 'Iris Active', lifecycle: 'assessment', status: 'In Review', province: 'nb', assigned: 8, daysAgo: 9 },
  { name: 'Jasper Active', lifecycle: 'assessment', status: 'In Review', province: 'pe', assigned: 9, daysAgo: 10 },
  { name: 'Kara Pending', lifecycle: 'pending_decision', status: 'Pending Approval', province: 'yt', assigned: 10, daysAgo: 11 },
  { name: 'Zara Pending', lifecycle: 'pending_decision', status: 'Pending Approval', province: 'nt', assigned: 11, daysAgo: 12 },
  { name: 'Theo Approved', lifecycle: 'approved', status: 'Approved', province: 'nu', assigned: 12, daysAgo: 13 },
];

const applicationRows = baseRows.map((row, index) => {
  const submittedAt = new Date(Date.UTC(2026, 5, 10 - row.daysAgo, 14, 0, 0)).toISOString();
  const dueAt = new Date(Date.UTC(2026, 5, 15 - row.daysAgo, 14, 0, 0)).toISOString();
  const id = 1000 + index;
  return {
    id,
    application_id: id,
    case_id: 2000 + index,
    applicant_name: row.name,
    tracking_id: `APP-${String(id).padStart(4, '0')}`,
    status: row.status,
    application_status: row.status,
    application_lifecycle_status: row.lifecycle,
    address_province: row.province,
    assigned_staff_profile_id: row.assigned,
    assigned_user_id: row.assigned,
    assigned_user_email: row.assigned ? `staff${row.assigned}@example.invalid` : null,
    submitted_at: submittedAt,
    created_at: submittedAt,
    sla_due_at: dueAt,
    assessment_esdc_eligibility: row.lifecycle === 'awaiting_ei_validation' ? 'pending' : 'eligible',
    docs_requested_active: row.docs ? 1 : 0,
    docs_requested_at: row.docs ? submittedAt : null,
    lock_owner_id: null,
    lock_owner_name: null,
    lock_owner_email: null,
    lock_expires_at: null,
  };
});

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function rowMatchesStatusGroup(row, statusGroup) {
  const lifecycle = normalizeStatus(row.application_lifecycle_status || row.application_status);
  switch (normalizeStatus(statusGroup)) {
    case 'submitted':
      return lifecycle === 'submitted';
    case 'assessment':
      return ['assessment', 'in_assessment', 'in_review', 'awaiting_ei_validation'].includes(lifecycle);
    case 'pending_decision':
      return lifecycle === 'pending_decision';
    case 'decision_recorded':
      return ['approved', 'denied', 'rejected', 'declined', 'completed'].includes(lifecycle);
    case 'approved':
      return lifecycle === 'approved';
    case 'denied':
      return ['denied', 'rejected', 'declined'].includes(lifecycle);
    case 'closed':
      return ['closed', 'completed', 'archived'].includes(lifecycle);
    default:
      return true;
  }
}

function rowMatchesBucket(row, bucket) {
  const lifecycle = normalizeStatus(row.application_lifecycle_status || row.application_status);
  switch (String(bucket || '').trim().toLowerCase()) {
    case 'new-submissions':
      return lifecycle === 'submitted' && !row.assigned_staff_profile_id;
    case 'awaiting-ei-validation':
      return lifecycle === 'awaiting_ei_validation';
    case 'in-assessment':
      return ['assessment', 'in_assessment', 'in_review'].includes(lifecycle);
    case 'on-hold':
      return lifecycle === 'on_hold';
    case 'awaiting-decision':
    case 'awaiting-my-approval':
      return lifecycle === 'pending_decision';
    case 'decisions-made':
      return ['approved', 'denied', 'rejected', 'declined', 'completed'].includes(lifecycle);
    case 'region-queue':
      return !['approved', 'denied', 'rejected', 'declined', 'closed', 'completed', 'archived'].includes(lifecycle);
    case 'assigned-to-me':
    case 'needs-reassignment':
      return Number(row.assigned_staff_profile_id) === 1;
    case 'awaiting-applicant':
    case 'awaiting-info':
      return lifecycle === 'awaiting_applicant' || Number(row.docs_requested_active) === 1;
    case 'due-today':
      return row.applicant_name === 'Bruno Review';
    case 'due-soon':
      return row.applicant_name === 'Chloe Validation';
    case 'due-this-week':
      return ['Bruno Review', 'Chloe Validation', 'Diego Applicant'].includes(row.applicant_name);
    case 'overdue':
      return row.applicant_name === 'Elena Hold';
    default:
      return true;
  }
}

function rowMatchesSearch(row, searchText) {
  const needle = String(searchText || '').trim().toLowerCase();
  if (!needle) return true;
  return [
    row.applicant_name,
    row.tracking_id,
    row.application_status,
    row.assigned_user_email,
    row.address_province,
  ].some(value => String(value || '').toLowerCase().includes(needle));
}

function sortRows(rows, searchParams) {
  const field = searchParams.get('sort') || 'submitted_at';
  const direction = searchParams.get('direction') === 'asc' ? 1 : -1;
  const read = row => {
    if (field === 'applicant_name') return row.applicant_name;
    if (field === 'address_province') return row.address_province;
    if (field === 'tracking_id') return row.tracking_id;
    if (field === 'status') return row.application_status;
    if (field === 'sla_risk') return row.sla_due_at;
    if (field === 'assigned_user_email') return row.assigned_user_email || '';
    if (field === 'lock_state') return row.lock_owner_name || '';
    return row.submitted_at || row.created_at || '';
  };
  return [...rows].sort((left, right) => String(read(left)).localeCompare(String(read(right))) * direction);
}

function getApplicationPayload(searchParams) {
  let rows = applicationRows;
  const bucket = searchParams.get('bucket') || searchParams.get('workQueueBucket');
  if (bucket) {
    rows = rows.filter(row => rowMatchesBucket(row, bucket));
  } else {
    const statusGroup = searchParams.get('statusGroup');
    if (statusGroup) {
      rows = rows.filter(row => rowMatchesStatusGroup(row, statusGroup));
    }
    if (searchParams.get('excludeTerminal') === 'true') {
      rows = rows.filter(row => !rowMatchesStatusGroup(row, 'decision_recorded') && !rowMatchesStatusGroup(row, 'closed'));
    }
  }
  rows = rows.filter(row => rowMatchesSearch(row, searchParams.get('search')));
  rows = sortRows(rows, searchParams);
  const limit = Number(searchParams.get('limit') || 10);
  const offset = Number(searchParams.get('offset') || 0);
  return {
    rows: rows.slice(offset, offset + limit),
    count: rows.length,
  };
}

function jsonResponse(body) {
  return {
    status: 200,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

async function installApiStubs(page, apiCalls) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      request.continue();
      return;
    }

    apiCalls.push(`${request.method()} ${url.pathname}${url.search}`);

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

    if (url.pathname === '/api/auth/me') {
      request.respond(jsonResponse({
        auth: {
          sub: 'smoke-rm-sub',
          email: 'smoke.rm@example.invalid',
          name: 'Smoke Regional Manager',
          role: 'Regional Manager',
          groups: ['Regional_Manager'],
          staffProfileId: 1,
          regionIds: [1],
        },
        profile: {
          id: 1,
          email: 'smoke.rm@example.invalid',
          name: 'Smoke Regional Manager',
          role: 'Regional Manager',
          region_id: 1,
          region_ids: [1],
        },
      }));
      return;
    }

    if (url.pathname === '/api/applications') {
      request.respond(jsonResponse(getApplicationPayload(url.searchParams)));
      return;
    }

    if (url.pathname === '/api/config/sla-targets') {
      request.respond(jsonResponse({
        targets: [
          { stage_key: 'assignment', target_hours: 48 },
          { stage_key: 'ei_status_verification', target_hours: 72 },
          { stage_key: 'assessment', target_hours: 120 },
          { stage_key: 'program_decision', target_hours: 48 },
        ],
      }));
      return;
    }

    if (url.pathname === '/api/me/case-watches') {
      request.respond(jsonResponse([]));
      return;
    }

    if (url.pathname === '/api/config/auto-assignment') {
      request.respond(jsonResponse({ enabled: false, rules: [] }));
      return;
    }

    if (url.pathname === '/api/staff/assignable') {
      request.respond(jsonResponse([
        { id: 1, display_name: 'Smoke Regional Manager', email: 'smoke.rm@example.invalid', role: 'Regional Manager', region_id: 1, status: 'active' },
        { id: 2, display_name: 'Local Case Worker', email: 'case.worker@example.invalid', role: 'ISET Coordinator', region_id: 1, status: 'active' },
        { id: 99, display_name: 'Derry Cross Region', email: 'derry@example.invalid', role: 'Regional Manager', region_id: 11, status: 'active' },
      ]));
      return;
    }

    if (url.pathname === '/api/access-control/matrix') {
      request.respond(jsonResponse({ default: 'allow', routes: {} }));
      return;
    }
    if (url.pathname === '/api/me/tutorial-progress') {
      request.respond(jsonResponse({ completed: [] }));
      return;
    }
    if (url.pathname === '/api/me/notifications') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (url.pathname === '/api/me/staff-messages/counts') {
      request.respond(jsonResponse({ unread: 0, total: 0 }));
      return;
    }
    if (url.pathname === '/api/admin/contact-messages') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (url.pathname === '/api/me/staff-profiles') {
      request.respond(jsonResponse({ items: [], profiles: [] }));
      return;
    }
    if (url.pathname === '/api/service-announcement/current') {
      request.respond(jsonResponse({ announcement: null }));
      return;
    }
    if (url.pathname === '/api/config/runtime/demo-navigation') {
      request.respond(jsonResponse({ enabled: false }));
      return;
    }

    request.respond(jsonResponse({}));
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForApiCall(apiCalls, predicate, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const found = apiCalls.find((call, index) => predicate(call, index));
    if (found) return found;
    await delay(100);
  }
  throw new Error('Timed out waiting for expected API call');
}

function getQueryParam(call, key) {
  const [, rawUrl = ''] = call.split(' ');
  const url = new URL(rawUrl, 'http://smoke.local');
  return url.searchParams.get(key);
}

async function clickButtonByText(page, text) {
  return page.evaluate((label) => {
    const button = Array.from(document.querySelectorAll('button'))
      .find(candidate => candidate.textContent.trim().includes(label));
    if (!button) return false;
    button.click();
    return true;
  }, text);
}

async function clickLastVisibleListboxButton(page) {
  const point = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[aria-haspopup="listbox"]'))
      .filter(button => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    const button = buttons[buttons.length - 1];
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return {
      x: rect.left + Math.max(4, Math.min(rect.width / 2, rect.width - 4)),
      y: rect.top + Math.max(4, Math.min(rect.height / 2, rect.height - 4)),
    };
  });
  if (!point) return false;
  await page.mouse.click(point.x, point.y);
  return true;
}

async function clickTableHeader(page, headerText) {
  const point = await page.evaluate((label) => {
    const controls = Array.from(document.querySelectorAll('[data-focus-id^="sorting-control-"][role="button"]'));
    const visibleControls = controls.filter(control => {
      const rect = control.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const target = visibleControls.find(candidate => candidate.textContent.trim().includes(label)) ||
      controls.find(candidate => candidate.textContent.trim().includes(label));
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left + Math.max(4, Math.min(rect.width / 2, rect.width - 4)),
      y: rect.top + Math.max(4, Math.min(rect.height / 2, rect.height - 4)),
    };
  }, headerText);
  if (!point) return false;
  await page.mouse.click(point.x, point.y);
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.screenshotDir, { recursive: true });
  ensureLocalChromeLibraryPath();

  const executablePath = findChromeExecutable();
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  await page.setViewport({ width: 1360, height: 820, deviceScaleFactor: 1 });

  const failures = [];
  const apiCalls = [];
  page.on('pageerror', error => failures.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => {
    const text = message.text();
    if (/ReferenceError|TypeError|Unhandled|Failed to load|failed with status|CORS|ERR_FAILED|Unauthorized/i.test(text)) {
      failures.push({ type: 'console', level: message.type(), text: text.slice(0, 500) });
    }
  });
  page.on('requestfailed', request => {
    const url = request.url();
    if (url.includes('/api/')) {
      failures.push({
        type: 'requestfailed',
        method: request.method(),
        url,
        failure: request.failure()?.errorText || null,
      });
    }
  });
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/') && response.status() >= 400) {
      failures.push({ type: 'api', status: response.status(), url });
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
    localStorage.removeItem('case-assignment-dashboard-layout-v1');
    localStorage.removeItem('applications-widget-column-widths');
  }, session, args.frontendBase);

  await page.goto(`${args.frontendBase}/case-assignment-dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body && document.body.innerText.includes('ISET Applications'));
  await page.waitForFunction(() => document.body && document.body.innerText.includes('Anika Submitted'));

  const initialApplicationCalls = apiCalls.filter(call => call.startsWith('GET /api/applications')).length;
  await delay(1200);
  const idleApplicationCalls = apiCalls.filter(call => call.startsWith('GET /api/applications')).length;
  if (idleApplicationCalls !== initialApplicationCalls) {
    failures.push({
      type: 'assertion',
      message: 'Runaway /api/applications requests detected after initial dashboard render',
      initialApplicationCalls,
      idleApplicationCalls,
      applicationCalls: apiCalls.filter(call => call.startsWith('GET /api/applications')),
    });
  }

  const initialAssertions = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const headers = Array.from(document.querySelectorAll('th')).map(header => header.textContent.trim()).filter(Boolean);
    return {
      hasDashboardHeading: text.includes('ISET Applications'),
      hasInitialRows: ['Anika Submitted', 'Bruno Review', 'Jasper Active'].every(value => text.includes(value)),
      initialPageOmitsZara: !text.includes('Zara Pending'),
      hasAddWidget: text.includes('Add widget'),
      hasResetLayout: text.includes('Reset layout'),
      hasBoardHandles: text.includes('Drag handle') && text.includes('Resize handle'),
      hasInstructionalSlop: text.includes('This table lists the applications you can work on'),
      hasTargetHeader: headers.some(header => header.includes('Target')),
      hasOverdueHeader: headers.some(header => header === 'Overdue'),
      headers,
      textSample: text.slice(0, 1200),
    };
  });

  if (!initialAssertions.hasDashboardHeading || !initialAssertions.hasInitialRows) {
    failures.push({ type: 'assertion', message: 'Initial applications table did not render expected rows', initialAssertions });
  }
  if (!initialAssertions.initialPageOmitsZara) {
    failures.push({ type: 'assertion', message: 'Smoke fixture expected Zara to be off the first page before search', initialAssertions });
  }
  if (!initialAssertions.hasAddWidget || !initialAssertions.hasResetLayout || !initialAssertions.hasBoardHandles) {
    failures.push({ type: 'assertion', message: 'Case Assignment dashboard is missing standard widget board controls', initialAssertions });
  }
  if (initialAssertions.hasInstructionalSlop) {
    failures.push({ type: 'assertion', message: 'Retired instructional table filler text still renders', initialAssertions });
  }
  if (!initialAssertions.hasTargetHeader || initialAssertions.hasOverdueHeader) {
    failures.push({ type: 'assertion', message: 'SLA table header was not updated to Target', initialAssertions });
  }

  let regionalManagerTargetAssertions = null;
  const clickedReassign = await clickButtonByText(page, 'Reassign');
  if (!clickedReassign) {
    failures.push({ type: 'assertion', message: 'Regional Manager could not open the reassignment modal' });
  } else {
    await page.waitForFunction(() => (document.body?.innerText || '').includes('Select Assignee'));
    const clickedAssigneeSelect = await clickLastVisibleListboxButton(page);
    if (!clickedAssigneeSelect) {
      const visibleButtons = await page.evaluate(() => Array.from(document.querySelectorAll('button'))
        .filter(button => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map(button => button.textContent.trim())
        .filter(Boolean));
      failures.push({
        type: 'assertion',
        message: 'Could not open the reassignment target selector',
        visibleButtons,
      });
    } else {
      const targetListOpened = await page.waitForFunction(
        () => (document.body?.innerText || '').includes('Derry Cross Region'),
        { timeout: 5000 }
      ).then(() => true).catch(() => false);
      regionalManagerTargetAssertions = await page.evaluate(() => {
        const text = document.body?.innerText || '';
        return {
          hasCrossRegionRegionalManager: text.includes('Derry Cross Region') && text.includes('Regional Manager'),
          hasLocalCoordinator: text.includes('Local Case Worker') && text.includes('ISET Coordinator'),
          listboxCount: document.querySelectorAll('[role="listbox"]').length,
          visibleAriaControls: Array.from(document.querySelectorAll('[aria-haspopup]'))
            .filter(element => {
              const rect = element.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            })
            .map(element => ({
              tag: element.tagName,
              hasPopup: element.getAttribute('aria-haspopup'),
              text: element.textContent.trim(),
            })),
        };
      });
      if (!targetListOpened) {
        failures.push({
          type: 'assertion',
          message: 'Reassignment target selector did not open',
          regionalManagerTargetAssertions,
        });
      }
      if (!regionalManagerTargetAssertions.hasCrossRegionRegionalManager || !regionalManagerTargetAssertions.hasLocalCoordinator) {
        failures.push({
          type: 'assertion',
          message: 'Regional Manager assignment targets did not include the full cross-region assignable pool',
          regionalManagerTargetAssertions,
        });
      }
      await page.keyboard.press('Escape');
    }
    await clickButtonByText(page, 'Cancel');
  }

  const sortedBefore = apiCalls.length;
  const clickedApplicant = await clickTableHeader(page, 'Applicant');
  if (!clickedApplicant) {
    failures.push({ type: 'assertion', message: 'Could not click Applicant sort header', initialAssertions });
  } else {
    await waitForApiCall(apiCalls, (call, index) => (
      index >= sortedBefore && call.startsWith('GET /api/applications') && getQueryParam(call, 'sort') === 'applicant_name'
    )).catch(error => {
      failures.push({ type: 'assertion', message: error.message, expected: 'sort=applicant_name' });
    });
  }

  await page.click('input[placeholder="Search"]');
  await page.keyboard.type('Zara');
  await delay(75);
  const immediateSearchAssertions = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    return {
      hasNoApplications: text.includes('No applications'),
      hasPreviousRows: text.includes('Anika Submitted') || text.includes('Bruno Review'),
      textSample: text.slice(0, 1200),
    };
  });
  if (immediateSearchAssertions.hasNoApplications || !immediateSearchAssertions.hasPreviousRows) {
    failures.push({
      type: 'assertion',
      message: 'Search appears to be filtering the current page before server results return',
      immediateSearchAssertions,
    });
  }
  await waitForApiCall(apiCalls, call => (
    call.startsWith('GET /api/applications') && getQueryParam(call, 'search') === 'Zara'
  )).catch(error => {
    failures.push({ type: 'assertion', message: error.message, expected: 'search=Zara' });
  });
  await page.waitForFunction(() => document.body && document.body.innerText.includes('Zara Pending'));

  const mainScreenshot = path.join(args.screenshotDir, 'case-assignment-dashboard-fixed.png');
  await page.screenshot({ path: mainScreenshot, fullPage: true });

  await page.goto(`${args.frontendBase}/case-assignment-dashboard?status=Pending%20Approval`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body && document.body.innerText.includes('Kara Pending'));
  const legacyStatusCall = await waitForApiCall(apiCalls, call => (
    call.startsWith('GET /api/applications') && getQueryParam(call, 'statusGroup') === 'pending_decision'
  )).catch(error => {
    failures.push({ type: 'assertion', message: error.message, expected: 'legacy status -> statusGroup=pending_decision' });
    return null;
  });

  await page.goto(`${args.frontendBase}/case-assignment-dashboard?bucket=awaiting-decision`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body && document.body.innerText.includes('Work queue filter: Awaiting Approval'));
  await page.waitForFunction(() => document.body && document.body.innerText.includes('Zara Pending'));
  const bucketCall = await waitForApiCall(apiCalls, call => (
    call.startsWith('GET /api/applications') && getQueryParam(call, 'bucket') === 'awaiting-decision'
  )).catch(error => {
    failures.push({ type: 'assertion', message: error.message, expected: 'bucket=awaiting-decision' });
    return null;
  });

  const clickedClear = await clickButtonByText(page, 'Clear filter');
  if (!clickedClear) {
    failures.push({ type: 'assertion', message: 'Could not click Clear filter button for bucket route' });
  } else {
    await page.waitForFunction(() => !(document.body?.innerText || '').includes('Work queue filter: Awaiting Approval'));
  }

  const bucketScreenshot = path.join(args.screenshotDir, 'case-assignment-dashboard-bucket.png');
  await page.screenshot({ path: bucketScreenshot, fullPage: true });

  await browser.close();

  const result = {
    pass: failures.length === 0,
    screenshots: [mainScreenshot, bucketScreenshot],
    applicationCalls: apiCalls.filter(call => call.startsWith('GET /api/applications')),
    legacyStatusCall,
    bucketCall,
    initialAssertions,
    immediateSearchAssertions,
    regionalManagerTargetAssertions,
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
