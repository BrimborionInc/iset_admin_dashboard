import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../auth/apiClient";

const BudgetsDataContext = createContext(undefined);

export const defaultPotTags = {
  fundingSource: "",
  isRestricted: false,
  agreementId: "",
  fiscalYearTag: "",
};

const normalizeRegionCodes = (value = []) => {
  if (!value && value !== "") return [];
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [value];
  return Array.from(
    new Set(
      list
        .map(entry => (entry === null || entry === undefined ? "" : String(entry).trim().toUpperCase()))
        .filter(Boolean)
    )
  );
};

const parseAdminPct = value => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const BudgetsDataProvider = ({ children }) => {
  const [pots, setPots] = useState([]);
  const [selectedPotId, setSelectedPotId] = useState(null);
  const [selectedPotSource, setSelectedPotSource] = useState("active"); // "active" | "draft"
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [draftChanges, setDraftChanges] = useState([]);
  const [activeVersion, setActiveVersion] = useState({
    id: "FY2024-25",
    label: "FY2024-25",
    status: "published",
  });
  const [snapshots, setSnapshots] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizePot = useCallback(pot => {
    const meta = pot.metadata || {};
    const adminPct = meta.adminTargetPct !== undefined ? parseAdminPct(meta.adminTargetPct) : null;
    const approvals = Array.isArray(meta.approvals) ? meta.approvals : [];
    const adjustments = Array.isArray(meta.adjustments) ? meta.adjustments : [];
    const evidence = Array.isArray(meta.evidence) ? meta.evidence : [];
    const approved = Number(pot.approved) || 0;
    const adjusted = Number(pot.adjusted ?? pot.approved) || 0;
    const committed = Number(pot.committed) || 0;
    const actual = Number(pot.actual) || 0;
    const forecast = Number(pot.forecast ?? pot.adjusted ?? pot.approved) || 0;
    const remaining = adjusted - committed - actual;
    const forecastVariance = forecast - adjusted;
    const pacing = adjusted > 0 ? (actual / adjusted) * 100 : null;
    return {
      id: pot.id,
      fiscalYear: pot.fiscalYear || pot.fiscal_year || null,
      fiscalYearTag: pot.fiscalYearTag || pot.fiscal_year_tag || null,
      parentId: pot.parentId ?? null,
      name: pot.name,
      code: pot.code,
      nodeType: pot.nodeType || meta.nodeType || "budget",
      glProjectCodeExternal: pot.glProjectCodeExternal || pot.gl_project_code_external || null,
      glProjectCodeInternal: pot.glProjectCodeInternal || pot.gl_project_code_internal || null,
      fundingSource: pot.fundingSource || pot.funding_source || null,
      isRestricted:
        typeof pot.isRestricted === "boolean"
          ? pot.isRestricted
          : typeof pot.is_restricted !== "undefined"
            ? !!pot.is_restricted
            : false,
      agreementId: pot.agreementId || pot.agreement_id || null,
      owner: pot.owner || meta.owner || "Finance",
      description: meta.description || meta.policy_notes || "",
      policyNotes: meta.policyNotes || meta.policy_notes || "",
      approved,
      adjusted,
      committed,
      actual,
      forecast,
      remaining,
      forecastVariance,
      pacing,
      adminShare: Number(pot.adminShare) || 0,
      adminTargetPct: adminPct,
      adminPct,
      approvals,
      adjustments,
      evidence,
      status: pot.isActive === false ? "archived" : "published",
      regions: normalizeRegionCodes(pot.regions),
    };
  }, []);

  const loadPots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch("/api/finance/budget-pots");
      if (!resp.ok) {
        throw new Error(`Load failed: ${resp.status}`);
      }
      const data = await resp.json();
      const normalized = (data || []).map(item =>
        normalizePot({
          ...item,
          parentId: item.parentId,
          nodeType: item.nodeType || item.metadata?.nodeType,
        })
      );
      setPots(normalized);
      // Only auto-select from live pots if nothing is currently selected AND we are in an active context.
      if (selectedPotId === null && selectedPotSource === "active" && normalized.length) {
        setSelectedPotId(normalized[0].id);
        setSelectedPotSource("active");
      }
    } catch (e) {
      console.error("[Budgets] failed to load pots", e);
      setError(e.message || "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }, [normalizePot, selectedPotId]);

  const loadSnapshots = useCallback(async () => {
    try {
      const resp = await apiFetch("/api/finance/budget-snapshots");
      if (!resp.ok) return;
      const data = await resp.json();
      setSnapshots(Array.isArray(data) ? data : []);
    } catch {
      /* no-op */
    }
  }, []);

  const loadDrafts = useCallback(async () => {
    try {
      const resp = await apiFetch("/api/finance/budget-drafts");
      if (!resp.ok) return;
      const data = await resp.json();
      setDrafts(Array.isArray(data) ? data : []);
    } catch {
      /* no-op */
    }
  }, []);

  const createDraft = useCallback(
    async ({ label, notes, fiscalYear } = {}) => {
      try {
        const resp = await apiFetch("/api/finance/budget-drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, notes, payload: { fiscalYear: fiscalYear ?? null, pots } }),
        });
        if (!resp.ok) {
          throw new Error(`Draft save failed (${resp.status})`);
        }
        const data = await resp.json();
        await loadDrafts();
        if (data?.id) {
          setSelectedDraftId(data.id);
          return data.id;
        }
        return null;
      } catch (err) {
        console.error("[Budgets] failed to save draft", err);
        throw err;
      }
    },
    [pots, loadDrafts]
  );

  const deleteDraft = useCallback(
    async draftId => {
      try {
        const resp = await apiFetch(`/api/finance/budget-drafts/${draftId}`, { method: "DELETE" });
        if (!resp.ok) {
          throw new Error(`Draft delete failed (${resp.status})`);
        }
        await loadDrafts();
      } catch (err) {
        console.error("[Budgets] failed to delete draft", err);
        throw err;
      }
    },
    [loadDrafts]
  );

  useEffect(() => {
    loadPots();
    loadSnapshots();
    loadDrafts();
  }, [loadPots, loadSnapshots, loadDrafts]);

  useEffect(() => {
    if (selectedDraftId || !drafts?.length) return;
    setSelectedDraftId(drafts[0].id);
  }, [drafts, selectedDraftId]);

  const selectPot = useCallback((potId, source = "active") => {
    setSelectedPotId(potId ?? null);
    setSelectedPotSource(source || "active");
    if (potId) {
      try {
        window.dispatchEvent(
          new CustomEvent("financeBudgets:potSelected", {
            detail: { potId, source: source || "active" },
          })
        );
      } catch {
        /* noop */
      }
    }
  }, []);

  const createPot = useCallback(
    async payload => {
      try {
        const resp = await apiFetch("/api/finance/budget-pots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payload.name,
            code: payload.code,
            parentId: payload.parentId || null,
            nodeType: payload.nodeType,
            owner: payload.owner,
            regions: Array.isArray(payload.regions) ? payload.regions : undefined,
            glProjectCodeExternal: payload.glProjectCodeExternal || null,
            glProjectCodeInternal: payload.glProjectCodeInternal || null,
            agreementId: payload.agreementId || null,
            fundingSource: payload.fundingSource || null,
            isRestricted: payload.isRestricted || false,
            fiscalYearTag: payload.fiscalYearTag || null,
            approved: payload.approved,
            adjusted: payload.adjusted,
            committed: payload.committed,
            forecast: payload.forecast,
            adminShare: payload.adminShare,
            metadata: {
              description: payload.description ?? "",
              policyNotes: payload.policyNotes ?? "",
              adminTargetPct: payload.adminPct ?? null,
            },
          }),
        });
        if (!resp.ok) {
          try {
            const data = await resp.json();
            throw new Error(data?.error || `Create failed: ${resp.status}`);
          } catch (err) {
            throw err instanceof Error ? err : new Error(`Create failed: ${resp.status}`);
          }
        }
        const created = normalizePot(await resp.json());
      setPots(prev => [...prev, created]);
        setDraftChanges(prev => [
          ...prev,
          {
            id: `change-${Date.now()}`,
            potId: created.id,
            type: "create",
            summary: `Created ${created.name}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        selectPot(created.id, "active");
      } catch (e) {
        console.error("[Budgets] failed to create pot", e);
        setError(e.message || "Failed to create budget pot");
      }
    },
    [normalizePot, selectPot]
  );

  const updatePot = useCallback(
    async (potId, updates) => {
      if (!potId) {
        return;
      }
      try {
        const resp = await apiFetch(`/api/finance/budget-pots/${potId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: updates.name,
            code: updates.code,
            parentId: updates.parentId ?? null,
            nodeType: updates.nodeType,
            owner: updates.owner,
            regions: Array.isArray(updates.regions) ? updates.regions : undefined,
            glProjectCodeExternal: updates.glProjectCodeExternal ?? null,
            glProjectCodeInternal: updates.glProjectCodeInternal ?? null,
            agreementId: updates.agreementId ?? null,
            fundingSource: updates.fundingSource ?? null,
            isRestricted: typeof updates.isRestricted === "boolean" ? updates.isRestricted : undefined,
            fiscalYearTag: updates.fiscalYearTag ?? null,
            approved: updates.approved,
            adjusted: updates.adjusted,
            committed: updates.committed,
            actual: updates.actual,
            forecast: updates.forecast,
            adminShare: updates.adminShare,
            isActive: updates.status === "archived" ? false : undefined,
            metadata: {
              description: updates.description,
              policyNotes: updates.policyNotes,
              adminTargetPct: updates.adminPct,
            },
          }),
        });
        if (!resp.ok) {
          try {
            const data = await resp.json();
            throw new Error(data?.error || `Update failed: ${resp.status}`);
          } catch (err) {
            throw err instanceof Error ? err : new Error(`Update failed: ${resp.status}`);
          }
        }
        const updated = normalizePot(await resp.json());
        setPots(prev => prev.map(pot => (pot.id === updated.id ? updated : pot)));
        setDraftChanges(prev => [
          ...prev,
          {
            id: `change-${Date.now()}`,
            potId,
            type: "update",
            summary: `Updated ${updated.name ?? "budget pot"}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (e) {
        console.error("[Budgets] failed to update pot", e);
        setError(e.message || "Failed to update budget pot");
      }
    },
    [normalizePot]
  );

  const archivePot = useCallback(
    async potId => {
      if (!potId) {
        return;
      }
      await updatePot(potId, { isActive: false, status: "archived" });
    },
    [updatePot]
  );

  const publishDraftChanges = useCallback(() => {
    setDraftChanges([]);
  }, []);

  const discardDraftChanges = useCallback(() => {
    setDraftChanges([]);
    loadPots();
  }, [loadPots]);

  const selectedDraft = useMemo(() => (drafts || []).find(d => d.id === selectedDraftId) || null, [drafts, selectedDraftId]);

  const selectedDraftPots = useMemo(() => {
    if (!selectedDraft) return [];
    let payload = selectedDraft.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = null;
      }
    }
    const potsArray = payload?.pots;
    if (!Array.isArray(potsArray)) return [];
    return potsArray.map(pot => ({
      ...pot,
      regions: normalizeRegionCodes(pot.regions),
    }));
  }, [selectedDraft]);

  const selectedDraftFiscalYear = useMemo(() => {
    if (!selectedDraft) return null;
    let payload = selectedDraft.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = null;
      }
    }
    return payload?.fiscalYear ?? null;
  }, [selectedDraft]);

  const saveDraftPayload = useCallback(
    async (draftId, potsPayload, { label, notes, fiscalYear } = {}) => {
      if (!draftId) throw new Error("Draft not selected");
      const payloadFiscal = fiscalYear !== undefined ? fiscalYear : selectedDraftFiscalYear ?? null;
      const resp = await apiFetch(`/api/finance/budget-drafts/${draftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label ?? selectedDraft?.label,
          notes: notes ?? selectedDraft?.notes,
          payload: { fiscalYear: payloadFiscal, pots: potsPayload },
        }),
      });
      if (!resp.ok) {
        throw new Error(`Draft update failed (${resp.status})`);
      }
      await loadDrafts();
    },
    [selectedDraft, selectedDraftFiscalYear, loadDrafts]
  );

  const ensureDraftSelected = useCallback(async () => {
    if (selectedDraftId) return selectedDraftId;
    const newId = await createDraft({
      label: `Draft ${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
      fiscalYear: activeVersion?.label ?? null,
    });
    return newId;
  }, [selectedDraftId, createDraft, activeVersion]);

  const draftCreateOrUpdatePot = useCallback(
    async (potId, payload) => {
      const draftId = await ensureDraftSelected();
      const matchId = potId ? String(potId) : null;
      const existing = matchId ? selectedDraftPots.find(p => String(p.id) === matchId) : null;
      const nextPots = existing
        ? selectedDraftPots.map(p => (String(p.id) === matchId ? { ...existing, ...payload } : p))
        : [...selectedDraftPots, payload];
      await saveDraftPayload(draftId, nextPots);
    },
    [ensureDraftSelected, selectedDraftPots, saveDraftPayload]
  );

  const draftArchivePot = useCallback(
    async potId => {
      const draftId = await ensureDraftSelected();
      const nextPots = selectedDraftPots.map(p =>
        String(p.id) === String(potId) ? { ...p, status: "archived" } : p
      );
      await saveDraftPayload(draftId, nextPots);
    },
    [ensureDraftSelected, selectedDraftPots, saveDraftPayload]
  );

  const draftDeletePot = useCallback(
    async potId => {
      if (!potId) return;
      const draftId = await ensureDraftSelected();
      const toRemove = new Set();
      const walk = targetId => {
        const targetKey = String(targetId);
        toRemove.add(targetKey);
        selectedDraftPots.forEach(p => {
          if (String(p.parentId ?? "") === targetKey) {
            walk(p.id);
          }
        });
      };
      walk(potId);
      const nextPots = selectedDraftPots.filter(p => !toRemove.has(String(p.id)));
      await saveDraftPayload(draftId, nextPots);
    },
    [ensureDraftSelected, selectedDraftPots, saveDraftPayload]
  );

  const createSnapshot = useCallback(
    async ({ label, notes } = {}) => {
      try {
        const resp = await apiFetch("/api/finance/budget-snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, notes }),
        });
        if (resp.ok) {
          await loadSnapshots();
        }
      } catch {
        /* no-op */
      }
    },
    [loadSnapshots]
  );

  const deleteSnapshot = useCallback(
    async snapshotId => {
      const resp = await apiFetch(`/api/finance/budget-snapshots/${snapshotId}`, { method: "DELETE" });
      if (resp.ok) {
        await loadSnapshots();
      }
    },
    [loadSnapshots]
  );

  const restoreSnapshotAsDraft = useCallback(
    async (snapshotId, { fiscalYear } = {}) => {
      const resp = await apiFetch(`/api/finance/budget-snapshots/${snapshotId}/restore-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalYear: fiscalYear ?? null }),
      });
      if (!resp.ok) {
        throw new Error(`Restore failed (${resp.status})`);
      }
      const data = await resp.json().catch(() => null);
      await loadDrafts();
      return data;
    },
    [loadDrafts]
  );

  const reloadAll = useCallback(async () => {
    await loadPots();
    await loadSnapshots();
    await loadDrafts();
  }, [loadPots, loadSnapshots, loadDrafts]);

  const publishDraft = useCallback(
    async (draftId, { fiscalYear, autoIncrementYear } = {}) => {
      if (!draftId) return;
      const resp = await apiFetch(`/api/finance/budget-drafts/${draftId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiscalYear: fiscalYear ?? selectedDraftFiscalYear ?? null,
          autoIncrementYear: autoIncrementYear ?? false,
        }),
      });
      if (!resp.ok) {
        throw new Error(`Draft publish failed (${resp.status})`);
      }
      await reloadAll();
    },
    [reloadAll, selectedDraftFiscalYear]
  );

  const value = useMemo(
    () => ({
      pots,
      selectedPotId,
      selectedPotSource,
      selectPot,
      createPot,
      updatePot,
      archivePot,
      selectedDraftId,
      setSelectedDraftId,
      selectedDraft,
      selectedDraftFiscalYear,
      selectedDraftPots,
      saveDraftPayload,
      draftCreateOrUpdatePot,
      draftArchivePot,
      draftDeletePot,
      draftChanges,
      publishDraftChanges,
      discardDraftChanges,
      drafts,
      createDraft,
      deleteDraft,
      publishDraft,
      ensureDraftSelected,
      snapshots,
      createSnapshot,
      deleteSnapshot,
      restoreSnapshotAsDraft,
      activeVersion,
      setActiveVersion,
      loading,
      error,
      reload: reloadAll,
    }),
    [
      pots,
      selectedPotId,
      selectedPotSource,
      selectPot,
      createPot,
      updatePot,
      archivePot,
      selectedDraftId,
      setSelectedDraftId,
      selectedDraft,
      selectedDraftFiscalYear,
      selectedDraftPots,
      saveDraftPayload,
      draftCreateOrUpdatePot,
      draftArchivePot,
      draftDeletePot,
      draftChanges,
      publishDraftChanges,
      discardDraftChanges,
      drafts,
      createDraft,
      deleteDraft,
      publishDraft,
      ensureDraftSelected,
      createSnapshot,
      deleteSnapshot,
      restoreSnapshotAsDraft,
      activeVersion,
      setActiveVersion,
      loading,
      error,
      reloadAll,
    ]
  );

  return <BudgetsDataContext.Provider value={value}>{children}</BudgetsDataContext.Provider>;
};

export const useBudgetsData = () => {
  const context = useContext(BudgetsDataContext);
  if (!context) {
    throw new Error("useBudgetsData must be used within a BudgetsDataProvider");
  }
  return context;
};
