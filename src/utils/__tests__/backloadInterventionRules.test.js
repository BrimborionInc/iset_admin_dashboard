import {
  getAllowedBackloadInterventionStatuses,
  getBackloadInterventionPlanStatusError,
  getBackloadInterventionStatusOptions,
} from "../backloadInterventionRules.js";

describe("backloadInterventionRules", () => {
  test("closed plans only allow completed or cancelled statuses", () => {
    expect(getAllowedBackloadInterventionStatuses("closed")).toEqual(["completed", "cancelled"]);
    expect(getBackloadInterventionStatusOptions("closed").map(option => option.value)).toEqual([
      "completed",
      "cancelled",
    ]);
  });

  test("draft plans block in-progress and suspended statuses", () => {
    expect(getAllowedBackloadInterventionStatuses("draft")).toEqual([
      "approved",
      "completed",
      "cancelled",
    ]);
    expect(
      getBackloadInterventionPlanStatusError({
        planStatus: "draft",
        interventionStatus: "in_progress",
      })
    ).toBe("In-progress or suspended existing interventions require an active action plan.");
    expect(
      getBackloadInterventionPlanStatusError({
        planStatus: "draft",
        interventionStatus: "suspended",
      })
    ).toBe("In-progress or suspended existing interventions require an active action plan.");
  });

  test("active plans allow all existing-intervention statuses", () => {
    expect(getAllowedBackloadInterventionStatuses("active")).toEqual([
      "approved",
      "in_progress",
      "suspended",
      "completed",
      "cancelled",
    ]);
    expect(
      getBackloadInterventionPlanStatusError({
        planStatus: "active",
        interventionStatus: "in_progress",
      })
    ).toBeNull();
  });

  test("archived plans reject backloaded interventions", () => {
    expect(getAllowedBackloadInterventionStatuses("archived")).toEqual([]);
    expect(
      getBackloadInterventionPlanStatusError({
        planStatus: "archived",
        interventionStatus: "completed",
      })
    ).toBe("Archived action plans cannot receive existing interventions.");
  });
});
