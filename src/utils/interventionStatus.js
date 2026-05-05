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

export const CANONICAL_INTERVENTION_REVIEW_STATUSES = Object.freeze([
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "rejected",
]);

export const CANONICAL_INTERVENTION_DELIVERY_STATUSES = Object.freeze([
  "planned",
  "in_progress",
  "suspended",
  "completed",
  "cancelled",
]);

const CANONICAL_INTERVENTION_STATUS_SET = new Set(CANONICAL_INTERVENTION_STATUSES);
const CANONICAL_INTERVENTION_REVIEW_STATUS_SET = new Set(CANONICAL_INTERVENTION_REVIEW_STATUSES);
const CANONICAL_INTERVENTION_DELIVERY_STATUS_SET = new Set(CANONICAL_INTERVENTION_DELIVERY_STATUSES);

const normalizeWorkflowKey = value =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const normalizePositiveInteger = value => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const parseMetadataObject = value => {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const hasAppliedRevisionMetadata = metadata => {
  if (!metadata || typeof metadata !== "object") return false;
  if (metadata.lastAppliedRevision && typeof metadata.lastAppliedRevision === "object") return true;
  return Array.isArray(metadata.revisionHistory) && metadata.revisionHistory.length > 0;
};

const isManualBackloadMetadata = metadata => {
  if (!metadata || typeof metadata !== "object") return false;
  const source = normalizeWorkflowKey(metadata.source);
  const entryMode = normalizeWorkflowKey(metadata.entryMode ?? metadata.entry_mode);
  return source === "manual_backload" || source === "auto_assessment" || entryMode === "existing";
};

const resolveApprovalLetterFollowUpMetadata = metadata => {
  if (!metadata || typeof metadata !== "object") return {};
  const candidates = [
    metadata.approvalLetterFollowUp,
    metadata.approval_letter_follow_up,
    metadata.letterFollowUp,
    metadata.letter_follow_up,
  ];
  return candidates.find(candidate => candidate && typeof candidate === "object") || {};
};

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

export const normalizeInterventionReviewStatus = (value, fallback = null) => {
  if (value === null || typeof value === "undefined") return fallback;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return CANONICAL_INTERVENTION_REVIEW_STATUS_SET.has(normalized) ? normalized : fallback;
};

export const normalizeInterventionDeliveryStatus = (value, fallback = null) => {
  if (value === null || typeof value === "undefined") return fallback;
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return CANONICAL_INTERVENTION_DELIVERY_STATUS_SET.has(normalized) ? normalized : fallback;
};

export const resolveInterventionStateFields = (record = {}, { fallbackStatus = null } = {}) => {
  const source =
    record && typeof record === "object"
      ? record
      : { status: record };
  const legacyStatus =
    normalizeInterventionStatus(
      source?.status ??
        source?.interventionStatus ??
        source?.intervention_status ??
        null,
      null
    ) || normalizeInterventionStatus(fallbackStatus, null);
  const explicitReviewStatus =
    normalizeInterventionReviewStatus(
      source?.reviewStatus ??
        source?.review_status ??
        source?.proposalReviewStatus ??
        source?.proposal_review_status ??
        null,
      null
    );
  const explicitDeliveryStatus =
    normalizeInterventionDeliveryStatus(
      source?.deliveryStatus ?? source?.delivery_status ?? null,
      null
    );

  let reviewStatus = explicitReviewStatus;
  let deliveryStatus = explicitDeliveryStatus;

  if (!reviewStatus) {
    if (
      legacyStatus &&
      ["draft", "submitted", "in_review", "changes_requested", "approved", "rejected"].includes(legacyStatus)
    ) {
      reviewStatus = legacyStatus;
    } else if (
      legacyStatus &&
      ["in_progress", "suspended", "completed", "cancelled"].includes(legacyStatus)
    ) {
      reviewStatus = "approved";
    }
  }

  if (!deliveryStatus) {
    if (legacyStatus === "approved") {
      deliveryStatus = "planned";
    } else if (
      legacyStatus &&
      ["in_progress", "suspended", "completed", "cancelled"].includes(legacyStatus)
    ) {
      deliveryStatus = legacyStatus;
    }
  }

  const effectiveStatus =
    (deliveryStatus === "planned" ? "approved" : deliveryStatus) ||
    reviewStatus ||
    legacyStatus ||
    normalizeInterventionStatus(fallbackStatus, null) ||
    null;

  return {
    status: legacyStatus || null,
    legacyStatus: legacyStatus || null,
    reviewStatus: reviewStatus || null,
    review_status: reviewStatus || null,
    proposalReviewStatus: reviewStatus || null,
    proposal_review_status: reviewStatus || null,
    deliveryStatus: deliveryStatus || null,
    delivery_status: deliveryStatus || null,
    effectiveStatus,
    effective_status: effectiveStatus,
  };
};

export const formatInterventionStatusLabel = value => {
  const state = resolveInterventionStateFields(value);
  const normalized =
    state.effectiveStatus ||
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  if (!normalized) return "-";
  if (normalized === "rejected") return "Denied";
  if (normalized === "changes_requested") return "Request Changes";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

export const isInterventionProposalStatus = status =>
  INTERVENTION_PROPOSAL_STATUSES.has(resolveInterventionStateFields(status).reviewStatus);

export const isInterventionClosedStatus = status =>
  INTERVENTION_CLOSED_STATUSES.has(
    resolveInterventionStateFields(status).deliveryStatus ||
      resolveInterventionStateFields(status).effectiveStatus
  );

export const isInterventionOpenStatus = status =>
  INTERVENTION_OPEN_STATUSES.has(resolveInterventionStateFields(status).effectiveStatus);

export const isInterventionActivatableStatus = status =>
  INTERVENTION_ACTIVATABLE_STATUSES.has(resolveInterventionStateFields(status).effectiveStatus);

export const isInterventionClosableStatus = status =>
  INTERVENTION_CLOSABLE_STATUSES.has(
    resolveInterventionStateFields(status).deliveryStatus ||
      resolveInterventionStateFields(status).effectiveStatus
  );

export const isInterventionDeletableStatus = status =>
  INTERVENTION_DELETABLE_STATUSES.has(resolveInterventionStateFields(status).effectiveStatus);

export const resolveInterventionApprovalLetterFollowUp = intervention => {
  if (!intervention || typeof intervention !== "object") {
    return { eligible: false, isRevision: false };
  }
  const state = resolveInterventionStateFields(intervention, { fallbackStatus: null });
  if (state.reviewStatus !== "approved") {
    return { eligible: false, isRevision: false };
  }

  const metadata = parseMetadataObject(intervention.metadata ?? intervention.metadata_json);
  const appliedRevision = hasAppliedRevisionMetadata(metadata);
  const letterFollowUp = resolveApprovalLetterFollowUpMetadata(metadata);
  const letterSentAt =
    letterFollowUp.approvalLetterSentAt ||
    letterFollowUp.approval_letter_sent_at ||
    letterFollowUp.sentAt ||
    letterFollowUp.sent_at ||
    letterFollowUp.completedAt ||
    letterFollowUp.completed_at ||
    null;
  const letterSent =
    Boolean(letterSentAt) ||
    normalizeWorkflowKey(letterFollowUp.status) === "sent" ||
    letterFollowUp.completed === true;
  const proposalId = normalizePositiveInteger(intervention.proposalId ?? intervention.proposal_id);
  const proposalReviewStatus = normalizeInterventionReviewStatus(
    intervention.proposalReviewStatus ?? intervention.proposal_review_status,
    null
  );
  const proposalKind = normalizeWorkflowKey(intervention.proposalKind ?? intervention.proposal_kind);
  const approvedProposalLinked =
    proposalId &&
    proposalReviewStatus === "approved" &&
    !isManualBackloadMetadata(metadata);

  if (!appliedRevision && !approvedProposalLinked) {
    return { eligible: false, isRevision: false };
  }

  const isRevision = appliedRevision || proposalKind === "revision";
  const applied = metadata.lastAppliedRevision && typeof metadata.lastAppliedRevision === "object"
    ? metadata.lastAppliedRevision
    : {};
  const title =
    applied.sourceTitle ||
    metadata.title ||
    intervention.title ||
    (intervention.code ? `Intervention ${intervention.code}` : "this approved intervention");

  return {
    eligible: true,
    isRevision,
    letterSent,
    letterSentAt,
    pendingLetter: !letterSent,
    sourceTitle: title,
    sourceInterventionId: intervention.id || intervention.intervention_id || null,
    sourceActionPlanId: intervention.actionPlanId || intervention.action_plan_id || null,
    sourceStatus: state.effectiveStatus || "approved",
  };
};

export const isInterventionApprovalLetterFollowUpEligible = intervention =>
  resolveInterventionApprovalLetterFollowUp(intervention).eligible;

export const isInterventionApprovalLetterFollowUpPending = intervention => {
  const followUp = resolveInterventionApprovalLetterFollowUp(intervention);
  return followUp.eligible && !followUp.letterSent;
};
