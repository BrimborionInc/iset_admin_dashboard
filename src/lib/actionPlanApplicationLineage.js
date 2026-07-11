function positiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function resolveActionPlanApplicationLineage({
  caseId,
  requestedApplicationId = null,
  primaryApplicationId = null,
  applicationCaseId = null,
} = {}) {
  const normalizedCaseId = positiveInteger(caseId);
  const normalizedRequestedId = positiveInteger(requestedApplicationId);
  const normalizedPrimaryId = positiveInteger(primaryApplicationId);
  const applicationId = normalizedRequestedId || normalizedPrimaryId || null;

  if (!normalizedCaseId) {
    const error = new Error('A valid case is required for action-plan application lineage.');
    error.code = 'invalid_case_id';
    error.statusCode = 400;
    throw error;
  }
  if (!applicationId) return null;

  const normalizedApplicationCaseId = positiveInteger(applicationCaseId);
  if (!normalizedApplicationCaseId || normalizedApplicationCaseId !== normalizedCaseId) {
    const error = new Error('The selected application does not belong to this case.');
    error.code = 'action_plan_application_case_mismatch';
    error.statusCode = 409;
    throw error;
  }
  return applicationId;
}

module.exports = {
  resolveActionPlanApplicationLineage,
};
