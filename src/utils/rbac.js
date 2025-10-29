const ADMIN_ROLE_VALUES = Object.freeze(['program administrator', 'system administrator']);
const REGIONAL_COORDINATOR_ROLE_VALUES = Object.freeze(['regional coordinator']);
const APPLICATION_ASSESSOR_ROLE_VALUES = Object.freeze(['application assessor']);
const OUTCOME_REVIEW_ROLE_VALUES = Object.freeze([
  ...ADMIN_ROLE_VALUES,
  'regional coordinator',
  'nwac reviewer',
  'nwac assessment reviewer',
  'nwac outcome reviewer',
]);

const ADMIN_ROLES = new Set(ADMIN_ROLE_VALUES);
const REGIONAL_COORDINATOR_ROLES = new Set(REGIONAL_COORDINATOR_ROLE_VALUES);
const APPLICATION_ASSESSOR_ROLES = new Set(APPLICATION_ASSESSOR_ROLE_VALUES);
const OUTCOME_REVIEW_ROLES = new Set(OUTCOME_REVIEW_ROLE_VALUES);

const FINAL_CASE_STATUSES = new Set(['ready_to_close', 'closed', 'archived', 'withdrawn', 'rejected']);
const APPLICATION_FINAL_STATUSES = new Set(['approved', 'completed', 'rejected', 'withdrawn', 'archived']);

const STATUS_SYNONYMS = Object.freeze({
  action_required: 'docs_requested',
  'action_required_(docs_requested)': 'docs_requested',
  assessed_pending_approval: 'pending_approval',
  'assessed,_pending_approval': 'pending_approval',
  approved: 'initiated',
  review_complete: 'ready_to_close',
  assessment_submitted: 'pending_approval',
  assessment_submitted_pending_decision: 'pending_approval',
  in_review: 'pending_approval',
  submitted: 'pending_approval',
  rejected: 'archived',
});

const REGIONAL_COORDINATOR_ALLOWED_TRANSITIONS = Object.freeze({
  pending_approval: new Set(['initiated', 'archived']),
  initiated: new Set(['active', 'dormant', 'archived']),
  active: new Set(['dormant', 'ready_to_close', 'archived']),
  dormant: new Set(['active', 'ready_to_close', 'archived']),
  ready_to_close: new Set(['closed', 'archived']),
  closed: new Set(['archived']),
});

const APPLICATION_ASSESSOR_ALLOWED_TRANSITIONS = Object.freeze({
  pending_approval: new Set(),
  initiated: new Set(),
  active: new Set(),
  dormant: new Set(),
  ready_to_close: new Set(),
});

export function canonicalizeRole(role) {
  return (role || '').toString().trim().toLowerCase();
}

export function canonicalizeStatus(status) {
  return (status || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function normalizeStatusKey(status) {
  const canonical = canonicalizeStatus(status);
  return STATUS_SYNONYMS[canonical] || canonical;
}

export function getRoleGroups(role) {
  const normalizedRole = canonicalizeRole(role);
  return {
    normalizedRole,
    isAdminRole: ADMIN_ROLES.has(normalizedRole),
    isRegionalCoordinatorRole: REGIONAL_COORDINATOR_ROLES.has(normalizedRole),
    isApplicationAssessorRole: APPLICATION_ASSESSOR_ROLES.has(normalizedRole),
    isOutcomeReviewerRole: OUTCOME_REVIEW_ROLES.has(normalizedRole),
  };
}

export function getCaseStatusContext(status) {
  const canonicalStatus = normalizeStatusKey(status);
  return {
    canonicalStatus,
    isFinalStatus: FINAL_CASE_STATUSES.has(canonicalStatus),
    isPendingApprovalStatus: canonicalStatus === 'pending_approval',
  };
}

export function getApplicationStatusContext(status) {
  const canonicalStatus = canonicalizeStatus(status);
  return {
    canonicalStatus,
    isFinalStatus: APPLICATION_FINAL_STATUSES.has(canonicalStatus),
    isPendingApprovalStatus: canonicalStatus === 'pending_approval',
  };
}

export function canEditCaseStatus({ role, status, hasCase }) {
  if (!hasCase) return false;
  const { isAdminRole, isApplicationAssessorRole, isRegionalCoordinatorRole } = getRoleGroups(role);
  const { canonicalStatus, isFinalStatus } = getCaseStatusContext(status);

  if (isAdminRole) return true;
  if (isRegionalCoordinatorRole) {
    const allowed = REGIONAL_COORDINATOR_ALLOWED_TRANSITIONS[canonicalStatus];
    return Boolean(allowed && allowed.size > 0);
  }
  if (isApplicationAssessorRole) {
    const allowed = APPLICATION_ASSESSOR_ALLOWED_TRANSITIONS[canonicalStatus];
    return Boolean(allowed && allowed.size > 0);
  }
  return !isFinalStatus;
}

export function isStatusTransitionAllowed({ role, fromStatus, toStatus }) {
  const { isAdminRole, isRegionalCoordinatorRole, isApplicationAssessorRole } = getRoleGroups(role);
  const fromKey = normalizeStatusKey(fromStatus);
  const toKey = normalizeStatusKey(toStatus);

  if (!fromKey || !toKey) return false;
  if (fromKey === toKey) return true;

  if (isAdminRole) return true;

  if (isRegionalCoordinatorRole) {
    const allowed = REGIONAL_COORDINATOR_ALLOWED_TRANSITIONS[fromKey];
    return Boolean(allowed && allowed.has(toKey));
  }

  if (isApplicationAssessorRole) {
    const allowed = APPLICATION_ASSESSOR_ALLOWED_TRANSITIONS[fromKey];
    return Boolean(allowed && allowed.has(toKey));
  }

  // Default behaviour: disallow changing final statuses and transitions to final states
  if (FINAL_CASE_STATUSES.has(fromKey)) return false;
  if (FINAL_CASE_STATUSES.has(toKey)) return false;
  return true;
}

export function canCompleteOutcomeReview({ role, status }) {
  const { isOutcomeReviewerRole } = getRoleGroups(role);
  if (!isOutcomeReviewerRole) return false;
  const { isPendingApprovalStatus } = getCaseStatusContext(status);
  return isPendingApprovalStatus;
}

export function requiresFinalStatusConfirmation({ role, currentStatus }) {
  const { isAdminRole } = getRoleGroups(role);
  const { isFinalStatus } = getCaseStatusContext(currentStatus);
  return isAdminRole && isFinalStatus;
}

export const RBAC_CONSTANTS = Object.freeze({
  ADMIN_ROLE_VALUES,
  REGIONAL_COORDINATOR_ROLE_VALUES,
  APPLICATION_ASSESSOR_ROLE_VALUES,
  OUTCOME_REVIEW_ROLE_VALUES,
  FINAL_CASE_STATUSES,
});
