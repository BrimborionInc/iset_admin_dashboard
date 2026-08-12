'use strict';

const assert = require('node:assert/strict');
const {
  existsSync, lstatSync, readFileSync, readdirSync,
} = require('node:fs');
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
const {
  createAdminAggregateNegativeMirror,
  createAdvisoryProcessController,
  createAdvisoryProcessDeclaration,
  deriveAdminAggregatePhaseEvidence,
  runAdvisoryProcess,
  snapshotAdminAggregateResidue,
} = require('../src/native-readonly-bridge');
const {
  ADMIN_AGGREGATE_DEPENDENCY_SCOPE,
  ADMIN_AGGREGATE_EXTERNAL_SCOPE,
  ADMIN_AGGREGATE_PRODUCT_SCOPE,
  PackValidationError,
  collectAdminAggregateDependencyScope,
  collectAdminAggregateExternalScope,
  collectAdminAggregateProductScope,
  digestScope,
  validatePackBundle,
  validatePackManifest,
  validateRegistry,
  validateRoleManifest,
  verifyPackInputs,
} = require('../src/pack-validator');

const repositoryRoot = resolve(__dirname, '..', '..');
const qualificationRoot = resolve(__dirname, '..');
const packPath = join(qualificationRoot, 'packs', 'admin-aggregate.pack.json');
const registryPath = join(qualificationRoot, 'registries', 'phase3-read-only.registry.json');
const roleManifestPath = join(qualificationRoot, 'qualification-role-manifest.json');
const packagePath = join(repositoryRoot, 'package.json');
const packageLockPath = join(repositoryRoot, 'package-lock.json');
const projectCachePath = join(repositoryRoot, 'node_modules', '.cache');
const eslintCachePath = join(repositoryRoot, '.eslintcache');
const declaredRootInputs = [
  'docs/testing/admin-ai-chatbot-eval-fixtures.json',
  'isetadminserver.js',
  'sql/migrations/20260511_0001_add_payment_followup_model.sql',
  'sql/migrations/20260711_0001_verify_runtime_schema_ownership.sql',
  'sql/migrations/20260711_0003_add_durable_event_delivery.sql',
  'sql/migrations/20260712_0001_add_payment_submission_attempt.sql',
  'sql/ops/update-payment-evidence-baseline-20260523.sql',
];

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
const productScope = collectAdminAggregateProductScope(repositoryRoot);
const externalScope = collectAdminAggregateExternalScope(repositoryRoot);
const dependencyScope = collectAdminAggregateDependencyScope(repositoryRoot);
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
    'admin-aggregate.product-inputs',
    digestCanonical({
      packageDigest: digestBytes(readFileSync(packagePath)),
      dependencyLockDigest: digestBytes(readFileSync(packageLockPath)),
      productScopeDigest: productScope.contentDigest,
      externalScopeDigest: externalScope.contentDigest,
    }),
  )],
  material: {
    repositories: [{
      repositoryRole: 'admin-aggregate-certification-scope',
      repositoryId: 'admin-dashboard',
      sourceDigest: digestCanonical({
        product: productScope.contentDigest,
        external: externalScope.contentDigest,
      }),
      dependencyDigest: digestCanonical({
        lock: digestBytes(readFileSync(packageLockPath)),
        resolvedTestRuntime: dependencyScope.contentDigest,
      }),
      migrationDigest: digestCanonical({
        declaredSourceOnly: 'sql/migrations/20260711_0001_verify_runtime_schema_ownership.sql',
      }),
      generatedArtifactDigest: digestCanonical({ scope: 'none' }),
    }],
  },
};
const productCandidateId = createProductCandidateId(productCandidateArguments);
const localEnvironmentIdentity = createEnvironmentIdentity({
  manifestRefs: [reference(
    'environment-class',
    'phase3f.local-synthetic-admin-aggregate',
    digestCanonical({ class: 'local', externalNetwork: false }),
  )],
  target: { targetClass: 'local', targetName: 'admin-source-worktree' },
  material: {
    environmentClass: 'local',
    capabilities: bundle.pack.requiredAdapter.capabilities,
    syntheticEnvironment: 'attempt-owned-fixed-non-secret',
    externalEffects: [],
  },
});
const testPackVersions = createTestPackVersions([{
  packId: bundle.pack.packId,
  packVersion: bundle.pack.packVersion,
  manifestRefs: [packManifestRef],
  material: {
    manifestDigest: bundle.pack.contentDigest.value,
    runnerDigest: bundle.pack.inputs.find((input) => input.role === 'native-runner').contentDigest.value,
    productScopeDigest: productScope.contentDigest,
    externalScopeDigest: externalScope.contentDigest,
    dependencyScopeDigest: dependencyScope.contentDigest,
    negativeFixtureDigests: bundle.pack.inputs
      .filter((input) => input.path.includes('admin-aggregate-negative/'))
      .map((input) => input.contentDigest.value),
  },
}]);
const directHarnessVersion = createHarnessVersion({
  manifestRefs: [packManifestRef],
  material: {
    qualificationSourceDigest: digestCanonical({ mode: 'direct-native-admin-aggregate' }),
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
  return createAttemptId(`00000000-0000-4000-8000-${String(sequence).padStart(12, lane === 'direct' ? '4' : '5')}`);
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

function digestTree(path) {
  if (!existsSync(path)) return null;
  const files = [];
  const visit = (current, prefix = '') => {
    for (const name of readdirSync(current).sort()) {
      const child = join(current, name);
      const relativePath = prefix ? `${prefix}/${name}` : name;
      const stat = lstatSync(child);
      if (stat.isDirectory()) visit(child, relativePath);
      else if (stat.isFile()) files.push({ path: relativePath, digest: digestBytes(readFileSync(child)) });
      else files.push({ path: relativePath, kind: 'non-file' });
    }
  };
  visit(path);
  return digestCanonical(files);
}

function sourceState() {
  return {
    product: collectAdminAggregateProductScope(repositoryRoot).contentDigest,
    external: collectAdminAggregateExternalScope(repositoryRoot).contentDigest,
    cache: digestTree(projectCachePath),
    eslintCache: existsSync(eslintCachePath) ? digestBytes(readFileSync(eslintCachePath)) : null,
    residue: snapshotAdminAggregateResidue(),
  };
}

function runDirect(profile, attemptId, nativeAuthorityBinding) {
  const beforeResidue = snapshotAdminAggregateResidue();
  let mirror;
  let executed;
  try {
    const cwd = profile === 'known-good'
      ? repositoryRoot
      : (mirror = createAdminAggregateNegativeMirror(bundle, attemptId, profile)).root;
    executed = spawnSync('npm', ['test'], {
      cwd,
      env: { PATH: process.env.PATH },
      encoding: null,
      maxBuffer: 4 * 1024 * 1024,
      timeout: bundle.pack.timeouts.executionMs,
      shell: false,
    });
  } finally {
    if (mirror) assert.equal(mirror.cleanup(), true);
  }
  if (executed.error) throw executed.error;
  const stdout = executed.stdout || Buffer.alloc(0);
  const stderr = executed.stderr || Buffer.alloc(0);
  const phaseEvidence = deriveAdminAggregatePhaseEvidence(
    stdout,
    stderr,
    profile,
    executed.status,
    executed.signal,
  );
  const afterResidue = snapshotAdminAggregateResidue();
  assert.deepEqual(afterResidue, beforeResidue);
  return {
    stdout,
    stderr,
    phaseEvidence,
    record: createDirectRecord({
      pack: bundle.pack,
      profile,
      identityBindings: bindings(directHarnessVersion, attemptId),
      nativeAuthorityBinding,
      phaseEvidence,
      command: {
        executable: 'npm',
        arguments: ['test'],
        workingDirectory: nativeAuthorityBinding.workingDirectory,
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

test('pack, five-pack registry, role boundary, authority, and exact aggregate scopes validate', () => {
  assert.equal(bundle.pack.packId, 'admin-aggregate');
  assert.equal(bundle.pack.packVersion, '1.0.2');
  assert.equal(bundle.pack.requiredAdapter.adapterVersion, '2.0.0');
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
    bundle.roleManifest.packExternalReadOnlyInputs['admin-aggregate'],
    bundle.pack.inputs.filter((input) => input.role !== 'certification-fixture').map((input) => input.path),
  );
  assert.equal(bundle.registry.releaseAuthority, 'none');
  assert.equal(bundle.pack.nativeAuthority.semanticResultAuthority, 'native-exit-status');
  assert.equal(bundle.pack.cleanup.residueDecision, 'independent-zero-residue-required');
});

test('product, external, and dependency scopes are deterministic and mutation-sensitive', () => {
  assert.equal(productScope.scope, ADMIN_AGGREGATE_PRODUCT_SCOPE);
  assert.deepEqual(
    productScope.files
      .map((input) => input.path)
      .filter((path) => !['src/', 'tests/', 'scripts/'].some((prefix) => path.startsWith(prefix))),
    declaredRootInputs,
  );
  assert.equal(externalScope.scope, ADMIN_AGGREGATE_EXTERNAL_SCOPE);
  assert.equal(dependencyScope.scope, ADMIN_AGGREGATE_DEPENDENCY_SCOPE);
  assert.ok(productScope.files.length > 800);
  assert.ok(externalScope.files.length > 100);
  assert.ok(dependencyScope.packages.length > 100);
  assert.equal(collectAdminAggregateProductScope(repositoryRoot).contentDigest, productScope.contentDigest);
  assert.equal(collectAdminAggregateExternalScope(repositoryRoot).contentDigest, externalScope.contentDigest);
  assert.equal(collectAdminAggregateDependencyScope(repositoryRoot).contentDigest, dependencyScope.contentDigest);
  assert.notEqual(
    digestScope({ scope: productScope.scope, files: productScope.files.slice(1) }),
    productScope.contentDigest,
  );
});

test('validation rejects promotion, undeclared effects, stale scopes, and native authority drift', () => {
  expectPackCode(
    () => validatePackManifest(refreshContentDigest({ ...structuredClone(bundle.pack), maturity: 'mandatory' })),
    'AUTHORITY_CONFLICT',
  );
  const external = structuredClone(bundle.pack);
  external.declaredEffects.externalEffects.push('network.external');
  expectPackCode(() => validatePackManifest(refreshContentDigest(external)), 'EFFECT_CONFLICT');
  for (const path of [ADMIN_AGGREGATE_PRODUCT_SCOPE, ADMIN_AGGREGATE_EXTERNAL_SCOPE, ADMIN_AGGREGATE_DEPENDENCY_SCOPE]) {
    const stale = structuredClone(bundle.pack);
    stale.inputs.find((input) => input.path === path).contentDigest.value = '0'.repeat(64);
    expectPackCode(
      () => verifyPackInputs(stale, repositoryRoot, bundle.roleManifest.packExternalReadOnlyInputs['admin-aggregate']),
      'INPUT_FINGERPRINT_DRIFT',
    );
  }
  const reordered = structuredClone(bundle.pack);
  reordered.nativeAuthority.packageScriptValue = 'node scripts/run-backend-first.js';
  expectPackCode(() => validatePackManifest(refreshContentDigest(reordered)), 'NATIVE_AUTHORITY_CONFLICT');
});

test('registry, role, package alias, ambient environment, and unknown profile fail closed', async () => {
  const registry = structuredClone(bundle.registry);
  registry.packs.find((entry) => entry.packId === bundle.pack.packId).manifestDigest.value = '0'.repeat(64);
  expectPackCode(() => validateRegistry(refreshContentDigest(registry), bundle.pack), 'REGISTRY_PACK_CONFLICT');

  const role = structuredClone(bundle.roleManifest);
  role.packExternalReadOnlyInputs['admin-aggregate'].push('.env');
  expectPackCode(() => validateRoleManifest(refreshContentDigest(role)), 'ROLE_MANIFEST_CONFLICT');

  const controller = createAdvisoryProcessController(bundle, attempt(1, 'advisory'), ['known-good']);
  const declaration = createAdvisoryProcessDeclaration(bundle, attempt(1, 'advisory'), 'known-good');
  declaration.environment.PATH_TEST_ENV_FILE = '/unowned/.env';
  assert.throws(() => controller.start(declaration), { code: 'ENVIRONMENT_NOT_ADMITTED' });
  assert.throws(
    () => createAdvisoryProcessDeclaration(bundle, attempt(1, 'advisory'), 'unknown-profile'),
    { code: 'UNSUPPORTED_PROFILE' },
  );
});

test('ten frozen-identity advisory aggregate attempts pass with exact order and zero residue', async () => {
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
    assert.equal(record.phaseEvidence.valid, true);
    assert.deepEqual(record.phaseEvidence.phases.map((phase) => [phase.phaseId, phase.status]), [
      ['frontend', 'passed'],
      ['backend', 'passed'],
    ]);
    assert.equal(record.cleanup.status, 'completed');
    assert.equal(record.cleanup.residueDecision, 'zero-residue-proved');
    assert.equal(record.cleanup.residueObserved, false);
    assert.equal(record.releaseAuthority, 'none');
  }
  assert.deepEqual(sourceState(), before);
});

test('five additional direct and advisory aggregate attempts match exactly', async () => {
  for (let index = 11; index <= 15; index += 1) {
    const { record: advisory } = await runAdvisory('known-good', attempt(index, 'advisory'));
    const { record: direct } = runDirect('known-good', attempt(index, 'direct'), advisory.nativeAuthorityBinding);
    const comparison = compareAdvisoryToDirect(direct, advisory);
    assert.equal(comparison.status, 'matched');
    assert.deepEqual(comparison.differences, []);
    assert.equal(comparison.releaseAuthority, 'none');
  }
});

for (const [profile, expectedPhases] of [
  ['frontend-failure', [['frontend', 'failed'], ['backend', 'not-started']]],
  ['backend-failure', [['frontend', 'passed'], ['backend', 'failed']]],
]) {
  test(`${profile} is detected in the exact native phase and leaves zero mirror or temp residue`, async () => {
    const before = sourceState();
    const { processResult, record: advisory } = await runAdvisory(profile, attempt(16, 'advisory'));
    const direct = runDirect(profile, attempt(16, 'direct'), advisory.nativeAuthorityBinding);
    assert.equal(processResult.status, 'failed');
    assert.equal(advisory.outcome.status, 'failed');
    assert.equal(advisory.outcome.exitCode, 1);
    assert.equal(advisory.phaseEvidence.valid, true);
    assert.deepEqual(advisory.phaseEvidence.phases.map((phase) => [phase.phaseId, phase.status]), expectedPhases);
    assert.equal(advisory.cleanup.status, 'completed');
    assert.equal(advisory.cleanup.residueDecision, 'zero-residue-proved');
    assert.equal(direct.record.outcome.status, 'failed');
    assert.equal(direct.record.outcome.exitCode, 1);
    assert.equal(compareAdvisoryToDirect(direct.record, advisory).status, 'matched');
    assert.deepEqual(sourceState(), before);
  });
}

test('missing, reordered, truncated, malformed, and conflicting phase evidence fails closed', async () => {
  const validOutput = Buffer.from([
    '[test:all] frontend suites',
    '[test:all] backend, authorization, validation, and tooling suites',
    '[test:all] all admin suites passed',
  ].join('\n'));
  assert.equal(deriveAdminAggregatePhaseEvidence(validOutput, Buffer.alloc(0), 'known-good', 0, null).valid, true);
  assert.equal(deriveAdminAggregatePhaseEvidence(Buffer.from('[test:all] frontend suites\n'), Buffer.alloc(0), 'known-good', 0, null).valid, false);
  assert.equal(deriveAdminAggregatePhaseEvidence(Buffer.from([
    '[test:all] backend, authorization, validation, and tooling suites',
    '[test:all] frontend suites',
    '[test:all] all admin suites passed',
  ].join('\n')), Buffer.alloc(0), 'known-good', 0, null).valid, false);

  const { processResult, record: advisory } = await runAdvisory('known-good', attempt(17, 'advisory'));
  for (const status of ['corrupt', 'truncated']) {
    const invalid = structuredClone(processResult);
    invalid.result.status = status;
    invalid.result.frame = null;
    assert.throws(() => createAdvisoryRecord({
      pack: bundle.pack,
      identityBindings: bindings(advisoryHarnessVersion, attempt(17, 'advisory')),
      processResult: invalid,
    }), { code: 'ADVISORY_EVIDENCE_INVALID' });
  }
  const { record: direct } = runDirect('known-good', attempt(17, 'direct'), advisory.nativeAuthorityBinding);
  const conflict = structuredClone(advisory);
  conflict.phaseEvidence.phases.reverse();
  const comparison = compareAdvisoryToDirect(direct, refreshContentDigest(conflict));
  assert.equal(comparison.status, 'disagreement');
  assert.ok(comparison.differences.includes('phaseEvidence'));
  assert.equal(comparison.mandatoryStop, true);
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

test('product, harness, attempt, environment, and pack identities remain separate', () => {
  const changedCandidate = createProductCandidateId({
    ...productCandidateArguments,
    material: {
      ...productCandidateArguments.material,
      repositories: productCandidateArguments.material.repositories.map((repository) => ({
        ...repository,
        sourceDigest: '0'.repeat(64),
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
  assert.notEqual(attempt(19, 'direct'), attempt(19, 'advisory'));
  assert.equal(bundle.registry.releaseAuthority, 'none');
});
