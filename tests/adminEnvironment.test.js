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
const {
  SYNTHETIC_ENVIRONMENT,
  buildChildEnvironment,
  createSyntheticTestEnvironment,
  withSyntheticTestEnvironment,
} = require('../scripts/run-test-all');

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

test('DEV and PROD retain the existing repository-local and legacy environment resolution', () => {
  const serverRoot = createOwnedRoot('path-admin-environment-server-');
  const localEnvironment = path.join(serverRoot, '.env');
  fs.writeFileSync(localEnvironment, 'synthetic=only\n');
  expect(resolveAdminEnvironmentFile({
    serverRoot,
    environment: { NODE_ENV: 'development' },
  })).toBe(localEnvironment);
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

test('the aggregate runner creates a fixed non-secret environment and proves zero residue', () => {
  const synthetic = createSyntheticTestEnvironment();
  ownedRoots.add(synthetic.root);
  expect(path.basename(synthetic.root)).toMatch(new RegExp(`^${ADMIN_TEST_ENVIRONMENT_ROOT_PREFIX}`));
  expect(path.basename(synthetic.environmentFile)).toBe(ADMIN_TEST_ENVIRONMENT_FILE);
  expect(resolveAdminEnvironmentFile({
    serverRoot: path.resolve(__dirname, '..'),
    environment: synthetic.childEnvironment,
  })).toBe(fs.realpathSync(synthetic.environmentFile));

  const content = fs.readFileSync(synthetic.environmentFile, 'utf8').trimEnd().split('\n');
  expect(content).toEqual(SYNTHETIC_ENVIRONMENT);
  expect(content).toEqual(expect.arrayContaining(['OPENROUTER_API_KEY=', 'OPENROUTER_KEY=']));
  expect(JSON.stringify(synthetic.childEnvironment)).not.toMatch(/SECRET_ACCESS_KEY|SESSION_TOKEN|OPENROUTER/u);
  expect(synthetic.cleanup()).toBe(true);
  expect(fs.existsSync(synthetic.root)).toBe(false);
  ownedRoots.delete(synthetic.root);
});

test('child environment construction rejects ambient variables by exact-key construction', () => {
  const root = createOwnedRoot(ADMIN_TEST_ENVIRONMENT_ROOT_PREFIX);
  const environmentFile = path.join(root, ADMIN_TEST_ENVIRONMENT_FILE);
  fs.writeFileSync(environmentFile, 'synthetic=only\n');
  const environment = buildChildEnvironment(root, environmentFile);
  const expectedKeys = [
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
  if (process.platform === 'win32' && process.env.SystemRoot) expectedKeys.push('SystemRoot');
  expect(Object.keys(environment).sort()).toEqual(expectedKeys.sort());
  expect(environment).toMatchObject({
    BABEL_ENV: 'test',
    CI: 'true',
    NODE_ENV: 'test',
    PATH_TEST_ENV_FILE: environmentFile,
    TEMP: root,
    TMP: root,
    TMPDIR: root,
  });
});

test('synthetic environment teardown proves zero residue when execution fails', () => {
  let failedRoot;
  expect(() => withSyntheticTestEnvironment((synthetic) => {
    failedRoot = synthetic.root;
    throw new Error('deliberate focused failure');
  })).toThrow('deliberate focused failure');
  expect(failedRoot).toMatch(new RegExp(`${ADMIN_TEST_ENVIRONMENT_ROOT_PREFIX}`));
  expect(fs.existsSync(failedRoot)).toBe(false);
});
