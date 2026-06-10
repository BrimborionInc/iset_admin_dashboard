#!/usr/bin/env node
/*
 * DEV browser smoke for the Manage Intake Steps / Manage Components dashboard.
 *
 * This loads the real local React bundle with deterministic mocked API data so
 * the board chrome, palette wiring, table sorting, preview sizing, and request
 * settling can be tested without requiring a reusable Cognito smoke token.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'manage-components-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';
const STORAGE_KEY = 'manage-components-board-layout-v2';
const CONSOLE_SNIPPET_LIMIT = 1500;

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.MANAGE_COMPONENTS_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.MANAGE_COMPONENTS_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
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
        'Usage: node scripts/manage-components-dashboard-browser-smoke.js [options]',
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
      email: 'smoke.admin@example.invalid',
      name: 'Smoke Admin',
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

const stepRows = [
  {
    id: 31,
    name: 'Zeta Residency Review',
    updated_at: '2026-06-01T13:30:00Z',
  },
  {
    id: 11,
    name: 'Alpha Identity Check',
    updated_at: '2026-06-03T09:15:00Z',
  },
  {
    id: 22,
    name: 'Middle Eligibility Questions',
    updated_at: '2026-05-25T17:45:00Z',
  },
];

const stepDetails = Object.fromEntries(stepRows.map(step => [
  String(step.id),
  {
    ...step,
    components: [
      {
        id: `component-${step.id}`,
        templateKey: 'text-input',
        type: 'text-input',
        props: {
          id: `field-${step.id}`,
          name: `field-${step.id}`,
          label: { en: `${step.name} field`, fr: `${step.name} field` },
          hint: { en: 'Smoke preview field', fr: 'Smoke preview field' },
        },
      },
    ],
  },
]));

function previewHtml(requestBody) {
  let stepId = 'unknown';
  try {
    const parsed = requestBody ? JSON.parse(requestBody) : {};
    stepId = parsed.stepId || 'unknown';
  } catch {
    stepId = 'unknown';
  }
  const detail = stepDetails[String(stepId)];
  const title = detail?.name || 'Previewed intake step';
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<style>',
    'body { margin: 0; font-family: Arial, sans-serif; color: #111827; }',
    '.smoke-preview { padding: 16px; }',
    '.smoke-preview label { display: block; font-weight: 700; margin-bottom: 6px; }',
    '.smoke-preview input { width: 100%; box-sizing: border-box; padding: 8px; }',
    '</style>',
    '</head>',
    '<body>',
    `<main class="smoke-preview"><h1>${title}</h1><label for="smoke-field">Smoke field</label><input id="smoke-field" value="Preview rendered" /></main>`,
    '</body>',
    '</html>',
  ].join('');
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
          email: 'smoke.admin@example.invalid',
          name: 'Smoke Admin',
          role: 'System Administrator',
          groups: ['System_Administrator'],
          staffProfileId: 1,
          regionIds: [1],
        },
        profile: {
          id: 1,
          email: 'smoke.admin@example.invalid',
          name: 'Smoke Admin',
          role: 'System Administrator',
          region_id: 1,
          region_ids: [1],
        },
      }));
      return;
    }

    if (pathname === '/api/steps' && request.method() === 'GET') {
      request.respond(jsonResponse(stepRows));
      return;
    }

    const stepDetailMatch = pathname.match(/^\/api\/steps\/(\d+)$/);
    if (stepDetailMatch && request.method() === 'GET') {
      request.respond(jsonResponse(stepDetails[stepDetailMatch[1]] || null, stepDetails[stepDetailMatch[1]] ? 200 : 404));
      return;
    }

    if (pathname === '/api/preview/step' && request.method() === 'POST') {
      request.respond({
        status: 200,
        contentType: 'text/html',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: previewHtml(request.postData()),
      });
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

    request.respond(jsonResponse({ items: [], rows: [], total: 0, count: 0 }));
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function countListStepCalls(apiCalls) {
  return apiCalls.filter(call => call.method === 'GET' && call.path === '/api/steps').length;
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

async function clickLinkByText(page, text) {
  return page.evaluate((label) => {
    const link = Array.from(document.querySelectorAll('a'))
      .find(candidate => candidate.textContent.trim().includes(label));
    if (!link) return false;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, text);
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

async function getVisibleStepOrder(page) {
  return page.evaluate((knownNames) => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    return rows
      .map(row => {
        const text = row.textContent || '';
        return knownNames.find(name => text.includes(name)) || null;
      })
      .filter(Boolean);
  }, stepRows.map(step => step.name));
}

async function waitForBodyText(page, text, timeoutMs = 8000) {
  await page.waitForFunction(
    expected => (document.body?.innerText || '').includes(expected),
    { timeout: timeoutMs },
    text
  );
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
  await page.setViewport({ width: 1360, height: 860, deviceScaleFactor: 1 });

  const failures = [];
  const apiCalls = [];
  page.on('pageerror', error => failures.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => {
    const text = message.text();
    if (/ReferenceError|TypeError|Unhandled|Failed to load|failed with status|CORS|ERR_FAILED|Unauthorized|Cannot update a component|Encountered two children with the same key/i.test(text)) {
      failures.push({ type: 'console', level: message.type(), text: text.slice(0, CONSOLE_SNIPPET_LIMIT) });
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
  await page.evaluateOnNewDocument((authSession, frontendBase, storageKey) => {
    window.__API_BASE__ = frontendBase;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
    localStorage.setItem(storageKey, JSON.stringify([
      { id: 'stepLibrary', rowSpan: 5, columnSpan: 2 },
    ]));
    localStorage.removeItem('preview.lang');
  }, session, args.frontendBase, STORAGE_KEY);

  await page.goto(`${args.frontendBase}/manage-components`, { waitUntil: 'domcontentloaded' });
  await waitForBodyText(page, 'Manage Intake Steps');
  await waitForBodyText(page, 'Alpha Identity Check');

  const initialListCalls = countListStepCalls(apiCalls);
  await delay(1200);
  const idleListCalls = countListStepCalls(apiCalls);
  if (idleListCalls !== initialListCalls) {
    failures.push({
      type: 'assertion',
      message: 'Runaway /api/steps requests detected after initial dashboard render',
      initialListCalls,
      idleListCalls,
      stepCalls: apiCalls.filter(call => call.path === '/api/steps'),
    });
  }

  const initialAssertions = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const h1 = Array.from(document.querySelectorAll('h1')).find(node => node.textContent.includes('Manage Intake Steps'));
    const buttons = Array.from(document.querySelectorAll('button'));
    const addButton = buttons.find(button => button.textContent.trim().includes('Add widget'));
    const resetButton = buttons.find(button => button.textContent.trim().includes('Reset layout'));
    const stepLibraryHeading = Array.from(document.querySelectorAll('h2,h3'))
      .find(node => node.textContent.includes('Intake Step Library'));
    const h1Rect = h1?.getBoundingClientRect();
    const addRect = addButton?.getBoundingClientRect();
    const resetRect = resetButton?.getBoundingClientRect();
    const stepLibraryRect = stepLibraryHeading?.getBoundingClientRect();
    return {
      hasRouteActions: Boolean(addButton && resetButton),
      resetSharesActionRow: Boolean(addRect && resetRect && Math.abs(addRect.top - resetRect.top) <= 8),
      resetAboveBoard: Boolean(resetRect && stepLibraryRect && resetRect.bottom < stepLibraryRect.top),
      resetNearRouteHeader: Boolean(h1Rect && resetRect && resetRect.top - h1Rect.top < 96),
      hasPreviewBeforeReset: text.includes('Preview Intake Step') || text.includes('Preview:'),
      hasStepJsonBeforeReset: text.includes('Step JSON'),
      hasTableRows: ['Alpha Identity Check', 'Middle Eligibility Questions', 'Zeta Residency Review'].every(value => text.includes(value)),
      tableResizeHandleCount: Array.from(document.querySelectorAll('th [aria-label*="resize" i], th [role="separator"], th [class*="resizer" i]')).length,
      h1Top: h1Rect?.top ?? null,
      resetTop: resetRect?.top ?? null,
      stepLibraryTop: stepLibraryRect?.top ?? null,
      textSample: text.slice(0, 1600),
    };
  });

  if (!initialAssertions.hasRouteActions || !initialAssertions.resetSharesActionRow || !initialAssertions.resetAboveBoard || !initialAssertions.resetNearRouteHeader) {
    failures.push({ type: 'assertion', message: 'Route Add widget / Reset layout actions are not in the expected header position', initialAssertions });
  }
  if (initialAssertions.hasPreviewBeforeReset || initialAssertions.hasStepJsonBeforeReset) {
    failures.push({ type: 'assertion', message: 'Initial one-widget layout did not hide removed widgets', initialAssertions });
  }
  if (!initialAssertions.hasTableRows) {
    failures.push({ type: 'assertion', message: 'Intake step rows did not render', initialAssertions });
  }
  if (initialAssertions.tableResizeHandleCount < 1) {
    failures.push({ type: 'assertion', message: 'No table column resize handles were detected', initialAssertions });
  }

  const clickedAddWidget = await clickButtonByText(page, 'Add widget');
  if (!clickedAddWidget) {
    failures.push({ type: 'assertion', message: 'Could not click Add widget' });
  } else {
    await waitForBodyText(page, 'Available Widgets').catch(error => {
      failures.push({ type: 'assertion', message: error.message, expected: 'Available Widgets split panel' });
    });
    const paletteAssertions = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return {
        hasAvailableWidgets: text.includes('Available Widgets'),
        hasPreviewPaletteItem: text.includes('Preview') && text.includes('Render the selected step'),
        hasStepJsonPaletteItem: text.includes('Step JSON') && text.includes('Inspect the raw step payload'),
        textSample: text.slice(0, 2200),
      };
    });
    if (!paletteAssertions.hasAvailableWidgets || !paletteAssertions.hasPreviewPaletteItem || !paletteAssertions.hasStepJsonPaletteItem) {
      failures.push({ type: 'assertion', message: 'Add widget did not expose the missing widget palette items', paletteAssertions });
    }
  }

  const clickedReset = await clickButtonByText(page, 'Reset layout');
  if (!clickedReset) {
    failures.push({ type: 'assertion', message: 'Could not click Reset layout' });
  } else {
    await waitForBodyText(page, 'Preview Intake Step');
    await waitForBodyText(page, 'Step JSON');
  }

  const layoutAfterReset = await page.evaluate(storageKey => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch {
      return [];
    }
  }, STORAGE_KEY);
  const resetIds = layoutAfterReset.map(item => item.id).sort();
  if (resetIds.join(',') !== ['previewJson', 'previewStep', 'stepLibrary'].sort().join(',')) {
    failures.push({ type: 'assertion', message: 'Reset layout did not restore all Manage Components widgets', layoutAfterReset });
  }

  const orderBeforeSort = await getVisibleStepOrder(page);
  if (orderBeforeSort.join('|') !== 'Alpha Identity Check|Middle Eligibility Questions|Zeta Residency Review') {
    failures.push({ type: 'assertion', message: 'Default name sort did not apply to the full intake step list', orderBeforeSort });
  }

  const clickedSort = await clickTableHeader(page, 'Intake Step');
  if (!clickedSort) {
    failures.push({ type: 'assertion', message: 'Could not click Intake Step sort header' });
  } else {
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.some(row => (row.textContent || '').includes('Zeta Residency Review')) &&
        rows[0] && (rows[0].textContent || '').includes('Zeta Residency Review');
    });
    const orderAfterSort = await getVisibleStepOrder(page);
    if (orderAfterSort.join('|') !== 'Zeta Residency Review|Middle Eligibility Questions|Alpha Identity Check') {
      failures.push({ type: 'assertion', message: 'Intake Step sorting did not reverse the full visible list', orderAfterSort });
    }
  }

  const listCallsBeforeSelect = countListStepCalls(apiCalls);
  const clickedAlpha = await clickLinkByText(page, 'Alpha Identity Check');
  if (!clickedAlpha) {
    failures.push({ type: 'assertion', message: 'Could not click Alpha Identity Check row link' });
  } else {
    await waitForBodyText(page, 'Preview: Alpha Identity Check');
    await page.waitForSelector('iframe[title="Preview"]');
    await waitForBodyText(page, 'component-11').catch(() => undefined);
    await delay(1200);
    const listCallsAfterSelect = countListStepCalls(apiCalls);
    if (listCallsAfterSelect !== listCallsBeforeSelect) {
      failures.push({
        type: 'assertion',
        message: 'Selecting a step caused the step library list endpoint to refetch unexpectedly',
        listCallsBeforeSelect,
        listCallsAfterSelect,
        stepCalls: apiCalls.filter(call => call.path === '/api/steps'),
      });
    }
  }

  const previewSizing = await page.evaluate(() => {
    const frame = document.querySelector('[data-manage-components-preview-frame]');
    const iframe = frame?.querySelector('iframe');
    if (!frame || !iframe) return { found: false };
    const frameRect = frame.getBoundingClientRect();
    const iframeRect = iframe.getBoundingClientRect();
    let ancestor = frame.parentElement;
    let itemRect = null;
    while (ancestor) {
      const rect = ancestor.getBoundingClientRect();
      const text = ancestor.textContent || '';
      if (text.includes('Preview: Alpha Identity Check') && rect.height > frameRect.height + 24 && rect.width >= frameRect.width) {
        itemRect = rect;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    return {
      found: true,
      hasBoardAncestor: Boolean(itemRect),
      frameHeight: Math.round(frameRect.height),
      iframeHeight: Math.round(iframeRect.height),
      itemHeight: itemRect ? Math.round(itemRect.height) : null,
      frameBottom: Math.round(frameRect.bottom),
      iframeBottom: Math.round(iframeRect.bottom),
      itemBottom: itemRect ? Math.round(itemRect.bottom) : null,
      frameUsesBoardSpace: itemRect ? frameRect.height / itemRect.height >= 0.6 : false,
      frameOverflowsItem: itemRect ? frameRect.bottom > itemRect.bottom + 2 : true,
      iframeOverflowsFrame: iframeRect.bottom > frameRect.bottom + 2,
    };
  });
  if (
    !previewSizing.found ||
    !previewSizing.hasBoardAncestor ||
    !previewSizing.frameUsesBoardSpace ||
    previewSizing.frameOverflowsItem ||
    previewSizing.iframeOverflowsFrame
  ) {
    failures.push({ type: 'assertion', message: 'Preview iframe does not conform to the board item bounds', previewSizing });
  }

  const previewCalls = apiCalls.filter(call => call.method === 'POST' && call.path === '/api/preview/step');
  if (!previewCalls.length) {
    failures.push({ type: 'assertion', message: 'Selecting a step did not call the preview endpoint', apiCalls });
  }

  const mainScreenshot = path.join(args.screenshotDir, 'manage-components-dashboard.png');
  await page.screenshot({ path: mainScreenshot, fullPage: true });

  await browser.close();

  const result = {
    pass: failures.length === 0,
    screenshots: [mainScreenshot],
    initialAssertions,
    layoutAfterReset,
    previewSizing,
    stepListCalls: apiCalls.filter(call => call.path === '/api/steps'),
    stepDetailCalls: apiCalls.filter(call => /^\/api\/steps\/\d+$/.test(call.path)),
    previewCalls: previewCalls.map(call => ({ method: call.method, path: call.path, postData: call.postData })),
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
