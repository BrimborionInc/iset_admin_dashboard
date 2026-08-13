const normalizePositiveId = value => {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeWorkflowStage = value =>
  String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const normalizeEligibility = value => String(value || '').trim().toLowerCase();

export const canPreserveReturnedAssessmentEligibility = ({
  reviewWorkflow,
  currentEligibility,
  initialEligibility,
} = {}) => {
  const reviewStage = normalizeWorkflowStage(
    reviewWorkflow?.currentStage ?? reviewWorkflow?.current_stage
  );
  const current = normalizeEligibility(currentEligibility);
  const initial = normalizeEligibility(initialEligibility);
  return Boolean(
    reviewStage === 'returned_to_submitter' &&
    current &&
    current === initial
  );
};

export const isReturnedAssessmentEligibilityChangeUnverified = ({
  reviewWorkflow,
  currentEligibility,
  initialEligibility,
  hasVerificationDocument = false,
  hasSelectedVerificationFile = false,
} = {}) => {
  const reviewStage = normalizeWorkflowStage(
    reviewWorkflow?.currentStage ?? reviewWorkflow?.current_stage
  );
  const current = normalizeEligibility(currentEligibility);
  const initial = normalizeEligibility(initialEligibility);
  return Boolean(
    reviewStage === 'returned_to_submitter' &&
    current !== initial &&
    !hasVerificationDocument &&
    !hasSelectedVerificationFile
  );
};

export const isCurrentApplicationAssessmentWorkflowSubmitter = ({
  reviewWorkflow,
  currentStaffProfileId,
} = {}) => {
  const submitterStaffProfileId = normalizePositiveId(
    reviewWorkflow?.submittedByStaffProfileId ??
    reviewWorkflow?.submitted_by_staff_profile_id
  );
  const activeStaffProfileId = normalizePositiveId(currentStaffProfileId);
  return Boolean(
    submitterStaffProfileId &&
    activeStaffProfileId &&
    submitterStaffProfileId === activeStaffProfileId
  );
};

export const canRegionalManagerEditApplicationAssessment = ({
  isRegionalManager,
  applicationStatus,
  reviewWorkflow,
  currentStaffProfileId,
  assignedStaffProfileId,
} = {}) => {
  const normalizedApplicationStatus = String(applicationStatus || '').trim().toLowerCase();
  if (!isRegionalManager || !['submitted', 'in_review'].includes(normalizedApplicationStatus)) {
    return false;
  }

  if (!reviewWorkflow) {
    if (normalizedApplicationStatus === 'submitted') {
      const activeStaffProfileId = normalizePositiveId(currentStaffProfileId);
      const assignedProfileId = normalizePositiveId(assignedStaffProfileId);
      return Boolean(
        activeStaffProfileId &&
        assignedProfileId &&
        activeStaffProfileId === assignedProfileId
      );
    }
    return true;
  }

  const reviewStage = normalizeWorkflowStage(
    reviewWorkflow.currentStage ?? reviewWorkflow.current_stage
  );
  if (reviewStage !== 'returned_to_submitter') {
    return false;
  }

  return isCurrentApplicationAssessmentWorkflowSubmitter({
    reviewWorkflow,
    currentStaffProfileId,
  });
};

export const canEditApplicationAssessmentBody = ({
  isAssessor,
  isRegionalManager,
  isSystemAdministrator,
  applicationStatus,
  reviewWorkflow,
  currentStaffProfileId,
  assignedStaffProfileId,
} = {}) => {
  if (isSystemAdministrator) {
    return true;
  }

  const reviewStage = normalizeWorkflowStage(
    reviewWorkflow?.currentStage ?? reviewWorkflow?.current_stage
  );
  if (reviewStage === 'returned_to_submitter') {
    return Boolean(
      (isAssessor || isRegionalManager) &&
      isCurrentApplicationAssessmentWorkflowSubmitter({
        reviewWorkflow,
        currentStaffProfileId,
      })
    );
  }

  if (isAssessor) {
    return true;
  }

  return canRegionalManagerEditApplicationAssessment({
    isRegionalManager,
    applicationStatus,
    reviewWorkflow,
    currentStaffProfileId,
    assignedStaffProfileId,
  });
};
