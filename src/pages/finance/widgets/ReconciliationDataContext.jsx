import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { FINANCE_PEOPLE } from "./financeDemoData.js";

const ReconciliationDataContext = createContext(undefined);

const transactionsSeed = [
  {
    id: "TX-90510",
    caseId: "CASE-2103",
    date: "2024-11-02",
    amount: 1325.75,
    vendor: "Coastal Skills Society",
    potId: "ptma-bc-client",
    potName: "BC Client Services",
    stream: "PTMA British Columbia",
    exceptionType: "missing_evidence",
    status: "open",
    evidenceCount: 0,
    hasRequestedInfo: false,
    proposedPotId: "ptma-bc-client",
    notes: "EFT remittance missing after top-up disbursement; requester uploaded invoice only.",
    createdBy: FINANCE_PEOPLE.programLead,
    lastUpdated: "2024-11-03T09:40:00Z",
    priority: "high",
    attachments: [],
  },
  {
    id: "TX-90524",
    caseId: "CASE-2149",
    date: "2024-10-29",
    amount: 640.0,
    vendor: "Aurora Aviation",
    potId: "ptma-northern-client",
    potName: "Northern Client Services",
    stream: "PTMA Northern (YT/NT/NU)",
    exceptionType: "out_of_period",
    status: "in_review",
    evidenceCount: 1,
    hasRequestedInfo: true,
    proposedPotId: "ptma-northern-client",
    notes: "Travel occurred after fiscal cut-off; awaiting justification for late submission.",
    createdBy: FINANCE_PEOPLE.monitoringLead,
    lastUpdated: "2024-11-01T16:05:00Z",
    priority: "medium",
    attachments: [{ id: "EV-5720", name: "Boarding-pass.scan" }],
  },
  {
    id: "TX-90533",
    caseId: "CASE-2178",
    date: "2024-11-04",
    amount: 18450.0,
    vendor: "Summit Advisory Group",
    potId: "nwac-admin",
    potName: "NWAC Administration",
    stream: "NWAC Administration",
    exceptionType: "ineligible_vendor",
    status: "open",
    evidenceCount: 2,
    hasRequestedInfo: false,
    proposedPotId: "nwac-admin",
    notes: "Consultant not on approved vendor list for policy support contract.",
    createdBy: "Case ingest service",
    lastUpdated: "2024-11-04T12:18:00Z",
    priority: "critical",
    attachments: [
      { id: "EV-5801", name: "Statement of work.pdf" },
      { id: "EV-5802", name: "Contract-draft.docx" },
    ],
  },
  {
    id: "TX-90541",
    caseId: "CASE-2195",
    date: "2024-11-05",
    amount: 342.2,
    vendor: "Prairie Coach Lines",
    potId: "ptma-prairies-client",
    potName: "Prairies Client Services",
    stream: "PTMA Prairies (MB/SK)",
    exceptionType: "duplicate_claim",
    status: "pending",
    evidenceCount: 1,
    hasRequestedInfo: false,
    proposedPotId: "ptma-prairies-client",
    notes: "Potential duplicate with TX-90198 — both reference same workshop travel.",
    createdBy: "Case ingest service",
    lastUpdated: "2024-11-05T08:55:00Z",
    priority: "medium",
    attachments: [{ id: "EV-5824", name: "Travel invoice.pdf" }],
  },
];

const syncSeed = {
  lastSync: "2024-10-04T11:30:00Z",
  ingestDuration: "4m 21s",
  backlog: {
    critical: 3,
    warning: 9,
    info: 24,
  },
  status: "warning",
  nextSchedule: "2024-10-04T13:00:00Z",
  errors: [
    {
      id: "ERR-4508",
      time: "2024-10-04T07:45:00Z",
      severity: "warning",
      message: "Case ingest queue delayed by 15 minutes.",
      suggestedAction: "Monitor queue depth; rerun if backlog persists.",
    },
  ],
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
  const [transactions, setTransactions] = useState(transactionsSeed);
  const [selectedTransactionId, setSelectedTransactionId] = useState(
    transactionsSeed[0]?.id ?? null
  );
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
  const [syncStatus, setSyncStatus] = useState(syncSeed);
  const [bulkMessage, setBulkMessage] = useState("");
  const [selectedBulkTemplate, setSelectedBulkTemplate] = useState(bulkActionTemplates[0]);

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

  const resolveTransactions = useCallback((ids, status, note) => {
    if (!Array.isArray(ids) || !ids.length) {
      return;
    }
    const timestamp = new Date().toISOString();
    setTransactions(prev =>
      prev.map(tx =>
        ids.includes(tx.id)
          ? {
              ...tx,
              status,
              lastUpdated: timestamp,
              resolutionNote: note ?? "",
            }
          : tx
      )
    );
    setSelectedTransactionIds([]);
    if (ids.includes(selectedTransactionId)) {
      setSelectedTransactionId(ids[0]);
    }
  }, [selectedTransactionId]);

  const requestEvidence = useCallback((ids, message) => {
    if (!Array.isArray(ids) || !ids.length) {
      return;
    }
    setTransactions(prev =>
      prev.map(tx =>
        ids.includes(tx.id)
          ? {
              ...tx,
              hasRequestedInfo: true,
              lastUpdated: new Date().toISOString(),
              latestRequestMessage: message,
            }
          : tx
      )
    );
  }, []);

  const manualSync = useCallback(() => {
    const timestamp = new Date().toISOString();
    setSyncStatus(prev => ({
      ...prev,
      lastSync: timestamp,
      backlog: { critical: 1, warning: 4, info: 12 },
      status: "info",
      errors: prev.errors.slice(0, 1),
    }));
  }, []);

  const value = useMemo(
    () => ({
      transactions,
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
