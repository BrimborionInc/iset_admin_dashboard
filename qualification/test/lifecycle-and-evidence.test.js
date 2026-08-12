'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeArtifactDigest, digestCanonical } = require('../src/canonical-json');
const {
  EvidenceEmissionError,
  artifactRef,
  createEvidenceEmitter,
} = require('../src/evidence-emitter');
const {
  createHarnessVersion,
  createProductCandidateId,
  createTestPackVersions,
} = require('../src/identities');
const { LifecycleError, createLifecycle } = require('../src/lifecycle');
const { SchemaValidationError, validateArtifact } = require('../src/schema-validator');

const ATTEMPT_ID = 'attempt:123e4567-e89b-42d3-a456-426614174000';
const RECORDED_AT = '2026-08-10T15:00:00.000Z';
const EMPTY_DIGEST = '0'.repeat(64);
const PACK_ID = 'synthetic-lifecycle-pack';
const PACK_VERSION = '1.0.0';

function digest(value = EMPTY_DIGEST) {
  return { algorithm: 'sha256', value };
}

function reference(schemaName, artifactId, value = EMPTY_DIGEST, schemaVersion = '1.0.0') {
  return { schemaName, schemaVersion, artifactId, contentDigest: digest(value) };
}

const ROLE_MANIFEST_REF = reference('role-manifest', 'synthetic-lifecycle-roles', '1'.repeat(64));
const PACK_MANIFEST_REF = reference('pack-manifest', 'synthetic-lifecycle-pack', '2'.repeat(64));
const PLAN_REF = reference(
  'path.release-qualification.qualification-plan',
  'synthetic-lifecycle-plan',
  '3'.repeat(64),
  '1.0.0-draft.2',
);
const CONTRACT_REF = reference('contract', 'synthetic-cleanup-contract', '4'.repeat(64));

const PRODUCT_CANDIDATE_ID = createProductCandidateId({
  manifestRefs: [ROLE_MANIFEST_REF],
  material: {
    repositories: [{
      repositoryRole: 'product',
      repositoryId: 'synthetic-lifecycle-product',
      sourceDigest: '5'.repeat(64),
      dependencyDigest: '6'.repeat(64),
      migrationDigest: '7'.repeat(64),
      generatedArtifactDigest: '8'.repeat(64),
    }],
  },
});
const HARNESS_VERSION = createHarnessVersion({
  manifestRefs: [ROLE_MANIFEST_REF],
  material: {
    qualificationSourceDigest: '9'.repeat(64),
    dependencyDigest: 'a'.repeat(64),
    schemaSetDigest: 'b'.repeat(64),
  },
});
const TEST_PACK_VERSIONS = createTestPackVersions([{
  packId: PACK_ID,
  packVersion: PACK_VERSION,
  manifestRefs: [PACK_MANIFEST_REF],
  material: { assertionDigest: 'c'.repeat(64) },
}]);

function emitterContext(overrides = {}, checkInstanceIds = ['check.read-only']) {
  return {
    planRef: PLAN_REF,
    productCandidateId: PRODUCT_CANDIDATE_ID,
    harnessVersion: HARNESS_VERSION,
    attemptId: ATTEMPT_ID,
    testPackVersions: TEST_PACK_VERSIONS,
    checkBindings: Object.fromEntries(checkInstanceIds.map((checkInstanceId) => [
      checkInstanceId,
      { packId: PACK_ID, packVersion: PACK_VERSION },
    ])),
    producer: {
      authorityId: 'qualification-kernel',
      componentId: 'synthetic-evidence-emitter',
      componentVersion: '0.0.0',
      producerInstanceId: 'synthetic-in-process-attempt',
    },
    sensitivity: 'internal',
    redaction: { state: 'none-required' },
    retentionPolicyRef: {
      policyId: 'qualification-evidence',
      policyVersion: '1.0.0',
      retentionClass: 'attempt-diagnostic',
    },
    ...overrides,
  };
}

function expectCode(action, ErrorType, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof ErrorType, `expected ${ErrorType.name}, received ${error?.constructor?.name}`);
    assert.equal(error.code, code);
    return true;
  });
}

function eventOptions(record, mutationState) {
  const options = { occurredAt: RECORDED_AT, recordedAt: RECORDED_AT };
  if (['prerequisite', 'check', 'cleanup', 'residue'].includes(record.scope)) {
    options.packId = PACK_ID;
    options.packVersion = PACK_VERSION;
  }
  if (mutationState !== undefined) options.mutationState = mutationState;
  return options;
}

function emitRecords(records, mutationStates = {}) {
  const checkInstanceIds = [...new Set(records
    .filter((record) => ['prerequisite', 'check', 'cleanup', 'residue'].includes(record.scope))
    .map((record) => record.subjectId))];
  const emitter = createEvidenceEmitter(emitterContext({}, checkInstanceIds));
  const events = records.map((record) => emitter.emitLifecycle(
    record,
    eventOptions(record, mutationStates[record.lifecycleOrdinal]),
  ));
  return { emitter, events };
}

function buildReadOnlyLifecycle() {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.read-only'] });
  const records = [];
  records.push(lifecycle.openAttempt([PLAN_REF]));
  records.push(lifecycle.beginPrerequisites('check.read-only'));
  records.push(lifecycle.transitionPrerequisites('check.read-only', 'PREREQUISITES_PASSED'));
  records.push(lifecycle.beginCheck('check.read-only'));
  records.push(lifecycle.transitionCheck('check.read-only', 'CHECK_READY'));
  records.push(lifecycle.transitionCheck('check.read-only', 'CHECK_DISPATCHED'));
  records.push(lifecycle.transitionCheck('check.read-only', 'CHECK_RUNNING'));
  records.push(lifecycle.transitionCheck('check.read-only', 'CHECK_COMPLETED'));
  records.push(lifecycle.beginCleanup('check.read-only', 'unnecessary'));
  records.push(lifecycle.beginResidueProof('check.read-only'));
  records.push(lifecycle.beginFinalization());
  records.push(lifecycle.completeFinalization());
  const mutationStates = Object.fromEntries(records
    .filter((record) => ['CHECK_COMPLETED', 'CLEANUP_UNNECESSARY', 'RESIDUE_UNNECESSARY'].includes(record.toState))
    .map((record) => [record.lifecycleOrdinal, 'not-started']));
  return { lifecycle, records, mutationStates };
}

function buildCleanupArtifact() {
  const artifact = {
    schemaName: 'path.release-qualification.cleanup-result',
    schemaVersion: '1.0.0-draft.1',
    artifactId: 'cleanup-synthetic-lifecycle',
    createdAt: RECORDED_AT,
    producer: emitterContext().producer,
    lineageScope: 'attempt',
    productCandidateId: PRODUCT_CANDIDATE_ID,
    harnessVersion: HARNESS_VERSION,
    attemptId: ATTEMPT_ID,
    testPackVersions: TEST_PACK_VERSIONS,
    parentArtifactRefs: [PLAN_REF],
    contentDigest: digest(),
    lifecycleState: 'CLEANUP_UNNECESSARY',
    completeness: { state: 'complete', missingEvidence: [] },
    sensitivity: 'internal',
    redaction: { state: 'none-required' },
    retentionPolicyRef: emitterContext().retentionPolicyRef,
    planRef: PLAN_REF,
    cleanupObligationId: 'cleanup.read-only',
    checkInstanceId: 'check.read-only',
    packId: PACK_ID,
    packVersion: PACK_VERSION,
    cleanupOwner: {
      authorityId: 'synthetic-pack-owner',
      contractRef: CONTRACT_REF,
      version: '1.0.0',
      capabilityTokens: [],
      effectTokens: [],
    },
    status: 'unnecessary',
    cleanupReason: { code: 'proved-no-effect', effectEvidenceRefs: [CONTRACT_REF] },
    affectedResources: [],
    declaredResidueScope: [],
    residueAssertions: [],
    residueDecision: 'not-applicable',
  };
  artifact.contentDigest = computeArtifactDigest(artifact);
  validateArtifact(artifact);
  return artifact;
}

test('read-only lifecycle follows prerequisites, check, cleanup, residue, and finalization in order', () => {
  const { lifecycle, records } = buildReadOnlyLifecycle();
  assert.deepEqual(records.map((record) => record.toState), [
    'ATTEMPT_OPENED',
    'PREREQUISITES_EVALUATING',
    'PREREQUISITES_PASSED',
    'CHECK_PENDING',
    'CHECK_READY',
    'CHECK_DISPATCHED',
    'CHECK_RUNNING',
    'CHECK_COMPLETED',
    'CLEANUP_UNNECESSARY',
    'RESIDUE_UNNECESSARY',
    'ATTEMPT_FINALIZING',
    'FINAL_EVIDENCE_EMITTED',
  ]);
  assert.equal(lifecycle.currentState('attempt'), 'FINAL_EVIDENCE_EMITTED');
  assert.equal(lifecycle.currentState('check', 'check.read-only'), 'CHECK_COMPLETED');
  assert.ok(Object.isFrozen(lifecycle.snapshot()));
});

test('stateful failure retains cleanup failure and independently completed residue evidence', () => {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.stateful'] });
  lifecycle.openAttempt();
  lifecycle.beginPrerequisites('check.stateful');
  lifecycle.transitionPrerequisites('check.stateful', 'PREREQUISITES_PASSED');
  lifecycle.beginCheck('check.stateful');
  lifecycle.transitionCheck('check.stateful', 'CHECK_READY');
  lifecycle.transitionCheck('check.stateful', 'CHECK_DISPATCHED');
  lifecycle.transitionCheck('check.stateful', 'CHECK_RUNNING');
  lifecycle.transitionCheck('check.stateful', 'CHECK_FAILED');
  lifecycle.beginCleanup('check.stateful', 'required');
  lifecycle.transitionCleanup('check.stateful', 'CLEANUP_RUNNING');
  lifecycle.transitionCleanup('check.stateful', 'CLEANUP_FAILED');
  lifecycle.beginResidueProof('check.stateful');
  lifecycle.transitionResidueProof('check.stateful', 'RESIDUE_PROOF_COMPLETED');
  lifecycle.beginFinalization();
  lifecycle.completeFinalization();
  assert.equal(lifecycle.currentState('cleanup', 'check.stateful'), 'CLEANUP_FAILED');
  assert.equal(lifecycle.currentState('residue', 'check.stateful'), 'RESIDUE_PROOF_COMPLETED');
});

test('a failed prerequisite can only lead to a blocked check and no dispatch', () => {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.blocked'] });
  lifecycle.openAttempt();
  lifecycle.beginPrerequisites('check.blocked');
  lifecycle.transitionPrerequisites('check.blocked', 'PREREQUISITE_FAILED');
  lifecycle.beginCheck('check.blocked');
  expectCode(
    () => lifecycle.transitionCheck('check.blocked', 'CHECK_READY'),
    LifecycleError,
    'PREREQUISITE_ADMISSION_DENIED',
  );
  lifecycle.transitionCheck('check.blocked', 'CHECK_BLOCKED');
  lifecycle.beginCleanup('check.blocked', 'unnecessary');
  lifecycle.beginResidueProof('check.blocked');
  lifecycle.beginFinalization();
  assert.equal(lifecycle.currentState('check', 'check.blocked'), 'CHECK_BLOCKED');
});

test('synthetic environment-proof state remains an explicit prerequisite transition', () => {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.proof'] });
  lifecycle.openAttempt();
  lifecycle.beginPrerequisites('check.proof');
  lifecycle.transitionPrerequisites('check.proof', 'ENVIRONMENT_PROVING');
  lifecycle.transitionPrerequisites('check.proof', 'PREREQUISITES_PASSED');
  assert.deepEqual(lifecycle.snapshot().records.slice(-2).map((record) => record.toState), [
    'ENVIRONMENT_PROVING',
    'PREREQUISITES_PASSED',
  ]);
});

test('timeout remains distinct from cancellation and proved cancellation', () => {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.timeout'] });
  lifecycle.openAttempt();
  lifecycle.beginPrerequisites('check.timeout');
  lifecycle.transitionPrerequisites('check.timeout', 'PREREQUISITES_PASSED');
  lifecycle.beginCheck('check.timeout');
  lifecycle.transitionCheck('check.timeout', 'CHECK_READY');
  lifecycle.transitionCheck('check.timeout', 'CHECK_DISPATCHED');
  lifecycle.transitionCheck('check.timeout', 'CHECK_TIMED_OUT');
  lifecycle.transitionCheck('check.timeout', 'CHECK_CANCELLING');
  lifecycle.transitionCheck('check.timeout', 'CHECK_CANCELLED');
  assert.equal(lifecycle.currentState('check', 'check.timeout'), 'CHECK_CANCELLED');
});

test('unproved termination forbids cleanup but remains finalizable as an incomplete blocker', () => {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.termination'] });
  lifecycle.openAttempt();
  lifecycle.beginPrerequisites('check.termination');
  lifecycle.transitionPrerequisites('check.termination', 'PREREQUISITES_PASSED');
  lifecycle.beginCheck('check.termination');
  lifecycle.transitionCheck('check.termination', 'CHECK_READY');
  lifecycle.transitionCheck('check.termination', 'CHECK_DISPATCHED');
  lifecycle.transitionCheck('check.termination', 'CHECK_CANCELLING');
  lifecycle.transitionCheck('check.termination', 'TERMINATION_FAILED');
  expectCode(
    () => lifecycle.beginCleanup('check.termination', 'required'),
    LifecycleError,
    'TERMINATION_NOT_PROVED',
  );
  lifecycle.beginFinalization();
  lifecycle.completeFinalization({ interrupted: true });
  assert.equal(lifecycle.currentState('attempt'), 'FINALIZATION_INTERRUPTED');
});

test('cleanup cannot start early and finalization requires terminal cleanup and residue markers', () => {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.guard'] });
  lifecycle.openAttempt();
  lifecycle.beginPrerequisites('check.guard');
  lifecycle.transitionPrerequisites('check.guard', 'PREREQUISITES_PASSED');
  lifecycle.beginCheck('check.guard');
  lifecycle.transitionCheck('check.guard', 'CHECK_READY');
  expectCode(() => lifecycle.beginCleanup('check.guard', 'required'), LifecycleError, 'CHECK_NOT_TERMINAL');
  lifecycle.transitionCheck('check.guard', 'CHECK_FAILED');
  expectCode(() => lifecycle.beginFinalization(), LifecycleError, 'ATTEMPT_NOT_FINALIZABLE');
  lifecycle.beginCleanup('check.guard', 'required');
  lifecycle.transitionCleanup('check.guard', 'CLEANUP_RUNNING');
  lifecycle.transitionCleanup('check.guard', 'CLEANUP_SUCCEEDED');
  expectCode(() => lifecycle.beginFinalization(), LifecycleError, 'ATTEMPT_NOT_FINALIZABLE');
});

test('interrupted cleanup cannot be mistaken for residue proof or a finalizable check', () => {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.cleanup-interrupted'] });
  lifecycle.openAttempt();
  lifecycle.beginPrerequisites('check.cleanup-interrupted');
  lifecycle.transitionPrerequisites('check.cleanup-interrupted', 'PREREQUISITES_PASSED');
  lifecycle.beginCheck('check.cleanup-interrupted');
  lifecycle.transitionCheck('check.cleanup-interrupted', 'CHECK_READY');
  lifecycle.transitionCheck('check.cleanup-interrupted', 'CHECK_FAILED');
  lifecycle.beginCleanup('check.cleanup-interrupted', 'required');
  lifecycle.transitionCleanup('check.cleanup-interrupted', 'CLEANUP_RUNNING');
  lifecycle.transitionCleanup('check.cleanup-interrupted', 'CLEANUP_INTERRUPTED');
  expectCode(
    () => lifecycle.beginResidueProof('check.cleanup-interrupted'),
    LifecycleError,
    'CLEANUP_NOT_READY_FOR_RESIDUE',
  );
  expectCode(() => lifecycle.beginFinalization(), LifecycleError, 'ATTEMPT_NOT_FINALIZABLE');
});

test('selected checks cannot be omitted or silently added to an attempt lifecycle', () => {
  const lifecycle = createLifecycle({
    attemptId: ATTEMPT_ID,
    checkInstanceIds: ['check.complete', 'check.omitted'],
  });
  lifecycle.openAttempt();
  lifecycle.beginPrerequisites('check.complete');
  lifecycle.transitionPrerequisites('check.complete', 'PREREQUISITES_PASSED');
  lifecycle.beginCheck('check.complete');
  lifecycle.transitionCheck('check.complete', 'CHECK_READY');
  lifecycle.transitionCheck('check.complete', 'CHECK_FAILED');
  lifecycle.beginCleanup('check.complete', 'unnecessary');
  lifecycle.beginResidueProof('check.complete');
  expectCode(() => lifecycle.beginFinalization(), LifecycleError, 'ATTEMPT_NOT_FINALIZABLE');
  expectCode(
    () => lifecycle.beginPrerequisites('check.undeclared'),
    LifecycleError,
    'UNKNOWN_SELECTED_CHECK',
  );
});

test('lifecycle construction fails before recording malformed attempt or selected-check identities', () => {
  expectCode(
    () => createLifecycle({ attemptId: 'attempt:not-a-uuid', checkInstanceIds: ['check.valid'] }),
    LifecycleError,
    'INVALID_ATTEMPT_ID',
  );
  expectCode(
    () => createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: [] }),
    LifecycleError,
    'SELECTED_CHECKS_REQUIRED',
  );
  expectCode(
    () => createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.same', 'check.same'] }),
    LifecycleError,
    'DUPLICATE_SELECTED_CHECK',
  );
});

test('invalid, repeated-conflicting, and post-terminal transitions fail closed', () => {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.invalid'] });
  lifecycle.openAttempt();
  lifecycle.beginPrerequisites('check.invalid');
  lifecycle.transitionPrerequisites('check.invalid', 'PREREQUISITES_PASSED');
  lifecycle.beginCheck('check.invalid');
  expectCode(
    () => lifecycle.transitionCheck('check.invalid', 'CHECK_RUNNING'),
    LifecycleError,
    'INVALID_TRANSITION',
  );
  const ready = lifecycle.transitionCheck('check.invalid', 'CHECK_READY', [CONTRACT_REF]);
  assert.equal(lifecycle.transitionCheck('check.invalid', 'CHECK_READY', [CONTRACT_REF]), ready);
  expectCode(
    () => lifecycle.transitionCheck('check.invalid', 'CHECK_READY', [PLAN_REF]),
    LifecycleError,
    'CONFLICTING_REPEAT',
  );
  lifecycle.transitionCheck('check.invalid', 'CHECK_FAILED');
  expectCode(
    () => lifecycle.transitionCheck('check.invalid', 'CHECK_DISPATCHED'),
    LifecycleError,
    'POST_TERMINAL_TRANSITION',
  );
});

test('finalization interruption is terminal and cannot begin independent validation', () => {
  const { lifecycle } = buildReadOnlyLifecycle();
  expectCode(
    () => lifecycle.completeFinalization({ interrupted: true }),
    LifecycleError,
    'POST_TERMINAL_TRANSITION',
  );

  const interrupted = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.interrupted'] });
  interrupted.openAttempt();
  interrupted.beginPrerequisites('check.interrupted');
  interrupted.transitionPrerequisites('check.interrupted', 'PREREQUISITE_FAILED');
  interrupted.beginCheck('check.interrupted');
  interrupted.transitionCheck('check.interrupted', 'CHECK_BLOCKED');
  interrupted.beginCleanup('check.interrupted', 'unnecessary');
  interrupted.beginResidueProof('check.interrupted');
  interrupted.beginFinalization();
  interrupted.completeFinalization({ interrupted: true });
  expectCode(() => interrupted.beginValidation(), LifecycleError, 'FINAL_EVIDENCE_NOT_AVAILABLE');
});

test('validation acceptance and rejection are modeled as lifecycle states without performing validation', () => {
  const accepted = buildReadOnlyLifecycle().lifecycle;
  accepted.beginValidation();
  accepted.transitionValidation('VALIDATION_ACCEPTED');
  accepted.transitionValidation('ADVISORY_RESULT_AVAILABLE');
  assert.equal(accepted.currentState('validation'), 'ADVISORY_RESULT_AVAILABLE');

  const rejected = buildReadOnlyLifecycle().lifecycle;
  rejected.beginValidation();
  rejected.transitionValidation('VALIDATION_REJECTED');
  rejected.transitionValidation('ADVISORY_RESULT_AVAILABLE');
  assert.equal(rejected.currentState('validation'), 'ADVISORY_RESULT_AVAILABLE');
});

test('emitted lifecycle evidence is schema-valid, gap-free, chained, and immutable', () => {
  const { records, mutationStates } = buildReadOnlyLifecycle();
  const { emitter, events } = emitRecords(records, mutationStates);
  assert.equal(events.length, records.length);
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    assert.equal(validateArtifact(event), event);
    assert.equal(event.attemptSequence, index + 1);
    assert.equal(event.producerSequence, index);
    assert.ok(Object.isFrozen(event));
    const expectedParent = index === 0 ? PLAN_REF : artifactRef(events[index - 1]);
    assert.deepEqual(event.parentArtifactRefs, [expectedParent]);
  }
  const snapshot = emitter.events();
  assert.ok(Object.isFrozen(snapshot));
  assert.throws(() => { snapshot[0].artifactId = 'mutated'; }, TypeError);
  assert.notEqual(emitter.events()[0].artifactId, 'mutated');
});

test('same lifecycle inputs produce byte-for-byte deterministic event and artifact graphs', () => {
  const firstLifecycle = buildReadOnlyLifecycle();
  const secondLifecycle = buildReadOnlyLifecycle();
  const first = emitRecords(firstLifecycle.records, firstLifecycle.mutationStates);
  const second = emitRecords(secondLifecycle.records, secondLifecycle.mutationStates);
  assert.deepEqual(first.events, second.events);
  assert.deepEqual(first.emitter.eventGraph(), second.emitter.eventGraph());

  const cleanup = buildCleanupArtifact();
  const firstGraph = first.emitter.artifactGraph([cleanup]);
  const secondGraph = second.emitter.artifactGraph([cleanup]);
  assert.deepEqual(firstGraph, secondGraph);
  assert.equal(firstGraph.graphDigest.value, digestCanonical({
    profile: firstGraph.profile,
    attemptId: firstGraph.attemptId,
    artifactRefs: firstGraph.artifactRefs,
  }));
});

test('artifact graph ordering is independent of caller order and exact duplicates collapse', () => {
  const { records, mutationStates } = buildReadOnlyLifecycle();
  const { emitter } = emitRecords(records, mutationStates);
  const cleanup = buildCleanupArtifact();
  assert.deepEqual(
    emitter.artifactGraph([cleanup, cleanup]),
    emitter.artifactGraph([cleanup]),
  );
});

test('exact event replay is idempotent and does not append a second event', () => {
  const { records, mutationStates } = buildReadOnlyLifecycle();
  const emitter = createEvidenceEmitter(emitterContext({}, ['check.read-only']));
  const first = emitter.emitLifecycle(records[0], eventOptions(records[0], mutationStates[records[0].lifecycleOrdinal]));
  const replay = emitter.replay(first);
  assert.equal(replay.appended, false);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.event, first);
  assert.equal(emitter.events().length, 1);
  assert.equal(emitter.eventGraph().quarantinedEventRefs.length, 0);
});

test('conflicting duplicate bytes are quarantined without changing accepted evidence', () => {
  const { records } = buildReadOnlyLifecycle();
  const emitter = createEvidenceEmitter(emitterContext({}, ['check.read-only']));
  const first = emitter.emitLifecycle(records[0], eventOptions(records[0]));
  const conflicting = structuredClone(first);
  conflicting.recordedAt = '2026-08-10T15:00:01.000Z';
  conflicting.contentDigest = computeArtifactDigest(conflicting);
  expectCode(() => emitter.replay(conflicting), EvidenceEmissionError, 'DUPLICATE_CONFLICT');
  assert.equal(emitter.events().length, 1);
  assert.equal(emitter.eventGraph().quarantinedEventRefs.length, 1);
});

test('missing and out-of-order event positions fail closed and are retained as quarantine references', () => {
  const { records, mutationStates } = buildReadOnlyLifecycle();
  const source = emitRecords(records.slice(0, 2), mutationStates);
  const target = createEvidenceEmitter(emitterContext({}, ['check.read-only']));
  expectCode(() => target.replay(source.events[1]), EvidenceEmissionError, 'OUT_OF_ORDER_EVENT');
  expectCode(() => target.eventGraph(), EvidenceEmissionError, 'EMPTY_EVENT_GRAPH');
});

test('replay cannot append unseen evidence even when it is the next valid sequence', () => {
  const { records } = buildReadOnlyLifecycle();
  const source = createEvidenceEmitter(emitterContext({}, ['check.read-only']));
  const event = source.emitLifecycle(records[0], eventOptions(records[0]));
  const target = createEvidenceEmitter(emitterContext({}, ['check.read-only']));
  expectCode(() => target.replay(event), EvidenceEmissionError, 'UNSEEN_REPLAY');
  assert.equal(target.events().length, 0);
});

test('stale identity lineage is rejected before it can enter the accepted chain', () => {
  const { records } = buildReadOnlyLifecycle();
  const emitter = createEvidenceEmitter(emitterContext({}, ['check.read-only']));
  const first = emitter.emitLifecycle(records[0], eventOptions(records[0]));
  const stale = structuredClone(first);
  stale.harnessVersion = createHarnessVersion({
    manifestRefs: [ROLE_MANIFEST_REF],
    material: {
      qualificationSourceDigest: 'd'.repeat(64),
      dependencyDigest: 'a'.repeat(64),
      schemaSetDigest: 'b'.repeat(64),
    },
  });
  stale.contentDigest = computeArtifactDigest(stale);
  expectCode(() => emitter.replay(stale), EvidenceEmissionError, 'STALE_OR_CONFLICTING_LINEAGE');
  assert.equal(emitter.events().length, 1);
});

test('unknown, stale, and omitted pack bindings fail before check-scoped evidence emission', () => {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.pack-binding'] });
  lifecycle.openAttempt();
  const record = lifecycle.beginPrerequisites('check.pack-binding');
  const emitter = createEvidenceEmitter(emitterContext({}, ['check.pack-binding']));
  emitter.emitLifecycle(lifecycle.snapshot().records[0], eventOptions(lifecycle.snapshot().records[0]));

  expectCode(
    () => emitter.emitLifecycle(record, { occurredAt: RECORDED_AT, recordedAt: RECORDED_AT }),
    EvidenceEmissionError,
    'PACK_BINDING_REQUIRED',
  );
  expectCode(
    () => emitter.emitLifecycle(record, { ...eventOptions(record), packId: 'unknown-pack' }),
    EvidenceEmissionError,
    'PACK_BINDING_CONFLICT',
  );
  expectCode(
    () => emitter.emitLifecycle(record, { ...eventOptions(record), packVersion: '2.0.0' }),
    EvidenceEmissionError,
    'PACK_BINDING_CONFLICT',
  );

  const otherLifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.not-selected-here'] });
  otherLifecycle.openAttempt();
  const unselected = otherLifecycle.beginPrerequisites('check.not-selected-here');
  expectCode(
    () => emitter.emitLifecycle(unselected, eventOptions(unselected)),
    EvidenceEmissionError,
    'PACK_BINDING_CONFLICT',
  );
});

test('required mutation markers and canonical timestamps fail closed when absent or malformed', () => {
  const lifecycle = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.markers'] });
  lifecycle.openAttempt();
  lifecycle.beginPrerequisites('check.markers');
  lifecycle.transitionPrerequisites('check.markers', 'PREREQUISITES_PASSED');
  lifecycle.beginCheck('check.markers');
  lifecycle.transitionCheck('check.markers', 'CHECK_READY');
  const failed = lifecycle.transitionCheck('check.markers', 'CHECK_FAILED');
  const emitter = createEvidenceEmitter(emitterContext({}, ['check.markers']));
  expectCode(
    () => emitter.emitLifecycle(failed, eventOptions(failed)),
    EvidenceEmissionError,
    'MUTATION_STATE_REQUIRED',
  );

  const opened = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.markers'] }).openAttempt();
  expectCode(
    () => createEvidenceEmitter(emitterContext({}, ['check.markers'])).emitLifecycle(opened, {
      occurredAt: 'not-a-timestamp',
      recordedAt: RECORDED_AT,
    }),
    SchemaValidationError,
    'SCHEMA_VALIDATION_FAILED',
  );
});

test('emitter context and event option shapes reject ambient or undeclared fields', () => {
  expectCode(
    () => createEvidenceEmitter(emitterContext({ ambientEnvironment: { inherited: true } })),
    EvidenceEmissionError,
    'INVALID_CONTEXT',
  );
  const opened = createLifecycle({ attemptId: ATTEMPT_ID, checkInstanceIds: ['check.context'] }).openAttempt();
  expectCode(
    () => createEvidenceEmitter(emitterContext({}, ['check.context'])).emitLifecycle(opened, {
      occurredAt: RECORDED_AT,
      recordedAt: RECORDED_AT,
      retry: true,
    }),
    EvidenceEmissionError,
    'INVALID_CONTEXT',
  );
});

test('artifact graph rejects cross-attempt and same-identity conflicting evidence', () => {
  const { records, mutationStates } = buildReadOnlyLifecycle();
  const { emitter } = emitRecords(records, mutationStates);
  const cleanup = buildCleanupArtifact();
  const crossAttempt = structuredClone(cleanup);
  crossAttempt.attemptId = 'attempt:123e4567-e89b-42d3-a456-426614174001';
  crossAttempt.contentDigest = computeArtifactDigest(crossAttempt);
  expectCode(
    () => emitter.artifactGraph([crossAttempt]),
    EvidenceEmissionError,
    'STALE_OR_CONFLICTING_LINEAGE',
  );

  const staleHarness = structuredClone(cleanup);
  staleHarness.harnessVersion = createHarnessVersion({
    manifestRefs: [ROLE_MANIFEST_REF],
    material: {
      qualificationSourceDigest: 'd'.repeat(64),
      dependencyDigest: 'a'.repeat(64),
      schemaSetDigest: 'b'.repeat(64),
    },
  });
  staleHarness.contentDigest = computeArtifactDigest(staleHarness);
  expectCode(
    () => emitter.artifactGraph([staleHarness]),
    EvidenceEmissionError,
    'STALE_OR_CONFLICTING_LINEAGE',
  );

  const conflict = structuredClone(cleanup);
  conflict.createdAt = '2026-08-10T15:00:01.000Z';
  conflict.contentDigest = computeArtifactDigest(conflict);
  expectCode(
    () => emitter.artifactGraph([cleanup, conflict]),
    EvidenceEmissionError,
    'ARTIFACT_GRAPH_CONFLICT',
  );
});
