const {
  ACTION_PLAN_REQUIRED_MESSAGE,
  getIlmpActionPlanReadinessWarning,
  summariseIlmpActionPlanStatuses,
} = require('../ilmpActionPlanReadiness');

describe('ilmpActionPlanReadiness', () => {
  test('does not warn when an active action plan exists beside a draft plan', () => {
    const plans = [
      { id: 5, status: 'active' },
      { id: 6, status: 'draft' },
    ];

    expect(getIlmpActionPlanReadinessWarning(plans)).toBeNull();
    expect(summariseIlmpActionPlanStatuses(plans)).toMatchObject({
      draftCount: 1,
      reportableCount: 1,
      hasReportablePlan: true,
      activePlans: 1,
    });
  });

  test('warns when only draft action plans exist', () => {
    const warning = getIlmpActionPlanReadinessWarning([{ id: 6, status: 'draft' }]);

    expect(warning.ruleResult).toMatchObject({
      id: 'actionplan-required',
      severity: 'warning',
      message: ACTION_PLAN_REQUIRED_MESSAGE,
      detail: 1,
    });
  });
});
