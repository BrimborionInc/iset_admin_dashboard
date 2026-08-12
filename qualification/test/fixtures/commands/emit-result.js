'use strict';

const [mode, attemptId] = process.argv.slice(2);
const modes = new Set([
  'valid',
  'missing',
  'truncated',
  'corrupt',
  'duplicate-identical',
  'duplicate-conflicting',
  'stale',
]);

if (!modes.has(mode) || !attemptId || process.argv.length !== 4) process.exit(64);

const emit = (frame) => process.stdout.write(`${JSON.stringify({
  type: frame.type,
  protocolVersion: '1.0.0',
  attemptId,
  ...frame,
})}\n`);
const result = {
  type: 'result',
  resultId: 'synthetic-result',
  status: 'passed',
  payload: { mode },
};

emit({ type: 'ready' });
if (mode === 'valid') emit(result);
if (mode === 'truncated') emit({ ...result, payload: { mode, padding: 'x'.repeat(4096) } });
if (mode === 'corrupt') process.stdout.write('{"type":"result"\n');
if (mode === 'duplicate-identical') {
  emit(result);
  emit(result);
}
if (mode === 'duplicate-conflicting') {
  emit(result);
  emit({ ...result, payload: { mode, conflict: true } });
}
if (mode === 'stale') {
  process.stdout.write(`${JSON.stringify({
    type: 'result',
    protocolVersion: '1.0.0',
    attemptId: 'attempt:00000000-0000-4000-8000-000000000000',
    resultId: 'synthetic-result',
    status: 'passed',
    payload: { mode },
  })}\n`);
}
