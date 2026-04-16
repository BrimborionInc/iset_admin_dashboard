import { resolveInterventionStateFields } from "./interventionStatus.js";

export const EXISTING_INTERVENTION_STATUS_OPTIONS = Object.freeze([
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In progress" },
  { value: "suspended", label: "Suspended" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]);

const ACTION_PLAN_STATUSES = new Set(["draft", "active", "closed", "archived"]);

export const normalizeActionPlanLifecycleStatus = (value, fallback = null) => {
  if (value === null || typeof value === "undefined") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) {
    return fallback;
  }
  return ACTION_PLAN_STATUSES.has(normalized) ? normalized : fallback;
};

export const getAllowedBackloadInterventionStatuses = planStatus => {
  const normalizedPlanStatus = normalizeActionPlanLifecycleStatus(planStatus, null);
  if (normalizedPlanStatus === "archived") {
    return [];
  }
  if (normalizedPlanStatus === "closed") {
    return ["completed", "cancelled"];
  }
  if (normalizedPlanStatus === "draft") {
    return ["approved", "completed", "cancelled"];
  }
  return EXISTING_INTERVENTION_STATUS_OPTIONS.map(option => option.value);
};

export const getBackloadInterventionStatusOptions = planStatus => {
  const allowedStatuses = new Set(getAllowedBackloadInterventionStatuses(planStatus));
  return EXISTING_INTERVENTION_STATUS_OPTIONS.filter(option => allowedStatuses.has(option.value));
};

export const getDefaultBackloadInterventionStatus = planStatus => {
  return getAllowedBackloadInterventionStatuses(planStatus)[0] || "";
};

export const getBackloadInterventionPlanStatusError = ({ planStatus, interventionStatus }) => {
  const normalizedPlanStatus = normalizeActionPlanLifecycleStatus(planStatus, null);
  const normalizedInterventionStatus =
    resolveInterventionStateFields(interventionStatus).effectiveStatus ||
    String(interventionStatus || "").trim().toLowerCase();
  if (normalizedPlanStatus === "archived") {
    return "Archived action plans cannot receive existing interventions.";
  }
  if (normalizedPlanStatus === "closed" && !["completed", "cancelled"].includes(normalizedInterventionStatus)) {
    return "Closed action plans can only receive completed or cancelled existing interventions.";
  }
  if (
    ["in_progress", "suspended"].includes(normalizedInterventionStatus) &&
    normalizedPlanStatus &&
    normalizedPlanStatus !== "active"
  ) {
    return "In-progress or suspended existing interventions require an active action plan.";
  }
  return null;
};

export const getBackloadInterventionPlanStatusNotice = planStatus => {
  const normalizedPlanStatus = normalizeActionPlanLifecycleStatus(planStatus, null);
  if (normalizedPlanStatus === "closed") {
    return "This action plan is already closed. Record only completed or cancelled interventions here.";
  }
  if (normalizedPlanStatus === "draft") {
    return "This action plan is still draft. In-progress or suspended interventions require an active plan.";
  }
  if (normalizedPlanStatus === "archived") {
    return "Archived action plans are read-only and cannot receive existing interventions.";
  }
  return null;
};
