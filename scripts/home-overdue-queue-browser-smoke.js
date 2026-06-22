#!/usr/bin/env node
/*
 * DEV browser smoke for Home > Work Queue > Overdue status badges.
 *
 * Catches the regression where overdue application rows were rebuilt without
 * assessment_esdc_eligibility and displayed a false Awaiting EI Validation
 * status even when EI eligibility had already been recorded.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'home-overdue-queue-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.HOME_OVERDUE_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.HOME_OVERDUE_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
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
        'Usage: node scripts/home-overdue-queue-browser-smoke.js [options]',
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
      sub: 'home-overdue-smoke-sub',
      email: 'nwac.admin@example.invalid',
      name: 'NWAC Admin',
      role: 'NWAC Administrator',
      'cognito:groups': ['NWAC_Administrator'],
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

const oldSubmittedAt = '2026-05-01T12:00:00.000Z';

const overdueRows = [
  {
    application_id: 9001,
    id: 9001,
    case_id: 9101,
    tracking_id: 'OVD-EI-COMPLETE',
    applicant_name: 'Avery Assessed',
    address_province: 'ON',
    assigned_staff_profile_id: 501,
    assigned_to_user_id: 501,
    assigned_user_email: 'coordinator@example.invalid',
    application_status: 'in_review',
    status: 'in_review',
    application_lifecycle_status: 'in_review',
    assessment_esdc_eligibility: 'crf',
    submitted_at: oldSubmittedAt,
    created_at: oldSubmittedAt,
    application_updated_at: oldSubmittedAt,
  },
  {
    application_id: 9002,
    id: 9002,
    case_id: 9102,
    tracking_id: 'OVD-EI-MISSING',
    applicant_name: 'Blair Pending',
    address_province: 'BC',
    assigned_staff_profile_id: 502,
    assigned_to_user_id: 502,
    assigned_user_email: 'coordinator@example.invalid',
    application_status: 'submitted',
    status: 'submitted',
    application_lifecycle_status: 'submitted',
    assessment_esdc_eligibility: null,
    submitted_at: oldSubmittedAt,
    created_at: oldSubmittedAt,
    application_updated_at: oldSubmittedAt,
  },
];

function buildApplicationsResponse(url) {
  const status = url.searchParams.get('status');
  const bucket = url.searchParams.get('bucket') || url.searchParams.get('statusGroup');
  if (!status && !bucket && url.searchParams.get('limit') === '300') {
    return { rows: overdueRows, total: overdueRows.length };
  }
  return { rows: [], items: [], total: 0 };
}

async function installApiStubs(page, apiCalls) {
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

    const pathname = url.pathname;
    if (pathname === '/api/auth/me') {
      request.respond(jsonResponse({
        auth: {
          sub: 'home-overdue-smoke-sub',
          email: 'nwac.admin@example.invalid',
          name: 'NWAC Admin',
          role: 'NWAC Administrator',
          groups: ['NWAC_Administrator'],
          staffProfileId: 501,
          regionIds: [1],
        },
        profile: {
          id: 501,
          email: 'nwac.admin@example.invalid',
          name: 'NWAC Admin',
          role: 'NWAC Administrator',
          region_id: 1,
          region_ids: [1],
        },
      }));
      return;
    }

    if (pathname === '/api/me/staff-profiles') {
      request.respond(jsonResponse({ items: [], profiles: [] }));
      return;
    }
    if (pathname === '/api/admin/contact-messages') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === '/api/me/staff-messages/counts') {
      request.respond(jsonResponse({ unread: 0, total: 0 }));
      return;
    }
    if (pathname === '/api/me/notifications') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === '/api/me/tutorial-progress') {
      request.respond(jsonResponse({ completed: [] }));
      return;
    }
    if (pathname === '/api/service-announcement/current') {
      request.respond(jsonResponse({ announcement: null }));
      return;
    }
    if (pathname === '/api/access-control/matrix') {
      request.respond(jsonResponse({ default: 'allow', routes: {} }));
      return;
    }
    if (pathname === '/api/config/runtime/demo-navigation') {
      request.respond(jsonResponse({ enabled: false }));
      return;
    }
    if (pathname === '/api/config/sla-targets') {
      request.respond(jsonResponse({
        targets: [
          { stage_key: 'assignment', target_hours: 72 },
          { stage_key: 'ei_status_verification', target_hours: 72 },
          { stage_key: 'assessment', target_hours: 240 },
          { stage_key: 'program_decision', target_hours: 48 },
        ],
      }));
      return;
    }
    if (pathname === '/api/applications') {
      request.respond(jsonResponse(buildApplicationsResponse(url)));
      return;
    }
    if (pathname === '/api/cases') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === '/api/escalations') {
      request.respond(jsonResponse({ items: [], rows: [], total: 0 }));
      return;
    }
    if (pathname === '/api/watchlist/cases') {
      request.respond(jsonResponse({ items: [], rows: [], total: 0 }));
      return;
    }
    if (pathname === '/api/staff/assignable') {
      request.respond(jsonResponse({ items: [], rows: [] }));
      return;
    }

    request.respond(jsonResponse({ items: [], rows: [], applications: [], total: 0, count: 0 }));
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickVisibleText(page, text) {
  const point = await page.evaluate((expected) => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const elements = Array.from(document.querySelectorAll('button, [role="button"], [role="option"], label, span, div'));
    const element = elements.find(candidate => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && normalize(candidate.textContent) === expected;
    });
    const target = element?.closest?.('[role="option"], [role="button"], button, label') || element;
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, text);
  if (!point) {
    throw new Error(`Could not find visible text "${text}"`);
  }
  await page.mouse.click(point.x, point.y);
}

async function clickWorkQueueBucket(page, label) {
  const point = await page.evaluate((expected) => {
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    const matchesBucket = text =>
      text.includes(expected) &&
      /Applications past target|Items past their target|past target date|Past-target files/i.test(text);
    const radioCandidates = Array.from(document.querySelectorAll('input[type="radio"]'))
      .map(input => {
        let container = input;
        for (let current = input.parentElement; current; current = current.parentElement) {
          const text = normalize(current.textContent);
          if (matchesBucket(text)) {
            container = current;
            break;
          }
        }
        const rect = container.getBoundingClientRect();
        const text = normalize(container.textContent);
        return { input, element: container, rect, text, area: rect.width * rect.height };
      })
      .filter(candidate =>
        candidate.rect.width > 0 &&
        candidate.rect.height > 0 &&
        matchesBucket(candidate.text)
      )
      .sort((left, right) => left.area - right.area);
    if (radioCandidates.length) {
      const candidate = radioCandidates[0];
      candidate.element.scrollIntoView({ block: 'center', inline: 'nearest' });
      const inputRect = candidate.input.getBoundingClientRect();
      if (inputRect.width > 0 && inputRect.height > 0) {
        return { x: inputRect.left + inputRect.width / 2, y: inputRect.top + inputRect.height / 2, text: candidate.text };
      }
      const rect = candidate.element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: candidate.text };
    }
    const elements = Array.from(document.querySelectorAll('[role="option"], [role="listitem"], li, article, div'));
    const candidates = elements
      .map(element => {
        const rect = element.getBoundingClientRect();
        const text = normalize(element.textContent);
        return { element, rect, text, area: rect.width * rect.height };
      })
      .filter(candidate =>
        candidate.rect.width > 0 &&
        candidate.rect.height > 0 &&
        matchesBucket(candidate.text)
      )
      .sort((left, right) => left.area - right.area);
    const target = candidates[0]?.element || null;
    if (!target) return null;
    const clickable = target.closest?.('[role="option"], [role="button"], button, label') || target;
    clickable.scrollIntoView({ block: 'center', inline: 'nearest' });
    const rect = clickable.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, text: normalize(clickable.textContent) };
  }, label);
  if (!point) {
    await clickVisibleText(page, label);
    return;
  }
  await page.mouse.click(point.x, point.y);
}

async function waitForBodyText(page, text, timeoutMs = 15000) {
  await page.waitForFunction(
    expected => (document.body?.innerText || '').includes(expected),
    { timeout: timeoutMs },
    text
  );
}

async function dismissQuickStartIfVisible(page) {
  const visible = await page.evaluate(() => (document.body?.innerText || '').includes('PATH quick start'));
  if (!visible) return;
  await clickVisibleText(page, 'Not now');
  await page.waitForFunction(
    () => !(document.body?.innerText || '').includes('PATH quick start'),
    { timeout: 10000 }
  );
}

async function getVisibleRows(page) {
  return page.evaluate(() => {
    const normalize = value => String(value || '').replace(/\u2022/g, ' • ').replace(/\s+/g, ' ').trim();
    const rowElements = Array.from(document.querySelectorAll('tr, [role="row"]'));
    return rowElements
      .map(row => normalize(row.textContent))
      .filter(Boolean);
  });
}

function findRow(rows, applicant) {
  return rows.find(row => row.includes(applicant)) || '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.screenshotDir, { recursive: true });
  ensureLocalChromeLibraryPath();

  const executablePath = findChromeExecutable();
  if (!executablePath) {
    throw new Error('Could not find a Chromium executable for Puppeteer. Set PUPPETEER_EXECUTABLE_PATH.');
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  const apiCalls = [];
  const failures = [];
  page.on('pageerror', error => failures.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => {
    const text = message.text();
    if (/ReferenceError|TypeError|Unhandled|Failed to load|failed with status|CORS|ERR_FAILED|Unauthorized|Cannot update a component|Encountered two children with the same key/i.test(text)) {
      failures.push({ type: 'console', level: message.type(), text: text.slice(0, 1500) });
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

  try {
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
      localStorage.setItem('admin-home-layout-v7.NWAC Administrator', JSON.stringify([
        { id: 'program-admin-work-queue', rowSpan: 16, columnSpan: 1 },
        { id: 'work-queue-items-table', rowSpan: 8, columnSpan: 3 },
      ]));
    }, session, args.frontendBase);

    await page.goto(`${args.frontendBase}/`, { waitUntil: 'domcontentloaded' });
    await waitForBodyText(page, 'Work Queue');
    await waitForBodyText(page, 'Overdue');
    await dismissQuickStartIfVisible(page);
    await clickWorkQueueBucket(page, 'Overdue');
    await waitForBodyText(page, 'Avery Assessed');
    await waitForBodyText(page, 'Blair Pending');
    await delay(500);

    const rows = await getVisibleRows(page);
    const avery = findRow(rows, 'Avery Assessed');
    const blair = findRow(rows, 'Blair Pending');
    if (!avery) failures.push({ type: 'assertion', message: 'Avery overdue row was not visible', rows });
    if (!blair) failures.push({ type: 'assertion', message: 'Blair overdue row was not visible', rows });
    if (avery && !avery.includes('In Review')) {
      failures.push({ type: 'assertion', message: 'Avery row did not show In Review', row: avery });
    }
    if (avery && avery.includes('Awaiting EI Validation')) {
      failures.push({ type: 'assertion', message: 'Avery row showed a false EI validation badge', row: avery });
    }
    if (blair && !blair.includes('Submitted') && !blair.includes('Awaiting EI Validation')) {
      failures.push({ type: 'assertion', message: 'Blair row did not show submitted/awaiting EI status', row: blair });
    } else if (blair && !blair.includes('Awaiting EI Validation')) {
      failures.push({ type: 'assertion', message: 'Blair row did not show legitimate Awaiting EI Validation badge', row: blair });
    }

    const applicationsCallCount = apiCalls.filter(call => call.path === '/api/applications').length;
    await delay(2000);
    const applicationsCallCountAfterIdle = apiCalls.filter(call => call.path === '/api/applications').length;
    if (applicationsCallCountAfterIdle !== applicationsCallCount) {
      failures.push({
        type: 'assertion',
        message: '/api/applications continued firing after idle',
        before: applicationsCallCount,
        after: applicationsCallCountAfterIdle,
      });
    }

    const screenshot = path.join(args.screenshotDir, 'home-overdue-queue.png');
    await page.screenshot({ path: screenshot, fullPage: true });

    if (failures.length) {
      console.error(JSON.stringify({ ok: false, screenshot, failures, apiCalls }, null, 2));
      process.exit(1);
    }

    console.log(JSON.stringify({
      ok: true,
      screenshot,
      rows: { avery, blair },
      apiCallCount: apiCalls.length,
      applicationsCallCount,
    }, null, 2));
  } catch (error) {
    const screenshot = path.join(args.screenshotDir, 'home-overdue-queue-failure.png');
    let textSample = '';
    try {
      textSample = await page.evaluate(() => (document.body?.innerText || '').slice(0, 4000));
    } catch (_) {
      textSample = '';
    }
    try {
      await page.screenshot({ path: screenshot, fullPage: true });
    } catch (_) {
      // Ignore screenshot failures while reporting the original issue.
    }
    console.error(JSON.stringify({
      ok: false,
      error: error?.stack || error?.message || String(error),
      screenshot,
      textSample,
      failures,
      apiCalls,
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
