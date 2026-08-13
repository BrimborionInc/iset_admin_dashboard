'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const {
  BROWSER_CHILD_RESULT_CONTRACTS,
  BrowserSuiteControlError,
  clickVisibleEnabledButtonByText,
  closeLoopbackServer,
  parseStructuredChildResult,
  processGroupExists,
  runBoundedProcess,
  runWithBrowserPreservation,
  startVerifiedLoopbackServer,
  validateBrowserPreservationPlan,
  verifyLoopbackIdentity,
} = require('../scripts/lib/release-browser-suite-control');
const {
  assertSelectedChildResult,
  parseArgs,
  selectSmokes,
} = require('../scripts/release-browser-smoke-suite');

jest.setTimeout(30_000);

const temporaryRoots = [];

function createTemporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-browser-suite-control-'));
  temporaryRoots.push(root);
  return root;
}

function write(filename, contents) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, contents);
}

function processResult(overrides = {}) {
  return {
    command: process.execPath,
    args: ['synthetic'],
    cwd: __dirname,
    status: 'passed',
    exitCode: 0,
    signal: null,
    durationMs: 1,
    stdout: JSON.stringify({
      pass: true,
      screenshot: '/synthetic/screenshot.png',
      savedPostingContexts: ['internal'],
      finalRecordReadOnlyVerified: true,
      unexpectedFinalPatchCount: 0,
      failures: [],
    }),
    stderr: '',
    stdoutTruncated: false,
    stderrTruncated: false,
    termination: {
      reason: null,
      gracefulSent: false,
      forcedSent: false,
      groupAbsent: true,
      failure: null,
    },
    ...overrides,
  };
}

function nativeProcessResult(nativeResult, { failed = false, ...overrides } = {}) {
  return processResult({
    status: failed ? 'failed' : 'passed',
    exitCode: failed ? 1 : 0,
    stdout: failed ? '' : JSON.stringify(nativeResult),
    stderr: failed ? JSON.stringify(nativeResult) : '',
    ...overrides,
  });
}

function requestWithHost(port, host) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/', headers: { host } }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
  });
}

function isPidActive(pid) {
  let stat;
  try {
    stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ESRCH') return false;
    throw error;
  }
  const commandEnd = stat.lastIndexOf(') ');
  expect(commandEnd).toBeGreaterThanOrEqual(0);
  const state = stat.slice(commandEnd + 2).trim().split(/\s+/)[0];
  return state !== 'Z' && state !== 'X';
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    fs.rmSync(root, { recursive: true, force: true });
    expect(fs.existsSync(root)).toBe(false);
  }
});

describe('selected release browser suite control', () => {
  test('closes the stale React-node check-then-click race inside one browser task', async () => {
    const originalDocument = global.document;
    const originalWindow = global.window;
    let clickCount = 0;
    const createButton = () => ({
      innerText: 'Submit for final decision',
      disabled: false,
      getAttribute: () => null,
      getBoundingClientRect: () => ({ width: 120, height: 32 }),
      scrollIntoView: jest.fn(),
      click: () => { clickCount += 1; },
    });
    let renderedButtons = [createButton()];
    global.document = {
      querySelectorAll: () => renderedButtons,
      querySelector: () => null,
    };
    global.window = {
      getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
    };

    try {
      // This deterministically recreates the retired two-task implementation:
      // the presence check succeeds, then a React render replaces the node
      // before the separate click lookup.
      const legacyPresenceCheck = renderedButtons.some(
        button => button.innerText === 'Submit for final decision' && !button.disabled
      );
      renderedButtons = [];
      const legacySeparateClick = renderedButtons.find(
        button => button.innerText === 'Submit for final decision' && !button.disabled
      );
      expect(legacyPresenceCheck).toBe(true);
      expect(legacySeparateClick).toBeUndefined();

      renderedButtons = [createButton()];
      const page = {
        evaluate: jest.fn(async (browserTask, interaction) => browserTask(interaction)),
      };
      const result = await clickVisibleEnabledButtonByText(page, 'Submit for final decision', {
        pollIntervalMs: 0,
      });

      expect(result).toMatchObject({ clicked: true, attempts: 1 });
      expect(clickCount).toBe(1);
      expect(page.evaluate).toHaveBeenCalledTimes(1);
    } finally {
      if (originalDocument === undefined) delete global.document;
      else global.document = originalDocument;
      if (originalWindow === undefined) delete global.window;
      else global.window = originalWindow;
    }
  });

  test('waits through transient absence and disabled state, then clicks exactly once', async () => {
    const page = {
      evaluate: jest.fn()
        .mockResolvedValueOnce({ clicked: false, scopeFound: false, matchingButtons: [] })
        .mockResolvedValueOnce({
          clicked: false,
          scopeFound: true,
          matchingButtons: [{ index: 0, text: 'Submit for final decision', disabled: true }],
        })
        .mockResolvedValueOnce({
          clicked: true,
          scopeFound: true,
          matchingButtons: [{ index: 0, text: 'Submit for final decision', disabled: false }],
          clickedButton: { index: 0, text: 'Submit for final decision' },
        }),
    };

    const result = await clickVisibleEnabledButtonByText(page, 'Submit for final decision', {
      scopeSelector: '#intervention-assessment-widget',
      pollIntervalMs: 0,
      timeoutMs: 1_000,
    });

    expect(result).toMatchObject({ clicked: true, attempts: 3 });
    expect(page.evaluate).toHaveBeenCalledTimes(3);
    expect(page.evaluate.mock.calls[2][1]).toEqual({
      targetText: 'Submit for final decision',
      exactMatch: true,
      dialogOnly: false,
      scopeSelector: '#intervention-assessment-widget',
      preferLast: false,
    });
  });

  test('does not repeat or reconcile an effectful click', async () => {
    const page = {
      evaluate: jest.fn().mockResolvedValue({
        clicked: true,
        scopeFound: true,
        matchingButtons: [{ index: 1, text: 'Recall submission', disabled: false }],
        clickedButton: { index: 1, text: 'Recall submission' },
      }),
    };

    const result = await clickVisibleEnabledButtonByText(page, 'Recall submission', {
      dialogOnly: true,
      preferLast: true,
      pollIntervalMs: 0,
    });

    expect(result.attempts).toBe(1);
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  test('fails closed with bounded timing and the last DOM observation', async () => {
    const observation = {
      clicked: false,
      scopeFound: true,
      matchingButtons: [{ index: 0, text: 'Commit', disabled: true }],
    };
    const page = { evaluate: jest.fn().mockResolvedValue(observation) };

    await expect(clickVisibleEnabledButtonByText(page, 'Commit', {
      timeoutMs: 0,
      pollIntervalMs: 0,
    })).rejects.toMatchObject({
      code: 'BROWSER_BUTTON_CLICK_TIMEOUT',
      evidence: expect.objectContaining({
        attempts: 1,
        elapsedMs: expect.any(Number),
        startedAt: expect.any(String),
        failedAt: expect.any(String),
        lastObservation: observation,
      }),
    });
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  test('never retries an ambiguous browser evaluation failure', async () => {
    const error = new Error('Execution context was destroyed');
    const page = { evaluate: jest.fn().mockRejectedValue(error) };

    await expect(clickVisibleEnabledButtonByText(page, 'Next')).rejects.toBe(error);
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  test('rejects malformed observations and ambiguous scopes', async () => {
    const page = { evaluate: jest.fn().mockResolvedValue({ clicked: 'yes' }) };
    await expect(clickVisibleEnabledButtonByText(page, 'Next', {
      timeoutMs: 0,
    })).rejects.toMatchObject({ code: 'BROWSER_BUTTON_OBSERVATION_INVALID' });
    await expect(clickVisibleEnabledButtonByText(page, 'Next', {
      dialogOnly: true,
      scopeSelector: '#widget',
    })).rejects.toMatchObject({ code: 'BROWSER_BUTTON_SCOPE_AMBIGUOUS' });
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  test('admits an exact known --only set and rejects missing or unknown IDs', () => {
    const args = parseArgs(['--only', 'intervention-posting-context', '--json']);
    expect(args.json).toBe(true);
    expect(Array.from(args.only)).toEqual(['intervention-posting-context']);
    expect(selectSmokes(args.only)).toEqual([
      ['intervention-posting-context', 'intervention-posting-context-browser-smoke.js'],
    ]);
    expect(Object.keys(BROWSER_CHILD_RESULT_CONTRACTS).sort()).toEqual(
      selectSmokes(null).map(([id]) => id).sort()
    );
    expect(() => parseArgs(['--only'])).toThrow('--only requires');
    expect(() => parseArgs(['--only', 'not-a-check'])).toThrow('Unknown browser smoke IDs');
  });

  test.each([
    {
      label: 'ok success with conditional failure details',
      id: 'app-shell-navigation',
      contract: 'ok-conditional-failures',
      success: { ok: true, apiCallCount: 12 },
      failure: { ok: false, failures: [{ type: 'assertion', message: 'shell failed' }], apiCalls: [] },
    },
    {
      label: 'ok failure with a native exception detail',
      id: 'home-overdue',
      contract: 'ok-conditional-failures-or-error',
      success: { ok: true, apiCallCount: 8 },
      failure: { ok: false, error: 'queue crashed', failures: [], apiCalls: [] },
    },
    {
      label: 'pass success with conditional failure details',
      id: 'case-assignment',
      contract: 'pass-conditional-failures',
      success: { pass: true, screenshots: ['/synthetic/case.png'] },
      failure: { pass: false, failures: [{ type: 'assertion', message: 'case failed' }] },
    },
    {
      label: 'pass failure with a diagnostic exception detail',
      id: 'application-overview',
      contract: 'pass-conditional-failures-or-diagnostic-error',
      success: { pass: true, screenshot: '/synthetic/overview.png' },
      failure: {
        pass: false,
        error: 'overview timed out',
        diagnostic: { screenshot: '/synthetic/failure.png', failures: [], apiCalls: [] },
      },
    },
    {
      label: 'pass summary derived from nested scenarios',
      id: 'application-assessment',
      contract: 'pass-nested-scenarios',
      success: {
        pass: true,
        scenarios: [{ name: 'save', pass: true, failures: [], screenshot: '/synthetic/save.png' }],
      },
      failure: {
        pass: false,
        scenarios: [{
          name: 'save',
          pass: false,
          failures: [{ type: 'scenario', message: 'save failed' }],
          screenshot: '/synthetic/save-failed.png',
        }],
      },
    },
    {
      label: 'pass result with an always-present failure array',
      id: 'intervention-recall',
      contract: 'pass-required-failures',
      success: { pass: true, failures: [], screenshot: '/synthetic/recall.png' },
      failure: { pass: false, failures: [{ type: 'scenario', message: 'recall failed' }] },
    },
  ])('normalizes the admitted $label contract without weakening native failure authority', ({
    id,
    contract,
    success,
    failure,
  }) => {
    const passedProcess = nativeProcessResult(success);
    const passedChild = parseStructuredChildResult(id, passedProcess);
    expect(passedChild).toMatchObject({
      schemaVersion: 1,
      childId: id,
      contract,
      pass: true,
      failures: [],
      nativeResult: success,
    });
    expect(() => assertSelectedChildResult(id, passedProcess, passedChild)).not.toThrow();

    const failedProcess = nativeProcessResult(failure, { failed: true });
    const failedChild = parseStructuredChildResult(id, failedProcess);
    expect(failedChild.pass).toBe(false);
    expect(failedChild.failures.length).toBeGreaterThan(0);
    expect(failedChild.nativeResult).toEqual(failure);
    expect(() => assertSelectedChildResult(id, failedProcess, failedChild)).toThrow(
      expect.objectContaining({
        code: 'BROWSER_CHILD_FAILED',
        evidence: expect.objectContaining({
          id,
          process: expect.objectContaining({ status: 'failed', exitCode: 1 }),
          childResult: expect.objectContaining({ nativeResult: failure }),
        }),
      })
    );
  });

  test('rejects missing, malformed, truncated and unknown child results with attribution', () => {
    expect(() => parseStructuredChildResult(
      'intervention-posting-context',
      processResult({ stdout: '' })
    )).toThrow(expect.objectContaining({
      code: 'BROWSER_CHILD_RESULT_INVALID',
      evidence: expect.objectContaining({ childId: 'intervention-posting-context' }),
    }));
    expect(() => parseStructuredChildResult(
      'intervention-posting-context',
      processResult({ stdout: '{"pass":true}', stdoutTruncated: true })
    )).toThrow(expect.objectContaining({ code: 'BROWSER_CHILD_RESULT_INVALID' }));
    expect(() => parseStructuredChildResult('not-configured', processResult())).toThrow(
      expect.objectContaining({ code: 'BROWSER_CHILD_CONTRACT_UNKNOWN' })
    );
  });

  test.each([
    ['mixed ok/pass flags', 'app-shell-navigation', { ok: true, pass: true }],
    ['success with failures', 'case-assignment', { pass: true, failures: [{ type: 'assertion' }] }],
    ['failure without details', 'case-assignment', { pass: false }],
    ['empty native error detail', 'home-overdue', { ok: false, error: '', failures: [] }],
    ['conflicting diagnostic shapes', 'application-overview', {
      pass: false,
      error: 'timed out',
      diagnostic: { failures: [] },
      failures: [{ type: 'assertion' }],
    }],
    ['scenario summary disagreement', 'application-assessment', {
      pass: true,
      scenarios: [{ name: 'save', pass: false, failures: [{ type: 'scenario' }] }],
    }],
    ['successful scenario with failures', 'intervention-workflow', {
      pass: true,
      scenarios: [{ name: 'review', pass: true, failures: [{ type: 'assertion' }] }],
    }],
  ])('rejects contradictory native evidence: %s', (_label, id, nativeResult) => {
    expect(() => parseStructuredChildResult(id, nativeProcessResult(nativeResult))).toThrow(
      expect.objectContaining({ code: expect.stringMatching(/^BROWSER_CHILD_RESULT_(?:CONFLICT|INVALID)$/) })
    );
  });

  test('rejects disagreement between process status and normalized native authority', () => {
    const process = nativeProcessResult({ pass: true, failures: [] }, { failed: true });
    const child = parseStructuredChildResult('intervention-recall', process);
    expect(() => assertSelectedChildResult('intervention-recall', process, child)).toThrow(
      expect.objectContaining({
        code: 'BROWSER_CHILD_RESULT_CONFLICT',
        evidence: expect.objectContaining({
          id: 'intervention-recall',
          process: expect.objectContaining({ status: 'failed', exitCode: 1 }),
        }),
      })
    );
  });

  test('retains the selected posting-context native semantic guard after normalization', () => {
    const incompleteProcess = nativeProcessResult({ pass: true, failures: [] });
    expect(() =>
      assertSelectedChildResult(
        'intervention-posting-context',
        incompleteProcess,
        parseStructuredChildResult('intervention-posting-context', incompleteProcess)
      )
    ).toThrow(expect.objectContaining({ code: 'BROWSER_CHILD_SEMANTIC_EVIDENCE_INVALID' }));
  });

  test('restores exact generated bytes and removes browser, screenshot and build roots after success and failure', async () => {
    const root = createTemporaryRoot();
    const repoRoot = path.join(root, 'repo');
    const generated = path.join(repoRoot, 'src', 'generated', 'buildInfo.js');
    const suiteRoot = path.join(repoRoot, 'tmp', 'release-qualification', 'browser');
    write(generated, Buffer.from([0, 1, 255]));
    const plan = validateBrowserPreservationPlan({ repoRoot, generatedFiles: [generated], residueRoots: [suiteRoot] });

    const passed = await runWithBrowserPreservation(plan, async () => {
      write(generated, 'changed');
      write(path.join(suiteRoot, 'build', 'asset.js'), 'build');
      write(path.join(suiteRoot, 'screenshots', 'shot.png'), 'shot');
      return 'passed';
    });
    expect(passed.actionResult).toBe('passed');
    expect(passed.evidence.restoration).toBe('passed');
    expect(fs.readFileSync(generated)).toEqual(Buffer.from([0, 1, 255]));
    expect(fs.existsSync(suiteRoot)).toBe(false);

    await expect(runWithBrowserPreservation(plan, async () => {
      write(generated, 'changed-again');
      write(path.join(suiteRoot, 'screenshots', 'failed.png'), 'diagnostic');
      throw new Error('synthetic child failure');
    })).rejects.toThrow('synthetic child failure');
    expect(fs.readFileSync(generated)).toEqual(Buffer.from([0, 1, 255]));
    expect(fs.existsSync(suiteRoot)).toBe(false);
  });

  test('detects an unremovable declared residue boundary', async () => {
    const root = createTemporaryRoot();
    const repoRoot = path.join(root, 'repo');
    const generated = path.join(repoRoot, 'src', 'generated', 'buildInfo.js');
    const residueParent = path.join(repoRoot, 'tmp');
    const residueRoot = path.join(residueParent, 'browser');
    write(generated, 'before');

    await expect(runWithBrowserPreservation(
      { repoRoot, generatedFiles: [generated], residueRoots: [residueRoot] },
      async () => {
        fs.rmSync(residueParent, { recursive: true, force: true });
        write(residueParent, 'blocks-declared-child-cleanup');
      }
    )).rejects.toThrow(expect.objectContaining({ code: 'BROWSER_PRESERVATION_FAILED' }));
  });

  test('proves responder identity, rejects stale identity and wrong host, then proves port release', async () => {
    const root = createTemporaryRoot();
    write(path.join(root, 'index.html'), '<!doctype html><title>synthetic</title>');
    const control = await startVerifiedLoopbackServer({ buildRoot: root, identity: 'attempt:current' });
    expect(control.identityProof).toEqual({ statusCode: 200, identity: 'attempt:current' });
    await expect(verifyLoopbackIdentity(control.baseUrl, 'attempt:stale')).rejects.toThrow(
      expect.objectContaining({ code: 'BROWSER_LOOPBACK_IDENTITY_MISMATCH' })
    );
    await expect(requestWithHost(control.port, 'wrong.invalid')).resolves.toBe(421);
    await expect(closeLoopbackServer(control)).resolves.toEqual({ shutdown: 'passed', portReleased: true });
  });

  test('captures bounded successful and nonzero process results', async () => {
    const passed = await runBoundedProcess(process.execPath, ['-e', "process.stdout.write('ok')"], {
      timeoutMs: 2_000,
    });
    expect(passed).toMatchObject({ status: 'passed', exitCode: 0, stdout: 'ok' });
    expect(passed.termination.groupAbsent).toBe(true);

    const failed = await runBoundedProcess(process.execPath, ['-e', "process.stderr.write('bad');process.exit(7)"], {
      timeoutMs: 2_000,
    });
    expect(failed).toMatchObject({ status: 'failed', exitCode: 7, stderr: 'bad' });
    expect(failed.termination.groupAbsent).toBe(true);
  });

  test('times out and forcibly terminates an owned descendant process tree', async () => {
    const source = [
      "const {spawn}=require('child_process');",
      "const child=spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)\"],{stdio:'ignore'});",
      "console.log(child.pid);",
      "process.on('SIGTERM',()=>{});",
      "setInterval(()=>{},1000);",
    ].join('');
    const result = await runBoundedProcess(process.execPath, ['-e', source], {
      timeoutMs: 200,
      graceMs: 100,
      terminationMs: 2_000,
    });
    const descendantPid = Number(result.stdout.trim());
    expect(result.status).toBe('timed-out');
    expect(result.termination).toMatchObject({
      gracefulSent: true,
      forcedSent: true,
      groupAbsent: true,
      activeProcessIds: [],
      failure: null,
    });
    expect(Number.isInteger(descendantPid)).toBe(true);
    expect(result.termination.ownedProcessIds).toContain(descendantPid);
    expect(isPidActive(descendantPid)).toBe(false);
    expect(processGroupExists(result.termination.processGroupId)).toBe(false);
  });

  test('cancels a bounded process and proves its process group absent', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    const result = await runBoundedProcess(
      process.execPath,
      ['-e', "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000)"],
      { timeoutMs: 5_000, graceMs: 500, terminationMs: 1_000, signal: controller.signal }
    );
    expect(result.status).toBe('cancelled');
    expect(result.termination).toMatchObject({ reason: 'cancelled', gracefulSent: true, groupAbsent: true, failure: null });
  });

  test('keeps the control narrow, shell-free and outside qualification machinery', () => {
    const helperSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'lib', 'release-browser-suite-control.js'), 'utf8');
    const parentSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'release-browser-smoke-suite.js'), 'utf8');
    const combined = `${helperSource}\n${parentSource}`;

    expect(combined).not.toContain("require('../qualification");
    expect(combined).not.toContain("require('../../qualification");
    expect(combined).not.toContain('shell: true');
    expect(parentSource).toContain("['intervention-posting-context', 'intervention-posting-context-browser-smoke.js']");
    expect(parentSource).toContain("'--screenshot-dir'");
    expect(parentSource).toContain("timeoutMs: 180_000");
    expect(parentSource).toContain("externalProxyPolicy: 'deny-via-unreachable-loopback-proxy'");
  });
});
