const REVIEW_WORKFLOW_TYPES = Object.freeze({
  ApplicationAssessment: 'application_assessment',
  InterventionProposal: 'intervention_proposal',
  InterventionRevision: 'intervention_revision',
});

const REVIEW_STAGES = Object.freeze({
  RmReview: 'rm_review',
  NwacReview: 'nwac_review',
  ReturnedToRm: 'returned_to_rm',
  ReturnedToSubmitter: 'returned_to_submitter',
  FinalDecisionRecorded: 'final_decision_recorded',
  Withdrawn: 'withdrawn',
});

const REVIEW_ACTIONS = Object.freeze({
  SubmitForRmReview: 'submit_for_rm_review',
  RmReturnToSubmitter: 'rm_return_to_submitter',
  RmSubmitToNwac: 'rm_submit_to_nwac',
  NwacRequestChanges: 'nwac_request_changes',
  RmForwardChangesToSubmitter: 'rm_forward_changes_to_submitter',
  NwacApprove: 'nwac_approve',
  NwacDeny: 'nwac_deny',
  Withdraw: 'withdraw',
});

const REVIEW_OWNER_ROLES = Object.freeze({
  RegionalManager: 'Regional Manager',
  NwacAdministrator: 'NWAC Administrator',
  Submitter: 'Submitter',
});

const VALID_WORKFLOW_TYPES = new Set(Object.values(REVIEW_WORKFLOW_TYPES));
const VALID_REVIEW_STAGES = new Set(Object.values(REVIEW_STAGES));
const ADMIN_REVIEW_ROLE_KEYS = new Set(['systemadministrator', 'nwacadministrator']);
const RM_REVIEW_ROLE_KEYS = new Set(['regionalmanager']);
const SUBMITTER_ROLE_KEYS = new Set(['isetcoordinator']);

function normalizeRoleKey(role) {
  return String(role || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function normalizeReviewWorkflowType(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return VALID_WORKFLOW_TYPES.has(normalized) ? normalized : null;
}

function normalizeReviewStage(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return VALID_REVIEW_STAGES.has(normalized) ? normalized : null;
}

function isRegionalManagerRole(role) {
  return RM_REVIEW_ROLE_KEYS.has(normalizeRoleKey(role));
}

function isNwacDecisionRole(role) {
  return ADMIN_REVIEW_ROLE_KEYS.has(normalizeRoleKey(role));
}

function isSubmitterRole(role) {
  return SUBMITTER_ROLE_KEYS.has(normalizeRoleKey(role));
}

function parseReviewWorkflowMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function requiresSubmitterCorrectionReturn(workflowType, workflowMetadata) {
  if (normalizeReviewWorkflowType(workflowType) !== REVIEW_WORKFLOW_TYPES.ApplicationAssessment) {
    return false;
  }
  const metadata = parseReviewWorkflowMetadata(workflowMetadata);
  return (
    metadata.requiresSubmitterCorrectionReturn === true ||
    metadata.requires_submitter_correction_return === true
  );
}

function isTwoStepReviewEnabled(config, workflowType) {
  const normalizedWorkflowType = normalizeReviewWorkflowType(workflowType);
  if (!normalizedWorkflowType) return false;

  if (config === true) return true;
  if (!config || typeof config !== 'object') return false;

  if (config.enabled === false) return false;
  const workflows = config.workflows && typeof config.workflows === 'object' ? config.workflows : null;
  if (workflows && Object.prototype.hasOwnProperty.call(workflows, normalizedWorkflowType)) {
    return workflows[normalizedWorkflowType] === true;
  }
  return config.enabled === true;
}

function buildReviewSubjectKey({ workflowType, applicationId, interventionId, proposalId } = {}) {
  const normalizedWorkflowType = normalizeReviewWorkflowType(workflowType);
  if (!normalizedWorkflowType) return null;

  if (normalizedWorkflowType === REVIEW_WORKFLOW_TYPES.ApplicationAssessment) {
    const id = Number(applicationId);
    return Number.isInteger(id) && id > 0 ? `${normalizedWorkflowType}:application:${id}` : null;
  }

  const proposalNumeric = Number(proposalId);
  if (Number.isInteger(proposalNumeric) && proposalNumeric > 0) {
    return `${normalizedWorkflowType}:proposal:${proposalNumeric}`;
  }

  const interventionNumeric = Number(interventionId);
  if (Number.isInteger(interventionNumeric) && interventionNumeric > 0) {
    return `${normalizedWorkflowType}:intervention:${interventionNumeric}`;
  }

  return null;
}

function getInitialReviewStage({ workflowType } = {}) {
  return normalizeReviewWorkflowType(workflowType) ? REVIEW_STAGES.RmReview : null;
}

function getReviewTransition({ action, currentStage, role, workflowType, workflowMetadata } = {}) {
  const normalizedStage = normalizeReviewStage(currentStage);
  const actionKey = String(action || '').trim().toLowerCase();
  const normalizedWorkflowType = normalizeReviewWorkflowType(workflowType);

  if (actionKey === REVIEW_ACTIONS.SubmitForRmReview) {
    return {
      allowed:
        Boolean(normalizedWorkflowType) &&
        (
          isSubmitterRole(role) ||
          isRegionalManagerRole(role)
        ),
      nextStage: REVIEW_STAGES.RmReview,
      nextOwnerRole: REVIEW_OWNER_ROLES.RegionalManager,
      requiresNote: false,
    };
  }

  if (actionKey === REVIEW_ACTIONS.RmReturnToSubmitter) {
    return {
      allowed: normalizedStage === REVIEW_STAGES.RmReview && isRegionalManagerRole(role),
      nextStage: REVIEW_STAGES.ReturnedToSubmitter,
      nextOwnerRole: REVIEW_OWNER_ROLES.Submitter,
      requiresNote: true,
    };
  }

  if (actionKey === REVIEW_ACTIONS.RmSubmitToNwac) {
    const correctionReturnRequired = requiresSubmitterCorrectionReturn(
      normalizedWorkflowType,
      workflowMetadata
    );
    const otherwiseAllowed =
      normalizedStage === REVIEW_STAGES.RmReview &&
      isRegionalManagerRole(role);
    return {
      allowed: otherwiseAllowed && !correctionReturnRequired,
      nextStage: REVIEW_STAGES.NwacReview,
      nextOwnerRole: REVIEW_OWNER_ROLES.NwacAdministrator,
      requiresNote: false,
      recordsRmSignoff: true,
      blockReason:
        otherwiseAllowed && correctionReturnRequired
          ? 'review_workflow_return_required'
          : null,
    };
  }

  if (actionKey === REVIEW_ACTIONS.NwacRequestChanges) {
    return {
      allowed: normalizedStage === REVIEW_STAGES.NwacReview && isNwacDecisionRole(role),
      nextStage: REVIEW_STAGES.ReturnedToRm,
      nextOwnerRole: REVIEW_OWNER_ROLES.RegionalManager,
      requiresNote: true,
      nwacDecision: 'changes_requested',
    };
  }

  if (actionKey === REVIEW_ACTIONS.RmForwardChangesToSubmitter) {
    return {
      allowed: normalizedStage === REVIEW_STAGES.ReturnedToRm && isRegionalManagerRole(role),
      nextStage: REVIEW_STAGES.ReturnedToSubmitter,
      nextOwnerRole: REVIEW_OWNER_ROLES.Submitter,
      requiresNote: true,
    };
  }

  if (actionKey === REVIEW_ACTIONS.NwacApprove || actionKey === REVIEW_ACTIONS.NwacDeny) {
    return {
      allowed: normalizedStage === REVIEW_STAGES.NwacReview && isNwacDecisionRole(role),
      nextStage: REVIEW_STAGES.FinalDecisionRecorded,
      nextOwnerRole: null,
      requiresNote: false,
      nwacDecision: actionKey === REVIEW_ACTIONS.NwacApprove ? 'approved' : 'denied',
      recordsFinalDecision: true,
    };
  }

  if (actionKey === REVIEW_ACTIONS.Withdraw) {
    return {
      allowed:
        normalizedStage !== REVIEW_STAGES.FinalDecisionRecorded &&
        normalizedStage !== REVIEW_STAGES.Withdrawn &&
        (isSubmitterRole(role) || isNwacDecisionRole(role)),
      nextStage: REVIEW_STAGES.Withdrawn,
      nextOwnerRole: null,
      requiresNote: false,
    };
  }

  return {
    allowed: false,
    nextStage: null,
    nextOwnerRole: null,
    requiresNote: false,
  };
}

function isReviewStageLockedForSubmitter(stage) {
  const normalizedStage = normalizeReviewStage(stage);
  return (
    normalizedStage === REVIEW_STAGES.RmReview ||
    normalizedStage === REVIEW_STAGES.NwacReview ||
    normalizedStage === REVIEW_STAGES.ReturnedToRm
  );
}

module.exports = {
  REVIEW_ACTIONS,
  REVIEW_OWNER_ROLES,
  REVIEW_STAGES,
  REVIEW_WORKFLOW_TYPES,
  buildReviewSubjectKey,
  getInitialReviewStage,
  getReviewTransition,
  isNwacDecisionRole,
  isRegionalManagerRole,
  isReviewStageLockedForSubmitter,
  isSubmitterRole,
  isTwoStepReviewEnabled,
  normalizeReviewStage,
  normalizeReviewWorkflowType,
  normalizeRoleKey,
  requiresSubmitterCorrectionReturn,
};
