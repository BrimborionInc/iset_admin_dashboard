'use strict';

const {
  canonicalize,
  computeArtifactDigest,
  digestBytes,
  digestCanonical,
} = require('./canonical-json');
const { artifactRef, createEvidenceEmitter } = require('./evidence-emitter');
const { validateAttemptId } = require('./identities');
const { createLifecycle } = require('./lifecycle');
const { validatePlanForAdmission } = require('./plan-validator');
const { validateArtifact } = require('./schema-validator');

const KERNEL_VERSION = '0.1.0';
const PROCESS_RESULT_SCHEMA = 'path.release-qualification.process-result';
const PROCESS_RESULT_VERSION = '1.0.0';
const FAILURE_CLASSIFICATION_REF = Object.freeze({
  schemaName: 'failure-classification-policy',
  schemaVersion: '1.0.0',
  artifactId: 'phase2.synthetic.unclassified',
  contentDigest: { algorithm: 'sha256', value: '4'.repeat(64) },
});

class KernelError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'KernelError';
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function same(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function compareCanonical(left, right) {
  const a = canonicalize(left);
  const b = canonicalize(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new KernelError('INVALID_KERNEL_INPUT', `${label} must be an object`);
  }
}

function assertExactKeys(value, required, optional, label) {
  assertObject(value, label);
  const admitted = new Set([...required, ...optional]);
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const unknown = Object.keys(value).filter((key) => !admitted.has(key));
  if (missing.length || unknown.length) {
    throw new KernelError('INVALID_KERNEL_INPUT', `${label} has missing or unknown fields`, { missing, unknown });
  }
}

function finalizeArtifact(artifact) {
  artifact.contentDigest = computeArtifactDigest(artifact);
  validateArtifact(artifact);
  return deepFreeze(clone(artifact));
}

function opaqueArtifactId(prefix, material) {
  return `${prefix}:${digestCanonical(material).slice(0, 32)}`;
}

function commonAttemptEnvelope(context, schemaName, schemaVersion, artifactId, lifecycleState, parentArtifactRefs) {
  return {
    schemaName,
    schemaVersion,
    artifactId,
    createdAt: context.recordedAt,
    producer: clone(context.producer),
    lineageScope: 'attempt',
    productCandidateId: clone(context.plan.productCandidateId),
    harnessVersion: clone(context.plan.harnessVersion),
    attemptId: context.attemptId,
    testPackVersions: clone(context.plan.testPackVersions),
    parentArtifactRefs: clone(parentArtifactRefs),
    contentDigest: { algorithm: 'sha256', value: '0'.repeat(64) },
    lifecycleState,
    completeness: { state: 'complete', missingEvidence: [] },
    sensitivity: context.plan.sensitivity,
    redaction: clone(context.plan.redaction),
    retentionPolicyRef: clone(context.plan.retentionPolicyRef),
    planRef: artifactRef(context.plan),
  };
}

function processAttachment(result, context, checkInstanceId, purpose) {
  const bytes = Buffer.from(canonicalize(result), 'utf8');
  const attachmentRef = {
    schemaName: PROCESS_RESULT_SCHEMA,
    schemaVersion: PROCESS_RESULT_VERSION,
    artifactId: opaqueArtifactId(`process.${purpose}`, {
      attemptId: context.attemptId,
      checkInstanceId,
      commandInstanceId: result.commandInstanceId,
    }),
    contentDigest: { algorithm: 'sha256', value: digestBytes(bytes) },
  };
  return deepFreeze({
    attachmentRef,
    mediaType: 'application/vnd.path.release-qualification.process-result+json',
    sizeBytes: bytes.length,
    sensitivity: 'internal',
    retentionClass: 'attempt-diagnostic',
    availability: 'available',
    bytesBase64: bytes.toString('base64'),
  });
}

function definitionByCheck(plan, checkExecutions, attemptId) {
  assertObject(checkExecutions, 'checkExecutions');
  const selectedIds = plan.selectedChecks.map((check) => check.checkInstanceId);
  const suppliedIds = Object.keys(checkExecutions);
  const missing = selectedIds.filter((id) => !Object.prototype.hasOwnProperty.call(checkExecutions, id));
  const unknown = suppliedIds.filter((id) => !selectedIds.includes(id));
  if (missing.length || unknown.length) {
    throw new KernelError('CHECK_EXECUTION_SET_CONFLICT', 'Check execution definitions must exactly match selected scope', {
      missing,
      unknown,
    });
  }

  const definitions = {};
  for (const check of plan.selectedChecks) {
    const definition = checkExecutions[check.checkInstanceId];
    assertExactKeys(definition, [
      'commandDeclarationRef',
      'processDeclaration',
      'testLevel',
      'nativeRunnerRef',
      'nativeContractRefs',
      'assertions',
      'prerequisiteResults',
      'effectsObserved',
    ], ['cleanup'], `checkExecutions.${check.checkInstanceId}`);
    if (definition.processDeclaration.attemptId !== attemptId) {
      throw new KernelError('ATTEMPT_BINDING_CONFLICT', `${check.checkInstanceId} process declaration is bound to another attempt`);
    }
    if (!plan.commandDeclarationRefs.some((reference) => same(reference, definition.commandDeclarationRef))) {
      throw new KernelError('COMMAND_NOT_DECLARED', `${check.checkInstanceId} command reference is absent from the admitted plan`);
    }
    const selectedEffect = plan.declaredEffects.find((effect) => effect.checkInstanceId === check.checkInstanceId);
    const cleanupObligation = plan.cleanupObligations.find((item) => item.checkInstanceId === check.checkInstanceId);
    if (!selectedEffect) throw new KernelError('EFFECT_DECLARATION_MISSING', `${check.checkInstanceId} has no declared effect`);
    assertObject(definition.effectsObserved, `checkExecutions.${check.checkInstanceId}.effectsObserved`);
    assertExactKeys(definition.effectsObserved, [
      'declaredEffectTokens',
      'observedEffectTokens',
      'undeclaredEffectTokens',
    ], [], `checkExecutions.${check.checkInstanceId}.effectsObserved`);
    if (!same(definition.effectsObserved.declaredEffectTokens, selectedEffect.effectTokens)) {
      throw new KernelError('EFFECT_DECLARATION_CONFLICT', `${check.checkInstanceId} runtime effect declaration conflicts with the plan`);
    }
    const undeclaredObserved = definition.effectsObserved.observedEffectTokens
      .filter((token) => !selectedEffect.effectTokens.includes(token));
    if (undeclaredObserved.length > 0 || definition.effectsObserved.undeclaredEffectTokens.length > 0) {
      throw new KernelError('UNDECLARED_EFFECT', `${check.checkInstanceId} cannot broaden its admitted effects`, {
        undeclaredObserved,
        reportedUndeclared: definition.effectsObserved.undeclaredEffectTokens,
      });
    }
    if (!Array.isArray(definition.prerequisiteResults)) {
      throw new KernelError('PREREQUISITE_SET_CONFLICT', `${check.checkInstanceId} prerequisiteResults must be an array`);
    }
    for (const [index, result] of definition.prerequisiteResults.entries()) {
      assertExactKeys(result, ['gateId', 'status', 'proofRefs'], [], `checkExecutions.${check.checkInstanceId}.prerequisiteResults[${index}]`);
      if (!['passed', 'failed', 'blocked'].includes(result.status) || !Array.isArray(result.proofRefs) || result.proofRefs.length === 0) {
        throw new KernelError('PREREQUISITE_RESULT_INVALID', `${check.checkInstanceId} has a malformed prerequisite result`);
      }
    }
    if (selectedEffect.effectClass === 'stateful' && (!cleanupObligation || !definition.cleanup)) {
      throw new KernelError('CLEANUP_CONTRACT_MISSING', `${check.checkInstanceId} cannot mutate before cleanup is bound`);
    }
    if (selectedEffect.effectClass === 'read-only' && definition.cleanup !== undefined) {
      throw new KernelError('CLEANUP_CONTRACT_CONFLICT', `${check.checkInstanceId} is read-only but supplies cleanup`);
    }
    if (definition.cleanup) {
      assertExactKeys(definition.cleanup, [
        'processDeclaration',
        'cleanupOwner',
        'affectedResources',
        'declaredResidueScope',
        'residueVerifier',
        'verifyResidue',
      ], [], `checkExecutions.${check.checkInstanceId}.cleanup`);
      if (definition.cleanup.processDeclaration.attemptId !== attemptId) {
        throw new KernelError('ATTEMPT_BINDING_CONFLICT', `${check.checkInstanceId} cleanup declaration is bound to another attempt`);
      }
      if (typeof definition.cleanup.verifyResidue !== 'function') {
        throw new KernelError('RESIDUE_VERIFIER_REQUIRED', `${check.checkInstanceId} requires an independent residue verifier`);
      }
      if (definition.cleanup.residueVerifier.independentFromCleanupOwner !== true) {
        throw new KernelError('RESIDUE_VERIFIER_NOT_INDEPENDENT', `${check.checkInstanceId} residue verifier must be independent`);
      }
    }
    const canonicalDefinition = { ...definition };
    if (definition.cleanup) canonicalDefinition.cleanup = { ...definition.cleanup, verifyResidue: null };
    canonicalize(canonicalDefinition);
    definitions[check.checkInstanceId] = definition;
  }
  return definitions;
}

function emitRecord(emitter, record, context, check, options = {}) {
  const emission = {
    occurredAt: context.recordedAt,
    recordedAt: context.recordedAt,
  };
  if (check) {
    emission.packId = check.packId;
    emission.packVersion = check.packVersion;
  }
  if (options.mutationState !== undefined) emission.mutationState = options.mutationState;
  if (options.effectTokens !== undefined) emission.effectTokens = clone(options.effectTokens);
  if (options.completeness !== undefined) emission.completeness = clone(options.completeness);
  return emitter.emitLifecycle(record, emission);
}

function processResultStatus(result) {
  if (result.status === 'completed') return 'passed';
  if (result.status === 'timed-out') return 'timed-out';
  if (result.status === 'cancelled') return 'cancelled';
  if (result.result.status !== 'valid' || result.status === 'termination-failed') return 'incomplete';
  return 'failed';
}

function checkLifecycleState(result, status) {
  if (status === 'passed') return 'CHECK_COMPLETED';
  if (status === 'timed-out') return 'CHECK_TIMED_OUT';
  if (status === 'cancelled' || result.status === 'termination-failed') return 'CHECK_CANCELLED';
  return 'CHECK_FAILED';
}

function terminalKind(result) {
  if (result.exit.signal) return 'signal';
  if (Number.isInteger(result.exit.code)) return 'exit';
  return 'unknown';
}

function buildFailure(context, check, definition, resultRef, lifecycleState, failedPhase, terminalEventRef, mutationState) {
  const failure = {
    ...commonAttemptEnvelope(
      context,
      'path.release-qualification.failure',
      '1.0.0-draft.1',
      opaqueArtifactId('failure', { attemptId: context.attemptId, check: check.checkInstanceId, failedPhase }),
      lifecycleState,
      [terminalEventRef, resultRef],
    ),
    failedPhase,
    checkInstanceId: check.checkInstanceId,
    commandDeclarationRef: clone(definition.commandDeclarationRef),
    resultRef: clone(resultRef),
    primaryClassification: 'unclassified',
    classificationRuleRef: clone(FAILURE_CLASSIFICATION_REF),
    contractRefs: clone(definition.nativeContractRefs),
    supportingEvidenceRefs: [clone(resultRef)],
    evidenceSufficiency: 'insufficient',
    deterministicBasis: {
      matchedRuleId: 'insufficient-native-contract-evidence',
      factRefs: [clone(resultRef)],
      comparisons: [],
    },
    contributingConditions: [],
    knownEffects: {
      completed: [],
      mayHaveStarted: mutationState === 'not-started' ? [] : clone(definition.effectsObserved.observedEffectTokens),
      prevented: mutationState === 'not-started' ? clone(definition.effectsObserved.declaredEffectTokens) : [],
      unknown: mutationState === 'unknown' ? clone(definition.effectsObserved.declaredEffectTokens) : [],
    },
    mutationState,
    nextSafeAction: {
      code: 'preserve-and-stop',
      prerequisiteEvidenceRefs: [clone(resultRef)],
      prohibitedContinuation: 'No retry or product attribution is permitted until deterministic evidence is available.',
      requiredIdentityChange: 'attemptId',
    },
    mandatoryStop: true,
    mandatoryStopReasons: ['unclassified-failure'],
  };
  return finalizeArtifact(failure);
}

function buildCleanupResult({ context, check, cleanupObligation, cleanup, mainProcessRef, cleanupProcessRef, terminalEventRef, processResult, residue }) {
  const zeroResidue = residue.residueDecision === 'zero-residue';
  const status = processResult.status === 'completed' && zeroResidue ? 'completed' : 'failed';
  const lifecycleState = zeroResidue ? 'RESIDUE_PROOF_COMPLETED' : 'RESIDUE_PROOF_FAILED';
  const artifact = {
    ...commonAttemptEnvelope(
      context,
      'path.release-qualification.cleanup-result',
      '1.0.0-draft.1',
      opaqueArtifactId('cleanup', { attemptId: context.attemptId, check: check.checkInstanceId }),
      lifecycleState,
      [terminalEventRef, mainProcessRef, cleanupProcessRef],
    ),
    cleanupObligationId: cleanupObligation.obligationId,
    checkInstanceId: check.checkInstanceId,
    packId: check.packId,
    packVersion: check.packVersion,
    cleanupOwner: clone(cleanup.cleanupOwner),
    status,
    cleanupReason: { code: 'declared-fixture', effectEvidenceRefs: [clone(mainProcessRef)] },
    executionTerminationProofRef: clone(mainProcessRef),
    affectedResources: clone(cleanup.affectedResources),
    declaredResidueScope: clone(cleanup.declaredResidueScope),
    cleanupActionRefs: [clone(cleanupProcessRef)],
    cleanupOutcome: {
      terminalStatus: processResult.status === 'completed' ? 'completed' : 'failed',
      completedActions: processResult.status === 'completed' ? [processResult.commandInstanceId] : [],
      failedActions: processResult.status === 'completed' ? [] : [processResult.commandInstanceId],
      unknownActions: [],
      terminalEventRef: clone(terminalEventRef),
    },
    residueVerifier: clone(cleanup.residueVerifier),
    residueAssertions: clone(residue.residueAssertions),
    residueDecision: residue.residueDecision,
  };
  if (!zeroResidue) {
    artifact.remainingResidue = clone(residue.remainingResidue);
    artifact.escalation = clone(residue.escalation);
  }
  return finalizeArtifact(artifact);
}

function buildUnnecessaryCleanupResult(context, check, cleanupObligation, terminalEventRef) {
  return finalizeArtifact({
    ...commonAttemptEnvelope(
      context,
      'path.release-qualification.cleanup-result',
      '1.0.0-draft.1',
      opaqueArtifactId('cleanup', { attemptId: context.attemptId, check: check.checkInstanceId }),
      'CLEANUP_UNNECESSARY',
      [terminalEventRef],
    ),
    cleanupObligationId: cleanupObligation.obligationId,
    checkInstanceId: check.checkInstanceId,
    packId: check.packId,
    packVersion: check.packVersion,
    cleanupOwner: {
      authorityId: 'qualification-kernel',
      contractRef: clone(cleanupObligation.ownerRef),
      version: KERNEL_VERSION,
      capabilityTokens: [],
      effectTokens: [],
    },
    status: 'unnecessary',
    cleanupReason: { code: 'proved-no-effect', effectEvidenceRefs: [terminalEventRef] },
    affectedResources: [],
    declaredResidueScope: [],
    residueAssertions: [],
    residueDecision: 'not-applicable',
  });
}

function buildCheckResult({ context, check, definition, processResult, processRef, terminalEventRef, eventRange, failure, cleanupResult, cleanupObligation }) {
  const status = processResultStatus(processResult);
  const lifecycleState = checkLifecycleState(processResult, status);
  const nativeFrame = processResult.result.status === 'valid' ? processResult.result.frame : null;
  const mutationState = cleanupObligation && processResult.readiness.proved ? 'terminal' : 'not-started';
  const artifact = {
    ...commonAttemptEnvelope(
      context,
      'path.release-qualification.check-result',
      '1.0.0-draft.1',
      opaqueArtifactId('result', { attemptId: context.attemptId, check: check.checkInstanceId }),
      lifecycleState,
      [terminalEventRef, processRef],
    ),
    checkInstanceId: check.checkInstanceId,
    checkDefinitionRef: clone(check.checkDefinitionRef),
    packId: check.packId,
    packVersion: check.packVersion,
    testLevel: definition.testLevel,
    nativeRunnerRef: clone(definition.nativeRunnerRef),
    nativeContractRefs: clone(definition.nativeContractRefs),
    commandDeclarationRef: clone(definition.commandDeclarationRef),
    eventRange,
    terminalEventRef: clone(terminalEventRef),
    status,
    prerequisiteResultRefs: definition.prerequisiteResults.flatMap((result) => clone(result.proofRefs)),
    outputRefs: [clone(processRef)],
    attachmentRefs: [clone(processRef)],
    executionFacts: {
      startSequence: eventRange.firstSequence,
      endSequence: eventRange.lastSequence,
      terminalKind: terminalKind(processResult),
      ...(Number.isInteger(processResult.exit.code) ? { exitCode: processResult.exit.code } : {}),
      ...(processResult.exit.signal ? { signal: processResult.exit.signal } : {}),
      timeout: processResult.status === 'timed-out',
      cancellation: processResult.cancellation !== null,
      terminationProved: processResult.termination.proved,
      lastAcceptedOutputSequence: processResult.protocolFrames.length,
      outputTruncated: processResult.stdout.truncated || processResult.stderr.truncated || processResult.result.status === 'truncated',
    },
    effectsObserved: clone(definition.effectsObserved),
    mutationState,
    resultSummary: {
      passed: status === 'passed' ? definition.assertions.length : 0,
      failed: status === 'failed' ? Math.max(1, definition.assertions.filter((item) => item.status === 'failed').length) : 0,
      notRun: ['timed-out', 'cancelled', 'incomplete', 'unavailable'].includes(status) ? definition.assertions.length : 0,
      blocked: false,
    },
  };
  if (nativeFrame) {
    artifact.nativeStatus = { value: nativeFrame.status, mappingRuleRef: clone(definition.nativeRunnerRef) };
  }
  if (status === 'passed') artifact.assertions = clone(definition.assertions);
  if (failure) artifact.failureRef = artifactRef(failure);
  if (cleanupObligation) artifact.cleanupObligationId = cleanupObligation.obligationId;
  if (cleanupResult) artifact.cleanupResultRef = artifactRef(cleanupResult);
  if (status !== 'passed') artifact.completeness = {
    state: status === 'incomplete' ? 'partial' : 'complete',
    missingEvidence: status === 'incomplete' ? [{ code: 'native-result-incomplete', requiredBy: 'check-result', impact: 'blocking' }] : [],
  };
  return finalizeArtifact(artifact);
}

function buildBlockedCheckResult({ context, check, definition, terminalEventRef, eventRange, failure, cleanupResult, cleanupObligation }) {
  const artifact = {
    ...commonAttemptEnvelope(
      context,
      'path.release-qualification.check-result',
      '1.0.0-draft.1',
      opaqueArtifactId('result', { attemptId: context.attemptId, check: check.checkInstanceId }),
      'CHECK_BLOCKED',
      [terminalEventRef, artifactRef(failure)],
    ),
    checkInstanceId: check.checkInstanceId,
    checkDefinitionRef: clone(check.checkDefinitionRef),
    packId: check.packId,
    packVersion: check.packVersion,
    testLevel: definition.testLevel,
    nativeRunnerRef: clone(definition.nativeRunnerRef),
    nativeContractRefs: clone(definition.nativeContractRefs),
    commandDeclarationRef: clone(definition.commandDeclarationRef),
    eventRange,
    terminalEventRef: clone(terminalEventRef),
    status: 'blocked',
    prerequisiteResultRefs: definition.prerequisiteResults.flatMap((result) => clone(result.proofRefs)),
    outputRefs: [],
    attachmentRefs: [],
    executionFacts: {
      startSequence: eventRange.firstSequence,
      endSequence: eventRange.lastSequence,
      terminalKind: 'not-started',
      timeout: false,
      cancellation: false,
      terminationProved: true,
      lastAcceptedOutputSequence: 0,
      outputTruncated: false,
    },
    effectsObserved: {
      declaredEffectTokens: clone(definition.effectsObserved.declaredEffectTokens),
      observedEffectTokens: [],
      undeclaredEffectTokens: [],
    },
    mutationState: 'not-started',
    blockingFailureRef: artifactRef(failure),
    resultSummary: { passed: 0, failed: 0, notRun: definition.assertions.length, blocked: true },
  };
  if (cleanupObligation) artifact.cleanupObligationId = cleanupObligation.obligationId;
  if (cleanupResult) artifact.cleanupResultRef = artifactRef(cleanupResult);
  return finalizeArtifact(artifact);
}

function selectedScope(plan, admission) {
  const definitionById = new Map(plan.selectedChecks.map((check) => [check.checkInstanceId, check]));
  const dependenciesByDependant = new Map();
  for (const dependency of plan.dependencies) {
    const list = dependenciesByDependant.get(dependency.dependant) || [];
    list.push(clone(definitionById.get(dependency.predecessor).checkDefinitionRef));
    dependenciesByDependant.set(dependency.dependant, list);
  }
  return {
    checks: plan.selectedChecks.map((check) => ({
      checkInstanceId: check.checkInstanceId,
      packId: check.packId,
      packVersion: check.packVersion,
      inclusionOrigins: clone(check.inclusionOrigins),
      dependencyRefs: (dependenciesByDependant.get(check.checkInstanceId) || []).sort(compareCanonical),
    })),
    dependencyDigest: { algorithm: 'sha256', value: digestCanonical(plan.dependencies) },
    selectionInputDigest: clone(admission.selection.selectionInputDigest),
    selectionOutputDigest: clone(admission.selection.selectionOutputDigest),
  };
}

function reconstructAdvisoryStatus(checkResults, failures, cleanupResults, missingItems) {
  if (
    missingItems.length > 0
    || checkResults.some((result) => ['incomplete', 'unavailable'].includes(result.status) || !result.executionFacts.terminationProved)
    || cleanupResults.some((result) => ['interrupted', 'required', 'started'].includes(result.status) || result.residueDecision === 'unknown')
  ) return 'INCOMPLETE';
  if (
    failures.length > 0
    || checkResults.some((result) => result.status !== 'passed')
    || cleanupResults.some((result) => result.residueDecision === 'residue-found' || result.status === 'failed')
  ) return 'NO-GO';
  return 'GO';
}

function assembleFinalEvidence(input) {
  assertExactKeys(input, [
    'context',
    'admission',
    'eventGraph',
    'checkResults',
    'failures',
    'cleanupResults',
    'attachments',
    'prerequisiteResults',
    'missingItems',
    'finalEventRef',
    'decisionRuleRef',
    'validatorVersion',
  ], [], 'final evidence input');
  const {
    context,
    admission,
    eventGraph,
    checkResults,
    failures,
    cleanupResults,
    attachments,
    prerequisiteResults,
    missingItems,
    finalEventRef,
  } = input;
  const status = reconstructAdvisoryStatus(checkResults, failures, cleanupResults, missingItems);
  const cleanupObligationIds = context.plan.cleanupObligations.map((item) => item.obligationId).sort();
  const residueDecisions = cleanupResults.map((item) => item.residueDecision);
  const residueDecision = cleanupObligationIds.length === 0
    ? 'not-applicable'
    : residueDecisions.every((decision) => decision === 'zero-residue' || decision === 'not-applicable')
      ? 'zero-residue'
      : residueDecisions.includes('residue-found') ? 'residue-found' : 'unknown';
  const actionRefs = attachments
    .filter((item) => {
      const result = JSON.parse(Buffer.from(item.bytesBase64, 'base64').toString('utf8'));
      return result.cancellation !== null;
    })
    .map((item) => clone(item.attachmentRef));
  const blockers = [
    ...failures.map((failure) => ({ code: 'recorded-failure', evidenceRefs: [artifactRef(failure)] })),
    ...cleanupResults.filter((result) => !['zero-residue', 'not-applicable'].includes(result.residueDecision))
      .map((result) => ({ code: 'cleanup-residue-not-zero', evidenceRefs: [artifactRef(result)] })),
  ];
  if (status === 'INCOMPLETE' && blockers.length === 0) {
    blockers.push({ code: 'incomplete-evidence', evidenceRefs: [clone(finalEventRef)] });
  }
  const reconstructionInputRefs = [
    artifactRef(context.plan),
    ...checkResults.map(artifactRef),
    ...failures.map(artifactRef),
    ...cleanupResults.map(artifactRef),
    ...eventGraph.eventRefs,
    ...attachments.map((item) => clone(item.attachmentRef)),
  ].sort(compareCanonical);
  const parents = [
    clone(finalEventRef),
    ...checkResults.map(artifactRef),
    ...failures.map(artifactRef),
    ...cleanupResults.map(artifactRef),
  ].sort(compareCanonical);
  const final = {
    ...commonAttemptEnvelope(
      context,
      'path.release-qualification.final-evidence',
      '1.0.0-draft.2',
      opaqueArtifactId('final', { attemptId: context.attemptId, eventGraph: eventGraph.graphDigest }),
      'FINAL_EVIDENCE_EMITTED',
      parents,
    ),
    planDigest: clone(context.plan.contentDigest),
    identitySummary: {
      productCandidateId: clone(context.plan.productCandidateId),
      harnessVersion: clone(context.plan.harnessVersion),
      attemptId: context.attemptId,
      environmentProofRefs: [],
      testPackVersions: clone(context.plan.testPackVersions),
    },
    requestedScope: {
      planScopeRef: artifactRef(context.plan),
      scopeDigest: { algorithm: 'sha256', value: digestCanonical(context.plan.requestedScope) },
    },
    selectedScope: selectedScope(context.plan, admission),
    prerequisiteResults: clone(prerequisiteResults).sort(compareCanonical),
    eventGraph: clone(eventGraph),
    checkResults: checkResults.map(artifactRef).sort(compareCanonical),
    failures: failures.map(artifactRef).sort(compareCanonical),
    cancellationAndTermination: {
      actionRefs: actionRefs.sort(compareCanonical),
      terminationRequired: actionRefs.length > 0,
      terminationProved: checkResults.every((result) => result.executionFacts.terminationProved),
    },
    cleanupAndResidue: {
      obligationIds: cleanupObligationIds,
      cleanupResultRefs: cleanupResults.map(artifactRef).sort(compareCanonical),
      residueDecision,
      unresolvedEffects: residueDecision === 'unknown' ? context.plan.declaredEffects.flatMap((effect) => effect.effectTokens).sort() : [],
      escalationRefs: cleanupResults.filter((result) => result.escalation).map(artifactRef).sort(compareCanonical),
    },
    attachmentIndex: attachments.map(({ bytesBase64, ...entry }) => clone(entry)).sort(compareCanonical),
    missingOrPartialEvidence: {
      items: clone(missingItems).sort(compareCanonical),
      lastTrustworthyState: 'FINAL_EVIDENCE_EMITTED',
      unknownEffects: residueDecision === 'unknown' ? context.plan.declaredEffects.flatMap((effect) => effect.effectTokens).sort() : [],
      residueUncertainty: residueDecision === 'unknown',
    },
    blockers: blockers.sort(compareCanonical),
    decisionRuleRef: clone(input.decisionRuleRef),
    producerAdvisoryStatus: status,
    validationHandoff: {
      reconstructionInputRefs,
      validatorVersion: input.validatorVersion,
      selfApproved: false,
    },
  };
  if (status === 'INCOMPLETE') {
    final.completeness = {
      state: 'partial',
      missingEvidence: missingItems.length > 0
        ? missingItems.map((item) => ({ code: item.code, requiredBy: 'final-evidence', impact: 'blocking' }))
        : [{ code: 'incomplete-evidence', requiredBy: 'final-evidence', impact: 'blocking' }],
    };
  }
  return finalizeArtifact(final);
}

async function executeProcess(processController, declaration) {
  const dispatch = processController.start(declaration);
  await dispatch.started;
  const readiness = await dispatch.ready;
  const result = await dispatch.result;
  return { readiness, result };
}

async function runQualificationAttempt(rawInput) {
  assertExactKeys(rawInput, [
    'plan',
    'selectionInput',
    'attemptId',
    'recordedAt',
    'producer',
    'processController',
    'checkExecutions',
    'decisionRuleRef',
    'validatorVersion',
  ], [], 'kernel invocation');
  validateAttemptId(rawInput.attemptId);
  if (!rawInput.processController || typeof rawInput.processController.start !== 'function') {
    throw new KernelError('PROCESS_CONTROLLER_REQUIRED', 'Kernel invocation requires an admitted process controller');
  }
  const admission = validatePlanForAdmission(rawInput.plan, rawInput.selectionInput);
  const plan = deepFreeze(clone(rawInput.plan));
  const definitions = definitionByCheck(plan, rawInput.checkExecutions, rawInput.attemptId);
  const context = {
    plan,
    attemptId: rawInput.attemptId,
    recordedAt: rawInput.recordedAt,
    producer: clone(rawInput.producer),
  };
  const checkBindings = Object.fromEntries(plan.selectedChecks.map((check) => [check.checkInstanceId, {
    packId: check.packId,
    packVersion: check.packVersion,
  }]));
  const lifecycle = createLifecycle({ attemptId: rawInput.attemptId, checkInstanceIds: plan.executionOrder });
  const emitter = createEvidenceEmitter({
    planRef: artifactRef(plan),
    productCandidateId: plan.productCandidateId,
    harnessVersion: plan.harnessVersion,
    attemptId: rawInput.attemptId,
    testPackVersions: plan.testPackVersions,
    checkBindings,
    producer: rawInput.producer,
    sensitivity: plan.sensitivity,
    redaction: plan.redaction,
    retentionPolicyRef: plan.retentionPolicyRef,
  });
  const emitted = (record, check, options) => emitRecord(emitter, record, context, check, options);
  emitted(lifecycle.openAttempt([artifactRef(plan)]), null);

  const checkResults = [];
  const failures = [];
  const cleanupResults = [];
  const attachments = [];
  const prerequisiteResults = [];
  const missingItems = [];
  const resultByCheck = new Map();
  const checkById = new Map(plan.selectedChecks.map((check) => [check.checkInstanceId, check]));

  for (const checkInstanceId of plan.executionOrder) {
    const check = checkById.get(checkInstanceId);
    const definition = definitions[checkInstanceId];
    const effect = plan.declaredEffects.find((item) => item.checkInstanceId === checkInstanceId);
    const cleanupObligation = plan.cleanupObligations.find((item) => item.checkInstanceId === checkInstanceId);
    const firstSequence = emitter.events().length + 1;

    emitted(lifecycle.beginPrerequisites(checkInstanceId, [artifactRef(plan)]), check);
    const gates = plan.prerequisiteGates.filter((gate) => gate.checkInstanceId === checkInstanceId);
    const gateById = new Map(definition.prerequisiteResults.map((result) => [result.gateId, result]));
    const gateMismatch = gates.filter((gate) => !gateById.has(gate.gateId))
      .concat(definition.prerequisiteResults.filter((result) => !gates.some((gate) => gate.gateId === result.gateId)));
    if (gateMismatch.length > 0) {
      throw new KernelError('PREREQUISITE_SET_CONFLICT', `${checkInstanceId} prerequisite results do not match the admitted plan`);
    }
    const affectedCheckInstanceIds = [checkInstanceId];
    for (const result of definition.prerequisiteResults) {
      prerequisiteResults.push({
        gateId: result.gateId,
        status: result.status,
        proofRefs: clone(result.proofRefs),
        affectedCheckInstanceIds,
      });
    }
    const failedDependencies = plan.dependencies
      .filter((dependency) => dependency.dependant === checkInstanceId)
      .map((dependency) => resultByCheck.get(dependency.predecessor))
      .filter((result) => !result || result.status !== 'passed');
    const prerequisitesPassed = definition.prerequisiteResults.every((result) => result.status === 'passed')
      && failedDependencies.length === 0;
    const prerequisiteEvidence = [
      ...definition.prerequisiteResults.flatMap((result) => clone(result.proofRefs)),
      ...failedDependencies.filter(Boolean).map(artifactRef),
    ];
    emitted(lifecycle.transitionPrerequisites(
      checkInstanceId,
      prerequisitesPassed ? 'PREREQUISITES_PASSED' : 'PREREQUISITE_FAILED',
      prerequisiteEvidence,
    ), check);
    emitted(lifecycle.beginCheck(checkInstanceId, prerequisiteEvidence), check);
    if (!prerequisitesPassed) {
      const terminalEvent = emitted(lifecycle.transitionCheck(checkInstanceId, 'CHECK_BLOCKED', prerequisiteEvidence), check, {
        mutationState: 'not-started', effectTokens: [],
      });
      const cleanupEvent = emitted(lifecycle.beginCleanup(checkInstanceId, 'unnecessary', [artifactRef(terminalEvent)]), check, {
        mutationState: 'not-started', effectTokens: [],
      });
      emitted(lifecycle.beginResidueProof(checkInstanceId, [artifactRef(terminalEvent)]), check, {
        mutationState: 'not-started', effectTokens: [],
      });
      const evidenceRef = artifactRef(terminalEvent);
      const failure = buildFailure(
        context,
        check,
        definition,
        evidenceRef,
        'PREREQUISITE_FAILED',
        'prerequisite',
        artifactRef(terminalEvent),
        'not-started',
      );
      failures.push(failure);
      let cleanupResult;
      if (cleanupObligation) {
        cleanupResult = buildUnnecessaryCleanupResult(
          context,
          check,
          cleanupObligation,
          artifactRef(cleanupEvent),
        );
        cleanupResults.push(cleanupResult);
      }
      const checkResult = buildBlockedCheckResult({
        context,
        check,
        definition,
        terminalEventRef: artifactRef(terminalEvent),
        eventRange: { firstSequence, lastSequence: emitter.events().length },
        failure,
        cleanupResult,
        cleanupObligation,
      });
      checkResults.push(checkResult);
      resultByCheck.set(checkInstanceId, checkResult);
      continue;
    }

    emitted(lifecycle.transitionCheck(checkInstanceId, 'CHECK_READY', prerequisiteEvidence), check);
    emitted(lifecycle.transitionCheck(checkInstanceId, 'CHECK_DISPATCHED', [definition.commandDeclarationRef]), check);
    const execution = await executeProcess(rawInput.processController, definition.processDeclaration);
    if (execution.readiness.proved) emitted(lifecycle.transitionCheck(checkInstanceId, 'CHECK_RUNNING', []), check);
    const processRecord = processAttachment(execution.result, context, checkInstanceId, 'check');
    attachments.push(processRecord);
    const processRef = processRecord.attachmentRef;
    const mutationState = cleanupObligation && execution.readiness.proved ? 'terminal' : 'not-started';
    let terminalEvent;
    if (execution.result.status === 'completed') {
      terminalEvent = emitted(lifecycle.transitionCheck(checkInstanceId, 'CHECK_COMPLETED', [processRef]), check, {
        mutationState, effectTokens: definition.effectsObserved.observedEffectTokens,
      });
    } else if (execution.result.status === 'timed-out') {
      terminalEvent = emitted(lifecycle.transitionCheck(checkInstanceId, 'CHECK_TIMED_OUT', [processRef]), check, {
        mutationState, effectTokens: definition.effectsObserved.observedEffectTokens,
      });
      emitted(lifecycle.transitionCheck(checkInstanceId, 'CHECK_CANCELLING', [processRef]), check, {
        mutationState, effectTokens: definition.effectsObserved.observedEffectTokens,
      });
      emitted(lifecycle.transitionCheck(checkInstanceId, execution.result.termination.proved ? 'CHECK_CANCELLED' : 'TERMINATION_FAILED', [processRef]), check, {
        mutationState, effectTokens: definition.effectsObserved.observedEffectTokens,
      });
    } else if (execution.result.status === 'cancelled' || execution.result.status === 'termination-failed') {
      emitted(lifecycle.transitionCheck(checkInstanceId, 'CHECK_CANCELLING', [processRef]), check, {
        mutationState, effectTokens: definition.effectsObserved.observedEffectTokens,
      });
      terminalEvent = emitted(lifecycle.transitionCheck(checkInstanceId, execution.result.termination.proved ? 'CHECK_CANCELLED' : 'TERMINATION_FAILED', [processRef]), check, {
        mutationState, effectTokens: definition.effectsObserved.observedEffectTokens,
      });
    } else {
      terminalEvent = emitted(lifecycle.transitionCheck(checkInstanceId, 'CHECK_FAILED', [processRef]), check, {
        mutationState, effectTokens: definition.effectsObserved.observedEffectTokens,
      });
    }

    let cleanupResult;
    if (cleanupObligation && execution.result.termination.proved) {
      const cleanup = definition.cleanup;
      emitted(lifecycle.beginCleanup(checkInstanceId, 'required', [processRef]), check, {
        mutationState, effectTokens: effect.effectTokens,
      });
      emitted(lifecycle.transitionCleanup(checkInstanceId, 'CLEANUP_RUNNING', [processRef]), check, {
        mutationState: 'started', effectTokens: effect.effectTokens,
      });
      const cleanupExecution = await executeProcess(rawInput.processController, cleanup.processDeclaration);
      const cleanupAttachment = processAttachment(cleanupExecution.result, context, checkInstanceId, 'cleanup');
      attachments.push(cleanupAttachment);
      const cleanupTerminal = cleanupExecution.result.status === 'completed' ? 'CLEANUP_SUCCEEDED' : 'CLEANUP_FAILED';
      emitted(lifecycle.transitionCleanup(checkInstanceId, cleanupTerminal, [cleanupAttachment.attachmentRef]), check, {
        mutationState: 'terminal', effectTokens: effect.effectTokens,
      });
      emitted(lifecycle.beginResidueProof(checkInstanceId, [cleanupAttachment.attachmentRef]), check, {
        mutationState: 'terminal', effectTokens: effect.effectTokens,
      });
      const residue = await cleanup.verifyResidue({
        attemptId: context.attemptId,
        checkInstanceId,
        executionResult: clone(execution.result),
        cleanupResult: clone(cleanupExecution.result),
      });
      const residueEvent = emitted(lifecycle.transitionResidueProof(
        checkInstanceId,
        residue.residueDecision === 'zero-residue' ? 'RESIDUE_PROOF_COMPLETED' : 'RESIDUE_PROOF_FAILED',
        residue.residueAssertions.flatMap((assertion) => clone(assertion.evidenceRefs)),
      ), check, { mutationState: 'terminal', effectTokens: effect.effectTokens });
      cleanupResult = buildCleanupResult({
        context,
        check,
        cleanupObligation,
        cleanup,
        mainProcessRef: processRef,
        cleanupProcessRef: cleanupAttachment.attachmentRef,
        terminalEventRef: artifactRef(residueEvent),
        processResult: cleanupExecution.result,
        residue,
      });
      cleanupResults.push(cleanupResult);
    } else if (cleanupObligation && !execution.result.termination.proved) {
      missingItems.push({ code: 'termination-unproved', status: 'missing', artifactRef: clone(processRef), blocker: true });
    } else {
      const cleanupEvent = emitted(lifecycle.beginCleanup(checkInstanceId, 'unnecessary', [processRef]), check, {
        mutationState: 'not-started', effectTokens: [],
      });
      emitted(lifecycle.beginResidueProof(checkInstanceId, [artifactRef(cleanupEvent)]), check, {
        mutationState: 'not-started', effectTokens: [],
      });
    }

    let failure;
    const status = processResultStatus(execution.result);
    if (status !== 'passed') {
      const failedPhase = status === 'timed-out' ? 'timeout'
        : execution.result.status === 'termination-failed' ? 'termination'
          : execution.result.result.status === 'valid' ? 'execution' : 'result';
      failure = buildFailure(
        context,
        check,
        definition,
        processRef,
        failedPhase === 'termination' ? 'TERMINATION_FAILED' : checkLifecycleState(execution.result, status),
        failedPhase,
        artifactRef(terminalEvent),
        mutationState,
      );
      failures.push(failure);
      if (status === 'incomplete') missingItems.push({
        code: `process-result-${execution.result.result.status}`,
        status: ['truncated', 'stale'].includes(execution.result.result.status) ? execution.result.result.status : 'corrupt',
        artifactRef: clone(processRef),
        blocker: true,
      });
    }
    const eventsNow = emitter.events();
    const checkResult = buildCheckResult({
      context,
      check,
      definition,
      processResult: execution.result,
      processRef,
      terminalEventRef: artifactRef(terminalEvent),
      eventRange: { firstSequence, lastSequence: eventsNow.length },
      failure,
      cleanupResult,
      cleanupObligation,
    });
    checkResults.push(checkResult);
    resultByCheck.set(checkInstanceId, checkResult);
  }

  const finalization = emitted(lifecycle.beginFinalization([
    ...checkResults.map(artifactRef),
    ...cleanupResults.map(artifactRef),
  ]), null);
  const finalEvent = emitted(lifecycle.completeFinalization({ triggeringEvidenceRefs: [artifactRef(finalization)] }), null);
  const eventGraph = emitter.eventGraph();
  const finalEvidence = assembleFinalEvidence({
    context,
    admission,
    eventGraph,
    checkResults,
    failures,
    cleanupResults,
    attachments,
    prerequisiteResults,
    missingItems,
    finalEventRef: artifactRef(finalEvent),
    decisionRuleRef: rawInput.decisionRuleRef,
    validatorVersion: rawInput.validatorVersion,
  });
  emitter.artifactGraph([...checkResults, ...cleanupResults, finalEvidence]);
  return deepFreeze({
    admission,
    lifecycle: lifecycle.snapshot(),
    bundle: {
      plan,
      events: emitter.events(),
      checkResults,
      failures,
      cleanupResults,
      finalEvidence,
      attachments,
    },
  });
}

module.exports = {
  KERNEL_VERSION,
  KernelError,
  assembleFinalEvidence,
  runQualificationAttempt,
};
