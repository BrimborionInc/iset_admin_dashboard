'use strict';

const {
  canonicalize,
  computeArtifactDigest,
  digestCanonical,
} = require('./canonical-json');
const { validateAttemptId } = require('./identities');
const { validateArtifact } = require('./schema-validator');

const EVENT_SCHEMA_NAME = 'path.release-qualification.execution-event';
const EVENT_SCHEMA_VERSION = '1.0.0-draft.1';
const GRAPH_PROFILE = 'RQ-EVIDENCE-GRAPH-1';
const CHECK_SCOPES = new Set(['prerequisite', 'check', 'cleanup', 'residue']);
const MUTATION_EVIDENCE_STATES = new Set([
  'CHECK_COMPLETED',
  'CHECK_FAILED',
  'CHECK_TIMED_OUT',
  'CHECK_CANCELLING',
  'CHECK_CANCELLED',
  'TERMINATION_FAILED',
  'CLEANUP_UNNECESSARY',
  'CLEANUP_REQUIRED',
  'CLEANUP_RUNNING',
  'CLEANUP_SUCCEEDED',
  'CLEANUP_FAILED',
  'CLEANUP_INTERRUPTED',
  'RESIDUE_PROVING',
  'RESIDUE_PROOF_COMPLETED',
  'RESIDUE_PROOF_FAILED',
  'RESIDUE_UNNECESSARY',
]);

class EvidenceEmissionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'EvidenceEmissionError';
    this.code = code;
    this.details = details;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clone(value) {
  return structuredClone(value);
}

function artifactRef(artifact) {
  return {
    schemaName: artifact.schemaName,
    schemaVersion: artifact.schemaVersion,
    artifactId: artifact.artifactId,
    contentDigest: clone(artifact.contentDigest),
  };
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new EvidenceEmissionError('INVALID_CONTEXT', `${label} must be an object`);
  }
}

function assertExactKeys(value, required, optional, label) {
  assertObject(value, label);
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length || unknown.length) {
    throw new EvidenceEmissionError('INVALID_CONTEXT', `${label} has missing or unknown fields`, { missing, unknown });
  }
}

function same(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function eventArtifactId(attemptId, attemptSequence) {
  return `event:${attemptId.slice('attempt:'.length)}:${String(attemptSequence).padStart(8, '0')}`;
}

class EvidenceEmitter {
  #context;

  #events = [];

  #quarantinedRefs = [];

  constructor(context) {
    assertExactKeys(context, [
      'planRef',
      'productCandidateId',
      'harnessVersion',
      'attemptId',
      'testPackVersions',
      'checkBindings',
      'producer',
      'sensitivity',
      'redaction',
      'retentionPolicyRef',
    ], [], 'evidence emitter context');
    validateAttemptId(context.attemptId);
    assertObject(context.checkBindings, 'checkBindings');
    if (Object.keys(context.checkBindings).length === 0) {
      throw new EvidenceEmissionError('INVALID_CONTEXT', 'checkBindings must not be empty');
    }
    for (const [checkInstanceId, binding] of Object.entries(context.checkBindings)) {
      assertExactKeys(binding, ['packId', 'packVersion'], [], `checkBindings.${checkInstanceId}`);
      const packIdentity = context.testPackVersions[binding.packId];
      if (!packIdentity || packIdentity.packVersion !== binding.packVersion) {
        throw new EvidenceEmissionError('INVALID_CONTEXT', `checkBindings.${checkInstanceId} conflicts with testPackVersions`);
      }
    }
    canonicalize(context);
    this.#context = deepFreeze(clone(context));
  }

  #quarantine(artifact) {
    if (artifact && artifact.contentDigest) {
      const reference = artifactRef(artifact);
      if (!this.#quarantinedRefs.some((existing) => same(existing, reference))) {
        this.#quarantinedRefs.push(deepFreeze(reference));
      }
    }
  }

  #assertContextBinding(event) {
    const bindings = [
      'productCandidateId',
      'harnessVersion',
      'attemptId',
      'testPackVersions',
      'planRef',
      'producer',
      'sensitivity',
      'redaction',
      'retentionPolicyRef',
    ];
    const conflicts = bindings.filter((field) => !same(event[field], this.#context[field]));
    if (conflicts.length > 0) {
      throw new EvidenceEmissionError('STALE_OR_CONFLICTING_LINEAGE', 'Event identities or plan lineage conflict with the emitter context', {
        conflicts,
      });
    }
    const hasAnyCheckBinding = ['checkInstanceId', 'packId', 'packVersion']
      .some((field) => Object.prototype.hasOwnProperty.call(event, field));
    if (hasAnyCheckBinding) {
      const binding = this.#context.checkBindings[event.checkInstanceId];
      if (!binding || binding.packId !== event.packId || binding.packVersion !== event.packVersion) {
        throw new EvidenceEmissionError('STALE_OR_CONFLICTING_LINEAGE', 'Event check and pack binding conflicts with selected scope', {
          checkInstanceId: event.checkInstanceId,
        });
      }
    }
  }

  #accept(event) {
    validateArtifact(event);
    try {
      this.#assertContextBinding(event);
    } catch (error) {
      this.#quarantine(event);
      throw error;
    }

    const index = event.attemptSequence - 1;
    const existing = this.#events[index];
    if (existing) {
      if (same(existing, event)) return { event: existing, appended: false, duplicate: true };
      this.#quarantine(event);
      throw new EvidenceEmissionError('DUPLICATE_CONFLICT', 'An attempt sequence was replayed with different bytes', {
        attemptSequence: event.attemptSequence,
        existingArtifactId: existing.artifactId,
        conflictingArtifactId: event.artifactId,
      });
    }

    const expectedSequence = this.#events.length + 1;
    if (event.attemptSequence !== expectedSequence) {
      this.#quarantine(event);
      throw new EvidenceEmissionError('OUT_OF_ORDER_EVENT', 'Events must be appended in a gap-free attempt sequence', {
        expectedSequence,
        actualSequence: event.attemptSequence,
      });
    }
    if (event.producerSequence !== event.attemptSequence - 1) {
      this.#quarantine(event);
      throw new EvidenceEmissionError('PRODUCER_SEQUENCE_CONFLICT', 'The single in-process producer sequence must be gap-free from zero', {
        expected: event.attemptSequence - 1,
        actual: event.producerSequence,
      });
    }
    if (event.artifactId !== eventArtifactId(this.#context.attemptId, event.attemptSequence)) {
      this.#quarantine(event);
      throw new EvidenceEmissionError('ARTIFACT_ID_CONFLICT', 'Event artifactId does not match its attempt sequence');
    }
    const expectedParent = this.#events.length === 0
      ? this.#context.planRef
      : artifactRef(this.#events[this.#events.length - 1]);
    if (event.parentArtifactRefs.length !== 1 || !same(event.parentArtifactRefs[0], expectedParent)) {
      this.#quarantine(event);
      throw new EvidenceEmissionError('PARENT_CHAIN_CONFLICT', 'Event does not link its exact immediate predecessor');
    }

    const accepted = deepFreeze(clone(event));
    this.#events.push(accepted);
    return { event: accepted, appended: true, duplicate: false };
  }

  emitLifecycle(record, options) {
    assertExactKeys(options, ['occurredAt', 'recordedAt'], ['packId', 'packVersion', 'mutationState', 'effectTokens', 'completeness'], 'lifecycle event options');
    assertExactKeys(record, [
      'kind',
      'scope',
      'subjectId',
      'fromState',
      'toState',
      'transitionRuleVersion',
      'triggeringEvidenceRefs',
      'lifecycleOrdinal',
    ], [], 'lifecycle record');

    const checkScoped = CHECK_SCOPES.has(record.scope);
    if (checkScoped && (options.packId === undefined || options.packVersion === undefined)) {
      throw new EvidenceEmissionError('PACK_BINDING_REQUIRED', 'Check-scoped lifecycle evidence requires an exact pack binding');
    }
    if (!checkScoped && (options.packId !== undefined || options.packVersion !== undefined)) {
      throw new EvidenceEmissionError('PACK_BINDING_FORBIDDEN', 'Attempt and validation lifecycle evidence must not invent a pack binding');
    }
    if (checkScoped) {
      const binding = this.#context.checkBindings[record.subjectId];
      if (!binding || binding.packId !== options.packId || binding.packVersion !== options.packVersion) {
        throw new EvidenceEmissionError('PACK_BINDING_CONFLICT', 'Lifecycle evidence check and pack binding is not part of the selected attempt scope');
      }
    }
    if (MUTATION_EVIDENCE_STATES.has(record.toState) && options.mutationState === undefined) {
      throw new EvidenceEmissionError('MUTATION_STATE_REQUIRED', `${record.toState} requires an explicit synthetic mutation-state marker`);
    }

    const attemptSequence = this.#events.length + 1;
    const parentArtifactRefs = [this.#events.length === 0
      ? clone(this.#context.planRef)
      : artifactRef(this.#events[this.#events.length - 1])];
    const event = {
      schemaName: EVENT_SCHEMA_NAME,
      schemaVersion: EVENT_SCHEMA_VERSION,
      artifactId: eventArtifactId(this.#context.attemptId, attemptSequence),
      createdAt: options.recordedAt,
      producer: clone(this.#context.producer),
      lineageScope: 'attempt',
      productCandidateId: clone(this.#context.productCandidateId),
      harnessVersion: clone(this.#context.harnessVersion),
      attemptId: this.#context.attemptId,
      testPackVersions: clone(this.#context.testPackVersions),
      parentArtifactRefs,
      contentDigest: { algorithm: 'sha256', value: '0'.repeat(64) },
      lifecycleState: record.toState,
      completeness: clone(options.completeness || { state: 'complete', missingEvidence: [] }),
      sensitivity: this.#context.sensitivity,
      redaction: clone(this.#context.redaction),
      retentionPolicyRef: clone(this.#context.retentionPolicyRef),
      planRef: clone(this.#context.planRef),
      attemptSequence,
      producerSequence: attemptSequence - 1,
      eventType: record.kind === 'initial-observation' ? 'storage-observation' : 'state-transition',
      occurredAt: options.occurredAt,
      recordedAt: options.recordedAt,
    };
    if (record.kind !== 'initial-observation') {
      event.transition = {
        fromState: record.fromState,
        toState: record.toState,
        triggeringEvidenceRefs: clone(record.triggeringEvidenceRefs),
        transitionRuleVersion: record.transitionRuleVersion,
      };
    }
    if (checkScoped) {
      event.checkInstanceId = record.subjectId;
      event.packId = options.packId;
      event.packVersion = options.packVersion;
    }
    if (options.mutationState !== undefined) event.mutationState = options.mutationState;
    if (options.effectTokens !== undefined) event.effectTokens = clone(options.effectTokens);
    event.contentDigest = computeArtifactDigest(event);
    return this.#accept(event).event;
  }

  replay(event) {
    const candidate = clone(event);
    const existing = this.#events[candidate.attemptSequence - 1];
    if (!existing) {
      let structurallyValid = false;
      try {
        validateArtifact(candidate);
        structurallyValid = true;
        this.#assertContextBinding(candidate);
        this.#quarantine(candidate);
      } catch (error) {
        if (structurallyValid) this.#quarantine(candidate);
        throw error;
      }
      const expectedSequence = this.#events.length + 1;
      throw new EvidenceEmissionError(
        candidate.attemptSequence === expectedSequence ? 'UNSEEN_REPLAY' : 'OUT_OF_ORDER_EVENT',
        'Replay may confirm an accepted event but cannot append unseen evidence',
        { expectedSequence, actualSequence: candidate.attemptSequence },
      );
    }
    return this.#accept(candidate);
  }

  events() {
    return deepFreeze(clone(this.#events));
  }

  eventGraph() {
    if (this.#events.length === 0) {
      throw new EvidenceEmissionError('EMPTY_EVENT_GRAPH', 'An event graph requires at least one accepted event');
    }
    const eventRefs = this.#events.map(artifactRef);
    return deepFreeze({
      eventRefs,
      firstSequence: 1,
      lastSequence: this.#events.length,
      missingRanges: [],
      quarantinedEventRefs: clone(this.#quarantinedRefs),
      graphDigest: { algorithm: 'sha256', value: digestCanonical(eventRefs) },
    });
  }

  artifactGraph(additionalArtifacts = []) {
    if (!Array.isArray(additionalArtifacts)) {
      throw new EvidenceEmissionError('INVALID_ARTIFACT_GRAPH', 'Additional artifacts must be an array');
    }
    const references = [clone(this.#context.planRef), ...this.#events.map(artifactRef)];
    for (const artifact of additionalArtifacts) {
      validateArtifact(artifact);
      if (artifact.lineageScope === 'pre-attempt') {
        if (!same(artifactRef(artifact), this.#context.planRef)) {
          throw new EvidenceEmissionError('STALE_OR_CONFLICTING_LINEAGE', 'Artifact graph contains a different pre-attempt plan');
        }
      } else {
        const bindings = ['productCandidateId', 'harnessVersion', 'attemptId', 'testPackVersions', 'planRef'];
        const conflicts = bindings.filter((field) => !same(artifact[field], this.#context[field]));
        if (conflicts.length > 0) {
          throw new EvidenceEmissionError('STALE_OR_CONFLICTING_LINEAGE', 'Artifact graph contains stale attempt lineage', {
            conflicts,
          });
        }
        if (artifact.checkInstanceId !== undefined) {
          const binding = this.#context.checkBindings[artifact.checkInstanceId];
          if (!binding || binding.packId !== artifact.packId || binding.packVersion !== artifact.packVersion) {
            throw new EvidenceEmissionError('STALE_OR_CONFLICTING_LINEAGE', 'Artifact graph contains an unselected check or pack binding');
          }
        }
      }
      references.push(artifactRef(artifact));
    }

    const byIdentity = new Map();
    for (const reference of references) {
      const key = `${reference.schemaName}:${reference.schemaVersion}:${reference.artifactId}`;
      const existing = byIdentity.get(key);
      if (existing && !same(existing, reference)) {
        throw new EvidenceEmissionError('ARTIFACT_GRAPH_CONFLICT', 'Artifact identity has conflicting digests', { key });
      }
      byIdentity.set(key, reference);
    }
    const artifactRefs = [...byIdentity.values()].sort((left, right) => {
      const leftKey = canonicalize(left);
      const rightKey = canonicalize(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
    const graph = {
      profile: GRAPH_PROFILE,
      attemptId: this.#context.attemptId,
      artifactRefs,
    };
    return deepFreeze({
      ...graph,
      graphDigest: { algorithm: 'sha256', value: digestCanonical(graph) },
    });
  }
}

function createEvidenceEmitter(context) {
  return new EvidenceEmitter(context);
}

module.exports = {
  GRAPH_PROFILE,
  EvidenceEmissionError,
  artifactRef,
  createEvidenceEmitter,
};
