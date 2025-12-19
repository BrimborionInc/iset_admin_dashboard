import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "../../../auth/apiClient";

const AllocationsDataContext = createContext(undefined);

const formatDate = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const computePotMetrics = pot => {
  const adjusted = Number(pot.adjusted) || 0;
  const committed = Number(pot.committed) || 0;
  const actual = Number(pot.actual) || 0;
  const adminShare = Number(pot.adminShare) || 0;
  const forecast = Number(pot.forecast) || 0;
  const available = adjusted - actual;
  const adminPct = adjusted > 0 ? (adminShare / adjusted) * 100 : null;
  const forecastVariance = adjusted > 0 ? ((forecast - adjusted) / adjusted) * 100 : null;
  return {
    available,
    adminPct,
    forecastVariance,
  };
};

const normalizeAllocation = allocation => {
  const source = allocation.sourcePotName || allocation.sourcePotId || "Source pot";
  const dest = allocation.destPotName || allocation.destPotId || "Destination pot";
  const metadata = allocation.metadata || {};
  return {
    ...allocation,
    sourcePotId: allocation.sourcePotId ? String(allocation.sourcePotId) : null,
    destinationPotId: allocation.destPotId ? String(allocation.destPotId) : null,
    title: allocation.justification || `Transfer ${source} → ${dest}`,
    potFrom: source,
    potTo: dest,
    stage: metadata.stage || "finance",
    sla: metadata.sla || "any",
    dueOn: metadata.dueOn || metadata.due_date || null,
    submittedOn: formatDate(allocation.createdAt),
    requestedBy: metadata.requestedBy || metadata.requestor || "Unassigned",
    evidence: Array.isArray(metadata.evidence) ? metadata.evidence : [],
  };
};

const normalizeSnapshot = snapshot => ({
  id: snapshot.id,
  capturedOn: formatDate(snapshot.snapshotAt || snapshot.createdAt),
  capturedBy: snapshot.createdByUserId ? `User ${snapshot.createdByUserId}` : "Unassigned",
  reason: snapshot.label || "Snapshot",
  totalMovement: snapshot.totalMovement ?? null,
  adminRate: snapshot.adminRate ?? null,
  reference: snapshot.notes || snapshot.label || null,
});

export const AllocationsDataProvider = ({ children }) => {
  const [potOptions, setPotOptions] = useState([]);
  const [potMetrics, setPotMetrics] = useState({});
  const [approvals, setApprovals] = useState([]);
  const [history, setHistory] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadPots = useCallback(async () => {
    const resp = await apiFetch("/api/finance/budget-pots");
    if (!resp.ok) {
      throw new Error(`Failed to load pots (${resp.status})`);
    }
    const data = await resp.json();
    const options = [];
    const metrics = {};
    (data || []).forEach(pot => {
      const label = pot.code ? `${pot.name} (${pot.code})` : pot.name;
      options.push({
        value: String(pot.id),
        label,
        parentId: pot.parentId || pot.parent_id || null,
        nodeType: pot.nodeType || pot.node_type || pot.metadata?.nodeType || null,
      });
      metrics[pot.id] = computePotMetrics(pot);
    });
    setPotOptions(options);
    setPotMetrics(metrics);
  }, []);

  const loadAllocations = useCallback(async () => {
    const resp = await apiFetch("/api/finance/allocations");
    if (!resp.ok) {
      throw new Error(`Failed to load allocations (${resp.status})`);
    }
    const data = await resp.json();
    const normalized = (Array.isArray(data) ? data : []).map(normalizeAllocation);
    setApprovals(normalized.filter(item => item.status === "proposed"));
    setHistory(
      normalized
        .map(item => {
          const approvedOn = item.appliedAt || item.approvedAt || item.updatedAt || item.createdAt;
          const metadata = item.metadata || {};
          return {
            id: item.id,
            transferId: item.id,
            approvedOn: formatDate(approvedOn),
            summary:
              item.justification ||
              `Transfer ${item.sourcePotName || ""} → ${item.destPotName || ""}`.trim(),
            amount: item.amount,
            potFrom: item.sourcePotName || item.sourcePotId || "Source pot",
            potTo: item.destPotName || item.destPotId || "Destination pot",
            status: item.status,
            approvedBy: Array.isArray(metadata.approvers) ? metadata.approvers : [],
            before: metadata.beforeBalances || {},
            after: metadata.afterBalances || {},
            evidence: Array.isArray(metadata.evidence) ? metadata.evidence : [],
            metadata,
            createdAt: item.createdAt || null,
          };
        })
        .sort((a, b) => {
          const dateA = a.createdAt || a.approvedOn || "";
          const dateB = b.createdAt || b.approvedOn || "";
          return dateA > dateB ? -1 : dateA < dateB ? 1 : 0;
        })
    );
  }, []);

  const loadSnapshots = useCallback(async () => {
    const resp = await apiFetch("/api/finance/budget-snapshots");
    if (!resp.ok) {
      throw new Error(`Failed to load snapshots (${resp.status})`);
    }
    const data = await resp.json();
    setSnapshots((Array.isArray(data) ? data : []).map(normalizeSnapshot));
  }, []);

  const createAllocation = useCallback(
    async payload => {
      const resp = await apiFetch("/api/finance/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        let errPayload = null;
        try {
          errPayload = await resp.json();
        } catch (_) {
          /* ignore */
        }
        const errorCode = errPayload?.error || `Allocation submit failed (${resp.status})`;
        if (errorCode === "allocation_policy_violation") {
          return { ok: false, violations: errPayload?.violations || [], error: errorCode };
        }
        throw new Error(errorCode);
      }
      const data = await resp.json();
      await loadAllocations();
      return { ok: true, allocation: data };
    },
    [loadAllocations]
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadPots(), loadAllocations(), loadSnapshots()]);
    } catch (err) {
      console.error("[Allocations] load failed", err);
      setError(err.message || "Failed to load allocations data");
    } finally {
      setLoading(false);
    }
  }, [loadAllocations, loadPots, loadSnapshots]);

  const approveAllocation = useCallback(
    async allocationId => {
      const resp = await apiFetch(`/api/finance/allocations/${allocationId}/approve`, {
        method: "POST",
      });
      if (!resp.ok) {
        throw new Error(`Approve failed (${resp.status})`);
      }
      await refreshAll();
    },
    [refreshAll]
  );

  const rejectAllocation = useCallback(
    async (allocationId, reason) => {
      const resp = await apiFetch(`/api/finance/allocations/${allocationId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!resp.ok) {
        throw new Error(`Reject failed (${resp.status})`);
      }
      await refreshAll();
    },
    [refreshAll]
  );

  const applyAllocation = useCallback(
    async allocationId => {
      const resp = await apiFetch(`/api/finance/allocations/${allocationId}/apply`, {
        method: "POST",
      });
      if (!resp.ok) {
        throw new Error(`Apply failed (${resp.status})`);
      }
      await refreshAll();
    },
    [refreshAll]
  );

  const scheduleAllocation = useCallback(
    async allocationId => {
      const resp = await apiFetch(`/api/finance/allocations/${allocationId}/schedule-apply`, {
        method: "POST",
      });
      if (!resp.ok) {
        throw new Error(`Schedule failed (${resp.status})`);
      }
      await refreshAll();
    },
    [refreshAll]
  );

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const value = useMemo(
    () => ({
      loading,
      error,
      potOptions,
      potMetrics,
      approvals,
      history,
      snapshots,
      refreshAll,
      createAllocation,
      approveAllocation,
      rejectAllocation,
      applyAllocation,
      scheduleAllocation,
    }),
    [
      applyAllocation,
      approvals,
      approveAllocation,
      createAllocation,
      error,
      history,
      loading,
      potMetrics,
      potOptions,
      refreshAll,
      scheduleAllocation,
      rejectAllocation,
      snapshots,
    ]
  );

  return <AllocationsDataContext.Provider value={value}>{children}</AllocationsDataContext.Provider>;
};

export const useAllocationsData = () => {
  const ctx = useContext(AllocationsDataContext);
  if (!ctx) {
    throw new Error("useAllocationsData must be used within AllocationsDataProvider");
  }
  return ctx;
};
