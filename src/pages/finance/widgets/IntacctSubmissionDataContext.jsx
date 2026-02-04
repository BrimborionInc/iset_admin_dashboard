import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../../auth/apiClient";

const IntacctSubmissionDataContext = createContext(undefined);

export const IntacctSubmissionDataProvider = ({ children }) => {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const selectedRef = useRef(null);

  useEffect(() => {
    selectedRef.current = selectedSubmissionId;
  }, [selectedSubmissionId]);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch("/api/finance/intacct/submissions?limit=500", {
        method: "GET",
      });
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || `Load failed (${resp.status})`);
      }
      const payload = await resp.json().catch(() => ({}));
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setSubmissions(items);
      if (!items.length) {
        setSelectedSubmissionId(null);
      } else {
        const current = selectedRef.current;
        const exists = current ? items.some(item => item.id === current) : false;
        setSelectedSubmissionId(exists ? current : items[0].id);
      }
    } catch (err) {
      console.error("[IntacctSubmissions] failed to load submissions", err);
      setError(err?.message || "Failed to load Intacct submissions.");
      setSubmissions([]);
      setSelectedSubmissionId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const selectSubmission = useCallback(id => {
    setSelectedSubmissionId(id ?? null);
  }, []);

  const selectedSubmission = useMemo(
    () => submissions.find(item => item.id === selectedSubmissionId) ?? null,
    [submissions, selectedSubmissionId]
  );

  const value = useMemo(
    () => ({
      submissions,
      loading,
      error,
      selectedSubmissionId,
      selectedSubmission,
      selectSubmission,
      refresh: loadSubmissions,
    }),
    [submissions, loading, error, selectedSubmissionId, selectedSubmission, selectSubmission, loadSubmissions]
  );

  return (
    <IntacctSubmissionDataContext.Provider value={value}>
      {children}
    </IntacctSubmissionDataContext.Provider>
  );
};

export const useIntacctSubmissionData = () => {
  const context = useContext(IntacctSubmissionDataContext);
  if (!context) {
    throw new Error("useIntacctSubmissionData must be used within a IntacctSubmissionDataProvider");
  }
  return context;
};

export default IntacctSubmissionDataContext;
