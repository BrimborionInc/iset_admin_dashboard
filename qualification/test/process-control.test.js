'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const test = require('node:test');

const { createAttemptId } = require('../src/identities');
const {
  ProcessControlError,
  commandDigest,
  createProcessController,
} = require('../src/process-control');

const packageRoot = resolve(__dirname, '..');
const commandRoot = join(__dirname, 'fixtures', 'commands');
const commandPath = (name) => join(commandRoot, `${name}.js`);
const defaultBudgets = Object.freeze({
  startupMs: 800,
  executionMs: 1000,
  idleMs: 500,
  gracefulShutdownMs: 100,
  forcedTerminationMs: 800,
  totalMs: 2200,
});
const defaultOutputLimits = Object.freeze({
  stdoutBytes: 16384,
  stderrBytes: 4096,
  resultFrameBytes: 8192,
});

let commandInstanceSequence = 0;

function groupInvocations(invocations) {
  const grouped = new Map();
  for (const invocation of invocations) {
    const key = invocation.commandId || invocation.name;
    const existing = grouped.get(key) || {
      commandId: key,
      scriptPath: commandPath(invocation.name),
      contentDigest: invocation.contentDigest || commandDigest(commandPath(invocation.name)),
      allowedArgumentVectors: [],
    };
    existing.allowedArgumentVectors.push(invocation.arguments);
    grouped.set(key, existing);
  }
  return [...grouped.values()];
}

function buildController(invocations, options = {}) {
  const policy = {
    executablePath: process.execPath,
    allowedCwdRoot: packageRoot,
    allowedEnvironmentKeys: ['RQ_SYNTHETIC_TEST'],
    commands: groupInvocations(invocations),
  };
  if (options.terminationProbe) policy.terminationProbe = options.terminationProbe;
  return createProcessController(policy);
}

function declaration({
  name,
  commandId = name,
  arguments: argumentsList,
  attemptId = createAttemptId(),
  commandInstanceId = `synthetic-command-${++commandInstanceSequence}`,
  expectedContentDigest = commandDigest(commandPath(name)),
  workingDirectory = packageRoot,
  environment = { RQ_SYNTHETIC_TEST: 'admitted' },
  budgets = defaultBudgets,
  outputLimits = defaultOutputLimits,
}) {
  return {
    attemptId,
    commandId,
    commandInstanceId,
    executablePath: process.execPath,
    arguments: argumentsList,
    workingDirectory,
    environment,
    expectedContentDigest,
    budgets,
    outputLimits,
  };
}

async function execute(name, argumentsList, options = {}) {
  const invocation = { name, arguments: argumentsList };
  const controller = buildController([invocation], options.controllerOptions);
  const processDeclaration = declaration({ name, arguments: argumentsList, ...options.declarationOptions });
  const execution = controller.start(processDeclaration);
  await execution.started;
  return execution.result;
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
}

test('admits an exact synthetic command without inheriting ambient environment', async () => {
  const attemptId = createAttemptId();
  const result = await execute('pass', [attemptId], { declarationOptions: { attemptId } });

  assert.equal(result.status, 'completed', JSON.stringify(result, null, 2));
  assert.equal(result.readiness.proved, true);
  assert.equal(result.result.status, 'valid');
  assert.deepEqual(result.result.frame.payload.environmentKeys, ['RQ_SYNTHETIC_TEST']);
  assert.equal(result.exit.code, 0);
  assert.equal(result.termination.proved, true);
  assert.equal(result.termination.forced, false);
});

test('preserves a valid native failure result separately from nonzero process exit', async () => {
  const attemptId = createAttemptId();
  const result = await execute('fail', [attemptId], { declarationOptions: { attemptId } });

  assert.equal(result.status, 'failed');
  assert.equal(result.result.status, 'valid');
  assert.equal(result.result.frame.status, 'failed');
  assert.equal(result.exit.code, 7);
  assert.equal(result.cancellation, null);
});

test('fails admission for unknown commands, arguments, environment, cwd, and stale identities', async (t) => {
  const attemptId = createAttemptId();
  const allowedArguments = [attemptId];
  const controller = buildController([{ name: 'pass', arguments: allowedArguments }]);
  const valid = declaration({ name: 'pass', arguments: allowedArguments, attemptId });

  await t.test('unknown command', () => {
    assert.throws(
      () => controller.start({ ...valid, commandId: 'not-declared' }),
      (error) => error instanceof ProcessControlError && error.code === 'UNKNOWN_COMMAND',
    );
  });
  await t.test('unapproved argument vector', () => {
    assert.throws(
      () => controller.start({ ...valid, arguments: ['not-approved'] }),
      (error) => error instanceof ProcessControlError && error.code === 'ARGUMENTS_NOT_ADMITTED',
    );
  });
  await t.test('ambient environment key', () => {
    assert.throws(
      () => controller.start({ ...valid, environment: { PATH: '/not/admitted' } }),
      (error) => error instanceof ProcessControlError && error.code === 'ENVIRONMENT_NOT_ADMITTED',
    );
  });
  await t.test('Node preload controls', () => {
    assert.throws(
      () => createProcessController({
        executablePath: process.execPath,
        allowedCwdRoot: packageRoot,
        allowedEnvironmentKeys: ['NODE_OPTIONS'],
        commands: groupInvocations([{ name: 'pass', arguments: allowedArguments }]),
      }),
      (error) => error instanceof ProcessControlError && error.code === 'ENVIRONMENT_CONTROL_NOT_ADMITTED',
    );
  });
  await t.test('external working directory', () => {
    assert.throws(
      () => controller.start({ ...valid, workingDirectory: tmpdir() }),
      (error) => error instanceof ProcessControlError && error.code === 'WORKING_DIRECTORY_NOT_ADMITTED',
    );
  });
  await t.test('stale declared digest', () => {
    assert.throws(
      () => controller.start({ ...valid, expectedContentDigest: '0'.repeat(64) }),
      (error) => error instanceof ProcessControlError && error.code === 'STALE_COMMAND_IDENTITY',
    );
  });
  await t.test('command fingerprint drift', () => {
    const driftController = buildController([{
      name: 'pass',
      arguments: allowedArguments,
      contentDigest: '0'.repeat(64),
    }]);
    assert.throws(
      () => driftController.start({ ...valid, expectedContentDigest: '0'.repeat(64) }),
      (error) => error instanceof ProcessControlError && error.code === 'COMMAND_FINGERPRINT_DRIFT',
    );
  });
});

test('rejects an implicit retry of the same command instance in one attempt', async () => {
  const attemptId = createAttemptId();
  const argumentsList = [attemptId];
  const controller = buildController([{ name: 'pass', arguments: argumentsList }]);
  const processDeclaration = declaration({
    name: 'pass',
    arguments: argumentsList,
    attemptId,
    commandInstanceId: 'fixed-command-instance',
  });
  const first = controller.start(processDeclaration);
  await first.result;

  assert.throws(
    () => controller.start(processDeclaration),
    (error) => error instanceof ProcessControlError && error.code === 'DISPATCH_REPLAY',
  );
});

test('enforces startup, idle, execution, and total-attempt budgets', async (t) => {
  const cases = [
    {
      name: 'startup',
      budgets: {
        startupMs: 150,
        executionMs: 1000,
        idleMs: 500,
        gracefulShutdownMs: 100,
        forcedTerminationMs: 600,
        totalMs: 1800,
      },
      cause: 'startup-timeout',
    },
    {
      name: 'idle',
      budgets: {
        startupMs: 800,
        executionMs: 1000,
        idleMs: 150,
        gracefulShutdownMs: 100,
        forcedTerminationMs: 600,
        totalMs: 1800,
      },
      cause: 'idle-timeout',
    },
    {
      name: 'execution',
      budgets: {
        startupMs: 800,
        executionMs: 250,
        idleMs: 150,
        gracefulShutdownMs: 100,
        forcedTerminationMs: 600,
        totalMs: 1800,
      },
      cause: 'execution-timeout',
    },
    {
      name: 'execution',
      budgets: {
        startupMs: 1000,
        executionMs: 2000,
        idleMs: 1000,
        gracefulShutdownMs: 100,
        forcedTerminationMs: 300,
        totalMs: 650,
      },
      cause: 'total-timeout',
    },
  ];

  for (const timeoutCase of cases) {
    await t.test(timeoutCase.cause, async () => {
      const attemptId = createAttemptId();
      const result = await execute('hang', [timeoutCase.name, attemptId], {
        declarationOptions: { attemptId, budgets: timeoutCase.budgets },
      });
      assert.equal(result.status, 'timed-out');
      assert.equal(result.cancellation.cause, timeoutCase.cause);
      assert.equal(result.termination.proved, true);
    });
  }
});

test('user cancellation is idempotent and escalates from graceful to forced termination', async () => {
  const attemptId = createAttemptId();
  const argumentsList = ['single', attemptId];
  const controller = buildController([{ name: 'ignore-termination', arguments: argumentsList }]);
  const execution = controller.start(declaration({ name: 'ignore-termination', arguments: argumentsList, attemptId }));
  await execution.ready;
  const request = { kind: 'user', cause: 'operator-request', requester: 'test-operator' };

  assert.equal(execution.cancel(request), true);
  assert.equal(execution.cancel(request), false);
  assert.throws(
    () => execution.cancel({ ...request, cause: 'conflicting-request' }),
    (error) => error instanceof ProcessControlError && error.code === 'CANCELLATION_CONFLICT',
  );
  const result = await execution.result;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.termination.forced, true);
  assert.equal(result.termination.proved, true);
  assert.deepEqual(result.termination.signals.map(({ signal }) => signal), ['SIGTERM', 'SIGKILL']);
});

test('forced termination covers the admitted synthetic descendant process', async () => {
  const attemptId = createAttemptId();
  const argumentsList = [attemptId];
  const controller = buildController([{ name: 'spawn-descendant', arguments: argumentsList }]);
  const execution = controller.start(declaration({ name: 'spawn-descendant', arguments: argumentsList, attemptId }));
  await execution.ready;
  execution.cancel({ kind: 'user', cause: 'tree-test', requester: 'test-operator' });
  const result = await execution.result;
  const descendant = result.protocolFrames.find((frame) => frame.type === 'progress' && frame.name === 'descendant-pid');

  assert.ok(descendant);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.termination.forced, true);
  assert.equal(result.termination.proved, true);
  assert.equal(isPidAlive(descendant.value), false);
});

test('fails closed when whole-process-group termination cannot be proved', async () => {
  const attemptId = createAttemptId();
  const argumentsList = ['single', attemptId];
  const controller = buildController(
    [{ name: 'ignore-termination', arguments: argumentsList }],
    { terminationProbe: () => true },
  );
  const execution = controller.start(declaration({
    name: 'ignore-termination',
    arguments: argumentsList,
    attemptId,
    budgets: {
      startupMs: 800,
      executionMs: 1000,
      idleMs: 500,
      gracefulShutdownMs: 100,
      forcedTerminationMs: 200,
      totalMs: 1500,
    },
  }));
  const started = await execution.started;
  await execution.ready;
  execution.cancel({ kind: 'user', cause: 'unproved-termination-test', requester: 'test-operator' });
  const result = await execution.result;

  assert.equal(result.status, 'termination-failed');
  assert.equal(result.termination.forced, true);
  assert.equal(result.termination.proved, false);
  assert.equal(isPidAlive(started.pid), false);
});

test('handles valid, missing, corrupt, duplicate, stale, and truncated result framing', async (t) => {
  const cases = [
    ['valid', 'completed', 'valid', 0],
    ['missing', 'failed', 'missing', 0],
    ['corrupt', 'failed', 'corrupt', 0],
    ['duplicate-identical', 'completed', 'valid', 1],
    ['duplicate-conflicting', 'failed', 'duplicate-conflicting', 2],
    ['stale', 'failed', 'stale', 0],
    ['truncated', 'timed-out', 'truncated', 0],
  ];
  for (const [mode, expectedStatus, expectedResultState, duplicateCount] of cases) {
    await t.test(mode, async () => {
      const attemptId = createAttemptId();
      const result = await execute('emit-result', [mode, attemptId], {
        declarationOptions: {
          attemptId,
          outputLimits: mode === 'truncated'
            ? { stdoutBytes: 8192, stderrBytes: 1024, resultFrameBytes: 256 }
            : defaultOutputLimits,
        },
      });
      assert.equal(result.status, expectedStatus);
      assert.equal(result.result.status, expectedResultState);
      assert.equal(result.result.duplicateCount, duplicateCount);
    });
  }
});

test('executes attempt-bound marker creation and cleanup without broad filesystem authority', async () => {
  const root = mkdtempSync(join(tmpdir(), 'rq-process-control-'));
  try {
    const attemptId = createAttemptId();
    const createArguments = ['create', root, attemptId];
    const removeArguments = ['remove', root, attemptId];
    const controller = buildController([
      { name: 'write-marker', arguments: createArguments },
      { name: 'write-marker', arguments: removeArguments },
    ]);
    const createExecution = controller.start(declaration({
      name: 'write-marker',
      arguments: createArguments,
      attemptId,
      commandInstanceId: 'marker-create',
    }));
    assert.equal((await createExecution.result).status, 'completed');
    const markerPath = join(root, `${attemptId.slice('attempt:'.length)}.marker`);
    assert.equal(readFileSync(markerPath, 'utf8'), `${attemptId}\n`);

    const removeExecution = controller.start(declaration({
      name: 'write-marker',
      arguments: removeArguments,
      attemptId,
      commandInstanceId: 'marker-remove',
    }));
    assert.equal((await removeExecution.result).status, 'completed');
    assert.throws(() => readFileSync(markerPath), { code: 'ENOENT' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
