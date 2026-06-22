import { buildApplicationStatusInfo } from '../../utils/applicationStatus';
import { resolveApplicationAssessmentEligibility } from '../../utils/applicationAssessmentEligibility';

export const buildApplicationQueueStatusFields = (row, fallbackStatus = 'submitted') => {
  const assessmentEligibility = resolveApplicationAssessmentEligibility(row);
  const statusInfo = buildApplicationStatusInfo({
    applicationStatus:
      row?.application_status ||
      row?.applicationStatus ||
      row?.status ||
      fallbackStatus,
    applicationLifecycleStatus: row?.application_lifecycle_status ?? row?.applicationLifecycleStatus ?? null,
    caseStatus: row?.case_status || row?.caseStatus || null,
    caseId: row?.case_id ?? row?.caseId ?? null,
    assignedUserId:
      row?.assigned_staff_profile_id ??
      row?.assignedStaffProfileId ??
      row?.assigned_to_user_id ??
      row?.assignedToUserId ??
      row?.assigned_user_id ??
      row?.assignedUserId ??
      null,
    assessmentEligibility,
    decisionOutcome: row?.decision_outcome ?? row?.decisionOutcome ?? null,
    awaitingReason: row?.application_awaiting_reason ?? row?.applicationAwaitingReason ?? null,
    closureReason: row?.application_closure_reason ?? row?.applicationClosureReason ?? null,
    reviewStatus: row?.review_status ?? row?.reviewStatus ?? null,
    type: row?.type,
  });

  const rawStatus = statusInfo.rawStatus || fallbackStatus;
  return {
    status: rawStatus,
    application_status: rawStatus,
    application_lifecycle_status: row?.application_lifecycle_status ?? row?.applicationLifecycleStatus ?? null,
    decision_outcome: row?.decision_outcome ?? row?.decisionOutcome ?? statusInfo.decisionOutcome ?? null,
    application_awaiting_reason: row?.application_awaiting_reason ?? row?.applicationAwaitingReason ?? null,
    application_closure_reason: row?.application_closure_reason ?? row?.applicationClosureReason ?? null,
    assessment_esdc_eligibility: assessmentEligibility,
    assessmentEsdcEligibility: assessmentEligibility,
  };
};

export const getApplicationQueueRawStatus = (row, fallbackStatus = 'submitted') =>
  buildApplicationQueueStatusFields(row, fallbackStatus).status;
