import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  ExpandableSection,
  Alert,
  Modal,
  FormField,
  Input,
  DatePicker,
  FileUpload,
  RadioGroup,
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

const formatLineIdLabel = lineIds => {
  const raw = Array.isArray(lineIds) ? lineIds : [];
  const unique = Array.from(new Set(raw.map(value => String(value).trim()).filter(Boolean)));
  if (!unique.length) return null;
  const numericIds = unique
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isFinite(value));
  const isNumeric = numericIds.length === unique.length;
  if (isNumeric) {
    const sorted = Array.from(new Set(numericIds)).sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let index = 1; index < sorted.length; index += 1) {
      const current = sorted[index];
      if (current === prev + 1) {
        prev = current;
        continue;
      }
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = current;
      prev = current;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    const label = ranges.join(", ");
    return ranges.length === 1 ? `Line ${label}` : `Lines ${label}`;
  }
  const label = unique.join(", ");
  return unique.length === 1 ? `Line ${label}` : `Lines ${label}`;
};

const formatPolicyViolationDetails = details => {
  if (!Array.isArray(details) || !details.length) return null;
  const groups = new Map();
  details.forEach((detail, index) => {
    if (!detail || typeof detail !== "object") return;
    const message = detail.message ? String(detail.message).trim() : "";
    const field = detail.field ? String(detail.field).trim() : "";
    const error = detail.error ? String(detail.error).trim() : "";
    const lineId = detail.lineId || detail.line_id || detail.line || null;
    const key = message || [field, error].filter(Boolean).join("|") || `unknown-${index}`;
    const entry = groups.get(key) || {
      message,
      field,
      error,
      lineIds: [],
      order: index,
    };
    if (lineId) entry.lineIds.push(lineId);
    groups.set(key, entry);
  });
  if (!groups.size) return null;
  return Array.from(groups.values())
    .sort((a, b) => a.order - b.order)
    .map(entry => {
      const fallbackField = entry.field ? entry.field.replace(/[_-]+/g, " ") : "Line";
      const fallbackError = entry.error ? entry.error.replace(/[_-]+/g, " ") : "invalid";
      const summary = entry.message || `${fallbackField}: ${fallbackError}`;
      const lineLabel = formatLineIdLabel(entry.lineIds);
      return lineLabel ? `${lineLabel}: ${summary}` : summary;
    })
    .filter(Boolean);
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

const EVIDENCE_DOCUMENT_TYPE_MAP = {
  ClientApplicationSigned: ["application_form"],
  EIConsent: ["ei_consent"],
  EIVerification: ["ei_verification"],
  IndigenousIdentity: ["indigenous_declaration", "status_card", "letter_of_reference"],
  BandFundingConfirmationOrDenial: ["band_funding_confirmation", "band_funding_denial"],
  AcceptanceLetter: ["acceptance_letter"],
  StatementOfAccount: ["statement_of_account"],
  TuitionStatementOrInvoice: ["statement_of_account"],
  FundingAgreement: ["funding_agreement"],
  CaseManagerAssessment: ["case_assessment"],
  AttendanceReport: ["attendance_form"],
  FinancialOverview: ["financial_overview"],
  IncomeVerification: ["financial_records"],
  ExpenseVerification: ["financial_evidence"],
  PaidReceipt: ["receipt"],
  EquipmentReceipt: ["receipt"],
  AlternatePayeeLetter: ["alternate_payee_letter"],
  InstitutionLetter: ["institution_letter"],
  Quote: ["equipment_quote"],
  EmployerDutiesLetter: ["employer_duties_letter"],
  EmployerOfferLetterAfterSubsidy: ["employer_offer_letter_after_subsidy"],
  WagePlan: ["wage_plan"],
};

const resolveEvidenceDocumentTypes = evidenceType =>
  evidenceType ? EVIDENCE_DOCUMENT_TYPE_MAP[evidenceType] || [] : [];

const normalizeDocumentCategory = value => {
  if (!value) return "";
  return String(value).trim().toLowerCase();
};

const formatShortDate = value => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const PaymentDetailWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    selectedRequest,
    updatePacketStatus,
    updateLine,
    deleteLine,
    addPacketLines,
    createRecurringLines,
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
  const [recurringAmountMode, setRecurringAmountMode] = useState("split_total");
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [unlinkModalOpen, setUnlinkModalOpen] = useState(false);
  const [activeEvidenceRow, setActiveEvidenceRow] = useState(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceError, setEvidenceError] = useState(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadDocumentType, setUploadDocumentType] = useState(null);
  const [documentTypeOptions, setDocumentTypeOptions] = useState([]);
  const [documentTypesLoading, setDocumentTypesLoading] = useState(false);
  const [supportingDocuments, setSupportingDocuments] = useState([]);
  const [supportingDocumentsLoading, setSupportingDocumentsLoading] = useState(false);
  const [supportingDocumentsError, setSupportingDocumentsError] = useState(null);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState(null);
  const [viewError, setViewError] = useState(null);
  const [viewingDocumentId, setViewingDocumentId] = useState(null);
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
  const [deleteLineModalOpen, setDeleteLineModalOpen] = useState(false);
  const [deleteLineSubmitting, setDeleteLineSubmitting] = useState(false);
  const [deleteLineError, setDeleteLineError] = useState(null);
  const [linePotOptions, setLinePotOptions] = useState([]);
  const [linePotLoading, setLinePotLoading] = useState(false);
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
    let cancelled = false;
    setDocumentTypesLoading(true);
    apiFetch("/api/document-types")
      .then(resp => resp.ok ? resp.json() : Promise.reject(new Error("Failed to load document types")))
      .then(payload => {
        if (cancelled) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const options = items
          .filter(item => item && item.code)
          .map(item => ({
            value: item.code,
            label: item.label || item.code,
          }));
        setDocumentTypeOptions(options);
      })
      .catch(() => {
        if (!cancelled) setDocumentTypeOptions([]);
      })
      .finally(() => {
        if (!cancelled) setDocumentTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setRecurringAmountMode("split_total");
    setEvidenceModalOpen(false);
    setLinkModalOpen(false);
    setViewModalOpen(false);
    setUnlinkModalOpen(false);
    setActiveEvidenceRow(null);
    setReplaceMode(false);
    setEvidenceFiles([]);
    setEvidenceUploading(false);
    setEvidenceError(null);
    setUploadLabel("");
    setUploadDocumentType(null);
    setSupportingDocuments([]);
    setSupportingDocumentsLoading(false);
    setSupportingDocumentsError(null);
    setSelectedDocuments([]);
    setLinking(false);
    setLinkError(null);
    setUnlinking(false);
    setUnlinkError(null);
    setViewError(null);
    setViewingDocumentId(null);
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
  const evidenceDocumentRows = useMemo(() => {
    if (!selectedRequest) return [];
    const rows = [];
    const addEvidenceRows = (items, scope, lineId = null, interventionId = null) => {
      (items || []).forEach((item, index) => {
        if (item?.source === "extra") return;
        const rowId = item?.id || item?.documentId || item?.type || `${scope}-${index}`;
        const documentLinks = Array.isArray(item?.documentLinks)
          ? item.documentLinks
              .map(entry => ({
                id: entry?.id || null,
                documentId: entry?.documentId || null,
                name: entry?.name || null,
              }))
              .filter(entry => entry.documentId || entry.name || entry.id)
          : [];
        const documents =
          documentLinks.length
            ? documentLinks.map(entry => entry.name).filter(Boolean)
            : Array.isArray(item?.documentNames) && item.documentNames.length
              ? item.documentNames
              : item?.documentName
                ? [item.documentName]
                : [];
        rows.push({
          id: `${scope}-${rowId}`,
          scope,
          evidence: item?.type || "Evidence",
          evidenceType: item?.type || "Evidence",
          status: buildEvidenceMeta(item),
          documents,
          notes: item?.note ? String(item.note) : "",
          lineId,
          interventionId,
          required: !!item?.required,
          documentLinks,
        });
      });
    };

    addEvidenceRows(
      selectedRequest.baselineEvidence,
      "Baseline compliance",
      null,
      selectedRequest.interventionId || null,
    );
    (selectedRequest.lines || []).forEach(line => {
      const lineLabel = line.paymentType ? `${line.paymentType}` : "Payment line";
      const scope = line.id
        ? `Line LINE-${line.id} • ${lineLabel}`
        : `Line • ${lineLabel}`;
      addEvidenceRows(
        line.evidenceChecklist,
        scope,
        line.id || null,
        line.interventionId || selectedRequest.interventionId || null,
      );
    });
    return rows;
  }, [selectedRequest]);

  const documentTypeOptionMap = useMemo(() => {
    const map = new Map();
    (documentTypeOptions || []).forEach(option => {
      if (option?.value) {
        map.set(option.value, option);
      }
    });
    return map;
  }, [documentTypeOptions]);

  const resolveDocumentTypeLabel = useCallback(
    value => {
      const normalized = normalizeDocumentCategory(value);
      if (!normalized) return "-";
      const match = documentTypeOptionMap.get(normalized);
      return match?.label || value || normalized;
    },
    [documentTypeOptionMap]
  );

  const resolveDocumentLabel = useCallback(doc => {
    if (!doc || typeof doc !== "object") return "Document";
    return (
      doc.label ||
      doc.file_name ||
      doc.fileName ||
      doc.document_name ||
      doc.documentName ||
      doc.name ||
      doc.originalFileName ||
      (doc.id || doc.documentId ? `Document ${doc.id || doc.documentId}` : "Document")
    );
  }, []);

  const resolveDocumentTypeOptionsForEvidence = useCallback(
    evidenceType => {
      const codes = resolveEvidenceDocumentTypes(evidenceType);
      if (!codes.length) return documentTypeOptions;
      return codes.map(code => documentTypeOptionMap.get(code) || { value: code, label: code });
    },
    [documentTypeOptionMap, documentTypeOptions]
  );

  const linkableDocuments = useMemo(() => {
    if (!supportingDocuments.length) return [];
    const evidenceType = activeEvidenceRow?.evidenceType || null;
    const allowedTypes = new Set(resolveEvidenceDocumentTypes(evidenceType).map(normalizeDocumentCategory));
    const linkedDocIds = new Set(
      (activeEvidenceRow?.documentLinks || [])
        .map(link => link?.documentId || link?.id)
        .filter(Boolean)
        .map(id => String(id))
    );
    const normalized = supportingDocuments
      .filter(doc => {
        if (replaceMode) return true;
        const id = doc?.id || doc?.documentId;
        if (!id) return true;
        return !linkedDocIds.has(String(id));
      })
      .map(doc => ({
        ...doc,
        documentCategory: normalizeDocumentCategory(
          doc.document_category || doc.documentCategory || doc.category || doc.document_type
        ),
      }));
    if (!allowedTypes.size) return normalized;
    const matches = normalized.filter(doc => allowedTypes.has(doc.documentCategory));
    return matches.length ? matches : normalized;
  }, [supportingDocuments, activeEvidenceRow, replaceMode]);

  const uploadDocumentTypeOptions = useMemo(() => {
    if (!activeEvidenceRow?.evidenceType) return documentTypeOptions;
    return resolveDocumentTypeOptionsForEvidence(activeEvidenceRow.evidenceType);
  }, [activeEvidenceRow, documentTypeOptions, resolveDocumentTypeOptionsForEvidence]);

  const evidenceTypeFilters = useMemo(
    () => resolveEvidenceDocumentTypes(activeEvidenceRow?.evidenceType),
    [activeEvidenceRow]
  );

  useEffect(() => {
    if (!evidenceModalOpen) return;
    if (!uploadDocumentTypeOptions.length) {
      if (uploadDocumentType !== null) setUploadDocumentType(null);
      return;
    }
    if (!uploadDocumentType || !uploadDocumentTypeOptions.some(opt => opt.value === uploadDocumentType.value)) {
      setUploadDocumentType(uploadDocumentTypeOptions[0]);
    }
  }, [evidenceModalOpen, uploadDocumentType, uploadDocumentTypeOptions]);

  const loadSupportingDocuments = useCallback(
    async row => {
      if (!selectedRequest?.applicantUserId) {
        setSupportingDocuments([]);
        return;
      }
      setSupportingDocumentsLoading(true);
      setSupportingDocumentsError(null);
      try {
        const params = new URLSearchParams();
        const interventionId = row?.interventionId;
        if (interventionId) {
          params.set("interventionId", String(interventionId));
        } else if (selectedRequest?.applicationId) {
          params.set("applicationId", String(selectedRequest.applicationId));
        }
        const query = params.toString() ? `?${params.toString()}` : "";
        const resp = await apiFetch(
          `/api/applicants/${encodeURIComponent(selectedRequest.applicantUserId)}/documents${query}`
        );
        if (!resp.ok) {
          throw new Error("Failed to load supporting documents.");
        }
        const data = await resp.json().catch(() => []);
        setSupportingDocuments(Array.isArray(data) ? data : []);
      } catch (err) {
        setSupportingDocuments([]);
        setSupportingDocumentsError(err?.message || "Failed to load supporting documents.");
      } finally {
        setSupportingDocumentsLoading(false);
      }
    },
    [selectedRequest?.applicantUserId, selectedRequest?.applicationId]
  );

  const handleOpenDocument = useCallback(async documentId => {
    if (!documentId) return;
    setViewError(null);
    setViewingDocumentId(documentId);
    try {
      const res = await apiFetch(`/api/documents/${encodeURIComponent(documentId)}/presign-download`);
      if (!res || !res.ok) {
        const message = res && res.status === 404 ? "Document not found" : "Failed to prepare download";
        throw new Error(message);
      }
      const payload = await res.json().catch(() => null);
      if (!payload) throw new Error("Invalid download response");
      let targetUrl = "";
      if (payload.mode === "s3") {
        targetUrl = payload.presigned?.url || "";
      } else if (payload.mode === "local-direct") {
        const path = payload.path || "";
        if (path) {
          const normalized = path.startsWith("/") ? path : `/${path}`;
          targetUrl = API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
        }
      }
      if (!targetUrl) {
        throw new Error("Document download unavailable");
      }
      if (typeof window !== "undefined") {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setViewError(err?.message || "Failed to open document.");
    } finally {
      setViewingDocumentId(null);
    }
  }, []);

  const openUploadModal = useCallback(
    row => {
      if (!row) return;
      setActiveEvidenceRow(row);
      setEvidenceFiles([]);
      setEvidenceError(null);
      setEvidenceUploading(false);
      setUploadLabel(row.evidenceType || row.evidence || "");
      setUploadDocumentType(null);
      setReplaceMode(false);
      setEvidenceModalOpen(true);
    },
    []
  );

  const openLinkModal = useCallback(
    (row, replace = false) => {
      if (!row) return;
      setActiveEvidenceRow(row);
      setReplaceMode(replace);
      setSelectedDocuments([]);
      setLinkError(null);
      setSupportingDocuments([]);
      loadSupportingDocuments(row);
      setLinkModalOpen(true);
    },
    [loadSupportingDocuments]
  );

  const openViewModal = useCallback(
    row => {
      if (!row) return;
      if (row.documentLinks?.length === 1 && row.documentLinks[0]?.documentId) {
        handleOpenDocument(row.documentLinks[0].documentId);
        return;
      }
      setActiveEvidenceRow(row);
      setViewError(null);
      setViewModalOpen(true);
    },
    [handleOpenDocument]
  );

  const openUnlinkModal = useCallback(row => {
    if (!row) return;
    setActiveEvidenceRow(row);
    setUnlinkError(null);
    setUnlinkModalOpen(true);
  }, []);

  const handleEvidenceAction = useCallback(
    (actionId, row) => {
      if (!row) return;
      switch (actionId) {
        case "view":
          openViewModal(row);
          break;
        case "link":
          openLinkModal(row, false);
          break;
        case "upload":
          openUploadModal(row);
          break;
        case "replace":
          openLinkModal(row, true);
          break;
        case "unlink":
          openUnlinkModal(row);
          break;
        default:
          break;
      }
    },
    [openViewModal, openLinkModal, openUploadModal, openUnlinkModal]
  );

  const deleteDocumentLinks = useCallback(async links => {
    const linkIds = (links || [])
      .map(link => link?.id)
      .filter(Boolean)
      .map(id => String(id));
    if (!linkIds.length) return;
    for (const linkId of linkIds) {
      const resp = await apiFetch(
        `/api/finance/payment-documents/${encodeURIComponent(linkId)}`,
        { method: "DELETE" }
      );
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || "Failed to unlink document.");
      }
    }
  }, []);

  const handleLinkDocuments = useCallback(async () => {
    if (!activeEvidenceRow || !selectedRequest?.id) return;
    if (!selectedDocuments.length) {
      setLinkError("Select at least one document to link.");
      return;
    }
    setLinking(true);
    setLinkError(null);
    try {
      if (replaceMode && activeEvidenceRow.documentLinks?.length) {
        await deleteDocumentLinks(activeEvidenceRow.documentLinks);
      }
      for (const doc of selectedDocuments) {
        const documentId = doc?.id || doc?.documentId;
        if (!documentId) continue;
        const resp = await apiFetch(
          `/api/finance/payment-packets/${encodeURIComponent(selectedRequest.id)}/documents`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentId,
              evidenceType: activeEvidenceRow.evidenceType,
              lineId: activeEvidenceRow.lineId || null,
              required: activeEvidenceRow.required,
              received: true,
            }),
          }
        );
        if (!resp.ok) {
          const payload = await resp.json().catch(() => ({}));
          throw new Error(payload?.message || payload?.error || "Failed to link document.");
        }
      }
      await reloadRequests();
      setLinkModalOpen(false);
    } catch (err) {
      setLinkError(err?.message || "Failed to link documents.");
    } finally {
      setLinking(false);
    }
  }, [activeEvidenceRow, deleteDocumentLinks, replaceMode, reloadRequests, selectedDocuments, selectedRequest?.id]);

  const handleUnlinkDocuments = useCallback(async () => {
    if (!activeEvidenceRow?.documentLinks?.length) {
      setUnlinkError("No documents are linked to this evidence requirement.");
      return;
    }
    setUnlinking(true);
    setUnlinkError(null);
    try {
      await deleteDocumentLinks(activeEvidenceRow.documentLinks);
      await reloadRequests();
      setUnlinkModalOpen(false);
    } catch (err) {
      setUnlinkError(err?.message || "Failed to remove documents.");
    } finally {
      setUnlinking(false);
    }
  }, [activeEvidenceRow, deleteDocumentLinks, reloadRequests]);

  const handleEvidenceUpload = useCallback(async () => {
    if (!activeEvidenceRow || !selectedRequest?.id) return;
    const file = evidenceFiles?.[0] || null;
    if (!file) {
      setEvidenceError("Select a file to upload.");
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
      const formData = new FormData();
      formData.append("file", file);
      const label = uploadLabel.trim() || activeEvidenceRow.evidenceType || file.name;
      formData.append("label", label);
      if (selectedRequest.caseId) {
        formData.append("caseId", selectedRequest.caseId);
      }
      if (activeEvidenceRow.interventionId) {
        formData.append("interventionId", activeEvidenceRow.interventionId);
      } else if (selectedRequest.applicationId) {
        formData.append("applicationId", selectedRequest.applicationId);
      }
      if (uploadDocumentType?.value) {
        formData.append("documentType", uploadDocumentType.value);
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
        const errorCode = payload?.error || null;
        if (errorCode === "unsupported_file_type") {
          throw new Error("That file type is not allowed. Please upload a PDF, JPG, PNG, BMP, or TIFF file.");
        }
        if (errorCode === "file_too_large") {
          const maxBytes = payload?.maxBytes;
          const maxMb = maxBytes ? Math.ceil(Number(maxBytes) / (1024 * 1024)) : null;
          throw new Error(
            maxMb
              ? `The file is too large. The maximum supported size is ${maxMb} MB.`
              : "The file is too large to upload."
          );
        }
        if (errorCode === "invalid_applicant_id") {
          throw new Error("Unable to determine which applicant this upload belongs to.");
        }
        if (errorCode === "application_required_for_document") {
          throw new Error("Select an application or intervention for this document type before uploading.");
        }
        if (errorCode === "invalid_document_type") {
          throw new Error("The selected document type is not valid or inactive.");
        }
        if (errorCode === "document_type_lookup_failed") {
          throw new Error("Unable to validate the document type. Try again.");
        }
        throw new Error(payload?.message || "Failed to upload document.");
      }
      const uploadPayload = await uploadResp.json().catch(() => ({}));
      const documentId = uploadPayload?.document?.id;
      if (!documentId) {
        throw new Error("Upload completed but document ID was not returned.");
      }
      const attachResp = await apiFetch(
        `/api/finance/payment-packets/${encodeURIComponent(selectedRequest.id)}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId,
            evidenceType: activeEvidenceRow.evidenceType,
            lineId: activeEvidenceRow.lineId || null,
            required: activeEvidenceRow.required,
            received: true,
          }),
        }
      );
      if (!attachResp.ok) {
        const payload = await attachResp.json().catch(() => ({}));
        throw new Error(payload?.message || payload?.error || "Failed to attach evidence.");
      }
      await reloadRequests();
      setEvidenceModalOpen(false);
      setActionStatus({ type: "success", message: "Evidence uploaded and attached." });
    } catch (err) {
      setEvidenceError(err?.message || "Failed to upload evidence.");
    } finally {
      setEvidenceUploading(false);
    }
  }, [
    activeEvidenceRow,
    evidenceFiles,
    reloadRequests,
    selectedRequest,
    uploadDocumentType,
    uploadLabel,
  ]);

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
      const details = err?.details || err?.payload?.details;
      const policySummaries = formatPolicyViolationDetails(details) || [];
      const evidenceSummary = formatEvidenceMissingDetails(details);
      const blockerSummaries = [
        ...policySummaries,
        ...(evidenceSummary ? [evidenceSummary] : []),
      ].filter(Boolean);
      if (blockerSummaries.length) {
        const statusKey = normalizePacketStatusKey(status);
        const heading = statusKey === "submitted" ? "Submission blocked" : "Update blocked";
        setActionStatus({
          type: "error",
          message: (
            <SpaceBetween size="xs">
              <Box variant="strong">{heading}:</Box>
              {blockerSummaries.map((summary, index) => (
                <Box key={`${summary}-${index}`} variant="p">
                  {summary}
                </Box>
              ))}
            </SpaceBetween>
          ),
        });
        return;
      }
      setActionStatus({
        type: "error",
        message: err?.message || "Failed to update packet status.",
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
    setRecurringAmountMode("split_total");
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
        amountMode: recurringAmountMode,
        totalAmount: recurringAmountMode === "split_total" ? selectedLine.amount : undefined,
        amount: recurringAmountMode === "repeat_amount" ? selectedLine.amount : undefined,
      });
      setRecurringModalOpen(false);
      setActionStatus({ type: "success", message: "Recurring payment lines generated." });
    } catch (err) {
      setRecurringError(err?.message || "Failed to generate recurring lines.");
    } finally {
      setRecurringSubmitting(false);
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

  const openDeleteLineModal = () => {
    if (!selectedLine || !canEditPacketLines) return;
    setDeleteLineError(null);
    setDeleteLineModalOpen(true);
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

  const handleDeleteLine = async () => {
    if (!selectedLine || !canEditPacketLines) return;
    setDeleteLineSubmitting(true);
    setDeleteLineError(null);
    try {
      await deleteLine(selectedLine.id);
      setDeleteLineModalOpen(false);
      setActionStatus({ type: "success", message: `Line ${selectedLine.id} deleted.` });
    } catch (err) {
      setDeleteLineError(err?.message || "Failed to delete payment line.");
    } finally {
      setDeleteLineSubmitting(false);
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
  const buildEvidenceActionItems = item => {
    const hasDocuments = (item.documentLinks?.length || 0) > 0;
    const canEdit = canUploadEvidence;
    return [
      { id: "view", text: "View documents", disabled: !hasDocuments },
      { id: "link", text: "Link existing documents", disabled: !canEdit },
      { id: "upload", text: "Upload new document", disabled: !canEdit },
      { id: "replace", text: "Replace linked documents", disabled: !canEdit || !hasDocuments },
      { id: "unlink", text: "Remove linked documents", disabled: !canEdit || !hasDocuments },
    ];
  };
  const evidenceDocumentColumns = [
    {
      id: "scope",
      header: "Scope",
      cell: item => item.scope,
    },
    {
      id: "evidence",
      header: "Evidence",
      cell: item => (
        <SpaceBetween size="xs">
          <Box variant="p">{item.evidence}</Box>
          {item.notes ? (
            <Box variant="small" color="text-body-secondary">
              {item.notes}
            </Box>
          ) : null}
        </SpaceBetween>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: item => (
        <StatusIndicator type={item.status.indicator}>
          {item.status.label}
        </StatusIndicator>
      ),
    },
    {
      id: "documents",
      header: "Documents",
      cell: item => (item.documents?.length ? item.documents.join(", ") : "-"),
    },
    {
      id: "actions",
      header: "Actions",
      cell: item => {
        const actionItems = buildEvidenceActionItems(item);
        const hasEnabled = actionItems.some(action => !action.disabled);
        if (!hasEnabled) {
          return (
            <Box variant="small" color="text-body-secondary">
              No actions
            </Box>
          );
        }
        return (
          <ButtonDropdown
            ariaLabel={`Actions for ${item.evidence}`}
            items={actionItems}
            expandToViewport
            onItemClick={({ detail }) => handleEvidenceAction(detail.id, item)}
          >
            Actions
          </ButtonDropdown>
        );
      },
    },
  ];

  const canSubmitPacket = packetStatusKey === "draft";

  const activeEvidenceDocuments = activeEvidenceRow?.documentLinks ?? [];
  const activeEvidenceContext = activeEvidenceRow
    ? [activeEvidenceRow.evidence, activeEvidenceRow.scope].filter(Boolean).join(" • ")
    : "";
  const linkableDocumentsEmptyText = supportingDocuments.length
    ? "No linkable documents available for this evidence requirement."
    : "No supporting documents found for this applicant.";
  const headerActions = selectedRequest ? (
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
  ) : undefined;
  const detailDescription =
    "Add payment lines, attach evidence, then submit to finance (submission emails finance and locks edits).";
  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={detailDescription}
          actions={headerActions}
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
                      <Button
                        onClick={openDeleteLineModal}
                        disabled={!canEditPacketLines || !selectedLine}
                      >
                        Delete selected
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
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={openRecurringModal} disabled={!recurringEligible}>
                  Generate recurring lines
                </Button>
              </SpaceBetween>
            </SpaceBetween>
          ) : (
            <Box variant="p">Select a payment line to view details.</Box>
          )}

          <ExpandableSection headerText="Evidence and documents">
            <SpaceBetween size="m">
              <Table
                items={evidenceDocumentRows}
                columnDefinitions={evidenceDocumentColumns}
                trackBy="id"
                variant="embedded"
                empty={<Box padding="m">No evidence or documents attached.</Box>}
              />
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
        visible={deleteLineModalOpen}
        onDismiss={() => {
          if (deleteLineSubmitting) return;
          setDeleteLineModalOpen(false);
          setDeleteLineError(null);
        }}
        header="Delete payment line"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setDeleteLineModalOpen(false);
                setDeleteLineError(null);
              }}
              disabled={deleteLineSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteLine}
              loading={deleteLineSubmitting}
            >
              Delete line
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          {deleteLineError ? <Alert type="error">{deleteLineError}</Alert> : null}
          <Box>
            This will permanently delete line {selectedLine?.id || "?"} from the packet.
          </Box>
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
          <FormField
            label="Amount strategy"
            description="Split divides the template total across each occurrence."
          >
            <RadioGroup
              value={recurringAmountMode}
              onChange={({ detail }) => setRecurringAmountMode(detail.value)}
              items={[
                { value: "split_total", label: "Split total across occurrences" },
                { value: "repeat_amount", label: "Repeat template amount each occurrence" },
              ]}
            />
          </FormField>
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
          setEvidenceFiles([]);
        }}
        header={
          activeEvidenceRow?.evidence
            ? `Upload evidence for ${activeEvidenceRow.evidence}`
            : "Upload evidence"
        }
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setEvidenceModalOpen(false);
                setEvidenceError(null);
                setEvidenceFiles([]);
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
          <Box variant="awsui-key-label">Evidence requirement</Box>
          <Box variant="p">{activeEvidenceContext || "Evidence requirement not selected."}</Box>
          <Box variant="small" color="text-body-secondary">
            Uploads are saved to Supporting Documents and linked to this evidence requirement.
          </Box>
          <FormField label="Document label">
            <Input
              value={uploadLabel}
              onChange={({ detail }) => setUploadLabel(detail.value)}
              placeholder="e.g., Invoice or signed form"
            />
          </FormField>
          <FormField
            label="Document type"
            description="Used to categorize the document in the supporting documents library."
          >
            <Select
              selectedOption={uploadDocumentType}
              options={uploadDocumentTypeOptions}
              onChange={({ detail }) => setUploadDocumentType(detail.selectedOption || null)}
              placeholder={documentTypesLoading ? "Loading types" : "Select document type"}
              statusType={documentTypesLoading ? "loading" : "finished"}
              empty="No document types available."
              disabled={!uploadDocumentTypeOptions.length}
            />
          </FormField>
          <FormField label="File" description="PDF, JPG, PNG, BMP, or TIFF.">
            <FileUpload
              value={evidenceFiles}
              onChange={({ detail }) => setEvidenceFiles(detail.value)}
              multiple={false}
              accept=".pdf,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
              constraintText="PDF, JPG, PNG, BMP, or TIFF."
              loading={evidenceUploading}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={linkModalOpen}
        onDismiss={() => {
          if (linking) return;
          setLinkModalOpen(false);
          setLinkError(null);
          setSelectedDocuments([]);
        }}
        header={replaceMode ? "Replace linked documents" : "Link supporting documents"}
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setLinkModalOpen(false);
                setLinkError(null);
                setSelectedDocuments([]);
              }}
              disabled={linking}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleLinkDocuments}
              loading={linking}
              disabled={!selectedDocuments.length}
            >
              {replaceMode ? "Replace documents" : "Link documents"}
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          {replaceMode ? (
            <Alert type="info">
              This will remove {activeEvidenceDocuments.length} linked document
              {activeEvidenceDocuments.length === 1 ? "" : "s"} before attaching the selected items.
            </Alert>
          ) : null}
          {supportingDocumentsError && <Alert type="error">{supportingDocumentsError}</Alert>}
          {linkError && <Alert type="error">{linkError}</Alert>}
          <Box variant="awsui-key-label">Evidence requirement</Box>
          <Box variant="p">{activeEvidenceContext || "Evidence requirement not selected."}</Box>
          {evidenceTypeFilters.length ? (
            <Box variant="small" color="text-body-secondary">
              Showing supporting documents that match {activeEvidenceRow?.evidenceType || "this evidence"} when
              available.
            </Box>
          ) : null}
          <Table
            items={linkableDocuments}
            trackBy="id"
            selectionType="multi"
            selectedItems={selectedDocuments}
            onSelectionChange={({ detail }) => setSelectedDocuments(detail.selectedItems || [])}
            columnDefinitions={[
              {
                id: "label",
                header: "Document",
                cell: item => resolveDocumentLabel(item),
              },
              {
                id: "type",
                header: "Type",
                cell: item =>
                  resolveDocumentTypeLabel(
                    item.documentCategory ||
                      item.document_category ||
                      item.category ||
                      item.document_type
                  ),
              },
              {
                id: "uploaded",
                header: "Uploaded",
                cell: item =>
                  formatShortDate(item.uploaded_at || item.created_at || item.updated_at),
              },
              {
                id: "view",
                header: "Preview",
                cell: item => {
                  const documentId = item?.id || item?.documentId;
                  const isViewing = documentId && viewingDocumentId === documentId;
                  return (
                    <Button
                      variant="inline-link"
                      onClick={() => handleOpenDocument(documentId)}
                      disabled={!documentId}
                      loading={isViewing}
                    >
                      View
                    </Button>
                  );
                },
              },
            ]}
            loading={supportingDocumentsLoading}
            loadingText="Loading supporting documents"
            empty={<Box padding="m">{linkableDocumentsEmptyText}</Box>}
          />
        </SpaceBetween>
      </Modal>
      <Modal
        visible={viewModalOpen}
        onDismiss={() => {
          setViewModalOpen(false);
          setViewError(null);
        }}
        header="Linked documents"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={() => {
                setViewModalOpen(false);
                setViewError(null);
              }}
            >
              Close
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          {viewError && <Alert type="error">{viewError}</Alert>}
          <Box variant="awsui-key-label">Evidence requirement</Box>
          <Box variant="p">{activeEvidenceContext || "Evidence requirement not selected."}</Box>
          <Table
            items={activeEvidenceDocuments}
            trackBy="id"
            columnDefinitions={[
              {
                id: "name",
                header: "Document",
                cell: item => resolveDocumentLabel(item),
              },
              {
                id: "open",
                header: "Action",
                cell: item => {
                  const documentId = item?.documentId || item?.id;
                  const isViewing = documentId && viewingDocumentId === documentId;
                  return (
                    <Button
                      variant="inline-link"
                      onClick={() => handleOpenDocument(documentId)}
                      disabled={!documentId}
                      loading={isViewing}
                    >
                      View
                    </Button>
                  );
                },
              },
            ]}
            empty={<Box padding="m">No documents linked to this evidence requirement.</Box>}
          />
        </SpaceBetween>
      </Modal>
      <Modal
        visible={unlinkModalOpen}
        onDismiss={() => {
          if (unlinking) return;
          setUnlinkModalOpen(false);
          setUnlinkError(null);
        }}
        header="Remove linked documents"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setUnlinkModalOpen(false);
                setUnlinkError(null);
              }}
              disabled={unlinking}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUnlinkDocuments}
              loading={unlinking}
              disabled={!activeEvidenceDocuments.length}
            >
              Remove links
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          {unlinkError && <Alert type="error">{unlinkError}</Alert>}
          <Box variant="awsui-key-label">Evidence requirement</Box>
          <Box variant="p">{activeEvidenceContext || "Evidence requirement not selected."}</Box>
          <Box variant="small" color="text-body-secondary">
            Removing links does not delete files from Supporting Documents.
          </Box>
          {activeEvidenceDocuments.length ? (
            <SpaceBetween size="xs">
              {activeEvidenceDocuments.map(doc => (
                <Box key={doc?.id || doc?.documentId || resolveDocumentLabel(doc)} variant="p">
                  {resolveDocumentLabel(doc)}
                </Box>
              ))}
            </SpaceBetween>
          ) : (
            <Box variant="p">No documents are currently linked.</Box>
          )}
        </SpaceBetween>
      </Modal>
    </BoardItem>
  );
};

export default PaymentDetailWidget;
