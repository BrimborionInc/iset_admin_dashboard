import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { FINANCE_PEOPLE } from "./financeDemoData.js";

const PaymentsDataContext = createContext(undefined);

const paymentRequestsSeed = [
  {
    id: "PAY-1042",
    requester: "Madison Coppola",
    requesterRole: "ISET Program Lead",
    ptmaRegion: "PTMA British Columbia",
    potId: "ptma-bc-client",
    amount: 18250.0,
    status: "awaiting_finance",
    submittedOn: "2025-01-08",
    dueBy: "2025-01-15",
    documents: [
      { id: "DOC-7201", name: "EFT-form-BC.pdf" },
      { id: "DOC-7202", name: "Invoice-BC-TopUp.pdf" },
      { id: "DOC-7203", name: "Client-commitment-summary.xlsx" },
    ],
    notes: "Top-up for coastal cohort travel commitments triggered 95% threshold.",
    tags: ["Top-up", "Travel"],
  },
  {
    id: "PAY-1048",
    requester: "Jordan Rivers",
    requesterRole: "Monitoring Lead",
    ptmaRegion: "PTMA Northern (YT/NT/NU)",
    potId: "ptma-northern-client",
    amount: 9240.5,
    status: "awaiting_confirmation",
    submittedOn: "2025-01-04",
    dueBy: "2025-01-11",
    documents: [
      { id: "DOC-7250", name: "EFT-form-Northern.pdf" },
      { id: "DOC-7251", name: "Invoice-Telehealth-Services.pdf" },
    ],
    notes: "Telehealth wellness sessions for Nunavut communities.",
    tags: ["Telehealth"],
  },
  {
    id: "PAY-1051",
    requester: "Priya Singh",
    requesterRole: "Finance Officer",
    ptmaRegion: "NWAC Administration",
    potId: "nwac-admin",
    amount: 3250.0,
    status: "completed",
    submittedOn: "2025-01-02",
    dueBy: "2025-01-07",
    documents: [
      { id: "DOC-7284", name: "EFT-form-NWAC.pdf" },
      { id: "DOC-7285", name: "Invoice-Policy-Consultant.pdf" },
      { id: "DOC-7286", name: "Payment-confirmation.png" },
    ],
    notes: "Policy consultancy retainer for GL mapping updates.",
    tags: ["Admin", "Consulting"],
  },
  {
    id: "PAY-1054",
    requester: "Shelley Stacey",
    requesterRole: "Senior Director",
    ptmaRegion: "PTMA Prairies (MB/SK)",
    potId: "ptma-prairies-client",
    amount: 15480.75,
    status: "draft",
    submittedOn: "2025-01-12",
    dueBy: "2025-01-19",
    documents: [
      { id: "DOC-7302", name: "Invoice-Youth-Workforce.pdf" },
    ],
    notes: "Draft packet for Metis youth workforce bursaries - pending invoice validation.",
    tags: ["Draft"],
  },
];

const communicationSeed = [
  {
    id: "MSG-8101",
    paymentId: "PAY-1042",
    sentOn: "2025-01-08T10:15:00Z",
    direction: "outbound",
    sender: FINANCE_PEOPLE.programLead,
    recipients: ["finance@nwac.org"],
    subject: "Payment packet PAY-1042 submitted",
    template: "payment-request",
  },
  {
    id: "MSG-8102",
    paymentId: "PAY-1048",
    sentOn: "2025-01-06T16:45:00Z",
    direction: "outbound",
    sender: FINANCE_PEOPLE.monitoringLead,
    recipients: ["finance@nwac.org"],
    subject: "Telehealth session payment request PAY-1048",
    template: "payment-request",
  },
  {
    id: "MSG-8103",
    paymentId: "PAY-1051",
    sentOn: "2025-01-07T13:10:00Z",
    direction: "inbound",
    sender: FINANCE_PEOPLE.financeOfficer,
    recipients: ["Madison Coppola"],
    subject: "Payment confirmation PAY-1051",
    template: "payment-confirmation",
    attachments: [{ id: "ATT-4401", name: "Payment-confirmation.png" }],
  },
  {
    id: "MSG-8104",
    paymentId: "PAY-1048",
    sentOn: "2025-01-10T09:05:00Z",
    direction: "inbound",
    sender: FINANCE_PEOPLE.financeOfficer,
    recipients: ["Jordan Rivers"],
    subject: "PAY-1048 confirmation pending banking screenshot",
    template: "payment-follow-up",
  },
];

const slaSnapshotSeed = {
  awaitingFinance: 1,
  awaitingConfirmation: 1,
  completed: 1,
  draft: 1,
  overdue: 0,
  avgTurnaroundDays: 4.6,
};

export const PaymentsDataProvider = ({ children }) => {
  const [requests, setRequests] = useState(paymentRequestsSeed);
  const [selectedRequestId, setSelectedRequestId] = useState(paymentRequestsSeed[0]?.id ?? null);
  const [communications, setCommunications] = useState(communicationSeed);
  const [slaSnapshot] = useState(slaSnapshotSeed);

  const selectRequest = useCallback(requestId => {
    setSelectedRequestId(requestId ?? null);
  }, []);

  const markRequestStatus = useCallback((requestId, status, confirmationDoc) => {
    setRequests(prev =>
      prev.map(entry =>
        entry.id === requestId
          ? {
              ...entry,
              status,
              documents:
                status === "completed" && confirmationDoc
                  ? [...entry.documents, confirmationDoc]
                  : entry.documents,
            }
          : entry,
      ),
    );
    setCommunications(prev => [
      ...prev,
      {
        id: `MSG-${Math.floor(Math.random() * 9000 + 1000)}`,
        paymentId: requestId,
        sentOn: new Date().toISOString(),
        direction: "inbound",
        sender: FINANCE_PEOPLE.financeOfficer,
        recipients: [FINANCE_PEOPLE.programLead],
        subject: `Status updated to ${status}`,
        template: status === "completed" ? "payment-confirmation" : "payment-follow-up",
        attachments: confirmationDoc ? [confirmationDoc] : undefined,
      },
    ]);
  }, []);

  const addCommunication = useCallback(payload => {
    setCommunications(prev => [
      ...prev,
      {
        id: `MSG-${Math.floor(Math.random() * 9000 + 1000)}`,
        sentOn: new Date().toISOString(),
        direction: payload.direction ?? "outbound",
        sender: payload.sender ?? FINANCE_PEOPLE.financeOfficer,
        recipients: payload.recipients ?? [],
        paymentId: payload.paymentId,
        subject: payload.subject ?? "Payment correspondence",
        template: payload.template ?? "custom",
        attachments: payload.attachments,
      },
    ]);
  }, []);

  const selectedRequest = useMemo(
    () => requests.find(entry => entry.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const value = useMemo(
    () => ({
      requests,
      selectedRequest,
      selectedRequestId,
      selectRequest,
      markRequestStatus,
      communications,
      addCommunication,
      slaSnapshot,
    }),
    [
      requests,
      selectedRequest,
      selectedRequestId,
      selectRequest,
      markRequestStatus,
      communications,
      addCommunication,
      slaSnapshot,
    ],
  );

  return <PaymentsDataContext.Provider value={value}>{children}</PaymentsDataContext.Provider>;
};

export const usePaymentsData = () => {
  const context = useContext(PaymentsDataContext);
  if (!context) {
    throw new Error("usePaymentsData must be used within a PaymentsDataProvider");
  }
  return context;
};

