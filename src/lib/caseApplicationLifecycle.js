const CASE_LEVEL_REPORTING_CONTEXT_KEYS = Object.freeze([
  'reportingOnlyDenied',
  'reportingOnlyDeniedIneligible',
  'reportingOnlyWithdrawal',
  'reportingCorrectionAllowed',
  'excludeFromCaseworkQueues',
  'reportingTrigger',
  'reportingSeedSource',
  'reportingSeededAt',
  'reportingLastSyncedAt',
  'reportingDeniedAt',
  'reportingWithdrawnAt',
  'reportingDate',
  'applicationId',
  'applicationAnswers',
  'applicationPersonal',
  'fundingDecisionReasonCode',
  'fundingDecisionReasonLabel',
  'fundingDecisionReasonExplanation',
  'firstName',
  'lastName',
  'preferredName',
  'gender',
  'sin',
  'socialInsuranceNumber',
  'dateOfBirth',
  'indigenousIdentity',
  'address',
  'emailPrimary',
  'phonePrimary',
  'phoneAlt',
  'mailingAddress',
  'homeCommunity',
  'languageSpoken',
  'visibleMinority',
  'maritalStatus',
  'dependentChildren',
  'agesOfChildren',
  'hasDisability',
  'disabilityDescription',
  'employmentStatus',
  'labourForceStatus',
  'socialAssistance',
  'employmentNoc',
  'employmentNocVersion',
  'prevEmployment',
]);

const TERMINAL_CASE_STATES = new Set(['closed', 'archived']);
const CASE_LEVEL_REPORTING_STATE_KEYS = new Set([
  'reportingOnlyDenied',
  'reportingOnlyDeniedIneligible',
  'reportingOnlyWithdrawal',
  'reportingCorrectionAllowed',
  'excludeFromCaseworkQueues',
  'reportingTrigger',
  'reportingSeedSource',
]);

function parseCaseContext(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value };
  }
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (_) {
    return {};
  }
}

function normalizeState(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function clearCaseLevelReportingContext(value) {
  const originalContext = parseCaseContext(value);
  const nextContext = { ...originalContext };
  const contextHadCaseLevelReporting = CASE_LEVEL_REPORTING_CONTEXT_KEYS.some(key =>
    CASE_LEVEL_REPORTING_STATE_KEYS.has(key) &&
    Object.prototype.hasOwnProperty.call(nextContext, key)
  );

  CASE_LEVEL_REPORTING_CONTEXT_KEYS.forEach(key => {
    delete nextContext[key];
  });

  return {
    contextHadCaseLevelReporting,
    contextChanged: JSON.stringify(nextContext) !== JSON.stringify(originalContext),
    caseContext: nextContext,
  };
}

function prepareCaseForNewApplication(caseRow = {}) {
  const contextResult = clearCaseLevelReportingContext(
    caseRow.case_context_json ?? caseRow.caseContext
  );

  const status = normalizeState(caseRow.status);
  const lifecycleStatus = normalizeState(caseRow.lifecycle_status ?? caseRow.lifecycleStatus);
  const shouldReopen =
    TERMINAL_CASE_STATES.has(status) ||
    TERMINAL_CASE_STATES.has(lifecycleStatus);

  return {
    ...contextResult,
    shouldReopen,
  };
}

module.exports = {
  CASE_LEVEL_REPORTING_CONTEXT_KEYS,
  clearCaseLevelReportingContext,
  prepareCaseForNewApplication,
};
