import {
  mapActionPlanEiClaimantToEligibility,
  resolveInterventionReviewEiEligibility,
} from "./interventionEiEligibility";

describe("intervention EI eligibility fallback", () => {
  test.each([
    [1, "EI Active Claim"],
    ["1", "EI Active Claim"],
    [2, "EI Reach Back"],
    ["reach-back", "EI Reach Back"],
    [3, "CRF"],
    ["non-insured", "CRF"],
  ])("maps action-plan claimant value %p to %s", (value, expected) => {
    expect(mapActionPlanEiClaimantToEligibility(value)).toBe(expected);
  });

  test("preserves an explicit review value instead of replacing it from the action plan", () => {
    expect(
      resolveInterventionReviewEiEligibility({
        reviewEiStatus: "EI Active Claim",
        actionPlanEiClaimant: 2,
      })
    ).toBe("EI Active Claim");
  });

  test("uses the action-plan value when pending review metadata is blank", () => {
    expect(
      resolveInterventionReviewEiEligibility({
        reviewEiStatus: "",
        actionPlanEiClaimant: 2,
        allowActionPlanFallback: true,
      })
    ).toBe("EI Reach Back");
  });

  test("does not reuse action-plan eligibility for a new intervention proposal", () => {
    expect(
      resolveInterventionReviewEiEligibility({
        reviewEiStatus: "",
        actionPlanEiClaimant: 2,
        allowActionPlanFallback: false,
      })
    ).toBe("");
  });

  test("does not invent eligibility when neither source is usable", () => {
    expect(resolveInterventionReviewEiEligibility({ actionPlanEiClaimant: null })).toBe("");
    expect(resolveInterventionReviewEiEligibility({ actionPlanEiClaimant: "unknown" })).toBe("");
  });
});
