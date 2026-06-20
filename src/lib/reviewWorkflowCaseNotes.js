const {
  REVIEW_ACTIONS,
  REVIEW_WORKFLOW_TYPES,
} = require('./reviewWorkflow');

function normalizeInlineText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function resolveReviewWorkflowSubjectLabel(workflowType) {
  switch (String(workflowType || '').trim()) {
    case REVIEW_WORKFLOW_TYPES.InterventionProposal:
      return 'intervention proposal';
    case REVIEW_WORKFLOW_TYPES.InterventionRevision:
      return 'intervention amendment';
    case REVIEW_WORKFLOW_TYPES.ApplicationAssessment:
    default:
      return 'application assessment';
  }
}

function resolveReviewWorkflowNoteContext(action) {
  switch (String(action || '').trim()) {
    case REVIEW_ACTIONS.RmReturnToSubmitter:
    case REVIEW_ACTIONS.RmSubmitToNwac:
    case REVIEW_ACTIONS.RmForwardChangesToSubmitter:
      return 'Regional Manager review';
    case REVIEW_ACTIONS.NwacRequestChanges:
    case REVIEW_ACTIONS.NwacApprove:
    case REVIEW_ACTIONS.NwacDeny:
      return 'Decision Maker review';
    default:
      return 'Review';
  }
}

function resolveReviewWorkflowActionPhrase(action, subjectLabel) {
  const subject = subjectLabel || 'item';
  switch (String(action || '').trim()) {
    case REVIEW_ACTIONS.RmReturnToSubmitter:
      return `returned the ${subject} for changes`;
    case REVIEW_ACTIONS.RmSubmitToNwac:
      return `submitted the ${subject} for final decision`;
    case REVIEW_ACTIONS.RmForwardChangesToSubmitter:
      return `forwarded requested changes on the ${subject} to the submitter`;
    case REVIEW_ACTIONS.NwacRequestChanges:
      return `requested changes on the ${subject}`;
    case REVIEW_ACTIONS.NwacApprove:
      return `approved the ${subject}`;
    case REVIEW_ACTIONS.NwacDeny:
      return `denied the ${subject}`;
    default:
      return `updated the ${subject}`;
  }
}

function buildReviewWorkflowCaseNoteBody({
  workflowType,
  action,
  actorName,
  note,
} = {}) {
  const cleanNote = normalizeInlineText(note);
  if (!cleanNote) return null;

  const subjectLabel = resolveReviewWorkflowSubjectLabel(workflowType);
  const context = resolveReviewWorkflowNoteContext(action);
  const actor = normalizeInlineText(actorName) || 'A staff member';
  const phrase = resolveReviewWorkflowActionPhrase(action, subjectLabel);
  return `${context}: ${actor} ${phrase} with this note: ${cleanNote}`;
}

module.exports = {
  buildReviewWorkflowCaseNoteBody,
  normalizeInlineText,
  resolveReviewWorkflowActionPhrase,
  resolveReviewWorkflowNoteContext,
  resolveReviewWorkflowSubjectLabel,
};
