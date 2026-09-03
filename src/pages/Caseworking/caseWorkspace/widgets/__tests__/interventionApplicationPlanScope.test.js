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

  test("offers an explicitly historical manual plan in an applicationless case", () => {
    expect(isActionPlanSelectableForApplication({
      applicationId: null,
      historicalManual: true,
    }, null)).toBe(true);
  });

  test("does not treat an unexplained missing application as historical manual scope", () => {
    expect(isActionPlanSelectableForApplication({ applicationId: null }, null)).toBe(false);
    expect(isActionPlanSelectableForApplication({ applicationId: 123, historicalManual: true }, null)).toBe(false);
    expect(isActionPlanSelectableForApplication({ applicationId: null, historicalManual: true }, 123)).toBe(false);
  });
});
