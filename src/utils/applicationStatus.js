import { isEligibilityPending, normalizeClosedStatus } from './applicationSla';

export const DECISION_READY_STATUS = 'decision_ready';

export const APPLICATION_FINAL_STATUSES = new Set([
  'decision_recorded',
  'approved',
  'completed',
  'rejected',
  'closed',
  'archived',
]);

export const APPLICATION_LOCKED_STATUSES = new Set([
  ...APPLICATION_FINAL_STATUSES,
  DECISION_READY_STATUS,
]);

export const POST_DECISION_APPLICATION_STATUSES = new Set([
  'decision_recorded',
  DECISION_READY_STATUS,
  'approved',
  'completed',
  'rejected',
]);

export const APPLICATION_PENDING_DECISION_STATUSES = new Set([
  'pending_approval',
  'pending_decision',
  DECISION_READY_STATUS,
]);

export const APPLICATION_STATUS_SYNONYMS = Object.freeze({
  complete: 'completed',
  withdrawn: 'closed',
  on_hold: 'on_hold',
  action_required: 'docs_requested',
  'action_required_(docs_requested)': 'docs_requested',
  assessed_pending_approval: 'pending_approval',
  'assessed,_pending_approval': 'pending_approval',
  assessment_submitted: 'pending_approval',
  assessment_submitted_pending_decision: 'pending_approval',
  declined: 'rejected',
  denied: 'rejected',
});

const DECISION_OUTCOME_SYNONYMS = Object.freeze({
  approve: 'approved',
  approved: 'approved',
  reject: 'denied',
  rejected: 'denied',
  denied: 'denied',
  decline: 'denied',
  declined: 'denied',
  deny: 'denied',
});

const APPROVED_CASE_DECISION_STATUSES = new Set([
  'initiated',
  'active',
  'dormant',
  'ready_to_close',
  'approved',
]);

const DENIED_CASE_DECISION_STATUSES = new Set(['rejected']);

export const APPLICATION_HOLD_AWAITING_REASONS = Object.freeze({
  on_hold: 'On hold',
  external_funding: 'External funding pending',
  future_start: 'Future program or school start',
  applicant_pause: 'Applicant requested pause',
  internal_follow_up: 'Internal follow-up needed',
  other_hold: 'Other hold reason',
});

export const APPLICATION_HOLD_AWAITING_REASON_KEYS = new Set(Object.keys(APPLICATION_HOLD_AWAITING_REASONS));

export const APPLICATION_STATUS_OPTIONS = Object.freeze([
  { label: 'Submitted', value: 'submitted' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Awaiting Applicant', value: 'awaiting_applicant' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Pending Decision', value: 'pending_decision' },
  { label: 'Closed', value: 'closed' },
  { label: 'Archived', value: 'archived' },
]);

export const APPLICATION_STATUS_LABEL_MAP = APPLICATION_STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

APPLICATION_STATUS_LABEL_MAP.withdrawn = 'Closed';
APPLICATION_STATUS_LABEL_MAP.cancelled = 'Closed';
APPLICATION_STATUS_LABEL_MAP.completed = 'Closed';
APPLICATION_STATUS_LABEL_MAP.docs_requested = 'Awaiting Applicant';
APPLICATION_STATUS_LABEL_MAP.closure_notice = 'Awaiting Applicant';
APPLICATION_STATUS_LABEL_MAP.pending_approval = 'Pending Decision';
APPLICATION_STATUS_LABEL_MAP[DECISION_READY_STATUS] = 'Pending Decision';
APPLICATION_STATUS_LABEL_MAP.approved = 'Decision Recorded';
APPLICATION_STATUS_LABEL_MAP.rejected = 'Decision Recorded';
APPLICATION_STATUS_LABEL_MAP.declined = 'Decision Recorded';
APPLICATION_STATUS_LABEL_MAP.denied = 'Decision Recorded';
APPLICATION_STATUS_LABEL_MAP.awaiting_applicant = 'Awaiting Applicant';
APPLICATION_STATUS_LABEL_MAP.on_hold = 'On Hold';
APPLICATION_STATUS_LABEL_MAP.pending_decision = 'Pending Decision';
APPLICATION_STATUS_LABEL_MAP.decision_recorded = 'Decision Recorded';

export function normalizeStatusKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function normalizeApplicationStatus(status, fallback = '') {
  const normalized = normalizeStatusKey(normalizeClosedStatus(status || ''));
  return APPLICATION_STATUS_SYNONYMS[normalized] || normalized || fallback;
}

export function normalizeDecisionOutcome(value, fallback = null) {
  const normalized = normalizeStatusKey(value);
  return DECISION_OUTCOME_SYNONYMS[normalized] || fallback;
}

export function getApplicationStatusLabel(status) {
  const normalized = normalizeApplicationStatus(status);
  if (!normalized) return 'Unknown';
  if (APPLICATION_STATUS_LABEL_MAP[normalized]) {
    return APPLICATION_STATUS_LABEL_MAP[normalized];
  }
  return normalized
    .split(/[_-]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getApplicationAwaitingReasonLabel(reason) {
  const normalized = normalizeStatusKey(reason);
  if (APPLICATION_HOLD_AWAITING_REASONS[normalized]) {
    return APPLICATION_HOLD_AWAITING_REASONS[normalized];
  }
  if (normalized === 'closure_response') return 'Closure response';
  if (normalized === 'documents') return 'Documents';
  if (normalized === 'information') return 'Information';
  return normalized
    ? normalized
        .split(/[_-]+/g)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : '';
}

export function deriveApplicationStatusFromState({
  applicationStatus,
  applicationLifecycleStatus,
  lifecycleStatus,
  decisionOutcome,
  awaitingReason,
  closureReason,
  caseStatus,
  reviewStatus,
} = {}) {
  const lifecycleKey = normalizeStatusKey(applicationLifecycleStatus || lifecycleStatus);
  const awaitingKey = normalizeStatusKey(awaitingReason);
  const explicitStatus = normalizeApplicationStatus(applicationStatus);
  const explicitDecision =
    normalizeDecisionOutcome(decisionOutcome) ||
    normalizeDecisionOutcome(reviewStatus);

  switch (lifecycleKey) {
    case 'submitted':
      return 'submitted';
    case 'in_review':
      return 'in_review';
    case 'awaiting_applicant':
      if (explicitStatus === 'on_hold' || APPLICATION_HOLD_AWAITING_REASON_KEYS.has(awaitingKey)) {
        return 'on_hold';
      }
      return 'awaiting_applicant';
    case 'pending_decision':
      return 'pending_decision';
    case 'decision_recorded':
      return 'decision_recorded';
    case 'closed':
      return 'closed';
    case 'archived':
      return 'archived';
    default:
      break;
  }

  switch (explicitStatus) {
    case 'submitted':
      return 'submitted';
    case 'in_review':
      return 'in_review';
    case 'on_hold':
      return 'on_hold';
    case 'docs_requested':
    case 'closure_notice':
      return 'awaiting_applicant';
    case 'pending_approval':
    case DECISION_READY_STATUS:
      return 'pending_decision';
    case 'approved':
    case 'rejected':
    case 'declined':
      return 'decision_recorded';
    case 'completed':
    case 'closed':
    case 'withdrawn':
    case 'cancelled':
      return 'closed';
    case 'archived':
      return 'archived';
    default:
      if (explicitDecision === 'approved') {
        return 'decision_recorded';
      }
      if (explicitDecision === 'denied') {
        return 'decision_recorded';
      }
      return null;
  }
}

export function deriveApplicationDecisionOutcome({
  applicationStatus,
  applicationLifecycleStatus,
  decisionOutcome,
  awaitingReason,
  closureReason,
  caseStatus,
  reviewStatus,
} = {}) {
  const explicitDecision =
    normalizeDecisionOutcome(decisionOutcome) ||
    normalizeDecisionOutcome(reviewStatus);
  if (explicitDecision) {
    return explicitDecision;
  }

  const normalizedApplicationStatus = normalizeApplicationStatus(applicationStatus);
  if (normalizedApplicationStatus === 'approved' || normalizedApplicationStatus === 'completed') {
    return 'approved';
  }
  if (['rejected', 'declined'].includes(normalizedApplicationStatus)) {
    return 'denied';
  }

  const statusKey = deriveApplicationStatusFromState({
    applicationStatus,
    applicationLifecycleStatus,
    decisionOutcome,
    awaitingReason,
    closureReason,
    caseStatus,
    reviewStatus,
  });
  if (!statusKey) {
    return null;
  }
  if (statusKey === 'decision_recorded') {
    const caseKey = normalizeStatusKey(caseStatus);
    if (APPROVED_CASE_DECISION_STATUSES.has(caseKey)) {
      return 'approved';
    }
    if (DENIED_CASE_DECISION_STATUSES.has(caseKey)) {
      return 'denied';
    }
    return null;
  }
  if (statusKey === 'approved' || statusKey === 'completed') {
    return 'approved';
  }
  if (statusKey === 'rejected') {
    return 'denied';
  }

  if (statusKey === DECISION_READY_STATUS) {
    const caseKey = normalizeStatusKey(caseStatus);
    if (APPROVED_CASE_DECISION_STATUSES.has(caseKey)) {
      return 'approved';
    }
    if (DENIED_CASE_DECISION_STATUSES.has(caseKey)) {
      return 'denied';
    }
  }

  return null;
}

export function deriveAssessmentReviewStatusSelection({
  assessmentReviewStatus,
  assessmentReview,
  applicationStatus,
  applicationLifecycleStatus,
  decisionOutcome,
  awaitingReason,
  closureReason,
  caseStatus,
} = {}) {
  const explicitStatus = normalizeStatusKey(assessmentReviewStatus);
  if (explicitStatus === 'approve' || explicitStatus === 'reject' || explicitStatus === 'push_back') {
    return explicitStatus;
  }

  const persistedOutcome = deriveApplicationDecisionOutcome({
    applicationStatus,
    applicationLifecycleStatus,
    decisionOutcome,
    awaitingReason,
    closureReason,
    caseStatus,
  });
  if (persistedOutcome === 'approved') {
    return 'approve';
  }
  if (persistedOutcome === 'denied') {
    return 'reject';
  }

  const assuranceStatus = normalizeStatusKey(assessmentReview);
  if (assuranceStatus === 'agree' || assuranceStatus === 'approve' || assuranceStatus === 'approved') {
    return 'approve';
  }
  if (assuranceStatus === 'disagree' || assuranceStatus === 'reject' || assuranceStatus === 'denied') {
    return 'reject';
  }

  return '';
}

const ASSESSMENT_RECOMMENDATION_DECISIONS = Object.freeze({
  recommend: 'approve',
  fund: 'approve',
  approve: 'approve',
  approved: 'approve',
  no_recommend: 'reject',
  do_not_fund: 'reject',
  reject: 'reject',
  rejected: 'reject',
  decline: 'reject',
  declined: 'reject',
  deny: 'reject',
  denied: 'reject',
});

const ASSESSMENT_DECISION_LABELS = Object.freeze({
  approve: 'Approve funding',
  reject: 'Deny funding',
});

const ASSESSMENT_RECOMMENDATION_LABELS = Object.freeze({
  recommend: 'Recommend funding',
  fund: 'Recommend funding',
  approve: 'Recommend funding',
  approved: 'Recommend funding',
  no_recommend: 'Do not recommend funding',
  do_not_fund: 'Do not recommend funding',
  reject: 'Do not recommend funding',
  rejected: 'Do not recommend funding',
  decline: 'Do not recommend funding',
  declined: 'Do not recommend funding',
  deny: 'Do not recommend funding',
  denied: 'Do not recommend funding',
});

export function deriveAssessmentDecisionStatusFromAgreement({ recommendation, assessmentReview } = {}) {
  const recommendationKey = normalizeStatusKey(recommendation);
  const reviewKey = normalizeStatusKey(assessmentReview);
  const recommendedDecision = ASSESSMENT_RECOMMENDATION_DECISIONS[recommendationKey] || null;
  if (!recommendedDecision) return null;
  if (reviewKey === 'agree') return recommendedDecision;
  if (reviewKey === 'disagree') return recommendedDecision === 'approve' ? 'reject' : 'approve';
  return null;
}

export function buildAssessmentDecisionAlignmentError({
  recommendation,
  assessmentReview,
  decisionStatus,
} = {}) {
  const decisionKey = normalizeStatusKey(decisionStatus);
  if (!decisionKey || decisionKey === 'push_back') return '';

  const recommendationKey = normalizeStatusKey(recommendation);
  const reviewKey = normalizeStatusKey(assessmentReview);
  const recommendedDecision = ASSESSMENT_RECOMMENDATION_DECISIONS[recommendationKey] || null;
  if (!recommendedDecision || (reviewKey !== 'agree' && reviewKey !== 'disagree')) return '';

  const expectedDecision = deriveAssessmentDecisionStatusFromAgreement({ recommendation, assessmentReview });
  if (!expectedDecision || expectedDecision === decisionKey) return '';

  const recommendationLabel =
    ASSESSMENT_RECOMMENDATION_LABELS[recommendationKey] || 'the case manager recommendation';
  const expectedLabel = ASSESSMENT_DECISION_LABELS[expectedDecision] || expectedDecision;
  const reviewPhrase = reviewKey === 'agree' ? 'agree with' : 'do not agree with';

  return `This outcome conflicts with your agreement answer. You selected that you ${reviewPhrase} "${recommendationLabel}", so the funding outcome must be "${expectedLabel}" or you should request changes.`;
}

export function resolveApplicationStateFields(record = {}, { fallbackStatus = null } = {}) {
  const applicationStatus = record?.applicationStatus ?? record?.application_status ?? null;
  const applicationLifecycleStatus =
    record?.applicationLifecycleStatus ?? record?.application_lifecycle_status ?? null;
  const decisionOutcome = record?.decisionOutcome ?? record?.decision_outcome ?? null;
  const awaitingReason =
    record?.applicationAwaitingReason ?? record?.application_awaiting_reason ?? null;
  const closureReason =
    record?.applicationClosureReason ?? record?.application_closure_reason ?? null;
  const caseStatus = record?.caseStatus ?? record?.case_status ?? record?.status ?? null;
  const reviewStatus = record?.reviewStatus ?? record?.review_status ?? null;
  const resolvedStatus =
    deriveApplicationStatusFromState({
      applicationStatus,
      applicationLifecycleStatus,
      decisionOutcome,
      awaitingReason,
      closureReason,
      caseStatus,
      reviewStatus,
    }) ||
    normalizeApplicationStatus(applicationStatus, '') ||
    normalizeApplicationStatus(fallbackStatus, '') ||
    null;
  const resolvedDecisionOutcome = deriveApplicationDecisionOutcome({
    applicationStatus: resolvedStatus || applicationStatus,
    applicationLifecycleStatus,
    decisionOutcome,
    awaitingReason,
    closureReason,
    caseStatus,
    reviewStatus,
  });

  return {
    applicationStatus: resolvedStatus,
    application_status: resolvedStatus,
    applicationLifecycleStatus: applicationLifecycleStatus || null,
    application_lifecycle_status: applicationLifecycleStatus || null,
    decisionOutcome: resolvedDecisionOutcome,
    decision_outcome: resolvedDecisionOutcome,
    applicationAwaitingReason: awaitingReason || null,
    application_awaiting_reason: awaitingReason || null,
    applicationClosureReason: closureReason || null,
    application_closure_reason: closureReason || null,
  };
}

export function mapWorkflowStatusToPersistenceStatus(
  status,
  { currentStatus = null, awaitingReason = null, decisionOutcome = null } = {}
) {
  const normalizedStatus = normalizeApplicationStatus(status);
  const currentKey = normalizeApplicationStatus(currentStatus);
  const awaitingKey = normalizeStatusKey(awaitingReason);
  const decisionKey = normalizeDecisionOutcome(decisionOutcome);

  switch (normalizedStatus) {
    case 'on_hold':
      return 'on_hold';
    case 'awaiting_applicant':
      if (awaitingKey === 'closure_response' || currentKey === 'closure_notice') {
        return 'closure_notice';
      }
      return 'docs_requested';
    case 'pending_decision':
      return 'pending_approval';
    case 'decision_recorded':
      if (decisionKey === 'approved' || currentKey === 'approved' || currentKey === 'completed') {
        return 'approved';
      }
      if (decisionKey === 'denied' || currentKey === 'rejected' || currentKey === 'declined') {
        return 'rejected';
      }
      return DECISION_READY_STATUS;
    default:
      return normalizedStatus || null;
  }
}

export function getApplicationStatusIndicatorType(
  status,
  { isUnassigned = false, eligibilityMissing = false, decisionOutcome = null } = {}
) {
  const statusKey = normalizeApplicationStatus(status);
  const decisionKey = normalizeDecisionOutcome(decisionOutcome);
  if (statusKey === 'decision_recorded') {
    if (decisionKey === 'approved') return 'success';
    if (decisionKey === 'denied') return 'error';
    return 'info';
  }
  if (statusKey === 'approved' || statusKey === 'completed') return 'success';
  if (statusKey === 'rejected') return 'error';
  if (['closed', 'cancelled', 'archived'].includes(statusKey)) return 'info';
  if (eligibilityMissing) return 'warning';
  if (statusKey === 'on_hold') return 'warning';
  if (['awaiting_applicant', 'docs_requested', 'closure_notice'].includes(statusKey)) return 'warning';
  return isUnassigned || statusKey === 'new' ? 'pending' : 'info';
}

export function getApplicationStatusBadgeColor(
  status,
  { isUnassigned = false, eligibilityMissing = false, decisionOutcome = null } = {}
) {
  const statusKey = normalizeApplicationStatus(status);
  const decisionKey = normalizeDecisionOutcome(decisionOutcome);
  if (statusKey === 'decision_recorded') {
    if (decisionKey === 'approved') return 'green';
    if (decisionKey === 'denied') return 'red';
    return 'blue';
  }
  if (statusKey === 'approved' || statusKey === 'completed') return 'green';
  if (statusKey === 'rejected') return 'red';
  if (['closed', 'inactive', 'archived', 'cancelled'].includes(statusKey)) return 'grey';
  if (statusKey === 'on_hold') return 'severity-medium';
  if (eligibilityMissing || ['awaiting_applicant', 'docs_requested', 'closure_notice'].includes(statusKey)) {
    return 'severity-high';
  }
  if (
    [
      'submitted',
      'in_review',
      'pending_decision',
      'pending_approval',
      DECISION_READY_STATUS,
      'ready_to_close',
    ].includes(statusKey)
  ) {
    return 'blue';
  }
  return isUnassigned ? 'grey' : 'grey';
}

export function buildApplicationStatusInfo({
  applicationStatus,
  applicationLifecycleStatus,
  caseStatus,
  caseId,
  assignedUserId,
  assessmentEligibility,
  decisionOutcome,
  awaitingReason,
  closureReason,
  reviewStatus,
  type,
  includeEligibilityQualifier = true,
  includeUnassignedQualifier = true,
} = {}) {
  const fallbackStatus = caseId ? 'submitted' : 'new';
  const rawStatus = deriveApplicationStatusFromState({
    applicationStatus,
    applicationLifecycleStatus,
    decisionOutcome,
    awaitingReason,
    closureReason,
    caseStatus,
    reviewStatus,
  }) || fallbackStatus;
  const resolvedDecisionOutcome = deriveApplicationDecisionOutcome({
    applicationStatus: rawStatus,
    applicationLifecycleStatus,
    decisionOutcome,
    awaitingReason,
    closureReason,
    caseStatus,
    reviewStatus,
  });
  const isUnassignedCase = Boolean(caseId) && !assignedUserId && rawStatus === 'submitted';
  const isInterventionApproval = type === 'InterventionApproval' || type === 'Intervention';
  const eligibilityMissing =
    includeEligibilityQualifier &&
    !isInterventionApproval &&
    isEligibilityPending(assessmentEligibility) &&
    ['submitted', 'in_review', 'awaiting_applicant', 'pending_decision'].includes(rawStatus);
  const qualifiers = [];
  const awaitingKey = normalizeStatusKey(awaitingReason);
  const closureKey = normalizeStatusKey(closureReason);
  if (includeUnassignedQualifier && isUnassignedCase) {
    qualifiers.push('Unassigned');
  }
  if (rawStatus === 'awaiting_applicant') {
    if (awaitingKey === 'closure_response') {
      qualifiers.push('Closure Response');
    } else if (awaitingKey === 'information') {
      qualifiers.push('Information');
    } else {
      qualifiers.push('Documents');
    }
  }
  if (rawStatus === 'on_hold') {
    const holdLabel = getApplicationAwaitingReasonLabel(awaitingKey);
    if (holdLabel && holdLabel !== 'On hold') {
      qualifiers.push(holdLabel);
    }
  }
  if (rawStatus === 'decision_recorded') {
    if (resolvedDecisionOutcome === 'approved') {
      qualifiers.push('Approved');
    } else if (resolvedDecisionOutcome === 'denied') {
      qualifiers.push('Denied');
    }
  }
  if (rawStatus === 'closed' && closureKey === 'withdrawn') {
    qualifiers.push('Withdrawn');
  }
  if (eligibilityMissing) {
    qualifiers.push('Awaiting EI Validation');
  }
  const baseLabel = getApplicationStatusLabel(rawStatus);
  const statusLabel = qualifiers.length ? `${baseLabel} • ${qualifiers.join(' • ')}` : baseLabel;
  return {
    rawStatus,
    statusLabel,
    statusType: getApplicationStatusIndicatorType(rawStatus, {
      isUnassigned: isUnassignedCase,
      eligibilityMissing,
      decisionOutcome: resolvedDecisionOutcome,
    }),
    badgeColor: getApplicationStatusBadgeColor(rawStatus, {
      isUnassigned: isUnassignedCase,
      eligibilityMissing,
      decisionOutcome: resolvedDecisionOutcome,
    }),
    decisionOutcome: resolvedDecisionOutcome,
    eligibilityMissing,
    isUnassignedCase,
  };
}
