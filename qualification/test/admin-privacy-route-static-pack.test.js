'use strict';

const assert = require('node:assert/strict');
const { readFileSync, realpathSync } = require('node:fs');
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
  PackValidationError,
  validatePackBundle,
  validatePackManifest,
  validateRegistry,
  validateRoleManifest,
  verifyPackInputs,
} = require('../src/pack-validator');

const repositoryRoot = resolve(__dirname, '..', '..');
const qualificationRoot = resolve(__dirname, '..');
const packPath = join(qualificationRoot, 'packs', 'admin-privacy-route-static.pack.json');
const registryPath = join(qualificationRoot, 'registries', 'phase3-read-only.registry.json');
const roleManifestPath = join(qualificationRoot, 'qualification-role-manifest.json');
const packagePath = join(repositoryRoot, 'package.json');
const packageLockPath = join(repositoryRoot, 'package-lock.json');

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
const productCandidateId = createProductCandidateId({
  manifestRefs: [reference(
    'phase3-certification-scope',
    'privacy-route-static.authorized-inputs',
    digestCanonical({ inputs: bundle.roleManifest.packExternalReadOnlyInputs['privacy-route-static'] }),
  )],
  material: {
    repositories: [
      {
        repositoryRole: 'admin-product-certification-scope',
        repositoryId: 'admin-dashboard',
        sourceDigest: digestCanonical({
          inputs: bundle.pack.inputs
            .filter((input) => !input.path.startsWith('../') && !input.path.startsWith('qualification/'))
            .map((input) => ({ path: input.path, digest: input.contentDigest.value })),
        }),
        dependencyDigest: digestBytes(readFileSync(packageLockPath)),
        migrationDigest: digestCanonical({ scope: 'none' }),
        generatedArtifactDigest: digestCanonical({ scope: 'none' }),
      },
      {
        repositoryRole: 'portal-product-certification-scope',
        repositoryId: 'ISET-intake',
        sourceDigest: bundle.pack.inputs.find((input) => input.path === '../ISET-intake/server.js').contentDigest.value,
        dependencyDigest: digestCanonical({ scope: 'not-read-by-sprint-3b' }),
        migrationDigest: digestCanonical({ scope: 'none' }),
        generatedArtifactDigest: digestCanonical({ scope: 'none' }),
      },
    ],
  },
});
const localEnvironmentIdentity = createEnvironmentIdentity({
  manifestRefs: [reference('environment-class', 'phase3b.local-read-only', digestCanonical({ class: 'local' }))],
  target: { targetClass: 'local', targetName: 'admin-and-portal-source-worktrees' },
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
    nativeRunnerDigest: bundle.pack.inputs.find((input) => input.role === 'native-runner').contentDigest.value,
    mutationAuthorityDigest: bundle.pack.inputs.find((input) => input.role === 'native-test').contentDigest.value,
    dependencyLockDigest: bundle.pack.inputs.find((input) => input.role === 'dependency-lock').contentDigest.value,
  },
}]);
const directHarnessVersion = createHarnessVersion({
  manifestRefs: [packManifestRef],
  material: {
    qualificationSourceDigest: digestCanonical({ mode: 'direct-native-package-scripts' }),
    dependencyDigest: digestBytes(readFileSync(packageLockPath)),
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
  return createAttemptId(`00000000-0000-4000-8000-${String(sequence).padStart(12, lane === 'direct' ? '3' : '4')}`);
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
    cwd: repositoryRoot,
    env: { PATH: process.env.PATH },
    encoding: null,
    maxBuffer: 1024 * 1024,
    timeout: 30000,
    shell: false,
  });
  if (executed.error) throw executed.error;
  const stdout = executed.stdout || Buffer.alloc(0);
  const stderr = executed.stderr || Buffer.alloc(0);
  return createDirectRecord({
    pack: bundle.pack,
    profile,
    identityBindings: bindings(directHarnessVersion, attemptId),
    nativeAuthorityBinding,
    command: {
      executable: command[0],
      arguments: command.slice(1),
      workingDirectory: repositoryRoot,
    },
    outcome: {
      status: executed.status === 0 ? 'passed' : 'failed',
      exitCode: executed.status,
      signal: executed.signal,
      stdout: outputEvidence(stdout),
      stderr: outputEvidence(stderr),
    },
  });
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

function sourceSnapshot() {
  return Object.fromEntries(bundle.pack.inputs.map((input) => [
    input.path,
    digestBytes(readFileSync(realpathSync(resolve(repositoryRoot, input.path)))),
  ]));
}

test('pack, registry, source-tripwire limit, and exact role boundary validate', () => {
  assert.equal(bundle.pack.packId, 'privacy-route-static');
  assert.equal(bundle.pack.packVersion, '1.0.2');
  assert.equal(bundle.pack.requiredAdapter.adapterVersion, '2.0.0');
  assert.equal(
    bundle.pack.inputs.find((input) => input.path === 'isetadminserver.js').contentDigest.value,
    digestBytes(readFileSync(resolve(repositoryRoot, 'isetadminserver.js'))),
  );
  assert.equal(bundle.pack.maturity, 'advisory');
  assert.equal(bundle.pack.releaseInfluence, 'none');
  assert.deepEqual(bundle.registry.packs.map((entry) => entry.packId), [
    'ai-guidance-contract',
    'privacy-route-static',
    'admin-lint',
    'portal-lint',
    'admin-aggregate',
  ]);
  assert.equal(bundle.registry.releaseAuthority, 'none');
  assert.deepEqual(
    bundle.roleManifest.packExternalReadOnlyInputs['privacy-route-static'],
    bundle.pack.inputs.filter((input) => input.role !== 'certification-fixture').map((input) => input.path),
  );
  assert.ok(bundle.pack.limitations.includes('Static source-marker checks do not prove runtime authorization behavior.'));
});

test('validation rejects unknown fields, promotion, writes, profile drift, and stale manifests', () => {
  const unknown = structuredClone(bundle.pack);
  unknown.undeclared = true;
  expectPackCode(() => validatePackManifest(unknown), 'INVALID_SHAPE');

  const promoted = refreshContentDigest({ ...structuredClone(bundle.pack), maturity: 'mandatory' });
  expectPackCode(() => validatePackManifest(promoted), 'AUTHORITY_CONFLICT');

  const stateful = structuredClone(bundle.pack);
  stateful.declaredEffects.writePaths.push('unexpected-write');
  expectPackCode(() => validatePackManifest(refreshContentDigest(stateful)), 'EFFECT_CONFLICT');

  const broadened = structuredClone(bundle.pack);
  broadened.certification.knownBadProfiles = ['explicit-request'];
  expectPackCode(() => validatePackManifest(refreshContentDigest(broadened)), 'CERTIFICATION_CONFLICT');

  const stale = structuredClone(bundle.pack);
  stale.purpose = 'changed without a new digest';
  expectPackCode(() => validatePackManifest(stale), 'STALE_DIGEST');
});

test('input, registry, role, alias, and cross-repository identities fail closed', () => {
  const stalePortal = structuredClone(bundle.pack);
  stalePortal.inputs.find((input) => input.path === '../ISET-intake/server.js').contentDigest.value = '0'.repeat(64);
  expectPackCode(
    () => verifyPackInputs(stalePortal, repositoryRoot, bundle.roleManifest.packExternalReadOnlyInputs['privacy-route-static']),
    'INPUT_FINGERPRINT_DRIFT',
  );

  const undeclared = structuredClone(bundle.pack);
  undeclared.inputs.find((input) => input.role === 'native-runner').path = 'src/undeclared-product-code.js';
  expectPackCode(
    () => verifyPackInputs(undeclared, repositoryRoot, bundle.roleManifest.packExternalReadOnlyInputs['privacy-route-static']),
    'UNDECLARED_EXTERNAL_INPUT',
  );

  const registry = structuredClone(bundle.registry);
  registry.packs.find((entry) => entry.packId === bundle.pack.packId).manifestDigest.value = '0'.repeat(64);
  expectPackCode(() => validateRegistry(refreshContentDigest(registry), bundle.pack), 'REGISTRY_PACK_CONFLICT');

  const role = structuredClone(bundle.roleManifest);
  role.packExternalReadOnlyInputs['privacy-route-static'].push('../ISET-intake/auth/cognitoAuth.js');
  expectPackCode(() => validateRoleManifest(refreshContentDigest(role)), 'ROLE_MANIFEST_CONFLICT');

  const alias = structuredClone(bundle.pack);
  alias.nativeAuthority.packageScriptValue = 'node scripts/other.js';
  expectPackCode(() => validatePackManifest(refreshContentDigest(alias)), 'NATIVE_AUTHORITY_CONFLICT');
});

test('ten frozen-identity advisory native-check attempts pass with distinct attempt IDs', async () => {
  const before = sourceSnapshot();
  const records = [];
  for (let index = 1; index <= 10; index += 1) {
    const attemptId = attempt(index, 'advisory');
    const { record } = await runAdvisory('known-good', attemptId);
    records.push(record);
  }
  assert.equal(new Set(records.map((record) => record.identityBindings.attemptId)).size, 10);
  for (const record of records) {
    assert.equal(record.outcome.status, 'passed');
    assert.equal(record.outcome.exitCode, 0);
    assert.equal(record.processEvidence.terminationProved, true);
    assert.equal(record.releaseAuthority, 'none');
    assert.deepEqual(record.identityBindings.productCandidateId, productCandidateId);
    assert.deepEqual(record.identityBindings.harnessVersion, advisoryHarnessVersion);
    assert.deepEqual(record.identityBindings.testPackVersions, testPackVersions);
  }
  assert.deepEqual(sourceSnapshot(), before);
});

test('five additional direct and advisory native-check attempts match', async () => {
  for (let index = 11; index <= 15; index += 1) {
    const { record: advisory } = await runAdvisory('known-good', attempt(index, 'advisory'));
    const direct = runDirect('known-good', attempt(index, 'direct'), advisory.nativeAuthorityBinding);
    const comparison = compareAdvisoryToDirect(direct, advisory);
    assert.equal(comparison.status, 'matched');
    assert.deepEqual(comparison.differences, []);
    assert.equal(comparison.unstructuredOutputComparison, 'retained-not-semantic-authority');
    assert.equal(comparison.releaseAuthority, 'none');
  }
});

test('the focused native suite proves all 71 checks and guard-removal mutations in both paths', async () => {
  const { processResult, record: advisory } = await runAdvisory('mutation-proof', attempt(16, 'advisory'));
  const direct = runDirect('mutation-proof', attempt(16, 'direct'), advisory.nativeAuthorityBinding);
  assert.equal(processResult.status, 'completed');
  assert.equal(advisory.outcome.status, 'passed');
  assert.equal(advisory.outcome.exitCode, 0);
  assert.equal(direct.outcome.status, 'passed');
  assert.equal(direct.outcome.exitCode, 0);
  assert.equal(compareAdvisoryToDirect(direct, advisory).status, 'matched');
});

test('direct command substitution and advisory disagreement fail closed', async () => {
  const { record: advisory } = await runAdvisory('known-good', attempt(17, 'advisory'));
  const invalidCommand = bundle.pack.nativeAuthority.directKnownGoodCommand;
  assert.throws(() => createDirectRecord({
    pack: bundle.pack,
    profile: 'known-good',
    identityBindings: bindings(directHarnessVersion, attempt(17, 'direct')),
    nativeAuthorityBinding: advisory.nativeAuthorityBinding,
    command: {
      executable: invalidCommand[0],
      arguments: [...invalidCommand.slice(1), '--broadened'],
      workingDirectory: repositoryRoot,
    },
    outcome: { status: 'passed', exitCode: 0, signal: null, stdout: outputEvidence(Buffer.alloc(0)), stderr: outputEvidence(Buffer.alloc(0)) },
  }), { code: 'DIRECT_COMMAND_CONFLICT' });

  const direct = runDirect('known-good', attempt(17, 'direct'), advisory.nativeAuthorityBinding);
  const conflicting = structuredClone(advisory);
  conflicting.outcome.status = 'failed';
  conflicting.outcome.exitCode = 1;
  const comparison = compareAdvisoryToDirect(direct, refreshContentDigest(conflicting));
  assert.equal(comparison.status, 'disagreement');
  assert.equal(comparison.mandatoryStop, true);
  assert.ok(comparison.differences.includes('nativeStatus'));
});

test('forced interruption is bounded, proves termination, and emits no late result', async () => {
  const { processResult } = await runAdvisory('forced-interruption', attempt(18, 'advisory'));
  assert.equal(processResult.status, 'timed-out');
  assert.equal(processResult.cancellation.kind, 'timeout');
  assert.equal(processResult.termination.proved, true);
  assert.equal(processResult.result.status, 'missing');
  assert.equal(processResult.exit.signal === 'SIGTERM' || processResult.exit.signal === 'SIGKILL', true);
});

test('product, harness, attempt, environment, and pack identities remain separate', () => {
  assert.notEqual(productCandidateId.digest, directHarnessVersion.digest);
  assert.notEqual(productCandidateId.digest, advisoryHarnessVersion.digest);
  assert.notEqual(directHarnessVersion.digest, advisoryHarnessVersion.digest);
  assert.equal(localEnvironmentIdentity.identityKind, 'environmentIdentity');
  assert.equal(Object.keys(testPackVersions).length, 1);
  assert.notEqual(attempt(19, 'direct'), attempt(19, 'advisory'));
  assert.equal(bundle.registry.releaseAuthority, 'none');
});
