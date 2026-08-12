#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  ADMIN_TEST_ENVIRONMENT_FILE,
  ADMIN_TEST_ENVIRONMENT_ROOT_PREFIX,
} = require('../src/server/adminEnvironment');

const REPO_ROOT = path.resolve(__dirname, '..');
const SYNTHETIC_ENVIRONMENT = Object.freeze([
  'ALLOWED_ORIGIN=http://localhost:3000,http://localhost:3001',
  'AWS_REGION=ca-central-1',
  'COGNITO_REGION=ca-central-1',
  'COGNITO_STAFF_USER_POOL_ID=ca-central-1_pathSyntheticStaff',
  'COGNITO_USER_POOL_ID=ca-central-1_pathSyntheticStaff',
  'COGNITO_APP_CLIENT_ID=path-synthetic-client',
  'ENABLE_EVENT_DELIVERY_WORKER_IN_TEST=0',
  'OPENROUTER_API_KEY=',
  'OPENROUTER_KEY=',
]);

function controlledExecutablePath() {
  const directories = [path.dirname(process.execPath)];
  if (process.platform === 'win32') {
    if (process.env.SystemRoot) directories.push(path.join(process.env.SystemRoot, 'System32'));
  } else {
    directories.push('/usr/local/bin', '/usr/bin', '/bin');
  }
  return [...new Set(directories)].join(path.delimiter);
}

function buildChildEnvironment(root, environmentFile) {
  const environment = {
    BABEL_ENV: 'test',
    CI: 'true',
    HOME: root,
    NODE_ENV: 'test',
    PATH: controlledExecutablePath(),
    PATH_TEST_ENV_FILE: environmentFile,
    TEMP: root,
    TMP: root,
    TMPDIR: root,
  };
  if (process.platform === 'win32' && process.env.SystemRoot) {
    environment.SystemRoot = process.env.SystemRoot;
  }
  return environment;
}

function createSyntheticTestEnvironment() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), ADMIN_TEST_ENVIRONMENT_ROOT_PREFIX));
  fs.chmodSync(root, 0o700);
  const environmentFile = path.join(root, ADMIN_TEST_ENVIRONMENT_FILE);
  fs.writeFileSync(environmentFile, `${SYNTHETIC_ENVIRONMENT.join('\n')}\n`, { mode: 0o600 });
  let cleaned = false;
  return {
    root,
    environmentFile,
    childEnvironment: buildChildEnvironment(root, environmentFile),
    cleanup() {
      if (!cleaned) {
        fs.rmSync(root, { recursive: true, force: true });
        cleaned = true;
      }
      return !fs.existsSync(root);
    },
  };
}

function runPhase(label, args, environment) {
  console.log(`\n[test:all] ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${label} failed with exit code ${result.status || 1}`);
    error.exitCode = result.status || 1;
    throw error;
  }
}

function withSyntheticTestEnvironment(operation) {
  const syntheticEnvironment = createSyntheticTestEnvironment();
  try {
    return operation(syntheticEnvironment);
  } finally {
    if (!syntheticEnvironment.cleanup()) {
      throw new Error('Admin aggregate synthetic environment residue remains');
    }
  }
}

function main() {
  return withSyntheticTestEnvironment((syntheticEnvironment) => {
    runPhase('frontend suites', [
      require.resolve('react-scripts/scripts/test'),
      '--watchAll=false',
      '--runInBand',
    ], syntheticEnvironment.childEnvironment);

    runPhase('backend, authorization, validation, and tooling suites', [
      require.resolve('jest/bin/jest'),
      '--config',
      path.join(REPO_ROOT, 'tests', 'jest.config.js'),
      '--runInBand',
    ], syntheticEnvironment.childEnvironment);

    console.log('\n[test:all] all admin suites passed');
  });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[test:all] ${error.message}`);
    process.exitCode = error.exitCode || 1;
  }
}

module.exports = {
  SYNTHETIC_ENVIRONMENT,
  buildChildEnvironment,
  createSyntheticTestEnvironment,
  main,
  runPhase,
  withSyntheticTestEnvironment,
};
