'use strict';

const { canonicalize, digestCanonical } = require('./canonical-json');
const { SchemaValidationError, validateArtifact } = require('./schema-validator');
const { SelectionError, selectChecks } = require('./selector');

class PlanValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PlanValidationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PlanValidationError(code, message, details);
}

function assertCanonicalEqual(actual, expected, code, label) {
  if (canonicalize(actual) !== canonicalize(expected)) {
    fail(code, `${label} does not match the independently reconstructed value`, { actual, expected });
  }
}

function validateLineage(plan) {
  if (!Array.isArray(plan.parentArtifactRefs) || plan.parentArtifactRefs.length === 0) {
    fail('PLAN_LINEAGE_INVALID', 'A dependency-ordered plan must reference its preceding plan snapshot');
  }
  for (const reference of plan.parentArtifactRefs) {
    if (
      reference.schemaName !== 'path.release-qualification.qualification-plan'
      || reference.schemaVersion !== '1.0.0-draft.2'
      || reference.artifactId === plan.artifactId
    ) {
      fail('PLAN_LINEAGE_INVALID', 'Plan predecessor lineage is stale, conflicting, or self-referential', { reference });
    }
  }
}

function validateBudgetReserves(budgets, cleanupObligations) {
  const protectedMinimum = budgets.startupMs
    + budgets.executionMs
    + budgets.gracefulTerminationMs
    + budgets.forcedTerminationMs
    + budgets.cleanupMs
    + budgets.finalizationMs;
  if (budgets.idleMs > budgets.executionMs || budgets.totalAttemptMs < protectedMinimum) {
    fail('PLAN_BUDGET_INVALID', 'Plan timeouts do not preserve bounded execution, termination, cleanup, and finalization');
  }
  for (const obligation of cleanupObligations) {
    if (obligation.budgetMs > budgets.cleanupMs) {
      fail('PLAN_BUDGET_INVALID', `Cleanup obligation ${obligation.obligationId} exceeds the protected cleanup budget`);
    }
  }
}

function validatePlanForAdmission(plan, selectionInput) {
  try {
    validateArtifact(plan);
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      fail('PLAN_STRUCTURE_INVALID', 'Qualification plan failed strict schema, digest, or identity validation', {
        causeCode: error.code,
        issues: error.issues,
      });
    }
    throw error;
  }

  if (plan.schemaName !== 'path.release-qualification.qualification-plan') {
    fail('PLAN_STRUCTURE_INVALID', 'Only a qualification-plan artifact can be admitted');
  }
  if (plan.lifecycleState !== 'DEPENDENCIES_ORDERED') {
    fail('PLAN_LIFECYCLE_INVALID', 'Only a complete DEPENDENCIES_ORDERED plan can open an attempt');
  }
  if (plan.completeness.state !== 'complete' || plan.completeness.missingEvidence.length !== 0) {
    fail('PLAN_INCOMPLETE', 'A partial or interrupted plan cannot be admitted');
  }
  validateLineage(plan);

  let selection;
  try {
    selection = selectChecks(selectionInput);
  } catch (error) {
    if (error instanceof SelectionError) {
      fail('PLAN_SELECTION_REJECTED', 'The deterministic selection input was rejected', {
        causeCode: error.code,
        causeDetails: error.details,
      });
    }
    throw error;
  }

  assertCanonicalEqual(plan.productCandidateId, selection.productCandidateId, 'PLAN_IDENTITY_CONFLICT', 'productCandidateId');
  assertCanonicalEqual(plan.harnessVersion, selection.harnessVersion, 'PLAN_IDENTITY_CONFLICT', 'harnessVersion');
  assertCanonicalEqual(plan.identityBindings.productCandidateId, selection.productCandidateId, 'PLAN_IDENTITY_CONFLICT', 'identityBindings.productCandidateId');
  assertCanonicalEqual(plan.identityBindings.harnessVersion, selection.harnessVersion, 'PLAN_IDENTITY_CONFLICT', 'identityBindings.harnessVersion');
  assertCanonicalEqual(plan.testPackVersions, selection.testPackVersions, 'PLAN_IDENTITY_CONFLICT', 'testPackVersions');
  assertCanonicalEqual(
    plan.identityBindings.availablePackRegistryRef,
    selection.registryRef,
    'PLAN_AUTHORITY_CONFLICT',
    'identityBindings.availablePackRegistryRef',
  );
  assertCanonicalEqual(plan.selectionPolicyRef, selection.policyRef, 'PLAN_AUTHORITY_CONFLICT', 'selectionPolicyRef');
  assertCanonicalEqual(plan.packRegistryRef, selection.registryRef, 'PLAN_AUTHORITY_CONFLICT', 'packRegistryRef');

  assertCanonicalEqual(plan.requestedTarget, {
    targetClass: selectionInput.target.targetClass,
    targetName: selectionInput.target.targetName,
    policyRef: selectionInput.policy.policyRef,
  }, 'PLAN_TARGET_MISMATCH', 'requestedTarget');
  assertCanonicalEqual(plan.requestedScope, {
    changeRefs: selectionInput.changedInputs.map((change) => change.changeRef),
    operations: selectionInput.operations,
    requestedSuites: selectionInput.requestedSuites,
    fullRegressionTriggers: selectionInput.scheduledFull.enabled ? [selectionInput.scheduledFull.triggerRef] : [],
  }, 'PLAN_SCOPE_MISMATCH', 'requestedScope');
  if (plan.scopeResolution.rejectedInputs.length > 0) {
    fail('PLAN_SCOPE_REJECTED', 'An admitted plan cannot contain rejected or unmapped scope', {
      rejectedInputs: plan.scopeResolution.rejectedInputs,
    });
  }
  assertCanonicalEqual(plan.scopeResolution, selection.scopeResolution, 'PLAN_SCOPE_MISMATCH', 'scopeResolution');
  assertCanonicalEqual(plan.selectedChecks, selection.selectedChecks, 'PLAN_SELECTION_MISMATCH', 'selectedChecks');
  assertCanonicalEqual(plan.dependencies, selection.dependencies, 'PLAN_DEPENDENCY_MISMATCH', 'dependencies');
  assertCanonicalEqual(plan.executionOrder, selection.executionOrder, 'PLAN_DEPENDENCY_MISMATCH', 'executionOrder');
  assertCanonicalEqual(plan.prerequisiteGates, selection.prerequisiteGates, 'PLAN_PREREQUISITE_MISMATCH', 'prerequisiteGates');
  assertCanonicalEqual(
    plan.environmentRequirements,
    selection.environmentRequirements,
    'PLAN_CAPABILITY_MISMATCH',
    'environmentRequirements',
  );
  assertCanonicalEqual(plan.declaredEffects, selection.declaredEffects, 'PLAN_EFFECT_MISMATCH', 'declaredEffects');
  assertCanonicalEqual(plan.adapterRequirements, selection.adapterRequirements, 'PLAN_CAPABILITY_MISMATCH', 'adapterRequirements');
  assertCanonicalEqual(
    plan.commandDeclarationRefs,
    selection.commandDeclarationRefs,
    'PLAN_COMMAND_MISMATCH',
    'commandDeclarationRefs',
  );
  assertCanonicalEqual(plan.budgets, selection.budgets, 'PLAN_BUDGET_INVALID', 'budgets');
  assertCanonicalEqual(
    plan.cancellationPolicyRef,
    selection.cancellationPolicyRef,
    'PLAN_CANCELLATION_MISMATCH',
    'cancellationPolicyRef',
  );
  assertCanonicalEqual(plan.cleanupObligations, selection.cleanupObligations, 'PLAN_CLEANUP_MISMATCH', 'cleanupObligations');
  validateBudgetReserves(plan.budgets, plan.cleanupObligations);

  const admissionRecord = {
    status: 'accepted',
    planRef: {
      schemaName: plan.schemaName,
      schemaVersion: plan.schemaVersion,
      artifactId: plan.artifactId,
      contentDigest: plan.contentDigest,
    },
    productCandidateId: selection.productCandidateId,
    harnessVersion: selection.harnessVersion,
    testPackVersions: selection.testPackVersions,
    selectionInputDigest: selection.selectionInputDigest,
    selectionOutputDigest: selection.selectionOutputDigest,
  };
  return {
    ...admissionRecord,
    admissionDigest: { algorithm: 'sha256', value: digestCanonical(admissionRecord) },
    selection,
  };
}

module.exports = {
  PlanValidationError,
  validatePlanForAdmission,
};
