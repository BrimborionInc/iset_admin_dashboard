'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ADMIN_TEST_ENVIRONMENT_FILE = 'synthetic.env';
const ADMIN_TEST_ENVIRONMENT_ROOT_PREFIX = 'path-admin-test-environment-';
const LEGACY_PRODUCTION_ENVIRONMENT_FILE = '/home/ec2-user/admin-dashboard/.env';

function isWithin(root, candidate) {
  const relativePath = path.relative(root, candidate);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveOwnedTestEnvironmentFile(environment) {
  const configuredPath = String(environment.PATH_TEST_ENV_FILE || '');
  if (!configuredPath || !path.isAbsolute(configuredPath)) {
    throw new Error('NODE_ENV=test requires an absolute PATH_TEST_ENV_FILE');
  }
  const configuredStat = fs.lstatSync(configuredPath);
  if (!configuredStat.isFile() || configuredStat.isSymbolicLink()) {
    throw new Error('PATH_TEST_ENV_FILE must be an owned regular file');
  }
  const realPath = fs.realpathSync(configuredPath);
  const realTemporaryRoot = fs.realpathSync(os.tmpdir());
  const owningRoot = path.dirname(realPath);
  if (
    path.basename(realPath) !== ADMIN_TEST_ENVIRONMENT_FILE
    || !path.basename(owningRoot).startsWith(ADMIN_TEST_ENVIRONMENT_ROOT_PREFIX)
    || !isWithin(realTemporaryRoot, realPath)
  ) {
    throw new Error('PATH_TEST_ENV_FILE is outside an owned admin test-environment root');
  }
  return realPath;
}

function resolveAdminEnvironmentFile({ serverRoot, environment = process.env } = {}) {
  if (!serverRoot || !path.isAbsolute(serverRoot)) {
    throw new Error('serverRoot must be an absolute path');
  }
  if (environment.NODE_ENV === 'test') {
    return resolveOwnedTestEnvironmentFile(environment);
  }
  const localEnvironmentFile = path.resolve(serverRoot, '.env');
  if (environment.NODE_ENV === 'production' && !fs.existsSync(localEnvironmentFile)) {
    return LEGACY_PRODUCTION_ENVIRONMENT_FILE;
  }
  return localEnvironmentFile;
}

module.exports = {
  ADMIN_TEST_ENVIRONMENT_FILE,
  ADMIN_TEST_ENVIRONMENT_ROOT_PREFIX,
  LEGACY_PRODUCTION_ENVIRONMENT_FILE,
  resolveAdminEnvironmentFile,
};
