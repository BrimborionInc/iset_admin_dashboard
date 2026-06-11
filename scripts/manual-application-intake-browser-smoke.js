#!/usr/bin/env node
/*
 * DEV browser smoke for Manual Application Intake.
 *
 * This focuses on the staff-assisted intake wrapper: source capture,
 * applicant/account match search, account-handling decision, and the manual
 * intake POST payload. The published intake schema is stubbed to a minimal
 * required identity step so the smoke stays fast and deterministic.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'manual-intake-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';
const CONSOLE_SNIPPET_LIMIT = 1500;

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.MANUAL_INTAKE_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.MANUAL_INTAKE_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
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
        'Usage: node scripts/manual-application-intake-browser-smoke.js [options]',
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

const intakeSchema = {
  version: 'manual-intake-smoke-v1',
  workflowId: 'manual-intake-smoke',
  steps: [
    {
      stepId: 'identity',
      title: { en: 'Applicant Identity' },
      components: [
        {
          id: 'first-name',
          type: 'input',
          storageKey: 'first-name',
          label: { en: 'First name' },
          required: true,
        },
        {
          id: 'last-name',
          type: 'input',
          storageKey: 'last-name',
          label: { en: 'Last name' },
          required: true,
        },
        {
          id: 'contact-email-address',
          type: 'input',
          inputType: 'email',
          storageKey: 'contact-email-address',
          label: { en: 'Email address' },
          required: true,
        },
      ],
    },
  ],
};

const applicantMatches = [
  {
    clientId: 51,
    userId: 91,
    caseId: 71,
    caseNumber: 'CASE-2026-0000071',
    applicantName: 'Jacqueline Sillery',
    email: 'jac@sillery.co.uk',
    accountStatus: 'activated',
    accountStatusLabel: 'Activated',
    accountEmail: 'jac@sillery.co.uk',
    invitedAt: '2026-05-10T12:00:00.000Z',
    activatedAt: '2026-05-11T12:00:00.000Z',
    regionCode: 'QC',
    caseManagerName: 'Quebec Coordinator',
  },
  {
    clientId: 52,
    userId: null,
    caseId: 72,
    caseNumber: 'CASE-2026-0000072',
    applicantName: 'Janet Similar',
    email: 'janet@example.invalid',
    accountStatus: 'no_account',
    accountStatusLabel: 'No account',
    accountEmail: null,
    regionCode: 'ON',
    caseManagerName: 'Ontario Coordinator',
  },
];

async function installApiStubs(page, state) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      request.continue();
      return;
    }

    state.apiCalls.push({
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

    if (pathname === '/api/workflows/published/intake-schema') {
      request.respond(jsonResponse(intakeSchema));
      return;
    }

    if (pathname === '/api/admin/applicants') {
      request.respond(jsonResponse({
        source: 'client+cases',
        users: applicantMatches,
        total: applicantMatches.length,
        page: 1,
        pageSize: 8,
      }));
      return;
    }

    if (pathname === '/api/applications/manual-intake' && request.method() === 'POST') {
      state.submissionPayload = JSON.parse(request.postData() || '{}');
      request.respond(jsonResponse({
        message: 'manual_application_attached_to_existing_case',
        case_id: 71,
        application_id: 7001,
        submission_id: 9001,
        tracking_id: 'MI-SMOKE-0001',
        reused_case: true,
        selected_client_id: 51,
        account_decision: state.submissionPayload?.accountDecision?.strategy || null,
        applicant_account: applicantMatches[0],
      }, 201));
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

    request.respond(jsonResponse({ items: [], rows: [], applications: [], total: 0, count: 0 }));
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBodyText(page, text, timeoutMs = 10000) {
  await page.waitForFunction(
    expected => (document.body?.innerText || '').includes(expected),
    { timeout: timeoutMs },
    text
  );
}

async function clickButtonByText(page, text) {
  return page.evaluate((label) => {
    const buttons = Array.from(document.querySelectorAll('button'))
      .filter(candidate => {
        const rect = candidate.getBoundingClientRect();
        return !candidate.disabled &&
          rect.width > 0 &&
          rect.height > 0 &&
          candidate.textContent.trim().includes(label);
      });
    const button = buttons[buttons.length - 1];
    if (!button) return false;
    button.click();
    return true;
  }, text);
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
  await page.setViewport({ width: 1360, height: 900, deviceScaleFactor: 1 });

  const failures = [];
  const state = { apiCalls: [], submissionPayload: null };
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

  await installApiStubs(page, state);
  const session = {
    idToken: fakeJwt(),
    accessToken: fakeJwt(),
    refreshToken: null,
    expiresAt: Math.floor(Date.now() / 1000) + 3300,
  };
  await page.evaluateOnNewDocument((authSession, frontendBase) => {
    window.__API_BASE__ = frontendBase;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
    localStorage.removeItem('manual-intake-dashboard-layout-v1');
    localStorage.removeItem('manual-intake-dashboard-layout-v2');
    localStorage.removeItem('manual-intake-dashboard-layout-v3');
    localStorage.removeItem('manual-intake-dashboard-layout-v4');
    localStorage.removeItem('manual-intake-dashboard-layout-v5');
    localStorage.removeItem('manual-intake-dashboard-layout-v6');
    localStorage.removeItem('manual-intake-dashboard-layout-v7');
    localStorage.removeItem('manual-intake-dashboard-layout-v8');
    localStorage.removeItem('manual-intake-dashboard-layout-v9');
    localStorage.removeItem('manual-intake-dashboard-layout-v10');
    localStorage.removeItem('manual-intake-dashboard-layout-v11');
    localStorage.removeItem('manual-intake-dashboard-layout-v12');
    sessionStorage.removeItem('manual-application-intake-runtime.v2');
  }, session, args.frontendBase);

  try {
    await page.goto(`${args.frontendBase}/iset/applications/intake`, { waitUntil: 'domcontentloaded' });
    await waitForBodyText(page, 'Staff-Assisted Intake Flow');
    await waitForBodyText(page, 'Staff-Assisted Intake Wizard');
    await waitForBodyText(page, 'Identity & source');

    const initialAssertions = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return {
        hasFlowWidget: text.includes('Staff-Assisted Intake Flow'),
        hasIdentityStep: text.includes('Identity'),
        hasAccountHandlingStep: text.includes('Account Handling'),
        hasWizardWidget: text.includes('Staff-Assisted Intake Wizard'),
        hasWizardStep: text.includes('Identity & source'),
        hasSourceControl: text.includes('Intake source'),
        hasOldAccountWidget: text.includes('Applicant Identity & PATH Account'),
        hasVisibleCancelAction: Array.from(document.querySelectorAll('button'))
          .some(button => button.textContent.trim() === 'Cancel' && button.offsetParent !== null),
      };
    });
    if (
      !initialAssertions.hasFlowWidget ||
      !initialAssertions.hasIdentityStep ||
      !initialAssertions.hasAccountHandlingStep ||
      !initialAssertions.hasWizardWidget ||
      !initialAssertions.hasWizardStep ||
      !initialAssertions.hasSourceControl ||
      initialAssertions.hasOldAccountWidget ||
      initialAssertions.hasVisibleCancelAction
    ) {
      failures.push({ type: 'assertion', message: 'Manual intake dashboard did not render expected wizard controls', initialAssertions });
    }

    await page.type('#first-name', 'Jacqueline');
    await page.type('#last-name', 'Sillery');
    await page.type('#contact-email-address', 'jac@sillery.co.uk');
    await clickButtonByText(page, 'Next');
    const searchStepVisible = await page.waitForSelector('input[placeholder="Email, name, case number, or region"]', { timeout: 10000 })
      .then(() => true)
      .catch(async () => {
      const debug = await page.evaluate(() => ({
        text: (document.body?.innerText || '').slice(0, 2500),
        inputs: Array.from(document.querySelectorAll('input')).map(input => ({
          id: input.id,
          value: input.value,
          placeholder: input.placeholder,
        })),
        buttons: Array.from(document.querySelectorAll('button')).map(button => ({
          text: button.textContent.trim(),
          disabled: button.disabled,
        })).slice(-12),
      }));
      failures.push({ type: 'assertion', message: 'Wizard did not advance from identity to account search', debug });
      return false;
    });
    if (!searchStepVisible) {
      throw new Error(JSON.stringify({ failures }, null, 2));
    }

    await page.type('input[placeholder="Email, name, case number, or region"]', 'Jacqueline');
    await clickButtonByText(page, 'Search');
    await waitForBodyText(page, 'Jacqueline Sillery');
    const matchSelectionPoint = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('tr'))
        .find(candidate => (candidate.textContent || '').includes('Jacqueline Sillery'));
      row?.scrollIntoView({ block: 'center', inline: 'nearest' });
      const control = row?.querySelector('input[type="radio"], input[type="checkbox"]') ||
        row?.querySelector('[role="radio"], [role="checkbox"]');
      const rect = control?.getBoundingClientRect();
      return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    });
    if (!matchSelectionPoint) {
      failures.push({ type: 'assertion', message: 'Could not find the applicant match selection control' });
    } else {
      await page.mouse.click(matchSelectionPoint.x, matchSelectionPoint.y);
    }
    await waitForBodyText(page, 'Clear selected match');
    await waitForBodyText(page, 'Match selected');
    await waitForBodyText(page, 'Linked');

    await clickButtonByText(page, 'Next');
    await waitForBodyText(page, 'Account handling plan');
    await clickButtonByText(page, 'Next');
    await waitForBodyText(page, 'Applicant Identity');
    await clickButtonByText(page, 'Next');
    await waitForBodyText(page, 'Review & submit');

    const flowAfterIdentity = await page.evaluate(() => {
      const text = document.body?.innerText || '';
      return {
        capturedIdentity: text.includes('Name and email are ready.'),
        finalStep: text.includes('Final step'),
        submitCheckpoint: text.includes('Submit & Follow Up') && text.includes('Create the application;'),
        hasReviewSummary: text.includes('Existing client/account') && text.includes('Use existing client'),
      };
    });
    if (!flowAfterIdentity.capturedIdentity || !flowAfterIdentity.finalStep || !flowAfterIdentity.submitCheckpoint || !flowAfterIdentity.hasReviewSummary) {
      failures.push({ type: 'assertion', message: 'Manual intake wizard/flow did not reflect entered identity and review state', flowAfterIdentity });
    }

    await page.screenshot({ path: path.join(args.screenshotDir, 'manual-application-intake.png'), fullPage: true });
    await clickButtonByText(page, 'Create application');
    await delay(800);

    if (!state.submissionPayload) {
      failures.push({ type: 'assertion', message: 'Manual intake submission was not posted' });
    } else {
      const posted = state.submissionPayload;
      if (posted.accountDecision?.strategy !== 'link_selected_client' || Number(posted.accountDecision?.selectedClientId) !== 51) {
        failures.push({ type: 'assertion', message: 'Posted account decision did not carry selected-client linkage', postedAccountDecision: posted.accountDecision });
      }
      if (posted.intakePayload?.['first-name'] !== 'Jacqueline' || posted.intakePayload?.['contact-email-address'] !== 'jac@sillery.co.uk') {
        failures.push({ type: 'assertion', message: 'Posted intake payload did not include entered identity fields', postedIntakePayload: posted.intakePayload });
      }
    }

    const schemaCalls = state.apiCalls.filter(call => call.path === '/api/workflows/published/intake-schema').length;
    const applicantSearchCalls = state.apiCalls.filter(call => call.path === '/api/admin/applicants').length;
    if (schemaCalls !== 1 || applicantSearchCalls !== 1) {
      failures.push({ type: 'assertion', message: 'Unexpected request counts for manual intake smoke', schemaCalls, applicantSearchCalls, apiCalls: state.apiCalls });
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error(JSON.stringify({ ok: false, failures, apiCalls: state.apiCalls }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    screenshot: path.join(args.screenshotDir, 'manual-application-intake.png'),
    apiCallCount: state.apiCalls.length,
    accountDecision: state.submissionPayload?.accountDecision || null,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
