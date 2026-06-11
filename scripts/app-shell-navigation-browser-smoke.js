#!/usr/bin/env node
/*
 * DEV browser smoke for the global Cloudscape AppLayout side navigation.
 *
 * The close control can look correct while still being covered by the
 * SideNavigation header. This smoke uses pointer clicks and elementFromPoint
 * so it catches hit-target layering regressions, not only React state wiring.
 */

const fs = require('fs');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';
const CONSOLE_SNIPPET_LIMIT = 1500;

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.APP_SHELL_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--frontend-base') {
      args.frontendBase = argv[index + 1] || args.frontendBase;
      index += 1;
    } else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/app-shell-navigation-browser-smoke.js [options]',
        '',
        'Options:',
        '  --frontend-base URL     React app origin. Default: http://localhost:3001',
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

async function visibleNavButtonPoint(page, label) {
  return page.evaluate((expectedLabel) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find(candidate => {
      const text = `${candidate.getAttribute('aria-label') || ''} ${candidate.title || ''}`;
      const rect = candidate.getBoundingClientRect();
      return text.includes(expectedLabel) && rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0;
    });
    if (!button) return null;

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const topTarget = document.elementFromPoint(x, y);
    const hitButton = topTarget?.closest?.('button') || null;
    return {
      x,
      y,
      buttonLabel: button.getAttribute('aria-label') || button.title || button.textContent.trim(),
      hitLabel: hitButton ? (hitButton.getAttribute('aria-label') || hitButton.title || hitButton.textContent.trim()) : null,
      hitTag: topTarget?.tagName || null,
      hitClass: String(topTarget?.className || '').slice(0, 160),
    };
  }, label);
}

async function navigationState(page) {
  return page.evaluate(() => {
    const nav = Array.from(document.querySelectorAll('nav'))
      .find(candidate => (candidate.textContent || '').includes('Homepage'));
    const navRect = nav?.getBoundingClientRect();
    const visibleHomepage = Array.from(document.querySelectorAll('*'))
      .some(element => (element.textContent || '').trim() === 'Homepage' && element.getBoundingClientRect().width > 0);
    return {
      navVisible: Boolean(navRect && navRect.width > 0 && navRect.height > 0),
      navRect: navRect ? { x: navRect.x, y: navRect.y, width: navRect.width, height: navRect.height } : null,
      visibleHomepage,
    };
  });
}

async function verifyRoute(page, frontendBase, route, failures) {
  await page.goto(`${frontendBase}${route}`, { waitUntil: 'domcontentloaded' });
  await waitForBodyText(page, 'Homepage');
  await delay(1000);

  const closePoint = await visibleNavButtonPoint(page, 'Close side navigation');
  if (!closePoint) {
    failures.push({ type: 'assertion', route, message: 'Close side navigation button was not visible' });
    return;
  }
  if (closePoint.hitLabel !== 'Close side navigation') {
    failures.push({
      type: 'assertion',
      route,
      message: 'Close side navigation button was not the pointer hit target',
      closePoint,
    });
    return;
  }

  await page.mouse.click(closePoint.x, closePoint.y);
  await delay(600);
  const collapsed = await navigationState(page);
  if (collapsed.navVisible || collapsed.visibleHomepage) {
    failures.push({
      type: 'assertion',
      route,
      message: 'Side navigation did not collapse after pointer-clicking the close control',
      collapsed,
    });
    return;
  }

  const openPoint = await visibleNavButtonPoint(page, 'Open side navigation');
  if (!openPoint) {
    failures.push({ type: 'assertion', route, message: 'Open side navigation button was not visible after collapse' });
    return;
  }
  if (openPoint.hitLabel !== 'Open side navigation') {
    failures.push({
      type: 'assertion',
      route,
      message: 'Open side navigation button was not the pointer hit target',
      openPoint,
    });
    return;
  }

  await page.mouse.click(openPoint.x, openPoint.y);
  await delay(600);
  const reopened = await navigationState(page);
  if (!reopened.navVisible || !reopened.visibleHomepage) {
    failures.push({
      type: 'assertion',
      route,
      message: 'Side navigation did not reopen after pointer-clicking the open control',
      reopened,
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
  const failures = [];
  const apiCalls = [];

  try {
    const routes = ['/', '/manage-components', '/application-case/1?applicationId=2'];
    for (const route of routes) {
      const page = await browser.newPage();
      page.setDefaultTimeout(45000);
      await page.setViewport({ width: 1360, height: 860, deviceScaleFactor: 1 });

      page.on('pageerror', error => failures.push({ type: 'pageerror', route, message: error.message }));
      page.on('console', message => {
        const text = message.text();
        if (/ReferenceError|TypeError|Unhandled|Failed to load|failed with status|CORS|ERR_FAILED|Unauthorized|Cannot update a component|Encountered two children with the same key/i.test(text)) {
          failures.push({ type: 'console', route, level: message.type(), text: text.slice(0, CONSOLE_SNIPPET_LIMIT) });
        }
      });
      page.on('requestfailed', request => {
        const url = request.url();
        if (url.includes('/api/')) {
          failures.push({
            type: 'requestfailed',
            route,
            method: request.method(),
            url,
            failure: request.failure()?.errorText || null,
          });
        }
      });
      page.on('response', response => {
        const url = response.url();
        if (url.includes('/api/') && response.status() >= 400) {
          failures.push({ type: 'api', route, status: response.status(), url });
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
      }, session, args.frontendBase);

      await verifyRoute(page, args.frontendBase, route, failures);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error(JSON.stringify({ ok: false, failures, apiCalls }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    routes: ['/', '/manage-components', '/application-case/1?applicationId=2'],
    apiCallCount: apiCalls.length,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
