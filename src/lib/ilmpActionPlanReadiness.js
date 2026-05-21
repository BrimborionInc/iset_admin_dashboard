const ACTION_PLAN_REQUIRED_MESSAGE =
  'At least one action plan must be active/closed for ESDC; draft action plans are ignored for ILMP.';
const NO_REPORTABLE_INTERVENTIONS_MESSAGE =
  'Linked intervention records exist, but none are in an ILMP-reportable delivery status yet.';
const NO_REPORTABLE_INTERVENTIONS_FUTURE_MESSAGE =
  'Linked intervention records exist, but they are not ILMP-reportable while the action plan is future-dated or still planned.';

function normaliseIlmpPlanStatus(status) {
  return status ? String(status).trim().toLowerCase() : '';
}

function summariseIlmpActionPlanStatuses(plans) {
  const planList = Array.isArray(plans) ? plans : [];
  let draftCount = 0;
  let reportableCount = 0;
  let activePlans = 0;

  planList.forEach(plan => {
    const status = normaliseIlmpPlanStatus(plan?.status);
    if (status === 'draft') {
      draftCount += 1;
      return;
    }
    if (!status) return;
    reportableCount += 1;
    if (status === 'active') activePlans += 1;
  });

  return {
    total: planList.length,
    draftCount,
    reportableCount,
    hasReportablePlan: reportableCount > 0,
    activePlans
  };
}

function getIlmpActionPlanReadinessWarning(plans) {
  const summary = summariseIlmpActionPlanStatuses(plans);
  if (summary.hasReportablePlan) return null;
  return {
    summary,
    ruleResult: {
      id: 'actionplan-required',
      label: 'Action plan',
      category: 'mandatory',
      severity: 'warning',
      passed: false,
      message: ACTION_PLAN_REQUIRED_MESSAGE,
      detail: summary.total
    }
  };
}

function getNoReportableInterventionsMessage({ planStartIsFuture = false } = {}) {
  return planStartIsFuture
    ? NO_REPORTABLE_INTERVENTIONS_FUTURE_MESSAGE
    : NO_REPORTABLE_INTERVENTIONS_MESSAGE;
}

module.exports = {
  ACTION_PLAN_REQUIRED_MESSAGE,
  NO_REPORTABLE_INTERVENTIONS_FUTURE_MESSAGE,
  NO_REPORTABLE_INTERVENTIONS_MESSAGE,
  getIlmpActionPlanReadinessWarning,
  getNoReportableInterventionsMessage,
  normaliseIlmpPlanStatus,
  summariseIlmpActionPlanStatuses
};
