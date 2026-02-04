import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../../auth/apiClient";

const ReconciliationDataContext = createContext(undefined);

const buildSyncStatusFromTransactions = (items, fetchedAt) => {
  const unresolved = items.filter(item => item.status !== "resolved");
  const backlog = { critical: 0, warning: 0, info: 0 };
  unresolved.forEach(item => {
    if (item.priority === "critical") {
      backlog.critical += 1;
    } else if (item.priority === "high" || item.priority === "medium") {
      backlog.warning += 1;
    } else {
      backlog.info += 1;
    }
  });
  const status =
    backlog.critical > 0 ? "error" : backlog.warning > 0 ? "warning" : "info";
  const lastUpdated = items
    .map(item => item.lastUpdated)
    .filter(Boolean)
    .map(value => new Date(value))
    .filter(date => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a)[0];
  return {
    lastSync: lastUpdated ? lastUpdated.toISOString() : fetchedAt.toISOString(),
    ingestDuration: "—",
    backlog,
    status,
    nextSchedule: null,
    errors: [],
  };
};

const bulkActionTemplates = [
  {
    id: "request-evidence",
    value: "request-evidence",
    label: "Request evidence from program staff",
    defaultMessage:
      "Please upload supporting documentation for the attached transaction(s). Target response: 3 business days.",
  },
  {
    id: "approve",
    value: "approve",
    label: "Approve as-is",
    defaultMessage:
      "Reviewed transaction(s) and confirmed eligibility. Proceeding with approval.",
  },
  {
    id: "mark-nonclaimable",
    value: "mark-nonclaimable",
    label: "Mark non-claimable",
    defaultMessage:
      "Transaction(s) deemed ineligible for reimbursement. Refer to attached notes for policy references.",
  },
];

export const ReconciliationDataProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [selectedTransactionId, setSelectedTransactionId] = useState(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
  const [syncStatus, setSyncStatus] = useState(
    buildSyncStatusFromTransactions([], new Date())
  );
  const [bulkMessage, setBulkMessage] = useState("");
  const [selectedBulkTemplate, setSelectedBulkTemplate] = useState(bulkActionTemplates[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const selectedTransactionRef = useRef(null);

  useEffect(() => {
    selectedTransactionRef.current = selectedTransactionId;
  }, [selectedTransactionId]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/finance/reconciliation/transactions?limit=500", {
        method: "GET",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || `Fetch failed (${response.status})`);
      }
      const payload = await response.json().catch(() => ({}));
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setTransactions(items);
      if (!items.length) {
        setSelectedTransactionId(null);
        setSelectedTransactionIds([]);
      } else {
        const currentSelected = selectedTransactionRef.current;
        const hasSelected = currentSelected
          ? items.some(item => item.id === currentSelected)
          : false;
        if (!hasSelected) {
          setSelectedTransactionId(items[0].id);
          setSelectedTransactionIds([items[0].id]);
        } else {
          setSelectedTransactionIds(prev =>
            {
              const filtered = prev.filter(id => items.some(item => item.id === id));
              if (!filtered.length && currentSelected) {
                return [currentSelected];
              }
              return filtered;
            }
          );
        }
      }
      setSyncStatus(buildSyncStatusFromTransactions(items, new Date()));
    } catch (err) {
      console.error("[Reconciliation] failed to load transactions", err);
      setError(err?.message || "Failed to load reconciliation transactions.");
      setTransactions([]);
      setSyncStatus(buildSyncStatusFromTransactions([], new Date()));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const selectTransaction = useCallback(transactionId => {
    setSelectedTransactionId(transactionId ?? null);
    if (transactionId && !selectedTransactionIds.includes(transactionId)) {
      setSelectedTransactionIds([transactionId]);
    }
  }, [selectedTransactionIds]);

  const updateSelection = useCallback(ids => {
    setSelectedTransactionIds(ids);
    if (ids.length === 1) {
      setSelectedTransactionId(ids[0]);
    } else if (ids.length === 0) {
      setSelectedTransactionId(null);
    }
  }, []);

  const resolveTransactions = useCallback(async (ids, resolution, note) => {
    if (!Array.isArray(ids) || !ids.length) {
      return false;
    }
    setActionError(null);
    try {
      const response = await apiFetch("/api/finance/reconciliation/transactions/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          resolution,
          note,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `Resolve failed (${response.status})`);
      }
      setSelectedTransactionIds([]);
      await loadTransactions();
      return true;
    } catch (err) {
      console.error("[Reconciliation] failed to resolve transactions", err);
      setActionError(err?.message || "Failed to resolve selected transactions.");
      return false;
    }
  }, [loadTransactions]);

  const requestEvidence = useCallback(async (ids, message) => {
    if (!Array.isArray(ids) || !ids.length) {
      return false;
    }
    setActionError(null);
    try {
      const response = await apiFetch("/api/finance/reconciliation/transactions/request-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          message,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
      }
      await loadTransactions();
      return true;
    } catch (err) {
      console.error("[Reconciliation] failed to request evidence", err);
      setActionError(err?.message || "Failed to request evidence.");
      return false;
    }
  }, [loadTransactions]);

  const manualSync = useCallback(async () => {
    await loadTransactions();
  }, [loadTransactions]);

  const value = useMemo(
    () => ({
      transactions,
      loading,
      error,
      actionError,
      selectedTransactionId,
      selectedTransactionIds,
      selectTransaction,
      updateSelection,
      resolveTransactions,
      requestEvidence,
      syncStatus,
      manualSync,
      bulkTemplates: bulkActionTemplates,
      selectedBulkTemplate,
      setSelectedBulkTemplate,
      bulkMessage,
      setBulkMessage,
    }),
    [
      transactions,
      loading,
      error,
      actionError,
      selectedTransactionId,
      selectedTransactionIds,
      selectTransaction,
      updateSelection,
      resolveTransactions,
      requestEvidence,
      syncStatus,
      manualSync,
      selectedBulkTemplate,
      setSelectedBulkTemplate,
      bulkMessage,
      setBulkMessage,
    ]
  );

  return <ReconciliationDataContext.Provider value={value}>{children}</ReconciliationDataContext.Provider>;
};

export const useReconciliationData = () => {
  const context = useContext(ReconciliationDataContext);
  if (!context) {
    throw new Error("useReconciliationData must be used within a ReconciliationDataProvider");
  }
  return context;
};
