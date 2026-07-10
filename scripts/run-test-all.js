#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

function runPhase(label, args) {
  console.log(`\n[test:all] ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      BABEL_ENV: 'test',
      CI: 'true',
      NODE_ENV: 'test',
    },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

runPhase('frontend suites', [
  require.resolve('react-scripts/scripts/test'),
  '--watchAll=false',
  '--runInBand',
]);

runPhase('backend, authorization, validation, and tooling suites', [
  require.resolve('jest/bin/jest'),
  '--config',
  path.join(REPO_ROOT, 'tests', 'jest.config.js'),
  '--runInBand',
]);

console.log('\n[test:all] all admin suites passed');
