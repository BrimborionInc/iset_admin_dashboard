import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  ColumnLayout,
  Link,
  StatusIndicator,
  Button,
  Table,
  Badge,
  ExpandableSection,
  Alert,
  Modal,
  FormField,
  Input,
  Textarea,
  DatePicker,
  FileUpload,
  Select,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../auth/apiClient";
import { boardItemI18nStrings } from "./common";
import { usePaymentsData } from "./PaymentsDataContext.jsx";
import { PAYMENT_TYPE_OPTIONS, PAYEE_TYPE_OPTIONS, findOptionByValue } from "./paymentOptions";

const formatCurrency = value =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);

const packetStatusMeta = {
  draft: { label: "Draft", indicator: "pending" },
  submitted: { label: "Submitted", indicator: "info" },
  program_review: { label: "Program review", indicator: "info" },
  returned: { label: "Returned", indicator: "warning" },
  program_approved: { label: "Program approved", indicator: "info" },
  finance_review: { label: "Finance review", indicator: "warning" },
  finance_approved: { label: "Finance approved", indicator: "info" },
  batched: { label: "Batched", indicator: "info" },
  sent: { label: "Sent", indicator: "warning" },
  confirmed: { label: "Confirmed", indicator: "success" },
  closed: { label: "Closed", indicator: "success" },
  on_hold: { label: "On hold", indicator: "error" },
  cancelled: { label: "Cancelled", indicator: "error" },
};

const lineStatusMeta = {
  needs_evidence: { label: "Needs evidence", indicator: "warning" },
  ready_for_program: { label: "Ready for program", indicator: "info" },
  ready_for_finance: { label: "Ready for finance", indicator: "info" },
  approved: { label: "Approved", indicator: "success" },
  batched: { label: "Batched", indicator: "info" },
  paid: { label: "Paid", indicator: "success" },
  held: { label: "Held", indicator: "error" },
  cancelled: { label: "Cancelled", indicator: "error" },
};

const overrideableErrors = {
  missing_required_evidence: {
    title: "Missing required evidence",
    overrideType: "evidence_gate",
  },
  duplicate_payment_detected: {
    title: "Possible duplicate payment detected",
    overrideType: "duplicate_payment",
  },
  approval_threshold_requires_role: {
    title: "Approval threshold requires a higher role",
    overrideType: "approval_threshold",
  },
};

const buildEvidenceMeta = item => {
  if (item.required && !item.received) {
    return { indicator: "error", label: "Missing" };
  }
  if (item.received && item.verified) {
    return { indicator: "success", label: "Verified" };
  }
  if (item.received && !item.verified) {
    return { indicator: "warning", label: "Pending verification" };
  }
  return { indicator: "pending", label: "Optional" };
};

const PaymentDetailWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    selectedRequest,
    updatePacketStatus,
    updateLineStatus,
    updateLine,
    addPacketLines,
    createBatch,
    updateBatchStatus,
    createRecurringLines,
    updateEvidence,
    communications,
    addCommunication,
    sendPacketEmail,
    reloadRequests,
  } = usePaymentsData();
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [selectedLineIds, setSelectedLineIds] = useState([]);
  const [emailStatus, setEmailStatus] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);
  const [markPaidError, setMarkPaidError] = useState(null);
  const [paidDate, setPaidDate] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProofFiles, setPaymentProofFiles] = useState([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchApproving, setBatchApproving] = useState(false);
  const [batchExporting, setBatchExporting] = useState(false);
  const [auditDownloading, setAuditDownloading] = useState(false);
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [recurringSubmitting, setRecurringSubmitting] = useState(false);
  const [recurringError, setRecurringError] = useState(null);
  const [recurringPeriod, setRecurringPeriod] = useState("monthly");
  const [recurringStartDate, setRecurringStartDate] = useState("");
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [recurringOccurrences, setRecurringOccurrences] = useState("");
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [evidenceTarget, setEvidenceTarget] = useState(null);
  const [evidenceTypeOption, setEvidenceTypeOption] = useState(null);
  const [customEvidenceType, setCustomEvidenceType] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceError, setEvidenceError] = useState(null);
  const [verifyingEvidenceId, setVerifyingEvidenceId] = useState(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState(null);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [lineModalMode, setLineModalMode] = useState("create");
  const [lineForm, setLineForm] = useState({
    paymentType: "",
    payeeType: "",
    payeeName: "",
    payeeReference: "",
    amount: "",
    potId: "",
    servicePeriodStart: "",
    servicePeriodEnd: "",
    requestedPaymentDate: "",
    invoiceReferenceNumber: "",
  });
  const [lineSubmitting, setLineSubmitting] = useState(false);
  const [lineError, setLineError] = useState(null);
  const [linePotOptions, setLinePotOptions] = useState([]);
  const [linePotLoading, setLinePotLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState(null);
  const [overrideContext, setOverrideContext] = useState(null);

  useEffect(() => {
    if (selectedRequest?.lines?.length) {
      const firstId = selectedRequest.lines[0].id;
      setSelectedLineId(firstId);
      setSelectedLineIds([firstId]);
    } else {
      setSelectedLineId(null);
      setSelectedLineIds([]);
    }
    setEmailStatus(null);
    setActionStatus(null);
    setMarkPaidModalOpen(false);
    setMarkPaidSubmitting(false);
    setMarkPaidError(null);
    setPaidDate("");
    setPaymentReference("");
    setPaymentProofFiles([]);
    setBatchSubmitting(false);
    setBatchApproving(false);
    setBatchExporting(false);
    setAuditDownloading(false);
    setRecurringModalOpen(false);
    setRecurringSubmitting(false);
    setRecurringError(null);
    setRecurringPeriod("monthly");
    setRecurringStartDate("");
    setRecurringEndDate("");
    setRecurringOccurrences("");
    setEvidenceModalOpen(false);
    setEvidenceTarget(null);
    setEvidenceTypeOption(null);
    setCustomEvidenceType("");
    setEvidenceFiles([]);
    setEvidenceUploading(false);
    setEvidenceError(null);
    setVerifyingEvidenceId(null);
    setReturnModalOpen(false);
    setReturnReason("");
    setReturnSubmitting(false);
    setReturnError(null);
    setLineModalOpen(false);
    setLineModalMode("create");
    setLineForm({
      paymentType: "",
      payeeType: "",
      payeeName: "",
      payeeReference: "",
      amount: "",
      potId: "",
      servicePeriodStart: "",
      servicePeriodEnd: "",
      requestedPaymentDate: "",
      invoiceReferenceNumber: "",
    });
    setLineSubmitting(false);
    setLineError(null);
    setNoteText("");
    setNoteSubmitting(false);
    setNoteError(null);
    setOverrideModalOpen(false);
    setOverrideReason("");
    setOverrideSubmitting(false);
    setOverrideError(null);
    setOverrideContext(null);
  }, [selectedRequest?.id]);

  const packetLines = selectedRequest?.lines ?? [];
  const selectedLineSet = useMemo(() => new Set(selectedLineIds), [selectedLineIds]);
  const selectedLines = packetLines.filter(line => selectedLineSet.has(line.id));
  const activeLines = packetLines.filter(line => line.status !== "cancelled");
  const allLinesPaid =
    activeLines.length > 0 &&
    activeLines.every(line => line.status === "paid" && line.paidAt && line.paymentReference);
  const canConfirm = selectedRequest?.status === "sent" && allLinesPaid;
  const batchLineIds = selectedLines.filter(line => line.status === "approved").map(line => line.id);
  const selectedLinesWithBatch = selectedLines.filter(line => line.batch?.id);
  const canCreateBatch = batchLineIds.length > 0 && selectedLinesWithBatch.length === 0;

  const selectedLine = useMemo(() => {
    if (!packetLines.length) return null;
    return packetLines.find(line => line.id === selectedLineId) ?? null;
  }, [packetLines, selectedLineId]);
  const internalNotes = useMemo(() => {
    if (!selectedRequest?.id) return [];
    return (communications || [])
      .filter(note => note.packetId === selectedRequest.id && note.channel === "internal")
      .sort((a, b) => {
        const aTime = a.sentOn ? new Date(a.sentOn).getTime() : 0;
        const bTime = b.sentOn ? new Date(b.sentOn).getTime() : 0;
        return bTime - aTime;
      });
  }, [communications, selectedRequest?.id]);
  const selectedBatch = selectedLine?.batch || null;
  const canApproveBatch = selectedBatch?.status === "draft";
  const canExportBatch = selectedBatch && ["approved", "exported"].includes(selectedBatch.status);
  const recurringPeriodOptions = [
    { value: "weekly", label: "Weekly" },
    { value: "bi_weekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
  ];
  const normalizeTypeKey = value =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  const recurringEligible =
    selectedLine &&
    ["livingallowance", "childcare"].includes(normalizeTypeKey(selectedLine.paymentType)) &&
    selectedLine.status !== "cancelled";
  const isProgramView = metadata?.mode === "program";
  const canEditPacketLines =
    isProgramView &&
    selectedRequest &&
    ["draft", "returned"].includes(selectedRequest.status);

  const selectedLinePaymentType = useMemo(
    () => findOptionByValue(PAYMENT_TYPE_OPTIONS, lineForm.paymentType),
    [lineForm.paymentType]
  );
  const selectedLinePayeeType = useMemo(
    () => findOptionByValue(PAYEE_TYPE_OPTIONS, lineForm.payeeType),
    [lineForm.payeeType]
  );
  const selectedLinePot = useMemo(
    () => linePotOptions.find(option => option.value === lineForm.potId) || null,
    [linePotOptions, lineForm.potId]
  );

  const statusMeta = useMemo(() => {
    if (!selectedRequest) {
      return { label: "No packet selected", indicator: "pending" };
    }
    return packetStatusMeta[selectedRequest.status] ?? { label: selectedRequest.status, indicator: "info" };
  }, [selectedRequest]);

  const evidenceTargetOptions = useMemo(() => {
    if (!selectedRequest) return [];
    const options = [{ value: "baseline", label: "Baseline compliance (packet)" }];
    (selectedRequest.lines || []).forEach(line => {
      const lineLabel = line.paymentType ? `${line.paymentType}` : "Payment line";
      options.push({
        value: line.id,
        label: `Line LINE-${line.id} • ${lineLabel}`,
      });
    });
    return options;
  }, [selectedRequest]);

  useEffect(() => {
    if (!evidenceTargetOptions.length) {
      if (evidenceTarget !== null) setEvidenceTarget(null);
      return;
    }
    if (!evidenceTarget || !evidenceTargetOptions.some(option => option.value === evidenceTarget.value)) {
      setEvidenceTarget(evidenceTargetOptions[0]);
    }
  }, [evidenceTargetOptions, evidenceTarget]);

  const activeEvidenceChecklist = useMemo(() => {
    if (!selectedRequest || !evidenceTarget) return [];
    if (evidenceTarget.value === "baseline") {
      return selectedRequest.baselineEvidence || [];
    }
    const line = (selectedRequest.lines || []).find(entry => entry.id === evidenceTarget.value);
    return line?.evidenceChecklist || [];
  }, [selectedRequest, evidenceTarget]);

  const evidenceTypeOptions = useMemo(() => {
    const missing = [];
    const other = [];
    const seen = new Set();
    activeEvidenceChecklist.forEach(item => {
      if (!item?.type) return;
      if (seen.has(item.type)) return;
      seen.add(item.type);
      const labelSuffix = item.required ? " (required)" : " (optional)";
      const option = {
        value: item.type,
        label: `${item.type}${labelSuffix}`,
        description: item.note || undefined,
      };
      if (item.required && !item.received) {
        missing.push(option);
      } else {
        other.push(option);
      }
    });
    const combined = [...missing, ...other];
    if (!combined.length) {
      return [{ value: "__custom", label: "Other (manual entry)" }];
    }
    return [...combined, { value: "__custom", label: "Other (manual entry)" }];
  }, [activeEvidenceChecklist]);

  useEffect(() => {
    if (!evidenceTypeOptions.length) {
      if (evidenceTypeOption !== null) setEvidenceTypeOption(null);
      return;
    }
    if (!evidenceTypeOption || !evidenceTypeOptions.some(option => option.value === evidenceTypeOption.value)) {
      setEvidenceTypeOption(evidenceTypeOptions[0]);
    }
  }, [evidenceTypeOptions, evidenceTypeOption]);

  useEffect(() => {
    if (evidenceTypeOption?.value !== "__custom" && customEvidenceType) {
      setCustomEvidenceType("");
    }
  }, [evidenceTypeOption, customEvidenceType]);

  useEffect(() => {
    if (!lineModalOpen || linePotOptions.length || linePotLoading) return;
    setLinePotLoading(true);
    apiFetch("/api/reference/budget-pots-lite?chargeableOnly=1")
      .then(resp => resp.ok ? resp.json() : Promise.reject(new Error("Failed to load pots")))
      .then(payload => {
        const list = Array.isArray(payload)
          ? payload
              .map(pot => ({
                value: String(pot?.id || pot?.value || ""),
                label: [pot?.code, pot?.name].filter(Boolean).join(" - ") || String(pot?.id || ""),
                description: pot?.fundingSource || pot?.funding_source || undefined,
              }))
              .filter(option => option.value)
          : [];
        setLinePotOptions(list);
      })
      .catch(() => {
        setLinePotOptions([]);
      })
      .finally(() => {
        setLinePotLoading(false);
      });
  }, [lineModalOpen, linePotOptions.length, linePotLoading]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Payment detail", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const resolveOverrideConfig = err => {
    const code = err?.code || err?.payload?.error || err?.payload?.code || null;
    if (!code || !overrideableErrors[code]) {
      return null;
    }
    return { code, ...overrideableErrors[code] };
  };

  const openOverrideModal = context => {
    setOverrideContext(context);
    setOverrideReason("");
    setOverrideError(null);
    setOverrideModalOpen(true);
  };

  const handlePacketStatusChange = async (status, options = {}) => {
    if (!selectedRequest || !status) return;
    setActionStatus(null);
    try {
      await updatePacketStatus(selectedRequest.id, status, options);
      const label = packetStatusMeta[status]?.label || status;
      setActionStatus({ type: "success", message: `Packet updated: ${label}.` });
    } catch (err) {
      const overrideConfig = resolveOverrideConfig(err);
      if (overrideConfig) {
        openOverrideModal({
          target: "packet",
          status,
          options,
          error: err,
          overrideType: overrideConfig.overrideType,
          title: overrideConfig.title,
        });
        return;
      }
      setActionStatus({
        type: "error",
        message: err?.message || "Failed to update packet status.",
      });
    }
  };

  const handleStatusAction = ({ detail }) => {
    if (!detail?.id) return;
    if (detail.id === "returned") {
      setReturnReason("");
      setReturnError(null);
      setReturnModalOpen(true);
      return;
    }
    handlePacketStatusChange(detail.id);
  };

  const handleSendEmail = async () => {
    if (!selectedRequest?.id) return;
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      await sendPacketEmail(selectedRequest.id);
      setEmailStatus({ type: "success", message: "Finance email sent and logged." });
    } catch (err) {
      setEmailStatus({
        type: "error",
        message: err?.message || "Failed to send finance email.",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const openMarkPaidModal = () => {
    if (!selectedLine) return;
    setPaidDate(
      selectedLine.paidAt
        ? String(selectedLine.paidAt).slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setPaymentReference(selectedLine.paymentReference || "");
    setPaymentProofFiles([]);
    setMarkPaidError(null);
    setMarkPaidModalOpen(true);
  };

  const openRecurringModal = () => {
    if (!selectedLine) return;
    const today = new Date().toISOString().slice(0, 10);
    setRecurringStartDate(selectedLine.servicePeriodStart || today);
    setRecurringEndDate(selectedLine.servicePeriodEnd || "");
    setRecurringPeriod("monthly");
    setRecurringOccurrences("");
    setRecurringError(null);
    setRecurringModalOpen(true);
  };

  const handleMarkPaid = async () => {
    if (!selectedLine) return;
    const reference = paymentReference.trim();
    if (!paidDate) {
      setMarkPaidError("Paid date is required.");
      return;
    }
    if (!reference) {
      setMarkPaidError("Payment reference is required.");
      return;
    }
    let proofId = selectedLine.paymentProofDocumentId
      ? Number(selectedLine.paymentProofDocumentId)
      : null;
    const proofFile = paymentProofFiles?.[0] || null;
    if (proofFile) {
      const applicantUserId = selectedRequest?.applicantUserId;
      if (!applicantUserId) {
        setMarkPaidError("This packet is missing an applicant user ID. Unable to upload proof.");
        return;
      }
      try {
        const formData = new FormData();
        formData.append("file", proofFile);
        formData.append("label", "Payment proof");
        if (selectedRequest?.caseId) {
          formData.append("caseId", selectedRequest.caseId);
        }
        if (selectedRequest?.applicationId) {
          formData.append("applicationId", selectedRequest.applicationId);
        }
        if (selectedLine?.interventionId || selectedRequest?.interventionId) {
          formData.append(
            "interventionId",
            selectedLine?.interventionId || selectedRequest?.interventionId
          );
        }
        const uploadResp = await apiFetch(
          `/api/applicants/${encodeURIComponent(applicantUserId)}/documents/upload`,
          {
            method: "POST",
            body: formData,
          }
        );
        if (!uploadResp.ok) {
          const payload = await uploadResp.json().catch(() => ({}));
          throw new Error(payload?.message || payload?.error || `Upload failed (${uploadResp.status})`);
        }
        const payload = await uploadResp.json().catch(() => ({}));
        const documentId = payload?.document?.id;
        if (!documentId) {
          throw new Error("Upload completed but document ID was not returned.");
        }
        proofId = Number(documentId);
      } catch (err) {
        setMarkPaidError(err?.message || "Failed to upload payment proof.");
        return;
      }
    }
    if (!proofId || !Number.isFinite(proofId)) {
      setMarkPaidError("Proof of payment document is required.");
      return;
    }
    setMarkPaidSubmitting(true);
    setMarkPaidError(null);
    setActionStatus(null);
    try {
      await updateLineStatus(selectedLine.id, "paid", {
        paidAt: paidDate,
        paymentReference: reference,
        paymentProofDocumentId: proofId,
      });
      setActionStatus({ type: "success", message: `Line ${selectedLine.id} marked paid.` });
      setMarkPaidModalOpen(false);
    } catch (err) {
      const overrideConfig = resolveOverrideConfig(err);
      if (overrideConfig) {
        openOverrideModal({
          target: "line",
          status: "paid",
          lineId: selectedLine.id,
          options: {
            paidAt: paidDate,
            paymentReference: reference,
            paymentProofDocumentId: proofId,
          },
          error: err,
          overrideType: overrideConfig.overrideType,
          title: overrideConfig.title,
        });
        setMarkPaidModalOpen(false);
        return;
      }
      setMarkPaidError(err?.message || "Failed to mark line as paid.");
    } finally {
      setMarkPaidSubmitting(false);
    }
  };

  const handleCreateRecurring = async () => {
    if (!selectedRequest?.id || !selectedLine) return;
    if (!recurringStartDate) {
      setRecurringError("Start date is required.");
      return;
    }
    if (!recurringEndDate && !recurringOccurrences.trim()) {
      setRecurringError("Provide an end date or number of occurrences.");
      return;
    }
    const occurrencesValue = recurringOccurrences.trim()
      ? Number(recurringOccurrences.trim())
      : null;
    if (recurringOccurrences.trim() && (!Number.isFinite(occurrencesValue) || occurrencesValue <= 0)) {
      setRecurringError("Occurrences must be a positive number.");
      return;
    }
    setRecurringSubmitting(true);
    setRecurringError(null);
    try {
      await createRecurringLines(selectedRequest.id, {
        templateLineId: selectedLine.id,
        period: recurringPeriod,
        startDate: recurringStartDate,
        endDate: recurringEndDate || undefined,
        occurrences: occurrencesValue || undefined,
      });
      setRecurringModalOpen(false);
      setActionStatus({ type: "success", message: "Recurring payment lines generated." });
    } catch (err) {
      setRecurringError(err?.message || "Failed to generate recurring lines.");
    } finally {
      setRecurringSubmitting(false);
    }
  };

  const handleCreateBatch = async () => {
    if (!batchLineIds.length) return;
    setBatchSubmitting(true);
    setActionStatus(null);
    try {
      const batch = await createBatch(batchLineIds);
      const batchLabel = batch?.id ? `Batch ${batch.id}` : "Batch";
      setActionStatus({
        type: "success",
        message: `${batchLabel} created with ${batchLineIds.length} lines.`,
      });
    } catch (err) {
      setActionStatus({
        type: "error",
        message: err?.message || "Failed to create payment batch.",
      });
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleApproveBatch = async () => {
    if (!selectedBatch?.id) return;
    setBatchApproving(true);
    setActionStatus(null);
    try {
      await updateBatchStatus(selectedBatch.id, "approved");
      setActionStatus({ type: "success", message: `Batch ${selectedBatch.id} approved.` });
    } catch (err) {
      setActionStatus({
        type: "error",
        message: err?.message || "Failed to approve batch.",
      });
    } finally {
      setBatchApproving(false);
    }
  };

  const handleExportBatch = async () => {
    if (!selectedBatch?.id || !["approved", "exported"].includes(selectedBatch.status)) return;
    setBatchExporting(true);
    setActionStatus(null);
    try {
      const resp = await apiFetch(
        `/api/finance/payment-batches/${encodeURIComponent(selectedBatch.id)}/export`,
        { method: "POST" }
      );
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || `Export failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payment-batch-${selectedBatch.id}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setActionStatus({ type: "success", message: `Batch ${selectedBatch.id} exported.` });
    } catch (err) {
      setActionStatus({
        type: "error",
        message: err?.message || "Failed to export batch CSV.",
      });
    } finally {
      setBatchExporting(false);
    }
  };

  const handleDownloadAuditBundle = async () => {
    if (!selectedRequest?.id) return;
    setAuditDownloading(true);
    setActionStatus(null);
    try {
      const resp = await apiFetch(
        `/api/finance/payment-packets/${encodeURIComponent(selectedRequest.id)}/audit-bundle`,
        { method: "POST" }
      );
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || `Download failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payment-packet-${selectedRequest.id}-audit-bundle.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setActionStatus({ type: "success", message: "Audit bundle downloaded." });
    } catch (err) {
      setActionStatus({
        type: "error",
        message: err?.message || "Failed to download audit bundle.",
      });
    } finally {
      setAuditDownloading(false);
    }
  };

  const openEvidenceModal = () => {
    setEvidenceError(null);
    setEvidenceFiles([]);
    setEvidenceUploading(false);
    setEvidenceModalOpen(true);
  };

  const resolveEvidenceTypeValue = () => {
    if (!evidenceTypeOption) return "";
    if (evidenceTypeOption.value === "__custom") {
      return customEvidenceType.trim();
    }
    return String(evidenceTypeOption.value).trim();
  };

  const handleEvidenceUpload = async () => {
    if (!selectedRequest) return;
    const file = evidenceFiles?.[0] || null;
    if (!file) {
      setEvidenceError("Select a file to upload.");
      return;
    }
    const evidenceType = resolveEvidenceTypeValue();
    if (!evidenceType) {
      setEvidenceError("Select an evidence type.");
      return;
    }
    const applicantUserId = selectedRequest.applicantUserId;
    if (!applicantUserId) {
      setEvidenceError("This packet is missing an applicant user ID. Unable to upload evidence.");
      return;
    }
    setEvidenceUploading(true);
    setEvidenceError(null);
    try {
      const targetValue = evidenceTarget?.value || "baseline";
      const targetLine =
        targetValue !== "baseline"
          ? (selectedRequest.lines || []).find(entry => entry.id === targetValue)
          : null;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", evidenceType);
      if (selectedRequest.caseId) {
        formData.append("caseId", selectedRequest.caseId);
      }
      if (selectedRequest.applicationId) {
        formData.append("applicationId", selectedRequest.applicationId);
      }
      const interventionId = targetLine?.interventionId || selectedRequest.interventionId;
      if (interventionId) {
        formData.append("interventionId", interventionId);
      }
      const uploadResp = await apiFetch(
        `/api/applicants/${encodeURIComponent(applicantUserId)}/documents/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      if (!uploadResp.ok) {
        const payload = await uploadResp.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || `Upload failed (${uploadResp.status})`);
      }
      const uploadPayload = await uploadResp.json().catch(() => ({}));
      const documentId = uploadPayload?.document?.id;
      if (!documentId) {
        throw new Error("Upload completed but document ID was not returned.");
      }
      const matchedEvidence = activeEvidenceChecklist.find(item => item.type === evidenceType);
      const requiredFlag = matchedEvidence?.required ?? false;
      const attachResp = await apiFetch(
        `/api/finance/payment-packets/${encodeURIComponent(selectedRequest.id)}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId,
            evidenceType,
            lineId: targetLine?.id || null,
            required: requiredFlag,
            received: true,
          }),
        }
      );
      if (!attachResp.ok) {
        const payload = await attachResp.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || `Attach failed (${attachResp.status})`);
      }
      await reloadRequests();
      setEvidenceModalOpen(false);
      setActionStatus({ type: "success", message: "Evidence uploaded and attached." });
    } catch (err) {
      setEvidenceError(err?.message || "Failed to upload evidence.");
    } finally {
      setEvidenceUploading(false);
    }
  };

  const handleEvidenceVerification = async (item, shouldVerify) => {
    if (!item?.id) return;
    setVerifyingEvidenceId(item.id);
    setActionStatus(null);
    try {
      await updateEvidence(item.id, { verified: !!shouldVerify });
      setActionStatus({
        type: "success",
        message: shouldVerify ? "Evidence verified." : "Evidence verification cleared.",
      });
    } catch (err) {
      setActionStatus({
        type: "error",
        message: err?.message || "Failed to update evidence verification.",
      });
    } finally {
      setVerifyingEvidenceId(null);
    }
  };

  const handleReturnSubmit = async () => {
    if (!selectedRequest) return;
    setReturnSubmitting(true);
    setReturnError(null);
    try {
      const trimmed = returnReason.trim();
      await handlePacketStatusChange("returned", { notes: trimmed || null });
      setReturnModalOpen(false);
      setReturnReason("");
    } catch (err) {
      setReturnError(err?.message || "Failed to return packet.");
    } finally {
      setReturnSubmitting(false);
    }
  };

  const renderOverrideDetails = details => {
    if (!details) return null;
    if (Array.isArray(details)) {
      return details.map((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return (
            <Box key={`override-${index}`} variant="p">
              {String(entry)}
            </Box>
          );
        }
        const summary = Object.entries(entry)
          .map(([key, value]) => `${key}: ${value}`)
          .join(" • ");
        return (
          <Box key={`override-${index}`} variant="p">
            {summary}
          </Box>
        );
      });
    }
    if (typeof details === "object") {
      return (
        <Box variant="p">{JSON.stringify(details)}</Box>
      );
    }
    return <Box variant="p">{String(details)}</Box>;
  };

  const handleOverrideSubmit = async () => {
    if (!overrideContext) return;
    const reason = overrideReason.trim();
    if (!reason) {
      setOverrideError("Override reason is required.");
      return;
    }
    setOverrideSubmitting(true);
    setOverrideError(null);
    try {
      if (overrideContext.target === "packet" && selectedRequest?.id) {
        await updatePacketStatus(selectedRequest.id, overrideContext.status, {
          ...(overrideContext.options || {}),
          override: true,
          overrideReason: reason,
          overrideType: overrideContext.overrideType,
        });
      } else if (overrideContext.target === "line" && overrideContext.lineId) {
        await updateLineStatus(overrideContext.lineId, overrideContext.status, {
          ...(overrideContext.options || {}),
          override: true,
          overrideReason: reason,
          overrideType: overrideContext.overrideType,
        });
      }
      setActionStatus({ type: "success", message: "Override applied." });
      setOverrideModalOpen(false);
      setOverrideContext(null);
      setOverrideReason("");
    } catch (err) {
      setOverrideError(err?.message || "Failed to apply override.");
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedRequest?.id) return;
    const message = noteText.trim();
    if (!message) {
      setNoteError("Enter a note before sending.");
      return;
    }
    setNoteSubmitting(true);
    setNoteError(null);
    try {
      await addCommunication({
        packetId: selectedRequest.id,
        channel: "internal",
        body: message,
        subject: "Internal note",
        direction: "outbound",
      });
      setNoteText("");
    } catch (err) {
      setNoteError(err?.message || "Failed to add note.");
    } finally {
      setNoteSubmitting(false);
    }
  };

  const resetLineForm = (overrides = {}) => {
    setLineForm({
      paymentType: "",
      payeeType: "",
      payeeName: "",
      payeeReference: "",
      amount: "",
      potId: "",
      servicePeriodStart: "",
      servicePeriodEnd: "",
      requestedPaymentDate: "",
      invoiceReferenceNumber: "",
      ...overrides,
    });
  };

  const openLineCreateModal = () => {
    if (!selectedRequest) return;
    setLineError(null);
    setLineModalMode("create");
    resetLineForm({
      potId: selectedRequest.potId || "",
    });
    setLineModalOpen(true);
  };

  const openLineEditModal = () => {
    if (!selectedLine) return;
    setLineError(null);
    setLineModalMode("edit");
    resetLineForm({
      paymentType: selectedLine.paymentType || "",
      payeeType: selectedLine.payeeType || "",
      payeeName: selectedLine.payeeName || "",
      payeeReference: selectedLine.payeeReference || "",
      amount: selectedLine.amount ? String(selectedLine.amount) : "",
      potId: selectedLine.potId || "",
      servicePeriodStart: selectedLine.servicePeriodStart || "",
      servicePeriodEnd: selectedLine.servicePeriodEnd || "",
      requestedPaymentDate: selectedLine.requestedPaymentDate || "",
      invoiceReferenceNumber: selectedLine.invoiceReferenceNumber || "",
    });
    setLineModalOpen(true);
  };

  const handleLineSubmit = async () => {
    if (!selectedRequest) return;
    const paymentType = lineForm.paymentType;
    const payeeType = lineForm.payeeType;
    const payeeName = lineForm.payeeName.trim();
    const amountValue = Number(lineForm.amount);
    const potId = lineForm.potId;
    if (!paymentType || !payeeType || !payeeName) {
      setLineError("Payment type, payee type, and payee name are required.");
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setLineError("Amount must be a positive number.");
      return;
    }
    if (!potId) {
      setLineError("Select a budget pot for the payment line.");
      return;
    }
    const requiresPeriod = ["LivingAllowance", "WageSubsidyEmployer"].includes(paymentType);
    if (requiresPeriod && (!lineForm.servicePeriodStart || !lineForm.servicePeriodEnd)) {
      setLineError("Service period start and end are required for this payment type.");
      return;
    }
    setLineSubmitting(true);
    setLineError(null);
    try {
      const payload = {
        paymentType,
        payeeType,
        payeeName,
        payeeReference: lineForm.payeeReference ? lineForm.payeeReference.trim() : null,
        amount: amountValue,
        potId: Number(potId),
        servicePeriodStart: lineForm.servicePeriodStart || null,
        servicePeriodEnd: lineForm.servicePeriodEnd || null,
        requestedPaymentDate: lineForm.requestedPaymentDate || null,
        invoiceReferenceNumber: lineForm.invoiceReferenceNumber || null,
      };
      if (lineModalMode === "edit" && selectedLine?.id) {
        await updateLine(selectedLine.id, payload);
        setActionStatus({ type: "success", message: `Line ${selectedLine.id} updated.` });
      } else {
        await addPacketLines(selectedRequest.id, { line: payload });
        setActionStatus({ type: "success", message: "Payment line added." });
      }
      setLineModalOpen(false);
    } catch (err) {
      setLineError(err?.message || "Failed to save payment line.");
    } finally {
      setLineSubmitting(false);
    }
  };

  const lineColumns = [
    {
      id: "id",
      header: "Line",
      cell: item => item.id,
    },
    {
      id: "paymentType",
      header: "Payment type",
      cell: item => item.paymentType,
    },
    {
      id: "payee",
      header: "Payee",
      cell: item => `${item.payeeName} (${item.payeeType})`,
    },
    {
      id: "amount",
      header: "Amount",
      cell: item => formatCurrency(item.amount),
    },
    {
      id: "servicePeriod",
      header: "Service period",
      cell: item => item.servicePeriodLabel,
    },
    {
      id: "status",
      header: "Status",
      cell: item => {
        const meta = lineStatusMeta[item.status] ?? { label: item.status, indicator: "info" };
        return <StatusIndicator type={meta.indicator}>{meta.label}</StatusIndicator>;
      },
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: item => {
        const summary = item.evidenceSummary;
        const indicator = summary.missing === 0 ? "success" : "warning";
        return (
          <StatusIndicator type={indicator}>
            {summary.verified}/{summary.required}
          </StatusIndicator>
        );
      },
    },
    {
      id: "stream",
      header: "Stream",
      cell: item => item.fundingStream,
    },
    {
      id: "potName",
      header: "Pot",
      cell: item => item.potName,
    },
    {
      id: "holdReason",
      header: "Hold reason",
      cell: item => item.holdReason ?? "-",
    },
  ];

  const financeStatusActions = [
    { id: "finance_review", text: "Move to Finance review" },
    { id: "finance_approved", text: "Mark Finance approved" },
    { id: "sent", text: "Mark Sent" },
    { id: "confirmed", text: "Mark Confirmed", disabled: !canConfirm },
    { id: "on_hold", text: "Place On Hold" },
    { id: "returned", text: "Return to Program" },
  ];

  const programStatusActions = [
    { id: "draft", text: "Move to Draft" },
    { id: "submitted", text: "Submit for program review" },
    { id: "program_review", text: "Mark In Program Review" },
    { id: "program_approved", text: "Approve for finance" },
    { id: "returned", text: "Return for evidence" },
  ];

  const statusActions = isProgramView ? programStatusActions : financeStatusActions;
  const showFinanceActions = !isProgramView;
  const canSendToFinance = !isProgramView || selectedRequest?.status === "program_approved";

  const formatOptionalCurrency = value =>
    Number.isFinite(value) ? formatCurrency(value) : "-";

  const authorizationSummary = selectedLine?.authorization
    ? [
        selectedLine.authorization.category ? `Category: ${selectedLine.authorization.category}` : null,
        Number.isFinite(selectedLine.authorization.remainingAmount)
          ? `Remaining: ${formatOptionalCurrency(selectedLine.authorization.remainingAmount)}`
          : null,
        Number.isFinite(selectedLine.authorization.authorizedAmount)
          ? `Cap: ${formatOptionalCurrency(selectedLine.authorization.authorizedAmount)}`
          : null,
        Number.isFinite(selectedLine.authorization.totalRemaining)
          ? `Total remaining: ${formatOptionalCurrency(selectedLine.authorization.totalRemaining)}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ")
    : "-";

  const canMarkPaid =
    !!selectedLine &&
    selectedLine.status === "batched" &&
    ["approved", "exported"].includes(selectedBatch?.status);

  const batchTotals = useMemo(() => {
    if (!selectedLines.length) return null;
    const totals = { totalAmount: 0, streams: {} };
    selectedLines.forEach(line => {
      if (line.status !== "approved") return;
      totals.totalAmount += Number(line.amount || 0);
      const stream = line.fundingStream || "Unclassified";
      totals.streams[stream] = (totals.streams[stream] || 0) + Number(line.amount || 0);
    });
    return totals;
  }, [selectedLines]);
  const detailDescription = isProgramView
    ? "Upload evidence, resolve returns, and submit packets for approval."
    : "Review packet metadata, evidence, approvals, and batch-ready actions.";

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={detailDescription}
        >
          Payment packet detail
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Payment detail settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      {selectedRequest ? (
        <SpaceBetween size="l">
          {actionStatus && (
            <Alert type={actionStatus.type} onDismiss={() => setActionStatus(null)}>
              {actionStatus.message}
            </Alert>
          )}
          {emailStatus && (
            <Alert type={emailStatus.type} onDismiss={() => setEmailStatus(null)}>
              {emailStatus.message}
            </Alert>
          )}
          <ColumnLayout columns={3} variant="text-grid">
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Packet</Box>
              <Box variant="strong">{selectedRequest.id}</Box>
              <Box variant="p">{selectedRequest.clientName ?? "No client linked"}</Box>
              <Box variant="p">{selectedRequest.interventionName ?? "No intervention linked"}</Box>
              <Box variant="p">Case: {selectedRequest.caseId ?? "-"}</Box>
              <Box variant="p">{selectedRequest.reportingUnit}</Box>
              <Box variant="p">{selectedRequest.potName}</Box>
            </SpaceBetween>
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Status</Box>
              <StatusIndicator type={statusMeta.indicator}>{statusMeta.label}</StatusIndicator>
              <Box variant="awsui-key-label">Total</Box>
              <Box variant="strong">{formatCurrency(selectedRequest.totalAmount)}</Box>
              <Box variant="awsui-key-label">Stream totals</Box>
              <Box variant="p">
                {selectedRequest.streamTotals?.CRF ? `CRF ${formatCurrency(selectedRequest.streamTotals.CRF)}` : "CRF -"}
                {" | "}
                {selectedRequest.streamTotals?.EI ? `EI ${formatCurrency(selectedRequest.streamTotals.EI)}` : "EI -"}
              </Box>
              <Box variant="awsui-key-label">Baseline compliance</Box>
              <StatusIndicator
                type={selectedRequest.baselineEvidenceSummary.missing === 0 ? "success" : "warning"}
              >
                {selectedRequest.baselineEvidenceSummary.missing === 0
                  ? "Complete"
                  : `${selectedRequest.baselineEvidenceSummary.missing} missing`}
              </StatusIndicator>
            </SpaceBetween>
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Requester</Box>
              <Box variant="p">{selectedRequest.requester}</Box>
              <Box variant="p">{selectedRequest.requesterRole}</Box>
              <Box variant="awsui-key-label">Timeline</Box>
              <Box variant="p">Submitted: {selectedRequest.submittedOn}</Box>
              <Box variant="p">Due by: {selectedRequest.dueBy}</Box>
              <Box variant="awsui-key-label">Risk flags</Box>
              {selectedRequest.riskFlags?.length ? (
                <SpaceBetween direction="horizontal" size="xs">
                  {selectedRequest.riskFlags.map(flag => (
                    <Badge key={flag} color="red">
                      {flag}
                    </Badge>
                  ))}
                </SpaceBetween>
              ) : (
                <Box variant="p">None</Box>
              )}
            </SpaceBetween>
          </ColumnLayout>

          <Table
            trackBy="id"
            items={packetLines}
            selectionType="multi"
            selectedItems={selectedLines}
            onSelectionChange={({ detail }) => {
              const ids = (detail.selectedItems || []).map(item => item.id);
              setSelectedLineIds(ids);
              setSelectedLineId(ids[0] ?? null);
            }}
            columnDefinitions={lineColumns}
            variant="embedded"
            header={
              <Header
                variant="h3"
                counter={`(${packetLines.length})`}
                actions={
                  isProgramView ? (
                    <SpaceBetween direction="horizontal" size="xs">
                      <Button onClick={openLineCreateModal} disabled={!canEditPacketLines}>
                        Add line
                      </Button>
                      <Button
                        onClick={openLineEditModal}
                        disabled={!canEditPacketLines || !selectedLine}
                      >
                        Edit selected
                      </Button>
                    </SpaceBetween>
                  ) : undefined
                }
              >
                Payment lines
              </Header>
            }
            empty={<Box padding="m">No payment lines attached to this packet.</Box>}
          />

          {selectedLine ? (
            <SpaceBetween size="m">
              <ColumnLayout columns={3} variant="text-grid">
                <SpaceBetween size="xs">
                  <Box variant="awsui-key-label">Selected line</Box>
                  <Box variant="strong">{selectedLine.id}</Box>
                  <Box variant="p">{selectedLine.paymentType}</Box>
                  <Box variant="p">
                    {selectedLine.payeeName} ({selectedLine.payeeType})
                  </Box>
                  <Box variant="p">{selectedLine.potName || "-"}</Box>
                </SpaceBetween>
                <SpaceBetween size="xs">
                  <Box variant="awsui-key-label">Status</Box>
                  <StatusIndicator
                    type={(lineStatusMeta[selectedLine.status] || {}).indicator || "info"}
                  >
                    {(lineStatusMeta[selectedLine.status] || {}).label || selectedLine.status}
                  </StatusIndicator>
                  <Box variant="awsui-key-label">Amount</Box>
                  <Box variant="strong">{formatCurrency(selectedLine.amount)}</Box>
                  <Box variant="awsui-key-label">Service period</Box>
                  <Box variant="p">{selectedLine.servicePeriodLabel}</Box>
                  <Box variant="awsui-key-label">Stream</Box>
                  <Box variant="p">{selectedLine.fundingStream || "-"}</Box>
                </SpaceBetween>
                <SpaceBetween size="xs">
                  <Box variant="awsui-key-label">Paid on</Box>
                  <Box variant="p">{selectedLine.paidAt || "-"}</Box>
                  <Box variant="awsui-key-label">Payment reference</Box>
                  <Box variant="p">{selectedLine.paymentReference || "-"}</Box>
                  <Box variant="awsui-key-label">Proof document ID</Box>
                  <Box variant="p">{selectedLine.paymentProofDocumentId || "-"}</Box>
                  <Box variant="awsui-key-label">Batch</Box>
                  <Box variant="p">
                    {selectedBatch?.id
                      ? `${selectedBatch.id} (${selectedBatch.status || "draft"})`
                      : "Not batched"}
                  </Box>
                  <Box variant="awsui-key-label">Batch approved by</Box>
                  <Box variant="p">{selectedBatch?.approvedBy || "-"}</Box>
                  <Box variant="awsui-key-label">Authorization</Box>
                  <Box variant="p">{authorizationSummary}</Box>
                </SpaceBetween>
              </ColumnLayout>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Batch selection</Box>
                <Box variant="p">
                  {selectedLines.length
                    ? `${selectedLines.length} selected • ${batchLineIds.length} approved for batch`
                    : "Select one or more lines to batch."}
                </Box>
                {selectedLinesWithBatch.length ? (
                  <Box variant="p">Some selected lines are already batched.</Box>
                ) : null}
                {batchTotals && batchLineIds.length ? (
                  <Box variant="p">
                    Total: {formatCurrency(batchTotals.totalAmount)}{" "}
                    {Object.keys(batchTotals.streams || {}).length
                      ? `• ${Object.entries(batchTotals.streams)
                          .map(([stream, value]) => `${stream} ${formatCurrency(value)}`)
                          .join(" | ")}`
                      : ""}
                    {selectedRequest?.reportingUnit ? ` • ${selectedRequest.reportingUnit}` : ""}
                  </Box>
                ) : null}
              </SpaceBetween>
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={openRecurringModal} disabled={!recurringEligible}>
                  Generate recurring lines
                </Button>
                {!isProgramView ? (
                  <Button onClick={openMarkPaidModal} disabled={!canMarkPaid}>
                    Mark paid
                  </Button>
                ) : null}
              </SpaceBetween>
            </SpaceBetween>
          ) : (
            <Box variant="p">Select a payment line to view details.</Box>
          )}

          <ExpandableSection headerText="Evidence checklist">
            <SpaceBetween size="m">
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Baseline compliance</Box>
                {(selectedRequest.baselineEvidence ?? []).map(item => {
                  const meta = buildEvidenceMeta(item);
                  return (
                    <SpaceBetween key={item.id || item.type} direction="horizontal" size="xs">
                      <StatusIndicator type={meta.indicator}>{meta.label}</StatusIndicator>
                      <Box variant="p">{item.type}</Box>
                      {item.note ? <Box variant="p">{item.note}</Box> : null}
                      {item.documentName ? <Box variant="p">{item.documentName}</Box> : null}
                      {item.verifiedBy ? <Box variant="p">Verified by {item.verifiedBy}</Box> : null}
                      {!isProgramView && item.id ? (
                        <Button
                          variant="link"
                          onClick={() => handleEvidenceVerification(item, !item.verified)}
                          disabled={verifyingEvidenceId === item.id}
                        >
                          {item.verified ? "Clear verification" : "Verify"}
                        </Button>
                      ) : null}
                    </SpaceBetween>
                  );
                })}
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Selected line evidence</Box>
                {selectedLine?.evidenceChecklist?.map(item => {
                  const meta = buildEvidenceMeta(item);
                  return (
                    <SpaceBetween key={item.id || item.type} direction="horizontal" size="xs">
                      <StatusIndicator type={meta.indicator}>{meta.label}</StatusIndicator>
                      <Box variant="p">{item.type}</Box>
                      {item.note ? <Box variant="p">{item.note}</Box> : null}
                      {item.documentName ? <Box variant="p">{item.documentName}</Box> : null}
                      {item.verifiedBy ? <Box variant="p">Verified by {item.verifiedBy}</Box> : null}
                      {!isProgramView && item.id ? (
                        <Button
                          variant="link"
                          onClick={() => handleEvidenceVerification(item, !item.verified)}
                          disabled={verifyingEvidenceId === item.id}
                        >
                          {item.verified ? "Clear verification" : "Verify"}
                        </Button>
                      ) : null}
                    </SpaceBetween>
                  );
                })}
              </SpaceBetween>
              {isProgramView ? (
                <SpaceBetween size="xs">
                  <Box variant="awsui-key-label">Upload evidence</Box>
                  <Box variant="p">Attach missing evidence and resubmit the packet when ready.</Box>
                  <Button onClick={openEvidenceModal} disabled={!selectedRequest?.id}>
                    Upload evidence
                  </Button>
                </SpaceBetween>
              ) : null}
            </SpaceBetween>
          </ExpandableSection>

          <ExpandableSection headerText="Approvals and timeline">
            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Approvals</Box>
                {(selectedRequest.approvals ?? []).map(entry => (
                  <SpaceBetween key={`${entry.stage}-${entry.by}`} direction="horizontal" size="xs">
                    <StatusIndicator type={entry.status === "Approved" ? "success" : "info"}>
                      {entry.status}
                    </StatusIndicator>
                    <Box variant="p">{entry.stage}</Box>
                    <Box variant="p">{entry.by}</Box>
                    <Box variant="p">{entry.at}</Box>
                  </SpaceBetween>
                ))}
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Timeline</Box>
                {(selectedRequest.timeline ?? []).map(entry => (
                  <SpaceBetween key={`${entry.label}-${entry.at}`} direction="horizontal" size="xs">
                    <Box variant="p">{entry.label}</Box>
                    <Box variant="p">{entry.at}</Box>
                    <Box variant="p">{entry.actor}</Box>
                    {entry.notes ? <Box variant="p">{entry.notes}</Box> : null}
                  </SpaceBetween>
                ))}
              </SpaceBetween>
            </ColumnLayout>
          </ExpandableSection>

          <ExpandableSection headerText="Notes & requests">
            <SpaceBetween size="m">
              {noteError ? <Alert type="error">{noteError}</Alert> : null}
              {internalNotes.length ? (
                internalNotes.map(note => (
                  <SpaceBetween key={note.id} size="xs">
                    <Box variant="awsui-key-label">
                      {note.sender || "Staff"} •{" "}
                      {note.sentOn ? new Date(note.sentOn).toLocaleString() : "Unknown time"}
                    </Box>
                    <Box variant="p">{note.body || note.subject || "-"}</Box>
                  </SpaceBetween>
                ))
              ) : (
                <Box variant="p">No internal notes logged yet.</Box>
              )}
              <FormField
                label="Add note or request"
                description="Use this for program ↔ finance clarification requests and internal notes."
              >
                <Textarea
                  value={noteText}
                  onChange={({ detail }) => setNoteText(detail.value)}
                  placeholder="e.g., Please confirm attendance report for March is verified."
                />
              </FormField>
              <Button
                onClick={handleAddNote}
                loading={noteSubmitting}
                disabled={noteSubmitting || !selectedRequest?.id}
              >
                Post note
              </Button>
            </SpaceBetween>
          </ExpandableSection>

          {(selectedRequest.duplicateWarnings?.length || selectedRequest.overrideHistory?.length) && (
            <ColumnLayout columns={2} variant="text-grid">
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Duplicate warnings</Box>
                {(selectedRequest.duplicateWarnings ?? []).length ? (
                  (selectedRequest.duplicateWarnings ?? []).map(warning => (
                    <Box key={warning} variant="p">
                      {warning}
                    </Box>
                  ))
                ) : (
                  <Box variant="p">None</Box>
                )}
              </SpaceBetween>
              <SpaceBetween size="xs">
                <Box variant="awsui-key-label">Overrides</Box>
                {(selectedRequest.overrideHistory ?? []).length ? (
                  (selectedRequest.overrideHistory ?? []).map(entry => (
                    <Box key={`${entry.by}-${entry.at}`} variant="p">
                      {entry.at} - {entry.by}: {entry.reason}
                    </Box>
                  ))
                ) : (
                  <Box variant="p">None</Box>
                )}
              </SpaceBetween>
            </ColumnLayout>
          )}

          <SpaceBetween size="xs">
            <Box variant="awsui-key-label">Notes</Box>
            <Box variant="p">{selectedRequest.notes || "No notes provided."}</Box>
          </SpaceBetween>

          <SpaceBetween size="xs">
            <Box variant="awsui-key-label">Documents</Box>
            {(selectedRequest.documents ?? []).length ? (
              selectedRequest.documents.map(document => (
                <Link key={document.id} href="#">
                  {document.name}
                </Link>
              ))
            ) : (
              <Box variant="p">No documents attached.</Box>
            )}
          </SpaceBetween>

          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              loading={sendingEmail}
              onClick={handleSendEmail}
              disabled={!selectedRequest?.id || sendingEmail || !canSendToFinance}
            >
              Send to finance
            </Button>
            <ButtonDropdown
              ariaLabel="Payment packet actions"
              items={statusActions}
              onItemClick={handleStatusAction}
            >
              Update status
            </ButtonDropdown>
            {showFinanceActions ? (
              <Button
                onClick={() => handlePacketStatusChange("confirmed")}
                disabled={!canConfirm}
              >
                Mark confirmed
              </Button>
            ) : null}
            {showFinanceActions ? (
              <Button
                onClick={handleCreateBatch}
                disabled={!canCreateBatch || batchSubmitting}
                loading={batchSubmitting}
              >
                Create batch
              </Button>
            ) : null}
            {showFinanceActions ? (
              <Button
                onClick={handleApproveBatch}
                disabled={!canApproveBatch || batchApproving}
                loading={batchApproving}
              >
                Approve batch
              </Button>
            ) : null}
            {showFinanceActions ? (
              <Button
                iconName="download"
                onClick={handleExportBatch}
                disabled={!canExportBatch || batchExporting}
                loading={batchExporting}
              >
                Export batch CSV
              </Button>
            ) : null}
            {showFinanceActions ? (
              <Button
                iconName="download"
                onClick={handleDownloadAuditBundle}
                disabled={!selectedRequest?.id || auditDownloading}
                loading={auditDownloading}
              >
                Download audit bundle
              </Button>
            ) : null}
            <Button variant="link" href="#">
              Open packet documents
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      ) : (
        <Box variant="p">Select a payment packet from the queue to view its detail.</Box>
      )}
      <Modal
        visible={lineModalOpen}
        onDismiss={() => {
          if (lineSubmitting) return;
          setLineModalOpen(false);
          setLineError(null);
        }}
        header={lineModalMode === "edit" ? "Edit payment line" : "Add payment line"}
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setLineModalOpen(false);
                setLineError(null);
              }}
              disabled={lineSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleLineSubmit}
              loading={lineSubmitting}
            >
              Save line
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          {lineError ? <Alert type="error">{lineError}</Alert> : null}
          <ColumnLayout columns={2} variant="text-grid">
            <FormField label="Payment type">
              <Select
                selectedOption={selectedLinePaymentType}
                options={PAYMENT_TYPE_OPTIONS}
                onChange={({ detail }) =>
                  setLineForm(current => ({ ...current, paymentType: detail.selectedOption?.value || "" }))
                }
                placeholder="Select payment type"
                filteringType="auto"
              />
            </FormField>
            <FormField label="Payee type">
              <Select
                selectedOption={selectedLinePayeeType}
                options={PAYEE_TYPE_OPTIONS}
                onChange={({ detail }) =>
                  setLineForm(current => ({ ...current, payeeType: detail.selectedOption?.value || "" }))
                }
                placeholder="Select payee type"
              />
            </FormField>
            <FormField label="Payee name">
              <Input
                value={lineForm.payeeName}
                onChange={({ detail }) => setLineForm(current => ({ ...current, payeeName: detail.value }))}
                placeholder="Payee name"
              />
            </FormField>
            <FormField label="Payee reference (optional)">
              <Input
                value={lineForm.payeeReference}
                onChange={({ detail }) =>
                  setLineForm(current => ({ ...current, payeeReference: detail.value }))
                }
                placeholder="Account or vendor reference"
              />
            </FormField>
            <FormField label="Amount">
              <Input
                value={lineForm.amount}
                onChange={({ detail }) => setLineForm(current => ({ ...current, amount: detail.value }))}
                type="number"
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Budget pot">
              <Select
                selectedOption={selectedLinePot}
                options={linePotOptions}
                onChange={({ detail }) =>
                  setLineForm(current => ({ ...current, potId: detail.selectedOption?.value || "" }))
                }
                statusType={linePotLoading ? "loading" : "finished"}
                placeholder={linePotLoading ? "Loading pots" : "Select budget pot"}
                filteringType="auto"
                empty="No budget pots available."
              />
            </FormField>
            <FormField
              label="Service period start"
              description="Required for living allowance and wage subsidy."
            >
              <DatePicker
                value={lineForm.servicePeriodStart}
                onChange={({ detail }) =>
                  setLineForm(current => ({ ...current, servicePeriodStart: detail.value }))
                }
                placeholder="YYYY-MM-DD"
              />
            </FormField>
            <FormField
              label="Service period end"
              description="Required for living allowance and wage subsidy."
            >
              <DatePicker
                value={lineForm.servicePeriodEnd}
                onChange={({ detail }) =>
                  setLineForm(current => ({ ...current, servicePeriodEnd: detail.value }))
                }
                placeholder="YYYY-MM-DD"
              />
            </FormField>
            <FormField label="Requested payment date (optional)">
              <DatePicker
                value={lineForm.requestedPaymentDate}
                onChange={({ detail }) =>
                  setLineForm(current => ({ ...current, requestedPaymentDate: detail.value }))
                }
                placeholder="YYYY-MM-DD"
              />
            </FormField>
            <FormField label="Invoice reference (optional)">
              <Input
                value={lineForm.invoiceReferenceNumber}
                onChange={({ detail }) =>
                  setLineForm(current => ({ ...current, invoiceReferenceNumber: detail.value }))
                }
                placeholder="Invoice or receipt number"
              />
            </FormField>
          </ColumnLayout>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={markPaidModalOpen}
        onDismiss={() => {
          if (markPaidSubmitting) return;
          setMarkPaidModalOpen(false);
          setMarkPaidError(null);
        }}
        header="Mark payment line as paid"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setMarkPaidModalOpen(false);
                setMarkPaidError(null);
              }}
              disabled={markPaidSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleMarkPaid}
              loading={markPaidSubmitting}
            >
              Save paid status
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          {markPaidError && <Alert type="error">{markPaidError}</Alert>}
          <FormField label="Paid date" description="Date the payment was issued.">
            <DatePicker
              value={paidDate}
              onChange={({ detail }) => setPaidDate(detail.value)}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
          <FormField label="Payment reference" description="Confirmation or EFT reference number.">
            <Input
              value={paymentReference}
              onChange={({ detail }) => setPaymentReference(detail.value)}
              placeholder="e.g., EFT-2026-00019"
            />
          </FormField>
          <FormField
            label="Payment confirmation file"
            description="Upload the proof of payment confirmation."
          >
            <FileUpload
              value={paymentProofFiles}
              onChange={({ detail }) => setPaymentProofFiles(detail.value)}
              multiple={false}
              constraintText="PDF, Word, Excel, text, PNG, JPG."
              loading={markPaidSubmitting}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={recurringModalOpen}
        onDismiss={() => {
          if (recurringSubmitting) return;
          setRecurringModalOpen(false);
          setRecurringError(null);
        }}
        header="Generate recurring payment lines"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setRecurringModalOpen(false);
                setRecurringError(null);
              }}
              disabled={recurringSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateRecurring}
              loading={recurringSubmitting}
            >
              Create lines
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          {recurringError && <Alert type="error">{recurringError}</Alert>}
          {selectedLine ? (
            <Box variant="p">
              Template: {selectedLine.paymentType} • {formatCurrency(selectedLine.amount)} •{" "}
              {selectedLine.payeeName}
            </Box>
          ) : null}
          <FormField label="Recurrence period">
            <Select
              selectedOption={
                recurringPeriodOptions.find(option => option.value === recurringPeriod) ||
                recurringPeriodOptions[2]
              }
              onChange={({ detail }) => setRecurringPeriod(detail.selectedOption?.value || "monthly")}
              options={recurringPeriodOptions}
              placeholder="Select a period"
            />
          </FormField>
          <FormField label="Start date">
            <DatePicker
              value={recurringStartDate}
              onChange={({ detail }) => setRecurringStartDate(detail.value)}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
          <FormField label="End date (optional)">
            <DatePicker
              value={recurringEndDate}
              onChange={({ detail }) => setRecurringEndDate(detail.value)}
              placeholder="YYYY-MM-DD"
            />
          </FormField>
          <FormField
            label="Occurrences (optional)"
            description="Provide a count instead of an end date."
          >
            <Input
              value={recurringOccurrences}
              onChange={({ detail }) => setRecurringOccurrences(detail.value)}
              placeholder="e.g., 6"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={evidenceModalOpen}
        onDismiss={() => {
          if (evidenceUploading) return;
          setEvidenceModalOpen(false);
          setEvidenceError(null);
        }}
        header="Upload evidence"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setEvidenceModalOpen(false);
                setEvidenceError(null);
              }}
              disabled={evidenceUploading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleEvidenceUpload}
              loading={evidenceUploading}
            >
              Upload and attach
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          {evidenceError && <Alert type="error">{evidenceError}</Alert>}
          <FormField label="Attach evidence to">
            <Select
              selectedOption={evidenceTarget}
              options={evidenceTargetOptions}
              onChange={({ detail }) => setEvidenceTarget(detail.selectedOption)}
              placeholder="Select a target"
            />
          </FormField>
          <FormField label="Evidence type">
            <Select
              selectedOption={evidenceTypeOption}
              options={evidenceTypeOptions}
              onChange={({ detail }) => setEvidenceTypeOption(detail.selectedOption)}
              placeholder="Select evidence type"
            />
          </FormField>
          {evidenceTypeOption?.value === "__custom" ? (
            <FormField label="Custom evidence type">
              <Input
                value={customEvidenceType}
                onChange={({ detail }) => setCustomEvidenceType(detail.value)}
                placeholder="Describe the evidence"
              />
            </FormField>
          ) : null}
          <FormField label="File" description="Upload supporting evidence (PDF, Word, image, or text).">
            <FileUpload
              value={evidenceFiles}
              onChange={({ detail }) => setEvidenceFiles(detail.value)}
              multiple={false}
              constraintText="PDF, Word, Excel, text, PNG, JPG."
              loading={evidenceUploading}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={returnModalOpen}
        onDismiss={() => {
          if (returnSubmitting) return;
          setReturnModalOpen(false);
          setReturnError(null);
        }}
        header="Return packet for evidence"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setReturnModalOpen(false);
                setReturnError(null);
              }}
              disabled={returnSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleReturnSubmit}
              loading={returnSubmitting}
            >
              Return packet
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          {returnError && <Alert type="error">{returnError}</Alert>}
          <FormField
            label="Return reason"
            description="Describe what needs to be corrected or uploaded before resubmission."
          >
            <Textarea
              value={returnReason}
              onChange={({ detail }) => setReturnReason(detail.value)}
              placeholder="e.g., Attendance report missing for February"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={overrideModalOpen}
        onDismiss={() => {
          if (overrideSubmitting) return;
          setOverrideModalOpen(false);
          setOverrideError(null);
          setOverrideContext(null);
          setOverrideReason("");
        }}
        header={overrideContext?.title || "Override required"}
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setOverrideModalOpen(false);
                setOverrideError(null);
                setOverrideContext(null);
                setOverrideReason("");
              }}
              disabled={overrideSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleOverrideSubmit}
              loading={overrideSubmitting}
            >
              Apply override
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          {overrideError ? <Alert type="error">{overrideError}</Alert> : null}
          {overrideContext?.error?.message ? (
            <Box variant="p">{overrideContext.error.message}</Box>
          ) : null}
          {renderOverrideDetails(overrideContext?.error?.details)}
          <FormField
            label="Override reason"
            description="Explain why this override is justified for audit and compliance."
          >
            <Textarea
              value={overrideReason}
              onChange={({ detail }) => setOverrideReason(detail.value)}
              placeholder="Provide a concise justification"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </BoardItem>
  );
};

export default PaymentDetailWidget;
