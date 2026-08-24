#!/usr/bin/env node
/*
 * DEV browser smoke for the Application Overview Docs Requested toggle.
 *
 * This catches false optimistic-lock warnings when the overview widget has a
 * stale application-detail row_version but the workspace case payload has a
 * fresher selected-application application_row_version.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'application-overview-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.APPLICATION_OVERVIEW_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.APPLICATION_OVERVIEW_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
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
        'Usage: node scripts/application-overview-docs-requested-browser-smoke.js [options]',
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

async function captureDiagnostic(page, args, label, apiCalls, failures) {
  const screenshot = path.join(args.screenshotDir, `${label}.png`);
  let textSample = '';
  try {
    textSample = await page.evaluate(() => (document.body?.innerText || '').slice(0, 2000));
  } catch (_) {
    textSample = '';
  }
  try {
    await page.screenshot({ path: screenshot, fullPage: true });
  } catch (_) {
    // ignore screenshot failures while reporting the original issue
  }
  return {
    screenshot,
    textSample,
    apiCalls: apiCalls.map(call => `${call.method} ${call.path}${call.search}`),
    failures,
  };
}

const now = new Date();
const lockExpiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();

function buildCasePayload(state) {
  return {
    id: 1,
    case_id: 1,
    application_id: 2,
    applicationId: 2,
    application_row_version: state.rowVersion,
    reference_number: 'ISET-20260508-A02882',
    tracking_id: 'ISET-20260508-A02882',
    first_name: 'Jacqueline',
    preferred_name: 'Jacqueline',
    last_name: 'Sillery',
    email: 'jack@sillery.co.uk',
    phone: '(514) 782-4396',
    address_province: 'QC',
    application_address_province: 'QC',
    status: 'ready_to_close',
    lifecycle_status: 'dormant',
    applicationStatus: 'approved',
    application_status: 'approved',
    application_lifecycle_status: 'decision_recorded',
    decision_outcome: 'approved',
    assigned_staff_profile_id: 1,
    assigned_user_email: 'program.admin@awentech.ca',
    assigned_user_display_name: 'System Administrator',
    assessment_esdc_eligibility: 'eligible',
    submitted_at: '2026-05-08T16:24:00Z',
    created_at: '2026-05-08T16:24:00Z',
    updated_at: '2026-05-08T17:06:42Z',
    docs_requested_active: state.docsRequestedActive ? 1 : 0,
    docs_requested_at: '2026-05-08T17:06:42Z',
    docs_requested_cleared_at: state.docsRequestedActive ? null : new Date().toISOString(),
    docs_requested_source: 'secure_message',
    lock_owner_id: 'smoke-admin-sub',
    lock_owner_name: 'System Administrator',
    lock_owner_email: 'program.admin@awentech.ca',
    lock_expires_at: lockExpiresAt,
  };
}

function buildApplicationPayload(state) {
  return {
    id: 2,
    case_id: 1,
    row_version: state.applicationDetailRowVersion,
    payload_json: JSON.stringify({
      'preferred-name': 'Jacqueline',
      email: 'jack@sillery.co.uk',
      phone: '(514) 782-4396',
      'address-province': 'QC',
    }),
    status: 'approved',
    lifecycle_status: 'decision_recorded',
    decision_outcome: 'approved',
    applicant_name: 'Jacqueline Joanne Sillery',
    tracking_id: 'ISET-20260508-A02882',
    submitted_at: '2026-05-08T16:24:00Z',
    created_at: '2026-05-08T16:24:00Z',
    updated_at: '2026-05-08T17:06:42Z',
    docs_requested_active: state.docsRequestedActive ? 1 : 0,
    docs_requested_at: '2026-05-08T17:06:42Z',
    docs_requested_cleared_at: state.docsRequestedActive ? null : new Date().toISOString(),
    docs_requested_source: 'secure_message',
    lock_owner_id: 'smoke-admin-sub',
    lock_owner_name: 'System Administrator',
    lock_owner_email: 'program.admin@awentech.ca',
    lock_expires_at: lockExpiresAt,
  };
}

async function installApiStubs(page, apiCalls, state) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      request.continue();
      return;
    }

    const call = {
      method: request.method(),
      path: url.pathname,
      search: url.search,
      postData: request.postData() || null,
    };
    apiCalls.push(call);

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

    if (url.pathname === '/api/cases/1' && request.method() === 'GET') {
      request.respond(jsonResponse(buildCasePayload(state)));
      return;
    }

    if (url.pathname === '/api/cases/1' && request.method() === 'PUT') {
      let body = {};
      try {
        body = JSON.parse(request.postData() || '{}');
      } catch (_) {
        body = {};
      }
      state.lastCaseUpdate = body;
      const expectedRowVersion = Number(body.expectedRowVersion || 0);
      const isDocsClear = body.applicationId === 2 && body.docsRequested === false;
      if (!isDocsClear || expectedRowVersion !== state.rowVersion) {
        request.respond(jsonResponse({
          success: false,
          error: 'row_version_conflict',
          currentRowVersion: state.rowVersion,
        }, 409));
        return;
      }
      state.docsRequestedActive = false;
      state.rowVersion += 1;
      state.applicationDetailRowVersion = state.rowVersion;
      request.respond(jsonResponse({
        success: true,
        id: 1,
        application_id: 2,
        application_row_version: state.rowVersion,
        docs_requested_active: 0,
        docs_requested_cleared_at: new Date().toISOString(),
      }));
      return;
    }

    if (url.pathname === '/api/applications/2') {
      request.respond(jsonResponse(buildApplicationPayload(state)));
      return;
    }

    if (url.pathname === '/api/locks/application/2' && request.method() === 'POST') {
      request.respond(jsonResponse({
        success: true,
        lock: {
          application_id: 2,
          owner_user_id: 'smoke-admin-sub',
          owner_display_name: 'System Administrator',
          owner_email: 'program.admin@awentech.ca',
          acquired_at: now.toISOString(),
          expires_at: lockExpiresAt,
          ttl_minutes: 15,
          heartbeat_minutes: 5,
          reused: true,
        },
      }));
      return;
    }

    if (url.pathname === '/api/locks/application/2' && request.method() === 'DELETE') {
      request.respond(jsonResponse({ released: true, lock: null }));
      return;
    }

    if (url.pathname === '/api/regions/canada') {
      request.respond(jsonResponse([{ code: 'QC', name: 'Quebec' }]));
      return;
    }
    if (url.pathname === '/api/config/sla-targets') {
      request.respond(jsonResponse({ targets: [] }));
      return;
    }
    if (url.pathname === '/api/escalations') {
      request.respond(jsonResponse({ items: [] }));
      return;
    }
    if (url.pathname === '/api/applications/2/watchlist-hit') {
      request.respond(jsonResponse({ hit: null }));
      return;
    }
    if (/^\/api\/applicants\/[^/]+\/document-checklist$/.test(url.pathname)) {
      request.respond(jsonResponse({ items: [], missingRequiredCount: 0 }));
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

    request.respond(jsonResponse({ items: [], rows: [], total: 0, count: 0 }));
  });
}

async function clickDocumentsRequestedToggle(page) {
  const point = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('label, [role="switch"], button, span, div'))
      .map(element => {
        const text = element.innerText || element.textContent || '';
        const rect = element.getBoundingClientRect();
        return { element, text, rect, area: rect.width * rect.height };
      })
      .filter(entry => entry.text.includes('Documents requested') && entry.rect.width > 0 && entry.rect.height > 0)
      .sort((left, right) => left.area - right.area);
    const target = candidates[0]?.element || null;
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: rect.left + Math.min(rect.width - 4, Math.max(4, rect.width / 2)),
      y: rect.top + Math.min(rect.height - 4, Math.max(4, rect.height / 2)),
    };
  });
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
  const state = {
    docsRequestedActive: true,
    rowVersion: 7,
    applicationDetailRowVersion: 5,
    lastCaseUpdate: null,
  };

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

  await installApiStubs(page, apiCalls, state);

  const session = {
    idToken: fakeJwt(),
    accessToken: fakeJwt(),
    refreshToken: null,
    expiresAt: Math.floor(Date.now() / 1000) + 3300,
  };
  await page.evaluateOnNewDocument((authSession, frontendBase) => {
    window.__API_BASE__ = frontendBase;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
    localStorage.setItem('application-assessment-dashboard-layout.v2', JSON.stringify([
      { id: 'application-overview', rowSpan: 3, columnSpan: 4 },
    ]));
  }, session, args.frontendBase);

  await page.goto(`${args.frontendBase}/application-case/1?applicationId=2`, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => {
      const text = document.body?.innerText || '';
      return text.includes('Application Overview') && text.includes('Jacqueline');
    });
    await page.waitForFunction(() => document.body && document.body.innerText.includes('Docs Requested'));
  } catch (error) {
    const diagnostic = await captureDiagnostic(page, args, 'application-overview-load-timeout', apiCalls, failures);
    await browser.close();
    console.error(JSON.stringify({
      pass: false,
      error: error.message,
      diagnostic,
    }, null, 2));
    process.exit(1);
  }

  const initialAssertions = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const switchStates = Array.from(document.querySelectorAll('[role="switch"], input[type="checkbox"]'))
      .map(element => ({
        text: element.closest('label')?.innerText || element.innerText || element.getAttribute('aria-label') || '',
        ariaChecked: element.getAttribute('aria-checked'),
        checked: Boolean(element.checked),
      }));
    const checkedToggle = switchStates.find(entry =>
      entry.text.includes('Documents requested') &&
      (entry.checked || entry.ariaChecked === 'true')
    );
    return {
      hasOverview: text.includes('Application Overview') && text.includes('Jacqueline'),
      hasDecisionRecorded: text.includes('Decision Recorded') || text.includes('Approved'),
      hasDocsRequested: text.includes('Docs Requested'),
      docsToggleChecked: Boolean(checkedToggle),
      switchStates,
      textSample: text.slice(0, 1200),
    };
  });

  if (!initialAssertions.hasOverview || !initialAssertions.hasDocsRequested) {
    failures.push({ type: 'assertion', message: 'Application Overview did not render an active Docs Requested toggle', initialAssertions });
  }

  const clicked = await clickDocumentsRequestedToggle(page);
  if (!clicked) {
    failures.push({ type: 'assertion', message: 'Could not click Documents requested toggle', initialAssertions });
  }

  try {
    await page.waitForFunction(() => document.body && document.body.innerText.includes('Document request cleared.'));
  } catch (error) {
    const diagnostic = await captureDiagnostic(page, args, 'application-overview-toggle-timeout', apiCalls, failures);
    await browser.close();
    console.error(JSON.stringify({
      pass: false,
      error: error.message,
      lastCaseUpdate: state.lastCaseUpdate,
      diagnostic,
    }, null, 2));
    process.exit(1);
  }

  const finalAssertions = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    return {
      hasSuccess: text.includes('Document request cleared.'),
      hasFalseConflict: text.includes('Another user updated this application first'),
      hasNotRequested: text.includes('Not requested'),
      textSample: text.slice(0, 1400),
    };
  });

  if (!finalAssertions.hasSuccess || finalAssertions.hasFalseConflict || !finalAssertions.hasNotRequested) {
    failures.push({ type: 'assertion', message: 'Docs Requested clear did not finish with the expected UI state', finalAssertions });
  }

  if (!state.lastCaseUpdate) {
    failures.push({ type: 'assertion', message: 'Docs Requested clear did not call PUT /api/cases/1' });
  } else {
    const expectedRowVersion = Number(state.lastCaseUpdate.expectedRowVersion || 0);
    if (expectedRowVersion !== 7) {
      failures.push({
        type: 'assertion',
        message: 'Docs Requested clear sent a stale expectedRowVersion',
        lastCaseUpdate: state.lastCaseUpdate,
      });
    }
    if (state.lastCaseUpdate.docsRequested !== false || Number(state.lastCaseUpdate.applicationId) !== 2) {
      failures.push({
        type: 'assertion',
        message: 'Docs Requested clear sent an unexpected payload',
        lastCaseUpdate: state.lastCaseUpdate,
      });
    }
  }

  const screenshot = path.join(args.screenshotDir, 'application-overview-docs-requested-clear.png');
  await page.screenshot({ path: screenshot, fullPage: true });

  await browser.close();

  const result = {
    pass: failures.length === 0,
    screenshot,
    lastCaseUpdate: state.lastCaseUpdate,
    caseCalls: apiCalls
      .filter(call => call.path === '/api/cases/1')
      .map(call => `${call.method} ${call.path}${call.search}`),
    initialAssertions,
    finalAssertions,
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
