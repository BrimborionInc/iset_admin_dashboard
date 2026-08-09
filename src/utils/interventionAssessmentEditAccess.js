const normalizePositiveId = value => {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeKey = value =>
  String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

const normalizeWorkflowStage = value =>
  String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const SUBMITTER_ROLE_KEYS = new Set(['isetcoordinator', 'regionalmanager']);

export const canEditInterventionAssessmentBody = ({
  role,
  reviewStatus,
  reviewWorkflow,
  createdByStaffProfileId,
  currentStaffProfileId,
  hasExistingIntervention = false,
  hasBlockingProposal = false,
} = {}) => {
  const roleKey = normalizeKey(role);
  const statusKey = normalizeKey(reviewStatus);
  const activeStaffProfileId = normalizePositiveId(currentStaffProfileId);
  const isSystemAdministrator = roleKey === 'systemadministrator';

  if (!SUBMITTER_ROLE_KEYS.has(roleKey) && !isSystemAdministrator) {
    return false;
  }

  if (!statusKey) {
    return !hasExistingIntervention && !hasBlockingProposal;
  }

  if (statusKey === 'draft') {
    if (isSystemAdministrator) return true;
    return Boolean(
      hasExistingIntervention &&
      activeStaffProfileId &&
      activeStaffProfileId === normalizePositiveId(createdByStaffProfileId)
    );
  }

  if (statusKey !== 'changesrequested') {
    return false;
  }

  const workflowStage = normalizeWorkflowStage(
    reviewWorkflow?.currentStage ?? reviewWorkflow?.current_stage
  );
  if (!reviewWorkflow || workflowStage !== 'returned_to_submitter') {
    return false;
  }

  if (isSystemAdministrator) return true;

  const recordedSubmitterStaffProfileId = normalizePositiveId(
    reviewWorkflow?.submittedByStaffProfileId ??
    reviewWorkflow?.submitted_by_staff_profile_id
  );
  return Boolean(
    activeStaffProfileId &&
    recordedSubmitterStaffProfileId &&
    activeStaffProfileId === recordedSubmitterStaffProfileId
  );
};

export const canRecallInterventionAssessmentSubmission = ({
  role,
  reviewWorkflow,
  createdByStaffProfileId,
  currentStaffProfileId,
} = {}) => {
  const roleKey = normalizeKey(role);
  const activeStaffProfileId = normalizePositiveId(currentStaffProfileId);
  const isSystemAdministrator = roleKey === 'systemadministrator';
  if (!SUBMITTER_ROLE_KEYS.has(roleKey) && !isSystemAdministrator) {
    return false;
  }

  if (reviewWorkflow) {
    const workflowStage = normalizeWorkflowStage(
      reviewWorkflow.currentStage ?? reviewWorkflow.current_stage
    );
    if (workflowStage !== 'rm_review') return false;
    if (isSystemAdministrator) return true;
    const recordedSubmitterStaffProfileId = normalizePositiveId(
      reviewWorkflow.submittedByStaffProfileId ??
      reviewWorkflow.submitted_by_staff_profile_id
    );
    return Boolean(
      activeStaffProfileId &&
      recordedSubmitterStaffProfileId &&
      activeStaffProfileId === recordedSubmitterStaffProfileId
    );
  }

  if (isSystemAdministrator) return true;
  return Boolean(
    activeStaffProfileId &&
    activeStaffProfileId === normalizePositiveId(createdByStaffProfileId)
  );
};
