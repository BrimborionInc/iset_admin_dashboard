#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  BrowserSuiteControlError,
  closeLoopbackServer,
  parseStructuredChildResult,
  resolveBrowserRuntimeIdentity,
  runBoundedProcess,
  runWithBrowserPreservation,
  sha256Bytes,
  startVerifiedLoopbackServer,
} = require('./lib/release-browser-suite-control');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUITE_ROOT = path.join(REPO_ROOT, 'tmp', 'release-qualification', 'admin-browser-suite');
const BUILD_PATH = path.join(SUITE_ROOT, 'build');
const SCREENSHOT_ROOT = path.join(SUITE_ROOT, 'screenshots');
const BUILD_INFO_PATH = path.join(REPO_ROOT, 'src', 'generated', 'buildInfo.js');
const RELEASE_NOTES_PATH = path.join(REPO_ROOT, 'src', 'generated', 'publicReleaseNotes.js');

const SMOKES = Object.freeze([
  ['app-shell-navigation', 'app-shell-navigation-browser-smoke.js'],
  ['esdc-participants', 'esdc-participant-queue-browser-smoke.js'],
  ['case-assignment', 'case-assignment-dashboard-browser-smoke.js'],
  ['home-overdue', 'home-overdue-queue-browser-smoke.js'],
  ['manual-intake', 'manual-application-intake-browser-smoke.js'],
  ['manage-components', 'manage-components-dashboard-browser-smoke.js'],
  ['modify-component', 'modify-component-editor-browser-smoke.js'],
  ['application-overview', 'application-overview-docs-requested-browser-smoke.js'],
  ['application-workspace', 'application-workspace-dashboard-browser-smoke.js'],
  ['application-assessment', 'application-assessment-workflow-browser-smoke.js'],
  ['intervention-posting-context', 'intervention-posting-context-browser-smoke.js'],
  ['intervention-recall', 'intervention-assessment-recall-browser-smoke.js'],
  ['intervention-workflow', 'intervention-assessment-workflow-browser-smoke.js'],
]);

function parseArgs(argv) {
  const args = { json: false, only: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') args.json = true;
    else if (token === '--only') {
      const value = argv[++index];
      if (!value) throw new Error('--only requires one or more browser smoke IDs');
      args.only = new Set(String(value).split(',').map(item => item.trim()).filter(Boolean));
      if (args.only.size === 0) throw new Error('--only requires one or more browser smoke IDs');
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else throw new Error(`Unknown option: ${token}`);
  }
  if (args.only) {
    const known = new Set(SMOKES.map(([id]) => id));
    const unknown = Array.from(args.only).filter(id => !known.has(id));
    if (unknown.length) throw new Error(`Unknown browser smoke IDs: ${unknown.join(', ')}`);
  }
  return args;
}

function selectSmokes(only) {
  const selected = SMOKES.filter(([id]) => !only || only.has(id));
  if (selected.length === 0) throw new Error('No browser smokes selected');
  return selected;
}

function summarizeProcess(result) {
  return Object.freeze({
    command: result.command,
    args: result.args,
    cwd: result.cwd,
    status: result.status,
    exitCode: result.exitCode,
    signal: result.signal,
    durationMs: result.durationMs,
    stdoutSha256: sha256Bytes(result.stdout),
    stderrSha256: sha256Bytes(result.stderr),
    stdoutBytes: Buffer.byteLength(result.stdout),
    stderrBytes: Buffer.byteLength(result.stderr),
    stdoutTruncated: result.stdoutTruncated,
    stderrTruncated: result.stderrTruncated,
    termination: result.termination,
  });
}

function serializeFailure(error) {
  return {
    code: error?.code ? String(error.code) : null,
    message: error?.message ? error.message : String(error),
    evidence: error?.evidence || null,
  };
}

function assertSelectedChildResult(id, processResult, childResult) {
  const processPassed = processResult.status === 'passed' && processResult.exitCode === 0;
  if (processPassed !== childResult.pass) {
    throw new BrowserSuiteControlError('BROWSER_CHILD_RESULT_CONFLICT', `browser child ${id} process and native result disagree`, {
      id,
      process: summarizeProcess(processResult),
      childResult,
    });
  }
  if (!childResult.pass) {
    throw new BrowserSuiteControlError('BROWSER_CHILD_FAILED', `browser child ${id} failed`, {
      id,
      process: summarizeProcess(processResult),
      childResult,
    });
  }
  const nativeResult = childResult.nativeResult;
  if (
    id === 'intervention-posting-context' &&
    (
      nativeResult.finalRecordReadOnlyVerified !== true ||
      nativeResult.unexpectedFinalPatchCount !== 0 ||
      nativeResult.savedPostingContexts?.length !== 1 ||
      nativeResult.savedPostingContexts[0] !== 'internal' ||
      childResult.failures.length !== 0
    )
  ) {
    throw new BrowserSuiteControlError('BROWSER_CHILD_SEMANTIC_EVIDENCE_INVALID', 'posting-context child evidence is incomplete', {
      id,
      childResult,
    });
  }
}

async function captureScreenshotEvidence(id, childResult) {
  const expectedRoot = path.join(SCREENSHOT_ROOT, id);
  const expectedFile = path.join(expectedRoot, 'intervention-posting-context.png');
  if (id !== 'intervention-posting-context') return null;
  const observedFile = childResult.nativeResult.screenshot || '';
  if (path.normalize(observedFile) !== expectedFile || !fs.existsSync(expectedFile)) {
    throw new BrowserSuiteControlError('BROWSER_SCREENSHOT_MISSING', 'selected child screenshot is missing or outside its declared root', {
      id,
      expectedFile,
      observedFile: observedFile || null,
    });
  }
  const bytes = fs.readFileSync(expectedFile);
  return Object.freeze({ path: expectedFile, bytes: bytes.length, sha256: sha256Bytes(bytes) });
}

async function runSuite(args) {
  const selected = selectSmokes(args.only);
  const suiteIdentity = `browser-suite:${crypto.randomUUID()}`;
  const plan = {
    repoRoot: REPO_ROOT,
    generatedFiles: [BUILD_INFO_PATH, RELEASE_NOTES_PATH],
    residueRoots: [SUITE_ROOT],
  };
  const preserved = await runWithBrowserPreservation(plan, async () => {
    const browserRuntime = await resolveBrowserRuntimeIdentity(REPO_ROOT);
    const build = await runBoundedProcess('npm', ['run', 'build:test'], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        BUILD_PATH,
        PATH_DEPLOY_ENV: 'test',
        PATH_RELEASE_ID: 'local-release-qualification',
      },
      timeoutMs: 600_000,
      graceMs: 3_000,
      terminationMs: 5_000,
    });
    if (build.status !== 'passed' || build.exitCode !== 0) {
      throw new BrowserSuiteControlError('BROWSER_BUILD_FAILED', 'admin browser build failed', {
        build: summarizeProcess(build),
      });
    }

    let loopback = null;
    let loopbackShutdown = null;
    const results = [];
    try {
      loopback = await startVerifiedLoopbackServer({ buildRoot: BUILD_PATH, identity: suiteIdentity });
      for (const [id, filename] of selected) {
        const screenshotDir = path.join(SCREENSHOT_ROOT, id);
        const processResult = await runBoundedProcess(
          process.execPath,
          [
            path.join(REPO_ROOT, 'scripts', filename),
            '--frontend-base',
            loopback.baseUrl,
            '--screenshot-dir',
            screenshotDir,
          ],
          {
            cwd: REPO_ROOT,
            env: {
              ...process.env,
              PUPPETEER_EXECUTABLE_PATH: browserRuntime.executable,
              NO_PROXY: '127.0.0.1,localhost',
              no_proxy: '127.0.0.1,localhost',
              HTTP_PROXY: 'http://127.0.0.1:9',
              HTTPS_PROXY: 'http://127.0.0.1:9',
              ALL_PROXY: 'http://127.0.0.1:9',
            },
            timeoutMs: 180_000,
            graceMs: 2_000,
            terminationMs: 5_000,
          }
        );
        const childResult = parseStructuredChildResult(id, processResult);
        assertSelectedChildResult(id, processResult, childResult);
        results.push(Object.freeze({
          id,
          filename,
          status: 'passed',
          process: summarizeProcess(processResult),
          childResult,
          screenshot: await captureScreenshotEvidence(id, childResult),
        }));
      }
    } finally {
      if (loopback) loopbackShutdown = await closeLoopbackServer(loopback);
    }
    const observedRequests = loopback.requests.map(request => ({ ...request }));
    const loopbackOnly = observedRequests.every(request =>
      ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.remoteAddress) &&
      request.host === `127.0.0.1:${loopback.port}`
    );
    if (!loopbackOnly || !loopbackShutdown?.portReleased) {
      throw new BrowserSuiteControlError('BROWSER_LOOPBACK_PROOF_FAILED', 'loopback request or socket-release proof failed', {
        observedRequests,
        loopbackShutdown,
      });
    }
    return Object.freeze({
      schemaVersion: 2,
      status: 'passed',
      suiteIdentity,
      selected: selected.map(([id]) => id),
      build: summarizeProcess(build),
      browserRuntime,
      network: Object.freeze({
        admittedOrigin: loopback.baseUrl,
        identityProof: loopback.identityProof,
        externalProxyPolicy: 'deny-via-unreachable-loopback-proxy',
        loopbackOnly,
        observedRequests,
      }),
      loopbackShutdown,
      checks: results,
    });
  });
  return Object.freeze({
    ...preserved.actionResult,
    preservation: preserved.evidence,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log([
      'Usage: node scripts/release-browser-smoke-suite.js [options]',
      '',
      'Builds the current admin frontend once, serves it on a verified loopback port,',
      'runs the selected deterministic browser workflow smokes, and tears it down.',
      '',
      'Options:',
      `  --only IDS    Comma-separated subset: ${SMOKES.map(([id]) => id).join(', ')}`,
      '  --json        Emit JSON summary.',
    ].join('\n'));
    return;
  }
  const summary = await runSuite(args);
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else console.log(`Release browser suite: PASS (${summary.checks.length}/${summary.selected.length})`);
}

if (require.main === module) {
  main().catch(error => {
    const summary = { schemaVersion: 2, status: 'failed', failure: serializeFailure(error) };
    if (process.argv.includes('--json')) console.error(JSON.stringify(summary, null, 2));
    else console.error(`Release browser suite: FAIL (${error.message || error})`);
    process.exitCode = 1;
  });
}

module.exports = {
  BUILD_PATH,
  REPO_ROOT,
  SCREENSHOT_ROOT,
  SMOKES,
  SUITE_ROOT,
  assertSelectedChildResult,
  parseArgs,
  runSuite,
  selectSmokes,
  summarizeProcess,
};
