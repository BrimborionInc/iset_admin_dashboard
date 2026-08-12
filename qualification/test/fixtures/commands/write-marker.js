'use strict';

const { existsSync, realpathSync, unlinkSync, writeFileSync } = require('node:fs');
const { basename, dirname, join } = require('node:path');
const { tmpdir } = require('node:os');

const [mode, root, attemptId] = process.argv.slice(2);
const validAttempt = /^attempt:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(attemptId || '');

if (!['create', 'remove'].includes(mode) || !root || !validAttempt || process.argv.length !== 5) process.exit(64);

const canonicalRoot = realpathSync(root);
if (realpathSync(dirname(canonicalRoot)) !== realpathSync(tmpdir()) || !basename(canonicalRoot).startsWith('rq-process-control-')) {
  process.exit(65);
}
const markerPath = join(canonicalRoot, `${attemptId.slice('attempt:'.length)}.marker`);
const emit = (frame) => process.stdout.write(`${JSON.stringify({
  type: frame.type,
  protocolVersion: '1.0.0',
  attemptId,
  ...frame,
})}\n`);

emit({ type: 'ready' });
if (mode === 'create') {
  writeFileSync(markerPath, `${attemptId}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
} else if (existsSync(markerPath)) {
  unlinkSync(markerPath);
}
emit({ type: 'progress', name: 'marker-operation', value: mode });
emit({ type: 'result', resultId: `synthetic-marker-${mode}`, status: 'passed', payload: { mode } });
