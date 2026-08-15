function normalisePositiveInteger(value) {
  if (value === null || typeof value === 'undefined') return null;
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return null;
  const int = Math.trunc(asNumber);
  return int > 0 ? int : null;
}

function chooseIlmpApplicationId({
  submissionApplicationId = null,
  actionPlanApplicationId = null,
  uniqueCaseApplicationId = null,
} = {}) {
  const submissionId = normalisePositiveInteger(submissionApplicationId);
  const planId = normalisePositiveInteger(actionPlanApplicationId);
  if (submissionId && planId && submissionId !== planId) {
    const error = new Error('ilmp_application_scope_mismatch');
    error.code = 'ilmp_application_scope_mismatch';
    error.statusCode = 409;
    throw error;
  }
  return submissionId || planId || normalisePositiveInteger(uniqueCaseApplicationId) || null;
}

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mergeIlmpAnswers({ caseContext = {}, applicationPayload = {} } = {}) {
  const caseAnswers = asPlainObject(asPlainObject(caseContext).applicationAnswers);
  const applicationAnswers = asPlainObject(asPlainObject(applicationPayload).answers);
  return {
    ...caseAnswers,
    ...applicationAnswers,
  };
}

module.exports = {
  chooseIlmpApplicationId,
  mergeIlmpAnswers,
  normalisePositiveInteger,
};
