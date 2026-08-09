export const isActionPlanSelectableForApplication = (plan, applicationId) => {
  const planApplicationId = Number(plan?.applicationId ?? plan?.application_id);
  const activeApplicationId = Number(applicationId);
  return (
    Number.isInteger(planApplicationId) &&
    planApplicationId > 0 &&
    Number.isInteger(activeApplicationId) &&
    activeApplicationId > 0 &&
    planApplicationId === activeApplicationId
  );
};
