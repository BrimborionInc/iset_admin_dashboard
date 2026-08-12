'use strict';

const {
  existsSync, lstatSync, readFileSync, readdirSync, realpathSync,
} = require('node:fs');
const {
  extname, isAbsolute, join, relative, resolve, sep,
} = require('node:path');

const { canonicalize, digestBytes, digestCanonical, parseStrictJson } = require('./canonical-json');

const PACK_SCHEMA_VERSION = '1.0.0';
const REGISTRY_SCHEMA_VERSION = '1.0.0';
const ROLE_SCHEMA_VERSION = '1.8.0';
const NATIVE_READONLY_ADAPTER_VERSION = '2.0.0';
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,255}$/u;
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/u;
const PRODUCT_INPUTS = Object.freeze([
  'package.json',
  'scripts/admin-ai-eval-fixtures-check.js',
  'docs/testing/admin-ai-chatbot-eval-fixtures.json',
]);
const PRIVACY_ROUTE_INPUTS = Object.freeze([
  'package.json',
  'package-lock.json',
  'scripts/privacy-route-scope-smoke.js',
  'src/lib/privacyRouteScopeChecks.js',
  'tests/privacyRouteScopeSmoke.test.js',
  'tests/jest.config.js',
  'isetadminserver.js',
  'src/widgets/CoordinatorAssessmentWidget.js',
  '../ISET-intake/server.js',
  'node_modules/jest/bin/jest.js',
]);
const ADMIN_LINT_SOURCE_SCOPE = 'src/**/*.{js,jsx}';
const ADMIN_LINT_DEPENDENCY_SCOPE = 'node_modules/{admin-eslint-runtime}';
const ADMIN_LINT_DEPENDENCY_PACKAGES = Object.freeze([
  'eslint',
  'eslint-config-react-app',
  '@babel/core',
  '@babel/eslint-parser',
  '@rushstack/eslint-patch',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  'babel-preset-react-app',
  'confusing-browser-globals',
  'eslint-plugin-flowtype',
  'eslint-plugin-import',
  'eslint-plugin-jest',
  'eslint-plugin-jsx-a11y',
  'eslint-plugin-react',
  'eslint-plugin-react-hooks',
  'eslint-plugin-testing-library',
]);
const ADMIN_LINT_INPUTS = Object.freeze([
  'package.json',
  'package-lock.json',
  '.eslintrc.cjs',
  'node_modules/eslint/bin/eslint.js',
  ADMIN_LINT_DEPENDENCY_SCOPE,
  ADMIN_LINT_SOURCE_SCOPE,
]);
const PORTAL_LINT_SOURCE_SCOPE = '../ISET-intake/src/**/*.{js,jsx}';
const PORTAL_LINT_DEPENDENCY_SCOPE = '../ISET-intake/node_modules/{portal-eslint-runtime}';
const PORTAL_LINT_DEPENDENCY_PACKAGES = ADMIN_LINT_DEPENDENCY_PACKAGES;
const PORTAL_LINT_INPUTS = Object.freeze([
  '../ISET-intake/package.json',
  '../ISET-intake/package-lock.json',
  '../ISET-intake/node_modules/eslint/bin/eslint.js',
  PORTAL_LINT_DEPENDENCY_SCOPE,
  PORTAL_LINT_SOURCE_SCOPE,
]);
const ADMIN_AGGREGATE_PRODUCT_SCOPE = 'admin-aggregate/{src,tests,scripts,server,declared-sql}';
const ADMIN_AGGREGATE_EXTERNAL_SCOPE = 'admin-aggregate/{portal,shared}-declared-inputs';
const ADMIN_AGGREGATE_DEPENDENCY_SCOPE = 'node_modules/{admin-test-runtime}';
const ADMIN_AGGREGATE_DEPENDENCY_ROOTS = Object.freeze([
  'babel-jest',
  'jest',
  'react-scripts',
]);
const ADMIN_AGGREGATE_DECLARED_ROOT_INPUTS = Object.freeze([
  'docs/testing/admin-ai-chatbot-eval-fixtures.json',
  'sql/migrations/20260511_0001_add_payment_followup_model.sql',
  'sql/migrations/20260711_0001_verify_runtime_schema_ownership.sql',
  'sql/migrations/20260711_0003_add_durable_event_delivery.sql',
  'sql/migrations/20260712_0001_add_payment_submission_attempt.sql',
  'sql/ops/update-payment-evidence-baseline-20260523.sql',
]);
const ADMIN_AGGREGATE_INPUTS = Object.freeze([
  'package.json',
  'package-lock.json',
  'scripts/run-test-all.js',
  'tests/jest.config.js',
  'node_modules/react-scripts/scripts/test.js',
  'node_modules/jest/bin/jest.js',
  ADMIN_AGGREGATE_PRODUCT_SCOPE,
  ADMIN_AGGREGATE_EXTERNAL_SCOPE,
  ADMIN_AGGREGATE_DEPENDENCY_SCOPE,
]);
const PACK_CONTRACTS = Object.freeze({
  'ai-guidance-contract': Object.freeze({
    packVersion: '1.0.1',
    manifestPath: 'packs/admin-ai-guidance-contract.pack.json',
    testLevel: 'component/contract',
    inputCount: 5,
    externalInputs: PRODUCT_INPUTS,
    capabilities: Object.freeze(['process.readonly.local']),
    effectClass: 'read-only',
    writePaths: Object.freeze([]),
    cleanup: Object.freeze({ required: false, residueDecision: 'unnecessary-read-only' }),
    knownBadProfiles: Object.freeze(['invalid-fixture']),
    nativeAuthority: Object.freeze({
      workingDirectory: '.',
      packageManifestPath: 'package.json',
      packageScriptName: 'ai:eval:check',
      packageScriptValue: 'node scripts/admin-ai-eval-fixtures-check.js',
      scriptPath: 'scripts/admin-ai-eval-fixtures-check.js',
      defaultFixturePath: 'docs/testing/admin-ai-chatbot-eval-fixtures.json',
      knownBadFixturePath: 'qualification/test/fixtures/packs/admin-ai-guidance-contract.invalid.json',
      directKnownGoodCommand: ['npm', 'run', 'ai:eval:check'],
      directDeliberateFailureCommand: [
        'npm', 'run', 'ai:eval:check', '--',
        'qualification/test/fixtures/packs/admin-ai-guidance-contract.invalid.json',
      ],
      semanticResultAuthority: 'native-exit-status',
    }),
  }),
  'privacy-route-static': Object.freeze({
    packVersion: '1.0.2',
    manifestPath: 'packs/admin-privacy-route-static.pack.json',
    testLevel: 'component/contract',
    inputCount: 11,
    externalInputs: PRIVACY_ROUTE_INPUTS,
    capabilities: Object.freeze(['process.readonly.local']),
    effectClass: 'read-only',
    writePaths: Object.freeze([]),
    cleanup: Object.freeze({ required: false, residueDecision: 'unnecessary-read-only' }),
    knownBadProfiles: Object.freeze(['mutation-proof']),
    nativeAuthority: Object.freeze({
      workingDirectory: '.',
      packageManifestPath: 'package.json',
      packageScriptName: 'smoke:privacy-routes',
      packageScriptValue: 'node scripts/privacy-route-scope-smoke.js',
      scriptPath: 'scripts/privacy-route-scope-smoke.js',
      defaultFixturePath: null,
      knownBadFixturePath: 'tests/privacyRouteScopeSmoke.test.js',
      directKnownGoodCommand: ['npm', 'run', 'smoke:privacy-routes', '--', '--json'],
      directDeliberateFailureCommand: [
        'npm', 'run', 'test:backend', '--', '--runTestsByPath',
        'tests/privacyRouteScopeSmoke.test.js', '--no-cache',
      ],
      semanticResultAuthority: 'native-exit-status',
    }),
  }),
  'admin-lint': Object.freeze({
    packVersion: '1.0.2',
    manifestPath: 'packs/admin-lint.pack.json',
    testLevel: 'component/contract',
    inputCount: 8,
    externalInputs: ADMIN_LINT_INPUTS,
    capabilities: Object.freeze(['process.readonly.local']),
    effectClass: 'read-only',
    writePaths: Object.freeze([]),
    cleanup: Object.freeze({ required: false, residueDecision: 'unnecessary-read-only' }),
    knownBadProfiles: Object.freeze(['deliberate-lint-error']),
    nativeAuthority: Object.freeze({
      workingDirectory: '.',
      packageManifestPath: 'package.json',
      packageScriptName: 'lint',
      packageScriptValue: 'eslint --ext .js,.jsx src',
      scriptPath: 'node_modules/eslint/bin/eslint.js',
      defaultFixturePath: null,
      knownBadFixturePath: 'qualification/test/fixtures/packs/admin-lint.invalid.js',
      directKnownGoodCommand: ['npm', 'run', 'lint', '--', '--quiet', '--no-cache'],
      directDeliberateFailureCommand: [
        'node', 'node_modules/eslint/bin/eslint.js', '--config', '.eslintrc.cjs',
        '--ext', '.js,.jsx', '--quiet', '--no-cache', '--no-ignore',
        'qualification/test/fixtures/packs/admin-lint.invalid.js',
      ],
      semanticResultAuthority: 'native-exit-status',
    }),
  }),
  'portal-lint': Object.freeze({
    packVersion: '1.0.1',
    manifestPath: 'packs/portal-lint.pack.json',
    ownerRepositoryId: 'ISET-intake',
    testLevel: 'component/contract',
    inputCount: 7,
    externalInputs: PORTAL_LINT_INPUTS,
    capabilities: Object.freeze(['process.readonly.local']),
    effectClass: 'read-only',
    writePaths: Object.freeze([]),
    cleanup: Object.freeze({ required: false, residueDecision: 'unnecessary-read-only' }),
    knownBadProfiles: Object.freeze(['deliberate-lint-error']),
    nativeAuthority: Object.freeze({
      workingDirectory: '../ISET-intake',
      packageManifestPath: '../ISET-intake/package.json',
      packageScriptName: 'lint',
      packageScriptValue: 'eslint --ext .js,.jsx src',
      scriptPath: '../ISET-intake/node_modules/eslint/bin/eslint.js',
      defaultFixturePath: null,
      knownBadFixturePath: 'qualification/test/fixtures/packs/portal-lint.invalid.js',
      directKnownGoodCommand: ['npm', 'run', 'lint', '--', '--quiet', '--no-cache'],
      directDeliberateFailureCommand: [
        'node', 'node_modules/eslint/bin/eslint.js', '--no-eslintrc', '--config', 'package.json',
        '--ext', '.js,.jsx', '--quiet', '--no-cache', '--no-ignore',
        '../admin-dashboard/qualification/test/fixtures/packs/portal-lint.invalid.js',
      ],
      semanticResultAuthority: 'native-exit-status',
    }),
  }),
  'admin-aggregate': Object.freeze({
    packVersion: '1.0.2',
    manifestPath: 'packs/admin-aggregate.pack.json',
    testLevel: 'local system',
    inputCount: 12,
    externalInputs: ADMIN_AGGREGATE_INPUTS,
    capabilities: Object.freeze([
      'process.readonly.local',
      'filesystem.temporary.local-write',
      'network.loopback.local',
    ]),
    effectClass: 'local-write',
    writePaths: Object.freeze(['qualification-owned-attempt-mirror', 'native-test-owned-temporary-roots']),
    cleanup: Object.freeze({ required: true, residueDecision: 'independent-zero-residue-required' }),
    knownBadProfiles: Object.freeze(['frontend-failure', 'backend-failure']),
    nativeAuthority: Object.freeze({
      workingDirectory: '.',
      packageManifestPath: 'package.json',
      packageScriptName: 'test',
      packageScriptValue: 'node scripts/run-test-all.js',
      scriptPath: 'scripts/run-test-all.js',
      defaultFixturePath: null,
      knownBadFixturePath: 'qualification/test/fixtures/packs/admin-aggregate-negative/frontend-failure.test.js',
      directKnownGoodCommand: ['npm', 'test'],
      directDeliberateFailureCommand: ['npm', 'test'],
      semanticResultAuthority: 'native-exit-status',
    }),
  }),
});
const AUTHORIZED_PACK_IDS = Object.freeze(Object.keys(PACK_CONTRACTS));

class PackValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PackValidationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PackValidationError(code, message, details);
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_SHAPE', `${label} must be an object`);
  }
}

function assertExactKeys(value, required, optional, label) {
  assertRecord(value, label);
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length || unknown.length) {
    fail('INVALID_SHAPE', `${label} has missing or unknown fields`, { missing, unknown });
  }
}

function assertId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail('INVALID_VALUE', `${label} is invalid`);
}

function assertVersion(value, label) {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) fail('INVALID_VALUE', `${label} is not a version`);
}

function assertUniqueStrings(value, label) {
  if (!Array.isArray(value)) fail('INVALID_SHAPE', `${label} must be an array`);
  const seen = new Set();
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.length === 0 || item.includes('\0')) {
      fail('INVALID_VALUE', `${label}[${index}] must be a non-empty NUL-free string`);
    }
    if (seen.has(item)) fail('DUPLICATE_VALUE', `${label} repeats ${item}`);
    seen.add(item);
  });
}

function assertDigest(digest, label) {
  assertExactKeys(digest, ['algorithm', 'value'], [], label);
  if (digest.algorithm !== 'sha256' || !DIGEST_PATTERN.test(digest.value)) {
    fail('INVALID_DIGEST', `${label} must be a lowercase SHA-256 digest`);
  }
}

function assertContentDigest(value, label) {
  assertDigest(value.contentDigest, `${label}.contentDigest`);
  const material = { ...value };
  delete material.contentDigest;
  const expected = digestCanonical(material);
  if (value.contentDigest.value !== expected) {
    fail('STALE_DIGEST', `${label} content digest is stale`, {
      expected,
      actual: value.contentDigest.value,
    });
  }
}

function assertPathWithin(root, candidate, label) {
  const relativePath = relative(root, candidate);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    fail('PATH_OUTSIDE_ROOT', `${label} resolves outside its admitted root`, { root, candidate });
  }
}

function resolveVerifiedPath(root, relativePath, expectedDigest, label) {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || isAbsolute(relativePath)) {
    fail('INVALID_PATH', `${label} must be a non-empty relative path`);
  }
  const candidate = realpathSync(resolve(root, relativePath));
  assertPathWithin(root, candidate, label);
  const observedDigest = digestBytes(readFileSync(candidate));
  if (observedDigest !== expectedDigest) {
    fail('INPUT_FINGERPRINT_DRIFT', `${label} no longer matches its admitted digest`, {
      path: relativePath,
      expected: expectedDigest,
      observed: observedDigest,
    });
  }
  return candidate;
}

function resolveAuthorizedExternalPath(repository, relativePath, label) {
  const candidate = realpathSync(resolve(repository, relativePath));
  if (relativePath.startsWith('../ISET-intake/')) {
    const portalRoot = realpathSync(resolve(repository, '../ISET-intake'));
    assertPathWithin(portalRoot, candidate, label);
    return candidate;
  }
  assertPathWithin(repository, candidate, label);
  return candidate;
}

function normalizedRelative(root, path) {
  return relative(root, path).split(sep).join('/');
}

function collectFiles(root, includeFile, label, excludeDirectory = () => false) {
  const admittedRoot = realpathSync(root);
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => (
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    ))) {
      const path = join(directory, entry.name);
      const stat = lstatSync(path);
      if (stat.isDirectory() && excludeDirectory(path, entry.name)) {
        continue;
      }
      if (stat.isSymbolicLink()) fail('SCOPE_PATH_CONFLICT', `${label} contains a symbolic link`, { path });
      if (stat.isDirectory()) {
        visit(path);
      } else if (stat.isFile() && includeFile(path)) {
        files.push({
          path: normalizedRelative(admittedRoot, path),
          contentDigest: digestBytes(readFileSync(path)),
        });
      } else if (!stat.isFile()) {
        fail('SCOPE_PATH_CONFLICT', `${label} contains an unsupported filesystem entry`, { path });
      }
    }
  };
  visit(admittedRoot);
  return files;
}

function digestScope(scope) {
  return digestCanonical(scope);
}

function collectAdminLintSourceScope(repositoryRoot) {
  const repository = realpathSync(repositoryRoot);
  const sourceRoot = realpathSync(resolve(repository, 'src'));
  assertPathWithin(repository, sourceRoot, 'admin lint source scope');
  const files = collectFiles(
    sourceRoot,
    (path) => ['.js', '.jsx'].includes(extname(path)),
    'admin lint source scope',
  ).map((file) => ({ ...file, path: `src/${file.path}` }));
  if (!files.length) fail('SCOPE_PATH_CONFLICT', 'Admin lint source scope is empty');
  const material = { pattern: ADMIN_LINT_SOURCE_SCOPE, files };
  return Object.freeze({ ...material, contentDigest: digestScope(material) });
}

function collectAdminLintDependencyScope(repositoryRoot) {
  const repository = realpathSync(repositoryRoot);
  const modulesRoot = realpathSync(resolve(repository, 'node_modules'));
  const packages = ADMIN_LINT_DEPENDENCY_PACKAGES.map((packageName) => {
    const packageRoot = realpathSync(resolve(modulesRoot, packageName));
    assertPathWithin(modulesRoot, packageRoot, `admin lint dependency ${packageName}`);
    const files = collectFiles(
      packageRoot,
      () => true,
      `admin lint dependency ${packageName}`,
      (_path, name) => name === 'node_modules',
    )
      .map((file) => ({ ...file, path: `${packageName}/${file.path}` }));
    if (!files.length) fail('SCOPE_PATH_CONFLICT', `Admin lint dependency ${packageName} is empty`);
    return { packageName, files };
  });
  const material = { scope: ADMIN_LINT_DEPENDENCY_SCOPE, packages };
  return Object.freeze({ ...material, contentDigest: digestScope(material) });
}

function collectPortalLintSourceScope(repositoryRoot) {
  const repository = realpathSync(repositoryRoot);
  const portalRoot = realpathSync(resolve(repository, '../ISET-intake'));
  const sourceRoot = realpathSync(resolve(portalRoot, 'src'));
  assertPathWithin(portalRoot, sourceRoot, 'portal lint source scope');
  const files = collectFiles(
    sourceRoot,
    (path) => ['.js', '.jsx'].includes(extname(path)),
    'portal lint source scope',
  ).map((file) => ({ ...file, path: `src/${file.path}` }));
  if (!files.length) fail('SCOPE_PATH_CONFLICT', 'Portal lint source scope is empty');
  const material = { pattern: PORTAL_LINT_SOURCE_SCOPE, files };
  return Object.freeze({ ...material, contentDigest: digestScope(material) });
}

function collectPortalLintDependencyScope(repositoryRoot) {
  const repository = realpathSync(repositoryRoot);
  const portalRoot = realpathSync(resolve(repository, '../ISET-intake'));
  const modulesRoot = realpathSync(resolve(portalRoot, 'node_modules'));
  const packages = PORTAL_LINT_DEPENDENCY_PACKAGES.map((packageName) => {
    const packageRoot = realpathSync(resolve(modulesRoot, packageName));
    assertPathWithin(modulesRoot, packageRoot, `portal lint dependency ${packageName}`);
    const files = collectFiles(
      packageRoot,
      () => true,
      `portal lint dependency ${packageName}`,
      (_path, name) => name === 'node_modules',
    ).map((file) => ({ ...file, path: `${packageName}/${file.path}` }));
    if (!files.length) fail('SCOPE_PATH_CONFLICT', `Portal lint dependency ${packageName} is empty`);
    return { packageName, files };
  });
  const material = { scope: PORTAL_LINT_DEPENDENCY_SCOPE, packages };
  return Object.freeze({ ...material, contentDigest: digestScope(material) });
}

function collectPrefixedFiles(root, prefix, label, excludeDirectory = () => false) {
  return collectFiles(root, () => true, label, excludeDirectory)
    .map((file) => ({ ...file, path: `${prefix}/${file.path}` }));
}

function collectAdminAggregateProductScope(repositoryRoot) {
  const repository = realpathSync(repositoryRoot);
  const files = [
    ...collectPrefixedFiles(resolve(repository, 'src'), 'src', 'admin aggregate src scope'),
    ...collectPrefixedFiles(resolve(repository, 'tests'), 'tests', 'admin aggregate test scope'),
    ...collectPrefixedFiles(resolve(repository, 'scripts'), 'scripts', 'admin aggregate script scope'),
    {
      path: 'isetadminserver.js',
      contentDigest: digestBytes(readFileSync(resolve(repository, 'isetadminserver.js'))),
    },
    ...ADMIN_AGGREGATE_DECLARED_ROOT_INPUTS.map((path) => ({
      path,
      contentDigest: digestBytes(readFileSync(resolve(repository, path))),
    })),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const material = { scope: ADMIN_AGGREGATE_PRODUCT_SCOPE, files };
  return Object.freeze({ ...material, contentDigest: digestScope(material) });
}

function collectAdminAggregateExternalScope(repositoryRoot) {
  const repository = realpathSync(repositoryRoot);
  const portalRoot = realpathSync(resolve(repository, '../ISET-intake'));
  const sharedRoot = realpathSync(resolve(repository, '../shared'));
  const files = [
    ...collectPrefixedFiles(resolve(portalRoot, 'src'), '../ISET-intake/src', 'admin aggregate portal src scope'),
    ...collectPrefixedFiles(
      resolve(portalRoot, 'notifications'),
      '../ISET-intake/notifications',
      'admin aggregate portal notification scope',
    ),
    ...collectPrefixedFiles(
      sharedRoot,
      '../shared',
      'admin aggregate shared scope',
      (_path, name) => ['.git', 'node_modules', 'tmp'].includes(name),
    ),
    ...[
      'package.json',
      'server.js',
      's3Provider.js',
      'scripts/run-test-all.js',
    ].map((path) => ({
      path: `../ISET-intake/${path}`,
      contentDigest: digestBytes(readFileSync(resolve(portalRoot, path))),
    })),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const material = { scope: ADMIN_AGGREGATE_EXTERNAL_SCOPE, files };
  return Object.freeze({ ...material, contentDigest: digestScope(material) });
}

function collectAdminAggregateDependencyScope(repositoryRoot) {
  const repository = realpathSync(repositoryRoot);
  const modulesRoot = realpathSync(resolve(repository, 'node_modules'));
  const pending = [...ADMIN_AGGREGATE_DEPENDENCY_ROOTS];
  const discovered = new Set();
  while (pending.length) {
    const packageName = pending.shift();
    if (discovered.has(packageName)) continue;
    const packageRoot = resolve(modulesRoot, packageName);
    if (!existsSync(packageRoot)) continue;
    const resolvedPackageRoot = realpathSync(packageRoot);
    assertPathWithin(modulesRoot, resolvedPackageRoot, `admin aggregate dependency ${packageName}`);
    const manifest = JSON.parse(readFileSync(resolve(resolvedPackageRoot, 'package.json'), 'utf8'));
    discovered.add(packageName);
    for (const dependency of Object.keys({
      ...(manifest.dependencies || {}),
      ...(manifest.optionalDependencies || {}),
      ...(manifest.peerDependencies || {}),
    }).sort()) {
      if (!discovered.has(dependency) && existsSync(resolve(modulesRoot, dependency))) pending.push(dependency);
    }
  }
  const packages = [...discovered].sort().map((packageName) => {
    const packageRoot = realpathSync(resolve(modulesRoot, packageName));
    const files = collectFiles(
      packageRoot,
      () => true,
      `admin aggregate dependency ${packageName}`,
      (_path, name) => name === 'node_modules',
    ).map((file) => ({ ...file, path: `${packageName}/${file.path}` }));
    if (!files.length) fail('SCOPE_PATH_CONFLICT', `Admin aggregate dependency ${packageName} is empty`);
    return { packageName, files };
  });
  const material = { scope: ADMIN_AGGREGATE_DEPENDENCY_SCOPE, packages };
  return Object.freeze({ ...material, contentDigest: digestScope(material) });
}

function validateInput(input, index) {
  const label = `pack.inputs[${index}]`;
  assertExactKeys(input, ['inputId', 'role', 'path', 'contentDigest'], [], label);
  assertId(input.inputId, `${label}.inputId`);
  if (![
    'product-manifest', 'dependency-lock', 'native-runner', 'native-default-fixture',
    'native-test', 'native-config', 'native-dependency', 'native-dependency-scope',
    'product-source', 'product-source-scope', 'certification-fixture',
  ].includes(input.role)) {
    fail('INVALID_VALUE', `${label}.role is unsupported`);
  }
  if (typeof input.path !== 'string' || input.path.length === 0 || isAbsolute(input.path)) {
    fail('INVALID_PATH', `${label}.path must be relative`);
  }
  assertDigest(input.contentDigest, `${label}.contentDigest`);
}

function validatePackManifest(pack) {
  assertExactKeys(pack, [
    'schemaVersion', 'packId', 'packVersion', 'contentDigest', 'purpose', 'productDomain',
    'owner', 'testLevel', 'maturity', 'operatingStatus', 'releaseInfluence', 'nativeAuthority',
    'contractRefs', 'coveredSurfaces', 'requiredAdapter', 'supportedEnvironmentClasses',
    'prerequisites', 'declaredEffects', 'inputs', 'timeouts', 'cleanup', 'evidenceOutputs',
    'failureClassificationInputs', 'certification', 'dependencies', 'limitations',
  ], [], 'pack');
  if (pack.schemaVersion !== PACK_SCHEMA_VERSION) fail('UNSUPPORTED_VERSION', 'Pack schema version is unsupported');
  assertId(pack.packId, 'pack.packId');
  assertVersion(pack.packVersion, 'pack.packVersion');
  const contract = PACK_CONTRACTS[pack.packId];
  if (!contract) fail('PACK_NOT_AUTHORIZED', 'Pack is not authorized by the Phase 3 read-only registry');
  if (pack.packVersion !== contract.packVersion) {
    fail('PACK_VERSION_CONFLICT', 'Pack version differs from the authorized adapter-binding graph');
  }
  if (pack.maturity !== 'advisory' || pack.operatingStatus !== 'active' || pack.releaseInfluence !== 'none') {
    fail('AUTHORITY_CONFLICT', 'Phase 3 pack must remain active advisory evidence with no release influence');
  }
  if (pack.testLevel !== contract.testLevel) fail('INVALID_VALUE', 'Pack test level conflicts with its authorized contract');
  assertExactKeys(pack.owner, ['repositoryId', 'maintainers', 'escalationAuthority'], [], 'pack.owner');
  if (pack.owner.repositoryId !== (contract.ownerRepositoryId || 'admin-dashboard')) {
    fail('OWNERSHIP_CONFLICT', 'Pack ownership differs from the authorized repository');
  }
  assertUniqueStrings(pack.owner.maintainers, 'pack.owner.maintainers');
  assertId(pack.owner.escalationAuthority, 'pack.owner.escalationAuthority');

  assertExactKeys(pack.nativeAuthority, [
    'workingDirectory', 'packageManifestPath', 'packageScriptName', 'packageScriptValue',
    'scriptPath', 'defaultFixturePath', 'knownBadFixturePath', 'directKnownGoodCommand',
    'directDeliberateFailureCommand', 'semanticResultAuthority',
  ], [], 'pack.nativeAuthority');
  if (canonicalize(pack.nativeAuthority) !== canonicalize(contract.nativeAuthority)) {
    fail('NATIVE_AUTHORITY_CONFLICT', 'Native authority binding differs from the authorized direct command');
  }

  assertUniqueStrings(pack.contractRefs, 'pack.contractRefs');
  assertUniqueStrings(pack.coveredSurfaces, 'pack.coveredSurfaces');
  assertExactKeys(pack.requiredAdapter, ['adapterId', 'adapterVersion', 'capabilities'], [], 'pack.requiredAdapter');
  if (pack.requiredAdapter.adapterId !== 'native-readonly-bridge') fail('INVALID_ADAPTER', 'Unexpected adapter');
  assertVersion(pack.requiredAdapter.adapterVersion, 'pack.requiredAdapter.adapterVersion');
  if (pack.requiredAdapter.adapterVersion !== NATIVE_READONLY_ADAPTER_VERSION) {
    fail('INVALID_ADAPTER', 'Pack does not bind the current immutable native read-only adapter version');
  }
  assertUniqueStrings(pack.requiredAdapter.capabilities, 'pack.requiredAdapter.capabilities');
  if (canonicalize(pack.requiredAdapter.capabilities) !== canonicalize(contract.capabilities)) {
    fail('CAPABILITY_CONFLICT', 'Phase 3 adapter capabilities conflict with the pack contract');
  }
  if (canonicalize(pack.supportedEnvironmentClasses) !== canonicalize(['local'])) {
    fail('TARGET_CONFLICT', 'Phase 3 pack supports only local execution');
  }
  assertUniqueStrings(pack.prerequisites, 'pack.prerequisites');
  assertExactKeys(pack.declaredEffects, ['effectClass', 'readPaths', 'writePaths', 'externalEffects'], [], 'pack.declaredEffects');
  if (pack.declaredEffects.effectClass !== contract.effectClass) {
    fail('EFFECT_CONFLICT', 'Pack effect class conflicts with the authorized contract');
  }
  assertUniqueStrings(pack.declaredEffects.readPaths, 'pack.declaredEffects.readPaths');
  assertUniqueStrings(pack.declaredEffects.writePaths, 'pack.declaredEffects.writePaths');
  assertUniqueStrings(pack.declaredEffects.externalEffects, 'pack.declaredEffects.externalEffects');
  if (
    canonicalize(pack.declaredEffects.writePaths) !== canonicalize(contract.writePaths)
    || pack.declaredEffects.externalEffects.length
  ) {
    fail('EFFECT_CONFLICT', 'Pack writes or external effects conflict with the authorized contract');
  }

  if (!Array.isArray(pack.inputs) || pack.inputs.length !== contract.inputCount) {
    fail('INPUT_CONFLICT', `Pack must declare exactly ${contract.inputCount} inputs`);
  }
  pack.inputs.forEach(validateInput);
  const inputIds = pack.inputs.map((input) => input.inputId);
  if (new Set(inputIds).size !== inputIds.length) fail('DUPLICATE_VALUE', 'Pack input IDs must be unique');
  const inputPaths = pack.inputs.map((input) => input.path);
  if (canonicalize(pack.declaredEffects.readPaths) !== canonicalize(inputPaths)) {
    fail('EFFECT_CONFLICT', 'Declared reads must exactly match pack inputs');
  }

  assertExactKeys(pack.timeouts, [
    'startupMs', 'executionMs', 'idleMs', 'gracefulShutdownMs', 'forcedTerminationMs', 'totalMs',
  ], [], 'pack.timeouts');
  Object.entries(pack.timeouts).forEach(([key, value]) => {
    if (!Number.isSafeInteger(value) || value < 1) fail('INVALID_TIMEOUT', `pack.timeouts.${key} must be positive`);
  });
  if (pack.timeouts.idleMs > pack.timeouts.executionMs
    || pack.timeouts.totalMs <= pack.timeouts.gracefulShutdownMs + pack.timeouts.forcedTerminationMs) {
    fail('INVALID_TIMEOUT', 'Pack timeouts do not preserve bounded execution and termination');
  }
  assertExactKeys(pack.cleanup, ['required', 'residueDecision'], [], 'pack.cleanup');
  if (canonicalize(pack.cleanup) !== canonicalize(contract.cleanup)) {
    fail('CLEANUP_CONFLICT', 'Pack cleanup differs from the authorized effect contract');
  }
  assertUniqueStrings(pack.evidenceOutputs, 'pack.evidenceOutputs');
  assertUniqueStrings(pack.failureClassificationInputs, 'pack.failureClassificationInputs');
  assertExactKeys(pack.certification, [
    'status', 'knownGoodRuns', 'directComparisonRuns', 'knownBadProfiles', 'forcedInterruptionRequired',
  ], [], 'pack.certification');
  if (
    pack.certification.status !== 'certified-advisory'
    || pack.certification.knownGoodRuns !== 10
    || pack.certification.directComparisonRuns !== 5
    || canonicalize(pack.certification.knownBadProfiles) !== canonicalize(contract.knownBadProfiles)
    || pack.certification.forcedInterruptionRequired !== true
  ) fail('CERTIFICATION_CONFLICT', 'Pack certification declaration differs from the accepted threshold');
  assertUniqueStrings(pack.dependencies, 'pack.dependencies');
  if (pack.dependencies.length) fail('DEPENDENCY_CONFLICT', 'Phase 3 read-only packs cannot gain undeclared dependencies');
  assertUniqueStrings(pack.limitations, 'pack.limitations');
  assertContentDigest(pack, 'pack');
  return pack;
}

function validateRegistry(registry, pack) {
  assertExactKeys(registry, [
    'schemaVersion', 'registryId', 'contentDigest', 'selectionAuthority', 'releaseAuthority', 'packs',
  ], [], 'registry');
  if (registry.schemaVersion !== REGISTRY_SCHEMA_VERSION) fail('UNSUPPORTED_VERSION', 'Registry version is unsupported');
  if (registry.registryId !== 'phase3-read-only') fail('REGISTRY_NOT_AUTHORIZED', 'Unexpected Phase 3 registry');
  if (registry.selectionAuthority !== 'advisory-certification-only' || registry.releaseAuthority !== 'none') {
    fail('AUTHORITY_CONFLICT', 'Phase 3 registry must not grant selection or release authority');
  }
  if (!Array.isArray(registry.packs) || registry.packs.length !== AUTHORIZED_PACK_IDS.length) {
    fail('REGISTRY_SCOPE_CONFLICT', 'Phase 3 registry does not contain the exact authorized pack set');
  }
  registry.packs.forEach((entry, index) => {
    assertExactKeys(entry, [
      'packId', 'packVersion', 'manifestPath', 'manifestDigest', 'maturity', 'operatingStatus',
    ], [], `registry.packs[${index}]`);
    assertDigest(entry.manifestDigest, `registry.packs[${index}].manifestDigest`);
  });
  const registryIds = registry.packs.map((entry) => entry.packId);
  if (canonicalize(registryIds) !== canonicalize(AUTHORIZED_PACK_IDS)) {
    fail('REGISTRY_SCOPE_CONFLICT', 'Phase 3 registry pack IDs differ from the authorized set');
  }
  const matches = registry.packs.filter((entry) => entry.packId === pack.packId);
  if (matches.length !== 1) fail('REGISTRY_PACK_CONFLICT', 'Validated pack is not uniquely registered');
  const entry = matches[0];
  const contract = PACK_CONTRACTS[pack.packId];
  if (
    entry.packId !== pack.packId
    || entry.packVersion !== pack.packVersion
    || entry.manifestPath !== contract.manifestPath
    || entry.manifestDigest.value !== pack.contentDigest.value
    || entry.maturity !== pack.maturity
    || entry.operatingStatus !== pack.operatingStatus
  ) fail('REGISTRY_PACK_CONFLICT', 'Registry entry conflicts with the validated pack');
  assertContentDigest(registry, 'registry');
  return registry;
}

function validateRoleManifest(roleManifest) {
  assertExactKeys(roleManifest, [
    'schemaVersion', 'manifestId', 'contentDigest', 'roles', 'externalReadOnlyInputs',
    'packExternalReadOnlyInputs', 'unlistedExternalInputsProhibited', 'prohibitedRoots',
  ], [], 'role manifest');
  if (roleManifest.schemaVersion !== ROLE_SCHEMA_VERSION) fail('UNSUPPORTED_VERSION', 'Role manifest version is unsupported');
  if (roleManifest.manifestId !== 'path.release-qualification.phase3f.roles') {
    fail('ROLE_MANIFEST_CONFLICT', 'Role manifest is not bound to the completed Phase 3 pack set');
  }
  assertExactKeys(roleManifest.roles, ['harness', 'certification', 'documentation'], [], 'role manifest.roles');
  Object.entries(roleManifest.roles).forEach(([role, paths]) => assertUniqueStrings(paths, `role manifest.roles.${role}`));
  assertUniqueStrings(roleManifest.externalReadOnlyInputs, 'role manifest.externalReadOnlyInputs');
  if (canonicalize(roleManifest.externalReadOnlyInputs) !== canonicalize(PRODUCT_INPUTS)) {
    fail('ROLE_MANIFEST_CONFLICT', 'Baseline external inputs differ from the accepted Sprint 3A scope');
  }
  assertExactKeys(
    roleManifest.packExternalReadOnlyInputs,
    ['privacy-route-static', 'admin-lint', 'portal-lint', 'admin-aggregate'],
    [],
    'role manifest.packExternalReadOnlyInputs',
  );
  assertUniqueStrings(
    roleManifest.packExternalReadOnlyInputs['privacy-route-static'],
    'role manifest.packExternalReadOnlyInputs.privacy-route-static',
  );
  if (canonicalize(roleManifest.packExternalReadOnlyInputs['privacy-route-static']) !== canonicalize(PRIVACY_ROUTE_INPUTS)) {
    fail('ROLE_MANIFEST_CONFLICT', 'Privacy-route external inputs differ from the authorized Sprint 3B scope');
  }
  assertUniqueStrings(
    roleManifest.packExternalReadOnlyInputs['admin-lint'],
    'role manifest.packExternalReadOnlyInputs.admin-lint',
  );
  if (canonicalize(roleManifest.packExternalReadOnlyInputs['admin-lint']) !== canonicalize(ADMIN_LINT_INPUTS)) {
    fail('ROLE_MANIFEST_CONFLICT', 'Admin lint inputs differ from the authorized Sprint 3D scope');
  }
  assertUniqueStrings(
    roleManifest.packExternalReadOnlyInputs['portal-lint'],
    'role manifest.packExternalReadOnlyInputs.portal-lint',
  );
  if (canonicalize(roleManifest.packExternalReadOnlyInputs['portal-lint']) !== canonicalize(PORTAL_LINT_INPUTS)) {
    fail('ROLE_MANIFEST_CONFLICT', 'Portal lint inputs differ from the authorized Sprint 3E scope');
  }
  assertUniqueStrings(
    roleManifest.packExternalReadOnlyInputs['admin-aggregate'],
    'role manifest.packExternalReadOnlyInputs.admin-aggregate',
  );
  if (canonicalize(roleManifest.packExternalReadOnlyInputs['admin-aggregate']) !== canonicalize(ADMIN_AGGREGATE_INPUTS)) {
    fail('ROLE_MANIFEST_CONFLICT', 'Admin aggregate inputs differ from the authorized Sprint 3F scope');
  }
  if (roleManifest.unlistedExternalInputsProhibited !== true) {
    fail('ROLE_MANIFEST_CONFLICT', 'Unlisted external inputs must fail closed');
  }
  assertUniqueStrings(roleManifest.prohibitedRoots, 'role manifest.prohibitedRoots');
  assertContentDigest(roleManifest, 'role manifest');
  return roleManifest;
}

function readStrictJson(path, label) {
  try {
    return parseStrictJson(readFileSync(path));
  } catch (error) {
    if (error instanceof PackValidationError) throw error;
    fail('INVALID_JSON', `${label} is not strict JSON`, { cause: error.code || error.message });
  }
}

function verifyPackInputs(pack, repositoryRoot, allowedExternalInputs = PRODUCT_INPUTS) {
  const repository = realpathSync(repositoryRoot);
  const allowedExternal = new Set(allowedExternalInputs);
  for (const input of pack.inputs) {
    if (input.role !== 'certification-fixture' && !allowedExternal.has(input.path)) {
      fail('UNDECLARED_EXTERNAL_INPUT', `Pack input ${input.path} is not externally authorized`);
    }
    let observedDigest;
    if (input.role === 'product-source-scope') {
      if (pack.packId === 'admin-aggregate') {
        if (input.path === ADMIN_AGGREGATE_PRODUCT_SCOPE) {
          observedDigest = collectAdminAggregateProductScope(repository).contentDigest;
        } else if (input.path === ADMIN_AGGREGATE_EXTERNAL_SCOPE) {
          observedDigest = collectAdminAggregateExternalScope(repository).contentDigest;
        } else {
          fail('INPUT_BINDING_CONFLICT', 'Admin aggregate source scope is not exact');
        }
      } else {
        const portalLint = pack.packId === 'portal-lint';
        const expectedScope = portalLint ? PORTAL_LINT_SOURCE_SCOPE : ADMIN_LINT_SOURCE_SCOPE;
        if (input.path !== expectedScope) fail('INPUT_BINDING_CONFLICT', 'Lint source scope is not exact');
        observedDigest = portalLint
          ? collectPortalLintSourceScope(repository).contentDigest
          : collectAdminLintSourceScope(repository).contentDigest;
      }
    } else if (input.role === 'native-dependency-scope') {
      if (pack.packId === 'admin-aggregate') {
        if (input.path !== ADMIN_AGGREGATE_DEPENDENCY_SCOPE) {
          fail('INPUT_BINDING_CONFLICT', 'Admin aggregate dependency scope is not exact');
        }
        observedDigest = collectAdminAggregateDependencyScope(repository).contentDigest;
      } else {
        const portalLint = pack.packId === 'portal-lint';
        const expectedScope = portalLint ? PORTAL_LINT_DEPENDENCY_SCOPE : ADMIN_LINT_DEPENDENCY_SCOPE;
        if (input.path !== expectedScope) fail('INPUT_BINDING_CONFLICT', 'Lint dependency scope is not exact');
        observedDigest = portalLint
          ? collectPortalLintDependencyScope(repository).contentDigest
          : collectAdminLintDependencyScope(repository).contentDigest;
      }
    }
    if (observedDigest) {
      if (observedDigest !== input.contentDigest.value) {
        fail('INPUT_FINGERPRINT_DRIFT', `pack input ${input.inputId} no longer matches its admitted digest`, {
          path: input.path,
          expected: input.contentDigest.value,
          observed: observedDigest,
        });
      }
      continue;
    }
    const resolvedPath = input.role === 'certification-fixture'
      ? resolveVerifiedPath(repository, input.path, input.contentDigest.value, `pack input ${input.inputId}`)
      : resolveAuthorizedExternalPath(repository, input.path, `pack input ${input.inputId}`);
    if (input.role !== 'certification-fixture') {
      const observedDigest = digestBytes(readFileSync(resolvedPath));
      if (observedDigest !== input.contentDigest.value) {
        fail('INPUT_FINGERPRINT_DRIFT', `pack input ${input.inputId} no longer matches its admitted digest`, {
          path: input.path,
          expected: input.contentDigest.value,
          observed: observedDigest,
        });
      }
    }
  }

  const packageInput = pack.inputs.find((input) => input.role === 'product-manifest');
  if (!packageInput) fail('INPUT_BINDING_CONFLICT', 'Pack must bind one product package manifest');
  const packageJson = readStrictJson(resolve(repository, packageInput.path), 'product package manifest');
  if (!packageJson.scripts || packageJson.scripts[pack.nativeAuthority.packageScriptName] !== pack.nativeAuthority.packageScriptValue) {
    fail('NATIVE_AUTHORITY_CONFLICT', 'Product package script alias no longer resolves to the admitted native checker');
  }
  if (
    pack.packId === 'privacy-route-static'
    && packageJson.scripts['test:backend'] !== 'node node_modules/jest/bin/jest.js --config tests/jest.config.js --runInBand'
  ) fail('NATIVE_AUTHORITY_CONFLICT', 'Focused mutation command no longer resolves to the admitted Jest authority');
  if (
    pack.packId === 'portal-lint'
    && canonicalize(packageJson.eslintConfig) !== canonicalize({ extends: ['react-app', 'react-app/jest'] })
  ) fail('NATIVE_AUTHORITY_CONFLICT', 'Portal package-level ESLint configuration differs from the admitted authority');
  return true;
}

function validatePackBundle({ repositoryRoot, qualificationRoot, packPath, registryPath, roleManifestPath }) {
  const repository = realpathSync(repositoryRoot);
  const qualification = realpathSync(qualificationRoot);
  assertPathWithin(repository, qualification, 'qualificationRoot');
  const admittedPackPath = realpathSync(packPath);
  const admittedRegistryPath = realpathSync(registryPath);
  const admittedRolePath = realpathSync(roleManifestPath);
  assertPathWithin(qualification, admittedPackPath, 'packPath');
  assertPathWithin(qualification, admittedRegistryPath, 'registryPath');
  assertPathWithin(qualification, admittedRolePath, 'roleManifestPath');

  const pack = validatePackManifest(readStrictJson(admittedPackPath, 'pack'));
  const registry = validateRegistry(readStrictJson(admittedRegistryPath, 'registry'), pack);
  const roleManifest = validateRoleManifest(readStrictJson(admittedRolePath, 'role manifest'));
  const allowedExternalInputs = pack.packId === 'ai-guidance-contract'
    ? roleManifest.externalReadOnlyInputs
    : roleManifest.packExternalReadOnlyInputs[pack.packId];
  verifyPackInputs(pack, repository, allowedExternalInputs);

  return Object.freeze({
    repositoryRoot: repository,
    qualificationRoot: qualification,
    packPath: admittedPackPath,
    registryPath: admittedRegistryPath,
    roleManifestPath: admittedRolePath,
    pack: structuredClone(pack),
    registry: structuredClone(registry),
    roleManifest: structuredClone(roleManifest),
  });
}

module.exports = {
  PACK_SCHEMA_VERSION,
  REGISTRY_SCHEMA_VERSION,
  ROLE_SCHEMA_VERSION,
  NATIVE_READONLY_ADAPTER_VERSION,
  PackValidationError,
  PACK_CONTRACTS,
  PRODUCT_INPUTS,
  PRIVACY_ROUTE_INPUTS,
  ADMIN_LINT_DEPENDENCY_PACKAGES,
  ADMIN_LINT_DEPENDENCY_SCOPE,
  ADMIN_LINT_INPUTS,
  ADMIN_LINT_SOURCE_SCOPE,
  PORTAL_LINT_DEPENDENCY_PACKAGES,
  PORTAL_LINT_DEPENDENCY_SCOPE,
  PORTAL_LINT_INPUTS,
  PORTAL_LINT_SOURCE_SCOPE,
  ADMIN_AGGREGATE_DEPENDENCY_ROOTS,
  ADMIN_AGGREGATE_DEPENDENCY_SCOPE,
  ADMIN_AGGREGATE_EXTERNAL_SCOPE,
  ADMIN_AGGREGATE_INPUTS,
  ADMIN_AGGREGATE_PRODUCT_SCOPE,
  collectAdminAggregateDependencyScope,
  collectAdminAggregateExternalScope,
  collectAdminAggregateProductScope,
  collectAdminLintDependencyScope,
  collectAdminLintSourceScope,
  collectPortalLintDependencyScope,
  collectPortalLintSourceScope,
  digestScope,
  validatePackBundle,
  validatePackManifest,
  validateRegistry,
  validateRoleManifest,
  verifyPackInputs,
};
