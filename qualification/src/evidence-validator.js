'use strict';

const {
  canonicalize,
  digestBytes,
  digestCanonical,
  parseStrictJson,
} = require('./canonical-json');
const { validateAttemptId } = require('./identities');
const { validatePlanForAdmission } = require('./plan-validator');
const { validateArtifact } = require('./schema-validator');

const VALIDATOR_VERSION = '0.1.0';
const VALIDATOR_AUTHORITY = Object.freeze({
  authorityId: 'qualification-evidence-validator',
  componentId: 'pure-local-independent-validator',
  componentVersion: VALIDATOR_VERSION,
});
const BUNDLE_KEYS = Object.freeze([
  'plan',
  'events',
  'checkResults',
  'failures',
  'cleanupResults',
  'finalEvidence',
  'attachments',
]);
const LOCAL_TRANSITIONS = Object.freeze({
  prerequisite: Object.freeze({
    PREREQUISITES_EVALUATING: ['ENVIRONMENT_PROVING', 'PREREQUISITES_PASSED', 'PREREQUISITE_FAILED'],
    ENVIRONMENT_PROVING: ['PREREQUISITES_PASSED', 'PREREQUISITE_FAILED'],
  }),
  check: Object.freeze({
    CHECK_PENDING: ['CHECK_READY', 'CHECK_BLOCKED'],
    CHECK_READY: ['CHECK_DISPATCHED', 'CHECK_FAILED'],
    CHECK_DISPATCHED: ['CHECK_RUNNING', 'CHECK_FAILED', 'CHECK_TIMED_OUT', 'CHECK_CANCELLING'],
    CHECK_RUNNING: ['CHECK_COMPLETED', 'CHECK_FAILED', 'CHECK_TIMED_OUT', 'CHECK_CANCELLING'],
    CHECK_TIMED_OUT: ['CHECK_CANCELLING'],
    CHECK_CANCELLING: ['CHECK_CANCELLED', 'TERMINATION_FAILED'],
  }),
  cleanup: Object.freeze({
    CLEANUP_REQUIRED: ['CLEANUP_RUNNING', 'CLEANUP_FAILED'],
    CLEANUP_RUNNING: ['CLEANUP_SUCCEEDED', 'CLEANUP_FAILED', 'CLEANUP_INTERRUPTED'],
  }),
  residue: Object.freeze({
    RESIDUE_PROVING: ['RESIDUE_PROOF_COMPLETED', 'RESIDUE_PROOF_FAILED'],
  }),
  attempt: Object.freeze({
    ATTEMPT_OPENED: ['ATTEMPT_FINALIZING'],
    ATTEMPT_FINALIZING: ['FINAL_EVIDENCE_EMITTED', 'FINALIZATION_INTERRUPTED'],
  }),
});
const SCOPE_STARTS = Object.freeze({
  prerequisite: Object.freeze({
    ATTEMPT_OPENED: ['PREREQUISITES_EVALUATING'],
  }),
  check: Object.freeze({
    PREREQUISITES_PASSED: ['CHECK_PENDING'],
    PREREQUISITE_FAILED: ['CHECK_PENDING'],
  }),
  cleanup: Object.freeze({
    CHECK_COMPLETED: ['CLEANUP_REQUIRED', 'CLEANUP_UNNECESSARY'],
    CHECK_FAILED: ['CLEANUP_REQUIRED', 'CLEANUP_UNNECESSARY'],
    CHECK_CANCELLED: ['CLEANUP_REQUIRED', 'CLEANUP_UNNECESSARY'],
    CHECK_BLOCKED: ['CLEANUP_UNNECESSARY'],
  }),
  residue: Object.freeze({
    CLEANUP_UNNECESSARY: ['RESIDUE_UNNECESSARY'],
    CLEANUP_SUCCEEDED: ['RESIDUE_PROVING'],
    CLEANUP_FAILED: ['RESIDUE_PROVING'],
  }),
});

class EvidenceValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'EvidenceValidationError';
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  return structuredClone(value);
}

function same(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function artifactRef(artifact) {
  return {
    schemaName: artifact.schemaName,
    schemaVersion: artifact.schemaVersion,
    artifactId: artifact.artifactId,
    contentDigest: clone(artifact.contentDigest),
  };
}

function referenceKey(reference) {
  return `${reference.schemaName}:${reference.schemaVersion}:${reference.artifactId}`;
}

function sortCanonical(values) {
  return [...values].sort((left, right) => {
    const a = canonicalize(left);
    const b = canonicalize(right);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function selectedScope(plan, admission) {
  const checkById = new Map(plan.selectedChecks.map((check) => [check.checkInstanceId, check]));
  const dependencyRefs = new Map();
  for (const dependency of plan.dependencies) {
    const refs = dependencyRefs.get(dependency.dependant) || [];
    const predecessor = checkById.get(dependency.predecessor);
    if (predecessor) refs.push(clone(predecessor.checkDefinitionRef));
    dependencyRefs.set(dependency.dependant, refs);
  }
  return {
    checks: plan.selectedChecks.map((check) => ({
      checkInstanceId: check.checkInstanceId,
      packId: check.packId,
      packVersion: check.packVersion,
      inclusionOrigins: clone(check.inclusionOrigins),
      dependencyRefs: sortCanonical(dependencyRefs.get(check.checkInstanceId) || []),
    })),
    dependencyDigest: { algorithm: 'sha256', value: digestCanonical(plan.dependencies) },
    selectionInputDigest: clone(admission.selection.selectionInputDigest),
    selectionOutputDigest: clone(admission.selection.selectionOutputDigest),
  };
}

function makeReporter() {
  const errors = [];
  return {
    add(code, path, message) {
      errors.push({ code, path, message });
    },
    list() {
      return errors.sort((left, right) => {
        const a = `${left.code}:${left.path}:${left.message}`;
        const b = `${right.code}:${right.path}:${right.message}`;
        return a < b ? -1 : a > b ? 1 : 0;
      });
    },
    get length() {
      return errors.length;
    },
  };
}

function validateBundleShape(bundle, reporter) {
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    reporter.add('BUNDLE_MALFORMED', '$', 'Evidence bundle must be an object');
    return false;
  }
  const missing = BUNDLE_KEYS.filter((key) => !Object.prototype.hasOwnProperty.call(bundle, key));
  const unknown = Object.keys(bundle).filter((key) => !BUNDLE_KEYS.includes(key));
  for (const key of missing) reporter.add('BUNDLE_FIELD_MISSING', `$.${key}`, 'Required evidence bundle field is missing');
  for (const key of unknown) reporter.add('BUNDLE_FIELD_UNKNOWN', `$.${key}`, 'Unknown evidence bundle field is forbidden');
  for (const key of ['events', 'checkResults', 'failures', 'cleanupResults', 'attachments']) {
    if (Object.prototype.hasOwnProperty.call(bundle, key) && !Array.isArray(bundle[key])) {
      reporter.add('BUNDLE_FIELD_MALFORMED', `$.${key}`, 'Evidence collection must be an array');
    }
  }
  return missing.length === 0 && unknown.length === 0 && reporter.length === 0;
}

function validateSchemas(bundle, reporter) {
  const artifacts = [
    ['$.plan', bundle.plan],
    ...bundle.events.map((artifact, index) => [`$.events[${index}]`, artifact]),
    ...bundle.checkResults.map((artifact, index) => [`$.checkResults[${index}]`, artifact]),
    ...bundle.failures.map((artifact, index) => [`$.failures[${index}]`, artifact]),
    ...bundle.cleanupResults.map((artifact, index) => [`$.cleanupResults[${index}]`, artifact]),
    ['$.finalEvidence', bundle.finalEvidence],
  ];
  for (const [path, artifact] of artifacts) {
    try {
      validateArtifact(artifact);
    } catch (error) {
      reporter.add(error.code || 'SCHEMA_VALIDATION_FAILED', path, error.message);
    }
  }
  return artifacts;
}

function indexArtifacts(artifacts, reporter) {
  const index = new Map();
  for (const [path, artifact] of artifacts) {
    if (!artifact || typeof artifact !== 'object') continue;
    let key;
    try {
      key = referenceKey(artifact);
    } catch {
      continue;
    }
    const existing = index.get(key);
    if (existing && !same(existing.artifact.contentDigest, artifact.contentDigest)) {
      reporter.add('ARTIFACT_ID_CONFLICT', path, 'Artifact identity is associated with conflicting digests');
    } else if (existing) {
      reporter.add('ARTIFACT_DUPLICATE', path, 'Artifact identity is duplicated in the evidence bundle');
    } else {
      index.set(key, { artifact, path });
    }
  }
  return index;
}

function validateAttachments(bundle, reporter, artifactIndex) {
  const index = new Map();
  for (const [position, attachment] of bundle.attachments.entries()) {
    const path = `$.attachments[${position}]`;
    const keys = ['attachmentRef', 'mediaType', 'sizeBytes', 'sensitivity', 'retentionClass', 'availability', 'bytesBase64'];
    if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)) {
      reporter.add('ATTACHMENT_MALFORMED', path, 'Attachment must be an object');
      continue;
    }
    const unknown = Object.keys(attachment).filter((key) => !keys.includes(key));
    const missing = keys.filter((key) => !Object.prototype.hasOwnProperty.call(attachment, key));
    if (unknown.length || missing.length) {
      reporter.add('ATTACHMENT_MALFORMED', path, 'Attachment has missing or unknown fields');
      continue;
    }
    const key = referenceKey(attachment.attachmentRef);
    if (index.has(key)) {
      reporter.add('ATTACHMENT_DUPLICATE', path, 'Attachment identity appears more than once');
      continue;
    }
    let bytes;
    try {
      bytes = Buffer.from(attachment.bytesBase64, 'base64');
      if (bytes.toString('base64') !== attachment.bytesBase64) throw new Error('non-canonical base64');
    } catch {
      reporter.add('ATTACHMENT_ENCODING_INVALID', path, 'Attachment bytes are not canonical base64');
      continue;
    }
    if (bytes.length !== attachment.sizeBytes) reporter.add('ATTACHMENT_SIZE_MISMATCH', path, 'Attachment byte count conflicts with metadata');
    if (attachment.attachmentRef.contentDigest.algorithm !== 'sha256'
      || digestBytes(bytes) !== attachment.attachmentRef.contentDigest.value) {
      reporter.add('ATTACHMENT_DIGEST_MISMATCH', path, 'Attachment digest does not match its exact bytes');
    }
    if (attachment.mediaType.includes('process-result+json')) {
      try {
        parseStrictJson(bytes);
      } catch (error) {
        reporter.add(error.code || 'ATTACHMENT_JSON_INVALID', path, 'Process-result attachment is not strict JSON');
      }
    }
    index.set(key, { attachment, path });
    if (artifactIndex.has(key)) reporter.add('ARTIFACT_ATTACHMENT_COLLISION', path, 'Attachment identity collides with a schema artifact');
  }
  return index;
}

function validateLineage(bundle, reporter) {
  const planReference = artifactRef(bundle.plan);
  const attempt = bundle.finalEvidence?.attemptId;
  try {
    validateAttemptId(attempt);
  } catch (error) {
    reporter.add(error.code || 'ATTEMPT_ID_INVALID', '$.finalEvidence.attemptId', error.message);
  }
  const artifacts = [...bundle.events, ...bundle.checkResults, ...bundle.failures, ...bundle.cleanupResults, bundle.finalEvidence];
  for (const [index, artifact] of artifacts.entries()) {
    if (!artifact || artifact.lineageScope !== 'attempt') continue;
    const path = `$.attemptArtifacts[${index}]`;
    for (const identity of ['productCandidateId', 'harnessVersion', 'attemptId', 'testPackVersions']) {
      if (!same(artifact[identity], bundle.finalEvidence[identity])) {
        reporter.add('IDENTITY_LINEAGE_CONFLICT', `${path}.${identity}`, 'Artifact identity conflicts with final attempt identity');
      }
    }
    if (!same(artifact.planRef, planReference)) {
      reporter.add('PLAN_LINEAGE_CONFLICT', `${path}.planRef`, 'Artifact does not reference the exact admitted plan');
    }
  }
}

function validateEvents(bundle, reporter) {
  const events = bundle.events;
  const planRef = artifactRef(bundle.plan);
  const final = bundle.finalEvidence;
  const subjectStates = new Map();
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const path = `$.events[${index}]`;
    if (event.attemptSequence !== index + 1 || event.producerSequence !== index) {
      reporter.add('EVENT_SEQUENCE_INVALID', path, 'Event sequence must be gap-free and producer ordered');
    }
    const expectedParent = index === 0 ? planRef : artifactRef(events[index - 1]);
    if (event.parentArtifactRefs?.length !== 1 || !same(event.parentArtifactRefs[0], expectedParent)) {
      reporter.add('EVENT_PARENT_INVALID', path, 'Event does not reference its immediate predecessor');
    }
    if (event.eventType === 'state-transition') {
      const transition = event.transition;
      const scope = event.checkInstanceId
        ? ['CLEANUP_', 'RESIDUE_'].some((prefix) => transition.toState.startsWith(prefix))
          ? transition.toState.startsWith('CLEANUP_') ? 'cleanup' : 'residue'
          : transition.toState.startsWith('PREREQUISITE') || transition.toState === 'ENVIRONMENT_PROVING' ? 'prerequisite' : 'check'
        : 'attempt';
      const subject = `${scope}:${event.checkInstanceId || event.attemptId}`;
      const prior = subjectStates.get(subject);
      if (prior !== undefined && prior !== transition.fromState) {
        reporter.add('EVENT_STATE_CONFLICT', path, 'Transition fromState conflicts with reconstructed subject state');
      }
      const admitted = prior === undefined
        ? SCOPE_STARTS[scope]?.[transition.fromState] || []
        : LOCAL_TRANSITIONS[scope]?.[transition.fromState] || [];
      if (!admitted.includes(transition.toState)) {
        reporter.add('EVENT_TRANSITION_INVALID', path, 'Transition is not admitted by the independent lifecycle table');
      }
      subjectStates.set(subject, transition.toState);
    } else if (event.eventType === 'storage-observation') {
      const scope = event.checkInstanceId ? 'unknown' : 'attempt';
      if (scope === 'attempt') subjectStates.set(`attempt:${event.attemptId}`, event.lifecycleState);
    }
  }
  const eventRefs = events.map(artifactRef);
  const expectedGraph = {
    eventRefs,
    firstSequence: 1,
    lastSequence: events.length,
    missingRanges: [],
    quarantinedEventRefs: [],
    graphDigest: { algorithm: 'sha256', value: digestCanonical(eventRefs) },
  };
  if (!same(final.eventGraph, expectedGraph)) {
    reporter.add('EVENT_GRAPH_CONFLICT', '$.finalEvidence.eventGraph', 'Final event graph cannot be reconstructed from accepted events');
  }
}

function validateResults(bundle, reporter, artifactIndex, attachmentIndex) {
  const plan = bundle.plan;
  const final = bundle.finalEvidence;
  const selected = new Map(plan.selectedChecks.map((check) => [check.checkInstanceId, check]));
  const resultsByCheck = new Map();
  for (const [index, result] of bundle.checkResults.entries()) {
    const path = `$.checkResults[${index}]`;
    const check = selected.get(result.checkInstanceId);
    if (!check) reporter.add('UNSELECTED_RESULT', path, 'Result belongs to a check outside selected scope');
    if (resultsByCheck.has(result.checkInstanceId)) reporter.add('DUPLICATE_CHECK_RESULT', path, 'Selected check has more than one result');
    resultsByCheck.set(result.checkInstanceId, result);
    if (check && (result.packId !== check.packId || result.packVersion !== check.packVersion
      || !same(result.checkDefinitionRef, check.checkDefinitionRef))) {
      reporter.add('CHECK_BINDING_CONFLICT', path, 'Result pack or definition binding conflicts with selected scope');
    }
    const terminalKey = referenceKey(result.terminalEventRef);
    if (!artifactIndex.has(terminalKey)) reporter.add('TERMINAL_EVENT_MISSING', `${path}.terminalEventRef`, 'Result terminal event is absent');
    for (const ref of result.attachmentRefs) {
      if (!attachmentIndex.has(referenceKey(ref))) reporter.add('RESULT_ATTACHMENT_MISSING', path, 'Result attachment is absent or stale');
    }
    if (result.effectsObserved.undeclaredEffectTokens.length > 0) {
      reporter.add('UNDECLARED_EFFECT', `${path}.effectsObserved`, 'Runtime evidence reports an undeclared effect');
    }
    if (result.status === 'passed' && (!result.executionFacts.terminationProved || result.executionFacts.outputTruncated)) {
      reporter.add('PASS_EVIDENCE_INVALID', path, 'Passing result lacks complete termination and output evidence');
    }
  }
  for (const checkId of selected.keys()) {
    if (!resultsByCheck.has(checkId)) reporter.add('CHECK_RESULT_MISSING', '$.checkResults', `Selected check ${checkId} has no result`);
  }
  const expectedRefs = sortCanonical(bundle.checkResults.map(artifactRef));
  if (!same(final.checkResults, expectedRefs)) reporter.add('FINAL_RESULT_INDEX_CONFLICT', '$.finalEvidence.checkResults', 'Final result index differs from bundle results');

  const failuresByRef = new Set(bundle.failures.map((failure) => referenceKey(artifactRef(failure))));
  for (const result of bundle.checkResults) {
    if (result.failureRef && !failuresByRef.has(referenceKey(result.failureRef))) {
      reporter.add('FAILURE_REFERENCE_MISSING', '$.checkResults', `Result ${result.checkInstanceId} references an absent failure`);
    }
  }
  const expectedFailureRefs = sortCanonical(bundle.failures.map(artifactRef));
  if (!same(final.failures, expectedFailureRefs)) reporter.add('FINAL_FAILURE_INDEX_CONFLICT', '$.finalEvidence.failures', 'Final failure index differs from bundle failures');
  for (const [index, failure] of bundle.failures.entries()) {
    if (failure.primaryClassification === 'unclassified' && (!failure.mandatoryStop || failure.mandatoryStopReasons.length === 0)) {
      reporter.add('UNCLASSIFIED_STOP_MISSING', `$.failures[${index}]`, 'Unclassified failure must be a mandatory stop');
    }
    if (!attachmentIndex.has(referenceKey(failure.resultRef)) && !artifactIndex.has(referenceKey(failure.resultRef))) {
      reporter.add('FAILURE_RESULT_MISSING', `$.failures[${index}].resultRef`, 'Failure source result is absent');
    }
  }
  return resultsByCheck;
}

function validateCleanup(bundle, reporter, resultsByCheck, artifactIndex) {
  const obligationById = new Map(bundle.plan.cleanupObligations.map((item) => [item.obligationId, item]));
  const cleanupById = new Map();
  for (const [index, result] of bundle.cleanupResults.entries()) {
    const path = `$.cleanupResults[${index}]`;
    const obligation = obligationById.get(result.cleanupObligationId);
    if (!obligation) reporter.add('CLEANUP_OBLIGATION_UNKNOWN', path, 'Cleanup result has no admitted obligation');
    if (cleanupById.has(result.cleanupObligationId)) reporter.add('CLEANUP_RESULT_DUPLICATE', path, 'Cleanup obligation has duplicate results');
    cleanupById.set(result.cleanupObligationId, result);
    if (obligation && obligation.checkInstanceId !== result.checkInstanceId) {
      reporter.add('CLEANUP_CHECK_CONFLICT', path, 'Cleanup result is bound to the wrong check');
    }
    if (result.residueDecision === 'zero-residue') {
      if (!result.residueVerifier?.independentFromCleanupOwner || result.residueAssertions.length === 0) {
        reporter.add('ZERO_RESIDUE_UNPROVED', path, 'Cleanup execution alone cannot prove zero residue');
      }
    }
    if (result.executionTerminationProofRef && !artifactIndex.has(referenceKey(result.executionTerminationProofRef))) {
      const referencedByResult = [...resultsByCheck.values()].some((checkResult) => (
        checkResult.outputRefs.some((ref) => same(ref, result.executionTerminationProofRef))
      ));
      if (!referencedByResult) reporter.add('TERMINATION_PROOF_MISSING', path, 'Cleanup lacks proof that execution terminated');
    }
  }
  for (const obligation of obligationById.values()) {
    if (!cleanupById.has(obligation.obligationId)) {
      reporter.add('CLEANUP_RESULT_MISSING', '$.cleanupResults', `Cleanup obligation ${obligation.obligationId} has no result`);
    }
  }
  const final = bundle.finalEvidence.cleanupAndResidue;
  if (!same(final.obligationIds, [...obligationById.keys()].sort())) {
    reporter.add('FINAL_CLEANUP_SCOPE_CONFLICT', '$.finalEvidence.cleanupAndResidue.obligationIds', 'Final cleanup obligations differ from plan');
  }
  if (!same(final.cleanupResultRefs, sortCanonical(bundle.cleanupResults.map(artifactRef)))) {
    reporter.add('FINAL_CLEANUP_INDEX_CONFLICT', '$.finalEvidence.cleanupAndResidue.cleanupResultRefs', 'Final cleanup index differs from bundle');
  }
}

function validateFinalIndexes(bundle, reporter, attachmentIndex) {
  const final = bundle.finalEvidence;
  const expectedAttachmentIndex = sortCanonical(bundle.attachments.map(({ bytesBase64, ...metadata }) => metadata));
  if (!same(final.attachmentIndex, expectedAttachmentIndex)) {
    reporter.add('FINAL_ATTACHMENT_INDEX_CONFLICT', '$.finalEvidence.attachmentIndex', 'Final attachment index differs from durable attachment bytes');
  }
  const allReferences = new Set([
    referenceKey(artifactRef(bundle.plan)),
    ...bundle.events.map((item) => referenceKey(artifactRef(item))),
    ...bundle.checkResults.map((item) => referenceKey(artifactRef(item))),
    ...bundle.failures.map((item) => referenceKey(artifactRef(item))),
    ...bundle.cleanupResults.map((item) => referenceKey(artifactRef(item))),
    ...attachmentIndex.keys(),
  ]);
  for (const reference of final.validationHandoff.reconstructionInputRefs) {
    if (!allReferences.has(referenceKey(reference))) {
      reporter.add('HANDOFF_INPUT_MISSING', '$.finalEvidence.validationHandoff', 'Validation handoff references evidence outside the bundle');
    }
  }
  if (final.validationHandoff.selfApproved !== false) {
    reporter.add('SELF_APPROVAL_FORBIDDEN', '$.finalEvidence.validationHandoff.selfApproved', 'Producer may not approve its own final evidence');
  }
}

function reconstructStatus(bundle, reporter) {
  const final = bundle.finalEvidence;
  if (
    reporter.length > 0
    || final.missingOrPartialEvidence.items.length > 0
    || bundle.checkResults.some((result) => ['incomplete', 'unavailable'].includes(result.status) || !result.executionFacts.terminationProved)
    || bundle.cleanupResults.some((result) => ['interrupted', 'required', 'started'].includes(result.status) || result.residueDecision === 'unknown')
  ) return 'INCOMPLETE';
  if (
    bundle.failures.length > 0
    || bundle.checkResults.some((result) => result.status !== 'passed')
    || bundle.cleanupResults.some((result) => result.status === 'failed' || result.residueDecision === 'residue-found')
  ) return 'NO-GO';
  return 'GO';
}

function validationReport(bundle, schemaValid, reporter, reconstructedAdvisoryStatus) {
  const report = {
    validator: clone(VALIDATOR_AUTHORITY),
    inputGraphDigest: { algorithm: 'sha256', value: digestCanonical(bundle) },
    status: reporter.length === 0 ? 'accepted' : 'rejected',
    schemaValidity: schemaValid ? 'valid' : 'invalid',
    qualificationValidity: reporter.length === 0 ? 'valid' : 'invalid',
    reconstructedAdvisoryStatus,
    errors: reporter.list(),
    releaseAuthority: 'none',
  };
  return Object.freeze({
    ...report,
    contentDigest: { algorithm: 'sha256', value: digestCanonical(report) },
  });
}

function validateEvidenceBundle(bundle, selectionInput) {
  const reporter = makeReporter();
  if (!validateBundleShape(bundle, reporter)) {
    let input;
    try {
      input = canonicalize(bundle);
    } catch {
      input = 'malformed';
    }
    return validationReport({ malformedBundleDigest: digestBytes(Buffer.from(input)) }, false, reporter, 'INCOMPLETE');
  }
  let schemaValid = true;
  const artifacts = validateSchemas(bundle, reporter);
  if (reporter.length > 0) schemaValid = false;
  const artifactIndex = indexArtifacts(artifacts, reporter);
  const attachmentIndex = validateAttachments(bundle, reporter, artifactIndex);
  validateLineage(bundle, reporter);

  let admission;
  try {
    admission = validatePlanForAdmission(bundle.plan, selectionInput);
  } catch (error) {
    reporter.add(error.code || 'PLAN_ADMISSION_REJECTED', '$.plan', error.message);
  }
  if (admission) {
    const final = bundle.finalEvidence;
    if (!same(final.planDigest, bundle.plan.contentDigest)) {
      reporter.add('FINAL_PLAN_DIGEST_CONFLICT', '$.finalEvidence.planDigest', 'Final plan digest conflicts with admitted plan');
    }
    if (!same(final.requestedScope, {
      planScopeRef: artifactRef(bundle.plan),
      scopeDigest: { algorithm: 'sha256', value: digestCanonical(bundle.plan.requestedScope) },
    })) {
      reporter.add('REQUESTED_SCOPE_CONFLICT', '$.finalEvidence.requestedScope', 'Requested scope cannot be reconstructed from plan');
    }
    if (!same(final.selectedScope, selectedScope(bundle.plan, admission))) {
      reporter.add('SELECTED_SCOPE_CONFLICT', '$.finalEvidence.selectedScope', 'Selected scope cannot be reconstructed independently');
    }
  }
  validateEvents(bundle, reporter);
  const resultsByCheck = validateResults(bundle, reporter, artifactIndex, attachmentIndex);
  validateCleanup(bundle, reporter, resultsByCheck, artifactIndex);
  validateFinalIndexes(bundle, reporter, attachmentIndex);
  const reconstructedAdvisoryStatus = reconstructStatus(bundle, reporter);
  if (bundle.finalEvidence.producerAdvisoryStatus !== reconstructedAdvisoryStatus) {
    reporter.add('ADVISORY_STATUS_CONFLICT', '$.finalEvidence.producerAdvisoryStatus', 'Producer advisory status conflicts with independent reconstruction');
  }
  return validationReport(bundle, schemaValid, reporter, reconstructedAdvisoryStatus);
}

function validateEvidenceBytes(bytes, selectionInput) {
  let bundle;
  try {
    bundle = JSON.parse(canonicalize(parseStrictJson(bytes)));
  } catch (error) {
    const reporter = makeReporter();
    reporter.add(error.code || 'MALFORMED_JSON', '$', error.message);
    return validationReport({ inputDigest: digestBytes(Buffer.from(bytes)) }, false, reporter, 'INCOMPLETE');
  }
  return validateEvidenceBundle(bundle, selectionInput);
}

module.exports = {
  VALIDATOR_VERSION,
  EvidenceValidationError,
  validateEvidenceBundle,
  validateEvidenceBytes,
};
