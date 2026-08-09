import { isActionPlanSelectableForApplication } from "../../../../../utils/interventionApplicationPlanScope";

describe("intervention Action Plan application scope", () => {
  test("offers only plans linked to the exact workspace application", () => {
    expect(isActionPlanSelectableForApplication({ applicationId: 123 }, 123)).toBe(true);
    expect(isActionPlanSelectableForApplication({ application_id: "123" }, "123")).toBe(true);
    expect(isActionPlanSelectableForApplication({ applicationId: 122 }, 123)).toBe(false);
  });

  test.each([
    [{ applicationId: null }, 123],
    [{}, 123],
    [{ applicationId: 123 }, null],
    [{ applicationId: 123 }, ""],
  ])("fails closed when plan or workspace lineage is missing (%j, %j)", (plan, applicationId) => {
    expect(isActionPlanSelectableForApplication(plan, applicationId)).toBe(false);
  });
});
