import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autosuggest,
  Box,
  Button,
  ColumnLayout,
  DatePicker,
  FormField,
  Header,
  Input,
  Modal,
  RadioGroup,
  Select,
  SpaceBetween,
  Textarea,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../../auth/apiClient.js";
import useCurrentUser from "../../../../hooks/useCurrentUser.js";
import { formatCurrencyDisplay, getCurrencyInputDisplayValue } from "../../../../utils/currencyFormat.js";

const BASE_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "suspended", label: "Suspended" },
];

const CLOSE_STATUS_OPTIONS = [
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const RECURRING_PERIOD_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const OPEN_INTERVENTION_STATUSES = new Set([
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "rejected",
  "planned",
  "in_progress",
  "suspended",
  "ready_to_close",
]);
const CLOSED_INTERVENTION_STATUSES = new Set(["completed", "cancelled"]);
const IN_PROGRESS_OUTCOME = "2";
const DEFAULT_CLOSED_OUTCOME = "1";
const POSTING_CONTEXT_OPTIONS = [
  { value: "external", label: "External (region/PTMA)" },
  { value: "internal", label: "Internal (NWAC)" },
];

const calculateDurationDays = (start, end) => {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) return null;
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

const defaultForm = {
  code: "",
  title: "",
  status: "planned",
  startDate: "",
  endDate: "",
  durationDays: "",
  outcome: "",
  cost: "",
  fundingStream: "",
  notes: "",
  noc: "",
  nocVersion: "",
  costType: "one_time",
  recurringPeriod: "",
  recurringAmount: "",
  recurringOccurrences: "",
  postingContext: "external",
};

const FORM_KEYS = Object.keys(defaultForm);

const requiresNocForCode = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 6 && numeric <= 13;
};

const CANONICAL_INTERVENTION_LABELS = {
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

const pickDefaultNocVersion = options => {
  if (!Array.isArray(options) || options.length === 0) return "";
  const preferred = options.find(option => option?.value === "2021");
  return preferred?.value || options[0]?.value || "";
};

const normaliseFormNumbers = value =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : "";

const buildInitialForm = (mode, intervention) => {
  if (mode === "edit" && intervention) {
    const costSettings = intervention.metadata?.costSettings || {};
    return {
      code: intervention.code ? String(intervention.code) : "",
      title: intervention.title || "",
      status: normaliseStatus(intervention.status || "planned"),
      startDate: intervention.startDate || "",
      endDate: intervention.endDate || "",
      durationDays: intervention.endDate ? normaliseFormNumbers(intervention.durationDays) : "",
      outcome: intervention.outcome || "",
      cost: normaliseFormNumbers(intervention.cost),
      fundingStream: intervention.fundingStream || "",
      notes: intervention.notes || "",
      noc: intervention.noc || "",
      nocVersion: intervention.nocVersion || "",
      costType: costSettings.type || "one_time",
      recurringPeriod: costSettings.period || "",
      recurringAmount: normaliseFormNumbers(costSettings.amountPerPeriod),
      recurringOccurrences: normaliseFormNumbers(costSettings.occurrences),
      postingContext: intervention.postingContext || intervention.metadata?.postingContext || "external",
    };
  }
  return { ...defaultForm };
};

const normaliseStatus = value => {
  if (!value) return "planned";
  const status = String(value).trim().toLowerCase();
  if (["inprogress", "in-progress"].includes(status)) return "in_progress";
  if (["planned", "planning", "draft"].includes(status)) return "planned";
  if (["suspended", "on-hold", "on_hold"].includes(status)) return "suspended";
  if (["completed", "complete", "closed"].includes(status)) return "completed";
  if (["cancelled", "canceled"].includes(status)) return "cancelled";
  return status;
};

const formatStatusLabel = value =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());

const isClosedStatusValue = status => CLOSED_INTERVENTION_STATUSES.has(normaliseStatus(status));

const ensureOutcomeForStatus = (status, currentOutcome) => {
  const normalized = normaliseStatus(status);
  if (OPEN_INTERVENTION_STATUSES.has(normalized)) {
    return IN_PROGRESS_OUTCOME;
  }
  if (currentOutcome && currentOutcome !== IN_PROGRESS_OUTCOME) {
    return String(currentOutcome).trim();
  }
  return DEFAULT_CLOSED_OUTCOME;
};

const buildCloseForm = intervention => {
  const resolvedStatus =
    normaliseStatus(intervention?.status) === "cancelled" ? "cancelled" : "completed";
  const resolvedOutcome =
    intervention?.outcome && intervention?.outcome !== IN_PROGRESS_OUTCOME
      ? String(intervention.outcome).trim()
      : DEFAULT_CLOSED_OUTCOME;
  const actualCandidates = [
    intervention?.actualAmount,
    intervention?.metadata?.actualAmount,
  ];
  let actualAmount = "";
  for (const candidate of actualCandidates) {
    if (candidate === null || typeof candidate === "undefined") continue;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) {
      actualAmount = String(numeric);
      break;
    }
  }
  return {
    status: resolvedStatus,
    outcome: resolvedOutcome,
    completionDate: intervention?.endDate || "",
    actualAmount,
  };
};

const InterventionModal = ({
  visible,
  mode = "create",
  intervention = null,
  plan = null,
  onDismiss,
  onSubmit,
  onClose,
  canClose = false,
  startInCloseMode = false,
  readOnly = false,
  planStartDate = "",
  codeOptions = [],
  codesLoading = false,
  outcomeOptions = [],
  outcomesLoading = false,
  fundingStreamOptions = [],
  fundingStreamsLoading = false,
  nocVersions = [],
  nocVersionsLoading = false,
  onSearchNocCodes = () => Promise.resolve([]),
}) => {
  const currentUser = useCurrentUser();
  const role = currentUser?.role ? currentUser.role : null;
  const canonicalRole = role === "Regional Manager" ? "Regional Coordinator" : role;
  const isAssessor = canonicalRole === "Application Assessor";
  const canSelectPostingContext = canonicalRole === "Regional Coordinator" || canonicalRole === "Program Administrator";
  const [form, setForm] = useState({ ...defaultForm });
  const initialFormRef = useRef({ ...defaultForm });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showCloseGuidance, setShowCloseGuidance] = useState(true);
  const [closeForm, setCloseForm] = useState(buildCloseForm(intervention));
  const [potOptions, setPotOptions] = useState([]);
  const inheritedBudgetPot = plan?.budgetPot || plan?.budget_pot || "";
  const inheritedFundingStream = plan?.fundingStream || plan?.funding_stream || "";

  useEffect(() => {
    if (!visible) {
      const blankForm = { ...defaultForm };
      setForm(blankForm);
      initialFormRef.current = { ...blankForm };
      setLoading(false);
      setError(null);
      setValidationError(null);
      setFieldErrors({});
      setNocSuggestions([]);
      setNocSuggestionsLoading(false);
      setIsClosing(false);
      setCloseForm(buildCloseForm(null));
      return;
    }

    const baseForm = buildInitialForm(mode, intervention);
    const prepared = (() => {
      const draft = { ...defaultForm, ...baseForm };
      if (!requiresNocForCode(draft.code)) {
        draft.noc = "";
        draft.nocVersion = "";
      }
      // Inherit funding stream from plan (read-only) if provided.
      if (plan) {
        draft.fundingStream = inheritedFundingStream || "";
        draft.postingContext = plan?.postingContext || plan?.posting_context || draft.postingContext;
      }
      return draft;
    })();

    prepared.status = normaliseStatus(prepared.status);
    prepared.outcome = ensureOutcomeForStatus(prepared.status, prepared.outcome);

    initialFormRef.current = { ...prepared };
    setForm(prepared);
    setLoading(false);
    setError(null);
    setNocSuggestions([]);
    setNocSuggestionsLoading(false);
    const isClosed = intervention && isClosedStatusValue(intervention.status);
    setIsClosing(Boolean((startInCloseMode && canClose && mode === "edit") || (mode === "edit" && isClosed)));
    setCloseForm(buildCloseForm(intervention));
  }, [visible, mode, intervention, startInCloseMode, canClose, plan, inheritedFundingStream]);

  useEffect(() => {
    if (!isAssessor) return;
    if (form.postingContext !== "external") {
      setForm(current => ({ ...current, postingContext: "external" }));
    }
  }, [isAssessor, form.postingContext]);

  useEffect(() => {
    let cancelled = false;
    const loadPots = async () => {
      if (!visible) {
        setPotOptions([]);
        return;
      }
      try {
        let resp = await apiFetch("/api/reference/budget-pots-lite?chargeableOnly=0");
        if (!resp || !resp.ok) {
          resp = await apiFetch("/api/reference/budget-pots-lite?chargeableOnly=0");
        }
        const data = resp && resp.ok ? await resp.json() : [];
        if (cancelled) return;
        const isFundingStream = pot => {
          const potType =
            pot?.pot_type ??
            pot?.potType ??
            pot?.type ??
            pot?.nodeType ??
            pot?.metadata?.pot_type ??
            pot?.metadata?.nodeType ??
            "";
          const norm = String(potType).trim().toLowerCase().replace(/[_\s]+/g, " ");
          return norm === "funding stream";
        };
        const opts = (Array.isArray(data) ? data : [])
          .filter(isFundingStream)
          .map(item => {
            const value = item?.id ?? item?.value ?? item?.code ?? null;
            if (!value) return null;
            const code = item?.code || "";
            const name = item?.name || item?.description || "";
            const inactiveBadge = item?.isActive === false ? " (inactive)" : "";
            const label = [code, name].filter(Boolean).join(" - ") + inactiveBadge || String(value);
            return {
              value: String(value),
              label: label || String(value),
              description: name || undefined,
            };
          })
          .filter(Boolean);
        setPotOptions(opts);
      } catch (_) {
        if (!cancelled) setPotOptions([]);
      }
    };
    loadPots();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (isClosing) {
      setShowCloseGuidance(true);
    }
  }, [isClosing]);

  const interventionStatus = normaliseStatus(intervention?.status);
  const isClosedIntervention = ["completed", "cancelled"].includes(interventionStatus);
  const isReadOnly = Boolean(readOnly || (mode === "edit" && isClosedIntervention && !canClose));
  const modalHeader =
    mode === "edit" ? (isReadOnly ? "View intervention" : "Edit intervention") : "Add intervention";
  useEffect(() => {
    if (!visible) return;
    if (mode !== "edit") return;
    if (intervention && isClosedStatusValue(intervention.status)) {
      setIsClosing(true);
    }
  }, [visible, mode, intervention]);

  const selectOptions = useMemo(() => {
    const formatted = (Array.isArray(codeOptions) ? codeOptions : [])
      .map(item => {
        if (!item) return null;
        const value = item.code ? String(item.code).trim() : null;
        const label = item.label ? String(item.label).trim() : null;
        if (!value || !label) return null;
        const padded = value.length === 1 ? `0${value}` : value;
        return {
          value,
          label: `${padded} – ${label}`,
        };
      })
      .filter(Boolean);
    if (form.code && !formatted.some(option => option.value === form.code)) {
      const fallbackLabel = CANONICAL_INTERVENTION_LABELS[String(form.code)] || "(legacy value)";
      formatted.push({
        value: form.code,
        label: `${form.code} – ${fallbackLabel}`,
        disabled: true,
      });
    }
    return formatted;
  }, [codeOptions, form.code]);

  const statusOptions = useMemo(() => {
    const options = [...BASE_STATUS_OPTIONS];
    const current = normaliseStatus(form.status);
    if (current && !options.some(option => option.value === current)) {
      options.push({ value: current, label: formatStatusLabel(current), disabled: true });
    }
    return options;
  }, [form.status]);

  const selectedStatusOption = useMemo(
    () => statusOptions.find(option => option.value === normaliseStatus(form.status)) || statusOptions[0],
    [statusOptions, form.status]
  );

  const selectedCloseStatusOption = useMemo(
    () => CLOSE_STATUS_OPTIONS.find(option => option.value === closeForm.status) || CLOSE_STATUS_OPTIONS[0],
    [closeForm.status]
  );

  const selectedCodeOption = useMemo(
    () => selectOptions.find(option => option.value === form.code) || null,
    [selectOptions, form.code]
  );

  const requiresNoc = useMemo(() => {
    const numeric = Number(form.code);
    return Number.isFinite(numeric) && numeric >= 6 && numeric <= 13;
  }, [form.code]);

  const outcomeSelectOptions = useMemo(() => {
    const formatted = (Array.isArray(outcomeOptions) ? outcomeOptions : [])
      .map(item => {
        if (!item) return null;
        const value = item.code ? String(item.code).trim() : null;
        const label = item.label ? String(item.label).trim() : null;
        if (!value || !label) return null;
        const padded = value.length === 1 ? `0${value}` : value;
        return {
          value,
          label: `${padded} - ${label}`,
        };
      })
      .filter(Boolean);

    if (form.outcome && !formatted.some(option => option.value === form.outcome)) {
      formatted.push({
        value: form.outcome,
        label: `${form.outcome} - (legacy value)`,
        disabled: true,
      });
    }

    return formatted;
  }, [outcomeOptions, form.outcome]);

  const selectedCloseOutcomeOption = useMemo(
    () => outcomeSelectOptions.find(option => option.value === closeForm.outcome) || null,
    [outcomeSelectOptions, closeForm.outcome]
  );

  const outcomeLabel = useMemo(() => {
    if (!form.outcome) return "";
    const match = outcomeSelectOptions.find(option => option.value === form.outcome);
    return match ? match.label : form.outcome;
  }, [form.outcome, outcomeSelectOptions]);

  const nocVersionOptions = useMemo(() => {
    const formatted = (Array.isArray(nocVersions) ? nocVersions : [])
      .map(item => {
        if (!item) return null;
        const value = item.code ? String(item.code).trim() : null;
        const label = item.label ? String(item.label).trim() : null;
        if (!value || !label) return null;
        return {
          value,
          label: `${value} – ${label}`,
          description: item.description || null,
        };
      })
      .filter(Boolean);
    if (form.nocVersion && !formatted.some(option => option.value === form.nocVersion)) {
      formatted.push({
        value: form.nocVersion,
        label: `${form.nocVersion} – (legacy value)`,
        disabled: true,
      });
    }
    return formatted;
  }, [nocVersions, form.nocVersion]);

  const selectedNocVersionOption = useMemo(
    () => nocVersionOptions.find(option => option.value === form.nocVersion) || null,
    [nocVersionOptions, form.nocVersion]
  );

  const inheritedBudgetPotLabel = useMemo(() => {
    const match = potOptions.find(opt => String(opt.value) === String(inheritedBudgetPot));
    return match?.label || (inheritedBudgetPot ? String(inheritedBudgetPot) : "Not set");
  }, [potOptions, inheritedBudgetPot]);
  const selectedPostingContext = useMemo(
    () => POSTING_CONTEXT_OPTIONS.find(option => option.value === form.postingContext) || POSTING_CONTEXT_OPTIONS[0],
    [form.postingContext]
  );

  const isRecurringCost = form.costType === "recurring";

  const selectedRecurrencePeriodOption = useMemo(
    () => RECURRING_PERIOD_OPTIONS.find(option => option.value === form.recurringPeriod) || null,
    [form.recurringPeriod]
  );

  const recurringAmountNumber = Number(form.recurringAmount);
  const recurringOccurrencesNumber = Number(form.recurringOccurrences);
  const recurringTotal = useMemo(() => {
    if (!isRecurringCost) return null;
    if (!Number.isFinite(recurringAmountNumber) || !Number.isFinite(recurringOccurrencesNumber)) {
      return null;
    }
    const total = recurringAmountNumber * recurringOccurrencesNumber;
    if (!Number.isFinite(total)) return null;
    return total;
  }, [isRecurringCost, recurringAmountNumber, recurringOccurrencesNumber]);

  const autoOccurrencesFromDates = useCallback((startDate, endDate, period) => {
    if (!startDate || !endDate || !period) return null;
    const parseIsoParts = (value) => {
      const raw = String(value || "").trim();
      const parts = raw.split("-");
      if (parts.length !== 3) return null;
      const [year, month, day] = parts.map(part => Number.parseInt(part, 10));
      if (![year, month, day].every(Number.isFinite)) return null;
      return { year, month, day };
    };
    const startParts = parseIsoParts(startDate);
    const endParts = parseIsoParts(endDate);
    if (!startParts || !endParts) return null;
    const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
    const endUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
    if (!Number.isFinite(startUtc) || !Number.isFinite(endUtc)) return null;
    if (endUtc < startUtc) return null;
    const monthCount =
      (endParts.year - startParts.year) * 12 +
      (endParts.month - startParts.month) +
      1;
    if (period === "monthly") return Math.max(1, monthCount);
    if (period === "quarterly") return Math.max(1, Math.ceil(monthCount / 3));
    const diffDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
    if (!Number.isFinite(diffDays) || diffDays < 1) return null;
    const periodDays = period === "bi_weekly" ? 14 : period === "weekly" ? 7 : null;
    if (!periodDays) return null;
    return Math.max(1, Math.ceil(diffDays / periodDays));
  }, []);

  useEffect(() => {
    if (!isRecurringCost) return;
    if (recurringTotal === null) return;
    const formatted = recurringTotal.toFixed(2);

    setForm(current => {
      const currentCost = current.cost ?? "";
      const initialCost = initialFormRef.current.cost ?? "";
      const hasOtherDifferences = FORM_KEYS.some(key => {
        if (key === "cost") return false;
        return (current[key] ?? "") !== (initialFormRef.current[key] ?? "");
      });

      if (currentCost === formatted) {
        if (!hasOtherDifferences && initialCost !== formatted) {
          initialFormRef.current = { ...initialFormRef.current, cost: formatted };
        }
        return current;
      }

      const next = { ...current, cost: formatted };
      if (!hasOtherDifferences) {
        initialFormRef.current = { ...initialFormRef.current, cost: formatted };
      }
      return next;
    });
  }, [isRecurringCost, recurringTotal]);
  useEffect(() => {
    if (!isRecurringCost) return;
    if (!form.startDate || !form.endDate || !form.recurringPeriod) return;
    const nextOccurrences = autoOccurrencesFromDates(form.startDate, form.endDate, form.recurringPeriod);
    if (nextOccurrences === null) return;
    if (String(nextOccurrences) === String(form.recurringOccurrences || "")) return;
    setForm(current => ({ ...current, recurringOccurrences: String(nextOccurrences) }));
  }, [isRecurringCost, form.startDate, form.endDate, form.recurringPeriod, form.recurringOccurrences, autoOccurrencesFromDates]);

  const costInputValue = useMemo(() => {
    if (isRecurringCost) {
      return recurringTotal !== null ? recurringTotal.toFixed(2) : "";
    }
    return form.cost;
  }, [isRecurringCost, recurringTotal, form.cost]);
  const formattedCostDisplay = useMemo(() => {
    return formatCurrencyDisplay(costInputValue);
  }, [costInputValue]);
  const [isCostFocused, setIsCostFocused] = useState(false);
  const [isRecurringAmountFocused, setIsRecurringAmountFocused] = useState(false);

  const formattedRecurringAmount = useMemo(() => {
    return formatCurrencyDisplay(form.recurringAmount);
  }, [form.recurringAmount]);
  const [isActualCostFocused, setIsActualCostFocused] = useState(false);

const applyFieldSideEffects = (draft, field, value) => {
  const next = { ...draft, [field]: value };

    if (field === "code") {
      if (!requiresNocForCode(value)) {
        next.noc = "";
        next.nocVersion = "";
      } else if (!next.nocVersion) {
        const defaultVersion = pickDefaultNocVersion(nocVersionOptions);
        if (defaultVersion) {
          next.nocVersion = defaultVersion;
        }
      }
    }

    if (field === "nocVersion") {
      next.noc = "";
    }

    if (field === "costType") {
      if (value === "one_time") {
        next.recurringPeriod = "";
        next.recurringAmount = "";
        next.recurringOccurrences = "";
      } else if (value === "recurring") {
        if (!next.recurringPeriod) {
          next.recurringPeriod = "weekly";
        }
      }
    }

    if (field === "startDate" || field === "endDate") {
      const start = field === "startDate" ? value : next.startDate;
      const end = field === "endDate" ? value : next.endDate;
      const duration = calculateDurationDays(start, end);
      next.durationDays = duration !== null ? String(duration) : "";
      if (next.costType === "recurring") {
        const occurrences = autoOccurrencesFromDates(start, end, next.recurringPeriod);
        if (occurrences !== null) {
          next.recurringOccurrences = String(occurrences);
        }
      }
    }

    if (next.costType !== "recurring") {
      next.recurringPeriod = "";
      next.recurringAmount = "";
      next.recurringOccurrences = "";
    }

    next.status = normaliseStatus(next.status);
    next.outcome = ensureOutcomeForStatus(next.status, next.outcome);

  return next;
};

  const handleChange = (field, value) => {
    if (isReadOnly) return;
    setForm(current => {
      const next = applyFieldSideEffects(current, field, value);
      if (field === "code" || field === "nocVersion") {
        setNocSuggestions([]);
        setNocSuggestionsLoading(false);
      }
      return next;
    });
  };

  const handleCloseChange = (field, value) => {
    if (isReadOnly) return;
    setCloseForm(current => {
      const nextValue =
        field === "status" ? normaliseStatus(value) : typeof value === "string" ? value.trim() : value;
      return { ...current, [field]: nextValue };
    });
  };

  const fetchNocSuggestions = async filteringText => {
    if (isReadOnly) {
      setNocSuggestions([]);
      return;
    }
    if (!requiresNoc) {
      setNocSuggestions([]);
      return;
    }
    const versionCode = form.nocVersion || "";
    if (!versionCode) {
      setNocSuggestions([]);
      return;
    }
    const query = (filteringText || "").trim();
    if (!query) {
      setNocSuggestions([]);
      return;
    }
    setNocSuggestionsLoading(true);
    try {
      const results = await onSearchNocCodes({ query, version: versionCode });
      const options = results.map(item => ({
        value: item.code,
        label: `${item.code} – ${item.title}`,
        description: item.title,
      }));
      setNocSuggestions(options);
    } catch (searchError) {
      setError(searchError?.message || "Unable to search NOC codes.");
    } finally {
      setNocSuggestionsLoading(false);
    }
  };

  const handleCloseSubmit = async () => {
    if (!canClose || typeof onClose !== "function") {
      setError("Closing this intervention is not available.");
      return;
    }
    if (isDirty) {
      setError("Save your changes before closing this intervention.");
      return;
    }
    const outcomeValue = (closeForm.outcome || "").trim();
    if (!outcomeValue) {
      setError("Select an ESDC outcome before closing this intervention.");
      return;
    }
    const statusValue =
      closeForm.status === "cancelled" ? "cancelled" : "completed";
    const actualAmountRaw = (closeForm.actualAmount || "").trim();
    if (actualAmountRaw) {
      const numeric = Number(actualAmountRaw);
      if (!Number.isFinite(numeric)) {
        setError("Actual amount must be a whole number between 0 and 999999.");
        return;
      }
      if (!Number.isInteger(numeric) || numeric < 0 || numeric > 999999) {
        setError("Actual amount must be a whole number between 0 and 999999.");
        return;
      }
    }
    if (!closeForm.completionDate) {
      setError("Completion date is required to close this intervention.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onClose({
        status: statusValue,
        outcome: outcomeValue,
        actualAmount: actualAmountRaw ? Number(actualAmountRaw) : null,
        completionDate: closeForm.completionDate || null,
        notes: form.notes?.trim() ? form.notes.trim() : null,
      });
    } catch (closeError) {
      setError(closeError?.message || "Unable to close intervention.");
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (loading) return;
    if (isReadOnly) return;
    if (isClosing) {
      await handleCloseSubmit();
      return;
    }
    setValidationError(null);
    setFieldErrors({});
    const statusNormalized = normaliseStatus(form.status);
    const outcomeValue = ensureOutcomeForStatus(statusNormalized, form.outcome);
    const trimmedCode = (form.code ?? "").toString().trim();
    const trimmedTitle = form.title.trim();
    const errors = {};
    if (!trimmedCode) {
      errors.code = "Intervention code is required.";
    }
    if (!trimmedTitle) {
      errors.title = "Intervention title is required.";
    }
    // Funding stream is inherited from the action plan; no intervention-level validation.
    if (!form.startDate) {
      errors.startDate = "Start date is required.";
    }
    if (requiresNoc) {
      if (!form.nocVersion) {
        errors.nocVersion = "Select a NOC version for this intervention.";
      }
      if (!form.noc.trim()) {
        errors.noc = "Select a NOC code for this intervention.";
      }
      const expectedLength = form.nocVersion === "2021" ? 5 : 4;
      const nocValue = form.noc.trim();
      if (nocValue.length !== expectedLength || !/^\d+$/.test(nocValue)) {
        errors.noc = `NOC code must be a ${expectedLength}-digit numeric value for version ${form.nocVersion}.`;
      }
    }
    if (form.startDate) {
      const startDateObj = new Date(form.startDate);
      const cutoff = new Date("2000-01-01");
      if (startDateObj < cutoff) {
        errors.startDate = "Start date must be after 2000-01-01.";
      }
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      errors.endDate = "End date cannot be before start date.";
    }
    if (planStartDate) {
      const toDateOnly = value => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed.toISOString().slice(0, 10);
      };
      const planStart = toDateOnly(planStartDate);
      const interventionStart = toDateOnly(form.startDate);
      if (planStart && interventionStart && interventionStart < planStart) {
        errors.startDate = "Intervention start date cannot be before the action plan start date.";
      }
    }
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate);
      const maxEnd = new Date(form.startDate);
      maxEnd.setMonth(maxEnd.getMonth() + 60);
      const end = new Date(form.endDate);
      if (end > maxEnd) {
        errors.endDate = "End date must be within 60 months of start date.";
      }
    }

    const durationValue =
      form.durationDays === "" ? null : Number(form.durationDays.replace(/\s+/g, ""));
    if (form.durationDays !== "" && !Number.isFinite(durationValue)) {
      errors.durationDays = "Duration (days) must be a number.";
    }
    if (Number.isFinite(durationValue) && durationValue < 0) {
      errors.durationDays = "Duration (days) cannot be negative.";
    }
    if (form.endDate && durationValue === null) {
      errors.durationDays = "Duration (days) is required when an end date is provided.";
    }
    if (form.startDate && form.endDate && Number.isFinite(durationValue)) {
      const rangeDays = calculateDurationDays(form.startDate, form.endDate);
      if (rangeDays !== null && durationValue > rangeDays) {
        errors.durationDays = "Duration (days) must not exceed the span between start and end date.";
      }
      if (durationValue > 999) {
        errors.durationDays = "Duration (days) must be 0–999.";
      }
    }

    const costValue = form.cost === "" ? null : Number(form.cost.replace(/\s+/g, ""));
    if (form.cost !== "" && !Number.isFinite(costValue)) {
      errors.cost = "Cost must be a number.";
    }
    if (costValue !== null && (costValue < 0 || costValue > 999999 || !Number.isInteger(costValue))) {
      errors.cost = "Cost must be a whole number between 0 and 999999.";
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setValidationError("Please resolve the highlighted fields.");
      return;
    }

    const isRecurringCost = form.costType === "recurring";
    const cleanedRecurringAmount =
      form.recurringAmount.trim() === "" ? null : Number(form.recurringAmount.trim());
    const cleanedRecurringOccurrences =
      form.recurringOccurrences.trim() === "" ? null : Number(form.recurringOccurrences.trim());
    const costSettingsPayload = {
      type: form.costType,
      period: isRecurringCost ? form.recurringPeriod || "" : "",
      amountPerPeriod: isRecurringCost ? cleanedRecurringAmount : null,
      occurrences: isRecurringCost ? cleanedRecurringOccurrences : null,
      calculatedTotal: costValue,
    };
    const recurrencePayload = isRecurringCost
      ? {
          period: costSettingsPayload.period,
          amountPerPeriod: costSettingsPayload.amountPerPeriod,
          occurrences: costSettingsPayload.occurrences,
          calculatedTotal: costValue,
        }
      : null;

    const payload = {
      code: trimmedCode,
      title: trimmedTitle,
      status: statusNormalized,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      durationDays: durationValue,
      outcome: outcomeValue,
      cost: costValue,
      potId: inheritedBudgetPot || null,
      postingContext: form.postingContext || "external",
      fundingStream: inheritedFundingStream || null,
      notes: form.notes.trim() || null,
      noc: form.noc.trim() || null,
      nocVersion: form.nocVersion.trim() || null,
    };

    if (intervention?.metadata || isRecurringCost || form.costType !== "one_time") {
      payload.metadata = {
        ...(intervention?.metadata || {}),
        costType: form.costType,
        costSettings: costSettingsPayload,
        recurrence: recurrencePayload,
      };
    }

    setLoading(true);
    try {
      await onSubmit(payload);
    } catch (submitError) {
      if (["missing_internal_gl_code", "missing_external_gl_code", "posting_context_not_permitted"].includes(submitError?.code)) {
        setFieldErrors(prev => ({ ...prev, postingContext: submitError?.message || "Check Paid from selection." }));
        setValidationError(submitError?.message || "Check Paid from selection.");
        setLoading(false);
        return;
      }
      setError(submitError?.message || "Unable to save intervention.");
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const isDirty = useMemo(() => {
    const initial = initialFormRef.current;
    return FORM_KEYS.some(key => (form[key] ?? "") !== (initial[key] ?? ""));
  }, [form]);

  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    if (!visible) return;
    if (dirtyRef.current) return;
    if (!requiresNoc) return;
    if (form.nocVersion) return;
    const defaultVersion = pickDefaultNocVersion(nocVersionOptions);
    if (!defaultVersion) return;

    setForm(current => {
      if (current.nocVersion) return current;
      const next = { ...current, nocVersion: defaultVersion };
      initialFormRef.current = { ...initialFormRef.current, nocVersion: defaultVersion };
      return next;
    });
  }, [visible, requiresNoc, form.nocVersion, nocVersionOptions]);

  const handleCancel = () => {
    if (loading) return;
    setForm({ ...initialFormRef.current });
    setError(null);
    setValidationError(null);
    setFieldErrors({});
    setNocSuggestions([]);
    setNocSuggestionsLoading(false);
    setIsClosing(false);
    setCloseForm(buildCloseForm(intervention));
    if (typeof onDismiss === "function") {
      onDismiss();
    }
  };

  const saveDisabled =
    isReadOnly ||
    codesLoading ||
    outcomesLoading ||
    fundingStreamsLoading ||
    nocVersionsLoading ||
    loading ||
    !isDirty;

  const beginClosing = () => {
    if (!canClose || isReadOnly) return;
    if (isDirty) {
      setError("Save your changes before closing this intervention.");
      return;
    }
    setCloseForm(buildCloseForm(intervention));
    setIsClosing(true);
    setError(null);
  };

  const exitCloseMode = () => {
    setIsClosing(false);
    setError(null);
  };

  const closeDisabled =
    !isClosing ||
    loading ||
    !canClose ||
    isReadOnly ||
    !closeForm.outcome ||
    !closeForm.outcome.trim() ||
    isDirty;

  return (
    <Modal
      visible={visible}
      header={modalHeader}
      onDismiss={handleCancel}
      closeAriaLabel={
        mode === "edit"
          ? isReadOnly
            ? "Close view intervention modal"
            : "Close edit intervention modal"
          : "Close new intervention modal"
      }
      size="large"
      footer={
        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          {mode === "edit" && canClose && isClosing && !isReadOnly && (
            <Button onClick={exitCloseMode} disabled={loading}>
              Back to editing
            </Button>
          )}
          {mode === "edit" && canClose && !isClosing && !isReadOnly && (
            <Button onClick={beginClosing} disabled={loading}>
              Close intervention
            </Button>
          )}
          {!isReadOnly && (!isClosing || mode !== "edit") && (
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={saveDisabled}
            >
              {mode === "edit" ? "Save changes" : "Create intervention"}
            </Button>
          )}
          {isClosing && !isReadOnly && (
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={closeDisabled}
            >
              Close intervention
            </Button>
          )}
        </SpaceBetween>
      }
    >
      <SpaceBetween size="l">
        {(error || validationError) && (
          <Alert
            type="error"
            dismissible
            dismissAriaLabel="Dismiss error message"
            onDismiss={() => {
              setError(null);
              setValidationError(null);
            }}
          >
            {error || validationError}
          </Alert>
        )}
        <Box color="text-body-secondary" fontSize="body-s">
          All fields can be updated while the intervention remains in a planned or in-progress state. Use "Close intervention" to record the final outcome and actual spend. Activating an intervention will also activate its parent action plan if it is still in draft.
        </Box>
        {mode === "edit" && (isClosing || isClosedIntervention) && (
          <SpaceBetween size="s">
            <Header variant="h3">Close intervention</Header>
            {showCloseGuidance && isClosing && canClose && (
              <Alert
                type={isDirty ? "warning" : "info"}
                dismissible
                dismissAriaLabel="Dismiss close guidance"
                onDismiss={() => setShowCloseGuidance(false)}
              >
                {isDirty
                  ? "Save pending edits before closing. Then pick an outcome, closure status, and final amounts to record the intervention."
                  : "Choose the outcome, closure status, completion date, and actual cost (if applicable) to close this intervention."}
              </Alert>
            )}
          <ColumnLayout columns={3} variant="text-grid">
            <FormField label="ESDC outcome" description="Required to close.">
              <Select
                selectedOption={selectedCloseOutcomeOption}
                onChange={({ detail }) =>
                  handleCloseChange("outcome", detail.selectedOption?.value || "")
                }
                options={outcomeSelectOptions}
                filteringType="auto"
                disabled={isReadOnly || !canClose}
              />
            </FormField>
            <FormField label="Closure status">
              <Select
                selectedOption={selectedCloseStatusOption}
                onChange={({ detail }) =>
                  handleCloseChange("status", detail.selectedOption?.value || "completed")
                  }
                  options={CLOSE_STATUS_OPTIONS}
                disabled={isReadOnly || !canClose}
                />
              </FormField>
              <FormField
                label="Completion date"
                description="Required. Must match the final intervention end date."
              >
                <DatePicker
                  value={closeForm.completionDate}
                  onChange={({ detail }) => handleCloseChange("completionDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                  disabled={isReadOnly || !canClose}
              />
            </FormField>
            <FormField
                label="Actual cost"
                description="Whole dollars 0–999999. Leave blank if not applicable."
              >
                <Input
                  value={getCurrencyInputDisplayValue(closeForm.actualAmount, isActualCostFocused)}
                  onChange={({ detail }) => handleCloseChange("actualAmount", detail.value)}
                  onFocus={() => setIsActualCostFocused(true)}
                  onBlur={() => setIsActualCostFocused(false)}
                  placeholder="e.g. 4200"
                  disabled={isReadOnly || !canClose}
                />
              </FormField>
            </ColumnLayout>
          </SpaceBetween>
        )}

        <SpaceBetween size="xl">
          <SpaceBetween size="s">
            <Header variant="h3">Intervention details</Header>
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Title" stretch errorText={fieldErrors.title}>
                <Input
                  value={form.title}
                  onChange={({ detail }) => handleChange("title", detail.value)}
                  readOnly={isReadOnly}
                  disabled={isReadOnly}
                />
              </FormField>
              <FormField label="Status">
                <Select
                  selectedOption={selectedStatusOption}
                  onChange={({ detail }) => handleChange("status", detail.selectedOption?.value || "planned")}
                  options={statusOptions}
                  disabled={isReadOnly}
                />
              </FormField>
              {isClosedStatusValue(form.status) && !isClosing && (
                <FormField label="ESDC outcome">
                  <Input value={outcomeLabel} readOnly disabled />
                </FormField>
              )}
              <FormField label="Start date" errorText={fieldErrors.startDate}>
                <DatePicker
                  value={form.startDate}
                  onChange={({ detail }) => handleChange("startDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                  disabled={isReadOnly}
                />
              </FormField>
              <FormField label="End date" errorText={fieldErrors.endDate}>
                <DatePicker
                  value={form.endDate}
                  onChange={({ detail }) => handleChange("endDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                  disabled={isReadOnly}
                />
              </FormField>
              <FormField label="Duration in days (calculated)" errorText={fieldErrors.durationDays}>
                <Input
                  value={form.durationDays}
                  readOnly
                  disabled
                  type="number"
                />
              </FormField>
              <FormField label="Intervention code" stretch errorText={fieldErrors.code}>
                <Select
                  selectedOption={selectedCodeOption}
                  onChange={({ detail }) => handleChange("code", detail.selectedOption?.value || "")}
                  options={selectOptions}
                  filteringType="auto"
                  placeholder={codesLoading ? "Loading intervention codes" : "Select intervention code"}
                  statusType={codesLoading ? "loading" : "finished"}
                  empty={
                    codesLoading
                      ? undefined
                      : "No intervention codes available. Please try again later."
                  }
                  disabled={isReadOnly || codesLoading}
                  autoFocus={!isReadOnly}
                  invalid={Boolean(fieldErrors.code)}
                />
              </FormField>
              {requiresNoc && (
                <>
                  <FormField label="NOC version" errorText={fieldErrors.nocVersion}>
                    <Select
                      selectedOption={selectedNocVersionOption}
                      onChange={({ detail }) => {
                        const value = detail.selectedOption?.value || "";
                        setNocSuggestions([]);
                        handleChange("nocVersion", value);
                      }}
                      options={nocVersionOptions}
                      filteringType="auto"
                      placeholder={nocVersionsLoading ? "Loading NOC versions" : "Select NOC version"}
                      statusType={nocVersionsLoading ? "loading" : "finished"}
                      empty={
                        nocVersionsLoading ? undefined : "No NOC versions available. Please try again later."
                      }
                      disabled={isReadOnly || nocVersionsLoading}
                      invalid={Boolean(fieldErrors.nocVersion)}
                    />
                  </FormField>
                  <FormField
                    label="NOC code"
                    errorText={fieldErrors.noc}
                  >
                    <Autosuggest
                      value={form.noc}
                      onChange={({ detail }) => {
                        const value = detail.value || "";
                        handleChange("noc", value);
                        if (!value) {
                          setNocSuggestions([]);
                          setNocSuggestionsLoading(false);
                        } else if (value.length >= 2) {
                          fetchNocSuggestions(value);
                        }
                      }}
                      onSelect={({ detail }) => handleChange("noc", detail.value || "")}
                      options={nocSuggestions}
                      statusType={nocSuggestionsLoading ? "loading" : "finished"}
                      expandToViewport
                      placeholder={
                        nocVersionsLoading
                          ? "Select a NOC version first"
                          : "Type to search NOC codes"
                      }
                      empty="No NOC matches found."
                      disabled={isReadOnly || nocVersionsLoading || !form.nocVersion}
                      enteredTextLabel={value => `Use "${value}"`}
                      onLoadItems={({ detail }) => {
                        fetchNocSuggestions(detail.filteringText);
                      }}
                      invalid={Boolean(fieldErrors.noc)}
                    />
                  </FormField>
                </>
              )}
            </ColumnLayout>
          </SpaceBetween>

          <SpaceBetween size="s">
            <Header variant="h3">Financial details</Header>
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="Funding Stream" description="Inherited. Adjust in parent Action Plan.">
                <Input value={inheritedFundingStream || "Not set"} readOnly disabled />
              </FormField>
              <FormField label="Budget Pot" description="Inherited. Adjust in parent Action Plan.">
                <Input value={inheritedBudgetPotLabel} readOnly disabled />
              </FormField>
              <FormField
                label="Paid from"
                description="Select whether this pot is charged externally or internally."
                errorText={fieldErrors.postingContext}
              >
                {isAssessor || !canSelectPostingContext ? (
                  <Input value="External (region/PTMA)" readOnly disabled />
                ) : (
                  <Select
                    selectedOption={selectedPostingContext}
                    options={POSTING_CONTEXT_OPTIONS}
                    onChange={({ detail }) => {
                      setFieldErrors(prev => {
                        if (!prev.postingContext) return prev;
                        const next = { ...prev };
                        delete next.postingContext;
                        return next;
                      });
                      setForm(current => ({ ...current, postingContext: detail.selectedOption?.value || "external" }));
                    }}
                    placeholder="Select"
                    disabled={isReadOnly}
                  />
                )}
              </FormField>
              <FormField label="Cost type">
                <RadioGroup
                  onChange={({ detail }) => handleChange("costType", detail.value)}
                  value={form.costType}
                  items={[
                    { value: "one_time", label: "One-time total" },
                    { value: "recurring", label: "Recurring schedule" },
                  ]}
                  disabled={isReadOnly}
                />
              </FormField>
              {isRecurringCost && (
                <>
                  <FormField label="Recurrence period">
                    <Select
                      selectedOption={selectedRecurrencePeriodOption}
                      onChange={({ detail }) =>
                        handleChange("recurringPeriod", detail.selectedOption?.value || "")
                      }
                      options={RECURRING_PERIOD_OPTIONS}
                      placeholder="Select recurrence period"
                      disabled={isReadOnly}
                    />
                  </FormField>
                  <FormField label="Amount per period">
                    <Input
                      value={getCurrencyInputDisplayValue(form.recurringAmount, isRecurringAmountFocused)}
                      onChange={({ detail }) => handleChange("recurringAmount", detail.value)}
                      onFocus={() => setIsRecurringAmountFocused(true)}
                      onBlur={() => setIsRecurringAmountFocused(false)}
                      inputMode="decimal"
                      placeholder="e.g. 150.00"
                      readOnly={isReadOnly}
                      disabled={isReadOnly}
                    />
                  </FormField>
                  <FormField
                    label="Number of occurrences"
                    description="Auto-calculated from dates and recurrence."
                  >
                    <Input
                      value={form.recurringOccurrences}
                      readOnly
                      disabled
                    />
                  </FormField>
              <FormField
                label="Planned cost"
                description="Calculated total based on recurring schedule."
                errorText={fieldErrors.cost}
              >
                    <Input
                      value={formattedCostDisplay}
                      onChange={({ detail }) => handleChange("cost", detail.value)}
                      placeholder="e.g. 42000"
                      readOnly
                      disabled
                    />
                  </FormField>
                </>
              )}
              {!isRecurringCost && (
                <FormField label="Planned cost" errorText={fieldErrors.cost}>
                  <Input
                    value={getCurrencyInputDisplayValue(costInputValue, isCostFocused)}
                    onChange={({ detail }) => handleChange("cost", detail.value)}
                    onFocus={() => setIsCostFocused(true)}
                    onBlur={() => setIsCostFocused(false)}
                    placeholder="e.g. 42000"
                    readOnly={isReadOnly}
                    disabled={isReadOnly}
                  />
                </FormField>
              )}
            </ColumnLayout>
          </SpaceBetween>
          <SpaceBetween size="s">
            <FormField label="Notes">
              <Textarea
                value={form.notes}
                rows={3}
                onChange={({ detail }) => handleChange("notes", detail.value)}
                placeholder="Optional context or reminders"
                readOnly={isReadOnly}
                disabled={isReadOnly}
              />
            </FormField>
          </SpaceBetween>
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default InterventionModal;
