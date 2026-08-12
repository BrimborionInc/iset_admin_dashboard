'use strict';

const { canonicalize } = require('./canonical-json');
const { validateAttemptId } = require('./identities');

const TRANSITION_RULE_VERSION = '1.0.0';

const TRANSITIONS = Object.freeze({
  prerequisite: Object.freeze({
    PREREQUISITES_EVALUATING: Object.freeze(['ENVIRONMENT_PROVING', 'PREREQUISITES_PASSED', 'PREREQUISITE_FAILED']),
    ENVIRONMENT_PROVING: Object.freeze(['PREREQUISITES_PASSED', 'PREREQUISITE_FAILED']),
  }),
  check: Object.freeze({
    CHECK_PENDING: Object.freeze(['CHECK_READY', 'CHECK_BLOCKED']),
    CHECK_READY: Object.freeze(['CHECK_DISPATCHED', 'CHECK_FAILED']),
    CHECK_DISPATCHED: Object.freeze(['CHECK_RUNNING', 'CHECK_FAILED', 'CHECK_TIMED_OUT', 'CHECK_CANCELLING']),
    CHECK_RUNNING: Object.freeze(['CHECK_COMPLETED', 'CHECK_FAILED', 'CHECK_TIMED_OUT', 'CHECK_CANCELLING']),
    CHECK_TIMED_OUT: Object.freeze(['CHECK_CANCELLING']),
    CHECK_CANCELLING: Object.freeze(['CHECK_CANCELLED', 'TERMINATION_FAILED']),
  }),
  cleanup: Object.freeze({
    CLEANUP_REQUIRED: Object.freeze(['CLEANUP_RUNNING', 'CLEANUP_FAILED']),
    CLEANUP_RUNNING: Object.freeze(['CLEANUP_SUCCEEDED', 'CLEANUP_FAILED', 'CLEANUP_INTERRUPTED']),
  }),
  residue: Object.freeze({
    RESIDUE_PROVING: Object.freeze(['RESIDUE_PROOF_COMPLETED', 'RESIDUE_PROOF_FAILED']),
  }),
  attempt: Object.freeze({
    ATTEMPT_OPENED: Object.freeze(['ATTEMPT_FINALIZING']),
    ATTEMPT_FINALIZING: Object.freeze(['FINAL_EVIDENCE_EMITTED', 'FINALIZATION_INTERRUPTED']),
  }),
  validation: Object.freeze({
    INDEPENDENT_VALIDATION_RUNNING: Object.freeze(['VALIDATION_ACCEPTED', 'VALIDATION_REJECTED']),
    VALIDATION_ACCEPTED: Object.freeze(['ADVISORY_RESULT_AVAILABLE']),
    VALIDATION_REJECTED: Object.freeze(['ADVISORY_RESULT_AVAILABLE']),
  }),
});

const TERMINAL = Object.freeze({
  prerequisite: new Set(['PREREQUISITES_PASSED', 'PREREQUISITE_FAILED']),
  check: new Set(['CHECK_COMPLETED', 'CHECK_FAILED', 'CHECK_CANCELLED', 'CHECK_BLOCKED', 'TERMINATION_FAILED']),
  cleanup: new Set(['CLEANUP_UNNECESSARY', 'CLEANUP_SUCCEEDED', 'CLEANUP_FAILED', 'CLEANUP_INTERRUPTED']),
  residue: new Set(['RESIDUE_PROOF_COMPLETED', 'RESIDUE_PROOF_FAILED', 'RESIDUE_UNNECESSARY']),
  attempt: new Set(['FINAL_EVIDENCE_EMITTED', 'FINALIZATION_INTERRUPTED']),
  validation: new Set(['ADVISORY_RESULT_AVAILABLE']),
});

class LifecycleError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LifecycleError';
    this.code = code;
    this.details = details;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function copyRefs(references) {
  if (!Array.isArray(references)) {
    throw new LifecycleError('INVALID_EVIDENCE_REFS', 'triggeringEvidenceRefs must be an array');
  }
  try {
    canonicalize(references);
  } catch (error) {
    throw new LifecycleError('INVALID_EVIDENCE_REFS', 'triggeringEvidenceRefs must contain canonical JSON values', {
      cause: error.code || error.message,
    });
  }
  return structuredClone(references);
}

function subjectKey(scope, subjectId) {
  return `${scope}:${subjectId}`;
}

function assertSubjectId(subjectId) {
  if (typeof subjectId !== 'string' || subjectId.length === 0) {
    throw new LifecycleError('INVALID_SUBJECT', 'Lifecycle subjectId must be a non-empty string');
  }
}

class Lifecycle {
  #attemptId;

  #checkInstanceIds;

  #ordinal = 0;

  #subjects = new Map();

  #history = [];

  constructor({ attemptId, checkInstanceIds }) {
    try {
      validateAttemptId(attemptId);
    } catch (error) {
      throw new LifecycleError('INVALID_ATTEMPT_ID', 'Lifecycle construction requires a valid attempt identity', {
        cause: error.code || error.message,
      });
    }
    if (!Array.isArray(checkInstanceIds) || checkInstanceIds.length === 0) {
      throw new LifecycleError('SELECTED_CHECKS_REQUIRED', 'Lifecycle construction requires the complete selected check set');
    }
    checkInstanceIds.forEach(assertSubjectId);
    if (new Set(checkInstanceIds).size !== checkInstanceIds.length) {
      throw new LifecycleError('DUPLICATE_SELECTED_CHECK', 'Selected check instance IDs must be unique');
    }
    this.#attemptId = attemptId;
    this.#checkInstanceIds = new Set(checkInstanceIds);
  }

  #assertSelectedCheck(checkInstanceId) {
    assertSubjectId(checkInstanceId);
    if (!this.#checkInstanceIds.has(checkInstanceId)) {
      throw new LifecycleError('UNKNOWN_SELECTED_CHECK', `Check ${checkInstanceId} is not bound to this lifecycle`);
    }
  }

  #newRecord({ kind, scope, subjectId, fromState, toState, triggeringEvidenceRefs }) {
    this.#ordinal += 1;
    const record = deepFreeze({
      kind,
      scope,
      subjectId,
      fromState,
      toState,
      transitionRuleVersion: TRANSITION_RULE_VERSION,
      triggeringEvidenceRefs: copyRefs(triggeringEvidenceRefs),
      lifecycleOrdinal: this.#ordinal,
    });
    this.#history.push(record);
    return record;
  }

  #start({ scope, subjectId, fromState, toState, triggeringEvidenceRefs = [] }) {
    assertSubjectId(subjectId);
    const key = subjectKey(scope, subjectId);
    const existing = this.#subjects.get(key);
    if (existing) {
      if (
        existing.state === toState
        && canonicalize(existing.lastRecord.triggeringEvidenceRefs) === canonicalize(triggeringEvidenceRefs)
      ) {
        return existing.lastRecord;
      }
      throw new LifecycleError('CONFLICTING_REPEAT', `Lifecycle subject ${key} was already started`, {
        currentState: existing.state,
        requestedState: toState,
      });
    }
    const record = this.#newRecord({
      kind: fromState === null ? 'initial-observation' : 'state-transition',
      scope,
      subjectId,
      fromState,
      toState,
      triggeringEvidenceRefs,
    });
    this.#subjects.set(key, { state: toState, lastRecord: record });
    return record;
  }

  #transition({ scope, subjectId, toState, triggeringEvidenceRefs = [] }) {
    assertSubjectId(subjectId);
    const key = subjectKey(scope, subjectId);
    const subject = this.#subjects.get(key);
    if (!subject) {
      throw new LifecycleError('UNKNOWN_SUBJECT', `Lifecycle subject ${key} has not been started`);
    }
    if (subject.state === toState) {
      if (canonicalize(subject.lastRecord.triggeringEvidenceRefs) === canonicalize(triggeringEvidenceRefs)) {
        return subject.lastRecord;
      }
      throw new LifecycleError('CONFLICTING_REPEAT', `Repeated transition for ${key} has different evidence`, {
        state: toState,
      });
    }
    if (TERMINAL[scope].has(subject.state)) {
      throw new LifecycleError('POST_TERMINAL_TRANSITION', `Lifecycle subject ${key} is terminal`, {
        currentState: subject.state,
        requestedState: toState,
      });
    }
    const allowed = TRANSITIONS[scope][subject.state] || [];
    if (!allowed.includes(toState)) {
      throw new LifecycleError('INVALID_TRANSITION', `Transition ${subject.state} -> ${toState} is not permitted`, {
        scope,
        subjectId,
        allowed,
      });
    }
    const record = this.#newRecord({
      kind: 'state-transition',
      scope,
      subjectId,
      fromState: subject.state,
      toState,
      triggeringEvidenceRefs,
    });
    subject.state = toState;
    subject.lastRecord = record;
    return record;
  }

  #state(scope, subjectId) {
    return this.#subjects.get(subjectKey(scope, subjectId))?.state;
  }

  #requireOpenAttempt() {
    const state = this.#state('attempt', this.#attemptId);
    if (state !== 'ATTEMPT_OPENED') {
      throw new LifecycleError('ATTEMPT_NOT_OPEN', 'Child lifecycle work requires an open, non-finalizing attempt', {
        state,
      });
    }
  }

  openAttempt(triggeringEvidenceRefs = []) {
    return this.#start({
      scope: 'attempt',
      subjectId: this.#attemptId,
      fromState: null,
      toState: 'ATTEMPT_OPENED',
      triggeringEvidenceRefs,
    });
  }

  beginPrerequisites(checkInstanceId, triggeringEvidenceRefs = []) {
    this.#requireOpenAttempt();
    this.#assertSelectedCheck(checkInstanceId);
    if (this.#state('check', checkInstanceId) !== undefined) {
      throw new LifecycleError('CHECK_ALREADY_STARTED', 'Prerequisites cannot start after the check lifecycle');
    }
    return this.#start({
      scope: 'prerequisite',
      subjectId: checkInstanceId,
      fromState: 'ATTEMPT_OPENED',
      toState: 'PREREQUISITES_EVALUATING',
      triggeringEvidenceRefs,
    });
  }

  transitionPrerequisites(checkInstanceId, toState, triggeringEvidenceRefs = []) {
    this.#requireOpenAttempt();
    this.#assertSelectedCheck(checkInstanceId);
    return this.#transition({
      scope: 'prerequisite',
      subjectId: checkInstanceId,
      toState,
      triggeringEvidenceRefs,
    });
  }

  beginCheck(checkInstanceId, triggeringEvidenceRefs = []) {
    this.#requireOpenAttempt();
    this.#assertSelectedCheck(checkInstanceId);
    const prerequisiteState = this.#state('prerequisite', checkInstanceId);
    if (!TERMINAL.prerequisite.has(prerequisiteState)) {
      throw new LifecycleError('PREREQUISITES_NOT_TERMINAL', 'A check cannot start before its prerequisites are terminal', {
        checkInstanceId,
        prerequisiteState,
      });
    }
    return this.#start({
      scope: 'check',
      subjectId: checkInstanceId,
      fromState: prerequisiteState,
      toState: 'CHECK_PENDING',
      triggeringEvidenceRefs,
    });
  }

  transitionCheck(checkInstanceId, toState, triggeringEvidenceRefs = []) {
    this.#requireOpenAttempt();
    this.#assertSelectedCheck(checkInstanceId);
    const prerequisiteState = this.#state('prerequisite', checkInstanceId);
    if (toState === 'CHECK_READY' && prerequisiteState !== 'PREREQUISITES_PASSED') {
      throw new LifecycleError('PREREQUISITE_ADMISSION_DENIED', 'A check can become ready only after prerequisites pass', {
        checkInstanceId,
        prerequisiteState,
      });
    }
    if (
      toState === 'CHECK_BLOCKED'
      && prerequisiteState === 'PREREQUISITES_PASSED'
      && triggeringEvidenceRefs.length === 0
    ) {
      throw new LifecycleError('BLOCKER_EVIDENCE_REQUIRED', 'A non-prerequisite blocker requires explicit triggering evidence');
    }
    return this.#transition({
      scope: 'check',
      subjectId: checkInstanceId,
      toState,
      triggeringEvidenceRefs,
    });
  }

  beginCleanup(checkInstanceId, decision, triggeringEvidenceRefs = []) {
    this.#requireOpenAttempt();
    this.#assertSelectedCheck(checkInstanceId);
    if (!['required', 'unnecessary'].includes(decision)) {
      throw new LifecycleError('INVALID_CLEANUP_DECISION', 'Cleanup decision must be required or unnecessary');
    }
    const checkState = this.#state('check', checkInstanceId);
    if (!TERMINAL.check.has(checkState)) {
      throw new LifecycleError('CHECK_NOT_TERMINAL', 'Cleanup cannot start before the check is terminal', {
        checkInstanceId,
        checkState,
      });
    }
    if (checkState === 'TERMINATION_FAILED') {
      throw new LifecycleError('TERMINATION_NOT_PROVED', 'Cleanup cannot overlap work whose termination is unproved');
    }
    return this.#start({
      scope: 'cleanup',
      subjectId: checkInstanceId,
      fromState: checkState,
      toState: decision === 'required' ? 'CLEANUP_REQUIRED' : 'CLEANUP_UNNECESSARY',
      triggeringEvidenceRefs,
    });
  }

  transitionCleanup(checkInstanceId, toState, triggeringEvidenceRefs = []) {
    this.#requireOpenAttempt();
    this.#assertSelectedCheck(checkInstanceId);
    return this.#transition({
      scope: 'cleanup',
      subjectId: checkInstanceId,
      toState,
      triggeringEvidenceRefs,
    });
  }

  beginResidueProof(checkInstanceId, triggeringEvidenceRefs = []) {
    this.#requireOpenAttempt();
    this.#assertSelectedCheck(checkInstanceId);
    const cleanupState = this.#state('cleanup', checkInstanceId);
    let residueState;
    if (cleanupState === 'CLEANUP_UNNECESSARY') residueState = 'RESIDUE_UNNECESSARY';
    if (cleanupState === 'CLEANUP_SUCCEEDED' || cleanupState === 'CLEANUP_FAILED') residueState = 'RESIDUE_PROVING';
    if (!residueState) {
      throw new LifecycleError('CLEANUP_NOT_READY_FOR_RESIDUE', 'Residue handling requires terminal cleanup evidence', {
        checkInstanceId,
        cleanupState,
      });
    }
    return this.#start({
      scope: 'residue',
      subjectId: checkInstanceId,
      fromState: cleanupState,
      toState: residueState,
      triggeringEvidenceRefs,
    });
  }

  transitionResidueProof(checkInstanceId, toState, triggeringEvidenceRefs = []) {
    this.#requireOpenAttempt();
    this.#assertSelectedCheck(checkInstanceId);
    return this.#transition({
      scope: 'residue',
      subjectId: checkInstanceId,
      toState,
      triggeringEvidenceRefs,
    });
  }

  beginFinalization(triggeringEvidenceRefs = []) {
    this.#requireOpenAttempt();
    const blockers = [];
    for (const checkInstanceId of this.#checkInstanceIds) {
      const prerequisiteState = this.#state('prerequisite', checkInstanceId);
      const checkState = this.#state('check', checkInstanceId);
      const cleanupState = this.#state('cleanup', checkInstanceId);
      const residueState = this.#state('residue', checkInstanceId);
      if (!TERMINAL.prerequisite.has(prerequisiteState)) blockers.push({ checkInstanceId, scope: 'prerequisite', state: prerequisiteState });
      if (!TERMINAL.check.has(checkState)) blockers.push({ checkInstanceId, scope: 'check', state: checkState });
      if (checkState !== 'TERMINATION_FAILED') {
        if (!TERMINAL.cleanup.has(cleanupState)) blockers.push({ checkInstanceId, scope: 'cleanup', state: cleanupState });
        if (!TERMINAL.residue.has(residueState)) blockers.push({ checkInstanceId, scope: 'residue', state: residueState });
      }
    }
    if (blockers.length > 0) {
      throw new LifecycleError('ATTEMPT_NOT_FINALIZABLE', 'Every check requires terminal prerequisite, check, cleanup, and residue evidence', {
        blockers,
      });
    }
    return this.#transition({
      scope: 'attempt',
      subjectId: this.#attemptId,
      toState: 'ATTEMPT_FINALIZING',
      triggeringEvidenceRefs,
    });
  }

  completeFinalization({ interrupted = false, triggeringEvidenceRefs = [] } = {}) {
    return this.#transition({
      scope: 'attempt',
      subjectId: this.#attemptId,
      toState: interrupted ? 'FINALIZATION_INTERRUPTED' : 'FINAL_EVIDENCE_EMITTED',
      triggeringEvidenceRefs,
    });
  }

  beginValidation(triggeringEvidenceRefs = []) {
    if (this.#state('attempt', this.#attemptId) !== 'FINAL_EVIDENCE_EMITTED') {
      throw new LifecycleError('FINAL_EVIDENCE_NOT_AVAILABLE', 'Validation requires emitted final evidence');
    }
    return this.#start({
      scope: 'validation',
      subjectId: this.#attemptId,
      fromState: 'FINAL_EVIDENCE_EMITTED',
      toState: 'INDEPENDENT_VALIDATION_RUNNING',
      triggeringEvidenceRefs,
    });
  }

  transitionValidation(toState, triggeringEvidenceRefs = []) {
    return this.#transition({
      scope: 'validation',
      subjectId: this.#attemptId,
      toState,
      triggeringEvidenceRefs,
    });
  }

  currentState(scope, subjectId = this.#attemptId) {
    if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, scope)) {
      throw new LifecycleError('INVALID_SCOPE', `Unknown lifecycle scope ${String(scope)}`);
    }
    return this.#state(scope, subjectId);
  }

  snapshot() {
    return deepFreeze({
      attemptId: this.#attemptId,
      selectedCheckInstanceIds: [...this.#checkInstanceIds].sort((left, right) => (
        left < right ? -1 : left > right ? 1 : 0
      )),
      records: structuredClone(this.#history),
      states: Object.fromEntries(
        [...this.#subjects.entries()]
          .map(([key, subject]) => [key, subject.state])
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
      ),
    });
  }
}

function createLifecycle(options) {
  return new Lifecycle(options);
}

module.exports = {
  TRANSITION_RULE_VERSION,
  LifecycleError,
  createLifecycle,
};
