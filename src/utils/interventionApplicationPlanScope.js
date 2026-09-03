export const isActionPlanSelectableForApplication = (plan, applicationId) => {
  const planApplicationId = Number(plan?.applicationId ?? plan?.application_id);
  const activeApplicationId = Number(applicationId);
  const hasPlanApplication = Number.isInteger(planApplicationId) && planApplicationId > 0;
  const hasActiveApplication = Number.isInteger(activeApplicationId) && activeApplicationId > 0;
  if (!hasPlanApplication && !hasActiveApplication) {
    return plan?.historicalManual === true || plan?.historical_manual === true;
  }
  return (
    hasPlanApplication &&
    hasActiveApplication &&
    planApplicationId === activeApplicationId
  );
};
