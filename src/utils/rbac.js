import {
  APPLICATION_FINAL_STATUSES,
  APPLICATION_PENDING_DECISION_STATUSES,
  normalizeApplicationStatus,
} from './applicationStatus';
import { CASE_FINAL_STATUSES, normalizeCaseStatus } from './caseStatus';

const PROGRAM_ADMIN_ROLE_VALUES = Object.freeze(['nwac administrator']);
const SYSTEM_ADMIN_ROLE_VALUES = Object.freeze(['system administrator']);
const ADMIN_ROLE_VALUES = Object.freeze([...PROGRAM_ADMIN_ROLE_VALUES, ...SYSTEM_ADMIN_ROLE_VALUES]);
const REGIONAL_COORDINATOR_ROLE_VALUES = Object.freeze(['regional manager']);
const APPLICATION_ASSESSOR_ROLE_VALUES = Object.freeze(['iset coordinator']);
const OUTCOME_REVIEW_ROLE_VALUES = Object.freeze([
  ...ADMIN_ROLE_VALUES,
]);

const ADMIN_ROLES = new Set(ADMIN_ROLE_VALUES);
const SYSTEM_ADMIN_ROLES = new Set(SYSTEM_ADMIN_ROLE_VALUES);
const REGIONAL_COORDINATOR_ROLES = new Set(REGIONAL_COORDINATOR_ROLE_VALUES);
const APPLICATION_ASSESSOR_ROLES = new Set(APPLICATION_ASSESSOR_ROLE_VALUES);
const OUTCOME_REVIEW_ROLES = new Set(OUTCOME_REVIEW_ROLE_VALUES);

const REGIONAL_COORDINATOR_ALLOWED_TRANSITIONS = Object.freeze({
  intake: new Set(['initiated', 'archived']),
  initiated: new Set(['active', 'dormant', 'archived']),
  active: new Set(['dormant', 'ready_to_close', 'archived']),
  dormant: new Set(['active', 'ready_to_close', 'archived']),
  ready_to_close: new Set(['closed', 'archived']),
  closed: new Set(['archived']),
});

const APPLICATION_ASSESSOR_ALLOWED_TRANSITIONS = Object.freeze({
  intake: new Set(),
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

export function getRoleGroups(role) {
  const normalizedRole = canonicalizeRole(role);
  return {
    normalizedRole,
    isAdminRole: ADMIN_ROLES.has(normalizedRole),
    isSystemAdministratorRole: SYSTEM_ADMIN_ROLES.has(normalizedRole),
    isRegionalCoordinatorRole: REGIONAL_COORDINATOR_ROLES.has(normalizedRole),
    isApplicationAssessorRole: APPLICATION_ASSESSOR_ROLES.has(normalizedRole),
    isOutcomeReviewerRole: OUTCOME_REVIEW_ROLES.has(normalizedRole),
  };
}

export function getCaseStatusContext(status) {
  const canonicalStatus = normalizeCaseStatus(status);
  return {
    canonicalStatus,
    isFinalStatus: CASE_FINAL_STATUSES.has(canonicalStatus),
    isIntakeStatus: canonicalStatus === 'intake',
  };
}

export function getApplicationStatusContext(status) {
  const canonicalStatus = normalizeApplicationStatus(status);
  return {
    canonicalStatus,
    isFinalStatus: APPLICATION_FINAL_STATUSES.has(canonicalStatus),
    isPendingApprovalStatus: APPLICATION_PENDING_DECISION_STATUSES.has(canonicalStatus),
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
  const fromKey = normalizeCaseStatus(fromStatus);
  const toKey = normalizeCaseStatus(toStatus);

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
  if (CASE_FINAL_STATUSES.has(fromKey)) return false;
  if (CASE_FINAL_STATUSES.has(toKey)) return false;
  return true;
}

export function canEditApplicationStatus({ role, status, hasCase }) {
  if (!hasCase) return false;
  const { isAdminRole } = getRoleGroups(role);
  if (isAdminRole) return true;
  const { isFinalStatus } = getApplicationStatusContext(status);
  return !isFinalStatus;
}

export function isApplicationStatusTransitionAllowed({ role, fromStatus, toStatus }) {
  const { isAdminRole } = getRoleGroups(role);
  const fromKey = normalizeApplicationStatus(fromStatus);
  const toKey = normalizeApplicationStatus(toStatus);
  if (!fromKey || !toKey) return false;
  if (fromKey === toKey) return true;
  if (isAdminRole) return true;
  return false;
}

export function canCompleteOutcomeReview({ role, status }) {
  const { isOutcomeReviewerRole } = getRoleGroups(role);
  if (!isOutcomeReviewerRole) return false;
  const { isPendingApprovalStatus } = getApplicationStatusContext(status);
  return isPendingApprovalStatus;
}

export function requiresFinalStatusConfirmation({ role, currentStatus }) {
  const { isAdminRole } = getRoleGroups(role);
  const { isFinalStatus } = getCaseStatusContext(currentStatus);
  return isAdminRole && isFinalStatus;
}

export function requiresFinalApplicationStatusConfirmation({ role, currentStatus }) {
  const { isAdminRole } = getRoleGroups(role);
  const { isFinalStatus } = getApplicationStatusContext(currentStatus);
  return isAdminRole && isFinalStatus;
}

export const RBAC_CONSTANTS = Object.freeze({
  PROGRAM_ADMIN_ROLE_VALUES,
  SYSTEM_ADMIN_ROLE_VALUES,
  ADMIN_ROLE_VALUES,
  REGIONAL_COORDINATOR_ROLE_VALUES,
  APPLICATION_ASSESSOR_ROLE_VALUES,
  OUTCOME_REVIEW_ROLE_VALUES,
  FINAL_CASE_STATUSES: CASE_FINAL_STATUSES,
});
