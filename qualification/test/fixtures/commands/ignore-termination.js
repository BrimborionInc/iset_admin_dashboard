'use strict';

const [mode, attemptId] = process.argv.slice(2);

if (!['single', 'descendant'].includes(mode) || !attemptId || process.argv.length !== 4) process.exit(64);

const emit = (frame) => process.stdout.write(`${JSON.stringify({
  type: frame.type,
  protocolVersion: '1.0.0',
  attemptId,
  ...frame,
})}\n`);

process.on('SIGTERM', () => {});
emit({ type: 'ready' });
let sequence = 0;
setInterval(() => emit({ type: 'heartbeat', sequence: ++sequence }), 25);
