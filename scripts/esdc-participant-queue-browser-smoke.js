#!/usr/bin/env node
/*
 * DEV browser smoke for the ILMP Submissions & Exports participant queue.
 *
 * This checks the real React dev bundle with deterministic mocked API data so
 * layout and widget wiring can be tested even when no reusable Cognito smoke
 * token is available in the shell.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'esdc-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.ESDC_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.ESDC_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
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
        'Usage: node scripts/esdc-participant-queue-browser-smoke.js [options]',
        '',
        'Options:',
        '  --frontend-base URL     React app origin. Default: http://localhost:3001',
        '  --screenshot-dir DIR    Directory for the final browser screenshot.',
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

function fakeJwt() {
  const payload = Buffer.from(JSON.stringify({
    email: 'smoke.admin@example.invalid',
    name: 'Smoke Admin',
    role: 'System Administrator',
    'cognito:groups': ['System_Administrator'],
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64');
  return `x.${payload}.x`;
}

const queueItems = [
  {
    id: 'client-1',
    participant_name: 'Jacqueline Sillery',
    readiness_status: 'blocked',
    submission_status: 'pending',
    action_plan_status: 'closed',
    action_plan_result_code: 'unemployed',
    action_plan_result_date: '2026-05-22',
    last_validated_at: '2026-05-27T10:00:00Z',
    blocking_issues: ['[socialInsuranceNumber] SIN Number checksum is invalid (ILMP Data Exchange Guide, row 101).'],
    warnings: ['Synthetic warning for smoke test.'],
    case_id: 101,
    children: [],
  },
  {
    id: 'client-2',
    participant_name: 'Morgan Closeout',
    readiness_status: 'ready',
    submission_status: 'pending',
    action_plan_status: 'closed',
    action_plan_result_code: 'employed',
    action_plan_result_date: '2026-05-20',
    last_validated_at: '2026-05-27T10:00:00Z',
    blocking_issues: [],
    warnings: [],
    case_id: 102,
    children: [],
  },
  {
    id: 'client-3',
    participant_name: 'Taylor Blocked',
    readiness_status: 'ready',
    submission_status: 'pending',
    action_plan_status: 'active',
    last_validated_at: '2026-05-27T10:00:00Z',
    blocking_issues: [],
    warnings: [],
    case_id: 103,
    children: [],
  },
  {
    id: 'client-4',
    participant_name: 'Dawn Ready',
    readiness_status: 'needs_review',
    submission_status: 'pending',
    action_plan_status: 'active',
    last_validated_at: '2026-05-27T10:00:00Z',
    blocking_issues: [],
    warnings: ['Review the action plan result before submission.'],
    case_id: 104,
    children: [],
  },
];

function sortItems(items, searchParams) {
  const field = searchParams.get('sortField');
  const direction = searchParams.get('sortDirection') === 'desc' ? -1 : 1;
  if (!field) return items;
  const read = item => {
    if (field === 'participant_name') return item.participant_name;
    if (field === 'readiness_status') return item.readiness_status;
    if (field === 'submission_reason') return item.action_plan_status;
    if (field === 'detail') return item.blocking_issues?.[0] || item.warnings?.[0] || '';
    return '';
  };
  return [...items].sort((left, right) => String(read(left)).localeCompare(String(read(right))) * direction);
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
          sub: 'smoke-admin-sub',
          email: 'smoke.admin@example.invalid',
          name: 'Smoke Admin',
          role: 'System Administrator',
          groups: ['System_Administrator'],
        },
        profile: {
          id: 1,
          email: 'smoke.admin@example.invalid',
          name: 'Smoke Admin',
          role: 'System Administrator',
        },
      }));
      return;
    }

    if (url.pathname === '/api/esdc/participants/batches') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }

    if (url.pathname === '/api/esdc/participants/batch-prepare') {
      request.respond(jsonResponse({
        ok: true,
        participants: [
          { id: 'client-2', case_id: 102, participant_name: 'Morgan Closeout', submission_ids: ['client-2'] },
          { id: 'client-3', case_id: 103, participant_name: 'Taylor Blocked', submission_ids: ['client-3'] },
        ],
        skipped: [
          {
            id: 'client-1',
            case_id: 101,
            participant_name: 'Jacqueline Sillery',
            detail: '[socialInsuranceNumber] SIN Number checksum is invalid.',
          },
          {
            id: 'client-4',
            case_id: 104,
            participant_name: 'Dawn Ready',
            detail: 'Review the action plan result before submission.',
          },
        ],
        xml: '<?xml version="1.0" encoding="UTF-8"?><ALMP:contentALMP><client><personSurname>Closeout</personSurname></client></ALMP:contentALMP>',
      }));
      return;
    }

    if (url.pathname === '/api/esdc/participants/batch-submit') {
      request.respond(jsonResponse({
        ok: true,
        batchId: 'ilmp-batch-smoke',
        filename: 'esdc-participants-smoke.xml',
        participants: [
          { id: 'client-2', case_id: 102, participant_name: 'Morgan Closeout', submission_ids: ['client-2'] },
          { id: 'client-3', case_id: 103, participant_name: 'Taylor Blocked', submission_ids: ['client-3'] },
        ],
        skipped: [],
        xml: '<?xml version="1.0" encoding="UTF-8"?><ALMP:contentALMP><client><personSurname>Closeout</personSurname></client></ALMP:contentALMP>',
      }));
      return;
    }

    if (url.pathname === '/api/esdc/participants') {
      const sorted = sortItems(queueItems, url.searchParams);
      const limit = Number(url.searchParams.get('limit') || 10);
      const offset = Number(url.searchParams.get('offset') || 0);
      request.respond(jsonResponse({
        items: sorted.slice(offset, offset + limit),
        total: sorted.length,
        summary: { total: 4, ready: 2, needsReview: 1, blocked: 1 },
      }));
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
  await page.setViewport({ width: 1290, height: 768, deviceScaleFactor: 1 });

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
    localStorage.setItem('esdc-participant-queue-preferences-v1', JSON.stringify({ pageSize: 10 }));
    localStorage.removeItem('esdc-participants-layout-v5');
    localStorage.setItem('esdc-participants-layout-v6', JSON.stringify([
      { id: 'queue', rowSpan: 7, columnSpan: 4 },
    ]));
  }, session, args.frontendBase);

  await page.goto(`${args.frontendBase}/esdc/participants`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body && document.body.innerText.includes('Jacqueline Sillery'));

  const assertions = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const headerText = element => element.textContent.trim();
    const queueHeaderCount = Array.from(document.querySelectorAll('h2'))
      .filter(element => headerText(element) === 'Participant submission queue').length;
    const validationHeaderCount = Array.from(document.querySelectorAll('h2'))
      .filter(element => headerText(element) === 'Validation summary').length;
    const batchHeaderCount = Array.from(document.querySelectorAll('h2'))
      .filter(element => headerText(element) === 'Batch submission').length;
    const compactCounterTextPresent = /Ready2|Needs review1|Blocked1/.test(text);
    const bucketCount = document.querySelectorAll('.esdc-readiness-bucket').length;
    const generateButtonPresent = Array.from(document.querySelectorAll('button'))
      .some(button => headerText(button).includes('Generate batch XML'));
    const tableTextPresent = ['Jacqueline Sillery', 'Morgan Closeout', 'Taylor Blocked', 'Dawn Ready']
      .every(value => text.includes(value));
    const summaryTextPresent = [
      'Eligible for batch XML generation.',
      'Warnings or soft mandatory gaps to check before submission.',
      'Hard validation failures that must be fixed first.',
    ].every(value => text.includes(value));
    const sortHeaders = Array.from(document.querySelectorAll('th'))
      .map(header => headerText(header))
      .filter(Boolean);
    return {
      queueHeaderCount,
      validationHeaderCount,
      batchHeaderCount,
      compactCounterTextPresent,
      bucketCount,
      generateButtonPresent,
      tableTextPresent,
      summaryTextPresent,
      sortHeaders,
      textSample: text.slice(0, 1200),
    };
  });

  if (assertions.queueHeaderCount !== 1) {
    failures.push({ type: 'assertion', message: 'Expected one participant queue widget header', assertions });
  }
  if (assertions.validationHeaderCount !== 0) {
    failures.push({ type: 'assertion', message: 'Standalone validation summary widget still rendered', assertions });
  }
  if (assertions.batchHeaderCount !== 0) {
    failures.push({ type: 'assertion', message: 'Standalone batch submission widget still rendered', assertions });
  }
  if (assertions.compactCounterTextPresent) {
    failures.push({ type: 'assertion', message: 'Counter text still rendered without a separator', assertions });
  }
  if (assertions.bucketCount !== 3) {
    failures.push({ type: 'assertion', message: 'Expected three readiness bucket cards', assertions });
  }
  if (!assertions.generateButtonPresent) {
    failures.push({ type: 'assertion', message: 'Generate batch XML action did not render in queue header', assertions });
  }
  if (!assertions.tableTextPresent) {
    failures.push({ type: 'assertion', message: 'Queue table rows did not render', assertions });
  }
  if (!assertions.summaryTextPresent) {
    failures.push({ type: 'assertion', message: 'Combined summary counters did not render', assertions });
  }

  const screenshot = path.join(args.screenshotDir, 'participant-queue-combined-widget.png');
  await page.screenshot({ path: screenshot, fullPage: true });

  let modalScreenshot = null;
  if (assertions.generateButtonPresent) {
    const clickedGenerate = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find(candidate => candidate.textContent.includes('Generate batch XML'));
      if (!button) return false;
      button.click();
      return true;
    });
    if (!clickedGenerate) {
      failures.push({ type: 'assertion', message: 'Could not click Generate batch XML action', assertions });
    } else {
      await page.waitForFunction(() => /(?:Download|Save) XML and mark submitted/.test(document.body?.innerText || ''));
      const modalAssertions = await page.evaluate(() => {
        const text = document.body?.innerText || '';
        return {
          filenamePresent: text.includes('Filename'),
          xmlPreviewPresent: text.includes('XML preview'),
          downloadPathPresent: text.includes('Download path'),
          textSample: text.slice(0, 1200),
        };
      });
      if (!modalAssertions.filenamePresent) {
        failures.push({ type: 'assertion', message: 'Batch modal did not render filename field', modalAssertions });
      }
      if (modalAssertions.xmlPreviewPresent) {
        failures.push({ type: 'assertion', message: 'Batch modal still renders XML preview', modalAssertions });
      }
      if (modalAssertions.downloadPathPresent) {
        failures.push({ type: 'assertion', message: 'Batch modal still renders fake download path field', modalAssertions });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      modalScreenshot = path.join(args.screenshotDir, 'participant-queue-batch-modal.png');
      await page.screenshot({ path: modalScreenshot, fullPage: true });
      if (!apiCalls.some(call => call.startsWith('POST /api/esdc/participants/batch-prepare'))) {
        failures.push({ type: 'assertion', message: 'Generate batch XML did not call batch prepare endpoint', assertions });
      }
    }
  }

  await browser.close();

  const result = { pass: failures.length === 0, screenshot, modalScreenshot, apiCalls, assertions };
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
