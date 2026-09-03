import { resolveInterventionStateFields } from "./interventionStatus.js";

const REVISION_ELIGIBLE_STATUSES = new Set([
  "approved",
  "in_progress",
  "suspended",
]);

export const resolveInterventionRevisionAction = ({
  intervention = null,
  canModify = false,
  hasOpenProposal = false,
  matchingRevisionDraft = null,
} = {}) => {
  if (!intervention || !canModify) {
    return { available: false, reason: "not_editable" };
  }

  const status = resolveInterventionStateFields(intervention).effectiveStatus;
  if (!REVISION_ELIGIBLE_STATUSES.has(status)) {
    return { available: false, reason: "status_not_eligible" };
  }

  if (matchingRevisionDraft?.id) {
    return {
      available: true,
      reason: "matching_revision_draft",
      label: "Resume revision draft",
      draft: matchingRevisionDraft,
    };
  }

  if (hasOpenProposal) {
    return { available: false, reason: "another_proposal_open" };
  }

  return {
    available: true,
    reason: "revision_available",
    label: "Revise approved intervention",
    draft: null,
  };
};
