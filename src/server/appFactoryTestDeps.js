let dependencies = null;

function assertTestMode() {
  if (process.env.NODE_ENV !== 'test' || process.env.PATH_APP_FACTORY_MODE !== '1') {
    throw new Error('app factory dependencies are available only in explicit test mode');
  }
}

function setAppFactoryTestDependencies(nextDependencies) {
  assertTestMode();
  dependencies = nextDependencies || null;
}

function getAppFactoryTestDependencies() {
  return dependencies;
}

function clearAppFactoryTestDependencies() {
  assertTestMode();
  dependencies = null;
}

module.exports = {
  clearAppFactoryTestDependencies,
  getAppFactoryTestDependencies,
  setAppFactoryTestDependencies,
};
