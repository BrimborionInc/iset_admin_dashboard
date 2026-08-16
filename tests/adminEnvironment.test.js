'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ADMIN_TEST_ENVIRONMENT_FILE,
  ADMIN_TEST_ENVIRONMENT_ROOT_PREFIX,
  LEGACY_PRODUCTION_ENVIRONMENT_FILE,
  resolveAdminEnvironmentFile,
} = require('../src/server/adminEnvironment');
const { createSyntheticTestEnvironment } = require('../scripts/run-test-all');

const ownedRoots = new Set();

function createOwnedRoot(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  ownedRoots.add(root);
  return root;
}

afterEach(() => {
  const roots = [...ownedRoots];
  roots.forEach(root => fs.rmSync(root, { recursive: true, force: true }));
  expect(roots.filter(root => fs.existsSync(root))).toEqual([]);
  ownedRoots.clear();
});

test('DEV and PROD retain repository-local and legacy environment resolution', () => {
  const serverRoot = createOwnedRoot('path-admin-environment-server-');
  const localEnvironment = path.join(serverRoot, '.env');

  expect(resolveAdminEnvironmentFile({
    serverRoot,
    environment: { NODE_ENV: 'development' },
  })).toBe(localEnvironment);

  fs.writeFileSync(localEnvironment, 'synthetic=only\n');
  expect(resolveAdminEnvironmentFile({
    serverRoot,
    environment: { NODE_ENV: 'production' },
  })).toBe(localEnvironment);

  fs.unlinkSync(localEnvironment);
  expect(resolveAdminEnvironmentFile({
    serverRoot,
    environment: { NODE_ENV: 'production' },
  })).toBe(LEGACY_PRODUCTION_ENVIRONMENT_FILE);
});

test('test mode fails closed without an exact owned synthetic environment file', () => {
  const serverRoot = createOwnedRoot('path-admin-environment-server-');
  expect(() => resolveAdminEnvironmentFile({
    serverRoot,
    environment: { NODE_ENV: 'test' },
  })).toThrow('NODE_ENV=test requires an absolute PATH_TEST_ENV_FILE');

  const unownedRoot = createOwnedRoot('path-unowned-environment-');
  const unownedFile = path.join(unownedRoot, ADMIN_TEST_ENVIRONMENT_FILE);
  fs.writeFileSync(unownedFile, 'synthetic=only\n');
  expect(() => resolveAdminEnvironmentFile({
    serverRoot,
    environment: { NODE_ENV: 'test', PATH_TEST_ENV_FILE: unownedFile },
  })).toThrow('outside an owned admin test-environment root');
});

test('the import-safe runner creates a non-secret environment and cleans it idempotently', () => {
  const synthetic = createSyntheticTestEnvironment();
  ownedRoots.add(synthetic.root);

  expect(Object.keys(require('../scripts/run-test-all'))).toEqual(['createSyntheticTestEnvironment']);
  expect(path.basename(synthetic.root)).toMatch(new RegExp(`^${ADMIN_TEST_ENVIRONMENT_ROOT_PREFIX}`));
  expect(path.basename(synthetic.environmentFile)).toBe(ADMIN_TEST_ENVIRONMENT_FILE);
  expect(resolveAdminEnvironmentFile({
    serverRoot: path.resolve(__dirname, '..'),
    environment: synthetic.childEnvironment,
  })).toBe(fs.realpathSync(synthetic.environmentFile));

  const content = fs.readFileSync(synthetic.environmentFile, 'utf8').trimEnd().split('\n');
  expect(content).toEqual([
    'ALLOWED_ORIGIN=http://localhost:3000,http://localhost:3001',
    'AWS_EC2_METADATA_DISABLED=true',
    'AWS_REGION=ca-central-1',
    'COGNITO_REGION=ca-central-1',
    'COGNITO_STAFF_USER_POOL_ID=ca-central-1_pathSyntheticStaff',
    'COGNITO_USER_POOL_ID=ca-central-1_pathSyntheticStaff',
    'COGNITO_APP_CLIENT_ID=path-synthetic-client',
    'ENABLE_EVENT_DELIVERY_WORKER_IN_TEST=0',
    'OPENROUTER_API_KEY=',
    'OPENROUTER_KEY=',
  ]);
  const expectedChildKeys = [
    'AWS_EC2_METADATA_DISABLED',
    'BABEL_ENV',
    'CI',
    'HOME',
    'NODE_ENV',
    'PATH',
    'PATH_TEST_ENV_FILE',
    'TEMP',
    'TMP',
    'TMPDIR',
  ];
  if (process.platform === 'win32' && process.env.SystemRoot) expectedChildKeys.push('SystemRoot');
  expect(Object.keys(synthetic.childEnvironment).sort()).toEqual(expectedChildKeys.sort());
  expect(synthetic.childEnvironment.AWS_EC2_METADATA_DISABLED).toBe('true');
  expect(JSON.stringify(synthetic.childEnvironment)).not.toMatch(
    /AWS_ACCESS_KEY|AWS_SECRET|AWS_SESSION_TOKEN|OPENROUTER/u
  );
  if (process.platform !== 'win32') {
    expect(fs.statSync(synthetic.root).mode & 0o777).toBe(0o700);
    expect(fs.statSync(synthetic.environmentFile).mode & 0o777).toBe(0o600);
  }

  expect(synthetic.cleanup()).toBe(true);
  expect(synthetic.cleanup()).toBe(true);
  expect(fs.existsSync(synthetic.root)).toBe(false);
  ownedRoots.delete(synthetic.root);
});
