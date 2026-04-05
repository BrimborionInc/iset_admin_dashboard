import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autosuggest,
  Box,
  Button,
  Checkbox,
  ColumnLayout,
  DatePicker,
  FormField,
  Header,
  Input,
  Modal,
  Select,
  SpaceBetween,
  Table,
  Textarea,
} from "@cloudscape-design/components";
import {
  isEducationInterventionCode,
  isEmployerInterventionCode,
  isWageSubsidyInterventionCode,
  requiresExternalPartnerForInterventionCode,
  requiresNocForInterventionCode,
} from "../../../../utils/interventionCodeRules.js";
import {
  getAllowedBackloadInterventionStatuses,
  getBackloadInterventionPlanStatusError,
  getBackloadInterventionPlanStatusNotice,
  getBackloadInterventionStatusOptions,
  getDefaultBackloadInterventionStatus,
  normalizeActionPlanLifecycleStatus,
} from "../../../../utils/backloadInterventionRules.js";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const POSTING_CONTEXT_OPTIONS = [
  { value: "external", label: "External (region/PTMA)" },
  { value: "internal", label: "Internal (NWAC)" },
];

const PAYMENT_TYPE_OPTIONS = [
  { value: "LivingAllowance", label: "Living allowance" },
  { value: "TuitionFeesDirect", label: "Tuition fees (direct)" },
  { value: "TuitionFeesReimbursement", label: "Tuition fees (reimbursement)" },
  { value: "SpecializedEquipmentAdvance", label: "Specialized equipment (advance)" },
  { value: "SpecializedEquipmentReimbursement", label: "Specialized equipment (reimbursement)" },
  { value: "WageSubsidyEmployer", label: "Targeted wage subsidy (employer)" },
  { value: "Childcare", label: "Childcare" },
  { value: "Transportation", label: "Transportation" },
  { value: "BooksMaterialsDirect", label: "Books and materials (direct)" },
  { value: "BooksMaterialsReimbursement", label: "Books and materials (reimbursement)" },
  { value: "JCPProjectCost", label: "JCP project cost" },
  { value: "SEBSupport", label: "SEB support" },
  { value: "OtherEligibleCost", label: "Other eligible cost" },
];

const PAYEE_TYPE_OPTIONS = [
  { value: "Client", label: "Client" },
  { value: "Institution", label: "Institution" },
  { value: "Employer", label: "Employer" },
  { value: "Vendor", label: "Vendor" },
  { value: "Other", label: "Other" },
];

const NOC_VERSION_OPTIONS = [
  { value: "2016", label: "2016" },
  { value: "2021", label: "2021" },
];

const pickDefaultNocVersion = options => {
  if (!Array.isArray(options) || options.length === 0) return "";
  const preferred = options.find(option => option?.value === "2021");
  return preferred?.value || options[0]?.value || "";
};

const calculateDurationDays = (start, end) => {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0) return null;
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

const defaultCostLine = () => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type: "",
  payeeType: "",
  payeeName: "",
  payeeReference: "",
  amount: "",
  notes: "",
  recurrenceEnabled: false,
  recurrenceStartDate: "",
  recurrenceEndDate: "",
  recurrenceOccurrences: "",
  recurrenceAmountPerPeriod: "",
});

const createCostLineDraft = source => ({
  id: source?.id || defaultCostLine().id,
  type: source?.type || "",
  payeeType: source?.payeeType || "",
  payeeName: source?.payeeName || "",
  payeeReference:
    source?.payeeReference || source?.payee?.reference || "",
  amount:
    source?.amount === null || typeof source?.amount === "undefined" || source?.amount === ""
      ? ""
      : String(source.amount),
  notes: source?.notes || "",
  recurrenceEnabled: Boolean(
    source?.recurrenceEnabled ?? source?.recurrence?.enabled
  ),
  recurrenceStartDate:
    source?.recurrenceStartDate || source?.recurrence?.startDate || "",
  recurrenceEndDate:
    source?.recurrenceEndDate || source?.recurrence?.endDate || "",
  recurrenceOccurrences:
    source?.recurrenceOccurrences === null ||
    typeof source?.recurrenceOccurrences === "undefined" ||
    source?.recurrenceOccurrences === ""
      ? source?.recurrence?.occurrences === null ||
        typeof source?.recurrence?.occurrences === "undefined" ||
        source?.recurrence?.occurrences === ""
        ? ""
        : String(source.recurrence.occurrences)
      : String(source.recurrenceOccurrences),
  recurrenceAmountPerPeriod:
    source?.recurrenceAmountPerPeriod === null ||
    typeof source?.recurrenceAmountPerPeriod === "undefined" ||
    source?.recurrenceAmountPerPeriod === ""
      ? source?.recurrence?.amountPerPeriod === null ||
        typeof source?.recurrence?.amountPerPeriod === "undefined" ||
        source?.recurrence?.amountPerPeriod === ""
        ? ""
        : String(source.recurrence.amountPerPeriod)
      : String(source.recurrenceAmountPerPeriod),
});

const DEFAULT_COST_LINE_WIDTHS = [
  { id: "paymentLine", width: 340 },
  { id: "amount", width: 130 },
  { id: "actions", width: 110 },
];

const defaultForm = actionPlanId => ({
  actionPlanId: actionPlanId ? String(actionPlanId) : "",
  code: "",
  title: "",
  status: "approved",
  startDate: "",
  endDate: "",
  durationDays: "",
  outcome: "",
  plannedCost: "",
  approvedAmount: "",
  actualAmount: "",
  postingContext: "external",
  deliveryMode: "partner",
  institution: "",
  programName: "",
  itpDetails: "",
  wageSubsidyDetails: "",
  noc: "",
  nocVersion: "",
  notes: "",
  costLines: [],
});

const stripCodePrefix = value =>
  String(value || "")
    .replace(/^\s*\d+\s*[-\u2013\u2014:]\s*/, "")
    .trim();

const formatCurrencyAmount = amount => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return "—";
  return `$${numeric.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const ExistingInterventionModal = ({
  visible,
  initialActionPlanId = null,
  onDismiss,
  onCreated,
}) => {
  const {
    caseData,
    createIntervention,
    interventionCodes,
    loadInterventionCodes,
    interventionOutcomes,
    loadInterventionOutcomes,
    nocVersions,
    nocVersionsLoading,
    loadNocVersions,
    searchNocCodes,
  } = useCaseWorkspace();
  const [form, setForm] = useState(defaultForm(initialActionPlanId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [costLineModalVisible, setCostLineModalVisible] = useState(false);
  const [costLineDraft, setCostLineDraft] = useState(createCostLineDraft());
  const [editingCostLineId, setEditingCostLineId] = useState(null);
  const [costLineDraftErrors, setCostLineDraftErrors] = useState({});
  const [costLineColumnWidths, setCostLineColumnWidths] = useState(DEFAULT_COST_LINE_WIDTHS);
  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setForm(defaultForm(initialActionPlanId));
      setLoading(false);
      setError(null);
      setFieldErrors({});
      setCostLineModalVisible(false);
      setCostLineDraft(createCostLineDraft());
      setEditingCostLineId(null);
      setCostLineDraftErrors({});
      setCostLineColumnWidths(DEFAULT_COST_LINE_WIDTHS);
      setNocSuggestions([]);
      setNocSuggestionsLoading(false);
      return;
    }
    setForm(defaultForm(initialActionPlanId));
    loadInterventionCodes().catch(() => {});
    loadInterventionOutcomes().catch(() => {});
    loadNocVersions().catch(() => {});
  }, [visible, initialActionPlanId, loadInterventionCodes, loadInterventionOutcomes, loadNocVersions]);

  const selectableActionPlans = useMemo(
    () =>
      (caseData?.actionPlans || []).filter(plan => {
        if (!plan?.id) return false;
        return normalizeActionPlanLifecycleStatus(plan.status, null) !== "archived";
      }),
    [caseData?.actionPlans]
  );

  const actionPlanOptions = useMemo(
    () =>
      selectableActionPlans.map(plan => ({
        value: String(plan.id),
        label: plan.title || plan.name || `Action plan ${plan.id}`,
        description: plan.status ? String(plan.status).replace(/_/g, " ") : undefined,
      })),
    [selectableActionPlans]
  );

  const codeOptions = useMemo(
    () =>
      (Array.isArray(interventionCodes) ? interventionCodes : [])
        .map(item => {
          if (!item?.code || !item?.label) return null;
          const value = String(item.code).trim();
          const label = `${value.padStart(2, "0")} – ${String(item.label).trim()}`;
          return { value, label };
        })
        .filter(Boolean),
    [interventionCodes]
  );

  const outcomeOptions = useMemo(
    () =>
      (Array.isArray(interventionOutcomes) ? interventionOutcomes : [])
        .map(item => {
          if (!item?.code || !item?.label) return null;
          const value = String(item.code).trim();
          return { value, label: `${value.padStart(2, "0")} – ${String(item.label).trim()}` };
        })
        .filter(Boolean),
    [interventionOutcomes]
  );

  const nocVersionOptions = useMemo(
    () =>
      (Array.isArray(nocVersions) ? nocVersions : []).length
        ? nocVersions
            .map(item => {
              if (!item?.code || !item?.label) return null;
              return {
                value: String(item.code).trim(),
                label: `${String(item.code).trim()} – ${String(item.label).trim()}`,
              };
            })
            .filter(Boolean)
        : NOC_VERSION_OPTIONS,
    [nocVersions]
  );

  const selectedPlan =
    selectableActionPlans.find(plan => String(plan.id) === String(form.actionPlanId || "")) || null;
  const selectedPlanOption =
    actionPlanOptions.find(option => option.value === form.actionPlanId) || null;
  const selectedPlanStatus = normalizeActionPlanLifecycleStatus(selectedPlan?.status, null);
  const statusOptions = useMemo(
    () => getBackloadInterventionStatusOptions(selectedPlanStatus),
    [selectedPlanStatus]
  );
  const selectedCodeOption =
    codeOptions.find(option => option.value === form.code) || null;
  const selectedStatusOption =
    statusOptions.find(option => option.value === form.status) || statusOptions[0] || null;
  const selectedOutcomeOption =
    outcomeOptions.find(option => option.value === form.outcome) || null;
  const selectedPostingContext =
    POSTING_CONTEXT_OPTIONS.find(option => option.value === form.postingContext) || POSTING_CONTEXT_OPTIONS[0];
  const selectedNocVersion =
    nocVersionOptions.find(option => option.value === form.nocVersion) || null;
  const selectedDeliveryModeOption =
    form.deliveryMode === "in_house"
      ? { value: "in_house", label: "In-house (no external partner)" }
      : { value: "partner", label: "External delivery partner" };

  const isEducationIntervention = useMemo(() => isEducationInterventionCode(form.code), [form.code]);
  const isEmployerIntervention = useMemo(() => isEmployerInterventionCode(form.code), [form.code]);
  const isWageSubsidyIntervention = useMemo(() => isWageSubsidyInterventionCode(form.code), [form.code]);
  const requiresExternalPartner = useMemo(
    () => requiresExternalPartnerForInterventionCode(form.code),
    [form.code]
  );
  const requiresNoc = useMemo(() => requiresNocForInterventionCode(form.code), [form.code]);

  const isClosed = form.status === "completed" || form.status === "cancelled";
  const planStatusNotice = getBackloadInterventionPlanStatusNotice(selectedPlanStatus);

  useEffect(() => {
    if (!visible) return;
    const initialPlanId = initialActionPlanId ? String(initialActionPlanId) : "";
    const currentPlanId = String(form.actionPlanId || "");
    const hasCurrentPlan = currentPlanId && selectableActionPlans.some(plan => String(plan.id) === currentPlanId);
    const resolvedPlanId = hasCurrentPlan
      ? currentPlanId
      : (initialPlanId && selectableActionPlans.some(plan => String(plan.id) === initialPlanId)
          ? initialPlanId
          : (actionPlanOptions[0]?.value || ""));
    const resolvedPlan = selectableActionPlans.find(plan => String(plan.id) === resolvedPlanId) || null;
    const resolvedPlanStatus = normalizeActionPlanLifecycleStatus(resolvedPlan?.status, null);
    const allowedStatuses = getAllowedBackloadInterventionStatuses(resolvedPlanStatus);
    const nextStatus = allowedStatuses.includes(form.status)
      ? form.status
      : getDefaultBackloadInterventionStatus(resolvedPlanStatus);
    if (resolvedPlanId === currentPlanId && nextStatus === form.status) {
      return;
    }
    setForm(current => ({
      ...current,
      actionPlanId: resolvedPlanId,
      status: nextStatus || current.status,
      outcome:
        nextStatus && !["completed", "cancelled"].includes(nextStatus)
          ? ""
          : current.outcome,
    }));
  }, [actionPlanOptions, form.actionPlanId, form.status, form.outcome, initialActionPlanId, selectableActionPlans, visible]);

  const costLinesTotal = useMemo(() => {
    return form.costLines.reduce((sum, line) => {
      const amount = Number(line.amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }, [form.costLines]);

  useEffect(() => {
    if (!visible) return;
    if (!requiresNoc) return;
    if (form.nocVersion) return;
    const defaultVersion = pickDefaultNocVersion(nocVersionOptions);
    if (!defaultVersion) return;
    setForm(current => {
      if (current.nocVersion) return current;
      return { ...current, nocVersion: defaultVersion };
    });
  }, [visible, requiresNoc, form.nocVersion, nocVersionOptions]);

  const fetchNocSuggestions = useCallback(
    async query => {
      if (!requiresNoc || !form.nocVersion) {
        setNocSuggestions([]);
        return;
      }
      const trimmedQuery = String(query || "").trim();
      if (!trimmedQuery) {
        setNocSuggestions([]);
        return;
      }
      setNocSuggestionsLoading(true);
      try {
        const results = await searchNocCodes({ query: trimmedQuery, version: form.nocVersion });
        setNocSuggestions(
          results.map(item => ({
            value: item.code,
            label: `${item.code} – ${item.title}`,
            description: item.title,
          }))
        );
      } catch (searchError) {
        setError(searchError?.message || "Unable to search NOC codes.");
      } finally {
        setNocSuggestionsLoading(false);
      }
    },
    [form.nocVersion, requiresNoc, searchNocCodes]
  );

  const handleFieldChange = (field, value) => {
    if (field === "code" || field === "nocVersion") {
      setNocSuggestions([]);
      setNocSuggestionsLoading(false);
    }
    setForm(current => {
      const next = { ...current, [field]: value };
      if (field === "code" && !current.title) {
        const selected = codeOptions.find(option => option.value === value);
        next.title = stripCodePrefix(selected?.label || "");
      }
      const nextCode = field === "code" ? value : next.code;
      if (field === "code") {
        if (!requiresNocForInterventionCode(value)) {
          next.noc = "";
          next.nocVersion = "";
        } else if (!current.nocVersion) {
          const defaultVersion = pickDefaultNocVersion(nocVersionOptions);
          if (defaultVersion) {
            next.nocVersion = defaultVersion;
          }
        }
        if (requiresExternalPartnerForInterventionCode(value)) {
          next.deliveryMode = "partner";
        }
        if (!isEducationInterventionCode(value)) {
          next.itpDetails = "";
        }
        if (!(isEducationInterventionCode(value) || isEmployerInterventionCode(value))) {
          next.programName = "";
        }
        if (!isWageSubsidyInterventionCode(value)) {
          next.wageSubsidyDetails = "";
        }
        if (
          !requiresExternalPartnerForInterventionCode(value) &&
          next.deliveryMode === "in_house"
        ) {
          next.institution = "";
        }
      }
      if (field === "actionPlanId") {
        const nextPlan =
          selectableActionPlans.find(plan => String(plan.id) === String(value || "")) || null;
        const nextPlanStatus = normalizeActionPlanLifecycleStatus(nextPlan?.status, null);
        const allowedStatuses = getAllowedBackloadInterventionStatuses(nextPlanStatus);
        if (allowedStatuses.length && !allowedStatuses.includes(next.status)) {
          next.status = getDefaultBackloadInterventionStatus(nextPlanStatus);
        }
      }
      if (field === "nocVersion") {
        next.noc = "";
      }
      if (field === "status" && !["completed", "cancelled"].includes(value)) {
        next.outcome = "";
      }
      if (field === "deliveryMode" && value === "in_house" && !requiresExternalPartnerForInterventionCode(nextCode)) {
        next.institution = "";
      }
      if (field === "startDate" || field === "endDate") {
        const start = field === "startDate" ? value : next.startDate;
        const end = field === "endDate" ? value : next.endDate;
        const duration = calculateDurationDays(start, end);
        next.durationDays = duration !== null ? String(duration) : "";
      }
      return next;
    });
    setFieldErrors(current => {
      if (!current[field] && field !== "actionPlanId") return current;
      const next = { ...current };
      delete next[field];
      if (field === "actionPlanId") {
        delete next.status;
      }
      return next;
    });
    setError(null);
  };

  const handleCostLineDraftChange = (field, value) => {
    setCostLineDraft(current => ({ ...current, [field]: value }));
    setCostLineDraftErrors(current => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const clearCostLineError = () => {
    setFieldErrors(current => {
      if (!current.costLines) return current;
      const next = { ...current };
      delete next.costLines;
      return next;
    });
    setError(null);
  };

  const openAddCostLineModal = () => {
    setEditingCostLineId(null);
    setCostLineDraft(createCostLineDraft());
    setCostLineDraftErrors({});
    clearCostLineError();
    setCostLineModalVisible(true);
  };

  const openEditCostLineModal = lineId => {
    const line = form.costLines.find(item => item.id === lineId);
    if (!line) return;
    setEditingCostLineId(lineId);
    setCostLineDraft(createCostLineDraft(line));
    setCostLineDraftErrors({});
    clearCostLineError();
    setCostLineModalVisible(true);
  };

  const closeCostLineModal = () => {
    if (loading) return;
    setCostLineModalVisible(false);
    setEditingCostLineId(null);
    setCostLineDraft(createCostLineDraft());
    setCostLineDraftErrors({});
  };

  const saveCostLineDraft = () => {
    const nextErrors = {};
    if (!costLineDraft.type) {
      nextErrors.type = "Payment type is required.";
    }
    const amountValue = Number(costLineDraft.amount);
    if (costLineDraft.amount === "" || !Number.isFinite(amountValue)) {
      nextErrors.amount = "Amount must be numeric.";
    }
    const recurrenceOccurrencesValue =
      costLineDraft.recurrenceOccurrences === ""
        ? null
        : Number(costLineDraft.recurrenceOccurrences);
    if (
      costLineDraft.recurrenceOccurrences !== "" &&
      (!Number.isInteger(recurrenceOccurrencesValue) || recurrenceOccurrencesValue <= 0)
    ) {
      nextErrors.recurrenceOccurrences = "Occurrences must be a whole number.";
    }
    const recurrenceAmountValue =
      costLineDraft.recurrenceAmountPerPeriod === ""
        ? null
        : Number(costLineDraft.recurrenceAmountPerPeriod);
    if (
      costLineDraft.recurrenceAmountPerPeriod !== "" &&
      !Number.isFinite(recurrenceAmountValue)
    ) {
      nextErrors.recurrenceAmountPerPeriod = "Recurring amount must be numeric.";
    }
    if (
      costLineDraft.recurrenceStartDate &&
      costLineDraft.recurrenceEndDate &&
      costLineDraft.recurrenceEndDate < costLineDraft.recurrenceStartDate
    ) {
      nextErrors.recurrenceEndDate = "Recurring end date cannot be before the start date.";
    }
    if (Object.keys(nextErrors).length) {
      setCostLineDraftErrors(nextErrors);
      return;
    }
    clearCostLineError();
    setForm(current => {
      const nextLine = {
        id: editingCostLineId || costLineDraft.id,
        type: costLineDraft.type,
        payeeType: costLineDraft.payeeType || "",
        payeeName: costLineDraft.payeeName || "",
        payeeReference: costLineDraft.payeeReference || "",
        amount: costLineDraft.amount,
        notes: costLineDraft.notes || "",
        recurrenceEnabled: Boolean(costLineDraft.recurrenceEnabled),
        recurrenceStartDate: costLineDraft.recurrenceEnabled ? costLineDraft.recurrenceStartDate || "" : "",
        recurrenceEndDate: costLineDraft.recurrenceEnabled ? costLineDraft.recurrenceEndDate || "" : "",
        recurrenceOccurrences: costLineDraft.recurrenceEnabled ? costLineDraft.recurrenceOccurrences || "" : "",
        recurrenceAmountPerPeriod:
          costLineDraft.recurrenceEnabled ? costLineDraft.recurrenceAmountPerPeriod || "" : "",
      };
      const nextLines = editingCostLineId
        ? current.costLines.map(line => (line.id === editingCostLineId ? nextLine : line))
        : [...current.costLines, nextLine];
      return {
        ...current,
        costLines: nextLines,
      };
    });
    setCostLineModalVisible(false);
    setEditingCostLineId(null);
    setCostLineDraft(createCostLineDraft());
    setCostLineDraftErrors({});
  };

  const removeCostLine = lineId => {
    clearCostLineError();
    setForm(current => ({
      ...current,
      costLines: current.costLines.filter(line => line.id !== lineId),
    }));
  };

  const paymentTypeLabel = value =>
    PAYMENT_TYPE_OPTIONS.find(option => option.value === value)?.label || value || "—";
  const costLineColumnDefinitions = [
    {
      id: "paymentLine",
      header: "Payment line",
      cell: item => paymentTypeLabel(item.type),
    },
    {
      id: "amount",
      header: "Amount",
      cell: item => formatCurrencyAmount(item.amount),
    },
    {
      id: "actions",
      header: "Actions",
      cell: item => (
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="icon"
            iconName="edit"
            ariaLabel={`Edit payment line ${item.id}`}
            onClick={() => openEditCostLineModal(item.id)}
          />
          <Button
            variant="icon"
            iconName="remove"
            ariaLabel={`Delete payment line ${item.id}`}
            onClick={() => removeCostLine(item.id)}
          />
        </SpaceBetween>
      ),
    },
  ].map(column => {
    const widthMatch = costLineColumnWidths.find(entry => entry.id === column.id);
    return widthMatch?.width ? { ...column, width: widthMatch.width } : column;
  });

  const handleCostLineColumnWidthsChange = ({ detail }) => {
    if (!detail) return;
    const next = [];
    if (Array.isArray(detail.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        if (!entry || typeof entry !== "object") return;
        const width = Number(entry.width);
        if (typeof entry.id === "string" && Number.isFinite(width)) {
          next.push({ id: entry.id, width });
        }
      });
    } else if (Array.isArray(detail.widths)) {
      detail.widths.forEach((width, index) => {
        const column = costLineColumnDefinitions[index];
        if (!column) return;
        const numericWidth = Number(width);
        if (Number.isFinite(numericWidth)) {
          next.push({ id: column.id, width: numericWidth });
        }
      });
    }
    if (next.length) {
      setCostLineColumnWidths(next);
    }
  };

  const handleSubmit = async () => {
    const nextErrors = {};
    if (!form.actionPlanId) {
      nextErrors.actionPlanId = "Select an action plan first.";
    }
    if (!form.code) {
      nextErrors.code = "Intervention code is required.";
    }
    if (!form.title.trim()) {
      nextErrors.title = "Intervention title is required.";
    }
    if (!form.startDate) {
      nextErrors.startDate = "Start date is required.";
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      nextErrors.endDate = "End date cannot be before the start date.";
    }
    if (isClosed && !form.endDate) {
      nextErrors.endDate = "End date is required for a completed or cancelled intervention.";
    }
    if (requiresNoc) {
      if (!form.nocVersion) {
        nextErrors.nocVersion = "Select a NOC version.";
      }
      if (!form.noc.trim()) {
        nextErrors.noc = "Enter the NOC code.";
      } else {
        const expectedLength = form.nocVersion === "2021" ? 5 : 4;
        if (!/^\d+$/.test(form.noc.trim()) || form.noc.trim().length !== expectedLength) {
          nextErrors.noc = `NOC code must be a ${expectedLength}-digit numeric value for version ${form.nocVersion}.`;
        }
      }
    }
    if (isClosed && !form.outcome) {
      nextErrors.outcome = "Select an outcome for a completed or cancelled intervention.";
    }
    const planStatusError = getBackloadInterventionPlanStatusError({
      planStatus: selectedPlanStatus,
      interventionStatus: form.status,
    });
    if (planStatusError) {
      nextErrors.status = planStatusError;
    }
    if (isEducationIntervention) {
      if (!form.institution.trim()) {
        nextErrors.institution = "Training institution is required for this intervention code.";
      }
      if (!form.itpDetails.trim()) {
        nextErrors.itpDetails = "ITP details are required for this intervention code.";
      }
    } else if (isEmployerIntervention) {
      if (!form.institution.trim()) {
        nextErrors.institution = "Employer / delivery partner is required for this intervention code.";
      }
      if (isWageSubsidyIntervention && !form.wageSubsidyDetails.trim()) {
        nextErrors.wageSubsidyDetails = "Wage subsidy details are required for this intervention code.";
      }
    } else if (form.deliveryMode !== "in_house" && !form.institution.trim()) {
      nextErrors.institution = "Delivery partner / provider is required when using external delivery.";
    }
    const invalidCostLine = form.costLines.find(line => {
      if (!line.type && !line.amount && !line.payeeName && !line.notes) return false;
      const amount = Number(line.amount);
      return !line.type || !Number.isFinite(amount);
    });
    if (invalidCostLine) {
      nextErrors.costLines = "Each payment line needs a payment type and a numeric amount.";
    }
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError("Please resolve the highlighted fields.");
      return;
    }

    const normalizedCostLines = form.costLines
      .filter(
        line =>
          line.type ||
          line.amount ||
          line.payeeName ||
          line.payeeReference ||
          line.notes ||
          line.recurrenceEnabled ||
          line.recurrenceStartDate ||
          line.recurrenceEndDate ||
          line.recurrenceOccurrences ||
          line.recurrenceAmountPerPeriod
      )
      .map(line => ({
        id: line.id,
        type: line.type || null,
        amount: line.amount === "" ? null : Number(line.amount),
        notes: line.notes.trim() || null,
        payee: {
          type: line.payeeType || null,
          name: line.payeeName.trim() || null,
          reference: line.payeeReference.trim() || null,
        },
        recurrence:
          line.recurrenceEnabled ||
          line.recurrenceStartDate ||
          line.recurrenceEndDate ||
          line.recurrenceOccurrences ||
          line.recurrenceAmountPerPeriod
            ? {
                enabled: Boolean(line.recurrenceEnabled),
                startDate: line.recurrenceStartDate || null,
                endDate: line.recurrenceEndDate || null,
                occurrences:
                  line.recurrenceOccurrences === ""
                    ? null
                    : Number(line.recurrenceOccurrences),
                amountPerPeriod:
                  line.recurrenceAmountPerPeriod === ""
                    ? null
                    : Number(line.recurrenceAmountPerPeriod),
              }
            : null,
      }));
    const fallbackPlannedCost =
      form.plannedCost === "" ? null : Number(form.plannedCost);
    const plannedCostValue =
      normalizedCostLines.length && Number.isFinite(costLinesTotal) && costLinesTotal > 0
        ? costLinesTotal
        : fallbackPlannedCost;

    setLoading(true);
    setError(null);
    try {
      const created = await createIntervention(form.actionPlanId, {
        code: form.code,
        title: form.title.trim(),
        status: form.status,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        durationDays: form.durationDays === "" ? null : Number(form.durationDays),
        outcome: isClosed ? form.outcome || null : null,
        cost: Number.isFinite(plannedCostValue) ? plannedCostValue : null,
        approvedAmount: form.approvedAmount === "" ? null : Number(form.approvedAmount),
        actualAmount: form.actualAmount === "" ? null : Number(form.actualAmount),
        postingContext: form.postingContext || "external",
        deliveryMode: form.deliveryMode === "in_house" ? "in_house" : "partner",
        institution: form.institution.trim() || null,
        programName: form.programName.trim() || null,
        itpDetails: form.itpDetails.trim() || null,
        wageSubsidyDetails: form.wageSubsidyDetails.trim() || null,
        noc: requiresNoc ? form.noc.trim() || null : null,
        nocVersion: requiresNoc ? form.nocVersion || null : null,
        notes: form.notes.trim() || null,
        backloadMode: true,
        entryMode: "backload",
        metadata: {
          source: "manual_backload",
          entryMode: "existing",
          deliveryMode: form.deliveryMode === "in_house" ? "in_house" : "partner",
          institution: form.institution.trim() || null,
          trainingInstitution: form.institution.trim() || null,
          programName: form.programName.trim() || null,
          itpDetails: form.itpDetails.trim() || null,
          wageSubsidyDetails: form.wageSubsidyDetails.trim() || null,
          costLines: normalizedCostLines,
          snapshot: {
            code: form.code,
            title: form.title.trim(),
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            deliveryMode: form.deliveryMode === "in_house" ? "in_house" : "partner",
            institution: form.institution.trim() || null,
            programName: form.programName.trim() || null,
            itpDetails: form.itpDetails.trim() || null,
            wageSubsidyDetails: form.wageSubsidyDetails.trim() || null,
            nocCode: requiresNoc ? form.noc.trim() || null : null,
            nocVersion: requiresNoc ? form.nocVersion || null : null,
            costLines: normalizedCostLines,
          },
        },
      });
      onCreated?.(created);
    } catch (submitError) {
      setError(submitError?.message || "Failed to record the existing intervention.");
    } finally {
      setLoading(false);
    }
  };

  const selectedCostLinePaymentType =
    PAYMENT_TYPE_OPTIONS.find(option => option.value === costLineDraft.type) || null;
  const selectedCostLinePayeeType =
    PAYEE_TYPE_OPTIONS.find(option => option.value === costLineDraft.payeeType) || null;

  return (
    <>
      <Modal
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        header="Add existing intervention"
        closeAriaLabel="Close add existing intervention modal"
        size="large"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={onDismiss} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={!actionPlanOptions.length}
            >
              Save existing intervention
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="l">
          <Alert type="info">
            Record an intervention that already existed before PATH go-live. Saving here does not start proposal,
            approval, payment-packet, or client-notification workflow.
          </Alert>
          {error && (
            <Alert type="error" dismissible onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}
          {!actionPlanOptions.length ? (
            <Alert type="warning">
              Add an action plan first. Existing interventions must be attached to a non-archived action plan.
            </Alert>
          ) : null}
          {planStatusNotice ? <Alert type="info">{planStatusNotice}</Alert> : null}
          <SpaceBetween size="m">
            <ColumnLayout columns={2} variant="text-grid">
            <FormField label="Action plan" errorText={fieldErrors.actionPlanId}>
              <Select
                selectedOption={selectedPlanOption}
                onChange={({ detail }) => handleFieldChange("actionPlanId", detail.selectedOption?.value || "")}
                options={actionPlanOptions}
                placeholder="Select action plan"
              />
            </FormField>
            <FormField label="Current status" errorText={fieldErrors.status}>
              <Select
                selectedOption={selectedStatusOption}
                onChange={({ detail }) => handleFieldChange("status", detail.selectedOption?.value || "approved")}
                options={statusOptions}
                placeholder={statusOptions.length ? "Select status" : "No valid statuses"}
                disabled={!statusOptions.length}
              />
            </FormField>
            <FormField label="Intervention code" errorText={fieldErrors.code}>
              <Select
                selectedOption={selectedCodeOption}
                onChange={({ detail }) => handleFieldChange("code", detail.selectedOption?.value || "")}
                options={codeOptions}
                placeholder="Select intervention code"
              />
            </FormField>
            <FormField label="Intervention title" errorText={fieldErrors.title}>
              <Input
                value={form.title}
                onChange={({ detail }) => handleFieldChange("title", detail.value)}
                placeholder="e.g. Occupational skills training"
              />
            </FormField>
            <FormField label="Start date" errorText={fieldErrors.startDate}>
              <DatePicker
                value={form.startDate}
                onChange={({ detail }) => handleFieldChange("startDate", detail.value)}
                placeholder="YYYY-MM-DD"
              />
            </FormField>
            <FormField label="End date" errorText={fieldErrors.endDate}>
              <DatePicker
                value={form.endDate}
                onChange={({ detail }) => handleFieldChange("endDate", detail.value)}
                placeholder="YYYY-MM-DD"
              />
            </FormField>
            <FormField label="Duration in days (calculated)">
              <Input value={form.durationDays} readOnly />
            </FormField>
            <FormField label="Paid from">
              <Select
                selectedOption={selectedPostingContext}
                onChange={({ detail }) => handleFieldChange("postingContext", detail.selectedOption?.value || "external")}
                options={POSTING_CONTEXT_OPTIONS}
              />
            </FormField>
            <FormField label="Outcome" errorText={fieldErrors.outcome}>
              <Select
                selectedOption={selectedOutcomeOption}
                onChange={({ detail }) => handleFieldChange("outcome", detail.selectedOption?.value || "")}
                options={outcomeOptions}
                placeholder={isClosed ? "Required for completed/cancelled" : "Optional"}
              />
            </FormField>
          </ColumnLayout>

          {requiresNoc && (
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="NOC version" errorText={fieldErrors.nocVersion}>
                <Select
                  selectedOption={selectedNocVersion}
                  onChange={({ detail }) => handleFieldChange("nocVersion", detail.selectedOption?.value || "")}
                  options={nocVersionOptions}
                  statusType={nocVersionsLoading ? "loading" : "finished"}
                  placeholder="Select NOC version"
                />
              </FormField>
              <FormField label="NOC code" errorText={fieldErrors.noc}>
                <Autosuggest
                  value={form.noc}
                  onChange={({ detail }) => {
                    handleFieldChange("noc", detail.value);
                    if (!detail.value) {
                      setNocSuggestions([]);
                      setNocSuggestionsLoading(false);
                    } else if (detail.value.length >= 2) {
                      fetchNocSuggestions(detail.value);
                    }
                  }}
                  onSelect={({ detail }) => handleFieldChange("noc", detail.value || "")}
                  onLoadItems={({ detail }) => fetchNocSuggestions(detail.filteringText)}
                  options={nocSuggestions}
                  statusType={nocSuggestionsLoading ? "loading" : "finished"}
                  enteredTextLabel={value => `Use "${value}"`}
                  expandToViewport
                  placeholder={
                    nocVersionsLoading
                      ? "Loading NOC versions"
                      : form.nocVersion
                      ? "Type to search NOC codes"
                      : "Select a NOC version first"
                  }
                  empty="No NOC matches found."
                  disabled={nocVersionsLoading || !form.nocVersion}
                />
              </FormField>
            </ColumnLayout>
          )}

          {!requiresExternalPartner && (
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Delivery mode" description="Choose how this intervention is delivered.">
                <Select
                  selectedOption={selectedDeliveryModeOption}
                  onChange={({ detail }) => handleFieldChange("deliveryMode", detail.selectedOption?.value || "partner")}
                  options={[
                    { value: "partner", label: "External delivery partner" },
                    { value: "in_house", label: "In-house (no external partner)" },
                  ]}
                />
              </FormField>
              {form.deliveryMode !== "in_house" ? (
                <FormField label="Delivery partner / provider" errorText={fieldErrors.institution}>
                  <Input
                    value={form.institution}
                    onChange={({ detail }) => handleFieldChange("institution", detail.value)}
                    placeholder="Training institution, employer, or provider"
                  />
                </FormField>
              ) : (
                <Box />
              )}
            </ColumnLayout>
          )}

          {isEducationIntervention && (
            <SpaceBetween size="s">
              <ColumnLayout columns={2} variant="text-grid">
                <FormField
                  label="Institution"
                  description="Training provider or school delivering the program."
                  errorText={fieldErrors.institution}
                >
                  <Input
                    value={form.institution}
                    onChange={({ detail }) => handleFieldChange("institution", detail.value)}
                  />
                </FormField>
                <FormField label="Program name (optional)" description="Course, credential, or stream name.">
                  <Input
                    value={form.programName}
                    onChange={({ detail }) => handleFieldChange("programName", detail.value)}
                  />
                </FormField>
              </ColumnLayout>
              <FormField
                label="In-Training Plan (ITP) details"
                description="Outline curriculum, milestones, supports, materials, and employment goal alignment."
                errorText={fieldErrors.itpDetails}
              >
                <Textarea
                  value={form.itpDetails}
                  rows={3}
                  onChange={({ detail }) => handleFieldChange("itpDetails", detail.value)}
                />
              </FormField>
            </SpaceBetween>
          )}

          {isEmployerIntervention && (
            <SpaceBetween size="s">
              <ColumnLayout columns={2} variant="text-grid">
                <FormField
                  label="Employer / delivery partner"
                  description="Employer or host organization providing the placement."
                  errorText={fieldErrors.institution}
                >
                  <Input
                    value={form.institution}
                    onChange={({ detail }) => handleFieldChange("institution", detail.value)}
                  />
                </FormField>
                <FormField label="Program name (optional)" description="Job title, role, or program name.">
                  <Input
                    value={form.programName}
                    onChange={({ detail }) => handleFieldChange("programName", detail.value)}
                  />
                </FormField>
              </ColumnLayout>
              {isWageSubsidyIntervention && (
                <FormField label="Wage subsidy details" errorText={fieldErrors.wageSubsidyDetails}>
                  <Textarea
                    value={form.wageSubsidyDetails}
                    rows={3}
                    onChange={({ detail }) => handleFieldChange("wageSubsidyDetails", detail.value)}
                  />
                </FormField>
              )}
            </SpaceBetween>
          )}

            <SpaceBetween size="s">
              <Box fontWeight="bold">Funding and cost</Box>
              <ColumnLayout columns={3} variant="text-grid">
              <FormField label="Planned cost (optional)">
                <Input
                  value={form.plannedCost}
                  onChange={({ detail }) => handleFieldChange("plannedCost", detail.value)}
                  placeholder="Whole dollars"
                />
              </FormField>
              <FormField label="Approved amount (optional)">
                <Input
                  value={form.approvedAmount}
                  onChange={({ detail }) => handleFieldChange("approvedAmount", detail.value)}
                  placeholder="Whole dollars"
                />
              </FormField>
              <FormField label="Actual amount (optional)">
                <Input
                  value={form.actualAmount}
                  onChange={({ detail }) => handleFieldChange("actualAmount", detail.value)}
                  placeholder="Whole dollars"
                />
              </FormField>
              </ColumnLayout>
              <Box color="text-body-secondary" fontSize="body-s">
                Backloaded actual amounts are historical spend only. They do not create payment packets, validation work, or finance submissions. If you add payment lines below, PATH will use their total as the intervention planned cost.
              </Box>
              <Box fontSize="body-s" fontWeight="bold">
                Payment line total: $
                {costLinesTotal.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Box>
              {fieldErrors.costLines && <Alert type="error">{fieldErrors.costLines}</Alert>}
              <Table
                trackBy="id"
                variant="embedded"
                resizableColumns
                columnDefinitions={costLineColumnDefinitions}
                items={form.costLines}
                onColumnWidthsChange={handleCostLineColumnWidthsChange}
                header={
                  <Header
                    variant="h3"
                    actions={
                      <Button onClick={openAddCostLineModal}>Add payment line</Button>
                    }
                    counter={form.costLines.length ? `(${form.costLines.length})` : undefined}
                  >
                    Payment lines
                  </Header>
                }
                empty={
                  <Box textAlign="center">
                    No payment lines added yet.
                  </Box>
                }
              />
            </SpaceBetween>

            <FormField label="Notes">
              <Textarea
                value={form.notes}
                onChange={({ detail }) => handleFieldChange("notes", detail.value)}
                rows={4}
                placeholder="Optional notes about the existing intervention"
              />
            </FormField>
          </SpaceBetween>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={costLineModalVisible}
        onDismiss={closeCostLineModal}
        header={editingCostLineId ? "Edit payment line" : "Add payment line"}
        closeAriaLabel="Close payment line modal"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={closeCostLineModal} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveCostLineDraft} disabled={loading}>
              {editingCostLineId ? "Save payment line" : "Add payment line"}
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          <ColumnLayout columns={2} variant="text-grid">
            <FormField label="Payment type" errorText={costLineDraftErrors.type}>
              <Select
                selectedOption={selectedCostLinePaymentType}
                onChange={({ detail }) => handleCostLineDraftChange("type", detail.selectedOption?.value || "")}
                options={PAYMENT_TYPE_OPTIONS}
                placeholder="Select payment type"
              />
            </FormField>
            <FormField label="Amount" errorText={costLineDraftErrors.amount}>
              <Input
                value={costLineDraft.amount}
                onChange={({ detail }) => handleCostLineDraftChange("amount", detail.value)}
                placeholder="Whole dollars"
              />
            </FormField>
            <FormField label="Payee type">
              <Select
                selectedOption={selectedCostLinePayeeType}
                onChange={({ detail }) => handleCostLineDraftChange("payeeType", detail.selectedOption?.value || "")}
                options={PAYEE_TYPE_OPTIONS}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Payee name">
              <Input
                value={costLineDraft.payeeName}
                onChange={({ detail }) => handleCostLineDraftChange("payeeName", detail.value)}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Payee reference">
              <Input
                value={costLineDraft.payeeReference}
                onChange={({ detail }) => handleCostLineDraftChange("payeeReference", detail.value)}
                placeholder="Optional vendor or account reference"
              />
            </FormField>
          </ColumnLayout>
          <FormField>
            <Checkbox
              checked={costLineDraft.recurrenceEnabled}
              onChange={({ detail }) => {
                if (detail.checked) {
                  handleCostLineDraftChange("recurrenceEnabled", true);
                  return;
                }
                setCostLineDraft(current => ({
                  ...current,
                  recurrenceEnabled: false,
                  recurrenceStartDate: "",
                  recurrenceEndDate: "",
                  recurrenceOccurrences: "",
                  recurrenceAmountPerPeriod: "",
                }));
                setCostLineDraftErrors(current => {
                  const next = { ...current };
                  delete next.recurrenceOccurrences;
                  delete next.recurrenceAmountPerPeriod;
                  delete next.recurrenceEndDate;
                  return next;
                });
              }}
            >
              Recurring payment line
            </Checkbox>
          </FormField>
          {costLineDraft.recurrenceEnabled ? (
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Recurring start date">
                <DatePicker
                  value={costLineDraft.recurrenceStartDate}
                  onChange={({ detail }) => handleCostLineDraftChange("recurrenceStartDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField label="Recurring end date" errorText={costLineDraftErrors.recurrenceEndDate}>
                <DatePicker
                  value={costLineDraft.recurrenceEndDate}
                  onChange={({ detail }) => handleCostLineDraftChange("recurrenceEndDate", detail.value)}
                  placeholder="YYYY-MM-DD"
                />
              </FormField>
              <FormField label="Occurrences" errorText={costLineDraftErrors.recurrenceOccurrences}>
                <Input
                  value={costLineDraft.recurrenceOccurrences}
                  onChange={({ detail }) => handleCostLineDraftChange("recurrenceOccurrences", detail.value)}
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="Amount per period" errorText={costLineDraftErrors.recurrenceAmountPerPeriod}>
                <Input
                  value={costLineDraft.recurrenceAmountPerPeriod}
                  onChange={({ detail }) => handleCostLineDraftChange("recurrenceAmountPerPeriod", detail.value)}
                  placeholder="Optional"
                />
              </FormField>
            </ColumnLayout>
          ) : null}
          <FormField label="Line notes">
            <Textarea
              value={costLineDraft.notes}
              rows={3}
              onChange={({ detail }) => handleCostLineDraftChange("notes", detail.value)}
              placeholder="Optional"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </>
  );
};

export default ExistingInterventionModal;
