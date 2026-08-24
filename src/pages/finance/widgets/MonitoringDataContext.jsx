import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { FINANCE_PEOPLE } from "./financeDemoData.js";

const MonitoringDataContext = createContext(undefined);

const coverageSeed = [
  {
    id: "ptma-bc-client",
    program: "BC Client Services",
    potId: "ptma-bc-client",
    coverage: 0.78,
    target: 0.9,
    missingCount: 7,
    risk: "warning",
    evidenceDue: "2025-02-05",
    owner: FINANCE_PEOPLE.programLead,
  },
  {
    id: "ptma-on-client",
    program: "Ontario Client Services",
    potId: "ptma-on-client",
    coverage: 0.89,
    target: 0.9,
    missingCount: 3,
    risk: "success",
    evidenceDue: "2025-01-28",
    owner: FINANCE_PEOPLE.nwacAdministrator,
  },
  {
    id: "ptma-northern-client",
    program: "Northern Client Services",
    potId: "ptma-northern-client",
    coverage: 0.64,
    target: 0.85,
    missingCount: 12,
    risk: "error",
    evidenceDue: "2025-02-18",
    owner: FINANCE_PEOPLE.monitoringLead,
  },
];

const samplingSeed = [
  {
    id: "SAMPLE-Q3-BC",
    label: "BC PTMA Q3 sample",
    tier: "Enhancement",
    size: 20,
    status: "in_progress",
    reviewer: FINANCE_PEOPLE.programLead,
    dueDate: "2025-02-07",
    rationale: "Focus on top-up cohort transactions exceeding $5K.",
    completed: 9,
  },
  {
    id: "SAMPLE-Q2-NTH",
    label: "Northern telehealth review",
    tier: "Building",
    size: 12,
    status: "queued",
    reviewer: FINANCE_PEOPLE.monitoringLead,
    dueDate: "2025-01-30",
    rationale: "Triggered by evidence gap F-312 for Nunavut wellness travel.",
    completed: 0,
  },
  {
    id: "SAMPLE-YTD-GL",
    label: "GL stewardship spot-check",
    tier: "Enhancement",
    size: 10,
    status: "completed",
    reviewer: FINANCE_PEOPLE.nwacAdministrator,
    dueDate: "2024-12-18",
    rationale: "Annual verification of PTMA admin charges vs. GL mapping.",
    completed: 10,
  },
];

const findingsSeed = [
  {
    id: "F-204",
    severity: "high",
    category: "Evidence gap",
    description: "EFT confirmations missing for BC top-up disbursements (8 transactions).",
    owner: FINANCE_PEOPLE.nwacAdministrator,
    dueDate: "2025-02-12",
    status: "open",
    relatedReport: "FY25-Q1",
    linkedWorkspace: "/finance/budgets?pot=ptma-bc-client",
  },
  {
    id: "F-198",
    severity: "medium",
    category: "Variance follow-up",
    description: "Ontario client services forecast exceeds budget by 2% — provide narrative.",
    owner: FINANCE_PEOPLE.programLead,
    dueDate: "2025-01-31",
    status: "in_progress",
    relatedReport: "FY25-Q1",
    linkedWorkspace: "/finance/reports?report=FY25-Q1",
  },
  {
    id: "F-186",
    severity: "low",
    category: "Process",
    description: "Update evidence bundle naming to match GL mapping template.",
    owner: FINANCE_PEOPLE.monitoringLead,
    dueDate: "2025-02-20",
    status: "resolved",
    relatedReport: null,
    linkedWorkspace: null,
  },
];

const bundlesSeed = [
  {
    id: "BND-2405",
    label: "Q3 Travel Evidence",
    status: "building",
    documentCount: 14,
    lastUpdated: "2025-01-12T18:20:00Z",
    requestedBy: "ESDC Monitoring",
    targetDelivery: "2025-01-26",
  },
  {
    id: "BND-2398",
    label: "Capital Assets Review",
    status: "delivered",
    documentCount: 9,
    lastUpdated: "2024-12-18T09:12:00Z",
    requestedBy: "Internal Audit",
    targetDelivery: "2024-12-19",
  },
];

export const MonitoringDataProvider = ({ children }) => {
  const [coverage, setCoverage] = useState(coverageSeed);
  const [coverageFilter, setCoverageFilter] = useState({ risk: "all", program: "all" });
  const [samplingSets, setSamplingSets] = useState(samplingSeed);
  const [findings, setFindings] = useState(findingsSeed);
  const [bundles, setBundles] = useState(bundlesSeed);
  const [selectedBundleId, setSelectedBundleId] = useState(bundlesSeed[0]?.id ?? null);

  const updateCoverageRisk = useCallback((id, risk) => {
    setCoverage(prev =>
      prev.map(entry => (entry.id === id ? { ...entry, risk } : entry))
    );
  }, []);

  const updateSamplingStatus = useCallback((id, status, completed) => {
    setSamplingSets(prev =>
      prev.map(entry =>
        entry.id === id
          ? {
              ...entry,
              status,
              completed: typeof completed === "number" ? completed : entry.completed,
            }
          : entry
      )
    );
  }, []);

  const reassignSamplingReviewer = useCallback((id, reviewer) => {
    setSamplingSets(prev =>
      prev.map(entry => (entry.id === id ? { ...entry, reviewer } : entry))
    );
  }, []);

  const updateFindingStatus = useCallback((id, status) => {
    setFindings(prev =>
      prev.map(entry => (entry.id === id ? { ...entry, status } : entry))
    );
  }, []);

  const reassignFindingOwner = useCallback((id, owner) => {
    setFindings(prev =>
      prev.map(entry => (entry.id === id ? { ...entry, owner } : entry))
    );
  }, []);

  const addBundle = useCallback(payload => {
    const timestamp = new Date().toISOString();
    const newBundle = {
      id: `BND-${Math.floor(Math.random() * 9000 + 1000)}`,
      status: "building",
      documentCount: 0,
      lastUpdated: timestamp,
      targetDelivery: payload?.targetDelivery ?? timestamp.slice(0, 10),
      ...payload,
    };
    setBundles(prev => [newBundle, ...prev]);
    setSelectedBundleId(newBundle.id);
  }, []);

  const updateBundleStatus = useCallback((id, status) => {
    setBundles(prev =>
      prev.map(bundle =>
        bundle.id === id
          ? {
              ...bundle,
              status,
              lastUpdated: new Date().toISOString(),
            }
          : bundle
      )
    );
  }, []);

  const filteredCoverage = useMemo(() => {
    return coverage.filter(entry => {
      if (coverageFilter.risk !== "all" && entry.risk !== coverageFilter.risk) {
        return false;
      }
      if (coverageFilter.program !== "all" && entry.id !== coverageFilter.program) {
        return false;
      }
      return true;
    });
  }, [coverage, coverageFilter]);

  const selectedBundle = useMemo(
    () => bundles.find(bundle => bundle.id === selectedBundleId) ?? null,
    [bundles, selectedBundleId]
  );

  const value = useMemo(
    () => ({
      coverage,
      filteredCoverage,
      coverageFilter,
      setCoverageFilter,
      updateCoverageRisk,
      samplingSets,
      updateSamplingStatus,
      reassignSamplingReviewer,
      findings,
      updateFindingStatus,
      reassignFindingOwner,
      bundles,
      selectedBundle,
      setSelectedBundleId,
      addBundle,
      updateBundleStatus,
    }),
    [
      coverage,
      filteredCoverage,
      coverageFilter,
      updateCoverageRisk,
      samplingSets,
      updateSamplingStatus,
      reassignSamplingReviewer,
      findings,
      updateFindingStatus,
      reassignFindingOwner,
      bundles,
      selectedBundle,
      addBundle,
      updateBundleStatus,
    ]
  );

  return <MonitoringDataContext.Provider value={value}>{children}</MonitoringDataContext.Provider>;
};

export const useMonitoringData = () => {
  const context = useContext(MonitoringDataContext);
  if (!context) {
    throw new Error("useMonitoringData must be used within a MonitoringDataProvider");
  }
  return context;
};
