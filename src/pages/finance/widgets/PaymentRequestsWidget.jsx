import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  Table,
  SpaceBetween,
  ButtonDropdown,
  Select,
  CollectionPreferences,
  Pagination,
  TextFilter,
  StatusIndicator,
  Box,
  Link,
  Badge,
  Button,
  ColumnLayout,
  Modal,
  FormField,
  Input,
  Textarea,
  DatePicker,
  Autosuggest,
  Alert,
  Checkbox,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../auth/apiClient";
import { boardItemI18nStrings } from "./common";
import { usePaymentsData } from "./PaymentsDataContext.jsx";
import { findOptionByValue } from "./paymentOptions";
import useCurrentUser from "../../../hooks/useCurrentUser";
import { toCanonicalRole } from "../../../context/RoleMatrixContext";
import { normalizeInterventionStatus } from "../../../utils/interventionStatus.js";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-payments-requests-widths-v4";
const PREFERENCES_STORAGE_KEY = "finance-payments-requests-preferences-v4";
const DEFAULT_PAGE_SIZE = 10;
const CASE_SEARCH_MIN_CHARS = 2;
const BLOCKED_INTERVENTION_STATUSES = new Set([
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "rejected",
  "cancelled",
]);
const AWAITING_SUBMISSION_STATUSES = new Set(["draft", "returned", "awaiting_trigger", "released"]);
const INTERVENTION_LABELS_BY_CODE = {
  "1": "Career research and exploration",
  "2": "Diagnostic assessment",
  "3": "Employment counselling",
  "4": "Skills development - Essential skills",
  "5": "Skills development - Academic upgrading",
  "6": "Work experience - Job creation partnerships",
  "7": "Work experience - Wage subsidy",
  "8": "Work experience - Student employment",
  "9": "Occupational skills training - Certificate",
  "10": "Occupational skills training - Diploma",
  "11": "Occupational skills training - Degree",
  "12": "Occupational skills training - Apprenticeship",
  "13": "Occupational skills training - Vocational",
  "14": "Self-employment",
  "15": "Job search preparation strategies",
  "16": "Job starts supports",
  "17": "Employer referral",
  "18": "Employment retention supports",
  "19": "Referral to agencies",
  "20": "Pre-career development",
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

const EMPTY_CREATE_FORM = {
  caseSearch: "",
  caseId: "",
  interventionId: "",
  reportingUnit: "",
  dueBy: "",
  notes: "",
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
  partialPayment: false,
};

const isBlockedInterventionStatus = status =>
  BLOCKED_INTERVENTION_STATUSES.has(normalizeInterventionStatus(status));

const formatInterventionDisplay = item => {
  if (!item) return "-";
  const code = normalizeInterventionCodeValue(item.interventionCode);
  const codeLabel = code ? INTERVENTION_LABELS_BY_CODE[code] || null : null;
  if (code && codeLabel) {
    const padded = code.length === 1 ? `0${code}` : code;
    return `${padded} - ${codeLabel}`;
  }
  return "Missing intervention label";
};

const RECURRENCE_MODE_REQUIRED = "required";
const RECURRENCE_MODE_OPTIONAL = "optional";
const RECURRENCE_MODE_NOT_ALLOWED = "not_allowed";

const normalizeRecurrenceMode = value => {
  if (typeof value !== "string") return RECURRENCE_MODE_NOT_ALLOWED;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === RECURRENCE_MODE_REQUIRED) return RECURRENCE_MODE_REQUIRED;
  if (normalized === RECURRENCE_MODE_OPTIONAL) return RECURRENCE_MODE_OPTIONAL;
  if (normalized === RECURRENCE_MODE_NOT_ALLOWED || normalized === "disabled") {
    return RECURRENCE_MODE_NOT_ALLOWED;
  }
  return RECURRENCE_MODE_NOT_ALLOWED;
};

const resolveRecurrenceModeForType = (paymentType, recurrencePolicyLookup) => {
  if (!paymentType || !(recurrencePolicyLookup instanceof Map)) {
    return RECURRENCE_MODE_NOT_ALLOWED;
  }
  return normalizeRecurrenceMode(recurrencePolicyLookup.get(paymentType));
};

const requiresServicePeriod = (paymentType, recurrencePolicyLookup) =>
  resolveRecurrenceModeForType(paymentType, recurrencePolicyLookup) === RECURRENCE_MODE_REQUIRED;

const toNumberOrNull = value => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizePacketStatusKey = status => {
  if (!status) return "draft";
  const normalized = String(status).trim().toLowerCase();
  if (
    normalized === "draft" ||
    normalized === "returned" ||
    normalized === "awaiting_trigger" ||
    normalized === "released"
  ) {
    return "draft";
  }
  if (normalized === "cancelled") return "cancelled";
  return "submitted";
};

const statusMeta = {
  draft: { label: "Draft", indicator: "pending" },
  awaiting_trigger: { label: "Awaiting trigger", indicator: "warning" },
  released: { label: "Ready to send", indicator: "success" },
  submitted: { label: "Submitted to finance", indicator: "info" },
  cancelled: { label: "Cancelled", indicator: "error" },
};

const parsePacketMetadata = packet => {
  if (!packet) return {};
  const raw = packet.metadata ?? packet.meta ?? null;
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
};

const resolveLatestIntacctAttempt = packet => {
  const metadata = parsePacketMetadata(packet);
  const history = Array.isArray(metadata.integrationSubmissions)
    ? metadata.integrationSubmissions
    : Array.isArray(metadata.integration_submissions)
      ? metadata.integration_submissions
      : [];
  const intacctHistory = history.filter(entry => {
    const mode = String(entry?.mode || "").toLowerCase();
    return mode === "intacct_rest";
  });
  if (intacctHistory.length) {
    const ordered = [...intacctHistory].sort((a, b) => {
      const left = a?.at ? new Date(a.at).getTime() : 0;
      const right = b?.at ? new Date(b.at).getTime() : 0;
      return right - left;
    });
    return ordered[0] || null;
  }
  const fallback = metadata.intacctRest || metadata.intacct_rest || null;
  return fallback && typeof fallback === "object" ? fallback : null;
};

const resolveIntacctOutcome = attempt => {
  const status = String(attempt?.status || attempt?.outcome || "").toLowerCase();
  if (["success", "failed", "partial"].includes(status)) return status;
  const httpStatus = Number(attempt?.httpStatus || attempt?.statusCode || attempt?.status_code);
  if (Number.isFinite(httpStatus) && httpStatus >= 400) return "failed";
  const attachmentErrors = Array.isArray(attempt?.attachmentErrors)
    ? attempt.attachmentErrors
    : Array.isArray(attempt?.attachment_errors)
      ? attempt.attachment_errors
      : [];
  if (attachmentErrors.length) return "partial";
  if (attempt?.error || attempt?.errorCode || attempt?.error_code) return "failed";
  return attempt ? "success" : "";
};

const resolvePacketStatusMeta = packet => {
  const statusValue = String(packet?.status || "").trim().toLowerCase();
  if (statusValue === "awaiting_trigger") {
    return statusMeta.awaiting_trigger;
  }
  if (statusValue === "released") {
    return statusMeta.released;
  }
  const statusKey = normalizePacketStatusKey(packet?.status);
  if (statusKey !== "submitted") {
    return statusMeta[statusKey] ?? { label: statusKey, indicator: "info" };
  }
  const attempt = resolveLatestIntacctAttempt(packet);
  const outcome = resolveIntacctOutcome(attempt);
  if (outcome === "success") {
    return { label: "Draft AP in Sage", indicator: "success" };
  }
  if (outcome === "partial") {
    return { label: "Sage Exceptions", indicator: "warning" };
  }
  if (outcome === "failed") {
    return { label: "Sage Exceptions", indicator: "error" };
  }
  return statusMeta.submitted;
};

const simpleStatusOptions = [
  { value: "all", label: "All packets" },
  {
    value: "draft",
    label: "Drafts",
    statuses: ["draft", "returned", "awaiting_trigger", "released"],
  },
  {
    value: "submitted",
    label: "Submitted to finance",
    statuses: [
      "submitted",
      "program_review",
      "program_approved",
      "finance_review",
      "finance_approved",
      "on_hold",
      "batched",
      "sent",
      "confirmed",
      "closed",
    ],
  },
  { value: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

const FINANCE_QUEUE_FILTER_OPTIONS = [
  { value: "view_all", label: "View all packets" },
  { value: "due_today_or_earlier", label: "Due today or earlier" },
  { value: "unsubmitted", label: "Unsubmitted" },
  { value: "submitted", label: "Submitted" },
  { value: "blocked", label: "Blocked" },
  { value: "overdue", label: "Overdue" },
  { value: "no_due_date_set", label: "No due date set" },
];

const formatCurrency = value =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);

const TERMINAL_PACKET_STATUSES = new Set([
  "sent",
  "posted",
  "reconciled",
  "confirmed",
  "closed",
  "cancelled",
]);

const toDateOnlyValue = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const formatDateLabel = value => {
  const date = toDateOnlyValue(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
};

const resolveScheduleMeta = packet => {
  const dueDate = toDateOnlyValue(packet?.dueBy);
  if (!dueDate) {
    return { label: "No scheduled date", indicator: "info" };
  }
  const statusValue = String(packet?.status || "").trim().toLowerCase();
  if (TERMINAL_PACKET_STATUSES.has(statusValue)) {
    return { label: formatDateLabel(dueDate), indicator: "info" };
  }
  const today = toDateOnlyValue(new Date());
  if (!today) {
    return { label: formatDateLabel(dueDate), indicator: "info" };
  }
  if (dueDate.getTime() < today.getTime()) {
    return { label: `Overdue · ${formatDateLabel(dueDate)}`, indicator: "error" };
  }
  if (dueDate.getTime() === today.getTime()) {
    return { label: `Due today · ${formatDateLabel(dueDate)}`, indicator: "warning" };
  }
  return { label: `Upcoming · ${formatDateLabel(dueDate)}`, indicator: "success" };
};

const STATUS_SORT_PRIORITY = {
  awaiting_trigger: 1,
  released: 2,
  draft: 3,
  returned: 4,
  submitted: 5,
  program_review: 6,
  program_approved: 7,
  finance_review: 8,
  finance_approved: 9,
  on_hold: 10,
  batched: 11,
  sent: 12,
  confirmed: 13,
  closed: 14,
  cancelled: 15,
};

const compareNullableStrings = (left, right) =>
  String(left || "").localeCompare(String(right || ""), "en", { sensitivity: "base" });

const compareNullableNumbers = (left, right) => {
  const a = Number(left);
  const b = Number(right);
  const hasA = Number.isFinite(a);
  const hasB = Number.isFinite(b);
  if (!hasA && !hasB) return 0;
  if (!hasA) return 1;
  if (!hasB) return -1;
  return a - b;
};

const compareNullableDates = (left, right) => {
  const a = toDateOnlyValue(left);
  const b = toDateOnlyValue(right);
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.getTime() - b.getTime();
};

const comparePacketsByColumn = (left, right, columnId) => {
  switch (columnId) {
    case "schedule":
      return compareNullableDates(left?.dueBy, right?.dueBy);
    case "status": {
      const a = STATUS_SORT_PRIORITY[String(left?.status || "").trim().toLowerCase()] ?? 999;
      const b = STATUS_SORT_PRIORITY[String(right?.status || "").trim().toLowerCase()] ?? 999;
      return a - b;
    }
    case "id":
      return compareNullableStrings(formatPacketLabel(left), formatPacketLabel(right));
    case "clientName":
      return compareNullableStrings(left?.clientName, right?.clientName);
    case "interventionName":
      return compareNullableStrings(formatInterventionDisplay(left), formatInterventionDisplay(right));
    case "amount":
      return compareNullableNumbers(left?.totalAmount, right?.totalAmount);
    case "reportingUnit":
      return compareNullableStrings(left?.reportingUnit, right?.reportingUnit);
    case "submittedOn":
      return compareNullableDates(left?.submittedOn, right?.submittedOn);
    case "ageDays":
      return compareNullableNumbers(left?.ageDays, right?.ageDays);
    default:
      return 0;
  }
};

const formatEvidenceSummary = summary => {
  if (!summary) return { label: "-", indicator: "info" };
  if (!summary.required) {
    return { label: "No evidence required", indicator: "info" };
  }
  if (summary.missing === 0) {
    return { label: `${summary.received}/${summary.required} received`, indicator: "success" };
  }
  return { label: `${summary.received}/${summary.required} missing`, indicator: "warning" };
};

const resolveValidationStatus = packet => {
  const validation = packet?.validation || parsePacketMetadata(packet)?.paymentValidation || null;
  const status = String(validation?.status || "").trim().toLowerCase();
  return status || null;
};

const getPacketBlockingReason = packet => {
  const statusValue = String(packet?.status || "").trim().toLowerCase();
  if (statusValue === "awaiting_trigger") {
    return "Awaiting manual trigger";
  }
  const statusKey = normalizePacketStatusKey(packet?.status);
  if (statusKey !== "draft") {
    if (statusKey === "cancelled") return "Cancelled packet";
    return "Already submitted";
  }
  const missingEvidence = Number(packet?.evidenceSummary?.missing || 0);
  if (missingEvidence > 0) {
    return `Missing required evidence (${missingEvidence})`;
  }
  const validationStatus = resolveValidationStatus(packet);
  if (validationStatus && validationStatus !== "passed") {
    return "Validation not passed";
  }
  return null;
};

const isPacketReadyForSubmission = packet => !getPacketBlockingReason(packet);

const formatCaseClientName = row => {
  const first =
    row?.client?.firstName ||
    row?.client?.first_name ||
    row?.client_first_name ||
    row?.clientFirstName ||
    "";
  const last =
    row?.client?.lastName ||
    row?.client?.last_name ||
    row?.client_last_name ||
    row?.clientLastName ||
    "";
  const combined = `${first} ${last}`.trim();
  return combined || row?.clientName || row?.client_name || "Unknown client";
};

const formatPacketLabel = packet => {
  const caseNumber = packet?.caseNumber || packet?.caseId || "";
  const packetId = packet?.id || "";
  if (caseNumber && packetId) return `${caseNumber}-${packetId}`;
  return caseNumber || packetId || "-";
};

const buildCaseOption = row => {
  const caseNumber = row?.caseNumber || row?.case_number || row?.id;
  const label = `Case ${caseNumber || "-"} - ${formatCaseClientName(row)}`;
  const tracking = row?.trackingId || row?.tracking_id || row?.tracking;
  return {
    value: label,
    label,
    description: tracking ? `Tracking ${tracking}` : undefined,
    caseId: row?.id ? String(row.id) : null,
  };
};

const mapRegionOption = region => ({
  value: String(region.code || "").trim().toUpperCase(),
  label: region.name ? `${region.name} (${String(region.code || "").trim().toUpperCase()})` : String(region.code || "").trim().toUpperCase(),
});

const mapPotOption = pot => {
  const code = pot?.code ? String(pot.code).trim() : "";
  const name = pot?.name ? String(pot.name).trim() : "";
  const label = [code, name].filter(Boolean).join(" - ") || String(pot?.id || "").trim();
  return {
    value: String(pot?.id || pot?.value || ""),
    label,
    description: pot?.fundingSource || pot?.funding_source || undefined,
    regions: Array.isArray(pot?.regions) ? pot.regions.filter(Boolean) : [],
  };
};

const resolveInterventionAmount = intervention => {
  if (!intervention) return null;
  const candidates = [
    intervention.approvedAmount,
    intervention.budgetAmount,
    intervention.cost,
    intervention.plannedCost,
    intervention.amount,
  ];
  for (const candidate of candidates) {
    const numeric = toNumberOrNull(candidate);
    if (numeric !== null && numeric > 0) {
      return Math.round(numeric * 100) / 100;
    }
  }
  return null;
};

const columnDefinitions = [
  {
    id: "id",
    header: "Packet",
    sortingComparator: (a, b) => comparePacketsByColumn(a, b, "id"),
    cell: item => (
      <Link
        href="#"
        onFollow={event => {
          event.preventDefault();
          if (typeof item.onOpen === "function") {
            item.onOpen();
          }
        }}
      >
        {formatPacketLabel(item)}
      </Link>
    ),
  },
  {
    id: "clientName",
    header: "Client",
    sortingComparator: (a, b) => comparePacketsByColumn(a, b, "clientName"),
    cell: item => item.clientName ?? "-",
  },
  {
    id: "interventionName",
    header: "Intervention",
    sortingComparator: (a, b) => comparePacketsByColumn(a, b, "interventionName"),
    cell: item => formatInterventionDisplay(item),
  },
  {
    id: "amount",
    header: "Amount",
    sortingComparator: (a, b) => comparePacketsByColumn(a, b, "amount"),
    cell: item => {
      const totals = item.streamTotals || {};
      return (
        <SpaceBetween direction="horizontal" size="xs">
          <Badge color="blue">CRF {formatCurrency(totals.CRF ?? 0)}</Badge>
          <Badge color="grey">EI {formatCurrency(totals.EI ?? 0)}</Badge>
        </SpaceBetween>
      );
    },
  },
  {
    id: "stream",
    header: "Stream",
    cell: item => {
      const entries = Object.entries(item.streamTotals ?? {}).filter(([, value]) => value > 0);
      if (!entries.length) return "-";
      return entries.map(([stream, value]) => `${stream} ${formatCurrency(value)}`).join(" / ");
    },
  },
  {
    id: "reportingUnit",
    header: "Reporting unit",
    sortingComparator: (a, b) => comparePacketsByColumn(a, b, "reportingUnit"),
    cell: item => item.reportingUnit ?? "-",
  },
  {
    id: "potName",
    header: "Pot",
    cell: item => item.potName ?? "-",
  },
  {
    id: "requester",
    header: "Requester",
    cell: item => item.requester ?? "-",
  },
  {
    id: "ageDays",
    header: "Age (days)",
    sortingComparator: (a, b) => comparePacketsByColumn(a, b, "ageDays"),
    cell: item => item.ageDays ?? "-",
  },
  {
    id: "schedule",
    header: "Schedule",
    sortingComparator: (a, b) => comparePacketsByColumn(a, b, "schedule"),
    cell: item => {
      const meta = resolveScheduleMeta(item);
      return <StatusIndicator type={meta.indicator}>{meta.label}</StatusIndicator>;
    },
  },
  {
    id: "evidence",
    header: "Evidence",
    cell: item => {
      const meta = formatEvidenceSummary(item.evidenceSummary);
      return <StatusIndicator type={meta.indicator}>{meta.label}</StatusIndicator>;
    },
  },
  {
    id: "blockingReason",
    header: "Blocking",
    cell: item => {
      const reason = item.blockingReason || getPacketBlockingReason(item);
      if (!reason) {
        return <StatusIndicator type="success">Ready to send</StatusIndicator>;
      }
      return <StatusIndicator type="warning">{reason}</StatusIndicator>;
    },
  },
  {
    id: "status",
    header: "Status",
    sortingComparator: (a, b) => comparePacketsByColumn(a, b, "status"),
    cell: item => {
      const meta = resolvePacketStatusMeta(item);
      return <StatusIndicator type={meta.indicator}>{meta.label}</StatusIndicator>;
    },
  },
  {
    id: "riskFlags",
    header: "Risk flags",
    cell: item =>
      item.riskFlags?.length ? (
        <SpaceBetween direction="horizontal" size="xs">
          {item.riskFlags.map(flag => (
            <Badge key={flag} color="red">
              {flag}
            </Badge>
          ))}
        </SpaceBetween>
      ) : (
        "-"
      ),
  },
  {
    id: "submittedOn",
    header: "Submitted",
    sortingComparator: (a, b) => comparePacketsByColumn(a, b, "submittedOn"),
    cell: item => item.submittedOn,
  },
];

const defaultPreferences = {
  pageSize: DEFAULT_PAGE_SIZE,
  visibleColumns: [
    "id",
    "clientName",
    "schedule",
    "status",
    "amount",
    "blockingReason",
  ],
};

const loadColumnWidths = () => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("[Payments] failed to parse request column widths", error);
    return [];
  }
};

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return defaultPreferences;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return defaultPreferences;
    }
    const { pageSize, visibleColumns } = parsed;
    return {
      pageSize: Number.isFinite(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
      visibleColumns: Array.isArray(visibleColumns)
        ? visibleColumns.filter(id => columnDefinitions.some(column => column.id === id))
        : defaultPreferences.visibleColumns,
    };
  } catch (error) {
    console.error("[Payments] failed to parse request preferences", error);
    return defaultPreferences;
  }
};

const PaymentRequestsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    requests,
    selectedRequestId,
    selectRequest,
    updatePacketStatus,
    createPacket,
    paymentTypeMappingLookup,
    paymentTypeOptions: configuredPaymentTypeOptions,
    payeeTypeOptions: configuredPayeeTypeOptions,
    paymentTypeRecurrencePolicyLookup,
    paymentTypeMappingLoading,
    loading,
    error,
  } = usePaymentsData();
  const currentUser = useCurrentUser();
  const canonicalRole = toCanonicalRole(currentUser?.role || "");
  const isAdminRole =
    canonicalRole === "System Administrator" || canonicalRole === "Program Administrator";
  const lockedCaseId = metadata?.caseId ? String(metadata.caseId) : "";
  const lockedCaseLabel =
    metadata?.caseLabel || (lockedCaseId ? `Case ${lockedCaseId}` : "");
  const isCaseLocked = Boolean(lockedCaseId);
  const isProgramView = metadata?.mode === "program";
  const showCreatePacketAction = isProgramView && metadata?.hideCreatePacketAction !== true;
  const caseRegionCode = metadata?.caseRegionCode
    ? String(metadata.caseRegionCode).trim().toUpperCase()
    : null;
  const preselectedInterventionId = metadata?.selectedInterventionId
    ? String(metadata.selectedInterventionId)
    : "";

  const statusOptions = useMemo(() => {
    if (Array.isArray(metadata?.statusOptions) && metadata.statusOptions.length) {
      return metadata.statusOptions;
    }
    return simpleStatusOptions;
  }, [metadata?.statusOptions]);
  const [statusFilter, setStatusFilter] = useState(statusOptions[0]);
  const [filteringText, setFilteringText] = useState("");
  const [columnWidths, setColumnWidths] = useState(() => loadColumnWidths());
  const [preferences, setPreferences] = useState(() => loadPreferences());
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [sortingColumnId, setSortingColumnId] = useState("schedule");
  const [sortingDescending, setSortingDescending] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const defaultCreateForm = useMemo(
    () => ({
      ...EMPTY_CREATE_FORM,
      caseSearch: isCaseLocked ? lockedCaseLabel : "",
      caseId: isCaseLocked ? lockedCaseId : "",
    }),
    [isCaseLocked, lockedCaseId, lockedCaseLabel]
  );
  const [createForm, setCreateForm] = useState(() => ({ ...defaultCreateForm }));
  const [createError, setCreateError] = useState(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [financeQueueFilter, setFinanceQueueFilter] = useState(
    () => FINANCE_QUEUE_FILTER_OPTIONS[0]
  );
  const [queueSelectedIds, setQueueSelectedIds] = useState([]);
  const [bulkSubmitModalOpen, setBulkSubmitModalOpen] = useState(false);
  const [bulkSubmitError, setBulkSubmitError] = useState(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [caseOptions, setCaseOptions] = useState([]);
  const [caseOptionsLoading, setCaseOptionsLoading] = useState(false);
  const [caseDetailsLoading, setCaseDetailsLoading] = useState(false);
  const [caseDetails, setCaseDetails] = useState(null);
  const [interventionOptions, setInterventionOptions] = useState([]);
  const [interventionsLoading, setInterventionsLoading] = useState(false);
  const [interventionsBlockedCount, setInterventionsBlockedCount] = useState(0);
  const [regionOptions, setRegionOptions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [potOptions, setPotOptions] = useState([]);
  const [potsLoading, setPotsLoading] = useState(false);
  const managePaymentsSelectionRef = useRef(false);
  const lastInterventionIdRef = useRef(null);
  const resolveReportingUnitForPot = useCallback(
    potId => {
      if (!potId) return null;
      const match = potOptions.find(option => option.value === String(potId)) || null;
      const regions = Array.isArray(match?.regions)
        ? match.regions.map(code => String(code).trim().toUpperCase()).filter(Boolean)
        : [];
      if (regions.length === 1) {
        return regions[0];
      }
      if (caseRegionCode) {
        return caseRegionCode;
      }
      return null;
    },
    [caseRegionCode, potOptions]
  );
  useEffect(() => {
    if (isProgramView) {
      setQueueSelectedIds([]);
    }
  }, [isProgramView]);

  useEffect(() => {
    if (!statusOptions.length) return;
    if (!statusFilter || !statusOptions.some(option => option.value === statusFilter.value)) {
      setStatusFilter(statusOptions[0]);
    }
  }, [statusOptions, statusFilter]);

  useEffect(() => {
    if (!createModalOpen || !isProgramView) return;
    if (!regionOptions.length && !regionsLoading) {
      setRegionsLoading(true);
      apiFetch("/api/regions/canada")
        .then(resp => resp.ok ? resp.json() : Promise.reject(new Error("Failed to load regions")))
        .then(payload => {
          const list = Array.isArray(payload) ? payload.map(mapRegionOption).filter(option => option.value) : [];
          setRegionOptions(list);
        })
        .catch(() => {
          setRegionOptions([]);
        })
        .finally(() => {
          setRegionsLoading(false);
        });
    }
    if (!potOptions.length && !potsLoading) {
      setPotsLoading(true);
      apiFetch("/api/reference/budget-pots-lite?chargeableOnly=1")
        .then(resp => resp.ok ? resp.json() : Promise.reject(new Error("Failed to load pots")))
        .then(payload => {
          const list = Array.isArray(payload) ? payload.map(mapPotOption).filter(option => option.value) : [];
          setPotOptions(list);
        })
        .catch(() => {
          setPotOptions([]);
        })
        .finally(() => {
          setPotsLoading(false);
        });
    }
  }, [createModalOpen, isProgramView, regionOptions.length, regionsLoading, potOptions.length, potsLoading]);

  const resetCreateForm = () => {
    setCreateForm({ ...defaultCreateForm });
    setCreateError(null);
    setCaseOptions([]);
    setCaseDetails(null);
    setCaseDetailsLoading(false);
    setInterventionOptions([]);
    setInterventionsLoading(false);
    setInterventionsBlockedCount(0);
  };

  const updateCreateForm = (key, value) => {
    setCreateForm(current => ({ ...current, [key]: value }));
  };

  const handleOpenCreateModal = () => {
    if (!showCreatePacketAction) return;
    resetCreateForm();
    setCreateModalOpen(true);
  };

  const selectedInterventionOption = useMemo(
    () => interventionOptions.find(option => option.value === createForm.interventionId) || null,
    [interventionOptions, createForm.interventionId]
  );
  const selectedInterventionCode = useMemo(() => {
    const raw =
      selectedInterventionOption?.interventionCode ??
      selectedInterventionOption?.code ??
      selectedInterventionOption?.intervention_code ??
      null;
    return normalizeInterventionCodeValue(raw);
  }, [selectedInterventionOption]);
  const allowedPaymentTypes = useMemo(() => {
    if (!selectedInterventionCode) return null;
    if (!paymentTypeMappingLookup || typeof paymentTypeMappingLookup.has !== "function") return null;
    if (!paymentTypeMappingLookup.has(selectedInterventionCode)) return null;
    return paymentTypeMappingLookup.get(selectedInterventionCode);
  }, [paymentTypeMappingLookup, selectedInterventionCode]);
  const paymentTypeOptions = useMemo(() => {
    if (!allowedPaymentTypes) return configuredPaymentTypeOptions;
    return configuredPaymentTypeOptions.filter(option => allowedPaymentTypes.has(option.value));
  }, [allowedPaymentTypes, configuredPaymentTypeOptions]);
  const paymentTypeRestrictionError = useMemo(() => {
    if (!allowedPaymentTypes) return null;
    if (!createForm.paymentType) return null;
    if (allowedPaymentTypes.has(createForm.paymentType)) return null;
    return selectedInterventionCode
      ? `Payment type is not allowed for intervention code ${selectedInterventionCode}.`
      : "Payment type is not allowed for the selected intervention.";
  }, [allowedPaymentTypes, createForm.paymentType, selectedInterventionCode]);
  const paymentTypeEmptyMessage = useMemo(() => {
    if (!configuredPaymentTypeOptions.length) return "No payment types are configured.";
    if (!allowedPaymentTypes) return "No payment types available.";
    if (allowedPaymentTypes.size === 0) {
      return "No payment types are available for this intervention.";
    }
    return "No payment types match.";
  }, [allowedPaymentTypes, configuredPaymentTypeOptions]);
  const derivedInterventionAmount = useMemo(
    () => resolveInterventionAmount(selectedInterventionOption),
    [selectedInterventionOption]
  );
  const amountLocked =
    isProgramView && derivedInterventionAmount !== null && !createForm.partialPayment;
  const amountEditable = !amountLocked;

  useEffect(() => {
    if (!createModalOpen) return;
    if (!selectedInterventionOption) {
      lastInterventionIdRef.current = null;
      setCreateForm(current => {
        if (
          !current.potId &&
          !current.amount &&
          !current.reportingUnit &&
          !current.partialPayment
        ) {
          return current;
        }
        return {
          ...current,
          potId: "",
          amount: "",
          reportingUnit: "",
          partialPayment: false,
        };
      });
      return;
    }
    const nextInterventionId = selectedInterventionOption.value;
    const interventionChanged = lastInterventionIdRef.current !== nextInterventionId;
    const derivedPotId =
      selectedInterventionOption.potId ||
      selectedInterventionOption.planBudgetPotId ||
      "";
    const derivedReportingUnit = resolveReportingUnitForPot(derivedPotId);
    setCreateForm(current => {
      const next = { ...current };
      if (interventionChanged) {
        next.partialPayment = false;
      }
      if (derivedPotId) {
        if (current.potId !== String(derivedPotId)) {
          next.potId = String(derivedPotId);
        }
      } else if (interventionChanged && current.potId) {
        next.potId = "";
      }
      if (derivedInterventionAmount !== null) {
        if (!current.partialPayment || interventionChanged) {
          next.amount = String(derivedInterventionAmount);
        }
      } else if (interventionChanged && current.amount) {
        next.amount = "";
      }
      const shouldUpdateReportingUnit =
        derivedReportingUnit &&
        (!current.reportingUnit || !isAdminRole || interventionChanged);
      if (shouldUpdateReportingUnit && current.reportingUnit !== derivedReportingUnit) {
        next.reportingUnit = derivedReportingUnit;
      } else if (interventionChanged && !derivedReportingUnit && current.reportingUnit) {
        next.reportingUnit = "";
      }
      return next;
    });
    lastInterventionIdRef.current = nextInterventionId;
  }, [
    createModalOpen,
    derivedInterventionAmount,
    isAdminRole,
    resolveReportingUnitForPot,
    selectedInterventionOption,
  ]);

  useEffect(() => {
    if (!createModalOpen) return;
    if (createForm.partialPayment) return;
    if (derivedInterventionAmount === null) return;
    const nextAmount = String(derivedInterventionAmount);
    if (createForm.amount === nextAmount) return;
    setCreateForm(current => ({ ...current, amount: nextAmount }));
  }, [createModalOpen, createForm.amount, createForm.partialPayment, derivedInterventionAmount]);

  useEffect(() => {
    if (!createModalOpen || !isProgramView) return;
    if (!preselectedInterventionId) return;
    if (createForm.interventionId) return;
    const match = interventionOptions.find(option => option.value === preselectedInterventionId);
    if (!match) return;
    setCreateForm(current => ({ ...current, interventionId: match.value }));
  }, [
    createModalOpen,
    createForm.interventionId,
    interventionOptions,
    isProgramView,
    preselectedInterventionId,
  ]);

  useEffect(() => {
    if (!createModalOpen) return;
    if (!allowedPaymentTypes) return;
    if (!createForm.paymentType) return;
    if (allowedPaymentTypes.has(createForm.paymentType)) return;
    setCreateForm(current => ({ ...current, paymentType: "" }));
  }, [allowedPaymentTypes, createForm.paymentType, createModalOpen]);

  const requiresPeriodFields = requiresServicePeriod(
    createForm.paymentType,
    paymentTypeRecurrencePolicyLookup,
  );
  useEffect(() => {
    if (!createModalOpen) return;
    if (requiresPeriodFields) return;
    if (!createForm.servicePeriodStart && !createForm.servicePeriodEnd) return;
    setCreateForm(current => ({
      ...current,
      servicePeriodStart: "",
      servicePeriodEnd: "",
    }));
  }, [createModalOpen, createForm.servicePeriodEnd, createForm.servicePeriodStart, requiresPeriodFields]);

  const handleCloseCreateModal = () => {
    if (createSubmitting) return;
    setCreateModalOpen(false);
  };

  const loadCaseSuggestions = async query => {
    if (isCaseLocked) return;
    const trimmed = (query || "").trim();
    if (trimmed.length < CASE_SEARCH_MIN_CHARS) {
      setCaseOptions([]);
      return;
    }
    setCaseOptionsLoading(true);
    try {
      const resp = await apiFetch(
        `/api/cases?query=${encodeURIComponent(trimmed)}&pageSize=10&groupByClient=false`
      );
      if (!resp.ok) {
        throw new Error(`Case search failed (${resp.status})`);
      }
      const payload = await resp.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const options = items.map(buildCaseOption).filter(option => option.caseId);
      setCaseOptions(options);
    } catch (err) {
      setCaseOptions([]);
    } finally {
      setCaseOptionsLoading(false);
    }
  };

  const loadCaseContext = async caseId => {
    if (!caseId) return;
    setCaseDetailsLoading(true);
    setInterventionsLoading(true);
    setCaseDetails(null);
    setInterventionOptions([]);
    try {
      const [caseResp, workspaceResp] = await Promise.all([
        apiFetch(`/api/cases/${encodeURIComponent(caseId)}`),
        apiFetch(`/api/cases/${encodeURIComponent(caseId)}/workspace`),
      ]);
      if (caseResp.ok) {
        const casePayload = await caseResp.json();
        setCaseDetails(casePayload || null);
      }
      if (workspaceResp.ok) {
        const workspacePayload = await workspaceResp.json();
        const plans = Array.isArray(workspacePayload?.actionPlans) ? workspacePayload.actionPlans : [];
        const options = [];
        plans.forEach(plan => {
          const planLabel = plan?.name || plan?.title || `Plan ${plan?.id || ""}`.trim();
          const planBudgetPotId =
            plan?.budgetPotId ||
            plan?.budget_pot_id ||
            plan?.budgetPot ||
            plan?.budget_pot ||
            null;
          const planFundingStream = plan?.fundingStream || plan?.funding_stream || null;
          const interventions = Array.isArray(plan?.interventions) ? plan.interventions : [];
          interventions.forEach(item => {
            const id = item?.id || item?.intervention_id;
            if (!id) return;
            const title =
              item?.title ||
              item?.description ||
              item?.notes ||
              item?.interventionCode ||
              item?.intervention_code ||
              item?.code ||
              `Intervention ${id}`;
            options.push({
              value: String(id),
              label: title,
              description: planLabel || undefined,
              planId: plan?.id || null,
              status: item?.status || item?.statusRaw || null,
              interventionCode:
                item?.interventionCode ||
                item?.intervention_code ||
                item?.code ||
                null,
              potId:
                item?.potId ||
                item?.budgetPotId ||
                item?.budget_pot_id ||
                planBudgetPotId ||
                null,
              planBudgetPotId,
              fundingStream: item?.fundingStream || planFundingStream || null,
              approvedAmount: item?.approvedAmount ?? item?.approved_amount ?? null,
              budgetAmount: item?.budgetAmount ?? item?.budget_amount ?? null,
              cost: item?.cost ?? item?.plannedCost ?? item?.intervention_cost ?? null,
              plannedCost: item?.plannedCost ?? null,
              startDate: item?.startDate || item?.start_date || null,
              endDate: item?.endDate || item?.end_date || null,
            });
          });
        });
        const eligible = options.filter(option => !isBlockedInterventionStatus(option.status));
        setInterventionOptions(eligible);
        setInterventionsBlockedCount(Math.max(0, options.length - eligible.length));
      }
    } catch (err) {
      setInterventionOptions([]);
      setInterventionsBlockedCount(0);
    } finally {
      setCaseDetailsLoading(false);
      setInterventionsLoading(false);
    }
  };

  useEffect(() => {
    if (!createModalOpen || !isCaseLocked || !lockedCaseId) return;
    setCreateForm(current => ({
      ...current,
      caseSearch: lockedCaseLabel,
      caseId: lockedCaseId,
    }));
    loadCaseContext(lockedCaseId);
  }, [createModalOpen, isCaseLocked, lockedCaseId, lockedCaseLabel]);

  const handleCaseChange = ({ detail }) => {
    if (isCaseLocked) return;
    const value = detail.value || "";
    updateCreateForm("caseSearch", value);
    updateCreateForm("caseId", "");
    setCaseDetails(null);
    setInterventionOptions([]);
    setInterventionsBlockedCount(0);
    updateCreateForm("interventionId", "");
    if (!value) {
      setCaseOptions([]);
      return;
    }
    if (value.trim().length >= CASE_SEARCH_MIN_CHARS) {
      loadCaseSuggestions(value);
    } else {
      setCaseOptions([]);
    }
  };

  const handleCaseSelect = ({ detail }) => {
    if (isCaseLocked) return;
    const value = detail.value || "";
    updateCreateForm("caseSearch", value);
    const selected = caseOptions.find(option => option.value === value) || null;
    const caseId = selected?.caseId ? String(selected.caseId) : "";
    updateCreateForm("caseId", caseId);
    updateCreateForm("interventionId", "");
    if (caseId) {
      loadCaseContext(caseId);
    }
  };

  const handleCreateSubmit = async () => {
    setCreateError(null);
    const paymentType = createForm.paymentType;
    const payeeType = createForm.payeeType;
    const payeeName = createForm.payeeName.trim();
    const amountInputValue = toNumberOrNull(createForm.amount);
    const derivedAmount = derivedInterventionAmount;
    const amountLocked = derivedAmount !== null && !createForm.partialPayment;
    const amountValue = amountLocked ? derivedAmount : amountInputValue;
    const potId = createForm.potId;
    if (isProgramView && !createForm.interventionId) {
      setCreateError("Select an intervention to create a payment packet.");
      return;
    }
    if (isProgramView && selectedInterventionOption && isBlockedInterventionStatus(selectedInterventionOption.status)) {
      setCreateError("Selected intervention is not eligible for payment initiation.");
      return;
    }
    if (isProgramView && selectedInterventionOption && derivedAmount === null) {
      setCreateError("Selected intervention is missing an approved amount.");
      return;
    }
    if (!createForm.caseId) {
      setCreateError("Select a case to create a payment packet.");
      return;
    }
    if (allowedPaymentTypes && allowedPaymentTypes.size === 0) {
      setCreateError("No payment types are available for the selected intervention.");
      return;
    }
    if (!paymentType || !payeeType || !payeeName) {
      setCreateError("Payment type, payee type, and payee name are required.");
      return;
    }
    if (allowedPaymentTypes && !allowedPaymentTypes.has(paymentType)) {
      setCreateError(
        selectedInterventionCode
          ? `Payment type is not allowed for intervention code ${selectedInterventionCode}.`
          : "Payment type is not allowed for the selected intervention.",
      );
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setCreateError("Amount must be a positive number.");
      return;
    }
    if (createForm.partialPayment && derivedAmount !== null && amountValue > derivedAmount) {
      setCreateError("Amount cannot exceed the approved intervention total.");
      return;
    }
    if (!potId) {
      setCreateError("Select a budget pot for the payment line.");
      return;
    }
    if (isProgramView && !createForm.reportingUnit) {
      setCreateError("Reporting unit is required.");
      return;
    }
    const requiresPeriod = requiresServicePeriod(
      paymentType,
      paymentTypeRecurrencePolicyLookup,
    );
    if (requiresPeriod && (!createForm.servicePeriodStart || !createForm.servicePeriodEnd)) {
      setCreateError("Service period start and end are required for this payment type.");
      return;
    }
    setCreateSubmitting(true);
    try {
      const clientId =
        caseDetails?.clientId ||
        caseDetails?.client_id ||
        caseDetails?.client?.id ||
        null;
      const payload = {
        caseId: Number(createForm.caseId),
        clientId: clientId ? Number(clientId) : null,
        interventionId: createForm.interventionId ? Number(createForm.interventionId) : null,
        reportingUnit: createForm.reportingUnit || null,
        dueBy: createForm.dueBy || null,
        notes: createForm.notes ? createForm.notes.trim() : null,
        lines: [
          {
            paymentType,
            payeeType,
            payeeName,
            payeeReference: createForm.payeeReference ? createForm.payeeReference.trim() : null,
            amount: amountValue,
            potId: Number(potId),
            servicePeriodStart: createForm.servicePeriodStart || null,
            servicePeriodEnd: createForm.servicePeriodEnd || null,
            requestedPaymentDate: createForm.requestedPaymentDate || null,
            invoiceReferenceNumber: createForm.invoiceReferenceNumber || null,
          },
        ],
      };
      await createPacket(payload);
      setCreateModalOpen(false);
    } catch (err) {
      setCreateError(err?.message || "Failed to create payment packet.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const visibleColumns = useMemo(() => {
    const allById = new Map(columnDefinitions.map(column => [column.id, column]));
    const preferredIds = Array.isArray(preferences.visibleColumns)
      ? preferences.visibleColumns
      : defaultPreferences.visibleColumns;
    return preferredIds
      .map(id => allById.get(id))
      .filter(Boolean);
  }, [preferences.visibleColumns]);

  const requestsWithWorkflowMeta = useMemo(
    () =>
      requests.map(item => ({
        ...item,
        blockingReason: getPacketBlockingReason(item),
        readyToSubmit: isPacketReadyForSubmission(item),
      })),
    [requests]
  );

  const dueSubmissionItems = useMemo(
    () => requestsWithWorkflowMeta.filter(item => normalizePacketStatusKey(item.status) === "draft"),
    [requestsWithWorkflowMeta]
  );

  const filteredItems = useMemo(() => {
    const queueFilterValue = isProgramView
      ? null
      : financeQueueFilter?.value || "view_all";
    const sourceItems = isProgramView
      ? requestsWithWorkflowMeta
      : queueFilterValue === "submitted" || queueFilterValue === "view_all"
      ? requestsWithWorkflowMeta
      : dueSubmissionItems;
    const today = toDateOnlyValue(new Date());
    const todayTs = today ? today.getTime() : null;
    return sourceItems.filter(item => {
      if (
        isProgramView &&
        statusFilter.value !== "all" &&
        !statusFilter.statuses?.includes(item.status)
      ) {
        return false;
      }
      if (!isProgramView) {
        if (queueFilterValue === "submitted") {
          return normalizePacketStatusKey(item.status) === "submitted";
        }
        if (queueFilterValue === "unsubmitted") {
          return normalizePacketStatusKey(item.status) === "draft";
        }
        if (queueFilterValue === "blocked" && item.readyToSubmit) {
          return false;
        }
        if (
          queueFilterValue === "due_today_or_earlier" ||
          queueFilterValue === "overdue" ||
          queueFilterValue === "no_due_date_set"
        ) {
          const dueDate = toDateOnlyValue(item?.dueBy);
          const dueTs = dueDate ? dueDate.getTime() : null;
          if (queueFilterValue === "no_due_date_set") {
            return dueTs === null;
          }
          if (dueTs === null || todayTs === null) {
            return false;
          }
          if (queueFilterValue === "due_today_or_earlier") {
            return dueTs <= todayTs;
          }
          if (queueFilterValue === "overdue") {
            return dueTs < todayTs;
          }
        }
      }
      if (filteringText) {
        const lower = filteringText.toLowerCase();
        const interventionDisplay = formatInterventionDisplay(item).toLowerCase();
        return (
          item.id.toLowerCase().includes(lower) ||
          (item.caseNumber ?? "").toLowerCase().includes(lower) ||
          (item.clientName ?? "").toLowerCase().includes(lower) ||
          interventionDisplay.includes(lower) ||
          (item.paymentTypes ?? []).some(type => type.toLowerCase().includes(lower)) ||
          (item.reportingUnit ?? "").toLowerCase().includes(lower) ||
          (item.potName ?? "").toLowerCase().includes(lower) ||
          (item.requester ?? "").toLowerCase().includes(lower) ||
          (item.blockingReason ?? "").toLowerCase().includes(lower) ||
          (item.riskFlags ?? []).some(flag => flag.toLowerCase().includes(lower))
        );
      }
      return true;
    });
  }, [
    isProgramView,
    requestsWithWorkflowMeta,
    dueSubmissionItems,
    statusFilter,
    financeQueueFilter,
    filteringText,
  ]);

  const sortedItems = useMemo(() => {
    const next = [...filteredItems];
    if (!sortingColumnId) return next;
    next.sort((left, right) => {
      const base = comparePacketsByColumn(left, right, sortingColumnId);
      if (base === 0) {
        return comparePacketsByColumn(left, right, "id");
      }
      return sortingDescending ? -base : base;
    });
    return next;
  }, [filteredItems, sortingColumnId, sortingDescending]);

  const pageSize = preferences.pageSize ?? DEFAULT_PAGE_SIZE;
  const pagesCount = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPageIndex, pageSize]);


  const selectedPaymentType = useMemo(
    () => findOptionByValue(paymentTypeOptions, createForm.paymentType),
    [createForm.paymentType, paymentTypeOptions]
  );
  const selectedPayeeType = useMemo(
    () => findOptionByValue(configuredPayeeTypeOptions, createForm.payeeType),
    [configuredPayeeTypeOptions, createForm.payeeType]
  );
  const selectedReportingUnit = useMemo(
    () => regionOptions.find(option => option.value === createForm.reportingUnit) || null,
    [regionOptions, createForm.reportingUnit]
  );
  const selectedPot = useMemo(
    () => potOptions.find(option => option.value === createForm.potId) || null,
    [potOptions, createForm.potId]
  );

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Payment requests", metadata.aiContext ?? "");
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

  const handleColumnWidthsChange = ({ detail }) => {
    const next = [];
    if (Array.isArray(detail?.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        if (!entry || typeof entry !== "object") return;
        const { id, width } = entry;
        const numeric = Number(width);
        if (typeof id === "string" && Number.isFinite(numeric)) {
          next.push({ id, width: numeric });
        }
      });
    } else if (Array.isArray(detail?.widths)) {
      detail.widths.forEach((width, index) => {
        const column = columnDefinitions[index];
        const numeric = Number(width);
        if (column && Number.isFinite(numeric)) {
          next.push({ id: column.id, width: numeric });
        }
      });
    }
    if (next.length) {
      setColumnWidths(next);
      try {
        window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error("[Payments] failed to persist request column widths", error);
      }
    }
  };

  const handleSelectionChange = ({ detail }) => {
    const ids = Array.isArray(detail.selectedItems)
      ? detail.selectedItems.map(item => item?.id).filter(Boolean)
      : [];
    if (isProgramView) {
      const id = ids[0] ?? null;
      if (id !== selectedRequestId) {
        selectRequest(id);
      }
      return;
    }
    setQueueSelectedIds(ids);
    const firstId = ids[0] ?? null;
    if (firstId !== selectedRequestId) {
      selectRequest(firstId);
    }
  };

  const tableItems = useMemo(() => {
    return pagedItems.map(item => {
      const onOpen = () => {
        selectRequest(item.id);
        if (!isProgramView) {
          setQueueSelectedIds([item.id]);
        }
      };
      return { ...item, onOpen };
    });
  }, [isProgramView, pagedItems, selectRequest]);

  const selectedItems = useMemo(() => {
    const selectedIds = isProgramView
      ? selectedRequestId
        ? [selectedRequestId]
        : []
      : queueSelectedIds;
    if (!selectedIds.length) {
      return [];
    }
    const selectedSet = new Set(selectedIds);
    return tableItems.filter(item => selectedSet.has(item.id));
  }, [isProgramView, queueSelectedIds, selectedRequestId, tableItems]);

  const sortingColumn = useMemo(
    () => columnDefinitions.find(column => column.id === sortingColumnId) || null,
    [sortingColumnId]
  );

  useEffect(() => {
    if (isProgramView) return;
    setQueueSelectedIds(current => {
      if (!current.length) return current;
      const validIds = new Set(requestsWithWorkflowMeta.map(item => item.id));
      const next = current.filter(id => validIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [isProgramView, requestsWithWorkflowMeta]);

  const selectedPackets = useMemo(() => {
    if (isProgramView || !queueSelectedIds.length) return [];
    const selectedSet = new Set(queueSelectedIds);
    return requestsWithWorkflowMeta.filter(item => selectedSet.has(item.id));
  }, [isProgramView, queueSelectedIds, requestsWithWorkflowMeta]);

  const bulkReadyPackets = useMemo(
    () => selectedPackets.filter(item => item.readyToSubmit),
    [selectedPackets]
  );
  const bulkBlockedPackets = useMemo(
    () => selectedPackets.filter(item => !item.readyToSubmit),
    [selectedPackets]
  );
  const bulkSelectedAmount = useMemo(
    () => selectedPackets.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    [selectedPackets]
  );

  const handleBulkSubmit = async () => {
    if (bulkSubmitting) return;
    if (!bulkReadyPackets.length) {
      setBulkSubmitError("No selected packets are ready for submission.");
      return;
    }
    setBulkSubmitError(null);
    setBulkSubmitting(true);
    const failed = [];
    let submitted = 0;
    try {
      for (const packet of bulkReadyPackets) {
        try {
          await updatePacketStatus(packet.id, "submitted");
          submitted += 1;
        } catch (err) {
          failed.push({
            id: packet.id,
            reason: err?.message || "Submission failed.",
          });
        }
      }
      const failedIds = new Set(failed.map(item => item.id));
      setQueueSelectedIds(current => current.filter(id => failedIds.has(id)));
      setBulkSubmitModalOpen(false);
      const message =
        failed.length === 0
          ? `Submitted ${submitted} packet${submitted === 1 ? "" : "s"} to finance.`
          : `Submitted ${submitted}. ${failed.length} failed.`;
      setBulkResult({ type: failed.length ? "warning" : "success", message, failures: failed });
    } catch (err) {
      setBulkSubmitError(err?.message || "Bulk submission failed.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isProgramView || typeof window === "undefined") return;
    const handler = event => {
      const targetCaseId =
        event?.detail?.caseId !== undefined && event?.detail?.caseId !== null
          ? String(event.detail.caseId)
          : null;
      if (targetCaseId && lockedCaseId && targetCaseId !== lockedCaseId) {
        return;
      }
      managePaymentsSelectionRef.current = true;
    };
    window.addEventListener("iset-case-workspace:manage-payments", handler);
    return () => {
      window.removeEventListener("iset-case-workspace:manage-payments", handler);
    };
  }, [isProgramView, lockedCaseId]);

  useEffect(() => {
    if (!managePaymentsSelectionRef.current) return;
    if (!requests.length) return;
    const candidate = requests.find(item => AWAITING_SUBMISSION_STATUSES.has(item.status));
    if (candidate) {
      selectRequest(candidate.id);
    }
    managePaymentsSelectionRef.current = false;
  }, [requests, selectRequest]);

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize,
        contentDisplay: columnDefinitions.map(column => ({
          id: column.id,
          visible: visibleColumns.some(visibleColumn => visibleColumn.id === column.id),
        })),
        columnWidths,
      }}
      pageSizePreference={{
        title: "Page size",
        options: [5, 10, 20].map(value => ({ label: `${value} rows`, value })),
      }}
      contentDisplayPreference={{
        title: "Select columns",
        options: columnDefinitions.map(column => ({
          id: column.id,
          label: column.header,
          alwaysVisible: column.id === "id",
        })),
      }}
      onConfirm={({ detail }) => {
        const nextPreferences = {
          pageSize: detail.pageSize ?? pageSize,
          visibleColumns: detail.contentDisplay
            ? detail.contentDisplay.filter(entry => entry.visible).map(entry => entry.id)
            : preferences.visibleColumns,
        };
        setPreferences(nextPreferences);
        try {
          window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(nextPreferences));
        } catch (error) {
          console.error("[Payments] failed to persist request preferences", error);
        }
        if (Array.isArray(detail.columnWidths)) {
          const widths = detail.columnWidths
            .map(entry => {
              const numeric = Number(entry.width);
              return typeof entry.id === "string" && Number.isFinite(numeric)
                ? { id: entry.id, width: numeric }
                : null;
            })
            .filter(Boolean);
          if (widths.length) {
            setColumnWidths(widths);
            try {
              window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
            } catch (error) {
              console.error("[Payments] failed to persist widths", error);
            }
          }
        }
        setCurrentPageIndex(1);
      }}
    />
  );

  const pagination = (
    <Pagination
      currentPageIndex={currentPageIndex}
      pagesCount={pagesCount}
      onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
      disabled={pagesCount <= 1}
    />
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              {showCreatePacketAction ? (
                <Button iconName="add-plus" onClick={handleOpenCreateModal}>
                  Create packet
                </Button>
              ) : null}
              {!isProgramView ? (
                <Select
                  selectedOption={financeQueueFilter}
                  options={FINANCE_QUEUE_FILTER_OPTIONS}
                  ariaLabel="Queue filter"
                  onChange={({ detail }) => {
                    setFinanceQueueFilter(detail.selectedOption || FINANCE_QUEUE_FILTER_OPTIONS[0]);
                    setCurrentPageIndex(1);
                  }}
                />
              ) : null}
              {!isProgramView ? (
                <Button
                  variant="primary"
                  disabled={!bulkReadyPackets.length}
                  onClick={() => {
                    setBulkSubmitError(null);
                    setBulkSubmitModalOpen(true);
                  }}
                >
                  Submit selected ({queueSelectedIds.length})
                </Button>
              ) : null}
              {isProgramView ? (
                <Select
                  selectedOption={statusFilter}
                  options={statusOptions}
                  onChange={({ detail }) => {
                    setStatusFilter(detail.selectedOption);
                    setCurrentPageIndex(1);
                  }}
                />
              ) : null}
            </SpaceBetween>
          }
        >
          Batch payments queue
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Batch payments queue settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {bulkResult ? (
          <Alert type={bulkResult.type} onDismiss={() => setBulkResult(null)}>
            <SpaceBetween size="xs">
              <Box>{bulkResult.message}</Box>
              {bulkResult.failures?.length ? (
                <Box variant="p">
                  Failed packets:{" "}
                  {bulkResult.failures
                    .map(item => `${item.id} (${item.reason})`)
                    .join(", ")}
                </Box>
              ) : null}
            </SpaceBetween>
          </Alert>
        ) : null}
        <Table
          trackBy="id"
          items={tableItems}
          selectionType={isProgramView ? "single" : "multi"}
          selectedItems={selectedItems}
          onSelectionChange={handleSelectionChange}
          sortingColumn={sortingColumn}
          sortingDescending={sortingDescending}
          onSortingChange={({ detail }) => {
            setSortingColumnId(detail?.sortingColumn?.id || null);
            setSortingDescending(Boolean(detail?.isDescending));
            setCurrentPageIndex(1);
          }}
          columnDefinitions={visibleColumns.map(column => {
            const width = columnWidths.find(entry => entry.id === column.id)?.width;
            return width ? { ...column, width } : column;
          })}
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          variant="embedded"
          header={
            <Header variant="h3" counter={`(${filteredItems.length})`}>
              Packets
            </Header>
          }
          filter={
            <TextFilter
              filteringText={filteringText}
              filteringPlaceholder="Find by packet ID, case number, client, intervention, risk flag, or blocking reason"
              onChange={({ detail }) => {
                setFilteringText(detail.filteringText);
                setCurrentPageIndex(1);
              }}
              countText={`${filteredItems.length} match${filteredItems.length === 1 ? "" : "es"}`}
            />
          }
          preferences={preferencesComponent}
          pagination={pagination}
          loading={loading}
          loadingText="Loading payment packets"
          empty={
            <Box padding="m">
              {error
                ? `Unable to load payment packets: ${error}`
                : isProgramView
                  ? "No payment packets match the current filters."
                  : "No payment packets are currently due for submission."}
            </Box>
          }
        />
        <Modal
          visible={bulkSubmitModalOpen}
          onDismiss={() => {
            if (bulkSubmitting) return;
            setBulkSubmitModalOpen(false);
            setBulkSubmitError(null);
          }}
          header="Submit selected packets"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => {
                  if (bulkSubmitting) return;
                  setBulkSubmitModalOpen(false);
                  setBulkSubmitError(null);
                }}
                disabled={bulkSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleBulkSubmit}
                disabled={!bulkReadyPackets.length || bulkSubmitting}
                loading={bulkSubmitting}
              >
                Submit ready packets ({bulkReadyPackets.length})
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            {bulkSubmitError ? <Alert type="error">{bulkSubmitError}</Alert> : null}
            <ColumnLayout columns={3} variant="text-grid">
              <Box>
                <Box variant="awsui-key-label">Selected packets</Box>
                <Box>{selectedPackets.length}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">Ready now</Box>
                <Box>{bulkReadyPackets.length}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">Total amount</Box>
                <Box>{formatCurrency(bulkSelectedAmount)}</Box>
              </Box>
            </ColumnLayout>
            {bulkBlockedPackets.length ? (
              <Box variant="p">
                Blocked packets:{" "}
                {bulkBlockedPackets
                  .map(item => `${item.id} (${item.blockingReason || "Blocked"})`)
                  .join(", ")}
              </Box>
            ) : (
              <Box variant="p">All selected packets are ready.</Box>
            )}
          </SpaceBetween>
        </Modal>
        <Modal
          visible={createModalOpen}
          onDismiss={handleCloseCreateModal}
          header="Create payment packet"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleCloseCreateModal} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateSubmit}
                loading={createSubmitting}
              >
                Create packet
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            {createError ? <Alert type="error">{createError}</Alert> : null}
            <ColumnLayout columns={2} variant="text-grid">
              <FormField
                label="Case"
                description={
                  isCaseLocked
                    ? "Locked to the current case workspace."
                    : "Search by client name, case number, or tracking ID."
                }
              >
                {isCaseLocked ? (
                  <Input value={lockedCaseLabel} disabled />
                ) : (
                  <Autosuggest
                    value={createForm.caseSearch}
                    onChange={handleCaseChange}
                    onSelect={handleCaseSelect}
                    onLoadItems={({ detail }) => loadCaseSuggestions(detail.filteringText)}
                    options={caseOptions}
                    statusType={caseOptionsLoading ? "loading" : "finished"}
                    placeholder="Start typing to search cases"
                    empty={
                      createForm.caseSearch.trim().length < CASE_SEARCH_MIN_CHARS
                        ? "Type at least 2 characters to search."
                        : "No cases found."
                    }
                    enteredTextLabel={value => `Use "${value}"`}
                  />
                )}
              </FormField>
              <FormField label={isProgramView ? "Intervention" : "Intervention (optional)"}>
                <Select
                  selectedOption={selectedInterventionOption}
                  options={interventionOptions}
                  onChange={({ detail }) => updateCreateForm("interventionId", detail.selectedOption?.value || "")}
                  statusType={interventionsLoading || caseDetailsLoading ? "loading" : "finished"}
                  placeholder={
                    caseDetailsLoading
                      ? "Loading interventions"
                      : isProgramView
                      ? "Select an eligible intervention"
                      : "Select an intervention"
                  }
                  filteringType="auto"
                  empty={
                    interventionsBlockedCount
                      ? "No interventions eligible for payments."
                      : "No interventions available for this case."
                  }
                />
              </FormField>
              <FormField
                label="Reporting unit"
                description={
                  isAdminRole
                    ? "Derived from the budget pot; admins may override."
                    : "Derived from the budget pot."
                }
              >
                {isAdminRole ? (
                  <Select
                    selectedOption={selectedReportingUnit}
                    options={regionOptions}
                    onChange={({ detail }) => updateCreateForm("reportingUnit", detail.selectedOption?.value || "")}
                    statusType={regionsLoading ? "loading" : "finished"}
                    placeholder={regionsLoading ? "Loading regions" : "Select reporting unit"}
                    filteringType="auto"
                    empty="No regions available."
                  />
                ) : (
                  <Input value={selectedReportingUnit?.label || createForm.reportingUnit || ""} disabled readOnly />
                )}
              </FormField>
              <FormField label="Due by (optional)">
                <DatePicker
                  value={createForm.dueBy}
                  onChange={({ detail }) => updateCreateForm("dueBy", detail.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
            </ColumnLayout>
            {isProgramView && interventionsBlockedCount > 0 ? (
              <Box variant="p">
                {interventionsBlockedCount} interventions are not eligible for payments.
              </Box>
            ) : null}
            <FormField label="Notes (optional)">
              <Textarea
                value={createForm.notes}
                onChange={({ detail }) => updateCreateForm("notes", detail.value)}
                rows={3}
              />
            </FormField>

            <Header variant="h3">Initial payment line</Header>
            <ColumnLayout columns={2} variant="text-grid">
              <FormField
                label="Payment type"
                errorText={paymentTypeRestrictionError || undefined}
              >
                <Select
                  selectedOption={selectedPaymentType}
                  options={paymentTypeOptions}
                  onChange={({ detail }) => updateCreateForm("paymentType", detail.selectedOption?.value || "")}
                  placeholder="Select payment type"
                  filteringType="auto"
                  statusType={paymentTypeMappingLoading ? "loading" : "finished"}
                  empty={paymentTypeEmptyMessage}
                />
              </FormField>
              <FormField label="Payee type">
                <Select
                  selectedOption={selectedPayeeType}
                  options={configuredPayeeTypeOptions}
                  onChange={({ detail }) => updateCreateForm("payeeType", detail.selectedOption?.value || "")}
                  placeholder="Select payee type"
                />
              </FormField>
              <FormField label="Payee name">
                <Input
                  value={createForm.payeeName}
                  onChange={({ detail }) => updateCreateForm("payeeName", detail.value)}
                  placeholder="Payee name"
                />
              </FormField>
              <FormField label="Payee reference (optional)">
                <Input
                  value={createForm.payeeReference}
                  onChange={({ detail }) => updateCreateForm("payeeReference", detail.value)}
                  placeholder="Account or vendor reference"
                />
              </FormField>
              <FormField label="Amount">
                <Input
                  value={createForm.amount}
                  onChange={({ detail }) => updateCreateForm("amount", detail.value)}
                  type="number"
                  placeholder="0.00"
                  disabled={!amountEditable}
                />
              </FormField>
              {derivedInterventionAmount !== null ? (
                <FormField label="Partial payment">
                  <Checkbox
                    checked={createForm.partialPayment}
                    onChange={({ detail }) => updateCreateForm("partialPayment", detail.checked)}
                    description="Enable to enter a smaller amount than the approved total."
                  >
                    Allow partial amount
                  </Checkbox>
                </FormField>
              ) : null}
              <FormField label="Budget pot">
                <Input value={selectedPot?.label || createForm.potId || ""} disabled readOnly />
              </FormField>
              {requiresPeriodFields ? (
                <>
                  <FormField
                    label="Service period start"
                    description="Required for living allowance and wage subsidy."
                  >
                    <DatePicker
                      value={createForm.servicePeriodStart}
                      onChange={({ detail }) => updateCreateForm("servicePeriodStart", detail.value)}
                      placeholder="YYYY-MM-DD"
                    />
                  </FormField>
                  <FormField
                    label="Service period end"
                    description="Required for living allowance and wage subsidy."
                  >
                    <DatePicker
                      value={createForm.servicePeriodEnd}
                      onChange={({ detail }) => updateCreateForm("servicePeriodEnd", detail.value)}
                      placeholder="YYYY-MM-DD"
                    />
                  </FormField>
                </>
              ) : null}
              <FormField label="Requested payment date (optional)">
                <DatePicker
                  value={createForm.requestedPaymentDate}
                  onChange={({ detail }) => updateCreateForm("requestedPaymentDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField label="Invoice reference (optional)">
                <Input
                  value={createForm.invoiceReferenceNumber}
                  onChange={({ detail }) => updateCreateForm("invoiceReferenceNumber", detail.value)}
                  placeholder="Invoice or receipt number"
                />
              </FormField>
            </ColumnLayout>
          </SpaceBetween>
        </Modal>
      </SpaceBetween>
    </BoardItem>
  );
};

export default PaymentRequestsWidget;
