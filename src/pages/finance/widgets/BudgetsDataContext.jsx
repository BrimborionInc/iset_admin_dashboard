import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { FINANCE_POT_DETAILS, FINANCE_POT_HIERARCHY } from "./financeDemoData.js";

const hierarchySeed = FINANCE_POT_HIERARCHY.map(pot => ({ ...pot }));
const potDetailsSeed = JSON.parse(JSON.stringify(FINANCE_POT_DETAILS));

const BudgetsDataContext = createContext(undefined);

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

const cloneArray = source => (Array.isArray(source) ? source.map(item => ({ ...item })) : []);

const seedPots = hierarchySeed.map(pot => {
  const detail = potDetailsSeed[pot.id] ?? {};
  return {
    ...pot,
    name: detail.title ?? pot.name,
    owner: detail.owner ?? "Finance",
    description: detail.description ?? "",
    policyNotes: detail.policyNotes ?? "",
    adminTargetPct: parseAdminPct(detail.adminPct),
    approvals: cloneArray(detail.approvals),
    adjustments: cloneArray(detail.adjustments),
    evidence: cloneArray(detail.evidence),
    status: "published",
  };
});

const initialSnapshots = [
  {
    id: "snapshot-fy24-initial",
    label: "FY2024-25 published plan",
    capturedOn: "2024-04-01",
    capturedBy: "Finance Officer",
    notes: "Baseline approved structure imported from agreement.",
  },
];

const clonePots = (source = []) =>
  source.map(pot => ({
    ...pot,
    approvals: cloneArray(pot.approvals),
    adjustments: cloneArray(pot.adjustments),
    evidence: cloneArray(pot.evidence),
  }));

export const BudgetsDataProvider = ({ children }) => {
  const [publishedSnapshot, setPublishedSnapshot] = useState(clonePots(seedPots));
  const [pots, setPots] = useState(clonePots(seedPots));
  const [selectedPotId, setSelectedPotId] = useState(seedPots[0]?.id ?? null);
  const [draftChanges, setDraftChanges] = useState([]);
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [activeVersion, setActiveVersion] = useState({
    id: "FY2024-25",
    label: "FY2024-25",
    status: "published",
  });

  const selectPot = useCallback(potId => {
    setSelectedPotId(potId ?? null);
    if (potId) {
      try {
        window.dispatchEvent(
          new CustomEvent("financeBudgets:potSelected", {
            detail: { potId },
          })
        );
      } catch {
        /* noop */
      }
    }
  }, []);

  const createPot = useCallback(
    payload => {
      let newPot;
      setPots(prev => {
        const parent = payload.parentId ? prev.find(item => item.id === payload.parentId) : undefined;
        const id = payload.id ?? `pot-${Date.now()}`;
        const adjusted = Number(payload.adjusted ?? payload.approved ?? 0) || 0;
        const adminPct = payload.adminPct !== undefined ? Number(payload.adminPct) || 0 : undefined;
        const adminShare =
          payload.adminShare !== undefined
            ? Number(payload.adminShare) || 0
            : adminPct
              ? (adminPct / 100) * adjusted
              : 0;
        newPot = {
          id,
          parentId: payload.parentId ?? null,
          name: payload.name ?? "New budget pot",
          code: payload.code ?? `POT-${Math.floor(Math.random() * 900 + 100)}`,
          nodeType: payload.nodeType ?? (parent ? "Program" : "Funding stream"),
          approved: Number(payload.approved) || 0,
          adjusted,
          committed: Number(payload.committed) || 0,
          actual: Number(payload.actual) || 0,
          forecast: Number(payload.forecast ?? adjusted) || 0,
          adminShare,
          owner: payload.owner ?? "Finance Officer",
          description: payload.description ?? "",
          policyNotes: payload.policyNotes ?? "",
          adminTargetPct: adminPct ?? null,
          approvals: [],
          adjustments: [],
          evidence: [],
          status: "draft",
        };
        return [...prev, newPot];
      });
      if (!newPot) {
        return;
      }
      setDraftChanges(prev => [
        ...prev,
        {
          id: `change-${Date.now()}`,
          potId: newPot.id,
          type: "create",
          summary: `Created ${newPot.name}`,
          timestamp: new Date().toISOString(),
        },
      ]);
      selectPot(newPot.id);
    },
    [selectPot]
  );

  const updatePot = useCallback((potId, updates) => {
    if (!potId) {
      return;
    }
    let updatedName = null;
    setPots(prev =>
      prev.map(pot => {
        if (pot.id !== potId) {
          return pot;
        }
        const adminPct =
          updates.adminPct !== undefined ? Number(updates.adminPct) || 0 : pot.adminTargetPct ?? null;
        const adjusted =
          updates.adjusted !== undefined ? Number(updates.adjusted) || 0 : pot.adjusted;
        const adminShare =
          updates.adminShare !== undefined
            ? Number(updates.adminShare) || 0
            : adminPct
              ? (adminPct / 100) * adjusted
              : pot.adminShare;
        updatedName = updates.name ?? pot.name;
        return {
          ...pot,
          name: updates.name ?? pot.name,
          code: updates.code ?? pot.code,
          parentId: updates.parentId !== undefined ? updates.parentId : pot.parentId,
          nodeType: updates.nodeType ?? pot.nodeType,
          owner: updates.owner ?? pot.owner,
          description: updates.description ?? pot.description,
          policyNotes: updates.policyNotes ?? pot.policyNotes,
          approved: updates.approved !== undefined ? Number(updates.approved) || 0 : pot.approved,
          adjusted,
          committed: updates.committed !== undefined ? Number(updates.committed) || 0 : pot.committed,
          actual: updates.actual !== undefined ? Number(updates.actual) || 0 : pot.actual,
          forecast: updates.forecast !== undefined ? Number(updates.forecast) || 0 : pot.forecast,
          adminShare,
          adminTargetPct: adminPct,
          approvals: updates.approvals ?? pot.approvals,
          adjustments: updates.adjustments ?? pot.adjustments,
          evidence: updates.evidence ?? pot.evidence,
          status:
            pot.status === "archived"
              ? "archived"
              : pot.status === "published"
                ? "pending"
                : pot.status,
        };
      })
    );
    setDraftChanges(prev => [
      ...prev,
      {
        id: `change-${Date.now()}`,
        potId,
        type: "update",
        summary: `Updated ${updatedName ?? "budget pot"}`,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const archivePot = useCallback(potId => {
    if (!potId) {
      return;
    }
    setPots(prev =>
      prev.map(pot => (pot.id === potId ? { ...pot, status: "archived" } : pot))
    );
    setDraftChanges(prev => [
      ...prev,
      {
        id: `change-${Date.now()}`,
        potId,
        type: "archive",
        summary: `Archived ${potId}`,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const publishDraftChanges = useCallback(
    ({ label, notes, capturedBy } = {}) => {
      const timestamp = new Date().toISOString();
      setPublishedSnapshot(clonePots(pots));
      setPots(prev =>
        prev.map(pot =>
          pot.status === "archived"
            ? pot
            : {
                ...pot,
                status: "published",
              }
        )
      );
      setDraftChanges([]);
      setSnapshots(prev => [
        ...prev,
        {
          id: `snapshot-${timestamp}`,
          label: label ?? `Published draft ${timestamp.slice(0, 19).replace("T", " ")}`,
          capturedOn: timestamp.slice(0, 10),
          capturedBy: capturedBy ?? "Finance Officer",
          notes: notes ?? "Structure published from Budgets workspace.",
        },
      ]);
    },
    [pots]
  );

  const discardDraftChanges = useCallback(() => {
    const restored = clonePots(publishedSnapshot);
    setPots(restored);
    setDraftChanges([]);
    if (!restored.some(pot => pot.id === selectedPotId)) {
      selectPot(restored[0]?.id ?? null);
    }
  }, [publishedSnapshot, selectPot, selectedPotId]);

  const createSnapshot = useCallback(
    ({ label, notes, capturedBy } = {}) => {
      const timestamp = new Date().toISOString();
      setSnapshots(prev => [
        ...prev,
        {
          id: `snapshot-${timestamp}`,
          label: label ?? `Draft snapshot ${timestamp.slice(0, 19).replace("T", " ")}`,
          capturedOn: timestamp.slice(0, 10),
          capturedBy: capturedBy ?? "Finance Officer",
          notes: notes ?? "Manual snapshot from Budgets workspace.",
        },
      ]);
    },
    []
  );

  const value = useMemo(
    () => ({
      pots,
      selectedPotId,
      selectPot,
      createPot,
      updatePot,
      archivePot,
      draftChanges,
      publishDraftChanges,
      discardDraftChanges,
      snapshots,
      createSnapshot,
      activeVersion,
      setActiveVersion,
      publishedSnapshot,
    }),
    [
      pots,
      selectedPotId,
      selectPot,
      createPot,
      updatePot,
      archivePot,
      draftChanges,
      publishDraftChanges,
      discardDraftChanges,
      snapshots,
      createSnapshot,
      activeVersion,
      setActiveVersion,
      publishedSnapshot,
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
