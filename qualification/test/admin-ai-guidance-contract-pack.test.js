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
const packPath = join(qualificationRoot, 'packs', 'admin-ai-guidance-contract.pack.json');
const registryPath = join(qualificationRoot, 'registries', 'phase3-read-only.registry.json');
const roleManifestPath = join(qualificationRoot, 'qualification-role-manifest.json');
const packagePath = join(repositoryRoot, 'package.json');
const scriptPath = join(repositoryRoot, 'scripts', 'admin-ai-eval-fixtures-check.js');

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
  manifestRefs: [reference('phase3-certification-scope', 'admin-ai-guidance.authorized-inputs', digestCanonical({
    inputs: bundle.roleManifest.externalReadOnlyInputs,
  }))],
  material: {
    repositories: [{
      repositoryRole: 'product-certification-scope',
      repositoryId: 'admin-dashboard',
      sourceDigest: digestBytes(readFileSync(packagePath)),
      dependencyDigest: digestCanonical({ scope: 'package-script-alias-only' }),
      migrationDigest: digestCanonical({ scope: 'none' }),
      generatedArtifactDigest: digestCanonical({ scope: 'none' }),
    }],
  },
});
const localEnvironmentIdentity = createEnvironmentIdentity({
  manifestRefs: [reference('environment-class', 'phase3a.local-read-only', digestCanonical({ class: 'local' }))],
  target: { targetClass: 'local', targetName: 'admin-dashboard-worktree' },
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
    defaultFixtureDigest: bundle.pack.inputs.find((input) => input.role === 'native-default-fixture').contentDigest.value,
    invalidFixtureDigest: bundle.pack.inputs.find((input) => input.path.endsWith('.invalid.json')).contentDigest.value,
  },
}]);
const directHarnessVersion = createHarnessVersion({
  manifestRefs: [packManifestRef],
  material: {
    qualificationSourceDigest: digestCanonical({ mode: 'direct-native-package-script' }),
    dependencyDigest: digestBytes(readFileSync(packagePath)),
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
  return createAttemptId(`00000000-0000-4000-8000-${String(sequence).padStart(12, lane === 'direct' ? '1' : '2')}`);
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

function runDirect(profile, attemptId, nativeAuthorityBinding) {
  const command = profile === 'known-good'
    ? bundle.pack.nativeAuthority.directKnownGoodCommand
    : bundle.pack.nativeAuthority.directDeliberateFailureCommand;
  const executed = spawnSync(command[0], command.slice(1), {
    cwd: repositoryRoot,
    env: { PATH: process.env.PATH },
    encoding: null,
    maxBuffer: 65536,
    timeout: 5000,
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

test('pack, registry, role boundary, and native package alias validate exactly', () => {
  assert.equal(bundle.pack.packVersion, '1.0.1');
  assert.equal(bundle.pack.requiredAdapter.adapterVersion, '2.0.0');
  assert.equal(bundle.pack.packId, 'ai-guidance-contract');
  assert.equal(bundle.pack.maturity, 'advisory');
  assert.equal(bundle.pack.releaseInfluence, 'none');
  assert.equal(bundle.registry.selectionAuthority, 'advisory-certification-only');
  assert.equal(bundle.registry.releaseAuthority, 'none');
  assert.deepEqual(bundle.roleManifest.externalReadOnlyInputs, [
    'package.json',
    'scripts/admin-ai-eval-fixtures-check.js',
    'docs/testing/admin-ai-chatbot-eval-fixtures.json',
  ]);
});

test('pack validation rejects unknown fields, authority broadening, writes, and stale manifests', () => {
  const unknown = structuredClone(bundle.pack);
  unknown.undeclared = true;
  expectPackCode(() => validatePackManifest(unknown), 'INVALID_SHAPE');

  const promoted = refreshContentDigest({ ...structuredClone(bundle.pack), maturity: 'mandatory' });
  expectPackCode(() => validatePackManifest(promoted), 'AUTHORITY_CONFLICT');

  const stateful = structuredClone(bundle.pack);
  stateful.declaredEffects.writePaths.push('unexpected-write');
  expectPackCode(() => validatePackManifest(refreshContentDigest(stateful)), 'EFFECT_CONFLICT');

  const stale = structuredClone(bundle.pack);
  stale.purpose = 'changed without a new digest';
  expectPackCode(() => validatePackManifest(stale), 'STALE_DIGEST');
});

test('input verification rejects script, fixture, and undeclared external-input identities', () => {
  const staleScript = structuredClone(bundle.pack);
  staleScript.inputs.find((input) => input.role === 'native-runner').contentDigest.value = '0'.repeat(64);
  expectPackCode(() => verifyPackInputs(staleScript, repositoryRoot), 'INPUT_FINGERPRINT_DRIFT');

  const staleFixture = structuredClone(bundle.pack);
  staleFixture.inputs.find((input) => input.role === 'native-default-fixture').contentDigest.value = '0'.repeat(64);
  expectPackCode(() => verifyPackInputs(staleFixture, repositoryRoot), 'INPUT_FINGERPRINT_DRIFT');

  const undeclared = structuredClone(bundle.pack);
  undeclared.inputs.find((input) => input.role === 'native-runner').path = 'package-lock.json';
  expectPackCode(() => verifyPackInputs(undeclared, repositoryRoot), 'UNDECLARED_EXTERNAL_INPUT');
});

test('registry and role manifest reject stale bindings and broader product scope', () => {
  const registry = structuredClone(bundle.registry);
  registry.packs[0].manifestDigest.value = '0'.repeat(64);
  expectPackCode(() => validateRegistry(refreshContentDigest(registry), bundle.pack), 'REGISTRY_PACK_CONFLICT');

  const role = structuredClone(bundle.roleManifest);
  role.externalReadOnlyInputs.push('src/undeclared-product-code.js');
  expectPackCode(() => validateRoleManifest(refreshContentDigest(role)), 'ROLE_MANIFEST_CONFLICT');
});

test('ten frozen-identity advisory known-good attempts pass with distinct attempt IDs', async () => {
  const records = [];
  for (let index = 1; index <= 10; index += 1) {
    const attemptId = attempt(index, 'advisory');
    const { record } = await runAdvisory('known-good', attemptId);
    records.push(record);
  }
  assert.equal(records.length, 10);
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
});

test('five additional direct and advisory known-good attempts match without parsing native output', async () => {
  for (let index = 11; index <= 15; index += 1) {
    const advisoryAttempt = attempt(index, 'advisory');
    const directAttempt = attempt(index, 'direct');
    const { record: advisory } = await runAdvisory('known-good', advisoryAttempt);
    const direct = runDirect('known-good', directAttempt, advisory.nativeAuthorityBinding);
    const comparison = compareAdvisoryToDirect(direct, advisory);
    assert.equal(comparison.status, 'matched');
    assert.deepEqual(comparison.differences, []);
    assert.equal(comparison.unstructuredOutputComparison, 'retained-not-semantic-authority');
    assert.equal(comparison.releaseAuthority, 'none');
  }
});

test('the deliberate invalid fixture fails in both direct and advisory paths and matches', async () => {
  const advisoryAttempt = attempt(16, 'advisory');
  const directAttempt = attempt(16, 'direct');
  const { processResult, record: advisory } = await runAdvisory('invalid-fixture', advisoryAttempt);
  const direct = runDirect('invalid-fixture', directAttempt, advisory.nativeAuthorityBinding);
  assert.equal(processResult.status, 'failed');
  assert.equal(advisory.outcome.status, 'failed');
  assert.equal(advisory.outcome.exitCode, 1);
  assert.equal(direct.outcome.status, 'failed');
  assert.equal(direct.outcome.exitCode, 1);
  assert.equal(compareAdvisoryToDirect(direct, advisory).status, 'matched');
});

test('comparison fails closed on a native-result disagreement and stale evidence', async () => {
  const { record: advisory } = await runAdvisory('known-good', attempt(17, 'advisory'));
  const direct = runDirect('known-good', attempt(17, 'direct'), advisory.nativeAuthorityBinding);
  const conflicting = structuredClone(advisory);
  conflicting.outcome.status = 'failed';
  conflicting.outcome.exitCode = 1;
  const refreshed = refreshContentDigest(conflicting);
  const comparison = compareAdvisoryToDirect(direct, refreshed);
  assert.equal(comparison.status, 'disagreement');
  assert.equal(comparison.mandatoryStop, true);
  assert.ok(comparison.differences.includes('nativeStatus'));
  assert.ok(comparison.differences.includes('nativeExitCode'));

  const stale = structuredClone(advisory);
  stale.profile = 'invalid-fixture';
  assert.throws(() => compareAdvisoryToDirect(direct, stale), { code: 'STALE_RECORD' });
});

test('forced interruption is bounded, terminates the process tree, and emits no valid late result', async () => {
  const { processResult } = await runAdvisory('forced-interruption', attempt(18, 'advisory'));
  assert.equal(processResult.status, 'timed-out');
  assert.equal(processResult.cancellation.kind, 'timeout');
  assert.equal(processResult.termination.proved, true);
  assert.equal(processResult.result.status, 'missing');
  assert.equal(processResult.exit.signal === 'SIGTERM' || processResult.exit.signal === 'SIGKILL', true);
});

test('product, direct harness, advisory harness, attempt, environment, and pack identities stay separate', () => {
  assert.notEqual(productCandidateId.digest, directHarnessVersion.digest);
  assert.notEqual(productCandidateId.digest, advisoryHarnessVersion.digest);
  assert.notEqual(directHarnessVersion.digest, advisoryHarnessVersion.digest);
  assert.equal(localEnvironmentIdentity.identityKind, 'environmentIdentity');
  assert.equal(Object.keys(testPackVersions).length, 1);
  assert.notEqual(attempt(19, 'direct'), attempt(19, 'advisory'));
});
