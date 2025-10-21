import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { FINANCE_PEOPLE } from "./financeDemoData.js";

const ReportsDataContext = createContext(undefined);

const reportsSeed = [
  {
    id: "FY24-Q3",
    name: "FY2024-25 Q3 Interim Report",
    type: "Interim",
    dueDate: "2025-01-31",
    agreementId: "AG-2024-001",
    stage: {
      draft: "completed",
      validation: "in_progress",
      certification: "blocked",
      submission: "pending",
    },
    signatory: {
      name: FINANCE_PEOPLE.ceo,
      role: "NWAC CEO",
      status: "pending",
      signedOn: null,
    },
    validationStatus: "in_progress",
    lastUpdated: "2025-01-12T15:04:00Z",
  },
  {
    id: "FY24-Q2",
    name: "FY2024-25 Q2 Interim Report",
    type: "Interim",
    dueDate: "2024-10-31",
    agreementId: "AG-2024-001",
    stage: {
      draft: "completed",
      validation: "completed",
      certification: "completed",
      submission: "submitted",
    },
    signatory: {
      name: FINANCE_PEOPLE.ceo,
      role: "NWAC CEO",
      status: "signed",
      signedOn: "2024-10-26T18:20:00Z",
    },
    validationStatus: "clear",
    lastUpdated: "2024-10-26T18:20:00Z",
  },
  {
    id: "FY24-YE",
    name: "FY2024-25 Year-End Report",
    type: "Year-end",
    dueDate: "2025-06-30",
    agreementId: "AG-2024-001",
    stage: {
      draft: "not_started",
      validation: "pending",
      certification: "pending",
      submission: "pending",
    },
    signatory: {
      name: FINANCE_PEOPLE.ceo,
      role: "NWAC CEO",
      status: "pending",
      signedOn: null,
    },
    validationStatus: "not_started",
    lastUpdated: null,
  },
];

const validationSeed = [
  {
    id: "VAL-204",
    reportId: "FY24-Q3",
    severity: "high",
    category: "Budget variance",
    message: "PTMA BC client services exceeded forecast after the November top-up. Provide variance note.",
    referencedAppendix: "Appendix B",
    assignedTo: FINANCE_PEOPLE.programLead,
    status: "open",
    linkedWorkspace: "/finance/budgets?pot=ptma-bc-client",
    detectedOn: "2025-01-10T14:00:00Z",
  },
  {
    id: "VAL-205",
    reportId: "FY24-Q3",
    severity: "medium",
    category: "Evidence coverage",
    message: "Telehealth reimbursement confirmations missing for three northern transactions.",
    referencedAppendix: "Appendix C",
    assignedTo: FINANCE_PEOPLE.monitoringLead,
    status: "in_progress",
    linkedWorkspace: "/finance/monitoring?view=evidence&program=ptma-northern-client",
    detectedOn: "2025-01-11T09:30:00Z",
  },
  {
    id: "VAL-187",
    reportId: "FY24-Q2",
    severity: "low",
    category: "Narrative",
    message: "Update admin flat-rate section to reflect revised GL mapping manager notes.",
    referencedAppendix: "Appendix D",
    assignedTo: FINANCE_PEOPLE.financeOfficer,
    status: "resolved",
    linkedWorkspace: "/finance/reports?report=FY24-Q2",
    detectedOn: "2024-10-20T11:42:00Z",
    resolvedOn: "2024-10-24T16:10:00Z",
  },
];

const exportsSeed = [
  {
    id: "EXP-401",
    reportId: "FY24-Q3",
    format: "XML",
    envelopeVersion: "1.4",
    generatedOn: "2025-01-12T18:15:00Z",
    channel: "GC Notify",
    status: "pending_ack",
    acknowledgementOn: null,
    hash: "9be03e4c",
  },
  {
    id: "EXP-399",
    reportId: "FY24-Q3",
    format: "PDF",
    envelopeVersion: "1.0",
    generatedOn: "2025-01-12T18:10:00Z",
    channel: "Internal",
    status: "delivered",
    acknowledgementOn: "2025-01-12T19:05:00Z",
    hash: "c1b8d913",
  },
  {
    id: "EXP-362",
    reportId: "FY24-Q2",
    format: "XML",
    envelopeVersion: "1.3",
    generatedOn: "2024-10-26T18:25:00Z",
    channel: "GC Notify",
    status: "acknowledged",
    acknowledgementOn: "2024-10-26T19:02:00Z",
    hash: "42af98d0",
  },
];

export const ReportsDataProvider = ({ children }) => {
  const [reports, setReports] = useState(reportsSeed);
  const [validationFindings, setValidationFindings] = useState(validationSeed);
  const [exportHistory, setExportHistory] = useState(exportsSeed);
  const [selectedReportId, setSelectedReportId] = useState(reportsSeed[0]?.id ?? null);

  const selectReport = useCallback(reportId => {
    setSelectedReportId(reportId);
  }, []);

  const setStageStatus = useCallback((reportId, stage, status) => {
    setReports(prev =>
      prev.map(report =>
        report.id === reportId
          ? {
              ...report,
              stage: {
                ...report.stage,
                [stage]: status,
              },
              lastUpdated: new Date().toISOString(),
            }
          : report
      )
    );
  }, []);

  const setValidationStatus = useCallback((reportId, status) => {
    setReports(prev =>
      prev.map(report =>
        report.id === reportId
          ? {
              ...report,
              validationStatus: status,
              lastUpdated: new Date().toISOString(),
            }
          : report
      )
    );
  }, []);

  const setSignatoryStatus = useCallback((reportId, status) => {
    const timestamp = status === "signed" ? new Date().toISOString() : null;
    setReports(prev =>
      prev.map(report =>
        report.id === reportId
          ? {
              ...report,
              signatory: {
                ...report.signatory,
                status,
                signedOn: timestamp,
              },
              lastUpdated: new Date().toISOString(),
            }
          : report
      )
    );
  }, []);

  const resolveFinding = useCallback((findingId, status) => {
    setValidationFindings(prev =>
      prev.map(finding =>
        finding.id === findingId
          ? {
              ...finding,
              status,
              resolvedOn: status === "resolved" ? new Date().toISOString() : finding.resolvedOn,
            }
          : finding
      )
    );
  }, []);

  const reassignFinding = useCallback((findingId, owner) => {
    setValidationFindings(prev =>
      prev.map(finding =>
        finding.id === findingId
          ? {
              ...finding,
              assignedTo: owner,
            }
          : finding
      )
    );
  }, []);

  const acknowledgeExport = useCallback(exportId => {
    const timestamp = new Date().toISOString();
    setExportHistory(prev =>
      prev.map(entry =>
        entry.id === exportId
          ? {
              ...entry,
              status: "acknowledged",
              acknowledgementOn: timestamp,
            }
          : entry
      )
    );
  }, []);

  const addExportRecord = useCallback(payload => {
    const timestamp = new Date().toISOString();
    const newEntry = {
      id: `EXP-${Math.floor(Math.random() * 900 + 100)}`,
      generatedOn: timestamp,
      status: "pending_ack",
      acknowledgementOn: null,
      hash: payload?.hash ?? Math.random().toString(16).slice(2, 10),
      ...payload,
    };
    setExportHistory(prev => [newEntry, ...prev]);
  }, []);

  const selectedReport = useMemo(
    () => reports.find(report => report.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );

  const findingsForSelectedReport = useMemo(
    () => validationFindings.filter(finding => finding.reportId === selectedReportId),
    [validationFindings, selectedReportId]
  );

  const exportsForSelectedReport = useMemo(
    () => exportHistory.filter(entry => entry.reportId === selectedReportId),
    [exportHistory, selectedReportId]
  );

  const value = useMemo(
    () => ({
      reports,
      selectedReportId,
      selectedReport,
      selectReport,
      setStageStatus,
      setValidationStatus,
      setSignatoryStatus,
      validationFindings,
      findingsForSelectedReport,
      resolveFinding,
      reassignFinding,
      exportHistory,
      exportsForSelectedReport,
      acknowledgeExport,
      addExportRecord,
    }),
    [
      reports,
      selectedReportId,
      selectedReport,
      selectReport,
      setStageStatus,
      setValidationStatus,
      setSignatoryStatus,
      validationFindings,
      findingsForSelectedReport,
      resolveFinding,
      reassignFinding,
      exportHistory,
      exportsForSelectedReport,
      acknowledgeExport,
      addExportRecord,
    ]
  );

  return <ReportsDataContext.Provider value={value}>{children}</ReportsDataContext.Provider>;
};

export const useReportsData = () => {
  const context = useContext(ReportsDataContext);
  if (!context) {
    throw new Error("useReportsData must be used within a ReportsDataProvider");
  }
  return context;
};
