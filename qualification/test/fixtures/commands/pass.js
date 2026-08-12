'use strict';

const [attemptId] = process.argv.slice(2);

if (!attemptId || process.argv.length !== 3) process.exit(64);

const emit = (frame) => process.stdout.write(`${JSON.stringify({
  type: frame.type,
  protocolVersion: '1.0.0',
  attemptId,
  ...frame,
})}\n`);

emit({ type: 'ready' });
emit({
  type: 'result',
  resultId: 'synthetic-pass',
  status: 'passed',
  payload: { observed: 'pass', environmentKeys: Object.keys(process.env).sort() },
});
