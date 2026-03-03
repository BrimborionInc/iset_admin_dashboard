import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  Checkbox,
  ColumnLayout,
  DatePicker,
  FormField,
  Grid,
  Header,
  Input,
  Link,
  Modal,
  Select,
  SpaceBetween,
  Textarea,
  Autosuggest,
  Multiselect,
  Wizard,
  Table,
  StatusIndicator,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../../auth/apiClient";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import useCurrentUser from "../../../../hooks/useCurrentUser.js";
import { PAYMENT_TYPE_OPTIONS } from "../../../finance/widgets/paymentOptions";
import { getCurrencyInputDisplayValue } from "../../../../utils/currencyFormat";
import styles from "./InterventionAssessmentWidget.module.css";

const BARRIER_OPTIONS = [
  { value: "education", label: "Education" },
  { value: "lack_of_skills", label: "Lack of marketable skills" },
  { value: "lack_of_experience", label: "Lack of work experience" },
  { value: "remoteness", label: "Remoteness" },
  { value: "transportation", label: "Lack of transportation" },
  { value: "economic", label: "Economic" },
  { value: "language", label: "Language" },
  { value: "dependent_care", label: "Dependent care" },
  { value: "health", label: "Health" },
  { value: "other", label: "Other" },
];

const ESDC_OPTIONS = [
  { label: "CRF", value: "CRF" },
  { label: "EI Active Claim", value: "EI Active Claim" },
  { label: "EI Reach Back", value: "EI Reach Back" },
];

const EI_ELIGIBILITY_ROLE_KEYS = new Set([
  "systemadministrator",
  "sysadmin",
  "programadministrator",
  "programadmin",
  "nwacadministrator",
  "regionalcoordinator",
  "regionalmanager",
]);

const normalizeRoleKey = value =>
  String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const normalizeFundingStream = value => {
  if (!value) return "";
  const normalized = String(value).trim().toUpperCase();
  if (normalized.includes("CRF")) return "CRF";
  if (normalized.includes("EI")) return "EI";
  return normalized;
};

const deriveFundingStreamFromEiStatus = status => {
  if (!status) return "";
  const normalized = String(status).trim().toUpperCase();
  return normalized === "CRF" ? "CRF" : "EI";
};

const ELIGIBILITY_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/bmp",
  "image/tiff",
];
const ELIGIBILITY_MAX_BYTES = 6 * 1024 * 1024;

const DECISION_OPTIONS = [
  { value: "approved", label: "Approve" },
  { value: "changes_requested", label: "Request changes" },
  { value: "rejected", label: "Reject" },
];

const BASE_STEP_IDS = [
  "plan",
  "framing",
  "rationale",
  "otherFunding",
  "childcare",
  "cost",
  "docs",
  "review",
];
const SUBMITTED_STEP_IDS = ["decision"];
const ALL_STEP_IDS = [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS];
const STEP_LABELS = {
  plan: "Action plan",
  framing: "What is being proposed?",
  rationale: "Why is this intervention needed?",
  otherFunding: "Other funding sources",
  childcare: "Does the client need childcare?",
  cost: "What will it cost?",
  docs: "Do you have the right supporting documents?",
  review: "Review and submit",
  decision: "Record of decision",
};
const REQUIRED_STEP_IDS = ["plan", "framing", "rationale", "cost"];

const RATIONALE_WORD_LIMIT = 400;

const defaultFormState = {
  actionPlanId: "",
  rationale: "",
  otherFunding: "",
  childcareNeed: "",
  childcareFunding: "",
  barriers: [],
  proposedInterventions: [],
  eiVerificationStatus: "",
  eiVerificationNotes: "",
  decisionOutcome: "",
  decisionNotes: "",
  eiVerificationDocumentId: null,
};

const formatDate = value => {
  if (!value) return "";
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const parseIsoDateToUtc = value => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\//g, "-");
  const parts = normalized.split("-");
  if (parts.length !== 3) return null;
  const [yyyy, mm, dd] = parts.map(part => Number.parseInt(part, 10));
  if (![yyyy, mm, dd].every(Number.isFinite)) return null;
  return Date.UTC(yyyy, mm - 1, dd);
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatShortDate = value => {
  const normalized = formatDate(value);
  if (!normalized) return "";
  const [yyyy, mm, dd] = normalized.split("-");
  const monthIndex = Number(mm) - 1;
  if (!yyyy || !dd || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return "";
  const monthLabel = MONTH_LABELS[monthIndex];
  return `${dd.padStart(2, "0")} ${monthLabel} ${yyyy}`;
};

const formatInterventionDates = (startDate, endDate) => {
  const normalizedStart = formatDate(startDate);
  const normalizedEnd = formatDate(endDate);
  const start = formatShortDate(normalizedStart);
  const end = formatShortDate(normalizedEnd);
  if (!start) return "—";
  if (!end || (normalizedStart && normalizedStart === normalizedEnd)) return start;
  return `${start}-${end}`;
};

const calculateDurationDays = (start, end) => {
  const startUtc = parseIsoDateToUtc(start);
  const endUtc = parseIsoDateToUtc(end);
  if (startUtc === null || endUtc === null) return null;
  const diff = Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff;
};

const addMonthsUtc = (startDate, monthsToAdd) => {
  const startUtc = parseIsoDateToUtc(startDate);
  if (startUtc === null) return "";
  const base = new Date(startUtc);
  const monthIndex = base.getUTCMonth() + monthsToAdd;
  base.setUTCMonth(monthIndex);
  if (Number.isNaN(base.getTime())) return "";
  return base.toISOString().slice(0, 10);
};

const deriveEndDateFromOccurrences = (startDate, occurrences) => {
  if (!startDate || !Number.isFinite(occurrences) || occurrences <= 0) return "";
  return addMonthsUtc(startDate, occurrences - 1);
};

const autoOccurrencesFromDates = (startDate, endDate, period) => {
  if (!startDate || !endDate || !period) return null;
  const startUtc = parseIsoDateToUtc(startDate);
  const endUtc = parseIsoDateToUtc(endDate);
  if (startUtc === null || endUtc === null || endUtc < startUtc) return null;
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  const monthCount =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1;
  if (period === "monthly") return Math.max(1, monthCount);
  if (period === "quarterly") return Math.max(1, Math.ceil(monthCount / 3));
  const diffDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(diffDays) || diffDays < 1) return null;
  const periodDays = period === "bi_weekly" ? 14 : period === "weekly" ? 7 : null;
  if (!periodDays) return null;
  return Math.max(1, Math.ceil(diffDays / periodDays));
};

const mergeRecurrenceDefaults = (base, overrides = {}) => {
  const pick = (value, fallback) =>
    value === "" || value === null || typeof value === "undefined" ? fallback : value;
  return {
    ...base,
    ...overrides,
    startDate: pick(overrides.startDate, base.startDate),
    endDate: pick(overrides.endDate, base.endDate),
    occurrences: pick(overrides.occurrences, base.occurrences),
    amountPerPeriod: pick(overrides.amountPerPeriod, base.amountPerPeriod),
  };
};

const buildUuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalizeId = value => {
  if (value === null || typeof value === "undefined") return "";
  return String(value);
};

const idsMatch = (left, right) => {
  const leftId = normalizeId(left);
  const rightId = normalizeId(right);
  if (!leftId || !rightId) return false;
  return leftId === rightId;
};

const parseCurrencyInput = value => {
  if (value === null || typeof value === "undefined") return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
};

const parseCurrencyToNumber = value => {
  if (value === null || typeof value === "undefined") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^0-9.+-]/g, "");
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrencyDisplay = value => {
  const num = parseCurrencyInput(value);
  if (num === null) return "";
  return `$ ${num.toFixed(2)}`;
};

const sanitizeCurrencyInput = value => {
  if (value === null || value === undefined) return "";
  const cleaned = String(value).replace(/[^\d.]/g, "");
  if (!cleaned) return "";
  const [whole, ...rest] = cleaned.split(".");
  const decimals = rest.join("").slice(0, 2);
  return decimals.length ? `${whole}.${decimals}` : whole;
};

const recalcRecurringAmounts = ({ amount, amountPerPeriod, occurrences, adjustMode }) => {
  const occ = Number(occurrences);
  if (!Number.isFinite(occ) || occ <= 0) {
    return { amount, amountPerPeriod };
  }
  const totalValue = parseCurrencyInput(amount);
  const perPeriodValue = parseCurrencyInput(amountPerPeriod);
  const normalize = value => (value === null || typeof value === "undefined" ? "" : formatCurrencyDisplay(value));
  if (adjustMode === "total") {
    if (Number.isFinite(perPeriodValue)) {
      return { amount: normalize(perPeriodValue * occ), amountPerPeriod };
    }
    if (Number.isFinite(totalValue)) {
      return { amount, amountPerPeriod: normalize(totalValue / occ) };
    }
    return { amount, amountPerPeriod };
  }
  if (Number.isFinite(totalValue)) {
    return { amount, amountPerPeriod: normalize(totalValue / occ) };
  }
  if (Number.isFinite(perPeriodValue)) {
    return { amount: normalize(perPeriodValue * occ), amountPerPeriod };
  }
  return { amount, amountPerPeriod };
};

const EDUCATION_CODES = new Set([4, 5, 9, 10, 11, 12, 13]);
const EMPLOYER_CODES = new Set([6, 7, 8, 17]);
const WAGE_SUBSIDY_CODES = new Set([7, 8]);
const NOC_REQUIRED_CODES = new Set([6, 7, 8, 9, 10, 11, 12, 13, 17]);

const isEducationCode = value => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && EDUCATION_CODES.has(numeric);
};

const isEmployerCode = value => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && EMPLOYER_CODES.has(numeric);
};

const isWageSubsidyCode = value => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && WAGE_SUBSIDY_CODES.has(numeric);
};

const requiresExternalPartnerForCode = value => isEducationCode(value) || isEmployerCode(value);
const requiresNocForCode = value => {
  if (!value) return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && NOC_REQUIRED_CODES.has(numeric);
};

const normalizeInterventionCodeValue = value => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
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

const buildPaymentTypeMappingLookup = mapping => {
  const lookup = new Map();
  if (!mapping || !Array.isArray(mapping.interventions)) return lookup;
  mapping.interventions.forEach(entry => {
    const code = normalizeInterventionCodeValue(entry?.code);
    if (!code) return;
    const types = Array.isArray(entry.availablePaymentTypes)
      ? entry.availablePaymentTypes.filter(Boolean)
      : [];
    lookup.set(code, new Set(types));
  });
  return lookup;
};

const normalizeCostingDefaults = payload => {
  if (!payload || payload.enabled === false) return { enabled: false };
  const interventionsRaw = Array.isArray(payload.interventions) ? payload.interventions : [];
  const paymentTypesRaw = Array.isArray(payload.paymentTypes) ? payload.paymentTypes : [];
  const interventions = interventionsRaw
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const code = normalizeInterventionCodeValue(entry.code || entry.interventionCode || entry.intervention_code);
      if (!code) return null;
      const suggested = Array.isArray(entry.suggested || entry.suggestedItems || entry.suggested_items)
        ? entry.suggested || entry.suggestedItems || entry.suggested_items
        : [];
      const normalizedSuggested = suggested
        .map(item => {
          if (typeof item === "string") return { type: item };
          if (item && typeof item === "object") {
            return {
              type: item.type || item.paymentType || item.payment_type || "",
              notes: item.notes || "",
              recurrenceEnabled: typeof item.recurrenceEnabled === "boolean" ? item.recurrenceEnabled : undefined,
            };
          }
          return null;
        })
        .filter(item => item && item.type);
      return {
        code,
        suggested: normalizedSuggested,
      };
    })
    .filter(Boolean);
  const paymentTypes = paymentTypesRaw
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const code = normalizeInterventionCodeValue(entry.code || entry.paymentType || entry.payment_type);
      if (!code) return null;
      const recurrence = entry.recurrence && typeof entry.recurrence === "object" ? entry.recurrence : {};
      return {
        code,
        recurrence: {
          mode: normalizeRecurrenceMode(
            recurrence.mode || recurrence.rule || entry.recurrenceMode || entry.recurrence_mode,
          ),
        },
      };
    })
    .filter(Boolean);
  return {
    enabled: payload.enabled !== false,
    strategy: payload.strategy || "allowed",
    interventions,
    paymentTypes,
  };
};

const buildEmptyCostLine = overrides => ({
  id: buildUuid(),
  type: "",
  amount: "",
  notes: "",
  recurrence: {
    enabled: false,
    startDate: "",
    endDate: "",
    occurrences: "",
    amountPerPeriod: "",
  },
  ...(overrides || {}),
});

const buildEmptyIntervention = overrides => ({
  id: buildUuid(),
  code: "",
  startDate: "",
  endDate: "",
  deliveryMode: "partner",
  institution: "",
  programName: "",
  itpDetails: "",
  wageSubsidyDetails: "",
  interventionNoc: "",
  interventionNocVersion: "",
  suggestionsSeeded: false,
  costLines: [],
  ...(overrides || {}),
});

const normalizeCostLine = raw => {
  if (!raw || typeof raw !== "object") return null;
  const recurrenceRaw = raw.recurrence && typeof raw.recurrence === "object" ? raw.recurrence : {};
  return {
    id: raw.id || buildUuid(),
    type: raw.type || raw.paymentType || raw.payment_type || "",
    amount:
      raw.amount === null || typeof raw.amount === "undefined"
        ? ""
        : String(raw.amount),
    notes: raw.notes || raw.description || "",
    recurrence: {
      enabled: Boolean(recurrenceRaw.enabled),
      startDate: recurrenceRaw.startDate || "",
      endDate: recurrenceRaw.endDate || "",
      occurrences:
        recurrenceRaw.occurrences === null || typeof recurrenceRaw.occurrences === "undefined"
          ? ""
          : String(recurrenceRaw.occurrences),
      amountPerPeriod:
        recurrenceRaw.amountPerPeriod === null || typeof recurrenceRaw.amountPerPeriod === "undefined"
          ? ""
          : String(recurrenceRaw.amountPerPeriod),
    },
  };
};

const normalizeProposedIntervention = raw => {
  if (!raw || typeof raw !== "object") return null;
  const costLines = Array.isArray(raw.costLines)
    ? raw.costLines.map(normalizeCostLine).filter(Boolean)
    : [];
  return {
    id: raw.id || buildUuid(),
    code: raw.code || "",
    startDate: raw.startDate || "",
    endDate: raw.endDate || "",
    deliveryMode: raw.deliveryMode === "in_house" ? "in_house" : "partner",
    institution: raw.institution || "",
    programName: raw.programName || "",
    itpDetails: raw.itpDetails || "",
    wageSubsidyDetails: raw.wageSubsidyDetails || "",
    interventionNoc: raw.interventionNoc || raw.interventionNocCode || raw.intervention_noc || "",
    interventionNocVersion: raw.interventionNocVersion || raw.interventionNocVersionCode || "",
    suggestionsSeeded: Boolean(raw.suggestionsSeeded),
    costLines,
  };
};

const normalizeProposedInterventions = raw => {
  const list = Array.isArray(raw) ? raw : [];
  const normalized = list.map(normalizeProposedIntervention).filter(Boolean);
  return normalized.length ? normalized : [];
};

const isRecurrenceScheduleComplete = line => {
  const recurrence = line?.recurrence || {};
  if (!recurrence.enabled) return false;
  const startDate = formatDate(recurrence.startDate);
  if (!startDate) return false;
  const occurrencesValue =
    recurrence.occurrences === "" || recurrence.occurrences === null || typeof recurrence.occurrences === "undefined"
      ? null
      : Number(recurrence.occurrences);
  const occurrences = Number.isFinite(occurrencesValue) ? occurrencesValue : null;
  if (!occurrences || occurrences <= 0) return false;
  const endDate = formatDate(recurrence.endDate) || deriveEndDateFromOccurrences(startDate, occurrences);
  if (!endDate) return false;
  const startUtc = parseIsoDateToUtc(startDate);
  const endUtc = parseIsoDateToUtc(endDate);
  if (startUtc !== null && endUtc !== null && endUtc < startUtc) return false;
  return true;
};

const InterventionAssessmentWidget = ({ actions, metadata = {}, toggleHelpPanel }) => {
  const currentUser = useCurrentUser();
  const {
    caseId: workspaceCaseId,
    caseData,
    createIntervention,
    updateIntervention: updateInterventionRecord,
    interventionCodes,
    interventionCodesLoading,
    loadInterventionCodes,
    nocVersions,
    nocVersionsLoading,
    loadNocVersions,
    selectedActionPlanId,
    setSelectedActionPlanId,
    selectedInterventionId,
    setSelectedInterventionId,
    getInterventionWizardStep,
    setInterventionWizardStep,
    getInterventionWizardDraft,
    setInterventionWizardDraft,
    clearInterventionWizardStep,
    clearInterventionWizardDraft,
  } = useCaseWorkspace();

  const [form, setForm] = useState(defaultFormState);
  const [currentStep, setCurrentStep] = useState(BASE_STEP_IDS[0]);
  const [attemptedSteps, setAttemptedSteps] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [hydratedDraftId, setHydratedDraftId] = useState(null);
  const [hydratedDraftUpdatedAt, setHydratedDraftUpdatedAt] = useState(null);
  const [currentInterventionStatus, setCurrentInterventionStatus] = useState(null);
  const [interventionModal, setInterventionModal] = useState({
    visible: false,
    mode: "view",
    interventionId: null,
    draft: null,
    original: null,
  });
  const [interventionModalErrors, setInterventionModalErrors] = useState({});
  const [interventionDeleteId, setInterventionDeleteId] = useState(null);
  const [proposedInterventionsTableVersion, setProposedInterventionsTableVersion] = useState(0);
  const [costLineModal, setCostLineModal] = useState({
    visible: false,
    mode: "view",
    interventionId: null,
    lineId: null,
    draft: null,
    original: null,
  });
  const [costLineModalErrors, setCostLineModalErrors] = useState({});
  const [inlineAmountEditingId, setInlineAmountEditingId] = useState(null);
  const [decisionBlockerVisible, setDecisionBlockerVisible] = useState(false);
  const [decisionBlockerReasons, setDecisionBlockerReasons] = useState([]);
  const [decisionBlockerTargetStep, setDecisionBlockerTargetStep] = useState(null);
  const [eiVerificationFile, setEiVerificationFile] = useState(null);
  const [eiVerificationFileError, setEiVerificationFileError] = useState(null);
  const [eiVerificationUploadError, setEiVerificationUploadError] = useState(null);
  const [eiVerificationUploadSuccess, setEiVerificationUploadSuccess] = useState(null);
  const [eiVerificationUploading, setEiVerificationUploading] = useState(false);
  const eiVerificationFileInputRef = useRef(null);
  const initialFormRef = useRef(defaultFormState);
  const wizardStepRestoreKeyRef = useRef(null);
  const wizardStepRestoreStepsRef = useRef(null);

  const caseId = useMemo(
    () => workspaceCaseId ?? caseData?.id ?? caseData?.case_id ?? null,
    [workspaceCaseId, caseData]
  );

  const applicantUserId = useMemo(
    () => caseData?.applicantUserId ?? caseData?.applicant_user_id ?? null,
    [caseData]
  );

  const logWizard = useCallback(() => {}, []);

  const resolveStoredStep = useCallback(
    (key, stepIds = ALL_STEP_IDS) => {
      if (!key || typeof getInterventionWizardStep !== "function") return null;
      const stored = getInterventionWizardStep(key);
      if (!stored) return null;
      return stepIds.includes(stored) ? stored : null;
    },
    [getInterventionWizardStep]
  );

  const resolveStoredDraft = useCallback(
    key => {
      if (!key || typeof getInterventionWizardDraft !== "function") return null;
      const stored = getInterventionWizardDraft(key);
      return stored && typeof stored === "object" ? stored : null;
    },
    [getInterventionWizardDraft]
  );

  const hasMeaningfulDraft = useCallback(draft => {
    if (!draft || typeof draft !== "object") return false;
    if (Array.isArray(draft.proposedInterventions) && draft.proposedInterventions.length) return true;
    const textKeys = [
      "rationale",
      "otherFunding",
      "childcareNeed",
      "childcareFunding",
      "eiVerificationStatus",
      "decisionOutcome",
      "decisionNotes",
    ];
    if (textKeys.some(key => String(draft[key] || "").trim())) return true;
    if (Array.isArray(draft.barriers) && draft.barriers.length) return true;
    return false;
  }, []);

  const mergeStoredDraft = useCallback((baseForm, storedDraft) => {
    if (!storedDraft) return baseForm;
    const merged = { ...baseForm, ...storedDraft };
    if (Array.isArray(storedDraft.proposedInterventions)) {
      merged.proposedInterventions = storedDraft.proposedInterventions;
    }
    return merged;
  }, []);

  const activeInterventionId = useMemo(
    () => selectedInterventionId ?? selectedDraftId ?? hydratedDraftId ?? null,
    [selectedInterventionId, selectedDraftId, hydratedDraftId]
  );

  const activeInterventionIdValue = useMemo(
    () => (activeInterventionId ? String(activeInterventionId) : null),
    [activeInterventionId]
  );

  const wizardStepKey = useMemo(() => {
    if (!caseId) return null;
    const keyId = selectedInterventionId ? String(selectedInterventionId) : null;
    if (keyId) return `${caseId}:${keyId}`;
    return `${caseId}:draft`;
  }, [caseId, selectedInterventionId]);

  const hasBlockingSubmitted = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.some(plan =>
      (plan.interventions || []).some(intervention => {
        const statusValue = String(intervention?.status || "").toLowerCase();
        return statusValue === "submitted";
      })
    );
  }, [caseData]);

  const hasBlockingDraft = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.some(plan =>
      (plan.interventions || []).some(intervention => {
        const statusValue = String(intervention?.status || "").toLowerCase();
        return statusValue === "draft" || statusValue === "changes_requested";
      })
    );
  }, [caseData]);

  const hasBlockingProposal = hasBlockingSubmitted || hasBlockingDraft;

  const statusValue = String(currentInterventionStatus || "").toLowerCase();
  const isDraftStatus = statusValue === "draft";
  const isSubmittedStatus = statusValue === "submitted";
  const isChangesRequestedStatus = statusValue === "changes_requested";
  const role = currentUser?.role || null;
  const canonicalRole = role === "Regional Manager" ? "Regional Coordinator" : role;
  const canManageEiEligibility = EI_ELIGIBILITY_ROLE_KEYS.has(normalizeRoleKey(role));
  const canEditSubmitted =
    canonicalRole === "Regional Coordinator" ||
    canonicalRole === "Program Administrator" ||
    canonicalRole === "System Administrator";

  const isEditable =
    isDraftStatus ||
    isChangesRequestedStatus ||
    (isSubmittedStatus && canEditSubmitted) ||
    (!statusValue && !hasBlockingProposal);
  const isFormLocked = !isEditable || isSubmitting;
  const statusLabel = statusValue
    ? statusValue.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase())
    : hasBlockingProposal
      ? "Read only"
      : "Draft";

  const activeStepIds = useMemo(
    () => (isSubmittedStatus ? [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS] : BASE_STEP_IDS),
    [isSubmittedStatus]
  );

  const codeOptions = useMemo(() => {
    if (!Array.isArray(interventionCodes) || interventionCodes.length === 0) return [];
    return interventionCodes.map(item => ({
      value: String(item.code),
      label: `${item.code} — ${item.label}`,
      codeLabel: item.label,
    }));
  }, [interventionCodes]);

  const interventionCodeLookup = useMemo(() => {
    const map = new Map();
    codeOptions.forEach(option => {
      if (!option?.value) return;
      map.set(String(option.value), option);
    });
    return map;
  }, [codeOptions]);

  const resolveInterventionLabel = useCallback(
    code => {
      if (!code) return "";
      const normalized = String(code);
      const match = interventionCodeLookup.get(normalized);
      if (match?.label) return match.label.replace(/^\s*\d+\s*–\s*/, "");
      return normalized;
    },
    [interventionCodeLookup]
  );

  const selectablePlans = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.filter(plan => {
      const status = String(plan.status || "").toLowerCase();
      if (status === "closed" || status === "archived") return false;
      if (plan.archivedAt) return false;
      return true;
    });
  }, [caseData]);

  const planOptions = useMemo(
    () =>
      selectablePlans.map(plan => ({
        value: String(plan.id),
        label: plan.title || `Action Plan ${plan.id}`,
        description: plan.status ? `Status: ${plan.status}` : "",
      })),
    [selectablePlans]
  );
  const isPlanStepBlocked = currentStep === "plan" && planOptions.length === 0;

  const activePlanId = useMemo(() => {
    const active = selectablePlans.find(plan => String(plan.status || "").toLowerCase() === "active");
    return active?.id || null;
  }, [selectablePlans]);

  const selectedPlan = useMemo(() => {
    if (!selectablePlans.length) return null;
    const selectedId = form.actionPlanId || selectedActionPlanId;
    if (selectedId) {
      return selectablePlans.find(plan => String(plan.id) === String(selectedId)) || null;
    }
    return null;
  }, [selectablePlans, form.actionPlanId, selectedActionPlanId]);

  const selectedPlanFundingStream = useMemo(
    () => normalizeFundingStream(selectedPlan?.fundingStream || selectedPlan?.funding_stream),
    [selectedPlan]
  );

  const requiredFundingStream = useMemo(
    () => deriveFundingStreamFromEiStatus(form.eiVerificationStatus),
    [form.eiVerificationStatus]
  );

  const hasPlanFundingMismatch = useMemo(
    () =>
      Boolean(
        requiredFundingStream &&
          selectedPlanFundingStream &&
          requiredFundingStream !== selectedPlanFundingStream
      ),
    [requiredFundingStream, selectedPlanFundingStream]
  );

  useEffect(() => {
    if (form.actionPlanId) return;
    if (activePlanId) {
      setForm(prev => ({ ...prev, actionPlanId: String(activePlanId) }));
      if (typeof setSelectedActionPlanId === "function") {
        setSelectedActionPlanId(activePlanId);
      }
      return;
    }
    if (selectedActionPlanId) {
      setForm(prev => ({ ...prev, actionPlanId: String(selectedActionPlanId) }));
    }
  }, [activePlanId, form.actionPlanId, selectedActionPlanId, setSelectedActionPlanId]);

  useEffect(() => {
    if (planOptions.length && error === "Create an action plan before proposing interventions.") {
      setError(null);
    }
  }, [planOptions.length, error]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = event => {
      if (event?.detail?.id !== "interventionAssessment") return;
      if (typeof clearInterventionWizardStep === "function") {
        clearInterventionWizardStep();
      }
      if (typeof clearInterventionWizardDraft === "function") {
        clearInterventionWizardDraft();
      }
    };
    window.addEventListener("iset-case-workspace:widget-removed", handler);
    return () => window.removeEventListener("iset-case-workspace:widget-removed", handler);
  }, [clearInterventionWizardStep, clearInterventionWizardDraft]);

  useEffect(() => {
    if (!wizardStepKey) return;
    const stepSignature = activeStepIds.join("|");
    const keyChanged = wizardStepRestoreKeyRef.current !== wizardStepKey;
    const stepsChanged = wizardStepRestoreStepsRef.current !== stepSignature;
    if (!keyChanged && !stepsChanged) return;
    wizardStepRestoreKeyRef.current = wizardStepKey;
    wizardStepRestoreStepsRef.current = stepSignature;
    const storedStep = resolveStoredStep(wizardStepKey, activeStepIds);
    if (storedStep && activeStepIds.includes(storedStep) && storedStep !== currentStep) {
      setCurrentStep(storedStep);
      return;
    }
    if (stepsChanged && !activeStepIds.includes(currentStep)) {
      setCurrentStep(BASE_STEP_IDS[0]);
    }
  }, [wizardStepKey, activeStepIds, currentStep, resolveStoredStep]);

  useEffect(() => {
    if (!wizardStepKey || typeof setInterventionWizardStep !== "function") return;
    setInterventionWizardStep(wizardStepKey, currentStep);
  }, [wizardStepKey, currentStep, setInterventionWizardStep]);

  useEffect(() => {
    if (!wizardStepKey || typeof setInterventionWizardDraft !== "function") return;
    const storedDraft = resolveStoredDraft(wizardStepKey);
    if (!hasMeaningfulDraft(form) && storedDraft && hasMeaningfulDraft(storedDraft)) {
      return;
    }
    if (!hasMeaningfulDraft(form) && !storedDraft) {
      return;
    }
    setInterventionWizardDraft(wizardStepKey, form);
  }, [wizardStepKey, form, setInterventionWizardDraft, resolveStoredDraft, hasMeaningfulDraft]);

  useEffect(() => {
    if (!wizardStepKey) return;
    if (selectedInterventionId || selectedDraftId || hydratedDraftId) return;
    if (hasBlockingProposal) return;
    if (hasMeaningfulDraft(form)) return;
    const storedDraft = resolveStoredDraft(wizardStepKey);
    if (!storedDraft || !hasMeaningfulDraft(storedDraft)) return;
    const merged = mergeStoredDraft(defaultFormState, storedDraft);
    setForm(merged);
    initialFormRef.current = merged;
  }, [
    wizardStepKey,
    selectedInterventionId,
    selectedDraftId,
    hydratedDraftId,
    hasBlockingProposal,
    form,
    resolveStoredDraft,
    hasMeaningfulDraft,
    mergeStoredDraft,
  ]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!interventionCodesLoading && (!interventionCodes || interventionCodes.length === 0)) {
      loadInterventionCodes().catch(() => {});
    }
  }, [interventionCodes, interventionCodesLoading, loadInterventionCodes]);

  useEffect(() => {
    if (!nocVersionsLoading && (!nocVersions || nocVersions.length === 0)) {
      loadNocVersions().catch(() => {});
    }
  }, [nocVersions, nocVersionsLoading, loadNocVersions]);

  const nocVersionOptions = useMemo(() => {
    if (!Array.isArray(nocVersions)) return [];
    return nocVersions
      .map(item => ({
        value: item.value || item.code || "",
        label: item.label || item.code || "",
        description: item.description || "",
      }))
      .filter(item => item.value && item.label);
  }, [nocVersions]);

  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);

  const fetchNocSuggestions = useCallback(
    async (queryText, version) => {
      if (!version) {
        setNocSuggestions([]);
        return;
      }
      const query = typeof queryText === "string" ? queryText.trim() : "";
      if (query.length < 2) {
        setNocSuggestions([]);
        return;
      }
      setNocSuggestionsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "25");
        params.set("q", query);
        params.set("version", version);
        const response = await apiFetch(`/api/reference/noc-codes?${params.toString()}`, { method: "GET" });
        if (!response.ok) throw new Error(`Failed to load NOC codes (${response.status})`);
        const data = await response.json();
        const options = Array.isArray(data?.codes)
          ? data.codes
              .map(item => ({
                value: item?.code ? String(item.code).trim() : null,
                label: item?.title ? `${item.code} - ${item.title}` : String(item.code || ""),
                description: item?.title || null,
              }))
              .filter(option => option.value && option.label)
          : [];
        setNocSuggestions(options);
      } catch (_) {
        setNocSuggestions([]);
      } finally {
        setNocSuggestionsLoading(false);
      }
    },
    [apiFetch]
  );

  const [paymentTypeMapping, setPaymentTypeMapping] = useState(null);
  const [paymentTypeMappingLoading, setPaymentTypeMappingLoading] = useState(false);
  const [costingDefaults, setCostingDefaults] = useState(null);
  const [costingDefaultsLoading, setCostingDefaultsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadMapping = async () => {
      setPaymentTypeMappingLoading(true);
      try {
        const response = await apiFetch("/api/config/runtime/payment-type-mapping", { method: "GET" });
        if (!response.ok) throw new Error(`Failed to load payment mapping (${response.status})`);
        const payload = await response.json().catch(() => null);
        if (!cancelled) setPaymentTypeMapping(payload);
      } catch (_) {
        if (!cancelled) setPaymentTypeMapping(null);
      } finally {
        if (!cancelled) setPaymentTypeMappingLoading(false);
      }
    };
    loadMapping();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  useEffect(() => {
    let cancelled = false;
    const loadDefaults = async () => {
      setCostingDefaultsLoading(true);
      try {
        const response = await apiFetch("/api/config/runtime/assessment-costing", { method: "GET" });
        if (!response.ok) throw new Error(`Failed to load costing defaults (${response.status})`);
        const payload = await response.json().catch(() => null);
        if (!cancelled) setCostingDefaults(normalizeCostingDefaults(payload));
      } catch (_) {
        if (!cancelled) setCostingDefaults(null);
      } finally {
        if (!cancelled) setCostingDefaultsLoading(false);
      }
    };
    loadDefaults();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const paymentTypeMappingLookup = useMemo(
    () => buildPaymentTypeMappingLookup(paymentTypeMapping),
    [paymentTypeMapping]
  );

  const paymentTypeLabelLookup = useMemo(() => {
    const map = new Map();
    PAYMENT_TYPE_OPTIONS.forEach(option => {
      if (!option?.value) return;
      map.set(String(option.value), option.label || option.value);
    });
    return map;
  }, []);

  const effectiveCostingDefaults = useMemo(() => {
    if (costingDefaults && costingDefaults.enabled !== false) return costingDefaults;
    return { enabled: false, strategy: "allowed", interventions: [], paymentTypes: [] };
  }, [costingDefaults]);

  const recurrenceModeByType = useMemo(() => {
    const map = new Map();
    if (effectiveCostingDefaults && Array.isArray(effectiveCostingDefaults.paymentTypes)) {
      effectiveCostingDefaults.paymentTypes.forEach(entry => {
        const code = entry?.code ? String(entry.code).trim() : "";
        if (!code) return;
        const mode = normalizeRecurrenceMode(entry?.recurrence?.mode);
        map.set(code, mode);
      });
    }
    return map;
  }, [effectiveCostingDefaults]);

  const getRecurrenceModeForType = useCallback(
    type => {
      if (!type) return RECURRENCE_MODE_NOT_ALLOWED;
      const normalized = String(type).trim();
      return recurrenceModeByType.get(normalized) || RECURRENCE_MODE_NOT_ALLOWED;
    },
    [recurrenceModeByType]
  );

  const getAllowedPaymentTypesForIntervention = useCallback(
    code => {
      const normalized = normalizeInterventionCodeValue(code);
      if (!normalized) return [];
      const allowed = paymentTypeMappingLookup.get(normalized);
      if (!allowed) return [];
      return Array.from(allowed);
    },
    [paymentTypeMappingLookup]
  );

  const buildCostItemOptions = useCallback(
    intervention => {
      const allowed = new Set(getAllowedPaymentTypesForIntervention(intervention?.code));
      const used = new Set(
        Array.isArray(intervention?.costLines)
          ? intervention.costLines.map(line => line?.type).filter(Boolean)
          : []
      );
      return PAYMENT_TYPE_OPTIONS.filter(option => {
        if (!option?.value) return false;
        if (allowed.size && !allowed.has(option.value)) return false;
        if (used.has(option.value)) return false;
        return true;
      });
    },
    [getAllowedPaymentTypesForIntervention]
  );

  const buildSuggestedCostLines = useCallback(
    intervention => {
      if (!effectiveCostingDefaults.enabled) return [];
      const code = normalizeInterventionCodeValue(intervention?.code);
      if (!code) return [];
      const allowed = new Set(getAllowedPaymentTypesForIntervention(code));
      const defaultsEntry = Array.isArray(effectiveCostingDefaults.interventions)
        ? effectiveCostingDefaults.interventions.find(entry => entry.code === code)
        : null;
      const hasExplicitDefaults = Boolean(defaultsEntry);
      let suggested = defaultsEntry?.suggested || [];
      if (!suggested.length && effectiveCostingDefaults.strategy === "allowed" && !hasExplicitDefaults) {
        if (!allowed.size) return null;
        suggested = Array.from(allowed).map(type => ({ type }));
      }
      if (!Array.isArray(suggested) || !suggested.length) return [];
      const seen = new Set();
      return suggested
        .map(item => {
          const type = item?.type ? String(item.type).trim() : "";
          if (!type) return null;
          if (allowed.size && !allowed.has(type)) return null;
          if (seen.has(type)) return null;
          seen.add(type);
          const recurrenceMode = getRecurrenceModeForType(type);
          const recurrenceEnabled =
            typeof item?.recurrenceEnabled === "boolean"
              ? item.recurrenceEnabled
              : recurrenceMode === RECURRENCE_MODE_REQUIRED;
          return buildEmptyCostLine({
            type,
            notes: item?.notes || "",
            recurrence: {
              enabled: recurrenceEnabled,
              startDate: intervention?.startDate || "",
              endDate: intervention?.endDate || "",
              occurrences: "",
              amountPerPeriod: "",
            },
          });
        })
        .filter(Boolean);
    },
    [effectiveCostingDefaults, getAllowedPaymentTypesForIntervention, getRecurrenceModeForType]
  );

  const proposedInterventions = Array.isArray(form.proposedInterventions)
    ? form.proposedInterventions
    : [];
  const isFramingStepBlocked = currentStep === "framing" && proposedInterventions.length === 0;

  useEffect(() => {
    if (proposedInterventions.length && error === "Add at least one proposed intervention before continuing.") {
      setError(null);
    }
  }, [proposedInterventions.length, error]);

  const primaryIntervention = useMemo(() => {
    if (!proposedInterventions.length) return null;
    return (
      proposedInterventions.find(item => item?.code && item?.startDate) ||
      proposedInterventions[0] ||
      null
    );
  }, [proposedInterventions]);

  const updateProposedInterventions = useCallback(
    updater => {
      setForm(prev => {
        const current = Array.isArray(prev.proposedInterventions) ? prev.proposedInterventions : [];
        const next = typeof updater === "function" ? updater(current) : updater;
        return { ...prev, proposedInterventions: next };
      });
    },
    []
  );

  const interventionTotals = useMemo(() => {
    const totals = new Map();
    proposedInterventions.forEach(intervention => {
      const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
      const total = lines.reduce((sum, line) => sum + parseCurrencyToNumber(line.amount), 0);
      totals.set(intervention.id, total);
    });
    return totals;
  }, [proposedInterventions]);

  const overallCostTotal = useMemo(() => {
    let total = 0;
    interventionTotals.forEach(value => {
      if (Number.isFinite(value)) total += value;
    });
    return total;
  }, [interventionTotals]);

  useEffect(() => {
    if (costingDefaultsLoading || paymentTypeMappingLoading) return;
    updateProposedInterventions(current => {
      let changed = false;
      const next = current.map(intervention => {
        if (intervention.suggestionsSeeded) return intervention;
        const suggestions = buildSuggestedCostLines(intervention) || [];
        if (!suggestions.length) {
          return { ...intervention, suggestionsSeeded: true };
        }
        const existing = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        const merged = [...existing, ...suggestions];
        changed = true;
        return { ...intervention, costLines: merged, suggestionsSeeded: true };
      });
      return changed ? next : current;
    });
  }, [buildSuggestedCostLines, costingDefaultsLoading, paymentTypeMappingLoading, updateProposedInterventions]);

  const updateIntervention = useCallback(
    (interventionId, updates) => {
      updateProposedInterventions(current =>
        current.map(item =>
          idsMatch(item.id, interventionId) ? { ...item, ...updates } : item
        )
      );
    },
    [updateProposedInterventions]
  );

  const addIntervention = useCallback(
    intervention => {
      updateProposedInterventions(current => [...current, intervention]);
    },
    [updateProposedInterventions]
  );

  const confirmInterventionDelete = useCallback(() => {
    const deleteId = interventionDeleteId;
    if (deleteId !== null && typeof deleteId !== "undefined") {
      const nextProposedInterventions = proposedInterventions.filter(
        item => !idsMatch(item.id, deleteId)
      );
      const nextForm = { ...form, proposedInterventions: nextProposedInterventions };
      setForm(nextForm);
      if (wizardStepKey && typeof setInterventionWizardDraft === "function") {
        if (hasMeaningfulDraft(nextForm)) {
          setInterventionWizardDraft(wizardStepKey, nextForm);
        } else {
          setInterventionWizardDraft(wizardStepKey, null);
        }
      }
    }
    setInterventionDeleteId(null);
    setProposedInterventionsTableVersion(current => current + 1);
  }, [
    interventionDeleteId,
    proposedInterventions,
    form,
    wizardStepKey,
    setInterventionWizardDraft,
    hasMeaningfulDraft,
  ]);

  const openAddInterventionModal = useCallback(() => {
    setInterventionModal({
      visible: true,
      mode: "add",
      interventionId: null,
      draft: buildEmptyIntervention(),
      original: null,
    });
    setInterventionModalErrors({});
  }, []);

  const openViewInterventionModal = useCallback(
    interventionId => {
      const intervention = proposedInterventions.find(item => idsMatch(item.id, interventionId));
      if (!intervention) return;
      setInterventionModal({
        visible: true,
        mode: "view",
        interventionId,
        draft: { ...intervention },
        original: { ...intervention },
      });
      setInterventionModalErrors({});
    },
    [proposedInterventions]
  );

  const startInterventionEdit = () => {
    setInterventionModal(prev => ({ ...prev, mode: "edit" }));
  };

  const resetInterventionModal = () => {
    setInterventionModal({
      visible: false,
      mode: "view",
      interventionId: null,
      draft: null,
      original: null,
    });
    setInterventionModalErrors({});
  };

  const updateInterventionModalDraft = updates => {
    setInterventionModal(prev => ({
      ...prev,
      draft: { ...(prev.draft || {}), ...(updates || {}) },
    }));
  };

  const validateInterventionDraft = draft => {
    const errors = {};
    if (!draft?.code) {
      errors.code = "Select an intervention code.";
    }
    if (!draft?.startDate) {
      errors.startDate = "Start date is required.";
    }
    const startUtc = parseIsoDateToUtc(draft?.startDate);
    const endUtc = parseIsoDateToUtc(draft?.endDate);
    if (startUtc !== null && endUtc !== null && endUtc < startUtc) {
      errors.endDate = "End date cannot be before start date.";
    }
    if (!draft?.code) {
      return errors;
    }
    const requiresNocCode = requiresNocForCode(draft.code);
    if (requiresNocCode) {
      if (!draft.interventionNocVersion) {
        errors.interventionNocVersion = "Select a NOC version for this intervention.";
      }
      if (!draft.interventionNoc) {
        errors.interventionNoc = "Select a NOC code for this intervention.";
      }
    }
    const educationCode = isEducationCode(draft.code);
    const employerCode = isEmployerCode(draft.code);
    const wageSubsidyCode = isWageSubsidyCode(draft.code);
    if (educationCode) {
      if (!draft.institution || !draft.institution.trim()) {
        errors.institution = "Training institution is required for this intervention code.";
      }
      if (!draft.itpDetails || !draft.itpDetails.trim()) {
        errors.itpDetails = "ITP details are required for this intervention code.";
      }
    }
    if (employerCode) {
      if (!draft.institution || !draft.institution.trim()) {
        errors.institution = "Employer / delivery partner is required for this intervention code.";
      }
      if (wageSubsidyCode && (!draft.wageSubsidyDetails || !draft.wageSubsidyDetails.trim())) {
        errors.wageSubsidyDetails = "Wage subsidy details are required for this intervention code.";
      }
    }
    if (!educationCode && !employerCode && draft.deliveryMode !== "in_house") {
      if (!draft.institution || !draft.institution.trim()) {
        errors.institution = "Delivery partner is required when using external delivery.";
      }
    }
    return errors;
  };

  const saveInterventionModal = () => {
    const draft = interventionModal.draft || null;
    const errors = validateInterventionDraft(draft);
    if (Object.keys(errors).length) {
      setInterventionModalErrors(errors);
      return;
    }
    if (interventionModal.mode === "add" && draft) {
      addIntervention({
        ...draft,
        suggestionsSeeded: false,
        costLines: Array.isArray(draft.costLines) ? draft.costLines : [],
      });
      resetInterventionModal();
      return;
    }
    if (interventionModal.mode === "edit" && interventionModal.interventionId && draft) {
      updateIntervention(interventionModal.interventionId, draft);
      resetInterventionModal();
    }
  };

  const cancelInterventionEdit = () => {
    setInterventionModal(prev => ({
      ...prev,
      mode: "view",
      draft: prev.original,
    }));
    setInterventionModalErrors({});
  };

  const openAddCostLineModal = useCallback(
    interventionId => {
      const intervention = proposedInterventions.find(item => idsMatch(item.id, interventionId));
      if (!intervention) return;
      setCostLineModal({
        visible: true,
        mode: "add",
        interventionId,
        lineId: null,
        draft: buildEmptyCostLine({ recurrence: { enabled: false, startDate: intervention.startDate || "", endDate: intervention.endDate || "", occurrences: "", amountPerPeriod: "" } }),
        original: null,
      });
      setCostLineModalErrors({});
    },
    [proposedInterventions]
  );

  const openCostLineModal = useCallback(
    (interventionId, lineId) => {
      const intervention = proposedInterventions.find(item => idsMatch(item.id, interventionId));
      const line = intervention?.costLines?.find(item => idsMatch(item.id, lineId));
      if (!intervention || !line) return;
      setCostLineModal({
        visible: true,
        mode: "view",
        interventionId,
        lineId,
        draft: { ...line },
        original: { ...line },
      });
      setCostLineModalErrors({});
    },
    [proposedInterventions]
  );

  const resetCostLineModal = () => {
    setCostLineModal({
      visible: false,
      mode: "view",
      interventionId: null,
      lineId: null,
      draft: null,
      original: null,
    });
    setCostLineModalErrors({});
  };

  const updateCostLineDraft = updater => {
    setCostLineModal(prev => {
      const current = prev.draft || {};
      const nextDraft =
        typeof updater === "function"
          ? updater(current)
          : { ...current, ...(updater || {}) };
      return {
        ...prev,
        draft: nextDraft,
      };
    });
  };

  const buildRecurrenceFromIntervention = useCallback(
    (intervention, enabled) => {
      if (!enabled) {
        return {
          enabled: false,
          startDate: "",
          endDate: "",
          occurrences: "",
          amountPerPeriod: "",
        };
      }
      const startDate = intervention?.startDate || "";
      const endDate = intervention?.endDate || "";
      const occurrences = startDate && endDate ? autoOccurrencesFromDates(startDate, endDate, "monthly") : null;
      return {
        enabled: true,
        startDate,
        endDate,
        occurrences: occurrences ? String(occurrences) : "",
        amountPerPeriod: "",
      };
    },
    []
  );

  const updateCostLineType = useCallback(
    nextType => {
      setCostLineModal(prev => {
        if (!prev.draft) return prev;
        const intervention = proposedInterventions.find(item => idsMatch(item.id, prev.interventionId));
        if (!intervention) return prev;
        const recurrenceMode = getRecurrenceModeForType(nextType);
        const recurrenceEnabled =
          recurrenceMode === RECURRENCE_MODE_REQUIRED
            ? true
            : recurrenceMode === RECURRENCE_MODE_NOT_ALLOWED
              ? false
              : Boolean(prev.draft.recurrence?.enabled);
        const baseRecurrence = buildRecurrenceFromIntervention(intervention, recurrenceEnabled);
        const mergedRecurrence = mergeRecurrenceDefaults(baseRecurrence, prev.draft.recurrence || {});
        const recurrence = recurrenceEnabled
          ? { ...mergedRecurrence, enabled: true }
          : baseRecurrence;
        return {
          ...prev,
          draft: {
            ...prev.draft,
            type: nextType,
            recurrence,
          },
        };
      });
      setCostLineModalErrors({});
    },
    [buildRecurrenceFromIntervention, getRecurrenceModeForType, proposedInterventions]
  );

  const toggleCostLineRecurrence = useCallback(
    enabled => {
      setCostLineModal(prev => {
        if (!prev.draft) return prev;
        const intervention = proposedInterventions.find(item => idsMatch(item.id, prev.interventionId));
        if (!intervention) return prev;
        const recurrenceMode = getRecurrenceModeForType(prev.draft.type);
        const resolvedEnabled =
          recurrenceMode === RECURRENCE_MODE_REQUIRED
            ? true
            : recurrenceMode === RECURRENCE_MODE_NOT_ALLOWED
              ? false
              : enabled;
        const baseRecurrence = buildRecurrenceFromIntervention(intervention, resolvedEnabled);
        const existing = prev.draft.recurrence || {};
        const mergedRecurrence = mergeRecurrenceDefaults(baseRecurrence, existing);
        const recurrence = resolvedEnabled
          ? { ...mergedRecurrence, enabled: true }
          : baseRecurrence;
        return {
          ...prev,
          draft: {
            ...prev.draft,
            recurrence,
          },
        };
      });
      setCostLineModalErrors({});
    },
    [getRecurrenceModeForType, proposedInterventions]
  );

  const updateCostLineAmount = useCallback(
    value => {
      const sanitized = sanitizeCurrencyInput(value);
      updateCostLineDraft(draft => {
        const next = { ...draft, amount: sanitized };
        if (draft.recurrence?.enabled && draft.recurrence?.occurrences) {
          const occ = Number(draft.recurrence.occurrences);
          if (Number.isFinite(occ) && occ > 0) {
            const total = parseCurrencyInput(sanitized);
            next.recurrence = {
              ...draft.recurrence,
              amountPerPeriod: total !== null ? formatCurrencyDisplay(total / occ) : "",
            };
          }
        }
        return next;
      });
    },
    [updateCostLineDraft]
  );

  const blurCostLineAmount = useCallback(() => {
    updateCostLineDraft(draft => {
      const formatted = formatCurrencyDisplay(draft.amount);
      return { ...draft, amount: formatted || "" };
    });
  }, [updateCostLineDraft]);

  const updateCostLineAmountPerPeriod = useCallback(
    value => {
      const sanitized = sanitizeCurrencyInput(value);
      updateCostLineDraft(draft => {
        const recurrence = { ...(draft.recurrence || {}), amountPerPeriod: sanitized };
        const occ = Number(recurrence.occurrences);
        let amount = draft.amount;
        if (Number.isFinite(occ) && occ > 0) {
          const per = parseCurrencyInput(sanitized);
          if (per !== null) {
            amount = formatCurrencyDisplay(per * occ);
          }
        }
        return { ...draft, amount, recurrence };
      });
    },
    [updateCostLineDraft]
  );

  const updateCostLineOccurrences = useCallback(
    value => {
      const cleaned = String(value || "").replace(/[^\d]/g, "");
      updateCostLineDraft(draft => {
        const recurrence = { ...(draft.recurrence || {}), occurrences: cleaned };
        if (recurrence.startDate && cleaned && !recurrence.endDate) {
          const derivedEnd = deriveEndDateFromOccurrences(recurrence.startDate, Number(cleaned));
          recurrence.endDate = derivedEnd || recurrence.endDate || "";
        }
        const amounts = recalcRecurringAmounts({
          amount: draft.amount,
          amountPerPeriod: recurrence.amountPerPeriod,
          occurrences: recurrence.occurrences,
          adjustMode: "total",
        });
        return {
          ...draft,
          amount: amounts.amount,
          recurrence: { ...recurrence, amountPerPeriod: amounts.amountPerPeriod },
        };
      });
    },
    [updateCostLineDraft]
  );

  const updateCostLineRecurrenceStart = useCallback(
    value => {
      updateCostLineDraft(draft => {
        const recurrence = { ...(draft.recurrence || {}), startDate: value };
        if (recurrence.startDate && recurrence.endDate) {
          const occ = autoOccurrencesFromDates(recurrence.startDate, recurrence.endDate, "monthly");
          recurrence.occurrences = occ ? String(occ) : "";
        }
        const amounts = recalcRecurringAmounts({
          amount: draft.amount,
          amountPerPeriod: recurrence.amountPerPeriod,
          occurrences: recurrence.occurrences,
          adjustMode: "total",
        });
        return {
          ...draft,
          amount: amounts.amount,
          recurrence: { ...recurrence, amountPerPeriod: amounts.amountPerPeriod },
        };
      });
    },
    [updateCostLineDraft]
  );

  const updateCostLineRecurrenceEnd = useCallback(
    value => {
      updateCostLineDraft(draft => {
        const recurrence = { ...(draft.recurrence || {}), endDate: value };
        if (recurrence.startDate && recurrence.endDate) {
          const occ = autoOccurrencesFromDates(recurrence.startDate, recurrence.endDate, "monthly");
          recurrence.occurrences = occ ? String(occ) : "";
        }
        const amounts = recalcRecurringAmounts({
          amount: draft.amount,
          amountPerPeriod: recurrence.amountPerPeriod,
          occurrences: recurrence.occurrences,
          adjustMode: "total",
        });
        return {
          ...draft,
          amount: amounts.amount,
          recurrence: { ...recurrence, amountPerPeriod: amounts.amountPerPeriod },
        };
      });
    },
    [updateCostLineDraft]
  );

  const validateCostLineDraft = draft => {
    const errors = {};
    if (!draft?.type) {
      errors.type = "Select a cost item.";
    }
    const parsedAmount = parseCurrencyInput(draft?.amount);
    if (draft?.amount === "" || parsedAmount === null || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      errors.amount = "Enter a valid amount in dollars.";
    }
    const recurrenceMode = getRecurrenceModeForType(draft?.type);
    const recurrenceRequired = recurrenceMode === RECURRENCE_MODE_REQUIRED;
    const recurrenceEnabled = Boolean(draft?.recurrence?.enabled);
    if ((recurrenceRequired || recurrenceEnabled) && !isRecurrenceScheduleComplete(draft)) {
      errors.recurrence = "Complete the installments schedule.";
    }
    return errors;
  };

  const commitCostLine = () => {
    const draft = costLineModal.draft || null;
    const errors = validateCostLineDraft(draft);
    if (Object.keys(errors).length) {
      setCostLineModalErrors(errors);
      return;
    }
    updateProposedInterventions(current =>
      current.map(intervention => {
        if (!idsMatch(intervention.id, costLineModal.interventionId)) return intervention;
        const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        if (costLineModal.mode === "add") {
          return { ...intervention, costLines: [...lines, draft] };
        }
        if (costLineModal.mode === "edit") {
          return {
            ...intervention,
            costLines: lines.map(line => (idsMatch(line.id, costLineModal.lineId) ? draft : line)),
          };
        }
        return intervention;
      })
    );
    resetCostLineModal();
  };

  const removeCostLine = useCallback(
    (interventionId, lineId) => {
      updateProposedInterventions(current =>
        current.map(intervention => {
          if (!idsMatch(intervention.id, interventionId)) return intervention;
          const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
          return { ...intervention, costLines: lines.filter(line => !idsMatch(line.id, lineId)) };
        })
      );
    },
    [updateProposedInterventions]
  );

  const handleInlineAmountChange = (interventionId, lineId, value) => {
    const cleaned = sanitizeCurrencyInput(value);
    updateProposedInterventions(current =>
      current.map(intervention => {
        if (!idsMatch(intervention.id, interventionId)) return intervention;
        const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        return {
          ...intervention,
          costLines: lines.map(line => (idsMatch(line.id, lineId) ? { ...line, amount: cleaned } : line)),
        };
      })
    );
  };

  const handleInlineAmountBlur = lineId => {
    if (inlineAmountEditingId === lineId) {
      setInlineAmountEditingId(null);
    }
  };

  useEffect(() => {
    const handleSelect = event => {
      const detail = event?.detail || {};
      const interventionId = detail.interventionId;
      if (!interventionId) return;
      const selectionKey = caseId ? `${caseId}:${interventionId}` : null;
      const storedStep = resolveStoredStep(selectionKey);
      if (typeof setSelectedInterventionId === "function") {
        const numericInterventionId = Number(interventionId);
        setSelectedInterventionId(Number.isFinite(numericInterventionId) ? numericInterventionId : interventionId);
      }
      const planId = detail.planId;
      setSelectedDraftId(interventionId);
      setHydratedDraftId(null);
      setHydratedDraftUpdatedAt(null);
      setCurrentInterventionStatus(null);
      setError(null);
      setSuccessMessage("");
      setAttemptedSteps({});
      setCurrentStep(storedStep || BASE_STEP_IDS[0]);
      if (planId) {
        const numericPlanId = Number(planId);
        const resolvedPlanId = Number.isFinite(numericPlanId) ? numericPlanId : planId;
        setForm(prev => ({ ...prev, actionPlanId: String(planId) }));
        if (typeof setSelectedActionPlanId === "function") {
          setSelectedActionPlanId(resolvedPlanId);
        }
      }
    };

    const handleNew = event => {
      const detail = event?.detail || {};
      const planId = detail.planId;
      if (hasBlockingProposal) {
        setError("A draft or submitted proposal already exists. Resume it from the table.");
        setSuccessMessage("");
        return;
      }
      setSelectedDraftId(null);
      setHydratedDraftId(null);
      setHydratedDraftUpdatedAt(null);
      setCurrentInterventionStatus(null);
      if (typeof setSelectedInterventionId === "function") {
        setSelectedInterventionId(null);
      }
      setError(null);
      setSuccessMessage("");
      setAttemptedSteps({});
      setCurrentStep(BASE_STEP_IDS[0]);
      setForm(prev => ({
        ...defaultFormState,
        actionPlanId: planId ? String(planId) : prev.actionPlanId,
      }));
      if (planId && typeof setSelectedActionPlanId === "function") {
        const numericPlanId = Number(planId);
        setSelectedActionPlanId(Number.isFinite(numericPlanId) ? numericPlanId : planId);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("iset:intervention-assessment:select", handleSelect);
      window.addEventListener("iset:intervention-assessment:new", handleNew);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("iset:intervention-assessment:select", handleSelect);
        window.removeEventListener("iset:intervention-assessment:new", handleNew);
      }
    };
  }, [
    caseId,
    hasBlockingProposal,
    resolveStoredStep,
    setSelectedActionPlanId,
    setSelectedInterventionId,
  ]);

  useEffect(() => {
    const plans = caseData?.actionPlans || [];
    if (!plans.length) return;
    const isDraftStatusValue = value => String(value || "").toLowerCase() === "draft";
    const isChangesRequestedValue = value => String(value || "").toLowerCase() === "changes_requested";
    const isSubmittedValue = value => String(value || "").toLowerCase() === "submitted";
    const findById = interventionId => {
      const target = String(interventionId);
      for (const plan of plans) {
        const list = Array.isArray(plan.interventions) ? plan.interventions : [];
        const match = list.find(item => String(item?.id) === target);
        if (match) return match;
      }
      return null;
    };
    const pickLatestDraft = list => {
      const sorted = list
        .filter(
          item =>
            isDraftStatusValue(item?.status) ||
            isChangesRequestedValue(item?.status) ||
            isSubmittedValue(item?.status)
        )
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      return sorted[0] || null;
    };

    const hydrate = draft => {
      if (!draft) return;
      const metadata = draft.metadata || {};
      const review = metadata.review && typeof metadata.review === "object" ? metadata.review : {};
      const storedStepKey = caseId && draft.id ? `${caseId}:${draft.id}` : null;
      const storedDraft = resolveStoredDraft(storedStepKey);
      const proposed = normalizeProposedInterventions(metadata.proposedInterventions || metadata.proposed_interventions);
      let nextProposed = proposed;
      if (!nextProposed.length) {
        nextProposed = [
          buildEmptyIntervention({
            id: buildUuid(),
            code: metadata.snapshot?.code || draft.code || "",
            startDate: metadata.snapshot?.startDate || draft.startDate || "",
            endDate: metadata.snapshot?.endDate || draft.endDate || "",
            deliveryMode: metadata.snapshot?.deliveryMode === "in_house" ? "in_house" : "partner",
            institution: metadata.snapshot?.institution || draft.institution || "",
            programName: metadata.snapshot?.programName || draft.programName || "",
            itpDetails: metadata.snapshot?.itpDetails || "",
            wageSubsidyDetails: metadata.snapshot?.wageSubsidyDetails || "",
            interventionNoc: metadata.snapshot?.nocCode || draft.noc || "",
            interventionNocVersion: metadata.snapshot?.nocVersion || draft.nocVersion || "",
            costLines: Array.isArray(metadata.snapshot?.costLines)
              ? metadata.snapshot.costLines.map(normalizeCostLine).filter(Boolean)
              : [],
          }),
        ];
      }
      const mappedBarriers = Array.isArray(metadata.barriers)
        ? metadata.barriers
            .map(val => BARRIER_OPTIONS.find(opt => opt.value === (val.value || val)))
            .filter(Boolean)
        : [];
      const hydratedForm = {
        ...defaultFormState,
        actionPlanId: draft.actionPlanId ? String(draft.actionPlanId) : form.actionPlanId,
        rationale: metadata.rationale || draft.notes || "",
        otherFunding: metadata.otherFunding || "",
        childcareNeed: metadata.childcareNeed || "",
        childcareFunding: metadata.childcareFunding || "",
        barriers: mappedBarriers,
        proposedInterventions: nextProposed,
        eiVerificationStatus: review.eiStatus || "",
        eiVerificationNotes: review.eiNotes || "",
        decisionOutcome: review.decision || "",
        decisionNotes: review.decisionNotes || "",
        eiVerificationDocumentId: review.eiDocumentId || null,
      };
      const nextForm = storedDraft && hasMeaningfulDraft(storedDraft)
        ? mergeStoredDraft(hydratedForm, storedDraft)
        : hydratedForm;
      setForm(nextForm);
      initialFormRef.current = nextForm;
      if (draft.actionPlanId && typeof setSelectedActionPlanId === "function") {
        setSelectedActionPlanId(draft.actionPlanId);
      }
      if (draft.id && typeof setSelectedInterventionId === "function") {
        setSelectedInterventionId(draft.id);
      }
      const draftStatus = String(draft.status || "").toLowerCase();
      const stepIds = draftStatus === "submitted" ? [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS] : BASE_STEP_IDS;
      const storedStep = resolveStoredStep(storedStepKey, stepIds);
      const nextStep = storedStep || BASE_STEP_IDS[0];
      setHydratedDraftId(draft.id || null);
      setHydratedDraftUpdatedAt(draft.updatedAt || draft.createdAt || null);
      setCurrentInterventionStatus(draftStatus || null);
      setAttemptedSteps({});
      setCurrentStep(nextStep);
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      setEiVerificationUploadError(null);
      setEiVerificationUploadSuccess(null);
      setEiVerificationUploading(false);
    };

    const resolved = selectedDraftId ? findById(selectedDraftId) : null;
    if (resolved) {
      const updatedAt = resolved.updatedAt || resolved.createdAt || null;
      if (resolved.id === hydratedDraftId && updatedAt === hydratedDraftUpdatedAt) return;
      hydrate(resolved);
      return;
    }

    if (selectedDraftId && !resolved) return;

    const fallbackDraft = pickLatestDraft(plans.flatMap(plan => plan.interventions || []));
    if (fallbackDraft) {
      const updatedAt = fallbackDraft.updatedAt || fallbackDraft.createdAt || null;
      if (fallbackDraft.id === hydratedDraftId && updatedAt === hydratedDraftUpdatedAt) return;
      hydrate(fallbackDraft);
    }
  }, [
    caseData,
    caseId,
    form.actionPlanId,
    hasMeaningfulDraft,
    hydratedDraftId,
    hydratedDraftUpdatedAt,
    mergeStoredDraft,
    resolveStoredDraft,
    resolveStoredStep,
    selectedDraftId,
    setSelectedActionPlanId,
    setSelectedInterventionId,
  ]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialFormRef.current),
    [form]
  );

  const requiresPrimaryNoc = useMemo(
    () => Boolean(primaryIntervention?.code && requiresNocForCode(primaryIntervention.code)),
    [primaryIntervention, requiresNocForCode]
  );
  const hasPrimaryNoc = useMemo(
    () => Boolean(primaryIntervention?.interventionNocVersion && primaryIntervention?.interventionNoc),
    [primaryIntervention]
  );
  const canAutoSave = useMemo(
    () =>
      Boolean(
        form.actionPlanId &&
          primaryIntervention?.code &&
          primaryIntervention?.startDate &&
          (!requiresPrimaryNoc || hasPrimaryNoc)
      ),
    [form.actionPlanId, primaryIntervention, requiresPrimaryNoc, hasPrimaryNoc]
  );

  const serializeCostLine = useCallback(line => {
    const recurrence = line?.recurrence || {};
    const occurrencesValue =
      recurrence.occurrences === "" || recurrence.occurrences === null || typeof recurrence.occurrences === "undefined"
        ? null
        : Number(recurrence.occurrences);
    const occurrences = Number.isFinite(occurrencesValue) ? occurrencesValue : null;
    return {
      id: line?.id || buildUuid(),
      type: line?.type || null,
      amount: parseCurrencyInput(line?.amount),
      notes: line?.notes || null,
      recurrence: {
        enabled: Boolean(recurrence.enabled),
        startDate: formatDate(recurrence.startDate) || null,
        endDate: formatDate(recurrence.endDate) || null,
        occurrences,
        amountPerPeriod: parseCurrencyInput(recurrence.amountPerPeriod),
      },
    };
  }, []);

  const serializeProposedInterventions = useCallback(
    interventions => {
      const list = Array.isArray(interventions) ? interventions.filter(item => item.code || item.startDate || item.endDate) : [];
      if (!list.length) return [];
      return list.map(item => ({
        id: item.id || buildUuid(),
        code: item.code || null,
        startDate: formatDate(item.startDate) || null,
        endDate: formatDate(item.endDate) || null,
        deliveryMode: item.deliveryMode === "in_house" ? "in_house" : "partner",
        institution: item.institution || null,
        programName: item.programName || null,
        itpDetails: item.itpDetails || null,
        wageSubsidyDetails: item.wageSubsidyDetails || null,
        interventionNoc: item.interventionNoc || null,
        interventionNocVersion: item.interventionNocVersion || null,
        suggestionsSeeded: Boolean(item.suggestionsSeeded),
        costLines: Array.isArray(item.costLines) ? item.costLines.map(serializeCostLine) : [],
      }));
    },
    [serializeCostLine]
  );

  const validateProposal = useCallback(
    () => {
      const errors = {};
      const interventionErrors = {};
      const costLineErrors = {};
      if (!form.actionPlanId) {
        errors.actionPlanId = "Action Plan is required.";
      }
      if (!form.rationale || !form.rationale.trim()) {
        errors.rationale = "Rationale is required.";
      }
      if (!proposedInterventions.length) {
        interventionErrors._global = "Add at least one proposed intervention.";
      }
      proposedInterventions.forEach(intervention => {
        const entryErrors = {};
        if (!intervention.code) entryErrors.code = "Select an intervention code.";
        if (!intervention.startDate) entryErrors.startDate = "Start date is required.";
        const startUtc = parseIsoDateToUtc(intervention.startDate);
        const endUtc = parseIsoDateToUtc(intervention.endDate);
        if (startUtc !== null && endUtc !== null && endUtc < startUtc) {
          entryErrors.endDate = "End date cannot be before start date.";
        }
        const requiresNocCode = requiresNocForCode(intervention.code);
        if (requiresNocCode) {
          if (!intervention.interventionNocVersion) {
            entryErrors.interventionNocVersion = "Select a NOC version for this intervention.";
          }
          if (!intervention.interventionNoc) {
            entryErrors.interventionNoc = "Select a NOC code for this intervention.";
          }
        }
        const educationCode = isEducationCode(intervention.code);
        const employerCode = isEmployerCode(intervention.code);
        const wageSubsidyCode = isWageSubsidyCode(intervention.code);
        if (educationCode) {
          if (!intervention.institution || !intervention.institution.trim()) {
            entryErrors.institution = "Training institution is required for this intervention code.";
          }
          if (!intervention.itpDetails || !intervention.itpDetails.trim()) {
            entryErrors.itpDetails = "ITP details are required for this intervention code.";
          }
        }
        if (employerCode) {
          if (!intervention.institution || !intervention.institution.trim()) {
            entryErrors.institution = "Employer / delivery partner is required for this intervention code.";
          }
          if (wageSubsidyCode && (!intervention.wageSubsidyDetails || !intervention.wageSubsidyDetails.trim())) {
            entryErrors.wageSubsidyDetails = "Wage subsidy details are required for this intervention code.";
          }
        }
        if (!educationCode && !employerCode && intervention.deliveryMode !== "in_house") {
          if (!intervention.institution || !intervention.institution.trim()) {
            entryErrors.institution = "Delivery partner is required when using external delivery.";
          }
        }
        if (Object.keys(entryErrors).length) {
          interventionErrors[intervention.id] = entryErrors;
        }
        const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        const lineErrors = {};
        lines.forEach(line => {
          const detailErrors = {};
          if (!line.type) detailErrors.type = "Select a cost item.";
          const amount = parseCurrencyInput(line.amount);
          if (line.amount === "" || amount === null || !Number.isFinite(amount) || amount < 0) {
            detailErrors.amount = "Enter a valid amount in dollars.";
          }
          const recurrenceMode = getRecurrenceModeForType(line.type);
          const recurrenceRequired = recurrenceMode === RECURRENCE_MODE_REQUIRED;
          const recurrenceEnabled = Boolean(line.recurrence?.enabled);
          if ((recurrenceRequired || recurrenceEnabled) && !isRecurrenceScheduleComplete(line)) {
            detailErrors.recurrence = "Complete the installments schedule.";
          }
          if (Object.keys(detailErrors).length) {
            lineErrors[line.id] = detailErrors;
          }
        });
        if (Object.keys(lineErrors).length) {
          costLineErrors[intervention.id] = lineErrors;
        }
      });
      if (Object.keys(interventionErrors).length) {
        errors.interventions = interventionErrors;
      }
      if (Object.keys(costLineErrors).length) {
        errors.costLines = costLineErrors;
      }
      return errors;
    },
    [form.actionPlanId, form.rationale, proposedInterventions, getRecurrenceModeForType]
  );

  const buildProposalPayload = useCallback(
    statusValue => {
      const proposedPayload = serializeProposedInterventions(proposedInterventions);
      const primary = primaryIntervention;
      const primaryStartDate = primary?.startDate || "";
      const primaryEndDate = primary?.endDate || "";
      const interventionDuration = calculateDurationDays(primaryStartDate, primaryEndDate);
      const primaryCost = Number.isFinite(interventionTotals.get(primary?.id)) ? interventionTotals.get(primary?.id) : 0;
      return {
        code: primary?.code || null,
        title: resolveInterventionLabel(primary?.code) || "Draft intervention",
        status: statusValue,
        startDate: primaryStartDate || null,
        endDate: primaryEndDate || null,
        durationDays: interventionDuration !== null ? String(interventionDuration) : null,
        cost: primaryCost,
        notes: form.rationale || "",
        noc: primary?.interventionNoc || null,
        nocVersion: primary?.interventionNocVersion || null,
        metadata: {
          proposedInterventions: proposedPayload.length ? proposedPayload : null,
          rationale: form.rationale || "",
          barriers: Array.isArray(form.barriers) ? form.barriers.map(item => item.value || item) : [],
          otherFunding: form.otherFunding || "",
          childcareNeed: form.childcareNeed || "",
          childcareFunding: form.childcareFunding || "",
          review: {
            eiStatus: form.eiVerificationStatus || "",
            eiNotes: form.eiVerificationNotes || "",
            decision: form.decisionOutcome || "",
            decisionNotes: form.decisionNotes || "",
            eiDocumentId: form.eiVerificationDocumentId || null,
          },
        },
      };
    },
    [
      form,
      primaryIntervention,
      proposedInterventions,
      serializeProposedInterventions,
      interventionTotals,
      resolveInterventionLabel,
    ]
  );

  const findEditableDraft = useCallback(() => {
    const plans = caseData?.actionPlans || [];
    if (selectedDraftId) {
      const match = plans.flatMap(plan => plan.interventions || []).find(item => String(item.id) === String(selectedDraftId));
      if (match) return match;
    }
    const match = plans
      .flatMap(plan => plan.interventions || [])
      .find(item => ["draft", "changes_requested"].includes(String(item?.status || "").toLowerCase()));
    return match || null;
  }, [caseData, selectedDraftId]);

  const handleSave = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setError(null);
        setSuccessMessage("");
      }
      if (!isEditable) {
        const message = "This proposal is read-only and cannot be updated.";
        if (!silent) {
          setError(message);
        }
        return { ok: false, error: new Error(message) };
      }
      if (!form.actionPlanId) {
        const message = "Select an Action Plan before saving.";
        if (!silent) {
          setError(message);
        }
        return { ok: false, error: new Error(message) };
      }
      const payload = buildProposalPayload("draft");
      setIsSubmitting(true);
      try {
        const existingDraft = findEditableDraft();
        const actionPlanId = Number(form.actionPlanId);
        if (existingDraft && typeof updateInterventionRecord === "function") {
          const updated = await updateInterventionRecord(actionPlanId, existingDraft.id, payload);
          setSelectedDraftId(updated?.id || existingDraft.id);
          setHydratedDraftId(updated?.id || existingDraft.id);
          setHydratedDraftUpdatedAt(updated?.updatedAt || updated?.createdAt || null);
        } else if (typeof createIntervention === "function") {
          const created = await createIntervention(actionPlanId, payload);
          setSelectedDraftId(created?.id || null);
          setHydratedDraftId(created?.id || null);
          setHydratedDraftUpdatedAt(created?.updatedAt || created?.createdAt || null);
          if (typeof setSelectedInterventionId === "function") {
            setSelectedInterventionId(created?.id || null);
          }
        }
        setCurrentInterventionStatus("draft");
        if (!silent) {
          setSuccessMessage("Progress saved.");
        }
        initialFormRef.current = form;
        return { ok: true };
      } catch (err) {
        const message = err?.message || "Failed to save progress.";
        if (!silent) {
          setError(message);
        }
        return { ok: false, error: err || new Error(message) };
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      buildProposalPayload,
      createIntervention,
      findEditableDraft,
      form,
      isEditable,
      setSelectedInterventionId,
      updateInterventionRecord,
    ]
  );

  const validateStep = useCallback(
    stepId => {
      const errors = validateProposal();
      if (stepId === "plan") return !errors.actionPlanId;
      if (stepId === "framing") {
        const interventionErrors = errors.interventions || {};
        if (interventionErrors._global) return false;
        return !Object.values(interventionErrors).some(
          entry => entry && (entry.code || entry.startDate || entry.endDate)
        );
      }
      if (stepId === "rationale") return !errors.rationale;
      if (stepId === "cost") return !errors.costLines || Object.keys(errors.costLines).length === 0;
      return true;
    },
    [validateProposal]
  );

  const handleSubmitProposal = useCallback(
    async event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      setError(null);
      setSuccessMessage("");
      if (!isEditable) {
        setError("This proposal is read-only and cannot be submitted.");
        return;
      }
      if (!form.actionPlanId) {
        setError("Select an Action Plan before submitting the proposal.");
        return;
      }
      const invalidSteps = REQUIRED_STEP_IDS.filter(stepId => !validateStep(stepId));
      if (invalidSteps.length > 0) {
        setAttemptedSteps(prev => ({ ...prev, [invalidSteps[0]]: true }));
        setCurrentStep(invalidSteps[0]);
        setError("Complete required fields before submitting.");
        return;
      }
      setIsSubmitting(true);
      try {
        const payload = buildProposalPayload("submitted");
        const existingDraft = findEditableDraft();
        const actionPlanId = Number(form.actionPlanId);
        const saved = existingDraft && typeof updateInterventionRecord === "function"
          ? await updateInterventionRecord(actionPlanId, existingDraft.id, payload)
          : await createIntervention(actionPlanId, payload);
        if (saved?.id) {
          setSelectedDraftId(saved.id);
          setHydratedDraftId(saved.id);
          setHydratedDraftUpdatedAt(saved.updatedAt || saved.createdAt || null);
          if (typeof setSelectedInterventionId === "function") {
            setSelectedInterventionId(saved.id);
          }
        }
        setCurrentInterventionStatus("submitted");
        setSuccessMessage("Proposal submitted for approval.");
      } catch (err) {
        setError(err?.message || "Failed to submit proposal.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      buildProposalPayload,
      createIntervention,
      findEditableDraft,
      form.actionPlanId,
      isEditable,
      setSelectedInterventionId,
      updateInterventionRecord,
      validateStep,
    ]
  );

  const uploadEiVerificationIfSelected = useCallback(
    async ({ interventionId } = {}) => {
      if (isFormLocked) return true;
      if (!eiVerificationFile) return true;
      if (!form.eiVerificationStatus) {
        setEiVerificationUploadError("Select an eligibility value to upload the document.");
        return false;
      }
      if (!applicantUserId) {
        setEiVerificationUploadError("Unable to determine the applicant for this upload.");
        return false;
      }
      if (!interventionId) {
        setEiVerificationUploadError("Save progress to create the intervention record before uploading EI verification.");
        return false;
      }
      setEiVerificationUploading(true);
      setEiVerificationUploadError(null);
      setEiVerificationUploadSuccess(null);
      try {
        const formData = new FormData();
        formData.append("file", eiVerificationFile);
        formData.append("label", "EI Verification");
        formData.append("documentType", "ei_verification");
        if (caseId) formData.append("caseId", caseId);
        formData.append("interventionId", interventionId);
        const response = await apiFetch(`/api/applicants/${applicantUserId}/documents/upload`, {
          method: "POST",
          body: formData,
        });
        if (!response || !response.ok) {
          let payload = null;
          try {
            payload = await response.json();
          } catch (_) {
            payload = null;
          }
          const errorCode = payload?.error || null;
          if (errorCode === "unsupported_file_type") {
            throw new Error("That file type is not allowed. Please upload a PDF or image.");
          }
          if (errorCode === "file_too_large") {
            throw new Error("The file is too large to upload.");
          }
          if (errorCode === "application_required_for_document") {
            throw new Error("Save progress to link an application before uploading this document.");
          }
          if (errorCode === "invalid_document_type") {
            throw new Error("The EI Verification document type is not available.");
          }
          throw new Error(payload?.message || "Failed to upload EI verification document.");
        }
        const payload = await response.json().catch(() => ({}));
        const documentId = payload?.document?.id || null;
        if (documentId) {
          setForm(prev => ({ ...prev, eiVerificationDocumentId: documentId }));
        }
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          window.dispatchEvent(
            new CustomEvent("iset:supporting-documents:refresh", { detail: { applicantUserId } })
          );
        }
        const uploadedName = eiVerificationFile?.name || "document";
        setEiVerificationUploadSuccess(`Uploaded ${uploadedName}.`);
        setEiVerificationFile(null);
        setEiVerificationFileError(null);
        return true;
      } catch (err) {
        setEiVerificationUploadError(err?.message || "Failed to upload EI verification document.");
        return false;
      } finally {
        setEiVerificationUploading(false);
      }
    },
    [apiFetch, applicantUserId, caseId, eiVerificationFile, form.eiVerificationStatus, isFormLocked]
  );

  const addCaseNote = useCallback(
    async (title, body) => {
      if (!caseId) return;
      const noteBody = `${title}\n${body}`.trim();
      await apiFetch(`/api/cases/${caseId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("case-notes-refresh", { detail: { caseId } }));
      }
    },
    [apiFetch, caseId]
  );

  const linkEiDocumentToInterventions = useCallback(
    async (documentId, interventionIds) => {
      if (!documentId || !Array.isArray(interventionIds) || interventionIds.length === 0) return;
      await apiFetch(`/api/documents/${documentId}/link-interventions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionIds }),
      });
    },
    [apiFetch]
  );

  const buildApprovedInterventionPayload = useCallback(
    intervention => {
      const totalCost = interventionTotals.get(intervention.id) || 0;
      const durationDays = calculateDurationDays(intervention.startDate, intervention.endDate);
      return {
        code: intervention.code || null,
        title: resolveInterventionLabel(intervention.code) || "Intervention",
        status: "planned",
        startDate: intervention.startDate || null,
        endDate: intervention.endDate || null,
        durationDays: durationDays !== null ? String(durationDays) : null,
        cost: totalCost,
        notes: form.rationale || "",
        noc: intervention.interventionNoc || null,
        nocVersion: intervention.interventionNocVersion || null,
        metadata: {
          snapshot: {
            code: intervention.code || null,
            startDate: intervention.startDate || null,
            endDate: intervention.endDate || null,
            deliveryMode: intervention.deliveryMode,
            institution: intervention.institution || "",
            programName: intervention.programName || "",
            itpDetails: intervention.itpDetails || "",
            wageSubsidyDetails: intervention.wageSubsidyDetails || "",
            nocVersion: intervention.interventionNocVersion || "",
            nocCode: intervention.interventionNoc || "",
            costLines: Array.isArray(intervention.costLines)
              ? intervention.costLines.map(serializeCostLine)
              : [],
          },
          costLines: Array.isArray(intervention.costLines)
            ? intervention.costLines.map(serializeCostLine)
            : [],
          rationale: form.rationale || "",
          barriers: Array.isArray(form.barriers) ? form.barriers.map(item => item.value || item) : [],
          otherFunding: form.otherFunding || "",
          childcareNeed: form.childcareNeed || "",
          childcareFunding: form.childcareFunding || "",
          review: {
            eiStatus: form.eiVerificationStatus || "",
            decision: "approved",
            eiDocumentId: form.eiVerificationDocumentId || null,
          },
        },
      };
    },
    [form, interventionTotals, resolveInterventionLabel, serializeCostLine]
  );

  const resetProposalState = useCallback(
    () => {
      const keysToClear = [];
      if (caseId) {
        if (activeInterventionIdValue) {
          keysToClear.push(`${caseId}:${activeInterventionIdValue}`);
        }
        keysToClear.push(`${caseId}:draft`);
      }
      if (typeof clearInterventionWizardDraft === "function") {
        keysToClear.forEach(key => clearInterventionWizardDraft(key));
      }
      if (typeof clearInterventionWizardStep === "function") {
        keysToClear.forEach(key => clearInterventionWizardStep(key));
      }

      setSelectedDraftId(null);
      setHydratedDraftId(null);
      setHydratedDraftUpdatedAt(null);
      setCurrentInterventionStatus(null);
      if (typeof setSelectedInterventionId === "function") {
        setSelectedInterventionId(null);
      }

      const nextForm = { ...defaultFormState };
      setForm(nextForm);
      initialFormRef.current = nextForm;
      setCurrentStep(BASE_STEP_IDS[0]);
      setAttemptedSteps({});
      setDecisionBlockerVisible(false);
      setDecisionBlockerReasons([]);
      setDecisionBlockerTargetStep(null);
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      setEiVerificationUploadError(null);
      setEiVerificationUploadSuccess(null);
    },
    [
      activeInterventionIdValue,
      caseId,
      clearInterventionWizardDraft,
      clearInterventionWizardStep,
      setSelectedInterventionId,
    ]
  );

  const handleSubmitDecision = useCallback(
    async event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      setError(null);
      setSuccessMessage("");
      setAttemptedSteps(prev => ({ ...prev, decision: true }));
      if (!isEditable) {
        setError("This proposal is read-only and cannot be updated.");
        return;
      }
      if (!isSubmittedStatus) {
        setError("Only submitted proposals can be decided.");
        return;
      }
      const outcome = form.decisionOutcome;
      const reasons = [];
      let targetStep = null;
      if (!outcome) {
        reasons.push("Select a decision outcome in the decision step.");
        targetStep = "decision";
      }
      if (outcome === "approved") {
        if (!form.eiVerificationStatus) {
          reasons.push("Set EI eligibility for approval.");
          targetStep = targetStep || "decision";
        }
        if (!form.eiVerificationDocumentId && !eiVerificationFile) {
          reasons.push("Upload an EI verification document to approve.");
          targetStep = targetStep || "decision";
        }
        if (hasPlanFundingMismatch) {
          reasons.push(`Action Plan funding stream must match EI eligibility (${requiredFundingStream}).`);
          targetStep = targetStep || "decision";
        }
      }
      if (outcome === "changes_requested" && !form.decisionNotes.trim()) {
        reasons.push("Request changes requires a note.");
        targetStep = targetStep || "decision";
      }
      if (outcome === "rejected" && !form.decisionNotes.trim()) {
        reasons.push("Rejection requires a note.");
        targetStep = targetStep || "decision";
      }
      if (reasons.length) {
        setDecisionBlockerReasons(reasons);
        setDecisionBlockerTargetStep(targetStep);
        setDecisionBlockerVisible(true);
        return;
      }
      if (!activeInterventionIdValue) {
        setError("Select a submitted proposal before submitting a decision.");
        return;
      }
      const actionPlanId = Number(form.actionPlanId);
      if (!actionPlanId) {
        setError("Action Plan is required.");
        return;
      }
      setIsSubmitting(true);
      try {
        if (outcome === "approved") {
          const uploadOk = await uploadEiVerificationIfSelected({ interventionId: activeInterventionIdValue });
          if (!uploadOk) {
            setIsSubmitting(false);
            return;
          }
          const interventionsToCreate = proposedInterventions.length
            ? proposedInterventions
            : [];
          if (!interventionsToCreate.length) {
            setError("Add at least one proposed intervention before approving.");
            return;
          }
          const [primary, ...rest] = interventionsToCreate;
          const primaryPayload = buildApprovedInterventionPayload(primary);
          const updated = await updateInterventionRecord(actionPlanId, Number(activeInterventionIdValue), primaryPayload);
          const created = [];
          for (const intervention of rest) {
            const payload = buildApprovedInterventionPayload(intervention);
            const row = await createIntervention(actionPlanId, payload);
            if (row?.id) created.push(row.id);
          }
          const allIds = [updated?.id || Number(activeInterventionIdValue), ...created].filter(Boolean);
          if (form.eiVerificationDocumentId) {
            await linkEiDocumentToInterventions(form.eiVerificationDocumentId, allIds);
          }
          setCurrentInterventionStatus("planned");
          setSuccessMessage("Interventions approved and created.");
          resetProposalState();
        } else {
          const payload = buildProposalPayload(outcome);
          const updated = await updateInterventionRecord(actionPlanId, Number(activeInterventionIdValue), payload);
          setCurrentInterventionStatus(outcome);
          if (outcome === "changes_requested") {
            await addCaseNote("Intervention proposal — Request changes", form.decisionNotes.trim());
          }
          if (outcome === "rejected") {
            await addCaseNote("Intervention proposal — Rejected", form.decisionNotes.trim());
          }
          setSuccessMessage(updated ? "Decision submitted." : "Decision submitted.");
          if (outcome === "rejected") {
            resetProposalState();
          }
        }
      } catch (err) {
        setError(err?.message || "Failed to submit decision.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeInterventionIdValue,
      addCaseNote,
      buildApprovedInterventionPayload,
      buildProposalPayload,
      createIntervention,
      form,
      hasPlanFundingMismatch,
      isEditable,
      isSubmittedStatus,
      linkEiDocumentToInterventions,
      proposedInterventions,
      requiredFundingStream,
      resetProposalState,
      updateInterventionRecord,
      uploadEiVerificationIfSelected,
      eiVerificationFile,
    ]
  );

  const handleEiVerificationFileChange = useCallback(event => {
    const input = event?.target;
    const file = input?.files?.[0] || null;
    if (input) {
      input.value = "";
    }
    setEiVerificationUploadError(null);
    setEiVerificationUploadSuccess(null);
    if (!file) {
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      return;
    }
    if (!ELIGIBILITY_ALLOWED_MIME_TYPES.includes(file.type)) {
      setEiVerificationFile(null);
      setEiVerificationFileError("Only PDF, JPG, PNG, BMP, or TIFF files are allowed.");
      return;
    }
    if (file.size > ELIGIBILITY_MAX_BYTES) {
      setEiVerificationFile(null);
      setEiVerificationFileError("File is too large (max 6 MB).");
      return;
    }
    setEiVerificationFile(file);
    setEiVerificationFileError(null);
  }, []);

  const validationErrors = useMemo(() => validateProposal(), [validateProposal]);
  const showPlanErrors = Boolean(attemptedSteps.plan);
  const showFramingErrors = Boolean(attemptedSteps.framing);
  const showRationaleErrors = Boolean(attemptedSteps.rationale);
  const showCostErrors = Boolean(attemptedSteps.cost);
  const showDecisionErrors = Boolean(attemptedSteps.decision);

  const headerDescription = isSubmittedStatus && isEditable
    ? "Review the submitted proposal, verify EI status, and record the decision."
    : isEditable
      ? "Propose new interventions for this client. Save progress to finish later. Only one draft proposal can exist at a time."
      : statusValue
        ? "Viewing this proposal in read-only mode."
        : "Select a draft or submitted proposal from the Interventions table to view it here.";

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Proposed interventions", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const planStepContent = (
    <SpaceBetween size="m">
      {!planOptions.length ? (
        <Alert type="info">
          No active or draft action plans are available. Create an action plan before proposing interventions.
        </Alert>
      ) : (
        <FormField
          label="Action Plan"
          description="Choose the action plan this proposal belongs to."
          errorText={showPlanErrors && !form.actionPlanId ? "Action Plan is required." : undefined}
        >
          <Select
            selectedOption={planOptions.find(option => option.value === form.actionPlanId) || null}
            onChange={({ detail }) => {
              const value = detail?.selectedOption?.value || "";
              handleChange("actionPlanId", value);
              if (value) {
                const numericValue = Number(value);
                if (typeof setSelectedActionPlanId === "function") {
                  setSelectedActionPlanId(Number.isFinite(numericValue) ? numericValue : value);
                }
              }
            }}
            options={planOptions}
            placeholder={planOptions.length ? "Select plan" : "No plans available"}
            disabled={isFormLocked || !planOptions.length}
          />
        </FormField>
      )}
      {hasBlockingSubmitted && !isSubmittedStatus && (
        <Alert type="warning">
          A submitted proposal is pending approval. Resolve it before starting a new proposal.
        </Alert>
      )}
      {hasBlockingDraft && !isDraftStatus && !isChangesRequestedStatus && (
        <Alert type="warning">
          A draft proposal already exists. Resume it from the interventions table.
        </Alert>
      )}
    </SpaceBetween>
  );

  const framingErrors = showFramingErrors ? validationErrors.interventions || {} : {};
  const framingGlobalError = showFramingErrors ? framingErrors._global : null;

  const framingStepContent = (
    <SpaceBetween size="l">
      <Table
        key={`proposed-interventions-${proposedInterventionsTableVersion}`}
        stripedRows
        variant="embedded"
        trackBy="id"
        items={proposedInterventions}
        resizableColumns
        columnDefinitions={[
          {
            id: "intervention",
            header: "Intervention",
            cell: item => {
              const entryErrors = framingErrors[item.id] || {};
              return (
                <SpaceBetween size="xxs">
                  <Link
                    onFollow={event => {
                      event.preventDefault();
                      openViewInterventionModal(item.id);
                    }}
                  >
                    {resolveInterventionLabel(item.code) || "—"}
                  </Link>
                  {showFramingErrors && entryErrors.code && (
                    <Box color="text-status-error" fontSize="body-s">
                      {entryErrors.code}
                    </Box>
                  )}
                </SpaceBetween>
              );
            },
          },
          {
            id: "dates",
            header: "Dates",
            minWidth: 140,
            cell: item => {
              const entryErrors = framingErrors[item.id] || {};
              const dateError = entryErrors.startDate || entryErrors.endDate;
              return (
                <SpaceBetween size="xxs">
                  <Box>{formatInterventionDates(item.startDate, item.endDate)}</Box>
                  {showFramingErrors && dateError && (
                    <Box color="text-status-error" fontSize="body-s">
                      {dateError}
                    </Box>
                  )}
                </SpaceBetween>
              );
            },
          },
          {
            id: "actions",
            header: "Actions",
            minWidth: 90,
            width: 90,
            cell: item => (
              <Button
                variant="inline-icon"
                iconName="remove"
                ariaLabel="Delete intervention"
                onClick={() => setInterventionDeleteId(item.id)}
                disabled={isFormLocked}
              />
            ),
          },
        ]}
        header={
          <Header
            variant="h3"
            actions={
              <Button onClick={openAddInterventionModal} disabled={isFormLocked}>
                Add intervention
              </Button>
            }
          >
            Proposed interventions
          </Header>
        }
        empty={<Box textAlign="center">No proposed interventions.</Box>}
      />
      {framingGlobalError && (
        <Box color="text-status-error" fontSize="body-s">
          {framingGlobalError}
        </Box>
      )}
    </SpaceBetween>
  );

  const rationaleStepContent = (
    <SpaceBetween size="m">
      <FormField
        label="Rationale and goals"
        description="Explain why new interventions are needed, referencing outcomes of the last assessment/intervention, remaining gaps, and expected employment results."
        errorText={showRationaleErrors && (!form.rationale || !form.rationale.trim()) ? "Rationale is required." : undefined}
        constraintText={`${form.rationale.split(/\s+/).filter(Boolean).length}/${RATIONALE_WORD_LIMIT} words maximum`}
      >
        <Textarea
          value={form.rationale}
          rows={4}
          onChange={({ detail }) => handleChange("rationale", detail.value)}
          placeholder="Summarize why these interventions are needed and expected outcomes."
          disabled={isFormLocked}
        />
      </FormField>
      <FormField label="Barriers to employment (optional)">
        <Multiselect
          options={BARRIER_OPTIONS}
          selectedOptions={form.barriers}
          onChange={({ detail }) => handleChange("barriers", detail.selectedOptions || [])}
          placeholder="Select barriers"
          disabled={isFormLocked}
        />
      </FormField>
    </SpaceBetween>
  );

  const otherFundingStepContent = (
    <SpaceBetween size="m">
      <FormField
        label="Other funding sources"
        description="Current participant: document any changes since the original approval. Note new or ended funding sources (Band funding, scholarships, other programs), any amount changes, and attach supporting documentation to avoid double-dipping."
      >
        <Textarea
          value={form.otherFunding}
          onChange={({ detail }) => handleChange("otherFunding", detail.value)}
          rows={4}
          disabled={isFormLocked}
        />
      </FormField>
    </SpaceBetween>
  );

  const childcareStepContent = (
    <SpaceBetween size="m">
      <FormField label="Childcare need" description="Indicate if childcare is required to participate in the interventions.">
        <Select
          selectedOption={
            form.childcareNeed
              ? { value: form.childcareNeed, label: form.childcareNeed === "yes" ? "Yes" : "No" }
              : null
          }
          onChange={({ detail }) => handleChange("childcareNeed", detail.selectedOption?.value || "")}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          placeholder="Select"
          readOnly={isFormLocked}
        />
      </FormField>
      <FormField label="Childcare funding details (optional)">
        <Textarea
          value={form.childcareFunding || ""}
          onChange={({ detail }) => handleChange("childcareFunding", detail.value)}
          rows={3}
          disabled={isFormLocked || form.childcareNeed !== "yes"}
        />
      </FormField>
    </SpaceBetween>
  );

  const costErrors = showCostErrors ? validationErrors.costLines || {} : {};
  const overallCostDisplay = formatCurrencyDisplay(overallCostTotal) || "$ 0.00";

  const costStepContent = (
    <SpaceBetween size="l">
      <Box fontWeight="bold">Total proposed cost: {overallCostDisplay}</Box>
      {proposedInterventions.map(intervention => {
        const costLines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        const interventionTotal = interventionTotals.get(intervention.id) || 0;
        const interventionTotalDisplay = formatCurrencyDisplay(interventionTotal) || "$ 0.00";
        const costItemOptions = buildCostItemOptions(intervention);
        const interventionLabel = resolveInterventionLabel(intervention.code) || "Intervention";
        return (
          <SpaceBetween key={intervention.id} size="s">
            <Header
              variant="h3"
              actions={
                <Button
                  onClick={() => openAddCostLineModal(intervention.id)}
                  disabled={isFormLocked || costItemOptions.length === 0}
                >
                  Add cost item
                </Button>
              }
            >
              {interventionLabel}
            </Header>
            <Table
              stripedRows
              variant="embedded"
              trackBy="id"
              items={costLines}
              resizableColumns
              columnDefinitions={[
                {
                  id: "type",
                  header: "Cost item",
                  cell: item => {
                    const lineErrors = costErrors[intervention.id]?.[item.id] || {};
                    const label = paymentTypeLabelLookup.get(item.type) || item.type || "—";
                    return (
                      <SpaceBetween size="xxs">
                        <Link
                          onFollow={event => {
                            event.preventDefault();
                            openCostLineModal(intervention.id, item.id);
                          }}
                        >
                          {label}
                        </Link>
                        {showCostErrors && lineErrors.type && (
                          <Box color="text-status-error" fontSize="body-s">
                            {lineErrors.type}
                          </Box>
                        )}
                      </SpaceBetween>
                    );
                  },
                },
                {
                  id: "amount",
                  header: "Amount",
                  cell: item => {
                    const lineErrors = costErrors[intervention.id]?.[item.id] || {};
                    const displayValue = inlineAmountEditingId === item.id
                      ? sanitizeCurrencyInput(item.amount)
                      : getCurrencyInputDisplayValue(parseCurrencyInput(item.amount) ?? "", false);
                    return (
                      <SpaceBetween size="xxs">
                        <Input
                          inputMode="decimal"
                          value={displayValue}
                          onFocus={() => {
                            if (!isFormLocked) setInlineAmountEditingId(item.id);
                          }}
                          onChange={({ detail }) => handleInlineAmountChange(intervention.id, item.id, detail.value)}
                          onBlur={() => handleInlineAmountBlur(item.id)}
                          placeholder="0.00"
                          readOnly={isFormLocked}
                        />
                        {showCostErrors && lineErrors.amount && (
                          <Box color="text-status-error" fontSize="body-s">
                            {lineErrors.amount}
                          </Box>
                        )}
                      </SpaceBetween>
                    );
                  },
                },
                {
                  id: "installments",
                  header: "Installments",
                  cell: item => {
                    const lineErrors = costErrors[intervention.id]?.[item.id] || {};
                    const recurrence = item.recurrence || {};
                    const enabled = Boolean(recurrence.enabled);
                    if (!enabled) {
                      return (
                        <SpaceBetween size="xxs">
                          <Box>in 1 installment</Box>
                          {showCostErrors && lineErrors.recurrence && (
                            <Box color="text-status-error" fontSize="body-s">
                              {lineErrors.recurrence}
                            </Box>
                          )}
                        </SpaceBetween>
                      );
                    }
                    const occurrences = recurrence.occurrences ? String(recurrence.occurrences) : "—";
                    return (
                      <SpaceBetween size="xxs">
                        <Box>{`in ${occurrences} installment${occurrences === "1" ? "" : "s"}`}</Box>
                        {showCostErrors && lineErrors.recurrence && (
                          <Box color="text-status-error" fontSize="body-s">
                            {lineErrors.recurrence}
                          </Box>
                        )}
                      </SpaceBetween>
                    );
                  },
                },
                {
                  id: "actions",
                  header: "",
                  minWidth: 64,
                  width: 64,
                  cell: item => (
                    isFormLocked ? null : (
                      <Button
                        variant="inline-icon"
                        iconName="remove"
                        ariaLabel="Delete cost item"
                        onClick={() => removeCostLine(intervention.id, item.id)}
                      />
                    )
                  ),
                },
              ]}
              empty={<Box padding={{ vertical: "s" }}>Intervention has no cost items.</Box>}
              footer={
                <Box textAlign="right" fontWeight="bold">
                  TOTAL: {interventionTotalDisplay}
                </Box>
              }
            />
          </SpaceBetween>
        );
      })}
    </SpaceBetween>
  );

  const docsStepContent = (
    <SpaceBetween size="m">
      <Alert type="info">No checklist items are required yet.</Alert>
    </SpaceBetween>
  );

  const reviewStepContent = (
    <SpaceBetween size="m">
      <ColumnLayout columns={2} variant="text-grid">
        <Box>
          <Header variant="h4">Rationale</Header>
          <div>{form.rationale || "—"}</div>
          <div>Barriers: {form.barriers.length ? form.barriers.map(item => item.label || item.value).join(", ") : "None"}</div>
        </Box>
        <Box>
          <Header variant="h4">Other funding</Header>
          <div>{form.otherFunding || "—"}</div>
        </Box>
        <Box>
          <Header variant="h4">Proposed interventions</Header>
          {proposedInterventions.length === 0 ? (
            <div>—</div>
          ) : (
            <SpaceBetween size="s">
              {proposedInterventions.map(intervention => (
                <Box key={intervention.id}>
                  <Box fontWeight="bold">{resolveInterventionLabel(intervention.code) || "Intervention"}</Box>
                  {intervention.startDate ? <div>Start: {intervention.startDate}</div> : null}
                  {intervention.endDate ? <div>End: {intervention.endDate}</div> : null}
                  {intervention.institution ? <div>Provider: {intervention.institution}</div> : null}
                </Box>
              ))}
            </SpaceBetween>
          )}
        </Box>
        <Box>
          <Header variant="h4">Costs</Header>
          <div>Overall proposed cost: {overallCostDisplay}</div>
        </Box>
      </ColumnLayout>
    </SpaceBetween>
  );

  const decisionStepContent = (
    <SpaceBetween size="m">
      <FormField
        label="Decision"
        description="Record the approval decision for this proposal."
        errorText={showDecisionErrors && !form.decisionOutcome ? "Decision is required." : undefined}
      >
        <Select
          selectedOption={DECISION_OPTIONS.find(option => option.value === form.decisionOutcome) || null}
          onChange={({ detail }) => handleChange("decisionOutcome", detail.selectedOption?.value || "")}
          options={DECISION_OPTIONS}
          placeholder="Select decision"
          readOnly={isFormLocked}
        />
      </FormField>
      {(form.decisionOutcome === "changes_requested" || form.decisionOutcome === "rejected") && (
        <FormField
          label={form.decisionOutcome === "changes_requested" ? "Request changes note" : "Rejection reason"}
          errorText={
            showDecisionErrors && !form.decisionNotes.trim()
              ? "A note is required."
              : undefined
          }
        >
          <Textarea
            value={form.decisionNotes}
            onChange={({ detail }) => handleChange("decisionNotes", detail.value)}
            rows={3}
            placeholder="Provide context for this decision."
            disabled={isFormLocked}
          />
        </FormField>
      )}
      {form.decisionOutcome === "approved" && (
        <SpaceBetween size="s">
          <FormField
            label="EI eligibility"
            description="Select the participant’s current EI eligibility."
            errorText={
              showDecisionErrors && !form.eiVerificationStatus ? "EI eligibility is required." : undefined
            }
          >
            <Select
              selectedOption={ESDC_OPTIONS.find(option => option.value === form.eiVerificationStatus) || null}
              onChange={({ detail }) => handleChange("eiVerificationStatus", detail.selectedOption?.value || "")}
              options={ESDC_OPTIONS}
              placeholder="Select eligibility"
              readOnly={isFormLocked || !canManageEiEligibility}
              disabled={!canManageEiEligibility}
            />
          </FormField>
          {hasPlanFundingMismatch && (
            <Alert type="warning">
              EI eligibility indicates {requiredFundingStream} funding, but the selected Action Plan is {selectedPlanFundingStream}.
              Select a matching Action Plan before approving.
            </Alert>
          )}
          <FormField
            label="EI Verification document"
            errorText={
              eiVerificationFileError ||
              (showDecisionErrors && !form.eiVerificationDocumentId && !eiVerificationFile
                ? "EI verification document is required."
                : undefined)
            }
            stretch
          >
            <Box variant="small" color="text-body-secondary">
              Max size 6 MB. Allowed types: PDF, JPG, PNG, BMP, TIFF.
            </Box>
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => eiVerificationFileInputRef.current && eiVerificationFileInputRef.current.click()}
                disabled={isFormLocked || eiVerificationUploading}
              >
                Choose file
              </Button>
              <Box>{eiVerificationFile ? eiVerificationFile.name : "No file selected"}</Box>
            </SpaceBetween>
            {form.eiVerificationDocumentId && (
              <Box variant="small" color="text-body-secondary">
                EI verification document already uploaded.
              </Box>
            )}
          </FormField>
          {eiVerificationUploadError && (
            <Alert type="error" statusIconAriaLabel="Error" dismissible onDismiss={() => setEiVerificationUploadError(null)}>
              {eiVerificationUploadError}
            </Alert>
          )}
          {eiVerificationUploadSuccess && (
            <Alert type="success" statusIconAriaLabel="Success" dismissible onDismiss={() => setEiVerificationUploadSuccess(null)}>
              {eiVerificationUploadSuccess}
            </Alert>
          )}
        </SpaceBetween>
      )}
      <input
        type="file"
        ref={eiVerificationFileInputRef}
        style={{ display: "none" }}
        accept=".pdf,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
        onChange={handleEiVerificationFileChange}
      />
    </SpaceBetween>
  );

  const decisionBlockerModal = (
    <Modal
      visible={decisionBlockerVisible}
      onDismiss={() => setDecisionBlockerVisible(false)}
      header="Cannot submit decision"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          {decisionBlockerTargetStep && (
            <Button
              variant="primary"
              onClick={() => {
                setDecisionBlockerVisible(false);
                setCurrentStep(decisionBlockerTargetStep);
              }}
            >
              Go to step
            </Button>
          )}
          <Button variant="normal" onClick={() => setDecisionBlockerVisible(false)}>Close</Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        {decisionBlockerReasons.map(reason => (
          <Box key={reason}>{reason}</Box>
        ))}
      </SpaceBetween>
    </Modal>
  );

  const interventionModalDraft = interventionModal.draft || null;
  const interventionModalMode = interventionModal.mode;
  const interventionModalEditable = interventionModalMode === "add" || interventionModalMode === "edit";
  const interventionModalDirty =
    interventionModalMode === "edit"
      ? JSON.stringify(interventionModalDraft || {}) !== JSON.stringify(interventionModal.original || {})
      : true;
  const interventionCodeLabel = interventionModalDraft
    ? resolveInterventionLabel(interventionModalDraft.code) || interventionModalDraft.code || ""
    : "";
  const interventionModalEducationCode = interventionModalDraft
    ? isEducationCode(interventionModalDraft.code)
    : false;
  const interventionModalEmployerCode = interventionModalDraft
    ? isEmployerCode(interventionModalDraft.code)
    : false;
  const interventionModalWageSubsidyCode = interventionModalDraft
    ? isWageSubsidyCode(interventionModalDraft.code)
    : false;
  const interventionModalNeedsNoc = interventionModalDraft
    ? requiresNocForCode(interventionModalDraft.code)
    : false;
  const interventionModalRequiresExternal = interventionModalDraft
    ? requiresExternalPartnerForCode(interventionModalDraft.code)
    : false;
  const interventionModalDeliveryMode =
    interventionModalDraft?.deliveryMode === "in_house" ? "in_house" : "partner";

  const interventionModalContent = (
    <Modal
      visible={interventionModal.visible}
      onDismiss={resetInterventionModal}
      header={interventionModalMode === "add" ? "Add intervention" : "Intervention details"}
      footer={
        interventionModalMode === "view" ? (
          <SpaceBetween direction="horizontal" size="xs">
            {!isFormLocked && (
              <Button variant="primary" onClick={startInterventionEdit}>Edit</Button>
            )}
            {!isFormLocked && (
              <Button
                variant="normal"
                onClick={() => {
                  if (!interventionModal.interventionId) return;
                  setInterventionDeleteId(interventionModal.interventionId);
                  resetInterventionModal();
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="link" onClick={resetInterventionModal}>Close</Button>
          </SpaceBetween>
        ) : (
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={saveInterventionModal}
              disabled={isFormLocked || (interventionModalMode === "edit" && !interventionModalDirty)}
            >
              {interventionModalMode === "add" ? "Add intervention" : "Save changes"}
            </Button>
            <Button variant="link" onClick={interventionModalMode === "add" ? resetInterventionModal : cancelInterventionEdit}>
              Cancel
            </Button>
          </SpaceBetween>
        )
      }
    >
      {interventionModalDraft && (
        <SpaceBetween size="s">
          <FormField
            label="Intervention code"
            description={
              interventionModalMode !== "add"
                ? "To change the code, delete this intervention and add a new one."
                : undefined
            }
            errorText={interventionModalErrors.code}
          >
            {interventionModalMode === "add" ? (
              <Select
                selectedOption={codeOptions.find(option => String(option.value) === String(interventionModalDraft.code)) || null}
                onChange={({ detail }) => {
                  updateInterventionModalDraft({ code: detail.selectedOption?.value || "" });
                  setInterventionModalErrors({});
                }}
                options={codeOptions}
                placeholder={interventionCodesLoading ? "Loading intervention codes" : "Select intervention"}
                statusType={interventionCodesLoading ? "loading" : "finished"}
                readOnly={isFormLocked}
              />
            ) : (
              <Input value={interventionCodeLabel} readOnly />
            )}
          </FormField>
          <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
            <FormField label="Start date" errorText={interventionModalErrors.startDate}>
              <DatePicker
                value={interventionModalDraft.startDate || ""}
                onChange={({ detail }) => {
                  updateInterventionModalDraft({ startDate: detail.value });
                  setInterventionModalErrors(prev => {
                    const next = { ...prev };
                    delete next.startDate;
                    delete next.endDate;
                    return next;
                  });
                }}
                readOnly={!interventionModalEditable || isFormLocked}
              />
            </FormField>
            <FormField label="End date" errorText={interventionModalErrors.endDate}>
              <DatePicker
                value={interventionModalDraft.endDate || ""}
                onChange={({ detail }) => {
                  updateInterventionModalDraft({ endDate: detail.value });
                  setInterventionModalErrors(prev => {
                    const next = { ...prev };
                    delete next.endDate;
                    return next;
                  });
                }}
                readOnly={!interventionModalEditable || isFormLocked}
              />
            </FormField>
          </Grid>
          {!interventionModalRequiresExternal && (
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Delivery mode" description="Choose how this will run.">
                <Select
                  selectedOption={
                    interventionModalDeliveryMode === "in_house"
                      ? { value: "in_house", label: "In-house (no external partner)" }
                      : { value: "partner", label: "External delivery partner" }
                  }
                  onChange={({ detail }) => {
                    updateInterventionModalDraft({ deliveryMode: detail.selectedOption?.value || "partner" });
                    setInterventionModalErrors(prev => {
                      const next = { ...prev };
                      delete next.institution;
                      return next;
                    });
                  }}
                  options={[
                    { value: "partner", label: "External delivery partner" },
                    { value: "in_house", label: "In-house (no external partner)" },
                  ]}
                  disabled={!interventionModalEditable || isFormLocked}
                />
              </FormField>
              {interventionModalDeliveryMode === "partner" ? (
                <FormField
                  label="Delivery partner / provider"
                  description="The training provider or employer."
                  errorText={interventionModalErrors.institution}
                >
                  <Input
                    value={interventionModalDraft.institution}
                    onChange={({ detail }) => {
                      updateInterventionModalDraft({ institution: detail.value });
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.institution;
                        return next;
                      });
                    }}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
              ) : (
                <Box />
              )}
            </ColumnLayout>
          )}
          {interventionModalEducationCode && (
            <SpaceBetween size="s">
              <ColumnLayout columns={2} variant="text-grid">
                <FormField
                  label="Institution"
                  description="Training provider or school delivering the program."
                  errorText={interventionModalErrors.institution}
                >
                  <Input
                    value={interventionModalDraft.institution}
                    onChange={({ detail }) => {
                      updateInterventionModalDraft({ institution: detail.value });
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.institution;
                        return next;
                      });
                    }}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
                <FormField label="Program name (optional)" description="Course, credential, or stream name.">
                  <Input
                    value={interventionModalDraft.programName}
                    onChange={({ detail }) => updateInterventionModalDraft({ programName: detail.value })}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
              </ColumnLayout>
              <FormField
                label="In-Training Plan (ITP) details"
                description="Outline curriculum, milestones, supports, materials, and how this leads to the employment goal."
                errorText={interventionModalErrors.itpDetails}
              >
                <Textarea
                  value={interventionModalDraft.itpDetails || ""}
                  rows={3}
                  onChange={({ detail }) => {
                    updateInterventionModalDraft({ itpDetails: detail.value });
                    setInterventionModalErrors(prev => {
                      const next = { ...prev };
                      delete next.itpDetails;
                      return next;
                    });
                  }}
                  readOnly={!interventionModalEditable || isFormLocked}
                />
              </FormField>
            </SpaceBetween>
          )}
          {interventionModalEmployerCode && (
            <SpaceBetween size="s">
              <ColumnLayout columns={2} variant="text-grid">
                <FormField
                  label="Employer / delivery partner"
                  description="Employer or host organization providing the placement."
                  errorText={interventionModalErrors.institution}
                >
                  <Input
                    value={interventionModalDraft.institution}
                    onChange={({ detail }) => {
                      updateInterventionModalDraft({ institution: detail.value });
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.institution;
                        return next;
                      });
                    }}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
                <FormField label="Program name (optional)" description="Job title, role, or program name.">
                  <Input
                    value={interventionModalDraft.programName}
                    onChange={({ detail }) => updateInterventionModalDraft({ programName: detail.value })}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
              </ColumnLayout>
              {interventionModalWageSubsidyCode && (
                <FormField
                  label="Wage subsidy details"
                  errorText={interventionModalErrors.wageSubsidyDetails}
                >
                  <Textarea
                    value={interventionModalDraft.wageSubsidyDetails || ""}
                    rows={3}
                    onChange={({ detail }) => {
                      updateInterventionModalDraft({ wageSubsidyDetails: detail.value });
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.wageSubsidyDetails;
                        return next;
                      });
                    }}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
              )}
            </SpaceBetween>
          )}
          {interventionModalNeedsNoc && (
            <ColumnLayout columns={2} variant="text-grid">
                <FormField
                  label="NOC version"
                  description="Select the NOC version used for this job/placement."
                  errorText={interventionModalErrors.interventionNocVersion}
                >
                  <Select
                    selectedOption={
                      nocVersionOptions.find(option => option.value === interventionModalDraft.interventionNocVersion) ||
                      null
                    }
                    onChange={({ detail }) => {
                      updateInterventionModalDraft({
                        interventionNocVersion: detail.selectedOption?.value || "",
                        interventionNoc: "",
                      });
                      setNocSuggestions([]);
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.interventionNocVersion;
                        delete next.interventionNoc;
                        return next;
                      });
                    }}
                    options={nocVersionOptions}
                    placeholder={nocVersionsLoading ? "Loading NOC versions..." : "Select NOC version"}
                    statusType={nocVersionsLoading ? "loading" : "finished"}
                    filteringType="auto"
                    disabled={!interventionModalEditable || isFormLocked || nocVersionsLoading}
                  />
                </FormField>
                <FormField
                  label="NOC code"
                  description="Search by code or title; aligns to the job/placement."
                  errorText={interventionModalErrors.interventionNoc}
                >
                  <Autosuggest
                    value={interventionModalDraft.interventionNoc || ""}
                    onChange={({ detail }) => {
                      const inputValue = detail.value || "";
                      updateInterventionModalDraft({ interventionNoc: inputValue });
                      if (inputValue.length >= 2 && interventionModalDraft.interventionNocVersion) {
                        fetchNocSuggestions(inputValue, interventionModalDraft.interventionNocVersion);
                      } else {
                        setNocSuggestions([]);
                      }
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.interventionNoc;
                        return next;
                      });
                    }}
                    onSelect={({ detail }) => updateInterventionModalDraft({ interventionNoc: detail.value || "" })}
                    onLoadItems={({ detail }) => {
                      if (detail.filteringText && interventionModalDraft.interventionNocVersion) {
                        fetchNocSuggestions(detail.filteringText, interventionModalDraft.interventionNocVersion);
                      }
                    }}
                    options={nocSuggestions}
                    statusType={nocSuggestionsLoading ? "loading" : "finished"}
                    expandToViewport
                    placeholder={
                      interventionModalDraft.interventionNocVersion
                        ? "Type to search NOC code"
                        : "Select a NOC version first"
                    }
                    empty="No NOC codes found."
                    disabled={
                      !interventionModalEditable ||
                      isFormLocked ||
                      !interventionModalDraft.interventionNocVersion
                    }
                    enteredTextLabel={value => `Use "${value}"`}
                  />
                </FormField>
            </ColumnLayout>
          )}
        </SpaceBetween>
      )}
    </Modal>
  );

  const interventionToDelete = interventionDeleteId
    ? proposedInterventions.find(item => idsMatch(item.id, interventionDeleteId))
    : null;
  const interventionDeleteModal = (
    <Modal
      visible={Boolean(interventionDeleteId)}
      onDismiss={() => setInterventionDeleteId(null)}
      header="Delete intervention?"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            onClick={confirmInterventionDelete}
            disabled={isFormLocked}
          >
            Delete intervention
          </Button>
          <Button variant="normal" onClick={() => setInterventionDeleteId(null)}>Cancel</Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        <Alert type="warning" statusIconAriaLabel="Warning">
          Deleting this intervention will remove all cost items linked to it.
        </Alert>
        <Box>
          {interventionToDelete
            ? `Delete ${resolveInterventionLabel(interventionToDelete.code) || "this intervention"}?`
            : "Delete this intervention?"}
        </Box>
      </SpaceBetween>
    </Modal>
  );

  const costLineDraft = costLineModal.draft || null;
  const costLineMode = costLineModal.mode;
  const isCostLineEditable = costLineMode === "add" || costLineMode === "edit";
  const costLineIntervention = costLineModal.interventionId
    ? proposedInterventions.find(item => idsMatch(item.id, costLineModal.interventionId))
    : null;
  const costLineTypeOptions = costLineIntervention ? buildCostItemOptions(costLineIntervention) : [];
  const costLineTypeLabel = costLineDraft
    ? paymentTypeLabelLookup.get(costLineDraft.type) || costLineDraft.type || ""
    : "";
  const costLineRecurrenceMode = getRecurrenceModeForType(costLineDraft?.type);
  const costLineRecurrenceRequired = costLineRecurrenceMode === RECURRENCE_MODE_REQUIRED;
  const costLineRecurrenceDisabled = costLineRecurrenceMode === RECURRENCE_MODE_NOT_ALLOWED;
  const costLineRecurrenceEnabled = costLineRecurrenceDisabled
    ? false
    : costLineRecurrenceRequired || Boolean(costLineDraft?.recurrence?.enabled);
  const costLineAmountDisplay = costLineDraft
    ? (isCostLineEditable
      ? sanitizeCurrencyInput(costLineDraft.amount)
      : getCurrencyInputDisplayValue(parseCurrencyInput(costLineDraft.amount) ?? "", false))
    : "";
  const costLineAmountPerPeriodDisplay = costLineDraft
    ? (isCostLineEditable
      ? sanitizeCurrencyInput(costLineDraft.recurrence?.amountPerPeriod)
      : getCurrencyInputDisplayValue(parseCurrencyInput(costLineDraft.recurrence?.amountPerPeriod) ?? "", false))
    : "";
  const costLineRecurrenceStart =
    costLineDraft?.recurrence?.startDate || costLineIntervention?.startDate || "";
  const costLineRecurrenceEnd =
    costLineDraft?.recurrence?.endDate || costLineIntervention?.endDate || "";

  const costLineModalContent = (
    <Modal
      visible={costLineModal.visible}
      onDismiss={resetCostLineModal}
      header={costLineMode === "add" ? "Add cost item" : "Cost item details"}
      footer={
        costLineMode === "view" ? (
          <SpaceBetween direction="horizontal" size="xs">
            {!isFormLocked && (
              <Button variant="primary" onClick={() => setCostLineModal(prev => ({ ...prev, mode: "edit" }))}>Edit</Button>
            )}
            {!isFormLocked && (
              <Button
                variant="normal"
                onClick={() => {
                  if (!costLineModal.interventionId || !costLineModal.lineId) return;
                  removeCostLine(costLineModal.interventionId, costLineModal.lineId);
                  resetCostLineModal();
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="link" onClick={resetCostLineModal}>Close</Button>
          </SpaceBetween>
        ) : (
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={commitCostLine}
              disabled={isFormLocked}
            >
              {costLineMode === "add" ? "Add cost item" : "Save changes"}
            </Button>
            <Button variant="link" onClick={resetCostLineModal}>Cancel</Button>
          </SpaceBetween>
        )
      }
    >
      {costLineDraft && (
        <SpaceBetween size="m">
          <FormField label="Cost item" errorText={costLineModalErrors.type}>
            {costLineMode === "add" ? (
              <Select
                selectedOption={
                  costLineDraft.type
                    ? { value: costLineDraft.type, label: paymentTypeLabelLookup.get(costLineDraft.type) || costLineDraft.type }
                    : null
                }
                onChange={({ detail }) => updateCostLineType(detail.selectedOption?.value || "")}
                options={costLineTypeOptions}
                placeholder="Select cost item"
                readOnly={isFormLocked}
              />
            ) : (
              <Input value={costLineTypeLabel} readOnly />
            )}
          </FormField>
          <FormField label="Total amount" errorText={costLineModalErrors.amount}>
            <Input
              inputMode="decimal"
              value={costLineAmountDisplay}
              onChange={({ detail }) => updateCostLineAmount(detail.value)}
              onBlur={blurCostLineAmount}
              placeholder="0.00"
              readOnly={!isCostLineEditable || isFormLocked}
            />
          </FormField>
          <FormField label="Installments (monthly)" errorText={costLineModalErrors.recurrence}>
            <Checkbox
              checked={costLineRecurrenceEnabled}
              onChange={({ detail }) => toggleCostLineRecurrence(detail.checked)}
              disabled={
                !isCostLineEditable ||
                costLineRecurrenceRequired ||
                costLineRecurrenceDisabled ||
                isFormLocked
              }
            >
              Enable installments
            </Checkbox>
          </FormField>
          {costLineRecurrenceEnabled && (
            <SpaceBetween size="s">
              <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                <FormField label="Start date">
                  <DatePicker
                    value={costLineRecurrenceStart}
                    onChange={({ detail }) => updateCostLineRecurrenceStart(detail.value)}
                    readOnly={!isCostLineEditable || isFormLocked}
                  />
                </FormField>
                <FormField label="End date (optional)">
                  <DatePicker
                    value={costLineRecurrenceEnd}
                    onChange={({ detail }) => updateCostLineRecurrenceEnd(detail.value)}
                    readOnly={!isCostLineEditable || isFormLocked}
                  />
                </FormField>
              </Grid>
              <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                <FormField label="Number of installments">
                  <Input
                    inputMode="numeric"
                    value={costLineDraft.recurrence?.occurrences || ""}
                    onChange={({ detail }) => updateCostLineOccurrences(detail.value)}
                    readOnly={!isCostLineEditable || isFormLocked}
                  />
                </FormField>
                <FormField label="Amount per month">
                  <Input
                    inputMode="decimal"
                    value={costLineAmountPerPeriodDisplay}
                    onChange={({ detail }) => updateCostLineAmountPerPeriod(detail.value)}
                    readOnly={!isCostLineEditable || isFormLocked}
                  />
                </FormField>
              </Grid>
            </SpaceBetween>
          )}
          <FormField label="Notes (optional)">
            <Textarea
              value={costLineDraft.notes || ""}
              rows={3}
              onChange={({ detail }) => updateCostLineDraft({ notes: detail.value })}
              readOnly={!isCostLineEditable || isFormLocked}
            />
          </FormField>
        </SpaceBetween>
      )}
    </Modal>
  );

  const steps = activeStepIds
    .map(stepId => ({
      id: stepId,
      title: STEP_LABELS[stepId],
      content: {
        plan: planStepContent,
        framing: framingStepContent,
        rationale: rationaleStepContent,
        otherFunding: otherFundingStepContent,
        childcare: childcareStepContent,
        cost: costStepContent,
        docs: docsStepContent,
        review: reviewStepContent,
        decision: decisionStepContent,
      }[stepId],
      isOptional: false,
    }))
    .filter(Boolean);

  const activeStepIndex = Math.max(activeStepIds.indexOf(currentStep), 0);
  const wizardSubmitLabel = isSubmittedStatus ? "Submit Decision" : "Submit for approval";
  const wizardSubmitHandler = isSubmittedStatus ? handleSubmitDecision : handleSubmitProposal;

  return (
    <BoardItem header={
      <Header
        variant="h2"
        info={infoLink}
        actions={
          <SpaceBetween direction="horizontal" size="s">
            <Badge color="blue">{statusLabel}</Badge>
            {isEditable && !isSubmittedStatus && (
              <Button variant="primary" disabled={!isDirty} onClick={handleSave}>Save Progress</Button>
            )}
          </SpaceBetween>
        }
      >
        Propose new intervention
      </Header>
    } i18nStrings={boardItemI18nStrings} settings={
      <ButtonDropdown
        items={[{ id: "remove", text: "Remove" }]}
        ariaLabel="Board item settings"
        variant="icon"
        onItemClick={() => actions && actions.removeItem && actions.removeItem()}
      />
    }>
      <div id="intervention-assessment-widget">
        <Box variant="small" margin={{ bottom: "s" }}>
          {headerDescription}
        </Box>
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)} statusIconAriaLabel="Error">
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert type="success" dismissible onDismiss={() => setSuccessMessage("")} statusIconAriaLabel="Success">
            {successMessage}
          </Alert>
        )}
        <Wizard
          className={isPlanStepBlocked || isFramingStepBlocked ? styles.blockNext : undefined}
          activeStepIndex={activeStepIndex}
          onNavigate={async ({ detail }) => {
            const requestedStepIndex = detail?.requestedStepIndex;
            if (requestedStepIndex < 0 || requestedStepIndex >= activeStepIds.length) return;
            const requestedStepId = activeStepIds[requestedStepIndex];
            const currentIdx = activeStepIds.indexOf(currentStep);
            const movingForward = requestedStepIndex > currentIdx;
            if (movingForward && isPlanStepBlocked) {
              setAttemptedSteps(prev => ({ ...prev, plan: true }));
              setError("Create an action plan before proposing interventions.");
              return;
            }
            if (movingForward && isFramingStepBlocked) {
              setAttemptedSteps(prev => ({ ...prev, framing: true }));
              setError("Add at least one proposed intervention before continuing.");
              return;
            }
            if (movingForward) {
              setAttemptedSteps(prev => ({ ...prev, [currentStep]: true }));
              if (!validateStep(currentStep)) {
                setError("Complete required fields before continuing.");
                return;
              }
            }
            if (
              requestedStepIndex !== currentIdx &&
              !isSubmittedStatus &&
              isEditable &&
              isDirty &&
              !isSubmitting &&
              canAutoSave
            ) {
              const saveResult = await handleSave({ silent: true });
              if (!saveResult?.ok) {
                setError(saveResult?.error?.message || "Failed to save progress.");
                return;
              }
            }
            setError(null);
            setCurrentStep(requestedStepId);
          }}
          onSubmit={isEditable ? wizardSubmitHandler : undefined}
          submitButtonText={isEditable ? wizardSubmitLabel : "Read only"}
          cancelButtonText={isEditable ? "Cancel" : undefined}
          nextButtonText="Next"
          previousButtonText="Previous"
          steps={steps}
        />
        {decisionBlockerModal}
        {interventionModalContent}
        {interventionDeleteModal}
        {costLineModalContent}
      </div>
    </BoardItem>
  );
};

export default InterventionAssessmentWidget;
