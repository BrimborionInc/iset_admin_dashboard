import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../auth/apiClient.js";
import {
  normalizeInterventionReviewStatus,
  resolveInterventionStateFields,
} from "../../../utils/interventionStatus.js";
import { resolveApplicationStateFields } from "../../../utils/applicationStatus.js";

const interventionWizardStepStore = new Map();
const interventionWizardDraftStore = new Map();
const interventionWizardLastKeyByCase = new Map();

const cloneWizardDraft = value => {
  if (!value || typeof value !== "object") return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { ...value };
  }
};

const toNumberOrNull = value => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toPositiveIntegerOrNull = value => {
  const numeric = toNumberOrNull(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeInterventionCostLine = raw => {
  if (!raw || typeof raw !== "object") return null;
  const recurrenceRaw =
    raw.recurrence && typeof raw.recurrence === "object" ? raw.recurrence : {};
  const payeeRaw = raw.payee && typeof raw.payee === "object" ? raw.payee : {};
  return {
    id: raw.id || null,
    type: raw.type || raw.paymentType || raw.payment_type || "",
    amount: raw.amount ?? null,
    notes: raw.notes || raw.description || "",
    payee: {
      type: String(payeeRaw.type || raw.payeeType || raw.payee_type || "").trim(),
      name: String(payeeRaw.name || raw.payeeName || raw.payee_name || "").trim(),
      reference: String(payeeRaw.reference || raw.payeeReference || raw.payee_reference || "").trim(),
    },
    recurrence: {
      enabled: Boolean(recurrenceRaw.enabled),
      startDate: recurrenceRaw.startDate || recurrenceRaw.start_date || "",
      endDate: recurrenceRaw.endDate || recurrenceRaw.end_date || "",
      occurrences:
        recurrenceRaw.occurrences === null || typeof recurrenceRaw.occurrences === "undefined"
          ? ""
          : String(recurrenceRaw.occurrences),
      amountPerPeriod:
        recurrenceRaw.amountPerPeriod === null || typeof recurrenceRaw.amountPerPeriod === "undefined"
          ? ""
          : String(recurrenceRaw.amountPerPeriod),
    },
  };
};

const buildInterventionFromApi = (planId, payload = {}) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const resolvedMetadata =
    payload.metadata ||
    payload.metadataJson ||
    payload.metadata_json ||
    null;
  const resolvedInstitution =
    payload.institution ||
    payload.trainingInstitution ||
    payload.training_institution ||
    resolvedMetadata?.institution ||
    resolvedMetadata?.trainingInstitution ||
    resolvedMetadata?.training_institution ||
    null;
  const resolvedProgramName =
    payload.programName ||
    payload.program_name ||
    resolvedMetadata?.programName ||
    resolvedMetadata?.program_name ||
    null;
  const resolvedItpDetails =
    payload.itpDetails ||
    payload.itp_details ||
    resolvedMetadata?.itpDetails ||
    resolvedMetadata?.itp_details ||
    null;
  const resolvedWageSubsidyDetails =
    payload.wageSubsidyDetails ||
    payload.wage_subsidy_details ||
    resolvedMetadata?.wageSubsidyDetails ||
    resolvedMetadata?.wage_subsidy_details ||
    null;
  const resolvedDeliveryMode =
    payload.deliveryMode ||
    payload.delivery_mode ||
    resolvedMetadata?.deliveryMode ||
    resolvedMetadata?.delivery_mode ||
    "partner";
  const compliance =
    payload.compliance && typeof payload.compliance === "object"
      ? {
          ilmp: payload.compliance.ilmp || "pending",
          finance: payload.compliance.finance || "pending",
        }
      : { ilmp: "pending", finance: "pending" };
  const interventionState = resolveInterventionStateFields(payload, { fallbackStatus: "draft" });
  const status = interventionState.effectiveStatus || "draft";
  const proposalId = toPositiveIntegerOrNull(
    payload.proposalId ??
    payload.proposal_id ??
    payload.interventionProposalId ??
    payload.intervention_proposal_id
  );
  const proposalReviewStatus =
    normalizeInterventionReviewStatus(
      payload.proposalReviewStatus ??
      payload.proposal_review_status ??
      payload.interventionProposalReviewStatus ??
      payload.intervention_proposal_review_status,
      null
    ) ||
    interventionState.proposalReviewStatus ||
    interventionState.reviewStatus ||
    null;
  const proposalKind =
    payload.proposalKind ??
    payload.proposal_kind ??
    payload.interventionProposalKind ??
    payload.intervention_proposal_kind ??
    null;
  const proposalReviewedAt =
    payload.proposalReviewedAt ??
    payload.proposal_reviewed_at ??
    payload.interventionProposalReviewedAt ??
    payload.intervention_proposal_reviewed_at ??
    null;
  const proposalSourceInterventionId = toPositiveIntegerOrNull(
    payload.proposalSourceInterventionId ??
    payload.proposal_source_intervention_id ??
    payload.sourceInterventionId ??
    payload.source_intervention_id
  );
  const snapshot =
    resolvedMetadata?.snapshot && typeof resolvedMetadata.snapshot === "object"
      ? resolvedMetadata.snapshot
      : {};
  const resolvedCostLinesSource =
    Array.isArray(payload.costLines)
      ? payload.costLines
      : Array.isArray(resolvedMetadata?.costLines)
        ? resolvedMetadata.costLines
        : Array.isArray(snapshot.costLines)
          ? snapshot.costLines
          : [];
  const resolvedFundingBreakdown =
    Array.isArray(payload.fundingBreakdown)
      ? payload.fundingBreakdown
      : Array.isArray(resolvedMetadata?.fundingBreakdown)
        ? resolvedMetadata.fundingBreakdown
        : Array.isArray(snapshot.fundingBreakdown)
          ? snapshot.fundingBreakdown
          : [];
  const durationDays = toNumberOrNull(payload.durationDays);
  const plannedCost =
    toNumberOrNull(payload.plannedCost) ??
    toNumberOrNull(payload.cost) ??
    toNumberOrNull(payload.budgetAmount) ??
    toNumberOrNull(payload.approvedAmount) ??
    toNumberOrNull(payload.metadata?.cost);
  const resolvedNoc =
    payload.noc ||
    payload.nocCode ||
    payload.noc_code ||
    payload.relatedNoc ||
    payload.related_noc ||
    payload.nocCodeValue ||
    payload.noc_code_value ||
    null;
  const resolvedNocVersion =
    payload.nocVersion ||
    payload.noc_version ||
    payload.relatedNocVersion ||
    payload.related_noc_version ||
    payload.nocVersionCode ||
    payload.noc_version_code ||
    null;
  return {
    id: payload.id,
    actionPlanId: payload.actionPlanId ?? planId ?? null,
    code: payload.code || payload.interventionCode || payload.intervention_code || null,
    title: payload.title || payload.description || payload.notes || "Untitled intervention",
    description: payload.description || null,
    status,
    reviewStatus: interventionState.reviewStatus || null,
    review_status: interventionState.reviewStatus || null,
    proposalId,
    proposal_id: proposalId,
    proposalKind,
    proposal_kind: proposalKind,
    proposalReviewStatus,
    proposal_review_status: proposalReviewStatus,
    proposalReviewedAt,
    proposal_reviewed_at: proposalReviewedAt,
    proposalSourceInterventionId,
    proposal_source_intervention_id: proposalSourceInterventionId,
    deliveryStatus: interventionState.deliveryStatus || null,
    delivery_status: interventionState.deliveryStatus || null,
    startDate: payload.startDate || null,
    endDate: payload.endDate || null,
    durationDays,
    outcome: payload.outcome || payload.outcomeCode || null,
    plannedCost,
    cost: plannedCost,
    potId: payload.potId || payload.fundingStream || null,
    fundingStream: payload.fundingStream || null,
    postingContext: payload.postingContext || payload.posting_context || payload.metadata?.postingContext || null,
    deliveryMode: resolvedDeliveryMode === "in_house" ? "in_house" : "partner",
    institution: resolvedInstitution,
    programName: resolvedProgramName,
    itpDetails: resolvedItpDetails,
    wageSubsidyDetails: resolvedWageSubsidyDetails,
    noc: resolvedNoc,
    nocVersion: resolvedNocVersion,
    notes: payload.notes || null,
    compliance,
    approvedAmount: toNumberOrNull(payload.approvedAmount),
    committedAmount: toNumberOrNull(
      payload.committedAmount ??
      payload.financeCommittedAmount ??
      payload.metadata?.finance?.committed
    ),
    financeCommittedAmount: toNumberOrNull(
      payload.financeCommittedAmount ??
      payload.committedAmount ??
      payload.metadata?.finance?.committed
    ),
    actualAmount: toNumberOrNull(payload.actualAmount),
    financeActualAmount: toNumberOrNull(
      payload.financeActualAmount ??
      payload.metadata?.finance?.actual
    ),
    budgetAmount: toNumberOrNull(payload.budgetAmount),
    costLines: resolvedCostLinesSource.map(normalizeInterventionCostLine).filter(Boolean),
    fundingBreakdown: resolvedFundingBreakdown,
    metadata: resolvedMetadata,
    createdByStaffProfileId: payload.createdByStaffProfileId || null,
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
    closedAt: payload.closedAt || null,
  };
};

const resolveLiveInterventionDeliveryStatus = intervention => {
  const state = resolveInterventionStateFields(intervention, { fallbackStatus: "draft" });
  if (state.deliveryStatus) {
    return state.deliveryStatus;
  }
  return state.reviewStatus === "approved" ? "planned" : null;
};

const recomputeInterventionCounts = plans => {
  let open = 0;
  let total = 0;
  plans.forEach(plan => {
    const list = Array.isArray(plan.interventions) ? plan.interventions : [];
    list.forEach(item => {
      const liveDeliveryStatus = resolveLiveInterventionDeliveryStatus(item);
      if (liveDeliveryStatus) {
        total += 1;
      }
      if (liveDeliveryStatus && ["planned", "in_progress", "suspended"].includes(liveDeliveryStatus)) {
        open += 1;
      }
    });
  });
  return { open, total };
};

const toTimestamp = value => {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
};

const planRecencyScore = plan => {
  return (
    toTimestamp(plan.createdAt) ??
    toTimestamp(plan.updatedAt) ??
    toTimestamp(plan.activatedAt) ??
    toTimestamp(plan.startDate) ??
    0
  );
};

const interventionRecencyScore = intervention => {
  return (
    toTimestamp(intervention?.updatedAt) ??
    toTimestamp(intervention?.createdAt) ??
    0
  );
};

const findLatestProposalPlanId = plans => {
  let selectedPlanId = null;
  let selectedScore = -1;
  plans.forEach(plan => {
    (plan?.interventions || []).forEach(intervention => {
      const reviewStatus = resolveInterventionStateFields(intervention).reviewStatus;
      if (
        !reviewStatus ||
        !["draft", "submitted", "in_review", "changes_requested"].includes(reviewStatus)
      ) {
        return;
      }
      const score = interventionRecencyScore(intervention);
      if (selectedPlanId === null || score >= selectedScore) {
        selectedPlanId = plan?.id ?? null;
        selectedScore = score;
      }
    });
  });
  return selectedPlanId;
};

const resolvePreferredActionPlanId = (plans, currentSelectedActionPlanId = null) => {
  const list = Array.isArray(plans) ? plans : [];
  if (!list.length) return null;

  const currentMatch =
    currentSelectedActionPlanId === null || typeof currentSelectedActionPlanId === "undefined"
      ? null
      : list.find(plan => String(plan?.id) === String(currentSelectedActionPlanId)) || null;
  if (currentMatch?.id) {
    return currentMatch.id;
  }

  const proposalPlanId = findLatestProposalPlanId(list);
  if (proposalPlanId) {
    return proposalPlanId;
  }

  return list[0]?.id ?? null;
};

const sortActionPlansByRecency = plans => {
  return [...plans].sort((a, b) => {
    const scoreA = planRecencyScore(a);
    const scoreB = planRecencyScore(b);
    if (scoreA === scoreB) {
      return (b.title || "").localeCompare(a.title || "");
    }
    return scoreB - scoreA;
  });
};

const buildCaseFromWorkspaceApi = (caseId, payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid case payload.");
  }

  const client = payload.client || {};
  const exportPreview = payload.exportPreview || { ilmp: null };
  const counts = payload.counts || {};
  const normaliseCount = value => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const rawActionPlans = Array.isArray(payload.actionPlans) ? payload.actionPlans : [];
  const actionPlans = sortActionPlansByRecency(rawActionPlans.map(plan => {
    const interventions = Array.isArray(plan.interventions)
      ? plan.interventions
          .map(item => buildInterventionFromApi(plan.id, item))
          .filter(Boolean)
      : [];
    return {
      id: plan.id,
      caseId: plan.caseId || caseId,
      title: plan.name || plan.title || "Untitled",
      status: plan.status || null,
      agreementNumber: plan.agreementNumber || plan.agreement_number || null,
      educationLevel: plan.educationLevel || plan.education_level || null,
      educationProvince: plan.educationProvince || plan.education_province || null,
      socialAssistanceRecipient: plan.socialAssistanceRecipient || plan.social_assistance_recipient || null,
      childcareNeed: plan.childcareNeed || plan.childcare_need || null,
      childcareFunding: plan.childcareFunding || plan.childcare_funding || null,
      prevEmploymentNoc: plan.prevEmploymentNoc || plan.prev_employment_noc || null,
      prevEmploymentNocVersion: plan.prevEmploymentNocVersion || plan.prev_employment_noc_version || null,
      barriers: Array.isArray(plan.barriers) ? plan.barriers : [],
      eiClaimant: plan.eiClaimant || plan.EIClaimant || null,
      prevEmployment: plan.prevEmployment || plan.prev_employment || null,
      prevEmploymentScheduleType: plan.actionPlanPreviousEmploymentScheduleType || plan.prevEmploymentScheduleType || plan.prev_employment_schedule_type || null,
      startDate: plan.effectiveDate || plan.startDate || null,
      endDate: plan.reviewDate || plan.endDate || null,
      activatedAt: plan.activatedAt || null,
      closedAt: plan.closedAt || null,
      archivedAt: plan.archivedAt || null,
      budgetPot: plan.budgetPotId || plan.budgetPot || plan.budget_pot || null,
      budgetPotCode: plan.budgetPotCode || null,
      fundingStream: plan.fundingStream || plan.funding_stream || null,
      postingContext: plan.postingContext || plan.posting_context || null,
      resultCode: plan.resultCode || null,
      resultDate: plan.resultDate || null,
      resultEducationLevel: plan.resultEducationLevel || null,
      futureEducationLevel: plan.futureEducationLevel || null,
      resultNoc: plan.resultNoc || null,
      resultNocVersion: plan.resultNocVersion || null,
      outcomeSummary: plan.outcomeSummary || null,
      closureNotes: plan.closureNotes || null,
      summary: plan.summary || null,
      ownerStaffProfileId: plan.ownerStaffProfileId || null,
      ownerUserId: plan.ownerUserId || null,
      createdAt: plan.createdAt || null,
      updatedAt: plan.updatedAt || null,
      interventions,
      interventionCount: interventions.length,
    };
  }));

  const firstName = client.firstName || null;
  const lastName = client.lastName || null;
  const fullName =
    client.fullName ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    null;
  const dateOfBirth = client.dateOfBirth ?? client.dob ?? null;

  const regionSource = client.regionLabel ?? client.region;
  const resolvedRegionName =
    typeof regionSource === "string"
      ? regionSource
      : regionSource?.name || regionSource?.code || null;
  const displayRegion = resolvedRegionName || "Not set";
  const regionDetails =
    regionSource && typeof regionSource === "object" ? regionSource : (client.region && typeof client.region === "object" ? client.region : null);

  const assessmentKeys = [
    "case_summary",
    "assessment_employment_goals",
    "assessment_previous_iset",
    "assessment_previous_iset_details",
    "assessment_employment_barriers",
    "assessment_employment_barriers_other_details",
    "assessment_local_area_priorities",
    "assessment_other_funding_details",
    "assessment_esdc_eligibility",
    "assessment_intervention_start_date",
    "assessment_intervention_end_date",
    "assessment_intervention_code",
    "assessment_intervention_outcome_code",
    "assessment_intervention_duration_days",
    "assessment_intervention_cost_total",
    "assessment_intervention_related_noc",
    "assessment_intervention_related_noc_version",
    "assessment_proposed_interventions",
    "assessment_childcare_need",
    "assessment_childcare_funding_details",
    "assessment_institution",
    "assessment_program_name",
    "assessment_itp",
    "assessment_wage",
    "assessment_recommendation",
    "assessment_justification",
  ];
  const assessmentData = {};
  assessmentKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      assessmentData[key] = payload[key];
    }
  });

  return {
    id: payload.id ?? caseId,
    applicationId: payload.applicationId ?? payload.application_id ?? null,
    application_id: payload.applicationId ?? payload.application_id ?? null,
    applicantUserId: payload.applicantUserId ?? payload.applicant_user_id ?? null,
    applicant_user_id: payload.applicant_user_id ?? payload.applicantUserId ?? null,
    applicantName: payload.applicantName ?? payload.applicant_name ?? null,
    applicant_name: payload.applicant_name ?? payload.applicantName ?? null,
    applicantEmail: payload.applicantEmail ?? payload.applicant_email ?? null,
    applicant_email: payload.applicant_email ?? payload.applicantEmail ?? null,
    caseNumber: payload.caseNumber ?? null,
    status: payload.status ?? null,
    ...resolveApplicationStateFields(payload),
    riskRating: payload.riskRating ?? null,
    openedAt: payload.openedAt ?? null,
    closedAt: payload.closedAt ?? null,
    updatedAt: payload.updatedAt ?? null,
    nextActionDueAt: payload.nextActionDueAt ?? null,
    agreementNumber: payload.agreementNumber ?? payload.trackingId ?? null,
    pathAccount: {
      status: payload.pathAccount?.status ?? "no_account",
      email: payload.pathAccount?.email ?? null,
      cognitoSub: payload.pathAccount?.cognitoSub ?? null,
      cognitoUsername: payload.pathAccount?.cognitoUsername ?? null,
      invitedAt: payload.pathAccount?.invitedAt ?? null,
      activatedAt: payload.pathAccount?.activatedAt ?? null,
    },
    client: {
      id: client.id ?? null,
      name: fullName || "Unknown client",
      dateOfBirth,
      region: displayRegion,
      regionDetails,
      details: client,
    },
    owner: {
      id: payload.owner?.id ?? null,
      name: payload.owner?.name ?? payload.owner?.email ?? "Unassigned",
      email: payload.owner?.email ?? null,
      role: payload.owner?.role ?? null,
      regionId: payload.owner?.regionId ?? null,
    },
    counts: {
      openTasks: normaliseCount(counts.openTasks),
      overdueTasks: normaliseCount(counts.overdueTasks),
      openInterventions: normaliseCount(counts.openInterventions),
      totalInterventions: normaliseCount(counts.totalInterventions),
    },
    caseContext: payload.caseContext ?? payload.case_context ?? null,
    actionPlans,
    documents: Array.isArray(payload.documents) ? payload.documents : [],
    notes: Array.isArray(payload.notes) ? payload.notes : [],
    finance: payload.finance ?? null,
    compliance: payload.compliance ?? null,
    eligibility: payload.eligibility ?? null,
    exportPreview,
    ...assessmentData,
  };
};

const CaseWorkspaceContext = createContext({
  caseId: null,
  caseData: null,
  isLoading: false,
  error: null,
  refresh: () => Promise.resolve(),
  createActionPlan: () => Promise.resolve({}),
  updateActionPlan: () => Promise.resolve(),
  createIntervention: () => Promise.resolve({}),
  reviseIntervention: () => Promise.resolve({}),
  updateIntervention: () => Promise.resolve({}),
  closeIntervention: () => Promise.resolve({}),
  runComplianceChecks: () => Promise.resolve(),
  prepareIlmpExport: () => Promise.resolve({}),
  markReadyToClose: () => Promise.resolve({}),
  closeCase: () => Promise.resolve({}),
  reopenCase: () => Promise.resolve({}),
  archiveCase: () => Promise.resolve({}),
  fetchActionPlanContext: () => Promise.resolve({}),
  upsertActionPlanReviewReminder: () => Promise.resolve(),
  saveCaseContext: () => Promise.resolve(),
  interventionCodes: [],
  interventionCodesLoading: false,
  loadInterventionCodes: () => Promise.resolve([]),
  interventionOutcomes: [],
  interventionOutcomesLoading: false,
  loadInterventionOutcomes: () => Promise.resolve([]),
  fundingStreams: [],
  fundingStreamsLoading: false,
  loadFundingStreams: () => Promise.resolve([]),
  nocVersions: [],
  nocVersionsLoading: false,
  loadNocVersions: () => Promise.resolve([]),
  searchNocCodes: () => Promise.resolve([]),
  selectedActionPlanId: null,
  selectedInterventionId: null,
  setSelectedActionPlanId: () => {},
  getInterventionWizardStep: () => null,
  getInterventionWizardKeyForCase: () => null,
  getInterventionWizardDraft: () => null,
  setInterventionWizardStep: () => {},
  setInterventionWizardDraft: () => {},
  clearInterventionWizardStep: () => {},
  clearInterventionWizardDraft: () => {},
});

export const CaseWorkspaceProvider = ({ caseId, applicationId = null, children }) => {
  const [state, setState] = useState({
    caseData: null,
    isLoading: false,
    error: null,
  });
  const [selectedActionPlanId, setSelectedActionPlanId] = useState(null);
  const [selectedInterventionId, setSelectedInterventionId] = useState(null);
  const [interventionCodes, setInterventionCodes] = useState([]);
  const [interventionCodesLoaded, setInterventionCodesLoaded] = useState(false);
  const [interventionCodesLoading, setInterventionCodesLoading] = useState(false);
  const [interventionOutcomes, setInterventionOutcomes] = useState([]);
  const [interventionOutcomesLoaded, setInterventionOutcomesLoaded] = useState(false);
  const [interventionOutcomesLoading, setInterventionOutcomesLoading] = useState(false);
  const [fundingStreams, setFundingStreams] = useState([]);
  const [fundingStreamsLoaded, setFundingStreamsLoaded] = useState(false);
  const [fundingStreamsLoading, setFundingStreamsLoading] = useState(false);
  const [nocVersions, setNocVersions] = useState([]);
  const [nocVersionsLoaded, setNocVersionsLoaded] = useState(false);
  const [nocVersionsLoading, setNocVersionsLoading] = useState(false);
  const getInterventionWizardStep = useCallback(key => {
    if (!key) return null;
    return interventionWizardStepStore.get(String(key)) || null;
  }, []);
  const getInterventionWizardKeyForCase = useCallback(caseIdKey => {
    if (!caseIdKey) return null;
    return interventionWizardLastKeyByCase.get(String(caseIdKey)) || null;
  }, []);
  const getInterventionWizardDraft = useCallback(key => {
    if (!key) return null;
    const stored = interventionWizardDraftStore.get(String(key));
    return stored ? cloneWizardDraft(stored) : null;
  }, []);
  const setInterventionWizardStep = useCallback((key, step) => {
    if (!key) return;
    const normalizedKey = String(key);
    const caseKey = normalizedKey.split(":")[0] || normalizedKey;
    if (!step) {
      interventionWizardStepStore.delete(normalizedKey);
      return;
    }
    interventionWizardStepStore.set(normalizedKey, step);
    interventionWizardLastKeyByCase.set(caseKey, normalizedKey);
  }, []);
  const setInterventionWizardDraft = useCallback((key, draft) => {
    if (!key) return;
    const normalizedKey = String(key);
    const caseKey = normalizedKey.split(":")[0] || normalizedKey;
    if (!draft) {
      interventionWizardDraftStore.delete(normalizedKey);
      return;
    }
    interventionWizardDraftStore.set(normalizedKey, cloneWizardDraft(draft));
    interventionWizardLastKeyByCase.set(caseKey, normalizedKey);
  }, []);
  const clearInterventionWizardStep = useCallback(key => {
    if (!key) {
      interventionWizardStepStore.clear();
      interventionWizardLastKeyByCase.clear();
      return;
    }
    const normalizedKey = String(key);
    const caseKey = normalizedKey.split(":")[0] || normalizedKey;
    interventionWizardStepStore.delete(normalizedKey);
    if (interventionWizardLastKeyByCase.get(caseKey) === normalizedKey) {
      interventionWizardLastKeyByCase.delete(caseKey);
    }
  }, []);
  const clearInterventionWizardDraft = useCallback(key => {
    if (!key) {
      interventionWizardDraftStore.clear();
      return;
    }
    interventionWizardDraftStore.delete(String(key));
  }, []);

  const resolveCaseIdentifier = useCallback(() => {
    const payload = state.caseData || {};
    const value =
      payload.caseNumber ||
      payload.agreementNumber ||
      payload.trackingId ||
      payload.tracking_id;
    if (value) return value;
    if (caseId) return `Case #${caseId}`;
    return "Case";
  }, [caseId, state.caseData]);

  const markCompliancePending = useCallback(() => {
    setState(prev => {
      if (!prev.caseData) return prev;
      return {
        ...prev,
        caseData: {
          ...prev.caseData,
          compliance: {
            ...prev.caseData.compliance,
            ilmp: { ...(prev.caseData.compliance?.ilmp || {}), status: "pending" },
          },
        },
      };
    });
  }, []);

  const toReminderIso = (dateString) => {
    if (!dateString) return null;
    const date = new Date(`${dateString}T08:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const loadCase = useCallback(async () => {
    if (!caseId) {
      setState(prev => ({ ...prev, isLoading: false, error: "Failed to load case." }));
      return null;
    }
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const fetchOnce = async () => {
        const params = new URLSearchParams();
        if (applicationId) {
          params.set("applicationId", String(applicationId));
        }
        const query = params.toString() ? `?${params.toString()}` : "";
        const resp = await apiFetch(`/api/cases/${caseId}/workspace${query}`, { method: "GET" });
        if (!resp.ok) {
          const error = new Error("Failed to load case.");
          error.status = resp.status;
          error.response = resp;
          throw error;
        }
        return resp.json();
      };

      let payload;
      try {
        payload = await fetchOnce();
      } catch (err) {
        const status = err?.status;
        // Retry once for transient errors (network/5xx/locked)
        if (status && status >= 500) {
          await new Promise(resolve => setTimeout(resolve, 250));
          payload = await fetchOnce();
        } else {
          throw err;
        }
      }
      const data = buildCaseFromWorkspaceApi(caseId, payload);
      setState({ caseData: data, isLoading: false, error: null });
      if (typeof window !== 'undefined') {
        window.__CASE_WORKSPACE = { caseData: data };
      }
      setSelectedActionPlanId(currentSelectedActionPlanId =>
        resolvePreferredActionPlanId(data.actionPlans, currentSelectedActionPlanId)
      );
      return data;
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error?.message || "Failed to load case." }));
      throw error;
    }
  }, [caseId, applicationId]);

  useEffect(() => {
    loadCase().catch(() => {});
  }, [loadCase]);

  const lockApplicationId = state.caseData?.applicationId ?? state.caseData?.application_id ?? null;

  useEffect(() => {
    return () => {
      if (!lockApplicationId) return;
      apiFetch(`/api/locks/application/${lockApplicationId}`, { method: "DELETE" }).catch(() => {});
    };
  }, [lockApplicationId]);

  const loadInterventionCodes = useCallback(async () => {
    if (interventionCodesLoaded && interventionCodes.length > 0) {
      return interventionCodes;
    }
    setInterventionCodesLoading(true);
    try {
      const response = await apiFetch("/api/reference/intervention-codes", { method: "GET" });
      if (!response.ok) {
        const error = new Error(`Failed to load intervention codes (${response.status})`);
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      const list = Array.isArray(data?.codes)
        ? data.codes
            .map(item => ({
              code: item?.code ? String(item.code).trim() : null,
              label: item?.label ? String(item.label).trim() : null,
            }))
            .filter(item => item.code && item.label)
        : [];
      setInterventionCodes(list);
      setInterventionCodesLoaded(true);
      return list;
    } catch (error) {
      throw error;
    } finally {
      setInterventionCodesLoading(false);
    }
  }, [apiFetch, interventionCodes, interventionCodesLoaded]);

  const loadInterventionOutcomes = useCallback(async () => {
    if (interventionOutcomesLoaded && interventionOutcomes.length > 0) {
      return interventionOutcomes;
    }
    setInterventionOutcomesLoading(true);
    try {
      const response = await apiFetch("/api/reference/intervention-outcomes", { method: "GET" });
      if (!response.ok) {
        const error = new Error(`Failed to load intervention outcomes (${response.status})`);
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      const list = Array.isArray(data?.outcomes)
        ? data.outcomes
            .map(item => ({
              code: item?.code ? String(item.code).trim() : null,
              label: item?.label ? String(item.label).trim() : null,
            }))
            .filter(item => item.code && item.label)
        : [];
      setInterventionOutcomes(list);
      setInterventionOutcomesLoaded(true);
      return list;
    } catch (error) {
      throw error;
    } finally {
      setInterventionOutcomesLoading(false);
    }
  }, [apiFetch, interventionOutcomes, interventionOutcomesLoaded]);

  const loadFundingStreams = useCallback(async () => {
    if (fundingStreamsLoaded && fundingStreams.length > 0) {
      return fundingStreams;
    }
    setFundingStreamsLoading(true);
    try {
      const response = await apiFetch("/api/reference/funding-streams", { method: "GET" });
      if (!response.ok) {
        const error = new Error(`Failed to load funding streams (${response.status})`);
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      const list = Array.isArray(data?.streams)
        ? data.streams
            .map(item => ({
              code: item?.code ? String(item.code).trim() : null,
              label: item?.label ? String(item.label).trim() : null,
              description: item?.description ? String(item.description).trim() : null,
            }))
            .filter(item => item.code && item.label)
        : [];
      setFundingStreams(list);
      setFundingStreamsLoaded(true);
      return list;
    } catch (error) {
      throw error;
    } finally {
      setFundingStreamsLoading(false);
    }
  }, [apiFetch, fundingStreams, fundingStreamsLoaded]);

  const loadNocVersions = useCallback(async () => {
    if (nocVersionsLoaded && nocVersions.length > 0) {
      return nocVersions;
    }
    setNocVersionsLoading(true);
    try {
      const response = await apiFetch("/api/reference/noc-versions", { method: "GET" });
      if (!response.ok) {
        const error = new Error(`Failed to load NOC versions (${response.status})`);
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      const list = Array.isArray(data?.versions)
        ? data.versions
            .map(item => ({
              code: item?.code ? String(item.code).trim() : null,
              label: item?.label ? String(item.label).trim() : null,
              description: item?.description ? String(item.description).trim() : null,
            }))
            .filter(item => item.code && item.label)
        : [];
      setNocVersions(list);
      setNocVersionsLoaded(true);
      return list;
    } catch (error) {
      throw error;
    } finally {
      setNocVersionsLoading(false);
    }
  }, [apiFetch, nocVersions, nocVersionsLoaded]);

  const searchNocCodes = useCallback(
    async ({ query, version }) => {
      const params = new URLSearchParams();
      if (version) params.set("version", version);
      if (query) params.set("q", query);
      params.set("limit", "25");
      const response = await apiFetch(`/api/reference/noc-codes?${params.toString()}`, { method: "GET" });
      if (!response.ok) {
        const error = new Error(`Failed to load NOC codes (${response.status})`);
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      return Array.isArray(data?.codes)
        ? data.codes.map(item => ({
            code: item?.code ? String(item.code).trim() : null,
            version: item?.version ? String(item.version).trim() : null,
            title: item?.title ? String(item.title).trim() : null,
          })).filter(item => item.code && item.version && item.title)
        : [];
    },
    [apiFetch]
  );

  const updateActionPlan = useCallback(async (actionPlanId, payload) => {
    const response = await apiFetch(`/api/action-plans/${actionPlanId}?allowClosedEdit=1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let details = null;
      try {
        details = await response.json();
      } catch (_) {
        details = null;
      }
      const message =
        details?.message ||
        details?.error ||
        `Failed to update action plan (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.code = details?.error;
      error.details = details;
      throw error;
    }
    const data = await response.json();
    markCompliancePending();
    return data;
  }, [apiFetch, markCompliancePending]);

  const upsertActionPlanReviewReminder = useCallback(
    async (plan, reviewDate) => {
      if (!plan || !plan.id || !caseId) return null;
      const dueAtIso = toReminderIso(reviewDate);
      const assignedStaffProfileId = plan.ownerStaffProfileId || state.caseData?.owner?.id || null;
      const ownerLabel =
        state.caseData?.owner?.email ||
        state.caseData?.owner?.name ||
        (plan.ownerUserId ? String(plan.ownerUserId) : null);
      const titleParts = ["Action plan review", resolveCaseIdentifier()];
      if (ownerLabel) titleParts.push(ownerLabel);
      const reminderTitle = titleParts.join(" — ");
      const description = plan.summary || "";

      try {
        const res = await apiFetch(`/api/reminders?caseId=${caseId}&status=all`);
        if (!res.ok) throw new Error(`Failed to load reminders (${res.status})`);
        const existingList = await res.json();
        const existing = Array.isArray(existingList)
          ? existingList.find(item => item.actionPlanId === plan.id)
          : null;

        if (!dueAtIso) {
          if (existing) {
            await apiFetch(`/api/reminders/${existing.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "cancelled" }),
            });
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("case-reminders-refresh", { detail: { caseId } }));
            }
          }
          return null;
        }

        const payload = {
          caseId,
          applicationId: state.caseData?.applicationId ?? state.caseData?.application_id ?? null,
          actionPlanId: plan.id,
          title: reminderTitle,
          description: description || null,
          category: "Action plan",
          status: "open",
          dueAt: dueAtIso,
          assignedStaffProfileId: assignedStaffProfileId || undefined,
        };

        if (existing) {
          await apiFetch(`/api/reminders/${existing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, status: "open" }),
          });
        } else {
          await apiFetch(`/api/reminders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("case-reminders-refresh", { detail: { caseId } }));
        }
      } catch (err) {
        console.warn("[ActionPlan] reminder upsert failed", err?.message || err);
      }
      return null;
    },
    [apiFetch, caseId, resolveCaseIdentifier, state.caseData]
  );

  const createIntervention = useCallback(
    async (actionPlanId, payload) => {
      const response = await apiFetch(`/api/action-plans/${actionPlanId}/interventions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let details = null;
        try {
          details = await response.json();
        } catch (_) {
          details = null;
        }
        const message =
          details?.message ||
          details?.detail ||
          details?.error ||
          `Failed to create intervention (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.code = details?.error;
        error.details = details;
        throw error;
      }
      const data = await response.json();
      let intervention = buildInterventionFromApi(actionPlanId, data);
      if (!intervention.metadata && payload?.metadata) {
        intervention = { ...intervention, metadata: payload.metadata };
      }
      if (!intervention) {
        return null;
      }
      markCompliancePending();
      setState(prev => {
        if (!prev.caseData) return prev;
        const nextPlans = prev.caseData.actionPlans.map(plan => {
          if (plan.id !== actionPlanId) return plan;
          const current = Array.isArray(plan.interventions) ? plan.interventions : [];
          const updated = [...current, intervention];
          return { ...plan, interventions: updated, interventionCount: updated.length };
        });
        const { open, total } = recomputeInterventionCounts(nextPlans);
        return {
          ...prev,
          caseData: {
            ...prev.caseData,
            actionPlans: nextPlans,
            counts: {
              ...(prev.caseData.counts || {}),
              openInterventions: open,
              totalInterventions: total,
            },
          },
        };
      });
      return intervention;
    },
    [apiFetch, markCompliancePending]
  );

  const reviseIntervention = useCallback(
    async interventionId => {
      const response = await apiFetch(`/api/interventions/${interventionId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        let details = null;
        try {
          details = await response.json();
        } catch (_) {
          details = null;
        }
        const message =
          details?.message ||
          details?.error ||
          `Failed to start intervention revision (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.code = details?.error;
        error.details = details;
        throw error;
      }
      const data = await response.json();
      const actionPlanId = data?.actionPlanId ?? data?.action_plan_id ?? null;
      const intervention = buildInterventionFromApi(actionPlanId, data);
      if (!intervention) {
        return null;
      }
      markCompliancePending();
      setState(prev => {
        if (!prev.caseData) return prev;
        const targetPlanId = intervention.actionPlanId || actionPlanId;
        let interventionPlaced = false;
        const nextPlans = prev.caseData.actionPlans.map(plan => {
          if (String(plan.id) !== String(targetPlanId)) {
            return plan;
          }
          const current = Array.isArray(plan.interventions) ? plan.interventions : [];
          const exists = current.some(item => String(item.id) === String(intervention.id));
          const updated = exists
            ? current.map(item => (String(item.id) === String(intervention.id) ? intervention : item))
            : [...current, intervention];
          interventionPlaced = true;
          return { ...plan, interventions: updated, interventionCount: updated.length };
        });
        if (!interventionPlaced && targetPlanId) {
          const targetIndex = nextPlans.findIndex(plan => String(plan.id) === String(targetPlanId));
          if (targetIndex >= 0) {
            const plan = nextPlans[targetIndex];
            const current = Array.isArray(plan.interventions) ? plan.interventions : [];
            const exists = current.some(item => String(item.id) === String(intervention.id));
            const updated = exists
              ? current.map(item => (String(item.id) === String(intervention.id) ? intervention : item))
              : [...current, intervention];
            nextPlans[targetIndex] = { ...plan, interventions: updated, interventionCount: updated.length };
          }
        }
        const { open, total } = recomputeInterventionCounts(nextPlans);
        return {
          ...prev,
          caseData: {
            ...prev.caseData,
            actionPlans: nextPlans,
            counts: {
              ...(prev.caseData.counts || {}),
              openInterventions: open,
              totalInterventions: total,
            },
          },
        };
      });
      return intervention;
    },
    [apiFetch, markCompliancePending]
  );

  const updateIntervention = useCallback(
    async (actionPlanId, interventionId, payload) => {
      const response = await apiFetch(`/api/interventions/${interventionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let details = null;
        try {
          details = await response.json();
        } catch (_) {
          details = null;
        }
        const message =
          details?.message ||
          details?.error ||
          `Failed to update intervention (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.code = details?.error;
        error.details = details;
        throw error;
      }
      const data = await response.json();
      let intervention = buildInterventionFromApi(actionPlanId, data);
      if (!intervention.metadata && payload?.metadata) {
        intervention = { ...intervention, metadata: payload.metadata };
      }
      if (!intervention) {
        return null;
      }
      markCompliancePending();
      setState(prev => {
        if (!prev.caseData) return prev;
        const targetPlanId = intervention.actionPlanId || actionPlanId;
        let interventionPlaced = false;
        const nextPlans = prev.caseData.actionPlans.map(plan => {
          const current = Array.isArray(plan.interventions) ? plan.interventions : [];
          const hasIntervention = current.some(item => item.id === interventionId);
          if (!hasIntervention) return plan;
          if (String(plan.id) === String(targetPlanId)) {
            const updated = current.map(item => (item.id === interventionId ? intervention : item));
            interventionPlaced = true;
            return { ...plan, interventions: updated, interventionCount: updated.length };
          }
          const updated = current.filter(item => item.id !== interventionId);
          return { ...plan, interventions: updated, interventionCount: updated.length };
        });
        if (!interventionPlaced && targetPlanId) {
          const targetIndex = nextPlans.findIndex(plan => String(plan.id) === String(targetPlanId));
          if (targetIndex >= 0) {
            const plan = nextPlans[targetIndex];
            const current = Array.isArray(plan.interventions) ? plan.interventions : [];
            if (!current.some(item => item.id === interventionId)) {
              const updated = [...current, intervention];
              nextPlans[targetIndex] = { ...plan, interventions: updated, interventionCount: updated.length };
            } else {
              const updated = current.map(item => (item.id === interventionId ? intervention : item));
              nextPlans[targetIndex] = { ...plan, interventions: updated, interventionCount: updated.length };
            }
          }
        }
        const { open, total } = recomputeInterventionCounts(nextPlans);
        return {
          ...prev,
          caseData: {
            ...prev.caseData,
            actionPlans: nextPlans,
            counts: {
              ...(prev.caseData.counts || {}),
              openInterventions: open,
              totalInterventions: total,
            },
          },
        };
      });
      return intervention;
    },
    [apiFetch, markCompliancePending]
  );

  const closeIntervention = useCallback(
    async (actionPlanId, interventionId, payload) => {
      const response = await apiFetch(`/api/interventions/${interventionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let details = null;
        try {
          details = await response.json();
        } catch (_) {
          details = null;
        }
        const message =
          details?.message ||
          details?.error ||
          `Failed to close intervention (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      const intervention = buildInterventionFromApi(actionPlanId, data);
      if (!intervention) {
        return null;
      }
      markCompliancePending();
      setState(prev => {
        if (!prev.caseData) return prev;
        const nextPlans = prev.caseData.actionPlans.map(plan => {
          if (plan.id !== actionPlanId) return plan;
          const current = Array.isArray(plan.interventions) ? plan.interventions : [];
          const updated = current.map(item => (item.id === interventionId ? intervention : item));
          return { ...plan, interventions: updated, interventionCount: updated.length };
        });
        const { open, total } = recomputeInterventionCounts(nextPlans);
        return {
          ...prev,
          caseData: {
            ...prev.caseData,
            actionPlans: nextPlans,
            counts: {
              ...(prev.caseData.counts || {}),
              openInterventions: open,
              totalInterventions: total,
            },
          },
        };
      });
      return intervention;
    },
    [apiFetch, markCompliancePending]
  );

  const runComplianceChecks = useCallback(async () => {
    if (!caseId) {
      return {
        ilmp: { status: "pending", messages: [], warnings: [], blockingIssues: [], lastValidatedAt: null },
        finance: { status: "pending", messages: [] },
      };
    }

    const response = await apiFetch(`/api/cases/${caseId}/validate-ilmp`, { method: "POST" });
    if (!response.ok) {
      let detail = null;
      try {
        detail = await response.json();
      } catch {
        detail = null;
      }
      const message =
        detail?.detail || detail?.message || detail?.error || "Unable to complete ILMP validation.";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    const payload = await response.json().catch(() => ({}));
    const ilmpPayload = payload?.compliance?.ilmp ?? {};
    const financePayload = payload?.compliance?.finance;
    const mappedCompliance = {
      ilmp: {
        status: ilmpPayload.status ?? "pending",
        messages: Array.isArray(ilmpPayload.messages) ? ilmpPayload.messages : [],
        warnings: Array.isArray(ilmpPayload.warnings) ? ilmpPayload.warnings : [],
        blockingIssues: Array.isArray(ilmpPayload.blockingIssues) ? ilmpPayload.blockingIssues : [],
        lastValidatedAt: ilmpPayload.lastValidatedAt ?? null,
        summary: ilmpPayload.summary ?? null,
      },
      finance: financePayload ?? { status: "pending", messages: [] },
    };

    setState(prev => {
      if (!prev.caseData) {
        return prev;
      }
      const previousFinance = prev.caseData.compliance?.finance;
      return {
        ...prev,
        caseData: {
          ...prev.caseData,
          compliance: {
            ilmp: mappedCompliance.ilmp,
            finance: mappedCompliance.finance ?? previousFinance ?? { status: "pending", messages: [] },
          },
        },
      };
    });
    // Refresh case data to pull updated intervention compliance statuses
    try {
      await loadCase();
    } catch (_) {
      // ignore refresh errors in UI flow
    }

    return mappedCompliance;
  }, [caseId, apiFetch, loadCase]);

  const prepareIlmpExport = useCallback(async () => {
    if (!caseId) {
      const error = new Error("Case not loaded.");
      error.status = 400;
      throw error;
    }

    const response = await apiFetch(`/api/cases/${caseId}/prepare-ilmp`, { method: "POST" });

    const parseDetail = async () => {
      try {
        return await response.json();
      } catch {
        return null;
      }
    };

    if (response.status === 409) {
      const detail = await parseDetail();
      const error = new Error(detail?.error || "Blocking validation issues prevent payload preparation.");
      error.status = 409;
      error.details = detail;
      throw error;
    }

    if (!response.ok) {
      const detail = await parseDetail();
      const message =
        detail?.detail || detail?.message || detail?.error || `Unable to prepare ILMP payload (${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      error.details = detail;
      throw error;
    }

    const payload = await response.json().catch(() => ({}));
    const compliancePayload = payload?.compliance ?? {};
    const exportPayload = payload?.payload ?? null;

    setState(prev => {
      if (!prev.caseData) {
        return prev;
      }
      const previousFinance = prev.caseData.compliance?.finance ?? { status: "pending", messages: [] };
      return {
        ...prev,
        caseData: {
          ...prev.caseData,
          compliance: {
            ilmp: compliancePayload.ilmp ?? prev.caseData.compliance?.ilmp ?? { status: "pending", messages: [] },
            finance: compliancePayload.finance ?? previousFinance,
          },
          exportPreview: {
            ...(prev.caseData.exportPreview || {}),
            ilmp: exportPayload,
          },
        },
      };
    });

    return { compliance: compliancePayload, payload: exportPayload };
  }, [caseId, apiFetch]);

  const markReadyToClose = useCallback(async () => {
    if (!caseId) {
      const error = new Error("Case not loaded.");
      error.status = 400;
      throw error;
    }
    const response = await apiFetch(`/api/cases/${caseId}/ready-to-close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    let detail = null;
    try {
      detail = await response.json();
    } catch (_) {
      detail = null;
    }
    if (!response.ok) {
      const blockers = detail?.blockers;
      const compliance = detail?.compliance;
      const parts = [];
      if (blockers) {
        Object.entries(blockers).forEach(([key, value]) => {
          parts.push(`${key}: ${value}`);
        });
      }
      if (compliance?.ilmp?.messages?.length) {
        parts.push(...compliance.ilmp.messages);
      }
      const message =
        detail?.detail ||
        detail?.message ||
        detail?.error ||
        (parts.length ? parts.join("; ") : `Failed to mark ready to close (${response.status})`);
      const error = new Error(message);
      error.status = response.status;
      error.details = detail;
      throw error;
    }
    const compliancePayload = detail?.compliance ?? null;
    setState(prev => {
      if (!prev.caseData) {
        return prev;
      }
      return {
        ...prev,
        caseData: {
          ...prev.caseData,
          status: "ready_to_close",
          compliance: compliancePayload ?? prev.caseData.compliance,
        },
      };
    });
    return detail;
  }, [apiFetch, caseId]);

  const closeCase = useCallback(async () => {
    if (!caseId) {
      const error = new Error("Case not loaded.");
      error.status = 400;
      throw error;
    }
    const response = await apiFetch(`/api/cases/${caseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    let detail = null;
    try {
      detail = await response.json();
    } catch (_) {
      detail = null;
    }
    if (!response.ok) {
      const message =
        detail?.detail ||
        detail?.message ||
        detail?.error ||
        `Failed to close case (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.details = detail;
      throw error;
    }
    setState(prev => {
      if (!prev.caseData) return prev;
      return {
        ...prev,
        caseData: {
          ...prev.caseData,
          status: "closed",
          closedAt: detail?.closedAt || prev.caseData.closedAt || null,
        },
      };
    });
    return detail;
  }, [apiFetch, caseId]);

  const reopenCase = useCallback(async () => {
    if (!caseId) {
      const error = new Error("Case not loaded.");
      error.status = 400;
      throw error;
    }
    const response = await apiFetch(`/api/cases/${caseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dormant" }),
    });
    let detail = null;
    try {
      detail = await response.json();
    } catch (_) {
      detail = null;
    }
    if (!response.ok) {
      const message =
        detail?.detail ||
        detail?.message ||
        detail?.error ||
        `Failed to reopen case (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.details = detail;
      throw error;
    }
    setState(prev => {
      if (!prev.caseData) return prev;
      return {
        ...prev,
        caseData: {
          ...prev.caseData,
          status: "dormant",
          closedAt: null,
        },
      };
    });
    return detail;
  }, [apiFetch, caseId]);

  const archiveCase = useCallback(async () => {
    if (!caseId) {
      const error = new Error("Case not loaded.");
      error.status = 400;
      throw error;
    }
    const response = await apiFetch(`/api/cases/${caseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    let detail = null;
    try {
      detail = await response.json();
    } catch (_) {
      detail = null;
    }
    if (!response.ok) {
      const message =
        detail?.detail ||
        detail?.message ||
        detail?.error ||
        `Failed to archive case (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.details = detail;
      throw error;
    }
    setState(prev => {
      if (!prev.caseData) return prev;
      return {
        ...prev,
        caseData: {
          ...prev.caseData,
          status: "archived",
        },
      };
    });
    return detail;
  }, [apiFetch, caseId]);

  const createActionPlan = useCallback(
    async plan => {
      const response = await apiFetch(`/api/cases/${caseId}/action-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      if (!response.ok) {
        let details = null;
        try {
          details = await response.json();
        } catch (_) {
          details = null;
        }
        const message =
          details?.message ||
          details?.error ||
          `Failed to create action plan (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.code = details?.error;
        error.details = details;
        throw error;
      }
      return response.json();
    },
    [caseId]
  );

  const activateActionPlan = useCallback(async actionPlanId => {
    const response = await apiFetch(`/api/action-plans/${actionPlanId}/activate`, {
      method: "POST",
    });
    if (!response.ok) {
      let details = null;
      try {
        details = await response.json();
      } catch (_) {
        details = null;
      }
      const message =
        details?.message ||
        details?.error ||
        `Failed to activate action plan (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }, []);

  const closeActionPlan = useCallback(async (actionPlanId, payload) => {
    const response = await apiFetch(`/api/action-plans/${actionPlanId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let details = null;
      try {
        details = await response.json();
      } catch (_) {
        details = null;
      }
      const message =
        details?.message ||
        details?.detail ||
        details?.error ||
        `Failed to close action plan (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      if (details) {
        error.code = details.error || null;
        error.details = details;
        if (Array.isArray(details.interventions)) {
          error.openInterventions = details.interventions.map(item => ({
            id: item.id,
            code: item.code,
            title: item.title,
            status: item.status,
          }));
        }
      }
      error.planId = actionPlanId;
      throw error;
    }
    return response.json();
  }, []);

  const deleteActionPlan = useCallback(async actionPlanId => {
    const response = await apiFetch(`/api/action-plans/${actionPlanId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    let details = null;
    try {
      details = await response.json();
    } catch (_) {
      details = null;
    }
    if (!response.ok) {
      const message =
        details?.message ||
        details?.detail ||
        details?.error ||
        `Failed to delete action plan (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      if (details) {
        error.details = details;
        error.code = details.error || null;
        if (Array.isArray(details.interventions)) {
          error.interventions = details.interventions;
        }
      }
      throw error;
    }
    return details || {};
  }, []);

  const deleteIntervention = useCallback(async interventionId => {
    const response = await apiFetch(`/api/interventions/${interventionId}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    let details = null;
    try {
      details = await response.json();
    } catch (_) {
      details = null;
    }
    if (!response.ok) {
      const message =
        details?.message ||
        details?.detail ||
        details?.error ||
        `Failed to delete intervention (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.details = details;
      throw error;
    }
    markCompliancePending();
    setState(prev => {
      if (!prev.caseData) return prev;
      const nextPlans = (prev.caseData.actionPlans || []).map(plan => {
        const current = Array.isArray(plan.interventions) ? plan.interventions : [];
        const updated = current.filter(item => item.id !== interventionId);
        return { ...plan, interventions: updated, interventionCount: updated.length };
      });
      const { open, total } = recomputeInterventionCounts(nextPlans);
      return {
        ...prev,
        caseData: {
          ...prev.caseData,
          actionPlans: nextPlans,
          counts: {
            ...(prev.caseData.counts || {}),
            openInterventions: open,
            totalInterventions: total,
          },
        },
      };
    });
    return details || {};
  }, [apiFetch, markCompliancePending, setState]);

  const fetchActionPlanContext = useCallback(async () => {
    const response = await apiFetch(`/api/cases/${caseId}/action-plan/context`, {
      method: "GET",
    });
    if (!response.ok) {
      let details = null;
      try {
        details = await response.json();
      } catch (_) {
        details = null;
      }
      const message =
        details?.message ||
        details?.error ||
        `Failed to load action plan context (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }, [caseId]);

  const saveCaseContext = useCallback(
    async (payload) => {
      if (!caseId) {
        const err = new Error("Case not loaded.");
        err.status = 400;
        throw err;
      }
      const response = await apiFetch(`/api/cases/${caseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseContext: payload ?? null }),
      });
      if (!response.ok) {
        let details = null;
        try {
          details = await response.json();
        } catch (_) {
          details = null;
        }
        const message =
          details?.message ||
          details?.error ||
          `Failed to save client context (${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      setState(prev => {
        if (!prev.caseData) return prev;
        return {
          ...prev,
          caseData: {
            ...prev.caseData,
            caseContext: payload ?? null,
          },
        };
      });
      return payload ?? null;
    },
    [apiFetch, caseId]
  );

  const contextValue = useMemo(() => ({
    caseId,
    caseData: state.caseData,
    isLoading: state.isLoading,
    error: state.error,
    refresh: loadCase,
    createActionPlan,
    updateActionPlan,
    createIntervention,
    reviseIntervention,
    updateIntervention,
    closeIntervention,
    runComplianceChecks,
    prepareIlmpExport,
    markReadyToClose,
    closeCase,
    reopenCase,
    archiveCase,
    fetchActionPlanContext,
    upsertActionPlanReviewReminder,
    saveCaseContext,
    deleteActionPlan,
    deleteIntervention,
    interventionCodes,
    interventionCodesLoading,
    loadInterventionCodes,
    interventionOutcomes,
    interventionOutcomesLoading,
    loadInterventionOutcomes,
    fundingStreams,
    fundingStreamsLoading,
    loadFundingStreams,
    nocVersions,
    nocVersionsLoading,
    loadNocVersions,
    searchNocCodes,
    activateActionPlan,
    closeActionPlan,
    selectedActionPlanId,
    setSelectedActionPlanId,
    selectedInterventionId,
    setSelectedInterventionId,
    getInterventionWizardStep,
    getInterventionWizardKeyForCase,
    getInterventionWizardDraft,
    setInterventionWizardStep,
    setInterventionWizardDraft,
    clearInterventionWizardStep,
    clearInterventionWizardDraft,
  }), [caseId, state, loadCase, createActionPlan, updateActionPlan, createIntervention, reviseIntervention, updateIntervention, closeIntervention, runComplianceChecks, prepareIlmpExport, markReadyToClose, closeCase, reopenCase, archiveCase, fetchActionPlanContext, upsertActionPlanReviewReminder, saveCaseContext, deleteActionPlan, deleteIntervention, interventionCodes, interventionCodesLoading, loadInterventionCodes, interventionOutcomes, interventionOutcomesLoading, loadInterventionOutcomes, fundingStreams, fundingStreamsLoading, loadFundingStreams, nocVersions, nocVersionsLoading, loadNocVersions, searchNocCodes, activateActionPlan, closeActionPlan, selectedActionPlanId, selectedInterventionId, getInterventionWizardStep, getInterventionWizardKeyForCase, getInterventionWizardDraft, setInterventionWizardStep, setInterventionWizardDraft, clearInterventionWizardStep, clearInterventionWizardDraft]);

  return (
    <CaseWorkspaceContext.Provider value={contextValue}>
      {children}
    </CaseWorkspaceContext.Provider>
  );
};

export const useCaseWorkspace = () => useContext(CaseWorkspaceContext);

export default CaseWorkspaceContext;
