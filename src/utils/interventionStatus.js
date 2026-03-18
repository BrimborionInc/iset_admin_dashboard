export const CANONICAL_INTERVENTION_STATUSES = Object.freeze([
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "rejected",
  "in_progress",
  "suspended",
  "completed",
  "cancelled",
]);

const CANONICAL_INTERVENTION_STATUS_SET = new Set(CANONICAL_INTERVENTION_STATUSES);

export const INTERVENTION_PROPOSAL_STATUSES = new Set([
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
]);

export const INTERVENTION_CLOSED_STATUSES = new Set(["completed", "cancelled"]);

export const INTERVENTION_OPEN_STATUSES = new Set([
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "in_progress",
  "suspended",
]);

export const INTERVENTION_ACTIVATABLE_STATUSES = new Set(["approved"]);

export const INTERVENTION_CLOSABLE_STATUSES = new Set(["in_progress", "suspended"]);

export const INTERVENTION_DELETABLE_STATUSES = new Set([
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "rejected",
]);

export const normalizeInterventionStatus = (value, fallback = null) => {
  if (value === null || typeof value === "undefined") return fallback;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return CANONICAL_INTERVENTION_STATUS_SET.has(normalized) ? normalized : fallback;
};

export const formatInterventionStatusLabel = value => {
  const normalized =
    normalizeInterventionStatus(value, null) ||
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  if (!normalized) return "-";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

export const isInterventionProposalStatus = status =>
  INTERVENTION_PROPOSAL_STATUSES.has(normalizeInterventionStatus(status));

export const isInterventionClosedStatus = status =>
  INTERVENTION_CLOSED_STATUSES.has(normalizeInterventionStatus(status));

export const isInterventionOpenStatus = status =>
  INTERVENTION_OPEN_STATUSES.has(normalizeInterventionStatus(status));

export const isInterventionActivatableStatus = status =>
  INTERVENTION_ACTIVATABLE_STATUSES.has(normalizeInterventionStatus(status));

export const isInterventionClosableStatus = status =>
  INTERVENTION_CLOSABLE_STATUSES.has(normalizeInterventionStatus(status));

export const isInterventionDeletableStatus = status =>
  INTERVENTION_DELETABLE_STATUSES.has(normalizeInterventionStatus(status));
