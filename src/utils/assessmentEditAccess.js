const normalizePositiveId = value => {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeWorkflowStage = value =>
  String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

export const canRegionalManagerEditApplicationAssessment = ({
  isRegionalManager,
  applicationStatus,
  reviewWorkflow,
  currentStaffProfileId,
} = {}) => {
  if (!isRegionalManager || String(applicationStatus || '').trim().toLowerCase() !== 'in_review') {
    return false;
  }

  if (!reviewWorkflow) {
    return true;
  }

  const reviewStage = normalizeWorkflowStage(
    reviewWorkflow.currentStage ?? reviewWorkflow.current_stage
  );
  if (reviewStage !== 'returned_to_submitter') {
    return false;
  }

  const submitterStaffProfileId = normalizePositiveId(
    reviewWorkflow.submittedByStaffProfileId ??
    reviewWorkflow.submitted_by_staff_profile_id
  );
  const activeStaffProfileId = normalizePositiveId(currentStaffProfileId);

  return Boolean(
    submitterStaffProfileId &&
    activeStaffProfileId &&
    submitterStaffProfileId === activeStaffProfileId
  );
};
