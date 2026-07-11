#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const nodemon = process.platform === 'win32' ? 'nodemon.cmd' : 'nodemon';
const env = { ...process.env, ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES: 'true' };

if (process.argv.includes('--dry-run')) {
  process.stdout.write(`${JSON.stringify({
    cwd: repoRoot,
    command: nodemon,
    args: ['isetadminserver.js'],
    unsafeDebugRoutes: env.ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES,
  }, null, 2)}\n`);
  process.exit(0);
}

const child = spawn(nodemon, ['isetadminserver.js'], {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
