'use strict';

const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  compareAdvisoryToDirect,
  createAdvisoryRecord,
  createDirectRecord,
} = require('../src/advisory-comparator');
const { digestBytes, digestCanonical } = require('../src/canonical-json');
const {
  createAttemptId,
  createEnvironmentIdentity,
  createHarnessVersion,
  createProductCandidateId,
  createTestPackVersions,
} = require('../src/identities');
const { runAdvisoryProcess } = require('../src/native-readonly-bridge');
const {
  PORTAL_LINT_DEPENDENCY_PACKAGES,
  PORTAL_LINT_DEPENDENCY_SCOPE,
  PORTAL_LINT_SOURCE_SCOPE,
  PackValidationError,
  collectPortalLintDependencyScope,
  collectPortalLintSourceScope,
  digestScope,
  validatePackBundle,
  validatePackManifest,
  validateRegistry,
  validateRoleManifest,
  verifyPackInputs,
} = require('../src/pack-validator');

const repositoryRoot = resolve(__dirname, '..', '..');
const portalRoot = resolve(repositoryRoot, '..', 'ISET-intake');
const qualificationRoot = resolve(__dirname, '..');
const packPath = join(qualificationRoot, 'packs', 'portal-lint.pack.json');
const registryPath = join(qualificationRoot, 'registries', 'phase3-read-only.registry.json');
const roleManifestPath = join(qualificationRoot, 'qualification-role-manifest.json');
const packagePath = join(portalRoot, 'package.json');
const packageLockPath = join(portalRoot, 'package-lock.json');
const eslintCachePath = join(portalRoot, '.eslintcache');

function digest(value) {
  return { algorithm: 'sha256', value };
}

function reference(schemaName, artifactId, value, schemaVersion = '1.0.0') {
  return { schemaName, schemaVersion, artifactId, contentDigest: digest(value) };
}

function refreshContentDigest(value) {
  const material = structuredClone(value);
  delete material.contentDigest;
  return { ...structuredClone(value), contentDigest: digest(digestCanonical(material)) };
}

function expectPackCode(action, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof PackValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

function loadBundle() {
  return validatePackBundle({ repositoryRoot, qualificationRoot, packPath, registryPath, roleManifestPath });
}

const bundle = loadBundle();
const sourceScope = collectPortalLintSourceScope(repositoryRoot);
const dependencyScope = collectPortalLintDependencyScope(repositoryRoot);
const packManifestRef = reference(
  'test-pack-manifest',
  `${bundle.pack.packId}.${bundle.pack.packVersion}`,
  bundle.pack.contentDigest.value,
);
const roleManifestRef = reference(
  'qualification-role-manifest',
  bundle.roleManifest.manifestId,
  bundle.roleManifest.contentDigest.value,
  bundle.roleManifest.schemaVersion,
);
const registryRef = reference(
  'pack-registry',
  bundle.registry.registryId,
  bundle.registry.contentDigest.value,
);
const productCandidateArguments = {
  manifestRefs: [reference(
    'phase3-certification-scope',
    'portal-lint.product-inputs',
    digestCanonical({
      packageDigest: digestBytes(readFileSync(packagePath)),
      dependencyLockDigest: digestBytes(readFileSync(packageLockPath)),
      sourceScopeDigest: sourceScope.contentDigest,
    }),
  )],
  material: {
    repositories: [{
      repositoryRole: 'portal-product-certification-scope',
      repositoryId: 'ISET-intake',
      sourceDigest: sourceScope.contentDigest,
      dependencyDigest: digestCanonical({
        lock: digestBytes(readFileSync(packageLockPath)),
        resolvedLintRuntime: dependencyScope.contentDigest,
      }),
      migrationDigest: digestCanonical({ scope: 'none' }),
      generatedArtifactDigest: digestCanonical({ scope: 'none' }),
    }],
  },
};
const productCandidateId = createProductCandidateId(productCandidateArguments);
const localEnvironmentIdentity = createEnvironmentIdentity({
  manifestRefs: [reference('environment-class', 'phase3e.local-read-only', digestCanonical({ class: 'local' }))],
  target: { targetClass: 'local', targetName: 'portal-source-worktree' },
  material: {
    environmentClass: 'local',
    capability: 'process.readonly.local',
    externalEffects: [],
  },
});
const testPackVersions = createTestPackVersions([{
  packId: bundle.pack.packId,
  packVersion: bundle.pack.packVersion,
  manifestRefs: [packManifestRef],
  material: {
    manifestDigest: bundle.pack.contentDigest.value,
    packageConfigDigest: bundle.pack.inputs.find((input) => input.role === 'product-manifest').contentDigest.value,
    nativeRunnerDigest: bundle.pack.inputs.find((input) => input.role === 'native-runner').contentDigest.value,
    sourceScopeDigest: sourceScope.contentDigest,
    dependencyScopeDigest: dependencyScope.contentDigest,
    deliberateErrorDigest: bundle.pack.inputs.find(
      (input) => input.path === bundle.pack.nativeAuthority.knownBadFixturePath,
    ).contentDigest.value,
  },
}]);
const directHarnessVersion = createHarnessVersion({
  manifestRefs: [packManifestRef],
  material: {
    qualificationSourceDigest: digestCanonical({ mode: 'direct-portal-native-eslint' }),
    dependencyDigest: dependencyScope.contentDigest,
    schemaSetDigest: digestCanonical({ schemas: 'not-applicable-direct' }),
  },
});
const advisoryHarnessVersion = createHarnessVersion({
  manifestRefs: [roleManifestRef, registryRef, packManifestRef],
  material: {
    qualificationSourceDigest: digestCanonical({
      sources: [
        'src/pack-validator.js',
        'src/native-readonly-bridge.js',
        'src/advisory-comparator.js',
        'bin/rq-native-readonly.js',
      ].map((path) => ({ path, digest: digestBytes(readFileSync(join(qualificationRoot, path))) })),
    }),
    dependencyDigest: digestBytes(readFileSync(join(qualificationRoot, 'package-lock.json'))),
    schemaSetDigest: digestCanonical({ phase2SchemaGraph: 'unchanged' }),
  },
});

function attempt(sequence, lane) {
  return createAttemptId(`00000000-0000-4000-8000-${String(sequence).padStart(12, lane === 'direct' ? '9' : '6')}`);
}

function bindings(harnessVersion, attemptId) {
  return {
    productCandidateId,
    harnessVersion,
    attemptId,
    environmentIdentity: localEnvironmentIdentity,
    testPackVersions,
  };
}

function outputEvidence(bytes) {
  return {
    observedBytes: bytes.length,
    capturedBytes: bytes.length,
    truncated: false,
    capturedBase64: bytes.toString('base64'),
    digestAlgorithm: 'sha256',
    capturedDigest: digestBytes(bytes),
  };
}

function directCommand(profile) {
  return profile === 'known-good'
    ? bundle.pack.nativeAuthority.directKnownGoodCommand
    : bundle.pack.nativeAuthority.directDeliberateFailureCommand;
}

function runDirect(profile, attemptId, nativeAuthorityBinding) {
  const command = directCommand(profile);
  const executed = spawnSync(command[0], command.slice(1), {
    cwd: portalRoot,
    env: { PATH: process.env.PATH },
    encoding: null,
    maxBuffer: 1024 * 1024,
    timeout: 90000,
    shell: false,
  });
  if (executed.error) throw executed.error;
  const stdout = executed.stdout || Buffer.alloc(0);
  const stderr = executed.stderr || Buffer.alloc(0);
  return {
    stdout,
    stderr,
    record: createDirectRecord({
      pack: bundle.pack,
      profile,
      identityBindings: bindings(directHarnessVersion, attemptId),
      nativeAuthorityBinding,
      command: {
        executable: command[0],
        arguments: command.slice(1),
        workingDirectory: portalRoot,
      },
      outcome: {
        status: executed.status === 0 ? 'passed' : 'failed',
        exitCode: executed.status,
        signal: executed.signal,
        stdout: outputEvidence(stdout),
        stderr: outputEvidence(stderr),
      },
    }),
  };
}

async function runAdvisory(profile, attemptId) {
  const processResult = await runAdvisoryProcess(bundle, attemptId, profile);
  return {
    processResult,
    record: profile === 'forced-interruption' ? null : createAdvisoryRecord({
      pack: bundle.pack,
      identityBindings: bindings(advisoryHarnessVersion, attemptId),
      processResult,
    }),
  };
}

function boundedInterruptionBundle() {
  const value = structuredClone(bundle);
  value.pack.timeouts = {
    startupMs: 10000,
    executionMs: 500,
    idleMs: 500,
    gracefulShutdownMs: 300,
    forcedTerminationMs: 1000,
    totalMs: 7000,
  };
  return value;
}

function fileState(path) {
  return existsSync(path) ? digestBytes(readFileSync(path)) : null;
}

function sourceState() {
  return {
    package: digestBytes(readFileSync(packagePath)),
    lock: digestBytes(readFileSync(packageLockPath)),
    binary: digestBytes(readFileSync(join(portalRoot, 'node_modules/eslint/bin/eslint.js'))),
    sourceScope: collectPortalLintSourceScope(repositoryRoot).contentDigest,
    dependencyScope: collectPortalLintDependencyScope(repositoryRoot).contentDigest,
    cache: fileState(eslintCachePath),
  };
}

test('portal pack, exact cumulative registry, role boundary, and src-only authority validate', () => {
  assert.equal(bundle.pack.packVersion, '1.0.1');
  assert.equal(bundle.pack.requiredAdapter.adapterVersion, '2.0.0');
  assert.equal(bundle.pack.packId, 'portal-lint');
  assert.equal(bundle.pack.owner.repositoryId, 'ISET-intake');
  assert.equal(bundle.pack.maturity, 'advisory');
  assert.equal(bundle.pack.releaseInfluence, 'none');
  assert.deepEqual(bundle.registry.packs.map((entry) => entry.packId), [
    'ai-guidance-contract',
    'privacy-route-static',
    'admin-lint',
    'portal-lint',
    'admin-aggregate',
  ]);
  assert.deepEqual(
    bundle.roleManifest.packExternalReadOnlyInputs['portal-lint'],
    bundle.pack.inputs.filter((input) => input.role !== 'certification-fixture').map((input) => input.path),
  );
  assert.equal(bundle.registry.releaseAuthority, 'none');
  assert.ok(bundle.pack.limitations.includes(
    'Portal server, auth, notifications, routes, tests, scripts, and files outside src are not covered by this pack.',
  ));
});

test('portal source and resolved dependency scopes are exact, deterministic, and mutation-sensitive', () => {
  assert.equal(sourceScope.pattern, PORTAL_LINT_SOURCE_SCOPE);
  assert.ok(sourceScope.files.length > 0);
  assert.ok(sourceScope.files.every((file) => file.path.startsWith('src/') && /\.(?:js|jsx)$/u.test(file.path)));
  assert.equal(collectPortalLintSourceScope(repositoryRoot).contentDigest, sourceScope.contentDigest);
  assert.equal(dependencyScope.scope, PORTAL_LINT_DEPENDENCY_SCOPE);
  assert.deepEqual(dependencyScope.packages.map((entry) => entry.packageName), PORTAL_LINT_DEPENDENCY_PACKAGES);
  assert.equal(collectPortalLintDependencyScope(repositoryRoot).contentDigest, dependencyScope.contentDigest);
  assert.notEqual(
    digestScope({ pattern: sourceScope.pattern, files: sourceScope.files.slice(1) }),
    sourceScope.contentDigest,
  );
  assert.notEqual(
    digestScope({
      pattern: sourceScope.pattern,
      files: [...sourceScope.files, { path: 'src/unadmitted.ts', contentDigest: '0'.repeat(64) }],
    }),
    sourceScope.contentDigest,
  );
});

test('validation rejects promotion, writes, cache/fix commands, and portal input or identity drift', () => {
  const promoted = refreshContentDigest({ ...structuredClone(bundle.pack), maturity: 'mandatory' });
  expectPackCode(() => validatePackManifest(promoted), 'AUTHORITY_CONFLICT');

  const write = structuredClone(bundle.pack);
  write.declaredEffects.writePaths.push('../ISET-intake/src');
  expectPackCode(() => validatePackManifest(refreshContentDigest(write)), 'EFFECT_CONFLICT');

  for (const replacement of ['--cache', '--fix']) {
    const broadened = structuredClone(bundle.pack);
    const index = broadened.nativeAuthority.directKnownGoodCommand.indexOf('--no-cache');
    broadened.nativeAuthority.directKnownGoodCommand[index] = replacement;
    expectPackCode(() => validatePackManifest(refreshContentDigest(broadened)), 'NATIVE_AUTHORITY_CONFLICT');
  }

  for (const role of ['product-manifest', 'dependency-lock', 'native-runner', 'native-dependency-scope', 'product-source-scope']) {
    const stale = structuredClone(bundle.pack);
    stale.inputs.find((input) => input.role === role).contentDigest.value = '0'.repeat(64);
    expectPackCode(
      () => verifyPackInputs(stale, repositoryRoot, bundle.roleManifest.packExternalReadOnlyInputs['portal-lint']),
      'INPUT_FINGERPRINT_DRIFT',
    );
  }

  for (const [field, value] of [
    ['workingDirectory', '.'],
    ['packageManifestPath', 'package.json'],
    ['scriptPath', 'node_modules/eslint/bin/eslint.js'],
  ]) {
    const fallback = structuredClone(bundle.pack);
    fallback.nativeAuthority[field] = value;
    expectPackCode(() => validatePackManifest(refreshContentDigest(fallback)), 'NATIVE_AUTHORITY_CONFLICT');
  }

  const conflatedOwner = structuredClone(bundle.pack);
  conflatedOwner.owner.repositoryId = 'admin-dashboard';
  expectPackCode(() => validatePackManifest(refreshContentDigest(conflatedOwner)), 'OWNERSHIP_CONFLICT');
});

test('registry, role, package alias, and package-level ESLint config conflicts fail closed', () => {
  const registry = structuredClone(bundle.registry);
  registry.packs.find((entry) => entry.packId === bundle.pack.packId).manifestDigest.value = '0'.repeat(64);
  expectPackCode(() => validateRegistry(refreshContentDigest(registry), bundle.pack), 'REGISTRY_PACK_CONFLICT');

  const role = structuredClone(bundle.roleManifest);
  role.packExternalReadOnlyInputs['portal-lint'].push('src/**/*.{js,jsx}');
  expectPackCode(() => validateRoleManifest(refreshContentDigest(role)), 'ROLE_MANIFEST_CONFLICT');

  const alias = structuredClone(bundle.pack);
  alias.nativeAuthority.packageScriptValue = 'eslint --fix src';
  expectPackCode(() => validatePackManifest(refreshContentDigest(alias)), 'NATIVE_AUTHORITY_CONFLICT');

  const wrongConfigBinding = structuredClone(bundle.pack);
  wrongConfigBinding.nativeAuthority.directDeliberateFailureCommand.splice(2, 2, '--config', '.eslintrc.cjs');
  expectPackCode(() => validatePackManifest(refreshContentDigest(wrongConfigBinding)), 'NATIVE_AUTHORITY_CONFLICT');
});

test('ten frozen-identity advisory known-good attempts pass with no portal source or cache residue', async () => {
  const before = sourceState();
  const records = [];
  for (let index = 1; index <= 10; index += 1) {
    const { record } = await runAdvisory('known-good', attempt(index, 'advisory'));
    records.push(record);
  }
  assert.equal(new Set(records.map((record) => record.identityBindings.attemptId)).size, 10);
  for (const record of records) {
    assert.equal(record.outcome.status, 'passed');
    assert.equal(record.outcome.exitCode, 0);
    assert.equal(record.processEvidence.terminationProved, true);
    assert.equal(record.cleanup.required, false);
    assert.equal(record.releaseAuthority, 'none');
    assert.deepEqual(record.identityBindings.productCandidateId, productCandidateId);
    assert.deepEqual(record.identityBindings.harnessVersion, advisoryHarnessVersion);
    assert.deepEqual(record.identityBindings.testPackVersions, testPackVersions);
  }
  assert.deepEqual(sourceState(), before);
});

test('five additional portal direct and advisory known-good attempts match exactly', async () => {
  for (let index = 11; index <= 15; index += 1) {
    const { record: advisory } = await runAdvisory('known-good', attempt(index, 'advisory'));
    const { record: direct } = runDirect('known-good', attempt(index, 'direct'), advisory.nativeAuthorityBinding);
    const comparison = compareAdvisoryToDirect(direct, advisory);
    assert.equal(comparison.status, 'matched');
    assert.deepEqual(comparison.differences, []);
    assert.equal(comparison.unstructuredOutputComparison, 'retained-not-semantic-authority');
    assert.equal(comparison.releaseAuthority, 'none');
  }
});

test('portal-configured deliberate lint error fails identically in direct and advisory paths', async () => {
  const before = sourceState();
  const { processResult, record: advisory } = await runAdvisory(
    'deliberate-lint-error',
    attempt(16, 'advisory'),
  );
  const direct = runDirect('deliberate-lint-error', attempt(16, 'direct'), advisory.nativeAuthorityBinding);
  const native = processResult.result.frame.payload;
  const advisoryOutput = Buffer.from(native.outcome.stdout.capturedBase64, 'base64').toString('utf8');
  assert.equal(advisory.outcome.status, 'failed');
  assert.equal(advisory.outcome.exitCode, 1);
  assert.equal(direct.record.outcome.status, 'failed');
  assert.equal(direct.record.outcome.exitCode, 1);
  assert.match(advisoryOutput, /notDeclaredForPortalLintCertification.*no-undef/u);
  assert.match(direct.stdout.toString('utf8'), /notDeclaredForPortalLintCertification.*no-undef/u);
  assert.equal(compareAdvisoryToDirect(direct.record, advisory).status, 'matched');
  assert.deepEqual(sourceState(), before);
});

test('malformed evidence, substituted command, and portal result disagreement fail closed', async () => {
  const { processResult, record: advisory } = await runAdvisory('known-good', attempt(17, 'advisory'));
  const malformed = structuredClone(processResult);
  malformed.result.status = 'corrupt';
  malformed.result.frame = null;
  assert.throws(() => createAdvisoryRecord({
    pack: bundle.pack,
    identityBindings: bindings(advisoryHarnessVersion, attempt(17, 'advisory')),
    processResult: malformed,
  }), { code: 'ADVISORY_EVIDENCE_INVALID' });

  assert.throws(() => createDirectRecord({
    pack: bundle.pack,
    profile: 'known-good',
    identityBindings: bindings(directHarnessVersion, attempt(17, 'direct')),
    nativeAuthorityBinding: advisory.nativeAuthorityBinding,
    command: {
      executable: 'npm',
      arguments: ['run', 'lint', '--', '--quiet', '--no-cache', '--fix'],
      workingDirectory: portalRoot,
    },
    outcome: {
      status: 'passed', exitCode: 0, signal: null,
      stdout: outputEvidence(Buffer.alloc(0)), stderr: outputEvidence(Buffer.alloc(0)),
    },
  }), { code: 'DIRECT_COMMAND_CONFLICT' });

  const { record: direct } = runDirect('known-good', attempt(17, 'direct'), advisory.nativeAuthorityBinding);
  const conflicting = structuredClone(advisory);
  conflicting.outcome.status = 'failed';
  conflicting.outcome.exitCode = 1;
  const comparison = compareAdvisoryToDirect(direct, refreshContentDigest(conflicting));
  assert.equal(comparison.status, 'disagreement');
  assert.equal(comparison.mandatoryStop, true);
  assert.ok(comparison.differences.includes('nativeStatus'));
});

test('forced interruption is bounded and proves whole-process-tree termination', async () => {
  const processResult = await runAdvisoryProcess(
    boundedInterruptionBundle(),
    attempt(18, 'advisory'),
    'forced-interruption',
  );
  assert.equal(processResult.status, 'timed-out');
  assert.equal(processResult.cancellation.kind, 'timeout');
  assert.equal(processResult.termination.proved, true);
  assert.equal(processResult.result.status, 'missing');
  assert.equal(processResult.exit.signal === 'SIGTERM' || processResult.exit.signal === 'SIGKILL', true);
});

test('portal product, harness, attempt, environment, and pack identities remain separate', () => {
  const changedCandidate = createProductCandidateId({
    ...productCandidateArguments,
    material: {
      ...productCandidateArguments.material,
      repositories: productCandidateArguments.material.repositories.map((repository) => ({
        ...repository,
        repositoryId: 'admin-dashboard',
      })),
    },
  });
  const changedPackVersions = createTestPackVersions([{
    packId: bundle.pack.packId,
    packVersion: '9.9.9',
    manifestRefs: [packManifestRef],
    material: { manifestDigest: '0'.repeat(64) },
  }]);
  assert.notDeepEqual(changedCandidate, productCandidateId);
  assert.notDeepEqual(changedPackVersions, testPackVersions);
  assert.notEqual(productCandidateId.digest, directHarnessVersion.digest);
  assert.notEqual(productCandidateId.digest, advisoryHarnessVersion.digest);
  assert.notEqual(directHarnessVersion.digest, advisoryHarnessVersion.digest);
  assert.equal(localEnvironmentIdentity.identityKind, 'environmentIdentity');
  assert.equal(Object.keys(testPackVersions).length, 1);
  assert.notEqual(attempt(19, 'direct'), attempt(19, 'advisory'));
  assert.equal(bundle.registry.releaseAuthority, 'none');
});
