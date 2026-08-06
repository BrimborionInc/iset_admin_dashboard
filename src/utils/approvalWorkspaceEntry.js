const APPROVAL_ENTRY_MODE = "approval";

const toPositiveInteger = value => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeApprovalType = value => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "intervention") return "intervention";
  if (normalized === "application") return "application";
  return null;
};

const normalizeStep = value => {
  const normalized = String(value || "").trim();
  return normalized || "decision";
};

export const buildApprovalWorkspacePath = ({
  basePath,
  approvalType,
  step = "decision",
  applicationId = null,
  interventionId = null,
  planId = null,
}) => {
  if (!basePath) return null;
  const params = new URLSearchParams();
  params.set("entry", APPROVAL_ENTRY_MODE);
  params.set("approvalType", normalizeApprovalType(approvalType) || "application");
  params.set("step", normalizeStep(step));
  const resolvedApplicationId = toPositiveInteger(applicationId);
  const resolvedInterventionId = toPositiveInteger(interventionId);
  const resolvedPlanId = toPositiveInteger(planId);
  if (resolvedApplicationId) {
    params.set("applicationId", String(resolvedApplicationId));
  }
  if (resolvedInterventionId) {
    params.set("interventionId", String(resolvedInterventionId));
  }
  if (resolvedPlanId) {
    params.set("planId", String(resolvedPlanId));
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
};

export const parseWorkspaceEntry = search => {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(typeof search === "string" ? search : "");
  if (params.get("entry") !== APPROVAL_ENTRY_MODE) {
    return null;
  }
  const approvalType = normalizeApprovalType(params.get("approvalType"));
  if (!approvalType) {
    return null;
  }
  const step = normalizeStep(params.get("step"));
  const applicationId = toPositiveInteger(params.get("applicationId"));
  const interventionId = toPositiveInteger(params.get("interventionId"));
  const planId = toPositiveInteger(params.get("planId"));
  return {
    mode: APPROVAL_ENTRY_MODE,
    approvalType,
    step,
    applicationId,
    interventionId,
    planId,
    key: [
      APPROVAL_ENTRY_MODE,
      approvalType,
      step,
      applicationId || "none",
      interventionId || "none",
      planId || "none",
    ].join(":"),
  };
};
