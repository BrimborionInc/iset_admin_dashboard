'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

class BrowserSuiteControlError extends Error {
  constructor(code, message, evidence = {}) {
    super(message);
    this.name = 'BrowserSuiteControlError';
    this.code = code;
    this.evidence = evidence;
  }
}

function fail(code, message, evidence) {
  throw new BrowserSuiteControlError(code, message, evidence);
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function validateBrowserPreservationPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    fail('BROWSER_PRESERVATION_PLAN_INVALID', 'browser preservation plan must be an object');
  }
  const repoRoot = path.normalize(plan.repoRoot || '');
  const generatedFiles = Array.isArray(plan.generatedFiles) ? plan.generatedFiles.map(path.normalize) : [];
  const residueRoots = Array.isArray(plan.residueRoots) ? plan.residueRoots.map(path.normalize) : [];
  if (!path.isAbsolute(repoRoot) || generatedFiles.length === 0 || residueRoots.length === 0) {
    fail('BROWSER_PRESERVATION_DECLARATION_MISSING', 'repoRoot, generatedFiles and residueRoots are required');
  }
  const declared = [...generatedFiles, ...residueRoots];
  if (declared.some(candidate => !path.isAbsolute(candidate) || !isWithin(repoRoot, candidate))) {
    fail('BROWSER_PRESERVATION_PATH_ESCAPE', 'every declared path must be an absolute repository descendant');
  }
  if (new Set(declared).size !== declared.length) {
    fail('BROWSER_PRESERVATION_PATH_DUPLICATE', 'browser preservation paths must be unique');
  }
  if (generatedFiles.some(file => residueRoots.some(root => file === root || isWithin(root, file)))) {
    fail('BROWSER_PRESERVATION_PATH_OVERLAP', 'generated files cannot belong to residue roots');
  }
  return Object.freeze({
    repoRoot,
    generatedFiles: Object.freeze(generatedFiles),
    residueRoots: Object.freeze(residueRoots),
  });
}

function snapshotFile(filename) {
  if (!fs.existsSync(filename)) return Object.freeze({ path: filename, state: 'absent' });
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('BROWSER_GENERATED_TYPE_INVALID', 'generated path must be absent or a regular file', { path: filename });
  }
  return Object.freeze({ path: filename, state: 'present', bytes: fs.readFileSync(filename) });
}

function restoreFile(snapshot) {
  fs.rmSync(snapshot.path, { recursive: true, force: true });
  if (snapshot.state === 'present') {
    fs.mkdirSync(path.dirname(snapshot.path), { recursive: true });
    fs.writeFileSync(snapshot.path, snapshot.bytes);
  }
}

function snapshotMatches(snapshot) {
  if (snapshot.state === 'absent') return !fs.existsSync(snapshot.path);
  return fs.existsSync(snapshot.path) && fs.readFileSync(snapshot.path).equals(snapshot.bytes);
}

async function runWithBrowserPreservation(plan, action) {
  const validated = validateBrowserPreservationPlan(plan);
  if (typeof action !== 'function') fail('BROWSER_PRESERVATION_ACTION_INVALID', 'preserved action must be a function');
  const snapshots = validated.generatedFiles.map(snapshotFile);
  let actionResult;
  let actionFailure = null;
  try {
    for (const root of validated.residueRoots) fs.rmSync(root, { recursive: true, force: true });
    actionResult = await action(Object.freeze({
      generatedFiles: validated.generatedFiles,
      residueRoots: validated.residueRoots,
    }));
  } catch (error) {
    actionFailure = error;
  }

  const restorationFailures = [];
  for (const root of validated.residueRoots) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch (error) {
      restorationFailures.push({ phase: 'residue-cleanup', path: root, message: error.message || String(error) });
    }
  }
  for (const snapshot of snapshots) {
    try {
      restoreFile(snapshot);
    } catch (error) {
      restorationFailures.push({ phase: 'generated-restore', path: snapshot.path, message: error.message || String(error) });
    }
  }
  for (const root of validated.residueRoots) {
    if (fs.existsSync(root)) restorationFailures.push({ phase: 'residue-proof', path: root, message: 'path remains' });
  }
  for (const snapshot of snapshots) {
    if (!snapshotMatches(snapshot)) {
      restorationFailures.push({ phase: 'generated-proof', path: snapshot.path, message: 'bytes or absence differ' });
    }
  }
  if (restorationFailures.length > 0) {
    fail('BROWSER_PRESERVATION_FAILED', 'browser preservation cleanup or restoration failed', {
      actionFailure: actionFailure ? { message: actionFailure.message || String(actionFailure) } : null,
      failures: restorationFailures,
    });
  }
  if (actionFailure) throw actionFailure;
  return Object.freeze({
    actionResult,
    evidence: Object.freeze({
      restoration: 'passed',
      generatedFiles: [...validated.generatedFiles],
      residueRoots: [...validated.residueRoots],
    }),
  });
}

function appendBounded(chunks, state, chunk, limitBytes) {
  const bytes = Buffer.from(chunk);
  const available = Math.max(0, limitBytes - state.bytes);
  if (available > 0) chunks.push(bytes.subarray(0, available));
  state.bytes += bytes.length;
  if (state.bytes > limitBytes) state.truncated = true;
}

function processGroupExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(process.platform === 'win32' ? pid : -pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

function readLinuxProcessRecord(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  let stat;
  try {
    stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ESRCH') return null;
    throw error;
  }
  const commandEnd = stat.lastIndexOf(') ');
  if (commandEnd < 0) fail('BROWSER_PROCESS_PROBE_INVALID', 'Linux process stat record is malformed', { pid });
  const fields = stat.slice(commandEnd + 2).trim().split(/\s+/);
  const processGroupId = Number(fields[2]);
  const startTime = fields[19];
  if (!Number.isInteger(processGroupId) || !startTime) {
    fail('BROWSER_PROCESS_PROBE_INVALID', 'Linux process identity fields are malformed', { pid });
  }
  return Object.freeze({
    pid,
    state: fields[0],
    parentPid: Number(fields[1]),
    processGroupId,
    startTime,
  });
}

function processRecordIsActive(record) {
  return Boolean(record && record.state !== 'Z' && record.state !== 'X');
}

function snapshotProcessGroup(processGroupId) {
  if (process.platform !== 'linux') {
    fail('BROWSER_PROCESS_PLATFORM_UNSUPPORTED', 'browser process ownership is certified only on Linux');
  }
  return fs.readdirSync('/proc', { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map(entry => readLinuxProcessRecord(Number(entry.name)))
    .filter(record => record && record.processGroupId === processGroupId)
    .sort((left, right) => left.pid - right.pid);
}

function activeOwnedProcesses(ownedProcesses) {
  return ownedProcesses.filter(identity => {
    const observed = readLinuxProcessRecord(identity.pid);
    return observed && observed.startTime === identity.startTime && processRecordIsActive(observed);
  });
}

function signalProcessGroup(pid, signal) {
  process.kill(process.platform === 'win32' ? pid : -pid, signal);
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForProcessGroupAbsence(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (!processGroupExists(pid)) return true;
    await delay(25);
  }
  return !processGroupExists(pid);
}

async function waitForOwnedProcessAbsence(ownedProcesses, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const active = activeOwnedProcesses(ownedProcesses);
    if (active.length === 0) return [];
    await delay(25);
  }
  return activeOwnedProcesses(ownedProcesses);
}

function waitForStreamCompletion(stream) {
  if (stream.destroyed || stream.readableEnded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const completed = () => {
      stream.off('error', failed);
      resolve();
    };
    const failed = error => {
      stream.off('end', completed);
      stream.off('close', completed);
      reject(error);
    };
    stream.once('end', completed);
    stream.once('close', completed);
    stream.once('error', failed);
  });
}

async function runBoundedProcess(command, args, options = {}) {
  if (typeof command !== 'string' || !Array.isArray(args) || args.some(value => typeof value !== 'string')) {
    fail('BROWSER_PROCESS_DECLARATION_INVALID', 'command and argv must be explicit strings');
  }
  const timeoutMs = Number(options.timeoutMs || 120_000);
  const graceMs = Number(options.graceMs || 1_500);
  const terminationMs = Number(options.terminationMs || 2_000);
  const outputLimitBytes = Number(options.outputLimitBytes || 2 * 1024 * 1024);
  const stdout = [];
  const stderr = [];
  const stdoutState = { bytes: 0, truncated: false };
  const stderrState = { bytes: 0, truncated: false };
  const startedAt = Date.now();
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    shell: false,
  });
  child.stdout.on('data', chunk => appendBounded(stdout, stdoutState, chunk, outputLimitBytes));
  child.stderr.on('data', chunk => appendBounded(stderr, stderrState, chunk, outputLimitBytes));
  const stdoutComplete = waitForStreamCompletion(child.stdout);
  const stderrComplete = waitForStreamCompletion(child.stderr);

  let closed = false;
  let spawned = false;
  let closeRecord = null;
  let terminationReason = null;
  let gracefulSent = false;
  let forcedSent = false;
  let terminationFailure = null;
  const ownedProcesses = new Map();
  const captureOwnedProcesses = () => {
    if (!child.pid) return;
    for (const record of snapshotProcessGroup(child.pid)) {
      ownedProcesses.set(`${record.pid}:${record.startTime}`, record);
    }
  };
  let requestTermination;
  const closePromise = new Promise((resolve, reject) => {
    child.once('spawn', () => {
      spawned = true;
      captureOwnedProcesses();
    });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      closed = true;
      closeRecord = { code, signal };
      resolve();
    });
  });
  const terminationPromise = new Promise(resolve => {
    requestTermination = async reason => {
      if (terminationReason) return;
      terminationReason = reason;
      try {
        captureOwnedProcesses();
        if (!closed && processGroupExists(child.pid)) {
          gracefulSent = true;
          signalProcessGroup(child.pid, 'SIGTERM');
        }
        await Promise.race([closePromise.catch(() => {}), delay(graceMs)]);
        if (processGroupExists(child.pid)) {
          forcedSent = true;
          signalProcessGroup(child.pid, 'SIGKILL');
        }
        const identities = Array.from(ownedProcesses.values());
        const [groupAbsent, active] = await Promise.all([
          waitForProcessGroupAbsence(child.pid, terminationMs),
          waitForOwnedProcessAbsence(identities, terminationMs),
        ]);
        if (!groupAbsent || active.length > 0) {
          terminationFailure = 'owned process group remained active after forced termination';
        }
      } catch (error) {
        if (error.code !== 'ESRCH') terminationFailure = error.message || String(error);
      }
      resolve();
    };
  });
  const timeout = setTimeout(() => requestTermination('timeout'), timeoutMs);
  const abortHandler = () => requestTermination('cancelled');
  options.signal?.addEventListener('abort', abortHandler, { once: true });

  let spawnFailure = null;
  let terminalWatchdog;
  try {
    await Promise.race([
      closePromise,
      new Promise((_resolve, reject) => {
        terminalWatchdog = setTimeout(
          () => reject(new Error('bounded process did not produce terminal evidence')),
          timeoutMs + graceMs + terminationMs + 250
        );
      }),
    ]);
    await Promise.all([stdoutComplete, stderrComplete]);
  } catch (error) {
    spawnFailure = error;
    if (child.pid) await requestTermination('spawn-or-terminal-failure');
  } finally {
    clearTimeout(terminalWatchdog);
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortHandler);
  }

  if (terminationReason) await terminationPromise;
  if (child.pid && processGroupExists(child.pid)) {
    await requestTermination(terminationReason || 'orphan-process');
  }
  captureOwnedProcesses();
  const ownedProcessList = Array.from(ownedProcesses.values()).sort((left, right) => left.pid - right.pid);
  const [groupAbsent, activeProcessList] = child.pid
    ? await Promise.all([
        waitForProcessGroupAbsence(child.pid, terminationMs),
        waitForOwnedProcessAbsence(ownedProcessList, terminationMs),
      ])
    : [true, []];
  const result = Object.freeze({
    command,
    args: [...args],
    cwd: options.cwd || null,
    status: spawnFailure || !spawned
      ? 'failed'
      : terminationReason === 'timeout'
        ? 'timed-out'
        : terminationReason === 'cancelled'
          ? 'cancelled'
          : closeRecord?.code === 0
            ? 'passed'
            : 'failed',
    exitCode: closeRecord?.code ?? null,
    signal: closeRecord?.signal || null,
    durationMs: Date.now() - startedAt,
    stdout: Buffer.concat(stdout).toString('utf8'),
    stderr: Buffer.concat(stderr).toString('utf8'),
    stdoutTruncated: stdoutState.truncated,
    stderrTruncated: stderrState.truncated,
    termination: Object.freeze({
      reason: terminationReason,
      processGroupId: child.pid || null,
      ownedProcessIds: ownedProcessList.map(record => record.pid),
      activeProcessIds: activeProcessList.map(record => record.pid),
      gracefulSent,
      forcedSent,
      groupAbsent,
      failure: terminationFailure,
    }),
    spawnFailure: spawnFailure
      ? spawnFailure.message || String(spawnFailure)
      : spawned
        ? null
        : 'child did not emit a spawn event',
  });
  if (!groupAbsent || activeProcessList.length > 0 || terminationFailure) {
    fail('BROWSER_PROCESS_RESIDUE', 'bounded process termination was not independently proved', { result });
  }
  return result;
}

function contentType(filename) {
  const extension = path.extname(filename).toLowerCase();
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  })[extension] || 'application/octet-stream';
}

function resolveBuildFile(buildRoot, urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  } catch (_error) {
    return null;
  }
  const candidate = path.resolve(buildRoot, pathname.replace(/^\/+/, '') || 'index.html');
  if (!isWithin(buildRoot, candidate)) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const fallback = path.join(buildRoot, 'index.html');
  return fs.existsSync(fallback) ? fallback : null;
}

function requestLoopbackIdentity(baseUrl) {
  return new Promise((resolve, reject) => {
    const request = http.get(`${baseUrl}/_rq/browser-suite-identity`, { timeout: 2_000 }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('timeout', () => request.destroy(new Error('loopback identity request timed out')));
    request.on('error', reject);
  });
}

async function verifyLoopbackIdentity(baseUrl, expectedIdentity) {
  const response = await requestLoopbackIdentity(baseUrl);
  let parsed = null;
  try {
    parsed = JSON.parse(response.body);
  } catch (_error) {
    // The structured failure below retains the response status without trusting its body.
  }
  if (response.statusCode !== 200 || parsed?.identity !== expectedIdentity) {
    fail('BROWSER_LOOPBACK_IDENTITY_MISMATCH', 'loopback responder identity did not match', {
      statusCode: response.statusCode,
      expectedIdentity,
      observedIdentity: parsed?.identity || null,
    });
  }
  return Object.freeze({ statusCode: response.statusCode, identity: parsed.identity });
}

async function startVerifiedLoopbackServer({ buildRoot, identity }) {
  const requests = [];
  const server = http.createServer((request, response) => {
    const remoteAddress = request.socket.remoteAddress || '';
    const localOnly = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
    const expectedHost = `127.0.0.1:${server.address().port}`;
    const hostMatches = request.headers.host === expectedHost;
    const record = { method: request.method, url: request.url, remoteAddress, host: request.headers.host || null };
    requests.push(record);
    if (!localOnly || !hostMatches) {
      response.writeHead(421, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'loopback_identity_rejected' }));
      return;
    }
    if (request.url === '/_rq/browser-suite-identity') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ identity }));
      return;
    }
    const filename = resolveBuildFile(buildRoot, request.url);
    if (!filename) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': contentType(filename), 'cache-control': 'no-store' });
    fs.createReadStream(filename).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const identityProof = await verifyLoopbackIdentity(baseUrl, identity);
  return { server, port, baseUrl, requests, identityProof };
}

async function closeLoopbackServer(control) {
  await new Promise((resolve, reject) => control.server.close(error => error ? reject(error) : resolve()));
  const probe = http.createServer((_request, response) => response.end('probe'));
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(control.port, '127.0.0.1', resolve);
  });
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return Object.freeze({ shutdown: 'passed', portReleased: true });
}

function parseStructuredChildResult(processResult) {
  const source = processResult.status === 'passed' ? processResult.stdout : processResult.stderr;
  let parsed;
  try {
    parsed = JSON.parse(String(source || '').trim());
  } catch (_error) {
    fail('BROWSER_CHILD_RESULT_INVALID', 'browser child did not emit one complete JSON result', {
      processStatus: processResult.status,
      exitCode: processResult.exitCode,
      stdoutTruncated: processResult.stdoutTruncated,
      stderrTruncated: processResult.stderrTruncated,
    });
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.pass !== 'boolean' || !Array.isArray(parsed.failures)) {
    fail('BROWSER_CHILD_RESULT_INVALID', 'browser child result has an invalid shape');
  }
  return parsed;
}

async function sha256File(filename) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filename);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function resolveBrowserRuntimeIdentity(repoRoot) {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/home/bill/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-142.0.7444.59/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  if (!executable) fail('BROWSER_RUNTIME_MISSING', 'no admitted Chrome executable is present');
  const stat = fs.statSync(executable);
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'node_modules', 'puppeteer', 'package.json'), 'utf8'));
  return Object.freeze({
    executable,
    executableBytes: stat.size,
    executableSha256: await sha256File(executable),
    puppeteerVersion: packageJson.version,
    nodeVersion: process.version,
  });
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

module.exports = {
  BrowserSuiteControlError,
  closeLoopbackServer,
  parseStructuredChildResult,
  processGroupExists,
  resolveBrowserRuntimeIdentity,
  runBoundedProcess,
  runWithBrowserPreservation,
  sha256Bytes,
  startVerifiedLoopbackServer,
  validateBrowserPreservationPlan,
  verifyLoopbackIdentity,
};
