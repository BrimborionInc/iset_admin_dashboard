'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const test = require('node:test');

const { digestCanonical, parseStrictJson } = require('../src/canonical-json');
const {
  BRIDGE_VERSION,
  NativeReadOnlyBridgeError,
  OPERATION_CONTRACT_VERSION,
  PACK_PROFILES,
  collectCleanupEvidence,
  getOperationContract,
  validateOperationContract,
  validateOperationResources,
} = require('../src/native-readonly-bridge');
const {
  NATIVE_READONLY_ADAPTER_VERSION,
  PACK_CONTRACTS,
  PackValidationError,
  validatePackManifest,
} = require('../src/pack-validator');
const { PROCESS_PROTOCOL_VERSION } = require('../src/process-control');

const qualificationRoot = resolve(__dirname, '..');
const manifestPaths = Object.fromEntries(Object.entries(PACK_CONTRACTS).map(([packId, contract]) => [
  packId,
  join(qualificationRoot, contract.manifestPath),
]));
const packs = Object.fromEntries(Object.entries(manifestPaths).map(([packId, path]) => [
  packId,
  parseStrictJson(readFileSync(path)),
]));

function refreshContentDigest(value) {
  const material = structuredClone(value);
  delete material.contentDigest;
  return {
    ...structuredClone(value),
    contentDigest: { algorithm: 'sha256', value: digestCanonical(material) },
  };
}

function expectBridgeCode(action, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof NativeReadOnlyBridgeError);
    assert.equal(error.code, code);
    return true;
  });
}

function expectPackCode(action, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof PackValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

function resourcesFor(pack, operation) {
  const resources = { inputRefs: pack.inputs };
  if (operation.cleanup.residueScope.includes('qualification-owned-attempt-mirror')) {
    resources.mirror = { cleanup() {}, proveAbsent() { return true; } };
  }
  if (operation.cleanup.residueScope.includes('native-test-owned-temporary-roots')) {
    resources.residueBaseline = [];
    resources.residueProbe = () => [];
  }
  return resources;
}

test('one immutable adapter version covers exactly the five admitted pack/profile graphs', () => {
  assert.equal(BRIDGE_VERSION, '2.0.0');
  assert.equal(BRIDGE_VERSION, NATIVE_READONLY_ADAPTER_VERSION);
  assert.equal(PROCESS_PROTOCOL_VERSION, '1.0.0');
  assert.notEqual(PROCESS_PROTOCOL_VERSION, BRIDGE_VERSION);
  assert.equal(OPERATION_CONTRACT_VERSION, '1.0.0');
  assert.deepEqual(Object.keys(PACK_PROFILES), Object.keys(PACK_CONTRACTS));
  assert.deepEqual(Object.keys(PACK_PROFILES), Object.keys(packs));
  assert.equal(Object.values(PACK_PROFILES).flat().length, 16);

  for (const [packId, profiles] of Object.entries(PACK_PROFILES)) {
    const pack = validatePackManifest(packs[packId]);
    assert.equal(pack.requiredAdapter.adapterId, 'native-readonly-bridge');
    assert.equal(pack.requiredAdapter.adapterVersion, BRIDGE_VERSION);
    assert.equal(pack.packVersion, PACK_CONTRACTS[packId].packVersion);
    for (const profile of profiles) {
      const operation = getOperationContract(packId, profile);
      assert.equal(validateOperationContract(pack, profile, operation), true);
      assert.equal(validateOperationResources(pack, operation, resourcesFor(pack, operation)), true);
    }
  }
});

test('native CLI frames use the process protocol rather than the adapter version', () => {
  const cliSource = readFileSync(join(qualificationRoot, 'bin', 'rq-native-readonly.js'), 'utf8');
  assert.equal(
    [...cliSource.matchAll(/protocolVersion: PROCESS_PROTOCOL_VERSION/gu)].length,
    2,
  );
  assert.doesNotMatch(cliSource, /protocolVersion: BRIDGE_VERSION/u);
});

test('stale adapter and pack versions fail closed', () => {
  const staleAdapter = structuredClone(packs['admin-aggregate']);
  staleAdapter.requiredAdapter.adapterVersion = '1.5.0';
  expectPackCode(() => validatePackManifest(refreshContentDigest(staleAdapter)), 'INVALID_ADAPTER');

  const stalePack = structuredClone(packs['admin-aggregate']);
  stalePack.packVersion = '1.0.1';
  expectPackCode(() => validatePackManifest(refreshContentDigest(stalePack)), 'PACK_VERSION_CONFLICT');
});

test('unknown, broadened, and conflicting operation declarations fail closed', () => {
  const pack = packs['admin-aggregate'];
  expectBridgeCode(() => getOperationContract(pack.packId, 'unknown'), 'UNSUPPORTED_PROFILE');

  const conflicting = getOperationContract(pack.packId, 'frontend-failure');
  conflicting.cleanup.required = false;
  expectBridgeCode(
    () => validateOperationContract(pack, 'frontend-failure', conflicting),
    'OPERATION_CONTRACT_CONFLICT',
  );

  const capabilityCeiling = structuredClone(pack);
  capabilityCeiling.requiredAdapter.capabilities = ['process.readonly.local'];
  expectBridgeCode(
    () => validateOperationContract(
      capabilityCeiling,
      'frontend-failure',
      getOperationContract(pack.packId, 'frontend-failure'),
    ),
    'CAPABILITY_BROADENED',
  );

  const effectCeiling = structuredClone(pack);
  effectCeiling.declaredEffects.writePaths = [];
  expectBridgeCode(
    () => validateOperationContract(
      effectCeiling,
      'frontend-failure',
      getOperationContract(pack.packId, 'frontend-failure'),
    ),
    'EFFECT_BROADENED',
  );
});

test('cleanup resources must exactly match the admitted operation', () => {
  const aggregate = packs['admin-aggregate'];
  const mirrorOperation = getOperationContract(aggregate.packId, 'frontend-failure');
  expectBridgeCode(
    () => validateOperationResources(aggregate, mirrorOperation, { inputRefs: aggregate.inputs }),
    'CLEANUP_RESOURCE_CONFLICT',
  );

  const guidance = packs['ai-guidance-contract'];
  const readOnlyOperation = getOperationContract(guidance.packId, 'known-good');
  expectBridgeCode(
    () => validateOperationResources(guidance, readOnlyOperation, {
      inputRefs: guidance.inputs,
      mirror: { cleanup() {}, proveAbsent() { return true; } },
    }),
    'CLEANUP_RESOURCE_CONFLICT',
  );

  const aggregateOperation = getOperationContract(aggregate.packId, 'known-good');
  expectBridgeCode(
    () => validateOperationResources(aggregate, aggregateOperation, {
      inputRefs: aggregate.inputs,
      residueBaseline: [],
    }),
    'CLEANUP_RESOURCE_CONFLICT',
  );
});

test('read-only and forced-interruption profiles declare no cleanup effect', () => {
  for (const packId of Object.keys(PACK_PROFILES)) {
    const operation = getOperationContract(packId, 'forced-interruption');
    assert.equal(operation.effects.effectClass, 'read-only');
    assert.deepEqual(operation.effects.writePaths, []);
    assert.equal(operation.cleanup.required, false);
    const evidence = collectCleanupEvidence(operation, {}, '00000000-0000-4000-8000-000000000001');
    assert.equal(evidence.status, 'unnecessary');
    assert.equal(evidence.residueDecision, 'no-declared-write-effect');
    assert.deepEqual(evidence.residueScope, []);
    assert.equal(evidence.independentProof.passed, true);
  }
});

test('mirror cleanup and its independent absence proof are separate and complete', () => {
  const operation = getOperationContract('admin-aggregate', 'frontend-failure');
  let cleanupCalls = 0;
  let proofCalls = 0;
  const evidence = collectCleanupEvidence(operation, {
    mirror: {
      cleanup() { cleanupCalls += 1; },
      proveAbsent() { proofCalls += 1; return true; },
    },
    residueBaseline: [],
    residueProbe: () => [],
  }, '00000000-0000-4000-8000-000000000002');
  assert.equal(cleanupCalls, 1);
  assert.equal(proofCalls, 1);
  assert.equal(evidence.required, true);
  assert.equal(evidence.status, 'completed');
  assert.equal(evidence.cleanupOwner, 'native-readonly-bridge-and-native-test');
  assert.deepEqual(evidence.residueScope, [
    'qualification-owned-attempt-mirror',
    'native-test-owned-temporary-roots',
  ]);
  assert.equal(evidence.independentProof.kind, 'attempt-mirror-and-native-temp-delta-absence');
  assert.equal(evidence.independentProof.passed, true);
  assert.equal(evidence.residueDecision, 'zero-residue-proved');
});

test('native temporary residue absence is independently proved', () => {
  const operation = getOperationContract('admin-aggregate', 'known-good');
  const evidence = collectCleanupEvidence(operation, {
    residueBaseline: ['pre-existing'],
    residueProbe: () => ['pre-existing'],
  }, '00000000-0000-4000-8000-000000000003');
  assert.equal(evidence.status, 'completed');
  assert.equal(evidence.independentProof.kind, 'native-temp-delta-absence');
  assert.equal(evidence.residueObserved, false);
  assert.deepEqual(evidence.residuePaths, []);
});

test('cleanup failure and detected residue remain distinct failed evidence', () => {
  const mirrorOperation = getOperationContract('admin-aggregate', 'frontend-failure');
  const failedCleanup = collectCleanupEvidence(mirrorOperation, {
    mirror: {
      cleanup() { throw new Error('synthetic cleanup failure'); },
      proveAbsent() { return false; },
    },
    residueBaseline: [],
    residueProbe: () => [],
  }, '00000000-0000-4000-8000-000000000004');
  assert.equal(failedCleanup.status, 'failed');
  assert.equal(failedCleanup.residueDecision, 'residue-proof-failed');
  assert.equal(failedCleanup.residueObserved, true);
  assert.deepEqual(failedCleanup.residuePaths, ['qualification-owned-attempt-mirror']);
  assert.equal(failedCleanup.errors.length, 1);

  const tempOperation = getOperationContract('admin-aggregate', 'known-good');
  const detectedResidue = collectCleanupEvidence(tempOperation, {
    residueBaseline: ['pre-existing'],
    residueProbe: () => ['pre-existing', 'new-attempt-residue'],
  }, '00000000-0000-4000-8000-000000000005');
  assert.equal(detectedResidue.status, 'failed');
  assert.equal(detectedResidue.residueDecision, 'residue-present');
  assert.equal(detectedResidue.residueObserved, true);
  assert.deepEqual(detectedResidue.residuePaths, ['new-attempt-residue']);
});
