import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Box,
  Container,
  ColumnLayout,
  Link,
  StatusIndicator,
  Button,
  Table,
  ExpandableSection,
  KeyValuePairs,
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

const requiresServicePeriod = paymentType =>
  ["LivingAllowance", "WageSubsidyEmployer"].includes(paymentType);

const normalizePacketStatusKey = status => {
  if (!status) return "draft";
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "draft" || normalized === "returned") return "draft";
  if (normalized === "cancelled") return "cancelled";
  return "submitted";
};

const packetStatusMeta = {
  draft: { label: "Draft", indicator: "pending" },
  submitted: { label: "Submitted to finance", indicator: "info" },
  cancelled: { label: "Cancelled", indicator: "error" },
};

const lineStatusMeta = {
  needs_evidence: { label: "Needs evidence", indicator: "warning" },
  ready: { label: "Ready to submit", indicator: "success" },
  submitted: { label: "Submitted", indicator: "info" },
  cancelled: { label: "Cancelled", indicator: "error" },
};

const resolveLineStatusMeta = (line, packetStatusKey) => {
  if (line?.status === "cancelled") return lineStatusMeta.cancelled;
  if (packetStatusKey === "submitted") return lineStatusMeta.submitted;
  if ((line?.evidenceSummary?.missing ?? 0) > 0) {
    return lineStatusMeta.needs_evidence;
  }
  return lineStatusMeta.ready;
};

const normalizeInterventionCodeValue = value => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return String(Math.trunc(numeric));
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? String(parsed) : null;
};

const normalizeRegionCode = value => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim().toUpperCase();
  return trimmed ? trimmed : null;
};

const formatLineErrorDetails = details => {
  if (!Array.isArray(details) || !details.length) return null;
  const messages = details
    .map(detail => {
      if (!detail || typeof detail !== "object") return null;
      if (detail.message) return detail.message;
      const field = detail.field ? String(detail.field) : "Line";
      const code = detail.error ? String(detail.error) : "invalid";
      return `${field}: ${code}`;
    })
    .filter(Boolean);
  return messages.length ? messages : null;
};

const formatEvidenceMissingDetails = details => {
  if (!Array.isArray(details) || !details.length) return null;
  const types = details
    .map(entry => entry?.evidenceType || entry?.evidence_type || null)
    .filter(Boolean);
  if (!types.length) return null;
  const unique = Array.from(new Set(types));
  return `Missing evidence: ${unique.join(", ")}`;
};

const buildEvidenceMeta = item => {
  if (item.required && !item.received) {
    return { indicator: "error", label: "Missing" };
  }
  if (item.received) {
    return { indicator: "success", label: "Received" };
  }
  return { indicator: "pending", label: "Optional" };
};

const PaymentDetailWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    selectedRequest,
    updatePacketStatus,
    updateLine,
    addPacketLines,
    createRecurringLines,
    communications,
    addCommunication,
    reloadRequests,
    paymentTypeMappingLookup,
    paymentTypeMappingLoading,
  } = usePaymentsData();
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [actionStatus, setActionStatus] = useState(null);
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
  const requiresLinePeriod = requiresServicePeriod(lineForm.paymentType);
  const selectedInterventionCode = useMemo(() => {
    const raw =
      selectedRequest?.interventionCode ??
      selectedRequest?.intervention_code ??
      null;
    return normalizeInterventionCodeValue(raw);
  }, [selectedRequest]);
  const allowedPaymentTypes = useMemo(() => {
    if (!selectedInterventionCode) return null;
    if (!paymentTypeMappingLookup || typeof paymentTypeMappingLookup.has !== "function") return null;
    if (!paymentTypeMappingLookup.has(selectedInterventionCode)) return null;
    return paymentTypeMappingLookup.get(selectedInterventionCode);
  }, [paymentTypeMappingLookup, selectedInterventionCode]);
  const linePaymentTypeOptions = useMemo(() => {
    if (!allowedPaymentTypes) return PAYMENT_TYPE_OPTIONS;
    return PAYMENT_TYPE_OPTIONS.filter(option => allowedPaymentTypes.has(option.value));
  }, [allowedPaymentTypes]);
  const linePaymentTypeInvalid = useMemo(() => {
    if (!allowedPaymentTypes) return false;
    if (!lineForm.paymentType) return false;
    return !allowedPaymentTypes.has(lineForm.paymentType);
  }, [allowedPaymentTypes, lineForm.paymentType]);
  const linePaymentTypeError = useMemo(() => {
    if (!linePaymentTypeInvalid) return null;
    return selectedInterventionCode
      ? `Payment type is not allowed for intervention code ${selectedInterventionCode}.`
      : "Payment type is not allowed for the selected intervention.";
  }, [linePaymentTypeInvalid, selectedInterventionCode]);
  const linePaymentTypeEmptyMessage = useMemo(() => {
    if (!allowedPaymentTypes) return "No payment types available.";
    if (allowedPaymentTypes.size === 0) {
      return "No payment types are available for this intervention.";
    }
    return "No payment types match.";
  }, [allowedPaymentTypes]);

  useEffect(() => {
    if (selectedRequest?.lines?.length) {
      const firstId = selectedRequest.lines[0].id;
      setSelectedLineId(firstId);
    } else {
      setSelectedLineId(null);
    }
    setActionStatus(null);
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
  }, [selectedRequest?.id]);

  useEffect(() => {
    if (!lineModalOpen) return;
    if (requiresLinePeriod) return;
    if (!lineForm.servicePeriodStart && !lineForm.servicePeriodEnd) return;
    setLineForm(current => ({
      ...current,
      servicePeriodStart: "",
      servicePeriodEnd: "",
    }));
  }, [
    lineModalOpen,
    lineForm.servicePeriodEnd,
    lineForm.servicePeriodStart,
    requiresLinePeriod,
  ]);

  const packetLines = selectedRequest?.lines ?? [];
  const packetStatusKey = normalizePacketStatusKey(selectedRequest?.status);

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
  const showLineServicePeriod = selectedLine
    ? requiresServicePeriod(selectedLine.paymentType)
    : false;
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
    selectedLine.status !== "cancelled" &&
    packetStatusKey === "draft";
  const canEditPacketLines = selectedRequest && packetStatusKey === "draft";
  const canUploadEvidence = packetStatusKey === "draft";

  const selectedLinePaymentType = useMemo(() => {
    const found = findOptionByValue(linePaymentTypeOptions, lineForm.paymentType);
    if (found) return found;
    if (!lineForm.paymentType) return null;
    const label = linePaymentTypeInvalid
      ? `${lineForm.paymentType} (not allowed)`
      : lineForm.paymentType;
    return { value: lineForm.paymentType, label };
  }, [lineForm.paymentType, linePaymentTypeInvalid, linePaymentTypeOptions]);
  const selectedLinePayeeType = useMemo(
    () => findOptionByValue(PAYEE_TYPE_OPTIONS, lineForm.payeeType),
    [lineForm.payeeType]
  );
  const lineRegionCode = useMemo(
    () => normalizeRegionCode(selectedRequest?.reportingUnit),
    [selectedRequest]
  );
  const filteredLinePotOptions = useMemo(() => {
    if (!lineRegionCode) return linePotOptions;
    const filtered = linePotOptions.filter(option => {
      const regions = Array.isArray(option?.regions)
        ? option.regions.map(normalizeRegionCode).filter(Boolean)
        : [];
      return regions.length > 0 && regions.includes(lineRegionCode);
    });
    if (lineModalMode === "edit" && selectedLine?.potId) {
      const selectedMatch = linePotOptions.find(option => option.value === String(selectedLine.potId));
      if (selectedMatch && !filtered.some(option => option.value === selectedMatch.value)) {
        return [selectedMatch, ...filtered];
      }
    }
    return filtered;
  }, [lineModalMode, linePotOptions, lineRegionCode, selectedLine]);
  const selectedLinePot = useMemo(
    () => filteredLinePotOptions.find(option => option.value === lineForm.potId) || null,
    [filteredLinePotOptions, lineForm.potId]
  );
  const linePotEmptyMessage = lineRegionCode
    ? `No budget pots available for ${lineRegionCode}.`
    : "No budget pots available.";

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
                regions: Array.isArray(pot?.regions) ? pot.regions.filter(Boolean) : [],
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

  const handlePacketStatusChange = async (status, options = {}) => {
    if (!selectedRequest || !status) return;
    setActionStatus(null);
    try {
      await updatePacketStatus(selectedRequest.id, status, options);
      const label = packetStatusMeta[normalizePacketStatusKey(status)]?.label || status;
      setActionStatus({ type: "success", message: `Packet updated: ${label}.` });
    } catch (err) {
      const detailMessage = formatEvidenceMissingDetails(err?.details || err?.payload?.details);
      setActionStatus({
        type: "error",
        message: detailMessage || err?.message || "Failed to update packet status.",
      });
    }
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

  const openEvidenceModal = () => {
    if (!canUploadEvidence) return;
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
    if (!selectedRequest || !canEditPacketLines) return;
    setLineError(null);
    setLineModalMode("create");
    resetLineForm({
      potId: selectedRequest.potId || "",
    });
    setLineModalOpen(true);
  };

  const openLineEditModal = () => {
    if (!selectedLine || !canEditPacketLines) return;
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

  useEffect(() => {
    if (!lineModalOpen) return;
    if (lineModalMode !== "create") return;
    if (!allowedPaymentTypes) return;
    if (!lineForm.paymentType) return;
    if (allowedPaymentTypes.has(lineForm.paymentType)) return;
    setLineForm(current => ({ ...current, paymentType: "" }));
  }, [allowedPaymentTypes, lineForm.paymentType, lineModalMode, lineModalOpen]);

  const handleLineSubmit = async () => {
    if (!selectedRequest) return;
    if (!canEditPacketLines) {
      setLineError("Packet is submitted and cannot be edited.");
      return;
    }
    const paymentType = lineForm.paymentType;
    const payeeType = lineForm.payeeType;
    const payeeName = lineForm.payeeName.trim();
    const amountValue = Number(lineForm.amount);
    const potId = lineForm.potId;
    if (allowedPaymentTypes && allowedPaymentTypes.size === 0) {
      setLineError("No payment types are available for the selected intervention.");
      return;
    }
    if (!paymentType || !payeeType || !payeeName) {
      setLineError("Payment type, payee type, and payee name are required.");
      return;
    }
    if (allowedPaymentTypes && !allowedPaymentTypes.has(paymentType)) {
      setLineError(
        selectedInterventionCode
          ? `Payment type is not allowed for intervention code ${selectedInterventionCode}.`
          : "Payment type is not allowed for the selected intervention.",
      );
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
    const requiresPeriod = requiresServicePeriod(paymentType);
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
      const detailMessages = formatLineErrorDetails(err?.details || err?.payload?.details);
      if (detailMessages?.length) {
        setLineError(detailMessages);
      } else {
        setLineError(err?.message || "Failed to save payment line.");
      }
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
        const meta = resolveLineStatusMeta(item, packetStatusKey);
        return <StatusIndicator type={meta.indicator}>{meta.label}</StatusIndicator>;
      },
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: item => {
        const summary = item.evidenceSummary || { required: 0, received: 0, missing: 0 };
        const baselineMissing = selectedRequest?.baselineEvidenceSummary?.missing ?? 0;
        if (!summary.required) {
          if (baselineMissing > 0) {
            return (
              <StatusIndicator type="warning">
                Baseline missing: {baselineMissing}
              </StatusIndicator>
            );
          }
          return <StatusIndicator type="info">No evidence required</StatusIndicator>;
        }
        const indicator = summary.missing === 0 ? "success" : "warning";
        return (
          <StatusIndicator type={indicator}>
            {summary.received}/{summary.required}
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
  ];

  const canSubmitPacket = packetStatusKey === "draft";

  const formatOptionalText = value => {
    if (value === null || value === undefined) return "-";
    const trimmed = String(value).trim();
    return trimmed ? trimmed : "-";
  };
  const detailDescription =
    "Add payment lines, attach evidence, then submit to finance (submission emails finance and locks edits).";
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
          <Table
            trackBy="id"
            items={packetLines}
            selectionType="single"
            selectedItems={selectedLine ? [selectedLine] : []}
            onSelectionChange={({ detail }) => {
              const nextItem = (detail.selectedItems || [])[0] || null;
              setSelectedLineId(nextItem?.id ?? null);
            }}
            columnDefinitions={lineColumns}
            variant="embedded"
            header={
              <Header
                variant="h3"
                counter={`(${packetLines.length})`}
                actions={
                  canEditPacketLines ? (
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
              <ColumnLayout columns={2}>
                <Container header={<Header variant="h3">Line</Header>}>
                  <KeyValuePairs
                    columns={1}
                    items={[
                      { label: "Line ID", value: selectedLine.id || "-" },
                      { label: "Payment type", value: formatOptionalText(selectedLine.paymentType) },
                      {
                        label: "Payee",
                        value: selectedLine.payeeName
                          ? `${selectedLine.payeeName} (${selectedLine.payeeType || "-"})`
                          : "-",
                      },
                      { label: "Budget pot", value: formatOptionalText(selectedLine.potName) },
                    ]}
                  />
                </Container>
                <Container header={<Header variant="h3">Status and amount</Header>}>
                  <KeyValuePairs
                    columns={1}
                    items={[
                      {
                        label: "Status",
                        value: (
                          <StatusIndicator
                            type={resolveLineStatusMeta(selectedLine, packetStatusKey).indicator}
                          >
                            {resolveLineStatusMeta(selectedLine, packetStatusKey).label}
                          </StatusIndicator>
                        ),
                      },
                      {
                        label: "Amount",
                        value: <Box variant="strong">{formatCurrency(selectedLine.amount)}</Box>,
                      },
                      {
                        label: "Service period",
                        value: showLineServicePeriod ? selectedLine.servicePeriodLabel : "-",
                      },
                      { label: "Stream", value: formatOptionalText(selectedLine.fundingStream) },
                    ]}
                  />
                </Container>
              </ColumnLayout>
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={openRecurringModal} disabled={!recurringEligible}>
                  Generate recurring lines
                </Button>
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
                    </SpaceBetween>
                  );
                })}
              </SpaceBetween>
              {canUploadEvidence ? (
                <SpaceBetween size="xs">
                  <Box variant="awsui-key-label">Upload evidence</Box>
                  <Box variant="p">Attach required evidence before submitting to finance.</Box>
                  <Button onClick={openEvidenceModal} disabled={!selectedRequest?.id}>
                    Upload evidence
                  </Button>
                </SpaceBetween>
              ) : null}
            </SpaceBetween>
          </ExpandableSection>

          <ExpandableSection headerText="Notes">
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
                label="Add note"
                description="Use this for internal context on the packet."
              >
                <Textarea
                  value={noteText}
                  onChange={({ detail }) => setNoteText(detail.value)}
                  placeholder="e.g., Follow up on missing receipt."
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

          {(selectedRequest.duplicateWarnings ?? []).length ? (
            <SpaceBetween size="xs">
              <Box variant="awsui-key-label">Duplicate warnings</Box>
              {(selectedRequest.duplicateWarnings ?? []).map(warning => (
                <Box key={warning} variant="p">
                  {warning}
                </Box>
              ))}
            </SpaceBetween>
          ) : null}

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
            <StatusIndicator type={packetStatusMeta[packetStatusKey].indicator}>
              {packetStatusMeta[packetStatusKey].label}
            </StatusIndicator>
            {canSubmitPacket ? (
              <Button
                variant="primary"
                onClick={() => handlePacketStatusChange("submitted")}
                disabled={!selectedRequest?.id}
              >
                Submit to finance
              </Button>
            ) : null}
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
          {lineError ? (
            <Alert type="error">
              {Array.isArray(lineError) ? (
                <SpaceBetween size="xs">
                  {lineError.map((message, index) => (
                    <Box key={`${message}-${index}`} variant="p">
                      {message}
                    </Box>
                  ))}
                </SpaceBetween>
              ) : (
                lineError
              )}
            </Alert>
          ) : null}
          <ColumnLayout columns={2} variant="text-grid">
            <FormField
              label="Payment type"
              errorText={linePaymentTypeError || undefined}
            >
              <Select
                selectedOption={selectedLinePaymentType}
                options={linePaymentTypeOptions}
                onChange={({ detail }) =>
                  setLineForm(current => ({ ...current, paymentType: detail.selectedOption?.value || "" }))
                }
                placeholder="Select payment type"
                filteringType="auto"
                statusType={paymentTypeMappingLoading ? "loading" : "finished"}
                empty={linePaymentTypeEmptyMessage}
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
                options={filteredLinePotOptions}
                onChange={({ detail }) =>
                  setLineForm(current => ({ ...current, potId: detail.selectedOption?.value || "" }))
                }
                statusType={linePotLoading ? "loading" : "finished"}
                placeholder={linePotLoading ? "Loading pots" : "Select budget pot"}
                filteringType="auto"
                empty={linePotEmptyMessage}
              />
            </FormField>
            {requiresLinePeriod ? (
              <>
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
              </>
            ) : null}
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
    </BoardItem>
  );
};

export default PaymentDetailWidget;
