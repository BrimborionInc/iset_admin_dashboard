#!/usr/bin/env node

const path = require('path');
const { spawn, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const nodeBin = process.execPath;
const reactScripts = path.join(repoRoot, 'node_modules', 'react-scripts', 'bin', 'react-scripts.js');
const env = { ...process.env, PORT: process.env.PORT || '3001' };

if (process.argv.includes('--dry-run')) {
  process.stdout.write(`${JSON.stringify({
    cwd: repoRoot,
    port: env.PORT,
    buildTarget: 'local-start',
    command: nodeBin,
    args: [reactScripts, 'start'],
  }, null, 2)}\n`);
  process.exit(0);
}

const marker = spawnSync(nodeBin, [path.join(__dirname, 'write-build-info.js'), '--build-target', 'local-start'], {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
});
if (marker.status !== 0) process.exit(marker.status || 1);

const child = spawn(nodeBin, [reactScripts, 'start'], { cwd: repoRoot, env, stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
