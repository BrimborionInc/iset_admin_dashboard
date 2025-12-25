import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../auth/apiClient.js";

const LIVE_CASES_STORAGE_KEY = "iset-demo-use-live-cases";
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

const normaliseInterventionStatus = status => {
  if (!status) return "planned";
  const value = String(status).trim().toLowerCase();
  const direct = new Set([
    "draft",
    "submitted",
    "in_review",
    "changes_requested",
    "approved",
    "rejected",
    "planned",
    "in_progress",
    "suspended",
    "ready_to_close",
    "completed",
    "cancelled",
  ]);
  const aliases = {
    planning: "planned",
    "in-review": "in_review",
    "in review": "in_review",
    "changes-requested": "changes_requested",
    "changes requested": "changes_requested",
    active: "in_progress",
    inprogress: "in_progress",
    "in-progress": "in_progress",
    progress: "in_progress",
    "on-hold": "suspended",
    on_hold: "suspended",
    "ready-to-close": "ready_to_close",
    "ready to close": "ready_to_close",
    readyclose: "ready_to_close",
    complete: "completed",
    closed: "completed",
    done: "completed",
    finished: "completed",
    canceled: "cancelled",
  };
  if (aliases[value]) return aliases[value];
  if (direct.has(value)) return value;
  return value || "planned";
};

const isOpenInterventionStatus = status => {
  const value = normaliseInterventionStatus(status);
  return [
    "draft",
    "submitted",
    "in_review",
    "changes_requested",
    "approved",
    "planned",
    "in_progress",
    "suspended",
    "ready_to_close",
  ].includes(value);
};

const toNumberOrNull = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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
  const compliance =
    payload.compliance && typeof payload.compliance === "object"
      ? {
          ilmp: payload.compliance.ilmp || "pending",
          finance: payload.compliance.finance || "pending",
        }
      : { ilmp: "pending", finance: "pending" };
  const status = normaliseInterventionStatus(payload.status);
  const durationDays = toNumberOrNull(payload.durationDays);
  const plannedCost =
    toNumberOrNull(payload.plannedCost) ??
    toNumberOrNull(payload.cost) ??
    toNumberOrNull(payload.budgetAmount) ??
    toNumberOrNull(payload.approvedAmount) ??
    toNumberOrNull(payload.metadata?.costSettings?.calculatedTotal) ??
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
    code: payload.code || payload.interventionType || null,
    title: payload.title || payload.description || payload.notes || "Untitled intervention",
    description: payload.description || null,
    status,
    startDate: payload.startDate || null,
    endDate: payload.endDate || null,
    durationDays,
    outcome: payload.outcome || payload.outcomeCode || null,
    plannedCost,
    cost: plannedCost,
    potId: payload.potId || payload.fundingStream || null,
    fundingStream: payload.fundingStream || null,
    postingContext: payload.postingContext || payload.posting_context || payload.metadata?.postingContext || null,
    noc: resolvedNoc,
    nocVersion: resolvedNocVersion,
    notes: payload.notes || null,
    compliance,
    approvedAmount: toNumberOrNull(payload.approvedAmount),
    actualAmount: toNumberOrNull(payload.actualAmount),
    budgetAmount: toNumberOrNull(payload.budgetAmount),
    metadata: resolvedMetadata,
    createdByStaffProfileId: payload.createdByStaffProfileId || null,
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
    closedAt: payload.closedAt || null,
  };
};

const recomputeInterventionCounts = plans => {
  let open = 0;
  let total = 0;
  plans.forEach(plan => {
    const list = Array.isArray(plan.interventions) ? plan.interventions : [];
    total += list.length;
    list.forEach(item => {
      if (isOpenInterventionStatus(item?.status)) {
        open += 1;
      }
    });
  });
  return { open, total };
};

const mergeRecurrenceMetadata = (intervention, sourcePayload) => {
  if (!intervention || !sourcePayload) {
    return intervention;
  }
  const existingCostSettings = intervention.metadata?.costSettings;
  const payloadCostSettings =
    sourcePayload.metadata?.costSettings || sourcePayload.costSettings || null;
  if (!payloadCostSettings || existingCostSettings) {
    const existingCostType = intervention.metadata?.costType;
    const payloadCostType = sourcePayload.metadata?.costType || sourcePayload.costType || null;
    if (!existingCostType && payloadCostType) {
      return {
        ...intervention,
        metadata: { ...(intervention.metadata || {}), costType: payloadCostType },
      };
    }
    return intervention;
  }
  const metadata = { ...(intervention.metadata || {}) };
  metadata.costSettings = {
    type: payloadCostSettings.type || sourcePayload.costType || "one_time",
    period: payloadCostSettings.period ?? "",
    amountPerPeriod: payloadCostSettings.amountPerPeriod ?? null,
    occurrences: payloadCostSettings.occurrences ?? null,
    calculatedTotal: payloadCostSettings.calculatedTotal ?? intervention.cost ?? null,
  };
  if (sourcePayload.metadata?.costType || sourcePayload.costType) {
    metadata.costType = sourcePayload.metadata?.costType || sourcePayload.costType;
  }
  if (sourcePayload.metadata?.recurrence) {
    metadata.recurrence = sourcePayload.metadata.recurrence;
  }
  return { ...intervention, metadata };
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

const buildDummyCase = caseId => ({
  id: caseId,
  eligibility: "CRF",
  client: {
    name: "Mary Cardinal",
    dateOfBirth: "1996-08-14",
    region: "Prairies",
  },
  agreementNumber: "CRF-1234567",
  owner: { id: "user-83", name: "Shelley Stacey" },
  status: "ready-to-close",
  updatedAt: "2025-10-25T12:34:00Z",
  actionPlans: [
    {
      id: "plan-001",
      title: "Skills Development 2025",
      startDate: "2025-04-12",
      endDate: "2026-03-31",
      status: "open",
      interventions: [
        {
          id: "int-001",
          code: "01",
          title: "Vocational training",
          startDate: "2025-05-01",
          endDate: "2025-08-30",
          outcome: "In progress",
          durationWeeks: 16,
          cost: 42000,
          potId: "pot-training",
          noc: "7241",
          nocVersion: "2016",
          notes: "Participant enrolled at local college.",
          compliance: { finance: "ok", ilmp: "pending" },
        },
      ],
    },
  ],
  documents: [
    {
      id: "doc-001",
      name: "Training provider invoice.pdf",
      uploadedBy: "Shelley Stacey",
      uploadedAt: "2025-06-15T09:12:00Z",
    },
  ],
  notes: [
    {
      id: "note-001",
      author: "Avery Martin",
      createdAt: "2025-10-02T14:05:00Z",
      body: "Follow-up required with training provider to confirm attendance.",
    },
  ],
  finance: {
    allocated: 160000,
    committed: 14250,
    actuals: 128400,
    variance: 31600,
    pots: [
      { id: "pot-training", name: "Skills training", allocated: 90000, committed: 5000, actual: 48000 },
      { id: "pot-supports", name: "Participant supports", allocated: 70000, committed: 9250, actual: 80400 },
    ],
  },
  compliance: {
    ilmp: { status: "clean", messages: [] },
    finance: { status: "warning", messages: ["Mapping missing for childcare support", "Overspend in supports pot"] },
  },
  exportPreview: {
    ilmp: {
      xml: "<ILMP>Dummy payload for preview</ILMP>",
      generatedAt: "2025-10-25T12:34:00Z",
      storageKey: "dummy/ilmp.xml",
      checksum: "dummy-checksum",
    },
  },
  counts: {
    openTasks: 2,
    overdueTasks: 1,
    openInterventions: 1,
    totalInterventions: 3,
  },
});

const buildCaseFromWorkspaceApi = (caseId, payload) => {
  if (!payload || typeof payload !== "object") {
    return buildDummyCase(caseId);
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
    applicationStatus: payload.applicationStatus ?? payload.application_status ?? null,
    riskRating: payload.riskRating ?? null,
    openedAt: payload.openedAt ?? null,
    closedAt: payload.closedAt ?? null,
    updatedAt: payload.updatedAt ?? null,
    nextActionDueAt: payload.nextActionDueAt ?? null,
    agreementNumber: payload.agreementNumber ?? payload.trackingId ?? null,
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

const getStoredLivePreference = () => true;

const CaseWorkspaceContext = createContext({
  caseId: null,
  caseData: null,
  isLoading: false,
  error: null,
  refresh: () => Promise.resolve(),
  createActionPlan: () => Promise.resolve({}),
  updateActionPlan: () => Promise.resolve(),
  createIntervention: () => Promise.resolve({}),
  updateIntervention: () => Promise.resolve({}),
  closeIntervention: () => Promise.resolve({}),
  runComplianceChecks: () => Promise.resolve(),
  prepareIlmpExport: () => Promise.resolve({}),
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

export const CaseWorkspaceProvider = ({ caseId, children }) => {
  const [state, setState] = useState({
    caseData: null,
    isLoading: false,
    error: null,
  });
  const [selectedActionPlanId, setSelectedActionPlanId] = useState(null);
  const [selectedInterventionId, setSelectedInterventionId] = useState(null);
  const [useLiveData, setUseLiveData] = useState(() => getStoredLivePreference());
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
      if (!useLiveData) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const data = buildDummyCase(caseId);
        setState({ caseData: data, isLoading: false, error: null });
        setSelectedActionPlanId(prev => prev ?? data.actionPlans?.[0]?.id ?? null);
        return data;
      }

      const fetchOnce = async () => {
        const resp = await apiFetch(`/api/cases/${caseId}/workspace`, { method: "GET" });
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
      setSelectedActionPlanId(data.actionPlans?.[0]?.id ?? null);
      return data;
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error: error?.message || "Failed to load case." }));
      throw error;
    }
  }, [caseId, useLiveData]);

  useEffect(() => {
    loadCase().catch(() => {});
  }, [loadCase]);

  useEffect(() => {
    const handler = event => {
      if (event?.detail && typeof event.detail.useLiveCases === "boolean") {
        setUseLiveData(event.detail.useLiveCases);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("iset-portfolio:cases-data-mode", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("iset-portfolio:cases-data-mode", handler);
      }
    };
  }, []);

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
      intervention = mergeRecurrenceMetadata(intervention, payload);
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
      intervention = mergeRecurrenceMetadata(intervention, payload);
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
      body: JSON.stringify({ status: "active" }),
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
          status: "active",
          closedAt: null,
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
    updateIntervention,
    closeIntervention,
    runComplianceChecks,
    prepareIlmpExport,
    markReadyToClose,
    closeCase,
    reopenCase,
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
  }), [caseId, state, loadCase, createActionPlan, updateActionPlan, createIntervention, updateIntervention, closeIntervention, runComplianceChecks, prepareIlmpExport, markReadyToClose, fetchActionPlanContext, upsertActionPlanReviewReminder, saveCaseContext, deleteActionPlan, deleteIntervention, interventionCodes, interventionCodesLoading, loadInterventionCodes, interventionOutcomes, interventionOutcomesLoading, loadInterventionOutcomes, fundingStreams, fundingStreamsLoading, loadFundingStreams, nocVersions, nocVersionsLoading, loadNocVersions, searchNocCodes, activateActionPlan, closeActionPlan, selectedActionPlanId, selectedInterventionId, getInterventionWizardStep, getInterventionWizardKeyForCase, getInterventionWizardDraft, setInterventionWizardStep, setInterventionWizardDraft, clearInterventionWizardStep, clearInterventionWizardDraft]);

  return (
    <CaseWorkspaceContext.Provider value={contextValue}>
      {children}
    </CaseWorkspaceContext.Provider>
  );
};

export const useCaseWorkspace = () => useContext(CaseWorkspaceContext);

export default CaseWorkspaceContext;
