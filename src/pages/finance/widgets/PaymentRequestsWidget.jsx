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
} from "@cloudscape-design/components";
import { apiFetch } from "../../../auth/apiClient";
import { boardItemI18nStrings } from "./common";
import { usePaymentsData } from "./PaymentsDataContext.jsx";
import { findOptionByValue } from "./paymentOptions";
import useCurrentUser from "../../../hooks/useCurrentUser";
import { toCanonicalRole } from "../../../context/RoleMatrixContext";
import { normalizeInterventionStatus } from "../../../utils/interventionStatus.js";
import { getCurrencyInputDisplayValue } from "../../../utils/currencyFormat.js";

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
const AWAITING_SUBMISSION_STATUSES = new Set(["draft", "ready_to_send"]);
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

const SUPPORT_TYPE_LABELS = {
  TuitionFeesDirect: "Tuition fees (direct)",
  TuitionFeesReimbursement: "Tuition fees (reimbursement)",
  BooksMaterialsDirect: "Books and materials (direct)",
  BooksMaterialsReimbursement: "Books and materials (reimbursement)",
  LivingAllowance: "Living allowance",
  Childcare: "Childcare",
  Transportation: "Transportation",
  SpecializedEquipmentAdvance: "Specialized equipment (advance)",
  SpecializedEquipmentReimbursement: "Specialized equipment (reimbursement)",
  WageSubsidyEmployer: "Targeted wage subsidy",
  JCPProjectCost: "Project costs",
  SEBSupport: "SEB support",
  OtherEligibleCost: "Other eligible cost",
};

const PAYMENT_TYPE_ALIASES = {
  livingallowance: "LivingAllowance",
  livingallowances: "LivingAllowance",
  monthlylivingallowance: "LivingAllowance",
  tuitionfeesdirect: "TuitionFeesDirect",
  tuitiondirect: "TuitionFeesDirect",
  tuitionfees: "TuitionFeesDirect",
  tuition: "TuitionFeesDirect",
  tuitionfeesreimbursement: "TuitionFeesReimbursement",
  tuitionreimbursement: "TuitionFeesReimbursement",
  tuitionrefund: "TuitionFeesReimbursement",
  booksmaterialsdirect: "BooksMaterialsDirect",
  booksmaterialsreimbursement: "BooksMaterialsReimbursement",
  booksmaterialsrefund: "BooksMaterialsReimbursement",
  booksdirect: "BooksMaterialsDirect",
  booksreimbursement: "BooksMaterialsReimbursement",
  materialsdirect: "BooksMaterialsDirect",
  materialsreimbursement: "BooksMaterialsReimbursement",
  childcare: "Childcare",
  childcaredirect: "Childcare",
  childcarereimbursement: "Childcare",
  transportation: "Transportation",
  transportationreimbursement: "Transportation",
  specializedequipmentadvance: "SpecializedEquipmentAdvance",
  equipmentadvance: "SpecializedEquipmentAdvance",
  specializedequipment: "SpecializedEquipmentAdvance",
  equipment: "SpecializedEquipmentAdvance",
  specializedequipmentreimbursement: "SpecializedEquipmentReimbursement",
  equipmentreimbursement: "SpecializedEquipmentReimbursement",
  wagesubsidyemployer: "WageSubsidyEmployer",
  wagesubsidy: "WageSubsidyEmployer",
  targetedwagesubsidy: "WageSubsidyEmployer",
  targetedwagesubsidyemployer: "WageSubsidyEmployer",
  jcp: "JCPProjectCost",
  jcpprojectcost: "JCPProjectCost",
  seb: "SEBSupport",
  sebsupport: "SEBSupport",
  othereligiblecost: "OtherEligibleCost",
};

const PAYEE_TYPE_ALIASES = {
  participantclient: "ParticipantClient",
  accreditededucationaltraininginstitution: "AccreditedEducationalTrainingInstitution",
  employerwagesubsidypartner: "EmployerWageSubsidyPartner",
  childcareprovider: "ChildcareProvider",
  communitynonprofitorganization: "CommunityNonProfitOrganization",
  trainingrelatedsupplier: "TrainingRelatedSupplier",
  professionalbusinessservicesprovider: "ProfessionalBusinessServicesProvider",
  studentloanservicer: "StudentLoanServicer",
  client: "ParticipantClient",
  vendor: "TrainingRelatedSupplier",
  institution: "AccreditedEducationalTrainingInstitution",
  traininginstitution: "AccreditedEducationalTrainingInstitution",
  employer: "EmployerWageSubsidyPartner",
  other: "Other",
};

const DEFAULT_PAYEE_TYPE_BY_PAYMENT_TYPE = {
  LivingAllowance: "ParticipantClient",
  TuitionFeesReimbursement: "ParticipantClient",
  SpecializedEquipmentReimbursement: "ParticipantClient",
  Transportation: "ParticipantClient",
  BooksMaterialsReimbursement: "ParticipantClient",
  TuitionFeesDirect: "AccreditedEducationalTrainingInstitution",
  WageSubsidyEmployer: "EmployerWageSubsidyPartner",
  Childcare: "ChildcareProvider",
  BooksMaterialsDirect: "TrainingRelatedSupplier",
  SpecializedEquipmentAdvance: "TrainingRelatedSupplier",
  JCPProjectCost: "CommunityNonProfitOrganization",
  StudentLoanServicer: "StudentLoanServicer",
};

const PAYEE_TYPES_DEFAULT_FROM_INTERVENTION = new Set([
  "AccreditedEducationalTrainingInstitution",
  "EmployerWageSubsidyPartner",
  "CommunityNonProfitOrganization",
]);

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
};

const isBlockedInterventionStatus = status =>
  BLOCKED_INTERVENTION_STATUSES.has(normalizeInterventionStatus(status));

const isHistoricalBackloadIntervention = option =>
  String(option?.metadata?.source || "").trim().toLowerCase() === "manual_backload";

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

const normalizeSupportTypeValue = value => {
  if (value === null || value === undefined) return "";
  const trimmed = String(value).trim();
  return trimmed || "";
};

const normalizePaymentTypeValue = value => {
  const direct = normalizeSupportTypeValue(value);
  if (!direct) return "";
  const key = direct.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return PAYMENT_TYPE_ALIASES[key] || direct;
};

const normalizePayeeTypeValue = value => {
  const direct = normalizeSupportTypeValue(value);
  if (!direct) return "";
  const key = direct.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return PAYEE_TYPE_ALIASES[key] || direct;
};

const toTitleCaseWords = value =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());

const formatSupportTypeLabel = value => {
  const type = normalizeSupportTypeValue(value);
  if (!type) return "Approved support";
  return SUPPORT_TYPE_LABELS[type] || toTitleCaseWords(type);
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
  if (normalized === "draft" || normalized === "ready_to_send") {
    return "draft";
  }
  if (normalized === "submitted") return "submitted";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "confirmed") return "confirmed";
  return "draft";
};

const statusMeta = {
  draft: { label: "Draft", indicator: "pending" },
  ready_to_send: { label: "Ready to send", indicator: "success" },
  submitted: { label: "Sent to finance", indicator: "info" },
  confirmed: { label: "Payment confirmed", indicator: "success" },
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
  if (statusValue && statusValue !== "submitted" && statusMeta[statusValue]) {
    return statusMeta[statusValue];
  }
  const attempt = resolveLatestIntacctAttempt(packet);
  const outcome = resolveIntacctOutcome(attempt);
  if (outcome === "success") {
    return { label: "Accepted in Sage Intacct", indicator: "success" };
  }
  if (outcome === "partial") {
    return { label: "Sage Intacct exceptions", indicator: "warning" };
  }
  if (outcome === "failed") {
    return { label: "Sage Intacct exceptions", indicator: "error" };
  }
  if (statusValue === "submitted") {
    return statusMeta.submitted;
  }
  const statusKey = normalizePacketStatusKey(packet?.status);
  return statusMeta[statusKey] ?? { label: statusKey, indicator: "info" };
};

const simpleStatusOptions = [
  { value: "all", label: "All packets" },
  {
    value: "draft",
    label: "Drafts",
    statuses: ["draft", "ready_to_send"],
  },
  {
    value: "submitted",
    label: "Sent to finance",
    statuses: ["submitted", "confirmed"],
  },
  { value: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

const FINANCE_QUEUE_FILTER_OPTIONS = [
  { value: "view_all", label: "View all packets" },
  { value: "due_today_or_earlier", label: "Due today or earlier" },
  { value: "unsubmitted", label: "Unsubmitted" },
  { value: "submitted", label: "Sent to finance" },
  { value: "blocked", label: "Blocked" },
  { value: "overdue", label: "Overdue" },
  { value: "no_due_date_set", label: "No due date set" },
];
const DEFAULT_FINANCE_QUEUE_FILTER =
  FINANCE_QUEUE_FILTER_OPTIONS.find(option => option.value === "unsubmitted") ||
  FINANCE_QUEUE_FILTER_OPTIONS[0];

const formatCurrency = value =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);

const TERMINAL_PACKET_STATUSES = new Set([
  "submitted",
  "confirmed",
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

const formatDateRangeLabel = (startValue, endValue) => {
  const startLabel = startValue ? formatDateLabel(startValue) : "";
  const endLabel = endValue ? formatDateLabel(endValue) : "";
  if (startLabel && endLabel) return `${startLabel} to ${endLabel}`;
  return startLabel || endLabel || "";
};

const roundCurrencyValue = value => {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;
  return Math.round(numeric * 100) / 100;
};

const parseDateInput = value => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }
  return toDateOnlyValue(value);
};

const toDateInputValue = value => {
  const date = parseDateInput(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (value, days) => {
  const date = parseDateInput(value);
  if (!date) return null;
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfMonth = value => {
  const date = parseDateInput(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const buildMonthlyPeriods = ({ startDate, endDate, occurrences }) => {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  const count = toNumberOrNull(occurrences);
  if (!start || (!end && !(count > 0))) return [];
  const maxOccurrences = count > 0 ? Math.min(Math.trunc(count), 120) : 120;
  const periods = [];
  let cursor = new Date(start);
  let remaining = maxOccurrences;
  while (remaining > 0) {
    const periodEndRaw = endOfMonth(cursor);
    let periodEnd = periodEndRaw ? new Date(periodEndRaw) : null;
    if (!periodEnd) break;
    if (end && periodEnd > end) {
      periodEnd = new Date(end);
    }
    if (end && cursor > end) break;
    periods.push({
      start: toDateInputValue(cursor),
      end: toDateInputValue(periodEnd),
    });
    const nextStart = addDays(periodEnd, 1);
    if (!nextStart) break;
    cursor = nextStart;
    remaining -= 1;
    if (end && cursor > end) break;
  }
  return periods;
};

const buildServicePeriodKey = (start, end) => `${start || ""}|${end || ""}`;

const formatEditableAmount = value => {
  const rounded = roundCurrencyValue(value);
  return rounded !== null ? String(rounded) : "";
};

const buildPaymentLineErrorMessage = error => {
  const detailItems = Array.isArray(error?.details) ? error.details : [];
  const detailMessages = detailItems
    .map(item => (typeof item?.message === "string" ? item.message.trim() : ""))
    .filter(Boolean);
  if (detailMessages.length) {
    return Array.from(new Set(detailMessages)).join(" ");
  }
  return error?.message || "Failed to create payment packet.";
};

const resolveParticipantName = caseDetails => {
  if (!caseDetails || typeof caseDetails !== "object") return "";
  const directCandidates = [
    caseDetails.applicant_legal_name,
    caseDetails.applicantLegalName,
    caseDetails.clientName,
    caseDetails.client_name,
    caseDetails.applicant_name,
    caseDetails.applicantName,
    caseDetails.client?.name,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  const first =
    caseDetails.client?.first_name ||
    caseDetails.client?.firstName ||
    caseDetails.client_first_name ||
    caseDetails.clientFirstName ||
    caseDetails.submission_first_name ||
    caseDetails.submissionFirstName ||
    "";
  const last =
    caseDetails.client?.last_name ||
    caseDetails.client?.lastName ||
    caseDetails.client_last_name ||
    caseDetails.clientLastName ||
    caseDetails.submission_last_name ||
    caseDetails.submissionLastName ||
    "";
  return [first, last].filter(Boolean).join(" ").trim();
};

const resolveInterventionInstitution = option => {
  if (!option || typeof option !== "object") return "";
  const metadata =
    option.metadata && typeof option.metadata === "object" ? option.metadata : {};
  const snapshot =
    metadata.snapshot && typeof metadata.snapshot === "object" ? metadata.snapshot : {};
  const candidates = [
    option.institution,
    option.partnerName,
    metadata.institution,
    metadata.trainingInstitution,
    metadata.training_institution,
    snapshot.institution,
    snapshot.trainingInstitution,
    snapshot.training_institution,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
};

const resolveSelectablePayeeType = (rawValue, options) => {
  const canonical = normalizePayeeTypeValue(rawValue);
  if (!canonical) return "";
  const list = Array.isArray(options) ? options : [];
  const match =
    list.find(option => option?.value === canonical) ||
    list.find(option => normalizePayeeTypeValue(option?.value) === canonical) ||
    list.find(option => normalizePayeeTypeValue(option?.label) === canonical);
  return match?.value || canonical;
};

const deriveDefaultPayeeName = ({ payeeType, participantName, institutionName }) => {
  const canonical = normalizePayeeTypeValue(payeeType);
  if (!canonical) return "";
  if (canonical === "ParticipantClient") {
    return participantName || "";
  }
  if (PAYEE_TYPES_DEFAULT_FROM_INTERVENTION.has(canonical)) {
    return institutionName || "";
  }
  return "";
};

const normalizeApprovedCostLine = (raw, index = 0) => {
  if (!raw || typeof raw !== "object") return null;
  const recurrenceRaw =
    raw.recurrence && typeof raw.recurrence === "object" ? raw.recurrence : {};
  const payeeRaw = raw.payee && typeof raw.payee === "object" ? raw.payee : {};
  const amount = roundCurrencyValue(raw.amount);
  const amountPerPeriod = roundCurrencyValue(
    recurrenceRaw.amountPerPeriod ?? recurrenceRaw.amount_per_period,
  );
  const occurrences = toNumberOrNull(recurrenceRaw.occurrences);
  const type = normalizeSupportTypeValue(raw.type || raw.paymentType || raw.payment_type);
  if (!(amount > 0) && !(amountPerPeriod > 0)) return null;
  return {
    id: raw.id ? String(raw.id) : `approved-line-${index + 1}`,
    type: normalizePaymentTypeValue(type),
    amount,
    amountPerPeriod,
    occurrences: Number.isFinite(occurrences) && occurrences > 0 ? occurrences : null,
    startDate: recurrenceRaw.startDate || recurrenceRaw.start_date || null,
    endDate: recurrenceRaw.endDate || recurrenceRaw.end_date || null,
    payeeType: normalizePayeeTypeValue(
      payeeRaw.type || raw.payeeType || raw.payee_type || "",
    ),
    payeeName:
      String(payeeRaw.name || raw.payeeName || raw.payee_name || "")
        .trim() || null,
    payeeReference:
      String(payeeRaw.reference || raw.payeeReference || raw.payee_reference || "")
        .trim() || null,
    notes: String(raw.notes || raw.description || "").trim() || null,
  };
};

const extractApprovedCostLines = intervention => {
  if (!intervention || typeof intervention !== "object") return [];
  const metadata =
    intervention.metadata && typeof intervention.metadata === "object"
      ? intervention.metadata
      : {};
  const snapshot =
    metadata.snapshot && typeof metadata.snapshot === "object"
      ? metadata.snapshot
      : {};
  const source =
    (Array.isArray(intervention.costLines) && intervention.costLines) ||
    (Array.isArray(metadata.costLines) && metadata.costLines) ||
    (Array.isArray(snapshot.costLines) && snapshot.costLines) ||
    [];
  return source.map((line, index) => normalizeApprovedCostLine(line, index)).filter(Boolean);
};

const formatApprovedCostLineSchedule = line => {
  const parts = [];
  const scheduleLabel = formatDateRangeLabel(line?.startDate, line?.endDate);
  if (scheduleLabel) parts.push(scheduleLabel);
  if (line?.amountPerPeriod > 0 && line?.occurrences) {
    parts.push(`${formatCurrency(line.amountPerPeriod)} x ${line.occurrences}`);
  } else if (line?.amountPerPeriod > 0 && !line?.amount) {
    parts.push(`${formatCurrency(line.amountPerPeriod)} / period`);
  }
  return parts.join(" · ") || "—";
};

const formatApprovedCostLineAmount = line => {
  if (line?.amount !== null) {
    return formatCurrency(line.amount);
  }
  if (line?.amountPerPeriod > 0 && line?.occurrences) {
    return formatCurrency(line.amountPerPeriod * line.occurrences);
  }
  if (line?.amountPerPeriod > 0) {
    return `${formatCurrency(line.amountPerPeriod)} / period`;
  }
  return "—";
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
  ready_to_send: 1,
  draft: 2,
  submitted: 3,
  confirmed: 4,
  cancelled: 5,
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
  const statusKey = normalizePacketStatusKey(packet?.status);
  if (statusKey !== "draft") {
    if (statusKey === "cancelled") return "Cancelled packet";
    if (statusKey === "confirmed") return "Payment confirmed";
    return "Already sent to finance";
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
      const statusValue = String(item?.status || "").trim().toLowerCase();
      const indicator =
        statusValue === "confirmed"
          ? "success"
          : statusValue === "cancelled"
            ? "error"
            : "warning";
      return <StatusIndicator type={indicator}>{reason}</StatusIndicator>;
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
    header: "Sent",
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
    canonicalRole === "System Administrator" || canonicalRole === "NWAC Administrator";
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
  const [isCreateAmountFocused, setIsCreateAmountFocused] = useState(false);
  const [financeQueueFilter, setFinanceQueueFilter] = useState(() => DEFAULT_FINANCE_QUEUE_FILTER);
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
  const lastAutofillKeyRef = useRef("");
  const createModalAlertRef = useRef(null);
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
    setIsCreateAmountFocused(false);
    lastAutofillKeyRef.current = "";
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
  const createPacketFieldsDisabled = isProgramView && !selectedInterventionOption;
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
  const selectedInterventionFundingSummary = useMemo(() => {
    if (!selectedInterventionOption) return null;
    const interventionId = String(selectedInterventionOption.value || "");
    if (!interventionId) return null;
    const approvedLines = extractApprovedCostLines(selectedInterventionOption);
    let packetedTotal = 0;
    let packetCount = 0;
    const seenPacketIds = new Set();

    requests.forEach(packet => {
      const lines = Array.isArray(packet?.lines) ? packet.lines : [];
      let packetMatched = false;
      lines.forEach(line => {
        const lineInterventionId = line?.interventionId || packet?.interventionId || null;
        if (!lineInterventionId || String(lineInterventionId) !== interventionId) return;
        if (String(line?.status || "").trim().toLowerCase() === "cancelled") return;
        const amount = roundCurrencyValue(line?.amount);
        if (!(amount > 0)) return;
        packetedTotal += amount;
        packetMatched = true;
      });
      if (packetMatched && packet?.id && !seenPacketIds.has(String(packet.id))) {
        seenPacketIds.add(String(packet.id));
        packetCount += 1;
      }
    });

    const roundedPacketedTotal = Math.round(packetedTotal * 100) / 100;
    const remainingAmount =
      derivedInterventionAmount !== null
        ? Math.max(0, Math.round((derivedInterventionAmount - roundedPacketedTotal) * 100) / 100)
        : null;
    const scheduleLabel = formatDateRangeLabel(
      selectedInterventionOption.startDate,
      selectedInterventionOption.endDate,
    );
    return {
      approvedLines,
      packetCount,
      packetedTotal: roundedPacketedTotal,
      remainingAmount,
      scheduleLabel,
    };
  }, [derivedInterventionAmount, requests, selectedInterventionOption]);
  const remainingAuthorizedAmount = selectedInterventionFundingSummary?.remainingAmount ?? null;
  const approvedFundingLineColumns = useMemo(
    () => [
      {
        id: "support",
        header: "Approved support",
        cell: line => formatSupportTypeLabel(line?.type),
      },
      {
        id: "term",
        header: "Term / dates",
        cell: line => formatApprovedCostLineSchedule(line),
      },
      {
        id: "payee",
        header: "Payee / notes",
        cell: line => {
          const pieces = [line?.payeeName, line?.notes].filter(Boolean);
          return pieces.join(" · ") || "—";
        },
      },
      {
        id: "amount",
        header: "Approved amount",
        cell: line => formatApprovedCostLineAmount(line),
      },
    ],
    []
  );
  const participantName = useMemo(() => resolveParticipantName(caseDetails), [caseDetails]);
  const interventionInstitutionName = useMemo(
    () => resolveInterventionInstitution(selectedInterventionOption),
    [selectedInterventionOption]
  );
  const matchingApprovedFundingLines = useMemo(() => {
    const paymentType = normalizePaymentTypeValue(createForm.paymentType);
    const approvedLines = Array.isArray(selectedInterventionFundingSummary?.approvedLines)
      ? selectedInterventionFundingSummary.approvedLines
      : [];
    if (!paymentType) return [];
    return approvedLines.filter(line => normalizePaymentTypeValue(line?.type) === paymentType);
  }, [createForm.paymentType, selectedInterventionFundingSummary?.approvedLines]);
  const existingPacketLinesForSelection = useMemo(() => {
    const interventionId = selectedInterventionOption?.value ? String(selectedInterventionOption.value) : "";
    const paymentType = normalizePaymentTypeValue(createForm.paymentType);
    if (!interventionId || !paymentType) return [];
    const lines = [];
    requests.forEach(packet => {
      (Array.isArray(packet?.lines) ? packet.lines : []).forEach(line => {
        const lineInterventionId = line?.interventionId || packet?.interventionId || null;
        if (!lineInterventionId || String(lineInterventionId) !== interventionId) return;
        if (String(line?.status || "").trim().toLowerCase() === "cancelled") return;
        if (normalizePaymentTypeValue(line?.paymentType) !== paymentType) return;
        lines.push(line);
      });
    });
    return lines;
  }, [createForm.paymentType, requests, selectedInterventionOption]);
  const createPacketAutofill = useMemo(() => {
    const paymentType = normalizePaymentTypeValue(createForm.paymentType);
    if (!paymentType) return null;

    const payeeType =
      resolveSelectablePayeeType(
        matchingApprovedFundingLines[0]?.payeeType ||
          DEFAULT_PAYEE_TYPE_BY_PAYMENT_TYPE[paymentType] ||
          "",
        configuredPayeeTypeOptions,
      ) || "";
    const fallbackPayeeName = deriveDefaultPayeeName({
      payeeType,
      participantName,
      institutionName: interventionInstitutionName,
    });

    const typeUsageTotal = existingPacketLinesForSelection.reduce(
      (sum, line) => sum + (roundCurrencyValue(line?.amount) || 0),
      0,
    );
    const usedPeriods = new Set(
      existingPacketLinesForSelection
        .map(line => buildServicePeriodKey(line?.servicePeriodStart, line?.servicePeriodEnd))
        .filter(key => key !== "|")
    );

    const chooseCandidate = () => {
      if (!matchingApprovedFundingLines.length) return null;
      let fallback = matchingApprovedFundingLines[0];
      for (const line of matchingApprovedFundingLines) {
        const periods =
          line?.amountPerPeriod > 0 && (line?.startDate || line?.endDate || line?.occurrences)
            ? buildMonthlyPeriods({
                startDate: line.startDate,
                endDate: line.endDate,
                occurrences: line.occurrences,
              })
            : [];
        const nextPeriod = periods.find(
          period => !usedPeriods.has(buildServicePeriodKey(period.start, period.end))
        );
        if (nextPeriod) {
          return { line, nextPeriod };
        }
        const lineAmount = roundCurrencyValue(line?.amount);
        if (lineAmount !== null && Math.max(0, lineAmount - typeUsageTotal) > 0) {
          fallback = line;
        }
      }
      return { line: fallback, nextPeriod: null };
    };

    const chosen = chooseCandidate();
    const line = chosen?.line || null;
    const nextPeriod = chosen?.nextPeriod || null;
    const lineAmount = roundCurrencyValue(line?.amount);
    const recurringAmount = roundCurrencyValue(line?.amountPerPeriod);
    const remainingLineAmount =
      lineAmount !== null ? Math.max(0, Math.round((lineAmount - typeUsageTotal) * 100) / 100) : null;

    let amount =
      nextPeriod && recurringAmount !== null
        ? recurringAmount
        : remainingLineAmount !== null && remainingLineAmount > 0
          ? remainingLineAmount
          : lineAmount;
    if (remainingAuthorizedAmount !== null && amount !== null) {
      amount = Math.min(amount, remainingAuthorizedAmount);
    }

    return {
      payeeType,
      payeeName: line?.payeeName || fallbackPayeeName || "",
      payeeReference: line?.payeeReference || "",
      amount: amount !== null && amount > 0 ? formatEditableAmount(amount) : "",
      servicePeriodStart: nextPeriod?.start || "",
      servicePeriodEnd: nextPeriod?.end || "",
      requestedPaymentDate: nextPeriod?.end || "",
    };
  }, [
    configuredPayeeTypeOptions,
    createForm.paymentType,
    existingPacketLinesForSelection,
    interventionInstitutionName,
    matchingApprovedFundingLines,
    participantName,
    remainingAuthorizedAmount,
  ]);

  useEffect(() => {
    if (!createModalOpen) return;
    if (!selectedInterventionOption) {
      lastInterventionIdRef.current = null;
      setCreateForm(current => {
        if (!current.potId && !current.reportingUnit) {
          return current;
        }
        return {
          ...current,
          potId: "",
          reportingUnit: "",
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
      if (derivedPotId) {
        if (current.potId !== String(derivedPotId)) {
          next.potId = String(derivedPotId);
        }
      } else if (interventionChanged && current.potId) {
        next.potId = "";
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
    isAdminRole,
    resolveReportingUnitForPot,
    selectedInterventionOption,
  ]);

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
    if (!createModalOpen || !createError) return;
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      createModalAlertRef.current?.scrollIntoView({
        block: "start",
        inline: "nearest",
      });
    });
  }, [createError, createModalOpen]);

  useEffect(() => {
    if (!createModalOpen) {
      lastAutofillKeyRef.current = "";
      return;
    }
    const interventionId = selectedInterventionOption?.value ? String(selectedInterventionOption.value) : "";
    const paymentType = normalizePaymentTypeValue(createForm.paymentType);
    if (!interventionId || !paymentType) {
      lastAutofillKeyRef.current = "";
      return;
    }
    const autofillKey = `${interventionId}:${paymentType}`;
    if (lastAutofillKeyRef.current === autofillKey) {
      return;
    }
    const suggestion = createPacketAutofill;
    setCreateForm(current => ({
      ...current,
      payeeType: suggestion?.payeeType || "",
      payeeName: suggestion?.payeeName || "",
      payeeReference: suggestion?.payeeReference || "",
      amount: suggestion?.amount || "",
      servicePeriodStart: suggestion?.servicePeriodStart || "",
      servicePeriodEnd: suggestion?.servicePeriodEnd || "",
      requestedPaymentDate: suggestion?.requestedPaymentDate || "",
      invoiceReferenceNumber: current.invoiceReferenceNumber || "",
    }));
    lastAutofillKeyRef.current = autofillKey;
  }, [
    createForm.paymentType,
    createModalOpen,
    createPacketAutofill,
    selectedInterventionOption,
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
              metadata: item?.metadata || null,
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
              institution: item?.institution || null,
              programName: item?.programName || item?.program_name || null,
              startDate: item?.startDate || item?.start_date || null,
              endDate: item?.endDate || item?.end_date || null,
            });
          });
        });
        const eligible = options.filter(
          option =>
            !isBlockedInterventionStatus(option.status) &&
            !isHistoricalBackloadIntervention(option)
        );
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
    const amountValue = amountInputValue;
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
    if (remainingAuthorizedAmount !== null && amountValue > remainingAuthorizedAmount) {
      setCreateError("Amount exceeds remaining authorized funding for this intervention.");
      return;
    }
    if (derivedAmount !== null && amountValue > derivedAmount) {
      setCreateError("Amount cannot exceed the approved intervention ceiling.");
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
      setCreateError(buildPaymentLineErrorMessage(err));
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
    const id = ids[0] ?? null;
    if (id !== selectedRequestId) {
      selectRequest(id);
    }
  };

  const tableItems = useMemo(() => {
    return pagedItems.map(item => {
      const onOpen = () => {
        selectRequest(item.id);
      };
      return { ...item, onOpen };
    });
  }, [pagedItems, selectRequest]);

  const selectedItems = useMemo(() => {
    if (!selectedRequestId) {
      return [];
    }
    return tableItems.filter(item => item.id === selectedRequestId);
  }, [selectedRequestId, tableItems]);

  const sortingColumn = useMemo(
    () => columnDefinitions.find(column => column.id === sortingColumnId) || null,
    [sortingColumnId]
  );

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

  useEffect(() => {
    if (isProgramView || !selectedRequestId) return;
    const isVisible = filteredItems.some(item => item.id === selectedRequestId);
    if (!isVisible) {
      selectRequest(null);
    }
  }, [filteredItems, isProgramView, selectRequest, selectedRequestId]);

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
                    setFinanceQueueFilter(detail.selectedOption || DEFAULT_FINANCE_QUEUE_FILTER);
                    setCurrentPageIndex(1);
                  }}
                />
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
          Payment packet queue
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Payment packet queue settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <Table
          trackBy="id"
          items={tableItems}
          selectionType="single"
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
                  : "No payment packets match the current queue filter."}
            </Box>
          }
        />
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
            <div ref={createModalAlertRef} />
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
              <FormField label="Reporting unit">
                {isAdminRole ? (
                  <Select
                    selectedOption={selectedReportingUnit}
                    options={regionOptions}
                    onChange={({ detail }) => updateCreateForm("reportingUnit", detail.selectedOption?.value || "")}
                    statusType={regionsLoading ? "loading" : "finished"}
                    placeholder={regionsLoading ? "Loading regions" : "Select reporting unit"}
                    filteringType="auto"
                    empty="No regions available."
                    disabled={createPacketFieldsDisabled}
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
                  disabled={createPacketFieldsDisabled}
                />
              </FormField>
            </ColumnLayout>
            {isProgramView && interventionsBlockedCount > 0 ? (
              <Box variant="p">
                {interventionsBlockedCount} interventions are not eligible for payments or are history-only backloads.
              </Box>
            ) : null}
            {isProgramView && selectedInterventionOption ? (
              <Box
                padding="m"
                style={{
                  border: "1px solid var(--color-border-divider-default)",
                  borderRadius: "12px",
                }}
              >
                <SpaceBetween size="s">
                  <Box>
                    <Box variant="awsui-key-label">Approved for this intervention</Box>
                    {selectedInterventionFundingSummary?.scheduleLabel ? (
                      <Box
                        style={{
                          color: "var(--color-text-body-secondary)",
                          fontSize: "12px",
                        }}
                      >
                        {selectedInterventionFundingSummary.scheduleLabel}
                      </Box>
                    ) : null}
                  </Box>
                  <ColumnLayout columns={3} variant="text-grid">
                    <Box>
                      <Box variant="awsui-key-label">Approved ceiling</Box>
                      <Box>
                        {derivedInterventionAmount !== null
                          ? formatCurrency(derivedInterventionAmount)
                          : "—"}
                      </Box>
                    </Box>
                    <Box>
                      <Box variant="awsui-key-label">Already packeted</Box>
                      <Box>{formatCurrency(selectedInterventionFundingSummary?.packetedTotal ?? 0)}</Box>
                    </Box>
                    <Box>
                      <Box variant="awsui-key-label">Remaining to packet</Box>
                      <Box>
                        {selectedInterventionFundingSummary?.remainingAmount !== null
                          ? formatCurrency(selectedInterventionFundingSummary.remainingAmount)
                          : "—"}
                      </Box>
                    </Box>
                  </ColumnLayout>
                  {selectedInterventionFundingSummary?.approvedLines?.length ? (
                    <Table
                      variant="embedded"
                      trackBy="id"
                      items={selectedInterventionFundingSummary.approvedLines}
                      columnDefinitions={approvedFundingLineColumns}
                      wrapLines
                      header={
                        <Header
                          variant="h3"
                          counter={`(${selectedInterventionFundingSummary.approvedLines.length})`}
                        >
                          Approved funding lines
                        </Header>
                      }
                    />
                  ) : (
                    <Box style={{ color: "var(--color-text-body-secondary)", fontSize: "12px" }}>
                      No approved support breakdown is stored on this intervention. Use the approved ceiling above and the intervention detail view when creating the packet.
                    </Box>
                  )}
                  {selectedInterventionFundingSummary?.packetCount > 0 ? (
                    <Box style={{ color: "var(--color-text-body-secondary)", fontSize: "12px" }}>
                      {selectedInterventionFundingSummary.packetCount} existing packet
                      {selectedInterventionFundingSummary.packetCount === 1 ? "" : "s"} already use part of this intervention's approved funding.
                    </Box>
                  ) : null}
                </SpaceBetween>
              </Box>
            ) : null}
            <FormField label="Notes (optional)">
              <Textarea
                value={createForm.notes}
                onChange={({ detail }) => updateCreateForm("notes", detail.value)}
                rows={3}
                spellcheck={true}
                disabled={createPacketFieldsDisabled}
              />
            </FormField>

            <Header variant="h3">Payment line</Header>
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
                  disabled={createPacketFieldsDisabled}
                />
              </FormField>
              <FormField label="Payee type">
                <Select
                  selectedOption={selectedPayeeType}
                  options={configuredPayeeTypeOptions}
                  onChange={({ detail }) => updateCreateForm("payeeType", detail.selectedOption?.value || "")}
                  placeholder="Select payee type"
                  disabled={createPacketFieldsDisabled}
                />
              </FormField>
              <FormField label="Payee name">
                <Input
                  value={createForm.payeeName}
                  onChange={({ detail }) => updateCreateForm("payeeName", detail.value)}
                  placeholder="Payee name"
                  spellcheck={false}
                  disabled={createPacketFieldsDisabled}
                />
              </FormField>
              <FormField label="Payee reference (optional)">
                <Input
                  value={createForm.payeeReference}
                  onChange={({ detail }) => updateCreateForm("payeeReference", detail.value)}
                  placeholder="Account or vendor reference"
                  spellcheck={false}
                  disabled={createPacketFieldsDisabled}
                />
              </FormField>
              <FormField
                label="Amount"
                description={
                  remainingAuthorizedAmount !== null
                    ? `Remaining authorized funding: ${formatCurrency(remainingAuthorizedAmount)}. Enter the amount for this packet.`
                    : derivedInterventionAmount !== null
                      ? `Approved ceiling: ${formatCurrency(derivedInterventionAmount)}. Enter the amount for this packet.`
                    : "Enter the amount for this packet."
                }
              >
                <Input
                  value={getCurrencyInputDisplayValue(createForm.amount, isCreateAmountFocused)}
                  onChange={({ detail }) => updateCreateForm("amount", detail.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  spellcheck={false}
                  onFocus={() => setIsCreateAmountFocused(true)}
                  onBlur={() => setIsCreateAmountFocused(false)}
                  disabled={createPacketFieldsDisabled}
                />
              </FormField>
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
                      disabled={createPacketFieldsDisabled}
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
                      disabled={createPacketFieldsDisabled}
                    />
                  </FormField>
                </>
              ) : null}
              <FormField label="Requested payment date (optional)">
                <DatePicker
                  value={createForm.requestedPaymentDate}
                  onChange={({ detail }) => updateCreateForm("requestedPaymentDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                  disabled={createPacketFieldsDisabled}
                />
              </FormField>
              <FormField label="Invoice reference (optional)">
                <Input
                  value={createForm.invoiceReferenceNumber}
                  onChange={({ detail }) => updateCreateForm("invoiceReferenceNumber", detail.value)}
                  placeholder="Invoice or receipt number"
                  spellcheck={false}
                  disabled={createPacketFieldsDisabled}
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
