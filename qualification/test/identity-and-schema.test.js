'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CanonicalJsonError,
  canonicalize,
  computeArtifactDigest,
  digestBytes,
  digestCanonical,
  parseStrictJson,
} = require('../src/canonical-json');
const {
  IdentityError,
  assertIdentitySeparation,
  createAttemptId,
  createEnvironmentIdentity,
  createHarnessVersion,
  createProductCandidateId,
  createTestPackVersions,
  verifyContentIdentity,
  verifyTestPackVersions,
} = require('../src/identities');
const {
  SCHEMA_FILES,
  SUPPORTED_SCHEMA_VERSIONS,
  SchemaValidationError,
  createSchemaRegistry,
  validateArtifact,
} = require('../src/schema-validator');

const CREATED_AT = '2026-08-10T12:00:00.000Z';
const ATTEMPT_ID = createAttemptId('123e4567-e89b-42d3-a456-426614174000');
const EMPTY_DIGEST = '0'.repeat(64);
const CANONICAL_SELECTION_ORIGINS = Object.freeze([
  'mandatory-core',
  'impacted-domain',
  'dependency',
  'explicit-suite',
  'scheduled-full',
  'release-operation',
]);

function digest(value = EMPTY_DIGEST) {
  return { algorithm: 'sha256', value };
}

function reference(schemaName, artifactId, value = EMPTY_DIGEST, schemaVersion = '1.0.0-draft.1') {
  return { schemaName, schemaVersion, artifactId, contentDigest: digest(value) };
}

const ROLE_MANIFEST_REF = reference('role-manifest', 'synthetic-role-manifest', '1'.repeat(64), '1.0.0');
const PACK_MANIFEST_REF = reference('pack-manifest', 'synthetic-pack-manifest', '2'.repeat(64), '1.0.0');
const POLICY_REF = reference('policy', 'synthetic-policy', '3'.repeat(64), '1.0.0');
const CONTRACT_REF = reference('contract', 'synthetic-contract', '4'.repeat(64), '1.0.0');
const ADAPTER_REF = reference('adapter', 'synthetic-adapter', '5'.repeat(64), '1.0.0');
const COMMAND_REF = reference('command-declaration', 'synthetic-command', '6'.repeat(64), '1.0.0');
const ENVIRONMENT_PROOF_REF = reference('environment-proof', 'synthetic-environment-proof', '7'.repeat(64), '1.0.0');

const candidateSource = fs.readFileSync(path.join(__dirname, 'fixtures', 'candidate', 'source.txt'));
const productMaterial = {
  repositories: [{
    repositoryRole: 'product',
    repositoryId: 'synthetic-product',
    sourceDigest: digestBytes(candidateSource),
    dependencyDigest: '8'.repeat(64),
    migrationDigest: '9'.repeat(64),
    generatedArtifactDigest: 'a'.repeat(64),
  }],
};
const harnessMaterial = {
  qualificationSourceDigest: 'b'.repeat(64),
  dependencyDigest: 'c'.repeat(64),
  schemaSetDigest: 'd'.repeat(64),
};
const environmentTarget = {
  targetClass: 'local',
  targetName: 'synthetic-local',
  configurationDigest: 'e'.repeat(64),
  capabilities: ['pure-local-validation'],
  proofRefs: [ENVIRONMENT_PROOF_REF],
};
const packMaterial = {
  assertionDigest: 'f'.repeat(64),
  fixtureDigest: '1'.repeat(64),
  selectorDigest: '2'.repeat(64),
};
const identities = Object.freeze({
  productCandidateId: createProductCandidateId({ manifestRefs: [ROLE_MANIFEST_REF], material: productMaterial }),
  harnessVersion: createHarnessVersion({ manifestRefs: [ROLE_MANIFEST_REF], material: harnessMaterial }),
  attemptId: ATTEMPT_ID,
  environmentIdentity: createEnvironmentIdentity({
    manifestRefs: [ROLE_MANIFEST_REF],
    material: { proofDigest: ENVIRONMENT_PROOF_REF.contentDigest.value },
    target: environmentTarget,
  }),
  testPackVersions: createTestPackVersions([{
    packId: 'synthetic-pack',
    packVersion: '1.0.0',
    manifestRefs: [PACK_MANIFEST_REF],
    material: packMaterial,
  }]),
});

function producer(componentId) {
  return {
    authorityId: 'qualification-kernel',
    componentId,
    componentVersion: '0.0.0',
    producerInstanceId: 'synthetic-producer',
  };
}

function completeness(state = 'complete') {
  return {
    state,
    missingEvidence: state === 'complete' ? [] : [{ code: 'missing-runner-output' }],
  };
}

function common(schemaName, artifactId, overrides = {}) {
  return Object.fromEntries(Object.entries({
    schemaName,
    schemaVersion: SUPPORTED_SCHEMA_VERSIONS[schemaName],
    artifactId,
    createdAt: CREATED_AT,
    producer: producer(`${schemaName}-producer`),
    lineageScope: 'attempt',
    productCandidateId: identities.productCandidateId,
    harnessVersion: identities.harnessVersion,
    attemptId: identities.attemptId,
    testPackVersions: identities.testPackVersions,
    parentArtifactRefs: [],
    contentDigest: digest(),
    lifecycleState: 'ATTEMPT_OPENED',
    completeness: completeness(),
    sensitivity: 'internal',
    redaction: { state: 'none-required' },
    retentionPolicyRef: {
      policyId: 'qualification-evidence',
      policyVersion: '1.0.0',
      retentionClass: 'attempt-diagnostic',
    },
    ...overrides,
  }).filter(([, value]) => value !== undefined));
}

function finalize(artifact) {
  artifact.contentDigest = computeArtifactDigest(artifact);
  return artifact;
}

function artifactReference(artifact) {
  return reference(artifact.schemaName, artifact.artifactId, artifact.contentDigest.value, artifact.schemaVersion);
}

function buildQualificationPlan() {
  return finalize(common('path.release-qualification.qualification-plan', 'plan-synthetic', {
    lineageScope: 'pre-attempt',
    attemptId: undefined,
    testPackVersions: undefined,
    lifecycleState: 'IDENTITIES_BOUND',
    invocationRef: reference('invocation', 'synthetic-invocation'),
    requestedTarget: { targetClass: 'local', targetName: 'synthetic-local', policyRef: POLICY_REF },
    requestedScope: { changeRefs: [ROLE_MANIFEST_REF], operations: [], requestedSuites: [], fullRegressionTriggers: [] },
    identityBindings: {
      productCandidateId: identities.productCandidateId,
      harnessVersion: identities.harnessVersion,
      availablePackRegistryRef: reference('pack-registry', 'synthetic-pack-registry'),
    },
    scopeResolution: { mappedInputs: ['synthetic-change'], rejectedInputs: [] },
    evidenceContract: {
      schemaVersions: {
        'qualification-plan': '1.0.0-draft.2',
        'execution-event': '1.0.0-draft.1',
        'check-result': '1.0.0-draft.1',
        failure: '1.0.0-draft.1',
        'cleanup-result': '1.0.0-draft.1',
        'final-evidence': '1.0.0-draft.2',
      },
      canonicalizationProfile: 'RQ-C14N-1',
      digestAlgorithm: 'sha256',
      resultLimitBytes: 65536,
      logLimitBytes: 262144,
      retentionPolicyRef: {
        policyId: 'qualification-evidence',
        policyVersion: '1.0.0',
        retentionClass: 'release-core',
      },
    },
  }));
}

function buildExecutionEvent(plan = buildQualificationPlan()) {
  const planRef = artifactReference(plan);
  return finalize(common('path.release-qualification.execution-event', 'event-synthetic', {
    parentArtifactRefs: [planRef],
    lifecycleState: 'CHECK_RUNNING',
    planRef,
    attemptSequence: 1,
    producerSequence: 1,
    eventType: 'progress',
    occurredAt: CREATED_AT,
    recordedAt: CREATED_AT,
    checkInstanceId: 'synthetic-check-instance',
    packId: 'synthetic-pack',
    packVersion: '1.0.0',
    progress: { milestoneId: 'assertions-started', heartbeat: false },
  }));
}

function buildCheckResult(plan = buildQualificationPlan()) {
  const planRef = artifactReference(plan);
  const terminalEventRef = reference('path.release-qualification.execution-event', 'terminal-event');
  return finalize(common('path.release-qualification.check-result', 'result-synthetic', {
    parentArtifactRefs: [planRef],
    lifecycleState: 'CHECK_COMPLETED',
    planRef,
    checkInstanceId: 'synthetic-check-instance',
    checkDefinitionRef: reference('check-definition', 'synthetic-check'),
    packId: 'synthetic-pack',
    packVersion: '1.0.0',
    testLevel: 'unit',
    adapterRef: ADAPTER_REF,
    nativeRunnerRef: reference('native-runner', 'synthetic-native-runner'),
    nativeContractRefs: [CONTRACT_REF],
    commandDeclarationRef: COMMAND_REF,
    eventRange: { firstSequence: 1, lastSequence: 2 },
    terminalEventRef,
    status: 'passed',
    nativeStatus: { value: 'passed', mappingRuleRef: POLICY_REF },
    assertions: [{
      assertionId: 'synthetic-assertion',
      status: 'passed',
      contractRef: CONTRACT_REF,
      expected: { type: 'boolean', value: true },
      observed: { type: 'boolean', value: true },
    }],
    prerequisiteResultRefs: [],
    outputRefs: [],
    attachmentRefs: [],
    executionFacts: {
      startSequence: 1,
      endSequence: 2,
      terminalKind: 'exit',
      exitCode: 0,
      timeout: false,
      cancellation: false,
      terminationProved: true,
      lastAcceptedOutputSequence: 1,
      outputTruncated: false,
    },
    effectsObserved: { declaredEffectTokens: [], observedEffectTokens: [], undeclaredEffectTokens: [] },
    mutationState: 'not-started',
    resultSummary: { passed: 1, failed: 0, notRun: 0, blocked: false },
  }));
}

function buildFailure(plan = buildQualificationPlan()) {
  const planRef = artifactReference(plan);
  return finalize(common('path.release-qualification.failure', 'failure-synthetic', {
    parentArtifactRefs: [planRef],
    lifecycleState: 'CHECK_FAILED',
    completeness: completeness('partial'),
    planRef,
    resultRef: reference('path.release-qualification.check-result', 'failed-result'),
    primaryClassification: 'unclassified',
    failedPhase: 'execution',
    checkInstanceId: 'synthetic-check-instance',
    commandDeclarationRef: COMMAND_REF,
    adapterRef: ADAPTER_REF,
    classificationRuleRef: POLICY_REF,
    contractRefs: [CONTRACT_REF],
    supportingEvidenceRefs: [],
    evidenceSufficiency: 'insufficient',
    deterministicBasis: {
      matchedRuleId: 'missing-required-evidence',
      factRefs: [],
      comparisons: [],
    },
    contributingConditions: [],
    knownEffects: { completed: [], mayHaveStarted: [], prevented: [], unknown: [] },
    mutationState: 'not-started',
    nextSafeAction: {
      code: 'preserve-and-stop',
      prerequisiteEvidenceRefs: [],
      prohibitedContinuation: 'Do not retry without the missing evidence.',
      requiredIdentityChange: 'none',
    },
    mandatoryStop: true,
    mandatoryStopReasons: ['unclassified'],
  }));
}

function buildCleanupResult(plan = buildQualificationPlan()) {
  const planRef = artifactReference(plan);
  return finalize(common('path.release-qualification.cleanup-result', 'cleanup-synthetic', {
    parentArtifactRefs: [planRef],
    lifecycleState: 'CLEANUP_UNNECESSARY',
    planRef,
    cleanupObligationId: 'synthetic-cleanup-obligation',
    checkInstanceId: 'synthetic-check-instance',
    packId: 'synthetic-pack',
    packVersion: '1.0.0',
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
  }));
}

function buildFinalEvidence(plan = buildQualificationPlan()) {
  const planRef = artifactReference(plan);
  const event = buildExecutionEvent(plan);
  const result = buildCheckResult(plan);
  const cleanup = buildCleanupResult(plan);
  const eventRef = artifactReference(event);
  const resultRef = artifactReference(result);
  const cleanupRef = artifactReference(cleanup);
  return finalize(common('path.release-qualification.final-evidence', 'final-synthetic', {
    environmentIdentityRef: ENVIRONMENT_PROOF_REF,
    parentArtifactRefs: [planRef, eventRef, resultRef, cleanupRef],
    lifecycleState: 'FINAL_EVIDENCE_EMITTED',
    planRef,
    planDigest: plan.contentDigest,
    identitySummary: {
      productCandidateId: identities.productCandidateId,
      harnessVersion: identities.harnessVersion,
      attemptId: identities.attemptId,
      environmentProofRefs: [ENVIRONMENT_PROOF_REF],
      testPackVersions: identities.testPackVersions,
    },
    requestedScope: { planScopeRef: planRef, scopeDigest: digest(digestCanonical(plan.requestedScope)) },
    selectedScope: {
      checks: [{
        checkInstanceId: 'synthetic-check-instance',
        packId: 'synthetic-pack',
        packVersion: '1.0.0',
        inclusionOrigins: ['mandatory-core'],
        dependencyRefs: [],
      }],
      dependencyDigest: digest('b'.repeat(64)),
      selectionInputDigest: digest('c'.repeat(64)),
      selectionOutputDigest: digest('d'.repeat(64)),
    },
    prerequisiteResults: [],
    eventGraph: {
      eventRefs: [eventRef],
      firstSequence: 1,
      lastSequence: 1,
      missingRanges: [],
      quarantinedEventRefs: [],
      graphDigest: digest(digestCanonical([eventRef])),
    },
    checkResults: [resultRef],
    failures: [],
    cancellationAndTermination: { actionRefs: [], terminationRequired: false, terminationProved: true },
    cleanupAndResidue: {
      obligationIds: [],
      cleanupResultRefs: [cleanupRef],
      residueDecision: 'not-applicable',
      unresolvedEffects: [],
      escalationRefs: [],
    },
    attachmentIndex: [],
    missingOrPartialEvidence: {
      items: [],
      lastTrustworthyState: 'FINAL_EVIDENCE_EMITTED',
      unknownEffects: [],
      residueUncertainty: false,
    },
    blockers: [],
    decisionRuleRef: POLICY_REF,
    producerAdvisoryStatus: 'GO',
    validationHandoff: {
      reconstructionInputRefs: [planRef, eventRef, resultRef, cleanupRef],
      validatorVersion: '1.0.0',
      selfApproved: false,
    },
  }));
}

function buildAllArtifacts() {
  const plan = buildQualificationPlan();
  return {
    'qualification-plan': plan,
    'execution-event': buildExecutionEvent(plan),
    'check-result': buildCheckResult(plan),
    failure: buildFailure(plan),
    'cleanup-result': buildCleanupResult(plan),
    'final-evidence': buildFinalEvidence(plan),
  };
}

function clone(value) {
  return structuredClone(value);
}

function expectCode(action, ErrorType, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof ErrorType, `expected ${ErrorType.name}, received ${error?.constructor?.name}`);
    assert.equal(error.code, code);
    return true;
  });
}

test('the isolated registry compiles exactly the six approved schemas', () => {
  const registry = createSchemaRegistry();
  assert.equal(Object.keys(registry.schemas).length, 6);
  assert.deepEqual(Object.keys(registry.schemas).sort(), Object.keys(SCHEMA_FILES).sort());
  for (const [schemaName, schema] of Object.entries(registry.schemas)) {
    assert.equal(schema.properties.schemaVersion.const, SUPPORTED_SCHEMA_VERSIONS[schemaName]);
  }
});

test('the schema registry exposes the exact mixed-version graph', () => {
  assert.deepEqual(SUPPORTED_SCHEMA_VERSIONS, {
    'path.release-qualification.qualification-plan': '1.0.0-draft.2',
    'path.release-qualification.execution-event': '1.0.0-draft.1',
    'path.release-qualification.check-result': '1.0.0-draft.1',
    'path.release-qualification.failure': '1.0.0-draft.1',
    'path.release-qualification.cleanup-result': '1.0.0-draft.1',
    'path.release-qualification.final-evidence': '1.0.0-draft.2',
  });
  assert.deepEqual(buildQualificationPlan().evidenceContract.schemaVersions, {
    'qualification-plan': '1.0.0-draft.2',
    'execution-event': '1.0.0-draft.1',
    'check-result': '1.0.0-draft.1',
    failure: '1.0.0-draft.1',
    'cleanup-result': '1.0.0-draft.1',
    'final-evidence': '1.0.0-draft.2',
  });
});

test('both origin contracts accept all six canonical selection origins', async (t) => {
  const registry = createSchemaRegistry();
  const planSchema = registry.schemas['path.release-qualification.qualification-plan'];
  const selectedCheckValidator = registry.ajv.getSchema(`${planSchema.$id}#/$defs/selectedCheck`);
  assert.ok(selectedCheckValidator);

  const selectedCheck = {
    checkInstanceId: 'synthetic-check-instance',
    checkDefinitionRef: reference('check-definition', 'synthetic-check'),
    packId: 'synthetic-pack',
    packVersion: '1.0.0',
    nativeContractRef: CONTRACT_REF,
    adapterCapabilities: [],
    inclusionOrigins: [],
  };

  for (const origin of CANONICAL_SELECTION_ORIGINS) {
    await t.test(origin, () => {
      assert.equal(selectedCheckValidator({ ...selectedCheck, inclusionOrigins: [origin] }), true);
      const finalEvidence = buildFinalEvidence();
      finalEvidence.selectedScope.checks[0].inclusionOrigins = [origin];
      finalize(finalEvidence);
      assert.equal(validateArtifact(finalEvidence), finalEvidence);
    });
  }

  assert.equal(selectedCheckValidator({
    ...selectedCheck,
    inclusionOrigins: [...CANONICAL_SELECTION_ORIGINS],
  }), true);
  const finalEvidence = buildFinalEvidence();
  finalEvidence.selectedScope.checks[0].inclusionOrigins = [...CANONICAL_SELECTION_ORIGINS];
  finalize(finalEvidence);
  assert.equal(validateArtifact(finalEvidence), finalEvidence);
});

test('obsolete, unknown, and malformed selection origins fail in both contracts', async (t) => {
  const registry = createSchemaRegistry();
  const planSchema = registry.schemas['path.release-qualification.qualification-plan'];
  const selectedCheckValidator = registry.ajv.getSchema(`${planSchema.$id}#/$defs/selectedCheck`);
  const baseSelectedCheck = {
    checkInstanceId: 'synthetic-check-instance',
    checkDefinitionRef: reference('check-definition', 'synthetic-check'),
    packId: 'synthetic-pack',
    packVersion: '1.0.0',
    nativeContractRef: CONTRACT_REF,
    adapterCapabilities: [],
  };
  const invalidCases = {
    obsolete: ['explicit-request'],
    unknown: ['unexpected-origin'],
    empty: [],
    duplicate: ['mandatory-core', 'mandatory-core'],
    'not-an-array': 'mandatory-core',
  };

  for (const [name, inclusionOrigins] of Object.entries(invalidCases)) {
    await t.test(name, () => {
      assert.equal(selectedCheckValidator({ ...baseSelectedCheck, inclusionOrigins }), false);
      const finalEvidence = buildFinalEvidence();
      finalEvidence.selectedScope.checks[0].inclusionOrigins = inclusionOrigins;
      finalize(finalEvidence);
      expectCode(() => validateArtifact(finalEvidence), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
    });
  }
});

test('all six positive synthetic artifacts pass strict schema, digest, and identity validation', async (t) => {
  for (const [name, artifact] of Object.entries(buildAllArtifacts())) {
    await t.test(name, () => {
      assert.equal(validateArtifact(artifact), artifact);
      const raw = JSON.stringify(artifact);
      assert.deepEqual(validateArtifact(raw), parseStrictJson(raw));
    });
  }
});

test('every schema rejects a missing required field', async (t) => {
  for (const [name, artifact] of Object.entries(buildAllArtifacts())) {
    await t.test(name, () => {
      const invalid = clone(artifact);
      delete invalid.artifactId;
      finalize(invalid);
      expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
    });
  }
});

test('every schema rejects unknown fields without removing them', async (t) => {
  for (const [name, artifact] of Object.entries(buildAllArtifacts())) {
    await t.test(name, () => {
      const invalid = clone(artifact);
      invalid.unknownSprint2AField = true;
      finalize(invalid);
      expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
      assert.equal(invalid.unknownSprint2AField, true);
    });
  }
});

test('malformed common fields fail schema validation', () => {
  const invalid = buildAllArtifacts()['execution-event'];
  invalid.createdAt = '2026-08-10 12:00:00';
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
});

test('attempt evidence fails closed when a bound product identity is missing', () => {
  const invalid = buildAllArtifacts()['execution-event'];
  delete invalid.productCandidateId;
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
});

test('forbidden pre-attempt identity fields fail closed', () => {
  const invalid = buildAllArtifacts().failure;
  invalid.lineageScope = 'pre-attempt';
  delete invalid.productCandidateId;
  delete invalid.harnessVersion;
  delete invalid.testPackVersions;
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
});

test('plan identity bindings cannot conflict with the top-level identity', () => {
  const invalid = buildAllArtifacts()['qualification-plan'];
  invalid.identityBindings.harnessVersion = createHarnessVersion({
    manifestRefs: [ROLE_MANIFEST_REF],
    material: { ...harnessMaterial, schemaSetDigest: '1'.repeat(64) },
  });
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'IDENTITY_BINDING_CONFLICT');
});

test('event-specific required evidence cannot be omitted', () => {
  const invalid = buildAllArtifacts()['execution-event'];
  delete invalid.progress;
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
});

test('passing check status cannot conflict with a failed lifecycle state', () => {
  const invalid = buildAllArtifacts()['check-result'];
  invalid.lifecycleState = 'CHECK_FAILED';
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
});

test('check pack version must match the attempt-bound testPackVersions', () => {
  const invalid = buildAllArtifacts()['check-result'];
  invalid.packVersion = '2.0.0';
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'IDENTITY_BINDING_CONFLICT');
});

test('insufficient failure evidence cannot receive a classified product verdict', () => {
  const invalid = buildAllArtifacts().failure;
  invalid.primaryClassification = 'product';
  invalid.mandatoryStop = false;
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
});

test('cleanup execution is forbidden when cleanup is recorded as unnecessary', () => {
  const invalid = buildAllArtifacts()['cleanup-result'];
  invalid.cleanupActionRefs = [ADAPTER_REF];
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
});

test('final evidence can never claim release-admission authority', () => {
  const invalid = buildAllArtifacts()['final-evidence'];
  invalid.releaseAdmissionAuthority = 'advisory-harness';
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
});

test('a passed final outcome cannot contain a failure reference', () => {
  const invalid = buildAllArtifacts()['final-evidence'];
  invalid.failures.push(invalid.checkResults[0]);
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
});

test('final identity summary cannot conflict with its immutable envelope', () => {
  const invalid = buildAllArtifacts()['final-evidence'];
  invalid.identitySummary.harnessVersion = createHarnessVersion({
    manifestRefs: [ROLE_MANIFEST_REF],
    material: { ...harnessMaterial, dependencyDigest: '5'.repeat(64) },
  });
  finalize(invalid);
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'IDENTITY_BINDING_CONFLICT');
});

test('current, stale, and unsupported schema versions follow the exact version graph', () => {
  for (const artifact of Object.values(buildAllArtifacts())) {
    assert.equal(validateArtifact(artifact), artifact);
  }

  for (const schemaName of [
    'path.release-qualification.qualification-plan',
    'path.release-qualification.final-evidence',
  ]) {
    const invalid = Object.values(buildAllArtifacts()).find((artifact) => artifact.schemaName === schemaName);
    invalid.schemaVersion = '1.0.0-draft.1';
    finalize(invalid);
    expectCode(() => validateArtifact(invalid), SchemaValidationError, 'UNSUPPORTED_SCHEMA_VERSION');
  }

  for (const schemaName of [
    'path.release-qualification.execution-event',
    'path.release-qualification.check-result',
    'path.release-qualification.failure',
    'path.release-qualification.cleanup-result',
  ]) {
    const invalid = Object.values(buildAllArtifacts()).find((artifact) => artifact.schemaName === schemaName);
    invalid.schemaVersion = '1.0.0-draft.2';
    finalize(invalid);
    expectCode(() => validateArtifact(invalid), SchemaValidationError, 'UNSUPPORTED_SCHEMA_VERSION');
  }

  const unsupported = buildAllArtifacts()['qualification-plan'];
  unsupported.schemaVersion = '2.0.0';
  finalize(unsupported);
  expectCode(() => validateArtifact(unsupported), SchemaValidationError, 'UNSUPPORTED_SCHEMA_VERSION');
});

test('qualification plans reject stale, conflicting, or unknown evidence version graphs', () => {
  const stale = buildQualificationPlan();
  stale.evidenceContract.schemaVersions['final-evidence'] = '1.0.0-draft.1';
  finalize(stale);
  expectCode(() => validateArtifact(stale), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');

  const conflicting = buildQualificationPlan();
  conflicting.evidenceContract.schemaVersions['execution-event'] = '1.0.0-draft.2';
  finalize(conflicting);
  expectCode(() => validateArtifact(conflicting), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');

  const unknown = buildQualificationPlan();
  unknown.evidenceContract.schemaVersions['unknown-evidence'] = '1.0.0-draft.1';
  finalize(unknown);
  expectCode(() => validateArtifact(unknown), SchemaValidationError, 'SCHEMA_VALIDATION_FAILED');
});

test('a stale content digest fails even when the artifact remains structurally valid', () => {
  const invalid = buildAllArtifacts()['check-result'];
  invalid.resultSummary.passed = 2;
  expectCode(() => validateArtifact(invalid), SchemaValidationError, 'CONTENT_DIGEST_MISMATCH');
});

test('canonical equality and hashes are independent of object-key insertion order', () => {
  const first = { b: 2, nested: { z: 3, a: 1 }, a: 1 };
  const second = { a: 1, nested: { a: 1, z: 3 }, b: 2 };
  assert.equal(canonicalize(first), canonicalize(second));
  assert.equal(digestCanonical(first), digestCanonical(second));
  assert.equal(digestCanonical({ b: 2, a: 1 }), '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777');
});

test('canonical arrays preserve meaningful order', () => {
  assert.notEqual(digestCanonical({ values: [1, 2] }), digestCanonical({ values: [2, 1] }));
});

test('strict JSON parsing rejects duplicate and canonically colliding keys', () => {
  expectCode(() => parseStrictJson('{"a":1,"a":2}'), CanonicalJsonError, 'DUPLICATE_KEY');
  expectCode(() => parseStrictJson('{"é":1,"e\\u0301":2}'), CanonicalJsonError, 'DUPLICATE_KEY');
});

test('canonical handling rejects unsupported JSON and JavaScript values', () => {
  expectCode(() => parseStrictJson('{"value":1.5}'), CanonicalJsonError, 'UNSUPPORTED_NUMBER');
  expectCode(() => parseStrictJson('{"value":-0}'), CanonicalJsonError, 'UNSUPPORTED_NUMBER');
  expectCode(() => parseStrictJson('{"value":9007199254740992}'), CanonicalJsonError, 'UNSUPPORTED_NUMBER');
  expectCode(() => canonicalize({ value: undefined }), CanonicalJsonError, 'UNSUPPORTED_VALUE');
  expectCode(() => canonicalize({ value: Number.NaN }), CanonicalJsonError, 'UNSUPPORTED_NUMBER');
  expectCode(() => canonicalize({ value: 1n }), CanonicalJsonError, 'UNSUPPORTED_VALUE');
  expectCode(() => canonicalize('\ud800'), CanonicalJsonError, 'UNSUPPORTED_UNICODE');
});

test('artifact digest excludes only the contentDigest field', () => {
  const artifact = { schemaName: 'synthetic', value: 1, contentDigest: { algorithm: 'sha256', value: '0'.repeat(64) } };
  const first = computeArtifactDigest(artifact);
  artifact.contentDigest = { algorithm: 'sha256', value: '1'.repeat(64) };
  assert.deepEqual(computeArtifactDigest(artifact), first);
  artifact.value = 2;
  assert.notDeepEqual(computeArtifactDigest(artifact), first);
});

test('content identities are stable for equal material and change only in their own domain', () => {
  const productAgain = createProductCandidateId({
    manifestRefs: [ROLE_MANIFEST_REF],
    material: { repositories: productMaterial.repositories.map((entry) => ({ ...entry })) },
  });
  assert.deepEqual(productAgain, identities.productCandidateId);

  const changedProduct = createProductCandidateId({
    manifestRefs: [ROLE_MANIFEST_REF],
    material: {
      repositories: [{ ...productMaterial.repositories[0], sourceDigest: '3'.repeat(64) }],
    },
  });
  assert.notEqual(changedProduct.digest, identities.productCandidateId.digest);
  assert.equal(identities.harnessVersion.digest, createHarnessVersion({ manifestRefs: [ROLE_MANIFEST_REF], material: harnessMaterial }).digest);

  const changedHarness = createHarnessVersion({
    manifestRefs: [ROLE_MANIFEST_REF],
    material: { ...harnessMaterial, qualificationSourceDigest: '4'.repeat(64) },
  });
  assert.notEqual(changedHarness.digest, identities.harnessVersion.digest);
  assert.equal(productAgain.digest, identities.productCandidateId.digest);
  assert.notEqual(identities.productCandidateId.digest, identities.harnessVersion.digest);
});

test('attempt, environment, and pack identities change independently', () => {
  const nextAttempt = createAttemptId('123e4567-e89b-42d3-a456-426614174001');
  assert.notEqual(nextAttempt, identities.attemptId);

  const changedEnvironment = createEnvironmentIdentity({
    manifestRefs: [ROLE_MANIFEST_REF],
    material: { proofDigest: '7'.repeat(64) },
    target: { ...environmentTarget, configurationDigest: '4'.repeat(64) },
  });
  assert.notEqual(changedEnvironment.digest, identities.environmentIdentity.digest);

  const changedPack = createTestPackVersions([{
    packId: 'synthetic-pack',
    packVersion: '1.0.1',
    manifestRefs: [PACK_MANIFEST_REF],
    material: packMaterial,
  }]);
  assert.notEqual(changedPack['synthetic-pack'].digest, identities.testPackVersions['synthetic-pack'].digest);
  assert.equal(identities.productCandidateId.digest, createProductCandidateId({ manifestRefs: [ROLE_MANIFEST_REF], material: productMaterial }).digest);
});

test('all five identities remain explicitly separated at binding time', () => {
  assert.equal(assertIdentitySeparation({
    productCandidateId: identities.productCandidateId,
    harnessVersion: identities.harnessVersion,
    attemptId: identities.attemptId,
    environmentIdentity: identities.environmentIdentity,
    testPackVersions: identities.testPackVersions,
  }), true);

  expectCode(() => assertIdentitySeparation({
    productCandidateId: identities.harnessVersion,
    harnessVersion: identities.harnessVersion,
    attemptId: identities.attemptId,
    environmentIdentity: identities.environmentIdentity,
    testPackVersions: identities.testPackVersions,
  }), IdentityError, 'IDENTITY_BINDING');
});

test('identity verification rejects stale digests and missing pack material', () => {
  assert.equal(verifyContentIdentity(identities.productCandidateId, { material: productMaterial }), true);
  const stale = clone(identities.productCandidateId);
  stale.digest = '0'.repeat(64);
  expectCode(() => verifyContentIdentity(stale, { material: productMaterial }), IdentityError, 'IDENTITY_DIGEST_MISMATCH');

  assert.equal(verifyTestPackVersions(identities.testPackVersions, { 'synthetic-pack': packMaterial }), true);
  expectCode(() => verifyTestPackVersions(identities.testPackVersions, {}), IdentityError, 'PACK_MATERIAL_MISSING');
});
