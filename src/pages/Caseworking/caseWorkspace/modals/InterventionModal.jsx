import React, { useEffect, useMemo, useRef, useState } from "react";
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

const STATUS_OPTIONS = [
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

const OPEN_INTERVENTION_STATUSES = new Set(["planned", "in_progress", "suspended"]);
const IN_PROGRESS_OUTCOME = "2";
const DEFAULT_CLOSED_OUTCOME = "1";

const calculateDurationWeeks = (start, end) => {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) return null;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.round(diffDays / 7);
};

const defaultForm = {
  code: "",
  title: "",
  status: "planned",
  startDate: "",
  endDate: "",
  durationWeeks: "",
  outcome: "",
  cost: "",
  potId: "",
  fundingStream: "",
  notes: "",
  noc: "",
  nocVersion: "",
  costType: "one_time",
  recurringPeriod: "",
  recurringAmount: "",
  recurringOccurrences: "",
};

const FORM_KEYS = Object.keys(defaultForm);

const requiresNocForCode = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 6 && numeric <= 13;
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
      code: intervention.code || "",
      title: intervention.title || "",
      status: normaliseStatus(intervention.status || "planned"),
      startDate: intervention.startDate || "",
      endDate: intervention.endDate || "",
      durationWeeks: normaliseFormNumbers(intervention.durationWeeks),
      outcome: intervention.outcome || "",
      cost: normaliseFormNumbers(intervention.cost),
      potId: intervention.potId || "",
      fundingStream: intervention.fundingStream || "",
      notes: intervention.notes || "",
      noc: intervention.noc || "",
      nocVersion: intervention.nocVersion || "",
      costType: costSettings.type || "one_time",
      recurringPeriod: costSettings.period || "",
      recurringAmount: normaliseFormNumbers(costSettings.amountPerPeriod),
      recurringOccurrences: normaliseFormNumbers(costSettings.occurrences),
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

const isClosedStatusValue = status => !OPEN_INTERVENTION_STATUSES.has(normaliseStatus(status));

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
  onDismiss,
  onSubmit,
  onClose,
  canClose = false,
  startInCloseMode = false,
  readOnly = false,
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
  const [form, setForm] = useState({ ...defaultForm });
  const initialFormRef = useRef({ ...defaultForm });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closeForm, setCloseForm] = useState(buildCloseForm(intervention));

  useEffect(() => {
    if (!visible) {
      const blankForm = { ...defaultForm };
      setForm(blankForm);
      initialFormRef.current = { ...blankForm };
      setLoading(false);
      setError(null);
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
    setIsClosing(Boolean(startInCloseMode && canClose && mode === "edit"));
    setCloseForm(buildCloseForm(intervention));
  }, [visible, mode, intervention, startInCloseMode, canClose]);

  const interventionStatus = normaliseStatus(intervention?.status);
  const isClosedIntervention = ["completed", "cancelled"].includes(interventionStatus);
  const isReadOnly = Boolean(readOnly || (mode === "edit" && isClosedIntervention && !canClose));
  const modalHeader =
    mode === "edit" ? (isReadOnly ? "View intervention" : "Edit intervention") : "Add intervention";

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
      formatted.push({
        value: form.code,
        label: `${form.code} – (legacy value)`,
        disabled: true,
      });
    }
    return formatted;
  }, [codeOptions, form.code]);

  const selectedStatusOption = useMemo(
    () => STATUS_OPTIONS.find(option => option.value === form.status) || STATUS_OPTIONS[0],
    [form.status]
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

  const fundingStreamSelectOptions = useMemo(() => {
    const formatted = (Array.isArray(fundingStreamOptions) ? fundingStreamOptions : [])
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
    if (form.fundingStream && !formatted.some(option => option.value === form.fundingStream)) {
      formatted.push({
        value: form.fundingStream,
        label: `${form.fundingStream} – (legacy value)`,
        disabled: true,
      });
    }
    return formatted;
  }, [fundingStreamOptions, form.fundingStream]);

  const selectedFundingStreamOption = useMemo(
    () => fundingStreamSelectOptions.find(option => option.value === form.fundingStream) || null,
    [fundingStreamSelectOptions, form.fundingStream]
  );

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

  const costInputValue = useMemo(() => {
    if (isRecurringCost) {
      return recurringTotal !== null ? recurringTotal.toFixed(2) : "";
    }
    return form.cost;
  }, [isRecurringCost, recurringTotal, form.cost]);

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
      } else if (value === "recurring" && !next.recurringPeriod) {
        next.recurringPeriod = "weekly";
      }
    }

    if (field === "startDate" || field === "endDate") {
      const duration = calculateDurationWeeks(
        field === "startDate" ? value : next.startDate,
        field === "endDate" ? value : next.endDate
      );
      if (duration !== null) {
        next.durationWeeks = String(duration);
      } else if (!next.durationWeeks) {
        next.durationWeeks = "";
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
        setError("Actual amount must be a number.");
        return;
      }
      if (numeric < 0) {
        setError("Actual amount cannot be negative.");
        return;
      }
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
    const statusNormalized = normaliseStatus(form.status);
    const outcomeValue = ensureOutcomeForStatus(statusNormalized, form.outcome);
    const trimmedCode = form.code.trim();
    const trimmedTitle = form.title.trim();
    if (!trimmedCode) {
      setError("Intervention code is required.");
      return;
    }
    if (!trimmedTitle) {
      setError("Intervention title is required.");
      return;
    }
    if (!form.fundingStream) {
      setError("Funding stream is required.");
      return;
    }
    if (requiresNoc) {
      if (!form.nocVersion) {
        setError("Select a NOC version for this intervention.");
        return;
      }
      if (!form.noc.trim()) {
        setError("Select a NOC code for this intervention.");
        return;
      }
      const expectedLength = form.nocVersion === "2021" ? 5 : 4;
      const nocValue = form.noc.trim();
      if (nocValue.length !== expectedLength || !/^\d+$/.test(nocValue)) {
        setError(`NOC code must be a ${expectedLength}-digit numeric value for version ${form.nocVersion}.`);
        return;
      }
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError("End date cannot be before start date.");
      return;
    }

    const durationValue =
      form.durationWeeks === "" ? null : Number(form.durationWeeks.replace(/\s+/g, ""));
    if (form.durationWeeks !== "" && !Number.isFinite(durationValue)) {
      setError("Duration (weeks) must be a number.");
      return;
    }
    if (Number.isFinite(durationValue) && durationValue < 0) {
      setError("Duration (weeks) cannot be negative.");
      return;
    }

    const costValue = form.cost === "" ? null : Number(form.cost.replace(/\s+/g, ""));
    if (form.cost !== "" && !Number.isFinite(costValue)) {
      setError("Cost must be a number.");
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
      durationWeeks: durationValue,
      outcome: outcomeValue,
      cost: costValue,
      potId: form.potId.trim() || null,
      fundingStream: form.fundingStream.trim() || null,
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
        {error && (
          <Alert type="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <SpaceBetween size="xl">
          <SpaceBetween size="s">
            <Header variant="h3">Intervention details</Header>
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="Intervention code" stretch>
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
                />
              </FormField>
              <FormField label="Title" stretch>
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
                  options={STATUS_OPTIONS}
                  disabled={isReadOnly}
                />
              </FormField>
              {isClosedStatusValue(form.status) && !isClosing && (
                <FormField label="ESDC outcome">
                  <Input value={outcomeLabel} readOnly disabled />
                </FormField>
              )}
            </ColumnLayout>
          </SpaceBetween>

          <SpaceBetween size="s">
            <Header variant="h3">Schedule &amp; NOC</Header>
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="Start date">
                <DatePicker
                  value={form.startDate}
                  onChange={({ detail }) => handleChange("startDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                  disabled={isReadOnly}
                />
              </FormField>
              <FormField label="End date">
                <DatePicker
                  value={form.endDate}
                  onChange={({ detail }) => handleChange("endDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                  disabled={isReadOnly}
                />
              </FormField>
              <FormField label="Duration (weeks)">
                <Input
                  value={form.durationWeeks}
                  onChange={({ detail }) => handleChange("durationWeeks", detail.value)}
                  placeholder="e.g. 16"
                  readOnly={isReadOnly}
                  disabled={isReadOnly}
                />
              </FormField>
              <FormField label="NOC version">
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
                  disabled={isReadOnly || !requiresNoc || nocVersionsLoading}
                />
              </FormField>
              <FormField
                label="NOC code"
                description={
                  requiresNoc
                    ? "Search by code or title to select the matching NOC entry."
                    : "Not required for this intervention code."
                }
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
                  placeholder={
                    requiresNoc
                      ? nocVersionsLoading
                        ? "Select a NOC version first"
                        : "Type to search NOC codes"
                      : "Not required for this intervention"
                  }
                  empty={
                    requiresNoc
                      ? "No NOC matches found."
                      : "NOC search not required for this intervention code."
                  }
                  disabled={isReadOnly || !requiresNoc || nocVersionsLoading || !form.nocVersion}
                  enteredTextLabel={value => `Use "${value}"`}
                  onLoadItems={({ detail }) => {
                    fetchNocSuggestions(detail.filteringText);
                  }}
                />
              </FormField>
            </ColumnLayout>
          </SpaceBetween>

          <SpaceBetween size="s">
            <Header variant="h3">Financial details</Header>
            <ColumnLayout columns={3} variant="text-grid">
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
              <FormField
                label="Cost"
                description={
                  isRecurringCost
                    ? "Total submitted to ESDC. Update the recurring schedule to adjust this amount."
                    : undefined
                }
              >
              <Input
                value={costInputValue}
                onChange={({ detail }) => handleChange("cost", detail.value)}
                placeholder="e.g. 42000"
                readOnly={isReadOnly || isRecurringCost}
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
                      value={form.recurringAmount}
                      onChange={({ detail }) => handleChange("recurringAmount", detail.value)}
                      placeholder="e.g. 150.00"
                      readOnly={isReadOnly}
                      disabled={isReadOnly}
                    />
                  </FormField>
                  <FormField
                    label="Number of occurrences"
                    description="Defaults will align with start/end dates in a future update."
                  >
                    <Input
                      value={form.recurringOccurrences}
                    onChange={({ detail }) => handleChange("recurringOccurrences", detail.value)}
                    placeholder="e.g. 20"
                    readOnly={isReadOnly}
                    disabled={isReadOnly}
                  />
                </FormField>
              </>
            )}
            <FormField
              label="Budget pot"
              description="Budget pot lookup will be enabled in an upcoming patch."
            >
              <Input
                value={form.potId}
                onChange={({ detail }) => handleChange("potId", detail.value)}
                readOnly={isReadOnly}
                disabled={isReadOnly}
              />
            </FormField>
            <FormField label="Funding stream">
              <Select
                selectedOption={selectedFundingStreamOption}
                onChange={({ detail }) => handleChange("fundingStream", detail.selectedOption?.value || "")}
                options={fundingStreamSelectOptions}
                filteringType="auto"
                placeholder={fundingStreamsLoading ? "Loading funding streams" : "Select funding stream"}
                statusType={fundingStreamsLoading ? "loading" : "finished"}
                empty={
                  fundingStreamsLoading ? undefined : "No funding streams available. Please try again later."
                }
                disabled={isReadOnly || fundingStreamsLoading}
              />
            </FormField>
          </ColumnLayout>
        </SpaceBetween>
          <SpaceBetween size="s">
            <Header variant="h3">Notes</Header>
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
          {mode === "edit" && canClose && isClosing && (
            <SpaceBetween size="s">
              <Header variant="h3">Close intervention</Header>
              <Alert type={isDirty ? "warning" : "info"}>
                {isDirty
                  ? "Save your pending changes before closing this intervention."
              : "Select an outcome above, choose the final status, and capture completion details to record this intervention."}
            </Alert>
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="ESDC outcome">
                <Select
                  selectedOption={selectedCloseOutcomeOption}
                  onChange={({ detail }) =>
                    handleCloseChange("outcome", detail.selectedOption?.value || "")
                  }
                  options={outcomeSelectOptions}
                  filteringType="auto"
                />
              </FormField>
              <FormField label="Closure status">
                <Select
                  selectedOption={selectedCloseStatusOption}
                  onChange={({ detail }) =>
                    handleCloseChange("status", detail.selectedOption?.value || "completed")
                    }
                    options={CLOSE_STATUS_OPTIONS}
                  />
                </FormField>
                <FormField
                  label="Completion date"
                  description="Defaults to the planned end date if left blank."
                >
                  <DatePicker
                    value={closeForm.completionDate}
                    onChange={({ detail }) => handleCloseChange("completionDate", detail.value)}
                    placeholder="YYYY-MM-DD"
                  />
                </FormField>
                <FormField
                  label="Actual amount"
                  description="Leave blank if not applicable."
                >
                  <Input
                    value={closeForm.actualAmount}
                    onChange={({ detail }) => handleCloseChange("actualAmount", detail.value)}
                    placeholder="e.g. 4200"
                  />
                </FormField>
              </ColumnLayout>
            </SpaceBetween>
          )}
          <Box color="text-body-secondary" fontSize="body-s">
            All fields can be updated while the intervention remains in a planned or in-progress state. Use "Close intervention" to record the final outcome and actual spend.
          </Box>
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default InterventionModal;
