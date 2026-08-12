'use strict';

const { spawn } = require('node:child_process');
const { join } = require('node:path');

const [attemptId] = process.argv.slice(2);

if (!attemptId || process.argv.length !== 3) process.exit(64);

const emit = (frame) => process.stdout.write(`${JSON.stringify({
  type: frame.type,
  protocolVersion: '1.0.0',
  attemptId,
  ...frame,
})}\n`);
const descendant = spawn(process.execPath, [join(__dirname, 'ignore-termination.js'), 'descendant', attemptId], {
  detached: false,
  env: {},
  shell: false,
  stdio: ['ignore', 'pipe', 'ignore'],
});

let descendantOutput = '';
let parentReady = false;
descendant.stdout.on('data', (chunk) => {
  descendantOutput += chunk.toString('utf8');
  let newline = descendantOutput.indexOf('\n');
  while (newline !== -1) {
    const line = descendantOutput.slice(0, newline);
    descendantOutput = descendantOutput.slice(newline + 1);
    const frame = JSON.parse(line);
    if (!parentReady && frame.type === 'ready' && frame.attemptId === attemptId) {
      parentReady = true;
      emit({ type: 'ready' });
      emit({ type: 'progress', name: 'descendant-pid', value: descendant.pid });
      let sequence = 0;
      setInterval(() => emit({ type: 'heartbeat', sequence: ++sequence }), 25);
    }
    newline = descendantOutput.indexOf('\n');
  }
});
