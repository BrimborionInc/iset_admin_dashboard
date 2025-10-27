import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../auth/apiClient.js";

const LIVE_CASES_STORAGE_KEY = "iset-demo-use-live-cases";

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
  const counts = payload.counts || {};
  const normaliseCount = value => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const rawActionPlans = Array.isArray(payload.actionPlans) ? payload.actionPlans : [];
  const actionPlans = rawActionPlans.map(plan => ({
    id: plan.id,
    title: plan.name || plan.title || "Untitled",
    status: plan.status || null,
    startDate: plan.effectiveDate || plan.startDate || null,
    endDate: plan.reviewDate || plan.endDate || null,
    summary: plan.summary || null,
    ownerStaffProfileId: plan.ownerStaffProfileId || null,
    ownerUserId: plan.ownerUserId || null,
    interventionCount: Number.isFinite(plan.interventionCount) ? plan.interventionCount : 0,
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

  return {
    id: payload.id ?? caseId,
    applicationId: payload.applicationId ?? payload.application_id ?? null,
    application_id: payload.applicationId ?? payload.application_id ?? null,
    caseNumber: payload.caseNumber ?? null,
    status: payload.status ?? null,
    stage: payload.stage ?? null,
    subStage: payload.subStage ?? null,
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
    actionPlans,
    documents: Array.isArray(payload.documents) ? payload.documents : [],
    notes: Array.isArray(payload.notes) ? payload.notes : [],
    finance: payload.finance ?? null,
    compliance: payload.compliance ?? null,
    eligibility: payload.eligibility ?? null,
  };
};

const getStoredLivePreference = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LIVE_CASES_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const CaseWorkspaceContext = createContext({
  caseId: null,
  caseData: null,
  isLoading: false,
  error: null,
  refresh: () => Promise.resolve(),
  createActionPlan: () => Promise.resolve({}),
  updateActionPlan: () => Promise.resolve(),
  updateIntervention: () => Promise.resolve(),
  runComplianceChecks: () => Promise.resolve(),
  fetchActionPlanContext: () => Promise.resolve({}),
  selectedActionPlanId: null,
  setSelectedActionPlanId: () => {},
});

export const CaseWorkspaceProvider = ({ caseId, children }) => {
  const [state, setState] = useState({
    caseData: null,
    isLoading: false,
    error: null,
  });
  const [selectedActionPlanId, setSelectedActionPlanId] = useState(null);
  const [useLiveData, setUseLiveData] = useState(() => getStoredLivePreference());

  const loadCase = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      if (!useLiveData) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const data = buildDummyCase(caseId);
        setState({ caseData: data, isLoading: false, error: null });
        setSelectedActionPlanId(prev => prev ?? data.actionPlans?.[0]?.id ?? null);
        return data;
      }

      const response = await apiFetch(`/api/cases/${caseId}/workspace`, { method: "GET" });
      if (!response.ok) {
        const error = new Error("Failed to load case.");
        error.status = response.status;
        throw error;
      }
      const payload = await response.json();
      const data = buildCaseFromWorkspaceApi(caseId, payload);
      setState({ caseData: data, isLoading: false, error: null });
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

  const updateActionPlan = useCallback(async (actionPlanId, updates) => {
    // TODO: call `/api/action-plans/${actionPlanId}` with payload
    setState(prev => {
      if (!prev.caseData) return prev;
      const nextPlans = prev.caseData.actionPlans.map(plan =>
        plan.id === actionPlanId ? { ...plan, ...updates } : plan
      );
      return { ...prev, caseData: { ...prev.caseData, actionPlans: nextPlans } };
    });
  }, []);

  const updateIntervention = useCallback(async (actionPlanId, interventionId, updates) => {
    // TODO: call `/api/interventions/${interventionId}` with payload
    setState(prev => {
      if (!prev.caseData) return prev;
      const nextPlans = prev.caseData.actionPlans.map(plan => {
        if (plan.id !== actionPlanId) return plan;
        const updatedInterventions = plan.interventions.map(intervention =>
          intervention.id === interventionId ? { ...intervention, ...updates } : intervention
        );
        return { ...plan, interventions: updatedInterventions };
      });
      return { ...prev, caseData: { ...prev.caseData, actionPlans: nextPlans } };
    });
  }, []);

  const runComplianceChecks = useCallback(async () => {
    // TODO: call `/api/compliance/${caseId}/validate`
    return { ilmp: "clean", finance: "warning" };
  }, [caseId]);

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
        throw error;
      }
      return response.json();
    },
    [caseId]
  );

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

  const contextValue = useMemo(() => ({
    caseId,
    caseData: state.caseData,
    isLoading: state.isLoading,
    error: state.error,
    refresh: loadCase,
    createActionPlan,
    updateActionPlan,
    updateIntervention,
    runComplianceChecks,
    fetchActionPlanContext,
    selectedActionPlanId,
    setSelectedActionPlanId,
  }), [caseId, state, loadCase, createActionPlan, updateActionPlan, updateIntervention, runComplianceChecks, fetchActionPlanContext, selectedActionPlanId]);

  return (
    <CaseWorkspaceContext.Provider value={contextValue}>
      {children}
    </CaseWorkspaceContext.Provider>
  );
};

export const useCaseWorkspace = () => useContext(CaseWorkspaceContext);

export default CaseWorkspaceContext;
