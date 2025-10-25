import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const buildDummyCase = caseId => ({
  id: caseId,
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
});

const CaseWorkspaceContext = createContext({
  caseId: null,
  caseData: null,
  isLoading: false,
  error: null,
  refresh: () => Promise.resolve(),
  updateActionPlan: () => Promise.resolve(),
  updateIntervention: () => Promise.resolve(),
  runComplianceChecks: () => Promise.resolve(),
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

  const loadCase = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      // TODO: replace with real fetch `/api/cases/${caseId}`
      await new Promise(resolve => setTimeout(resolve, 50));
      const data = buildDummyCase(caseId);
      setState({ caseData: data, isLoading: false, error: null });
      setSelectedActionPlanId(prev => prev ?? data.actionPlans?.[0]?.id ?? null);
      return data;
    } catch (error) {
      setState({ caseData: null, isLoading: false, error: error?.message || "Failed to load case." });
      throw error;
    }
  }, [caseId]);

  useEffect(() => {
    loadCase().catch(() => {});
  }, [loadCase]);

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

  const contextValue = useMemo(() => ({
    caseId,
    caseData: state.caseData,
    isLoading: state.isLoading,
    error: state.error,
    refresh: loadCase,
    updateActionPlan,
    updateIntervention,
    runComplianceChecks,
    selectedActionPlanId,
    setSelectedActionPlanId,
  }), [caseId, state, loadCase, updateActionPlan, updateIntervention, runComplianceChecks, selectedActionPlanId]);

  return (
    <CaseWorkspaceContext.Provider value={contextValue}>
      {children}
    </CaseWorkspaceContext.Provider>
  );
};

export const useCaseWorkspace = () => useContext(CaseWorkspaceContext);

export default CaseWorkspaceContext;
