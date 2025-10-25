import { useCallback } from "react";
import { apiFetch } from "../auth/apiClient";

/**
 * Scaffold hook exposing API helpers for the Case Dashboard.
 * Replace placeholder logic with real fetch/submit requests.
 */
export const useCaseWorkspaceApi = caseId => {
  const fetchCase = useCallback(async () => {
    const response = await apiFetch(`/api/cases/${caseId}`, { method: "GET" });
    if (!response.ok) {
      const error = new Error("Failed to load case");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }, [caseId]);

  const saveActionPlan = useCallback(
    async (actionPlanId, payload) => {
      const response = await apiFetch(`/api/action-plans/${actionPlanId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = new Error("Failed to update action plan");
        error.status = response.status;
        throw error;
      }
      return response.json();
    },
    []
  );

  const saveIntervention = useCallback(async (interventionId, payload) => {
    const response = await apiFetch(`/api/interventions/${interventionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = new Error("Failed to update intervention");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }, []);

  const fetchCompliance = useCallback(async () => {
    const response = await apiFetch(`/api/compliance/${caseId}/validate`, { method: "POST" });
    if (!response.ok) {
      const error = new Error("Failed to run compliance checks");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }, [caseId]);

  const fetchFinanceSnapshot = useCallback(async () => {
    const response = await apiFetch(`/api/finance/cases/${caseId}`, { method: "GET" });
    if (!response.ok) {
      const error = new Error("Failed to load finance snapshot");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }, [caseId]);

  return {
    fetchCase,
    saveActionPlan,
    saveIntervention,
    fetchCompliance,
    fetchFinanceSnapshot,
  };
};

export default useCaseWorkspaceApi;
