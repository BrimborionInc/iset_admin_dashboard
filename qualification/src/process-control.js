'use strict';

const { spawn } = require('node:child_process');
const { readFileSync, realpathSync } = require('node:fs');
const { relative, isAbsolute } = require('node:path');
const { performance } = require('node:perf_hooks');

const { canonicalize, digestBytes, parseStrictJson } = require('./canonical-json');
const { validateAttemptId } = require('./identities');

const PROCESS_PROTOCOL_VERSION = '1.0.0';
const RESULT_STATUSES = new Set(['passed', 'failed']);
const FRAME_TYPES = new Set(['ready', 'heartbeat', 'progress', 'result']);
const ENVIRONMENT_KEY = /^[A-Z][A-Z0-9_]*$/u;
const FORBIDDEN_NODE_ENVIRONMENT_KEYS = new Set([
  'NODE_OPTIONS',
  'NODE_PATH',
  'LD_PRELOAD',
  'DYLD_INSERT_LIBRARIES',
]);

class ProcessControlError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessControlError';
    this.code = code;
    this.details = details;
  }
}

function assertExactKeys(value, required, optional, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProcessControlError('INVALID_DECLARATION', `${label} must be an object`);
  }
  const permitted = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!permitted.has(key)) {
      throw new ProcessControlError('UNKNOWN_FIELD', `${label} contains unknown field ${key}`, { field: key });
    }
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      throw new ProcessControlError('MISSING_FIELD', `${label} is missing required field ${key}`, { field: key });
    }
  }
}

function assertSafeString(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || value.includes('\0')) {
    throw new ProcessControlError('INVALID_STRING', `${label} must be a ${allowEmpty ? '' : 'non-empty '}NUL-free string`);
  }
}

function freezeClone(value) {
  const clone = structuredClone(value);
  const freeze = (current) => {
    if (!current || typeof current !== 'object' || Object.isFrozen(current)) return current;
    for (const child of Object.values(current)) freeze(child);
    return Object.freeze(current);
  };
  return freeze(clone);
}

function isPathWithin(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot));
}

function commandDigest(scriptPath) {
  return digestBytes(readFileSync(scriptPath));
}

function normalizePolicy(policy) {
  assertExactKeys(
    policy,
    ['executablePath', 'allowedCwdRoot', 'allowedEnvironmentKeys', 'commands'],
    ['terminationProbe'],
    'process policy',
  );
  if (process.platform !== 'linux') {
    throw new ProcessControlError('UNSUPPORTED_PLATFORM', 'Phase 2 process-group control is certified only on Linux');
  }
  assertSafeString(policy.executablePath, 'policy executablePath');
  assertSafeString(policy.allowedCwdRoot, 'policy allowedCwdRoot');
  const executablePath = realpathSync(policy.executablePath);
  const allowedCwdRoot = realpathSync(policy.allowedCwdRoot);
  if (executablePath !== realpathSync(process.execPath)) {
    throw new ProcessControlError('EXECUTABLE_NOT_ADMITTED', 'Sprint 2D admits only the exact current Node executable');
  }
  if (!Array.isArray(policy.allowedEnvironmentKeys)) {
    throw new ProcessControlError('INVALID_ENVIRONMENT_POLICY', 'allowedEnvironmentKeys must be an array');
  }
  const allowedEnvironmentKeys = [...policy.allowedEnvironmentKeys];
  for (const key of allowedEnvironmentKeys) {
    if (typeof key !== 'string' || !ENVIRONMENT_KEY.test(key)) {
      throw new ProcessControlError('INVALID_ENVIRONMENT_KEY', `Invalid allowed environment key ${String(key)}`);
    }
    if (FORBIDDEN_NODE_ENVIRONMENT_KEYS.has(key)) {
      throw new ProcessControlError('ENVIRONMENT_CONTROL_NOT_ADMITTED', `Node control environment key ${key} is prohibited`);
    }
  }
  if (new Set(allowedEnvironmentKeys).size !== allowedEnvironmentKeys.length) {
    throw new ProcessControlError('DUPLICATE_ENVIRONMENT_KEY', 'allowedEnvironmentKeys must be unique');
  }
  if (!Array.isArray(policy.commands) || policy.commands.length === 0) {
    throw new ProcessControlError('COMMAND_POLICY_REQUIRED', 'At least one exact command policy is required');
  }

  const commands = new Map();
  for (const command of policy.commands) {
    assertExactKeys(
      command,
      ['commandId', 'scriptPath', 'contentDigest', 'allowedArgumentVectors'],
      [],
      'command policy',
    );
    assertSafeString(command.commandId, 'commandId');
    assertSafeString(command.scriptPath, 'scriptPath');
    assertSafeString(command.contentDigest, 'contentDigest');
    if (commands.has(command.commandId)) {
      throw new ProcessControlError('DUPLICATE_COMMAND', `Duplicate commandId ${command.commandId}`);
    }
    const scriptPath = realpathSync(command.scriptPath);
    if (!isPathWithin(allowedCwdRoot, scriptPath)) {
      throw new ProcessControlError('SCRIPT_OUTSIDE_ROOT', `Command ${command.commandId} is outside the allowed root`);
    }
    if (!Array.isArray(command.allowedArgumentVectors) || command.allowedArgumentVectors.length === 0) {
      throw new ProcessControlError('ARGUMENT_POLICY_REQUIRED', `Command ${command.commandId} requires argument vectors`);
    }
    const allowedArgumentVectors = new Set();
    for (const vector of command.allowedArgumentVectors) {
      if (!Array.isArray(vector)) {
        throw new ProcessControlError('INVALID_ARGUMENT_VECTOR', 'Allowed argument vectors must be arrays');
      }
      vector.forEach((argument, index) => assertSafeString(argument, `argument ${index}`, { allowEmpty: true }));
      const key = canonicalize(vector);
      if (allowedArgumentVectors.has(key)) {
        throw new ProcessControlError('DUPLICATE_ARGUMENT_VECTOR', `Duplicate argument vector for ${command.commandId}`);
      }
      allowedArgumentVectors.add(key);
    }
    commands.set(command.commandId, Object.freeze({
      commandId: command.commandId,
      scriptPath,
      contentDigest: command.contentDigest,
      allowedArgumentVectors,
    }));
  }

  if (policy.terminationProbe !== undefined && typeof policy.terminationProbe !== 'function') {
    throw new ProcessControlError('INVALID_TERMINATION_PROBE', 'terminationProbe must be a function');
  }
  return Object.freeze({
    executablePath,
    allowedCwdRoot,
    allowedEnvironmentKeys: new Set(allowedEnvironmentKeys),
    commands,
    terminationProbe: policy.terminationProbe,
  });
}

function normalizeBudgets(budgets) {
  const keys = [
    'startupMs',
    'executionMs',
    'idleMs',
    'gracefulShutdownMs',
    'forcedTerminationMs',
    'totalMs',
  ];
  assertExactKeys(budgets, keys, [], 'budgets');
  for (const key of keys) {
    if (!Number.isSafeInteger(budgets[key]) || budgets[key] <= 0) {
      throw new ProcessControlError('INVALID_BUDGET', `${key} must be a positive safe integer`);
    }
  }
  if (budgets.idleMs > budgets.executionMs) {
    throw new ProcessControlError('INVALID_BUDGET', 'idleMs cannot exceed executionMs');
  }
  if (budgets.totalMs <= budgets.gracefulShutdownMs + budgets.forcedTerminationMs) {
    throw new ProcessControlError('INVALID_BUDGET', 'totalMs must reserve both bounded termination intervals');
  }
  return freezeClone(budgets);
}

function normalizeOutputLimits(outputLimits) {
  const keys = ['stdoutBytes', 'stderrBytes', 'resultFrameBytes'];
  assertExactKeys(outputLimits, keys, [], 'outputLimits');
  for (const key of keys) {
    if (!Number.isSafeInteger(outputLimits[key]) || outputLimits[key] <= 0) {
      throw new ProcessControlError('INVALID_OUTPUT_LIMIT', `${key} must be a positive safe integer`);
    }
  }
  if (outputLimits.resultFrameBytes > outputLimits.stdoutBytes) {
    throw new ProcessControlError('INVALID_OUTPUT_LIMIT', 'resultFrameBytes cannot exceed stdoutBytes');
  }
  return freezeClone(outputLimits);
}

function normalizeEnvironment(environment, allowedKeys) {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
    throw new ProcessControlError('INVALID_ENVIRONMENT', 'environment must be an explicit object');
  }
  const normalized = Object.create(null);
  for (const [key, value] of Object.entries(environment)) {
    if (!allowedKeys.has(key)) {
      throw new ProcessControlError('ENVIRONMENT_NOT_ADMITTED', `Environment key ${key} is not admitted`);
    }
    if (typeof value !== 'string' || value.includes('\0')) {
      throw new ProcessControlError('INVALID_ENVIRONMENT_VALUE', `Environment value ${key} must be a NUL-free string`);
    }
    normalized[key] = value;
  }
  return normalized;
}

function normalizeDeclaration(declaration, policy) {
  assertExactKeys(
    declaration,
    [
      'attemptId',
      'commandId',
      'commandInstanceId',
      'executablePath',
      'arguments',
      'workingDirectory',
      'environment',
      'expectedContentDigest',
      'budgets',
      'outputLimits',
    ],
    [],
    'process declaration',
  );
  try {
    validateAttemptId(declaration.attemptId);
  } catch (error) {
    throw new ProcessControlError('INVALID_ATTEMPT_ID', 'Process declaration requires a valid attempt identity', {
      cause: error.code || error.message,
    });
  }
  assertSafeString(declaration.commandId, 'commandId');
  assertSafeString(declaration.commandInstanceId, 'commandInstanceId');
  const command = policy.commands.get(declaration.commandId);
  if (!command) {
    throw new ProcessControlError('UNKNOWN_COMMAND', `Command ${declaration.commandId} is not admitted`);
  }
  const executablePath = realpathSync(declaration.executablePath);
  if (executablePath !== policy.executablePath) {
    throw new ProcessControlError('EXECUTABLE_NOT_ADMITTED', 'Executable does not match the exact admitted executable');
  }
  if (!Array.isArray(declaration.arguments)) {
    throw new ProcessControlError('INVALID_ARGUMENTS', 'arguments must be an explicit array');
  }
  declaration.arguments.forEach((argument, index) => assertSafeString(argument, `argument ${index}`, { allowEmpty: true }));
  if (!command.allowedArgumentVectors.has(canonicalize(declaration.arguments))) {
    throw new ProcessControlError('ARGUMENTS_NOT_ADMITTED', `Arguments are not admitted for ${command.commandId}`);
  }
  assertSafeString(declaration.workingDirectory, 'workingDirectory');
  const workingDirectory = realpathSync(declaration.workingDirectory);
  if (!isPathWithin(policy.allowedCwdRoot, workingDirectory)) {
    throw new ProcessControlError('WORKING_DIRECTORY_NOT_ADMITTED', 'Working directory is outside the admitted root');
  }
  assertSafeString(declaration.expectedContentDigest, 'expectedContentDigest');
  if (declaration.expectedContentDigest !== command.contentDigest) {
    throw new ProcessControlError('STALE_COMMAND_IDENTITY', 'Declared command digest conflicts with the admitted policy');
  }
  const observedDigest = commandDigest(command.scriptPath);
  if (observedDigest !== command.contentDigest) {
    throw new ProcessControlError('COMMAND_FINGERPRINT_DRIFT', 'Command source changed after policy binding', {
      expected: command.contentDigest,
      observed: observedDigest,
    });
  }
  const environment = normalizeEnvironment(declaration.environment, policy.allowedEnvironmentKeys);
  return Object.freeze({
    attemptId: declaration.attemptId,
    commandId: declaration.commandId,
    commandInstanceId: declaration.commandInstanceId,
    executablePath,
    scriptPath: command.scriptPath,
    arguments: [...declaration.arguments],
    workingDirectory,
    environment,
    contentDigest: observedDigest,
    budgets: normalizeBudgets(declaration.budgets),
    outputLimits: normalizeOutputLimits(declaration.outputLimits),
  });
}

function defaultTerminationProbe(processGroupId) {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

function signalProcessGroup(processGroupId, signal) {
  try {
    process.kill(-processGroupId, signal);
    return { delivered: true, absent: false, error: null };
  } catch (error) {
    if (error.code === 'ESRCH') return { delivered: false, absent: true, error: null };
    return { delivered: false, absent: false, error: { code: error.code || 'SIGNAL_FAILED', message: error.message } };
  }
}

function createCapture(limit, onOverflow, onActivity, onStdoutBytes) {
  const chunks = [];
  let capturedBytes = 0;
  let observedBytes = 0;
  let truncated = false;
  return {
    receive(chunk) {
      observedBytes += chunk.length;
      onActivity();
      if (capturedBytes < limit) {
        const remaining = limit - capturedBytes;
        const retained = chunk.subarray(0, remaining);
        chunks.push(retained);
        capturedBytes += retained.length;
        if (onStdoutBytes) onStdoutBytes(retained);
      }
      if (observedBytes > limit && !truncated) {
        truncated = true;
        onOverflow();
      }
    },
    result() {
      const bytes = Buffer.concat(chunks);
      return Object.freeze({
        observedBytes,
        capturedBytes,
        truncated,
        capturedBase64: bytes.toString('base64'),
        digestAlgorithm: 'sha256',
        capturedDigest: digestBytes(bytes),
      });
    },
  };
}

function validateFrame(frame, expectedAttemptId) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
    throw new ProcessControlError('INVALID_FRAME', 'Protocol frame must be an object');
  }
  if (!FRAME_TYPES.has(frame.type)) {
    throw new ProcessControlError('UNKNOWN_FRAME', `Unknown protocol frame type ${String(frame.type)}`);
  }
  if (frame.protocolVersion !== PROCESS_PROTOCOL_VERSION) {
    throw new ProcessControlError('PROTOCOL_VERSION', 'Protocol frame version is unsupported');
  }
  if (frame.type === 'ready') {
    assertExactKeys(frame, ['type', 'protocolVersion', 'attemptId'], [], 'ready frame');
    if (frame.attemptId !== expectedAttemptId) {
      throw new ProcessControlError('STALE_FRAME', 'Ready frame attempt identity is stale or conflicting');
    }
  } else if (frame.type === 'heartbeat') {
    assertExactKeys(frame, ['type', 'protocolVersion', 'attemptId', 'sequence'], [], 'heartbeat frame');
    if (frame.attemptId !== expectedAttemptId || !Number.isSafeInteger(frame.sequence) || frame.sequence <= 0) {
      throw new ProcessControlError('INVALID_HEARTBEAT', 'Heartbeat frame is stale or malformed');
    }
  } else if (frame.type === 'progress') {
    assertExactKeys(frame, ['type', 'protocolVersion', 'attemptId', 'name', 'value'], [], 'progress frame');
    if (frame.attemptId !== expectedAttemptId) {
      throw new ProcessControlError('STALE_FRAME', 'Progress frame attempt identity is stale or conflicting');
    }
    assertSafeString(frame.name, 'progress name');
    canonicalize(frame.value);
  } else {
    assertExactKeys(
      frame,
      ['type', 'protocolVersion', 'attemptId', 'resultId', 'status', 'payload'],
      [],
      'result frame',
    );
    if (frame.attemptId !== expectedAttemptId) {
      throw new ProcessControlError('STALE_RESULT', 'Result frame attempt identity is stale or conflicting');
    }
    assertSafeString(frame.resultId, 'resultId');
    if (!RESULT_STATUSES.has(frame.status)) {
      throw new ProcessControlError('INVALID_RESULT_STATUS', `Unsupported result status ${String(frame.status)}`);
    }
    canonicalize(frame.payload);
  }
  return frame;
}

function createProcessController(rawPolicy) {
  const policy = normalizePolicy(rawPolicy);
  const usedDispatches = new Set();

  function start(rawDeclaration) {
    const declaration = normalizeDeclaration(rawDeclaration, policy);
    const dispatchKey = `${declaration.attemptId}:${declaration.commandInstanceId}`;
    if (usedDispatches.has(dispatchKey)) {
      throw new ProcessControlError('DISPATCH_REPLAY', `Command instance ${declaration.commandInstanceId} was already dispatched`);
    }
    usedDispatches.add(dispatchKey);

    const startedAt = performance.now();
    let child;
    let settled = false;
    let processClosed = false;
    let streamsClosed = false;
    let exitCode = null;
    let exitSignal = null;
    let ready = false;
    let readyCount = 0;
    let resultFrameOverflow = false;
    let lineBuffer = Buffer.alloc(0);
    let ignoringLine = false;
    const frames = [];
    const frameErrors = [];
    const signalEvidence = [];
    const timers = new Set();
    let startupTimer;
    let executionTimer;
    let idleTimer;
    let totalTimer;
    let gracefulTimer;
    let forcedTimer;
    let probeTimer;
    let cancellation = null;
    let forcedTermination = false;
    let terminationProved = false;
    let terminationProbeAttempts = 0;
    let resolveStarted;
    let rejectStarted;
    let resolveReady;
    let readyResolved = false;
    let resolveResult;
    const started = new Promise((resolve, reject) => {
      resolveStarted = resolve;
      rejectStarted = reject;
    });
    const result = new Promise((resolve) => {
      resolveResult = resolve;
    });
    const readyEvidence = new Promise((resolve) => {
      resolveReady = resolve;
    });

    const schedule = (callback, milliseconds) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
      }, milliseconds);
      timers.add(timer);
      return timer;
    };
    const clearScheduled = (timer) => {
      if (timer) {
        clearTimeout(timer);
        timers.delete(timer);
      }
    };
    const clearExecutionTimers = () => {
      clearScheduled(startupTimer);
      clearScheduled(executionTimer);
      clearScheduled(idleTimer);
      clearScheduled(totalTimer);
    };

    const probeAlive = () => {
      terminationProbeAttempts += 1;
      try {
        return (policy.terminationProbe || defaultTerminationProbe)(child.pid);
      } catch (error) {
        frameErrors.push({ code: 'TERMINATION_PROBE_FAILED', message: error.message });
        return true;
      }
    };

    const resultState = () => {
      if (resultFrameOverflow || stdoutCapture.result().truncated) return { status: 'truncated', frame: null, duplicateCount: 0 };
      if (frameErrors.some((error) => error.code === 'STALE_RESULT' || error.code === 'STALE_FRAME')) {
        return { status: 'stale', frame: null, duplicateCount: 0 };
      }
      if (frameErrors.length > 0) return { status: 'corrupt', frame: null, duplicateCount: 0 };
      const resultFrames = frames.filter((frame) => frame.type === 'result');
      if (resultFrames.length === 0) return { status: 'missing', frame: null, duplicateCount: 0 };
      const firstCanonical = canonicalize(resultFrames[0]);
      const conflict = resultFrames.some((frame) => canonicalize(frame) !== firstCanonical);
      if (conflict) return { status: 'duplicate-conflicting', frame: null, duplicateCount: resultFrames.length };
      return { status: 'valid', frame: resultFrames[0], duplicateCount: resultFrames.length - 1 };
    };

    const finalize = (forcedStatus = null) => {
      if (settled) return;
      settled = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      const framedResult = resultState();
      if (!readyResolved) {
        readyResolved = true;
        resolveReady(Object.freeze({ proved: false }));
      }
      let status = forcedStatus;
      if (!status) {
        if (cancellation) status = cancellation.kind === 'timeout' ? 'timed-out' : 'cancelled';
        else if (!ready || readyCount !== 1 || framedResult.status !== 'valid' || exitCode !== 0) status = 'failed';
        else status = framedResult.frame.status === 'passed' ? 'completed' : 'failed';
      }
      resolveResult(freezeClone({
        processProtocolVersion: PROCESS_PROTOCOL_VERSION,
        attemptId: declaration.attemptId,
        commandId: declaration.commandId,
        commandInstanceId: declaration.commandInstanceId,
        commandContentDigest: declaration.contentDigest,
        status,
        durationMs: Math.max(0, Math.ceil(performance.now() - startedAt)),
        readiness: { proved: ready, frameCount: readyCount },
        result: framedResult,
        exit: { code: exitCode, signal: exitSignal },
        cancellation,
        termination: {
          gracefulRequested: cancellation !== null,
          forced: forcedTermination,
          proved: terminationProved,
          probeAttempts: terminationProbeAttempts,
          signals: signalEvidence,
          processClosed,
          streamsClosed,
        },
        stdout: stdoutCapture.result(),
        stderr: stderrCapture.result(),
        protocolFrames: frames,
        protocolErrors: frameErrors,
      }));
    };

    const completeIfTerminated = () => {
      if (!processClosed || !streamsClosed || settled) return;
      if (!probeAlive()) {
        terminationProved = true;
        finalize();
      } else if (!cancellation && !probeTimer) {
        probeTimer = schedule(pollForTermination, 20);
        gracefulTimer = schedule(() => {
          requestCancellation({
            kind: 'protocol',
            cause: 'process-group-remained-after-root-exit',
            requester: 'process-controller',
          });
        }, declaration.budgets.gracefulShutdownMs);
      }
    };

    const pollForTermination = () => {
      if (settled) return;
      if (!probeAlive()) {
        terminationProved = true;
        if (processClosed && streamsClosed) finalize();
        return;
      }
      probeTimer = schedule(pollForTermination, 20);
    };

    const forceTermination = () => {
      if (settled || terminationProved) return;
      forcedTermination = true;
      clearScheduled(probeTimer);
      probeTimer = null;
      const evidence = signalProcessGroup(child.pid, 'SIGKILL');
      signalEvidence.push({ signal: 'SIGKILL', ...evidence });
      if (evidence.error) frameErrors.push({ code: 'FORCED_SIGNAL_FAILED', message: evidence.error.message });
      pollForTermination();
      forcedTimer = schedule(() => {
        clearScheduled(probeTimer);
        if (probeAlive()) {
          finalize('termination-failed');
        } else {
          terminationProved = true;
          if (processClosed && streamsClosed) finalize();
          else finalize('termination-failed');
        }
      }, declaration.budgets.forcedTerminationMs);
    };

    const requestCancellation = (request) => {
      assertExactKeys(request, ['kind', 'cause', 'requester'], [], 'cancellation request');
      if (!['user', 'timeout', 'protocol'].includes(request.kind)) {
        throw new ProcessControlError('INVALID_CANCELLATION_KIND', `Unsupported cancellation kind ${String(request.kind)}`);
      }
      assertSafeString(request.cause, 'cancellation cause');
      assertSafeString(request.requester, 'cancellation requester');
      const normalized = freezeClone(request);
      if (settled) return false;
      if (cancellation) {
        if (canonicalize(cancellation) === canonicalize(normalized)) return false;
        throw new ProcessControlError('CANCELLATION_CONFLICT', 'A different cancellation request is already authoritative');
      }
      cancellation = normalized;
      clearExecutionTimers();
      const evidence = signalProcessGroup(child.pid, 'SIGTERM');
      signalEvidence.push({ signal: 'SIGTERM', ...evidence });
      if (evidence.error) frameErrors.push({ code: 'GRACEFUL_SIGNAL_FAILED', message: evidence.error.message });
      gracefulTimer = schedule(forceTermination, declaration.budgets.gracefulShutdownMs);
      completeIfTerminated();
      return true;
    };

    const timeout = (cause) => {
      try {
        requestCancellation({ kind: 'timeout', cause, requester: 'process-controller' });
      } catch (error) {
        frameErrors.push({ code: error.code || 'TIMEOUT_CANCELLATION_FAILED', message: error.message });
      }
    };

    const resetIdleTimer = () => {
      if (!ready || cancellation || settled) return;
      clearScheduled(idleTimer);
      idleTimer = schedule(() => timeout('idle-timeout'), declaration.budgets.idleMs);
    };

    const processLine = (line) => {
      if (ignoringLine) {
        ignoringLine = false;
        return;
      }
      if (line.length === 0) return;
      if (line.length > declaration.outputLimits.resultFrameBytes) {
        resultFrameOverflow = true;
        timeout('result-frame-limit');
        return;
      }
      try {
        const frame = validateFrame(parseStrictJson(line), declaration.attemptId);
        frames.push(frame);
        if (frame.type === 'ready') {
          readyCount += 1;
          if (readyCount > 1) {
            frameErrors.push({ code: 'DUPLICATE_READY', message: 'Exactly one ready frame is permitted' });
            timeout('duplicate-ready-frame');
            return;
          }
          ready = true;
          if (!readyResolved) {
            readyResolved = true;
            resolveReady(Object.freeze({ proved: true }));
          }
          clearScheduled(startupTimer);
          executionTimer = schedule(() => timeout('execution-timeout'), declaration.budgets.executionMs);
          resetIdleTimer();
        }
      } catch (error) {
        frameErrors.push({ code: error.code || 'INVALID_PROTOCOL_FRAME', message: error.message });
      }
    };

    const receiveStdout = (bytes) => {
      lineBuffer = Buffer.concat([lineBuffer, bytes]);
      if (lineBuffer.length > declaration.outputLimits.resultFrameBytes && !lineBuffer.includes(0x0a)) {
        resultFrameOverflow = true;
        ignoringLine = true;
        lineBuffer = Buffer.alloc(0);
        timeout('result-frame-limit');
        return;
      }
      let newlineIndex = lineBuffer.indexOf(0x0a);
      while (newlineIndex !== -1) {
        const line = lineBuffer.subarray(0, newlineIndex);
        lineBuffer = lineBuffer.subarray(newlineIndex + 1);
        processLine(line);
        newlineIndex = lineBuffer.indexOf(0x0a);
      }
    };

    const stdoutCapture = createCapture(
      declaration.outputLimits.stdoutBytes,
      () => timeout('stdout-limit'),
      resetIdleTimer,
      receiveStdout,
    );
    const stderrCapture = createCapture(
      declaration.outputLimits.stderrBytes,
      () => timeout('stderr-limit'),
      resetIdleTimer,
      null,
    );

    try {
      child = spawn(
        declaration.executablePath,
        [declaration.scriptPath, ...declaration.arguments],
        {
          cwd: declaration.workingDirectory,
          env: declaration.environment,
          shell: false,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        },
      );
    } catch (error) {
      rejectStarted(error);
      throw new ProcessControlError('DISPATCH_FAILED', 'Synthetic command dispatch failed', { cause: error.message });
    }

    startupTimer = schedule(() => timeout('startup-timeout'), declaration.budgets.startupMs);
    totalTimer = schedule(
      () => timeout('total-timeout'),
      declaration.budgets.totalMs
        - declaration.budgets.gracefulShutdownMs
        - declaration.budgets.forcedTerminationMs,
    );

    child.once('spawn', () => resolveStarted(Object.freeze({ pid: child.pid, processGroupId: child.pid })));
    child.once('error', (error) => {
      rejectStarted(error);
      frameErrors.push({ code: 'PROCESS_ERROR', message: error.message });
    });
    child.stdout.on('data', (chunk) => stdoutCapture.receive(chunk));
    child.stderr.on('data', (chunk) => stderrCapture.receive(chunk));
    child.once('close', (code, signal) => {
      processClosed = true;
      streamsClosed = true;
      exitCode = code;
      exitSignal = signal;
      if (lineBuffer.length > 0) processLine(lineBuffer);
      clearExecutionTimers();
      completeIfTerminated();
    });

    return Object.freeze({
      started,
      ready: readyEvidence,
      result,
      cancel(request = { kind: 'user', cause: 'user-cancelled', requester: 'operator' }) {
        return requestCancellation(request);
      },
    });
  }

  return Object.freeze({ start });
}

module.exports = {
  PROCESS_PROTOCOL_VERSION,
  ProcessControlError,
  commandDigest,
  createProcessController,
};
