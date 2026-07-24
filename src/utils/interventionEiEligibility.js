const EI_ELIGIBILITY_BY_CLAIMANT_KEY = Object.freeze({
  "1": "EI Active Claim",
  claimant: "EI Active Claim",
  "active claimant": "EI Active Claim",
  "ei active claim": "EI Active Claim",
  "2": "EI Reach Back",
  "reach back": "EI Reach Back",
  "former claimant": "EI Reach Back",
  "ei reach back": "EI Reach Back",
  "3": "CRF",
  crf: "CRF",
  "non insured": "CRF",
});

const normalizeClaimantKey = value =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

export const mapActionPlanEiClaimantToEligibility = value =>
  EI_ELIGIBILITY_BY_CLAIMANT_KEY[normalizeClaimantKey(value)] || "";

export const resolveInterventionReviewEiEligibility = ({
  reviewEiStatus,
  actionPlanEiClaimant,
  allowActionPlanFallback = false,
} = {}) => {
  const storedReviewStatus = String(reviewEiStatus ?? "").trim();
  if (storedReviewStatus) return storedReviewStatus;
  if (!allowActionPlanFallback) return "";
  return mapActionPlanEiClaimantToEligibility(actionPlanEiClaimant);
};
