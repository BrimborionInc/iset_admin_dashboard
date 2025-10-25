import { useCallback } from "react";
import { apiFetch } from "../auth/apiClient";

/**
 * Scaffold hook for portfolio-level case operations.
 * Replace dummy implementation with real API calls when endpoints are ready.
 */
export const usePortfolioCasesApi = () => {
  const fetchCases = useCallback(async (params = {}) => {
    // TODO: wire to `/api/cases`
    const query = new URLSearchParams(params).toString();
    const response = await apiFetch(`/api/cases${query ? `?${query}` : ""}`, { method: "GET" });
    if (!response.ok) {
      const error = new Error("Failed to load cases");
      error.status = response.status;
      throw error;
    }
    return response.json();
  }, []);

  const updateFilters = useCallback(async filters => {
    // TODO: persist portfolio filter preferences server-side if required
    return filters;
  }, []);

  return {
    fetchCases,
    updateFilters,
  };
};

export default usePortfolioCasesApi;
