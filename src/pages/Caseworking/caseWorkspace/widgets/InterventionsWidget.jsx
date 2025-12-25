import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  CollectionPreferences,
  Header,
  Link,
  Modal,
  Pagination,
  SegmentedControl,
  SpaceBetween,
  StatusIndicator,
  Table,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import InterventionModal from "../modals/InterventionModal.jsx";

const formatCurrency = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `$${numeric.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatLabel = value => {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

const formatDate = value => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const parseMetadata = value => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const stripCodePrefix = value => {
  if (!value) return "";
  return String(value)
    .replace(/^\s*\d+\s*[-\u2013\u2014:]\s*/, "")
    .trim();
};

const normaliseStatus = status => {
  const value = String(status || "").trim().toLowerCase();
  const aliases = {
    planning: "planned",
    "in-review": "in_review",
    "in review": "in_review",
    "changes-requested": "changes_requested",
    "changes requested": "changes_requested",
    active: "in_progress",
    inprogress: "in_progress",
    "in-progress": "in_progress",
    progress: "in_progress",
    "on-hold": "suspended",
    on_hold: "suspended",
    "ready-to-close": "ready_to_close",
    "ready to close": "ready_to_close",
    readyclose: "ready_to_close",
    complete: "completed",
    closed: "completed",
    done: "completed",
    finished: "completed",
    canceled: "cancelled",
  };
  return aliases[value] || value;
};

const getEiStatusValue = item => {
  const metadata = parseMetadata(item?.metadata);
  const review = metadata?.review || {};
  return review.eiStatus || review.ei_status || "";
};

const getStatusDisplayLabel = item => {
  const value = normaliseStatus(item?.status);
  if (value === "submitted") {
    const hasEiStatus = Boolean(getEiStatusValue(item));
    return `Submitted - EI ${hasEiStatus ? "verified" : "unverified"}`;
  }
  return formatLabel(item?.status);
};
const isClosedStatus = status => ["completed", "cancelled"].includes(normaliseStatus(status));
const isOpenStatus = status => ["planned", "in_progress", "suspended"].includes(normaliseStatus(status));
const isClosableStatus = status => ["in_progress", "suspended"].includes(normaliseStatus(status));
const isPlannedStatus = status => normaliseStatus(status) === "planned";
const isDraftStatus = status => normaliseStatus(status) === "draft";
const isBlockingProposalStatus = status => ["draft", "submitted"].includes(normaliseStatus(status));
const isProposalWorkflowStatus = status =>
  ["draft", "submitted", "in_review", "changes_requested"].includes(normaliseStatus(status));

const statusIndicatorType = status => {
  const value = (status || "").toLowerCase();
  if (value === "completed") return "success";
  if (value === "cancelled") return "stopped";
  if (value === "suspended") return "warning";
  return "info";
};

const toNumberOrNull = value => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getPlannedCost = item =>
  toNumberOrNull(
    item.plannedCost ??
      item.cost ??
      item.budgetAmount ??
      item.approvedAmount ??
      item.intervention_cost ??
      item.interventionCost
  );

const getActualCost = item => toNumberOrNull(item.actualAmount);

const getDisplayCost = item => {
  const actual = getActualCost(item);
  const planned = getPlannedCost(item);
  const closed = isClosedStatus(item.status);
  if (closed && actual !== null) {
    return { value: actual, label: "actual" };
  }
  if (planned !== null) {
    return { value: planned, label: "planned" };
  }
  if (actual !== null) {
    return { value: actual, label: closed ? "actual" : "planned" };
  }
  return { value: null, label: null };
};

const renderComplianceBadge = status => {
  const value = (status || "").toLowerCase();
  if (value === "ok" || value === "clean") return <Badge color="green">OK</Badge>;
  if (value === "warning") return <Badge color="blue">Warning</Badge>;
  if (value === "error" || value === "blocked") return <Badge color="red">Error</Badge>;
  return <Badge color="grey">Pending</Badge>;
};

const PREFERENCES_STORAGE_KEY = "caseworking-interventions-preferences-v1";
const COLUMN_WIDTHS_STORAGE_KEY = "caseworking-interventions-column-widths-v1";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [
  { label: "10 interventions", value: 10 },
  { label: "20 interventions", value: 20 },
  { label: "50 interventions", value: 50 },
];
const STATUS_FILTER_OPTIONS = [
  { id: "all", text: "All" },
  { id: "draft", text: "Draft" },
  { id: "submitted", text: "Submitted" },
  { id: "planned", text: "Planned" },
  { id: "in_progress", text: "In progress" },
  { id: "closed", text: "Closed" },
];
const ALL_COLUMN_IDS = [
  "code",
  "status",
  "dates",
  "outcome",
  "duration",
  "cost",
  "compliance",
  "actions",
];
const REQUIRED_COLUMN_IDS = new Set(["code", "actions"]);

const DEFAULT_PREFERENCES = {
  pageSize: DEFAULT_PAGE_SIZE,
  visibleColumns: ALL_COLUMN_IDS,
};

const loadStoredPreferences = () => {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_PREFERENCES,
      visibleColumns: [...DEFAULT_PREFERENCES.visibleColumns],
    };
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_PREFERENCES,
        visibleColumns: [...DEFAULT_PREFERENCES.visibleColumns],
      };
    }

    const parsed = JSON.parse(raw);
    const pageSize = PAGE_SIZE_OPTIONS.some(option => option.value === parsed.pageSize)
      ? parsed.pageSize
      : DEFAULT_PAGE_SIZE;

    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? ALL_COLUMN_IDS.filter(id => parsed.visibleColumns.includes(id))
      : DEFAULT_PREFERENCES.visibleColumns;

    REQUIRED_COLUMN_IDS.forEach(id => {
      if (!visibleColumns.includes(id)) {
        visibleColumns.push(id);
      }
    });

    return {
      pageSize,
      visibleColumns: [...visibleColumns],
    };
  } catch (error) {
    console.warn("[InterventionsWidget] failed to read stored preferences", error);
    return {
      ...DEFAULT_PREFERENCES,
      visibleColumns: [...DEFAULT_PREFERENCES.visibleColumns],
    };
  }
};

const persistPreferences = next => {
  if (typeof window === "undefined") {
    return;
  }

  const visibleSet = new Set(next.visibleColumns ?? DEFAULT_PREFERENCES.visibleColumns);
  REQUIRED_COLUMN_IDS.forEach(id => visibleSet.add(id));

  const payload = {
    ...DEFAULT_PREFERENCES,
    ...next,
    visibleColumns: ALL_COLUMN_IDS.filter(id => visibleSet.has(id)),
  };

  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[InterventionsWidget] failed to persist preferences", error);
  }
};

const loadStoredColumnWidths = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(entry => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const id = typeof entry.id === "string" ? entry.id : null;
        const width = Number(entry.width);
        if (!id || !Number.isFinite(width)) {
          return null;
        }
        return { id, width };
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("[InterventionsWidget] failed to read stored column widths", error);
    return [];
  }
};

const persistColumnWidths = widths => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!Array.isArray(widths) || widths.length === 0) {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    }
  } catch (error) {
    console.warn("[InterventionsWidget] failed to persist column widths", error);
  }
};

const InterventionsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    caseData,
    selectedActionPlanId,
    createIntervention,
    updateIntervention,
    closeIntervention,
    deleteIntervention,
    interventionCodes,
    interventionCodesLoading,
    loadInterventionCodes,
    interventionOutcomes,
    interventionOutcomesLoading,
    loadInterventionOutcomes,
    fundingStreams,
    fundingStreamsLoading,
    loadFundingStreams,
    nocVersions,
    nocVersionsLoading,
    loadNocVersions,
    searchNocCodes,
    setSelectedActionPlanId,
    refresh,
    selectedInterventionId,
    setSelectedInterventionId,
  } = useCaseWorkspace();
  const [formMode, setFormMode] = useState(null);
  const [startInCloseMode, setStartInCloseMode] = useState(false);
  const [forceReadOnly, setForceReadOnly] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const pendingFocusRef = useRef(null);
  const selectedPlanRef = useRef(selectedActionPlanId);
  const refreshInterventions = useCallback(async () => {
    if (typeof refresh !== "function") return;
    try {
      await refresh();
    } catch (err) {
      console.warn("[InterventionsWidget] refresh failed", err);
      setErrorMessage(current => current ?? (err?.message || "Unable to refresh interventions."));
    }
  }, [refresh]);

  const initialPreferences = useMemo(() => loadStoredPreferences(), []);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [visibleColumns, setVisibleColumns] = useState(initialPreferences.visibleColumns);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [columnWidths, setColumnWidths] = useState(() => loadStoredColumnWidths());
  const [statusFilter, setStatusFilter] = useState("all");
  const preloadCodesAttemptedRef = useRef(false);
  const preloadOutcomesAttemptedRef = useRef(false);

  const activePlan = useMemo(
    () => caseData?.actionPlans?.find(plan => plan.id === selectedActionPlanId),
    [caseData, selectedActionPlanId]
  );
  const prevPlanIdRef = useRef(activePlan?.id ?? null);
  const activePlanRef = useRef(activePlan);
  const hasBlockingProposal = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.some(plan =>
      (plan.interventions || []).some(intervention => isBlockingProposalStatus(intervention?.status))
    );
  }, [caseData]);

  const interventions = activePlan?.interventions ?? [];
  const selectedIntervention = useMemo(
    () => interventions.find(item => item.id === selectedInterventionId) || null,
    [interventions, selectedInterventionId]
  );

  useEffect(() => {
    const currentPlanId = activePlan?.id ?? null;
    if (prevPlanIdRef.current === currentPlanId) return;
    prevPlanIdRef.current = currentPlanId;
    setSelectedInterventionId(null);
    setFormMode(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    setStartInCloseMode(false);
    setForceReadOnly(false);
  }, [activePlan?.id, setSelectedInterventionId]);

  useEffect(() => {
    persistPreferences({ pageSize, visibleColumns });
  }, [pageSize, visibleColumns]);

  useEffect(() => {
    persistColumnWidths(columnWidths);
  }, [columnWidths]);

  useEffect(() => {
    selectedPlanRef.current = selectedActionPlanId;
  }, [selectedActionPlanId]);

  useEffect(() => {
    activePlanRef.current = activePlan;
  }, [activePlan]);

  const attemptPendingInterventionFocus = useCallback(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const currentPlan = activePlanRef.current;
    if (!currentPlan || currentPlan.id !== pending.planId) return;
    const target = (currentPlan.interventions || []).find(item => item.id === pending.interventionId);
    if (!target) return;
    setSelectedInterventionId(target.id);
    requestAnimationFrame(() => {
      const container = document.getElementById("case-interventions-widget");
      if (container?.scrollIntoView) {
        container.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    pendingFocusRef.current = null;
  }, [setSelectedInterventionId]);

  useEffect(() => {
    const handler = event => {
      const detail = event?.detail || {};
      const planId = detail.planId;
      const interventionId = detail.interventionId;
      if (!planId || !interventionId) {
        return;
      }
      pendingFocusRef.current = { planId, interventionId };
      if (selectedPlanRef.current !== planId && typeof setSelectedActionPlanId === "function") {
        setSelectedActionPlanId(planId);
        return;
      }
      attemptPendingInterventionFocus();
    };
    window.addEventListener("iset:focus-intervention", handler);
    return () => window.removeEventListener("iset:focus-intervention", handler);
  }, [attemptPendingInterventionFocus, setSelectedActionPlanId]);

  useEffect(() => {
    attemptPendingInterventionFocus();
  }, [attemptPendingInterventionFocus, interventions, activePlan?.id]);

  useEffect(() => {
    if (interventionCodes.length > 0) {
      preloadCodesAttemptedRef.current = true;
      return;
    }
    if (preloadCodesAttemptedRef.current) return;
    preloadCodesAttemptedRef.current = true;
    let cancelled = false;
    loadInterventionCodes().catch(error => {
      if (cancelled) return;
      setErrorMessage(current => current ?? (error?.message || "Unable to load intervention codes."));
      preloadCodesAttemptedRef.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [interventionCodes.length, loadInterventionCodes]);

  useEffect(() => {
    if (interventionOutcomes.length > 0) {
      preloadOutcomesAttemptedRef.current = true;
      return;
    }
    if (preloadOutcomesAttemptedRef.current) return;
    preloadOutcomesAttemptedRef.current = true;
    let cancelled = false;
    loadInterventionOutcomes().catch(error => {
      if (cancelled) return;
      setErrorMessage(current => current ?? (error?.message || "Unable to load intervention outcomes."));
      preloadOutcomesAttemptedRef.current = false;
    });
    return () => {
      cancelled = true;
    };
  }, [interventionOutcomes.length, loadInterventionOutcomes]);

  useEffect(() => {
    if (!formMode) return;
    if (interventionCodes.length > 0) return;
    let cancelled = false;
    setErrorMessage(null);
    loadInterventionCodes()
      .catch(error => {
        if (cancelled) return;
        setErrorMessage(error?.message || "Unable to load intervention codes.");
      });
    return () => {
      cancelled = true;
    };
  }, [formMode, interventionCodes, loadInterventionCodes]);

  useEffect(() => {
    if (!formMode) return;
    if (interventionOutcomes.length > 0) return;
    let cancelled = false;
    loadInterventionOutcomes().catch(error => {
      if (cancelled) return;
      setErrorMessage(current => current ?? (error?.message || "Unable to load intervention outcomes."));
    });
    return () => {
      cancelled = true;
    };
  }, [formMode, interventionOutcomes, loadInterventionOutcomes]);

  useEffect(() => {
    if (!formMode) return;
    if (fundingStreams.length > 0) return;
    let cancelled = false;
    loadFundingStreams().catch(error => {
      if (cancelled) return;
      setErrorMessage(current => current ?? (error?.message || "Unable to load funding streams."));
    });
    return () => {
      cancelled = true;
    };
  }, [formMode, fundingStreams, loadFundingStreams]);

  useEffect(() => {
    if (!formMode) return;
    if (nocVersions.length > 0) return;
    let cancelled = false;
    loadNocVersions().catch(error => {
      if (cancelled) return;
      setErrorMessage(current => current ?? (error?.message || "Unable to load NOC versions."));
    });
    return () => {
      cancelled = true;
    };
  }, [formMode, nocVersions, loadNocVersions]);

  const columnWidthsMap = useMemo(() => {
    const map = new Map();
    columnWidths.forEach(entry => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const { id, width } = entry;
      if (ALL_COLUMN_IDS.includes(id) && Number.isFinite(Number(width))) {
        map.set(id, Number(width));
      }
    });
    return map;
  }, [columnWidths]);

  const codeLabelMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(interventionCodes) ? interventionCodes : []).forEach(option => {
      if (!option) return;
      const value = option.code ?? option.value;
      const label = option.label ?? option.description;
      if (value === undefined || value === null || !label) {
        return;
      }
      const valueStr = String(value).trim();
      if (!valueStr) return;
      const cleanedLabel = stripCodePrefix(label);
      map.set(valueStr, cleanedLabel || label);
    });
    return map;
  }, [interventionCodes]);

  const outcomeLabelMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(interventionOutcomes) ? interventionOutcomes : []).forEach(option => {
      if (!option) return;
      const value = option.code ?? option.value;
      const label = option.label ?? option.description;
      if (value === undefined || value === null || !label) {
        return;
      }
      const valueStr = String(value).trim();
      if (!valueStr) return;
      const padded = valueStr.length === 1 ? `0${valueStr}` : valueStr;
      map.set(valueStr, `${padded} - ${label}`);
    });
    return map;
  }, [interventionOutcomes]);

  const getTypeLabel = useCallback(
    item => {
      if (!item) return "-";
      const codeValue = item.code !== undefined && item.code !== null ? String(item.code).trim() : "";
      const label = codeValue ? codeLabelMap.get(codeValue) : null;
      if (label) return label;
      const fromTitle = stripCodePrefix(item.title);
      if (fromTitle) return fromTitle;
      return codeValue || "-";
    },
    [codeLabelMap]
  );

  const filteredInterventions = useMemo(() => {
    if (statusFilter === "all") {
      return interventions;
    }
    return interventions.filter(item => {
      const value = normaliseStatus(item?.status);
      if (statusFilter === "closed") {
        return isClosedStatus(value);
      }
      return value === statusFilter;
    });
  }, [interventions, statusFilter]);

  const totalMatches = filteredInterventions.length;
  const pagesCount = totalMatches ? Math.ceil(totalMatches / pageSize) : 1;

  useEffect(() => {
    if (currentPageIndex > pagesCount) {
      setCurrentPageIndex(pagesCount);
    }
  }, [currentPageIndex, pagesCount]);

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [statusFilter]);

  const paginatedInterventions = useMemo(() => {
    if (!filteredInterventions.length) {
      return [];
    }
    const startIndex = (currentPageIndex - 1) * pageSize;
    return filteredInterventions.slice(startIndex, startIndex + pageSize);
  }, [filteredInterventions, currentPageIndex, pageSize]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Interventions", metadata.aiContext ?? "");
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

  const activePlanLabel = activePlan?.title || activePlan?.name || null;

  const planStatus = (activePlan?.status || "").toLowerCase();
  const canModify = !!activePlan && ["draft", "active"].includes(planStatus);
  const canCloseSelected =
    canModify && !!selectedIntervention && isClosableStatus(selectedIntervention?.status);

  const dispatchWizardSelection = useCallback(
    intervention => {
      if (!intervention?.id) return;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("iset:intervention-assessment:select", {
            detail: {
              interventionId: intervention.id,
              planId: activePlan?.id ?? null,
            },
          })
        );
      }
    },
    [activePlan?.id]
  );

  const openInterventionInWizard = useCallback(
    intervention => {
      if (!intervention?.id) return;
      setSelectedInterventionId(intervention.id);
      setFormMode(null);
      setStartInCloseMode(false);
      setForceReadOnly(false);
      dispatchWizardSelection(intervention);
    },
    [dispatchWizardSelection]
  );

  const resumeDraft = useCallback(
    intervention => {
      if (!intervention?.id) return;
      openInterventionInWizard(intervention);
    },
    [openInterventionInWizard]
  );

  const getInterventionActionItems = useCallback(
    intervention => {
      if (!intervention) return [];
      const status = intervention.status;
      if (isDraftStatus(status)) {
        return [
          { id: "resume", text: "Resume draft" },
          { id: "delete", text: "Delete intervention" },
        ];
      }
      const items = [{ id: "view", text: "View intervention" }];
      if (canModify) {
        const normalized = normaliseStatus(status);
        if (["approved", "planned"].includes(normalized)) {
          items.push({ id: "activate", text: "Activate intervention" });
        }
        if (["in_progress", "suspended"].includes(normalized)) {
          items.push({ id: "close", text: "Close intervention" });
        }
        if (["submitted", "in_review", "changes_requested", "approved", "rejected", "planned"].includes(normalized)) {
          items.push({ id: "delete", text: "Delete intervention" });
        }
      }
      return items;
    },
    [canModify]
  );

  const openDraftWizard = () => {
    if (!activePlan) {
      setErrorMessage("Select an action plan before starting a proposal.");
      return;
    }
    if (hasBlockingProposal) {
      setErrorMessage("A draft or submitted proposal already exists. Resume it from the table.");
      return;
    }
    setStartInCloseMode(false);
    setForceReadOnly(false);
    setSuccessMessage(null);
    setErrorMessage(null);
    setFormMode(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("iset:intervention-assessment:new", {
          detail: { planId: activePlan.id },
        })
      );
    }
  };

  const openWizardView = useCallback(
    (interventionToView = null) => {
      const target = interventionToView || selectedIntervention;
      if (!target) {
        setErrorMessage("Select an intervention to view.");
        return;
      }
      setSuccessMessage(null);
      setErrorMessage(null);
      if (isProposalWorkflowStatus(target.status)) {
        openInterventionInWizard(target);
        return;
      }
      setStartInCloseMode(false);
      setForceReadOnly(!canModify);
      if (!selectedIntervention || target.id !== selectedInterventionId) {
        setSelectedInterventionId(target.id);
      }
      setFormMode("edit");
    },
    [
      canModify,
      openInterventionInWizard,
      selectedIntervention,
      selectedInterventionId,
      setForceReadOnly,
      setFormMode,
      setSelectedInterventionId,
      setStartInCloseMode,
    ]
  );

  const openCloseModal = useCallback(
    (interventionToClose = null) => {
      if (!activePlan) {
        setErrorMessage("Select an action plan before closing interventions.");
        return;
      }
      const target = interventionToClose || selectedIntervention;
      if (!target) {
        setErrorMessage("Select an intervention to close.");
        return;
      }
      if (!canModify || !isOpenStatus(target.status)) {
        setErrorMessage(
          "Interventions that are already completed or cancelled cannot be closed again."
        );
        return;
      }
      setSuccessMessage(null);
      setErrorMessage(null);
      setForceReadOnly(false);
      setStartInCloseMode(true);
      if (!selectedIntervention || target.id !== selectedInterventionId) {
        setSelectedInterventionId(target.id);
      }
      setFormMode("edit");
    },
    [
      activePlan,
      canModify,
      selectedIntervention,
      selectedInterventionId,
      setErrorMessage,
      setForceReadOnly,
      setFormMode,
      setSelectedInterventionId,
      setStartInCloseMode,
      setSuccessMessage,
    ]
  );

  const handleModalDismiss = () => {
    setStartInCloseMode(false);
    setForceReadOnly(false);
    setFormMode(null);
  };

  const handleModalSubmit = async formValues => {
    if (!activePlan?.id) {
      const error = new Error("Select an action plan first.");
      setErrorMessage(error.message);
      throw error;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    let result;
    if (formMode === "edit") {
      if (!selectedIntervention) {
        const error = new Error("Select an intervention to edit.");
        setErrorMessage(error.message);
        throw error;
      }
      result = await updateIntervention(activePlan.id, selectedIntervention.id, formValues);
      setSuccessMessage(`Intervention "${result?.title || result?.code || "Intervention"}" updated.`);
    } else {
      result = await createIntervention(activePlan.id, formValues);
      setSuccessMessage(`Intervention "${result?.title || result?.code || "Intervention"}" created.`);
    }
    setFormMode(null);
    setStartInCloseMode(false);
    setForceReadOnly(false);
    if (result?.id) {
      setSelectedInterventionId(result.id);
    }
    await refreshInterventions();
    return result;
  };

  const handleModalClose = async closeValues => {
    if (!activePlan?.id) {
      const error = new Error("Select an action plan first.");
      setErrorMessage(error.message);
      throw error;
    }
    if (!selectedIntervention) {
      const error = new Error("Select an intervention to close.");
      setErrorMessage(error.message);
      throw error;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    const result = await closeIntervention(activePlan.id, selectedIntervention.id, closeValues);
    setFormMode(null);
    setStartInCloseMode(false);
    setForceReadOnly(false);
    setSuccessMessage(
      `Intervention "${result?.title || result?.code || "Intervention"}" closed.`
    );
    if (result?.id) {
      setSelectedInterventionId(result.id);
    }
    await refreshInterventions();
    return result;
  };

  const handleActivate = async interventionToActivate => {
    if (!activePlan?.id) {
      setErrorMessage("Select an action plan before activating interventions.");
      return;
    }
    const target = interventionToActivate || selectedIntervention;
    if (!target) {
      setErrorMessage("Select an intervention to activate.");
      return;
    }
    const normalized = normaliseStatus(target.status);
    if (!["planned", "approved"].includes(normalized)) {
      setErrorMessage("Only approved or planned interventions can be activated.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await updateIntervention(activePlan.id, target.id, { status: "in_progress" });
      setSuccessMessage(
        `Intervention "${updated?.title || updated?.code || target.id}" activated.`
      );
      await refresh().catch(() => {});
      if (updated?.id) {
        setSelectedInterventionId(updated.id);
      }
    } catch (err) {
      setErrorMessage(err?.message || "Unable to activate intervention.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    setDeleteSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteIntervention(pendingDelete.id);
      setSuccessMessage(
        `Intervention "${pendingDelete.title || pendingDelete.code || pendingDelete.id}" deleted.`
      );
      if (selectedInterventionId === pendingDelete.id) {
        setSelectedInterventionId(null);
      }
      await refreshInterventions();
    } catch (error) {
      setErrorMessage(error?.message || "Unable to delete intervention.");
    } finally {
      setDeleteSubmitting(false);
      setPendingDelete(null);
    }
  };

  const tableColumns = useMemo(() => {
    const baseColumns = [
      {
        id: "code",
        header: "Type",
        cell: item => {
          const label = getTypeLabel(item);
          return (
            <Link
              href="#"
              ariaLabel={`View intervention ${label}`}
              onFollow={event => {
                event.preventDefault();
                openWizardView(item);
              }}
            >
              {label}
            </Link>
          );
        },
        isRowHeader: true,
      },
      {
        id: "status",
        header: "Status",
        cell: item => (
          <StatusIndicator type={statusIndicatorType(item.status)}>
            {getStatusDisplayLabel(item)}
          </StatusIndicator>
        ),
      },
      {
        id: "dates",
        header: "Start - End",
        cell: item => `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`,
      },
      {
        id: "outcome",
        header: "ESDC Outcome",
        cell: item => {
          const value = item.outcome !== undefined && item.outcome !== null ? String(item.outcome) : "";
          if (!value) return "-";
          return outcomeLabelMap.get(value) ?? value;
        },
      },
      {
        id: "duration",
        header: "Duration (weeks)",
        cell: item => (Number.isFinite(item.durationWeeks) ? item.durationWeeks : "-"),
      },
      {
        id: "cost",
        header: "Cost",
        cell: item => {
          const cost = getDisplayCost(item);
          if (cost.value === null) return "-";
          return (
            <Box>
              <div>{formatCurrency(cost.value)}</div>
              <div style={{ color: "var(--color-text-body-secondary)", fontSize: "12px" }}>
                ({cost.label === "actual" ? "actual" : "planned"})
              </div>
            </Box>
          );
        },
      },
      {
        id: "compliance",
        header: "Compliance",
        cell: item => (
          <SpaceBetween size="xxs" direction="horizontal">
            {renderComplianceBadge(item.compliance?.ilmp ?? "pending")}
            {renderComplianceBadge(item.compliance?.finance ?? "pending")}
          </SpaceBetween>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: item => {
          const items = getInterventionActionItems(item);
          if (!items.length) {
            return <span style={{ color: "var(--color-text-body-secondary)" }}>None</span>;
          }
          const label = getTypeLabel(item) || "intervention";
          return (
            <ButtonDropdown
              ariaLabel={`Actions for ${label}`}
              items={items}
              onItemClick={({ detail }) => {
                if (item?.id) {
                  setSelectedInterventionId(item.id);
                }
                if (detail?.id === "resume") {
                  resumeDraft(item);
                } else if (detail?.id === "view") {
                  openWizardView(item);
                } else if (detail?.id === "close") {
                  openCloseModal(item);
                } else if (detail?.id === "activate") {
                  handleActivate(item);
                } else if (detail?.id === "delete") {
                  setPendingDelete(item);
                }
              }}
              disabled={formMode !== null}
              expandToViewport
            >
              Actions
            </ButtonDropdown>
          );
        },
      },
    ];

    return baseColumns.map(column =>
      columnWidthsMap.has(column.id)
        ? { ...column, width: columnWidthsMap.get(column.id) }
        : column
    );
  }, [
    codeLabelMap,
    outcomeLabelMap,
    columnWidthsMap,
    getInterventionActionItems,
    formMode,
    openWizardView,
    openCloseModal,
    resumeDraft,
    setSelectedInterventionId,
  ]);

  const visibleColumnDefinitions = useMemo(
    () => tableColumns.filter(column => visibleColumns.includes(column.id)),
    [tableColumns, visibleColumns]
  );

  const columnPreferenceOptions = useMemo(
    () =>
      tableColumns.map(column => ({
        id: column.id,
        label: typeof column.header === "string" ? column.header : formatLabel(column.id),
        alwaysVisible: REQUIRED_COLUMN_IDS.has(column.id),
      })),
    [tableColumns]
  );

  const preferencesState = useMemo(
    () => ({
      pageSize,
      contentDisplay: columnPreferenceOptions.map(option => ({
        id: option.id,
        visible: visibleColumns.includes(option.id),
      })),
      columnWidths,
    }),
    [pageSize, columnPreferenceOptions, visibleColumns, columnWidths]
  );

  const applyColumnWidthUpdates = useCallback(entries => {
    if (!Array.isArray(entries)) {
      return;
    }
    if (entries.length === 0) {
      setColumnWidths([]);
      return;
    }
    setColumnWidths(prev => {
      const map = new Map();
      prev.forEach(item => {
        if (item && ALL_COLUMN_IDS.includes(item.id) && Number.isFinite(Number(item.width))) {
          map.set(item.id, Number(item.width));
        }
      });
      entries.forEach(entry => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const { id, width } = entry;
        if (ALL_COLUMN_IDS.includes(id) && Number.isFinite(Number(width))) {
          map.set(id, Number(width));
        }
      });
      return ALL_COLUMN_IDS.filter(id => map.has(id)).map(id => ({ id, width: map.get(id) }));
    });
  }, []);

  const handleColumnWidthsChange = useCallback(
    ({ detail }) => {
      if (!detail) {
        return;
      }
      const next = [];
      if (Array.isArray(detail.columnWidths)) {
        detail.columnWidths.forEach(entry => {
          if (!entry || typeof entry !== "object") {
            return;
          }
          const { id, width } = entry;
          if (ALL_COLUMN_IDS.includes(id) && Number.isFinite(Number(width))) {
            next.push({ id, width: Number(width) });
          }
        });
      } else if (Array.isArray(detail.widths)) {
        detail.widths.forEach((width, index) => {
          const column = visibleColumnDefinitions[index];
          if (!column) {
            return;
          }
          if (Number.isFinite(Number(width))) {
            next.push({ id: column.id, width: Number(width) });
          }
        });
      }
      if (next.length) {
        applyColumnWidthUpdates(next);
      }
    },
    [visibleColumnDefinitions, applyColumnWidthUpdates]
  );

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={preferencesState}
      pageSizePreference={{
        title: "Page size",
        options: PAGE_SIZE_OPTIONS.map(option => ({ value: option.value, label: option.label })),
      }}
      contentDisplayPreference={{
        title: "Select columns",
        options: columnPreferenceOptions,
      }}
      onConfirm={({ detail }) => {
        if (detail.pageSize && detail.pageSize !== pageSize) {
          setPageSize(detail.pageSize);
          setCurrentPageIndex(1);
        }
        if (Array.isArray(detail.contentDisplay)) {
          const nextVisible = detail.contentDisplay.filter(entry => entry.visible).map(entry => entry.id);
          const visibleSet = new Set(nextVisible);
          REQUIRED_COLUMN_IDS.forEach(id => visibleSet.add(id));
          const orderedVisible = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
          setVisibleColumns(orderedVisible);
          setCurrentPageIndex(1);
        }
        if (Array.isArray(detail.columnWidths)) {
          applyColumnWidthUpdates(detail.columnWidths);
        }
      }}
    />
  );

  const paginationComponent = (
    <Pagination
      currentPageIndex={totalMatches ? currentPageIndex : 1}
      pagesCount={pagesCount}
      disabled={pagesCount <= 1 || totalMatches === 0}
      onChange={({ detail }) => {
        setCurrentPageIndex(detail.currentPageIndex);
      }}
    />
  );

  const selectedItems = useMemo(() => {
    if (!selectedIntervention) return [];
    return paginatedInterventions.some(item => item.id === selectedIntervention.id)
      ? [selectedIntervention]
      : [];
  }, [selectedIntervention, paginatedInterventions]);

  return (
    <BoardItem
      id="case-interventions-widget"
      header={
        <Header
          variant="h2"
          info={infoLink}
          actions={
            <Button
              iconName="add-plus"
              disabled={!canModify || hasBlockingProposal}
              onClick={openDraftWizard}
            >
              Propose intervention
            </Button>
          }
        >
          {`${metadata.title ?? "Interventions"}${activePlanLabel ? ` - ${activePlanLabel}` : ""}`}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Interventions settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {successMessage && (
          <Alert
            type="success"
            dismissible
            dismissAriaLabel="Dismiss success message"
            onDismiss={() => setSuccessMessage(null)}
          >
            {successMessage}
          </Alert>
        )}
        {errorMessage && (
          <Alert
            type="error"
            dismissible
            dismissAriaLabel="Dismiss error message"
            onDismiss={() => setErrorMessage(null)}
          >
            {errorMessage}
          </Alert>
        )}
        {hasBlockingProposal && (
          <Alert type="info" header="Proposal in progress">
            A draft or submitted proposal already exists for this case. Resume it from the table before starting another.
          </Alert>
        )}
        {activePlan ? (
          <SegmentedControl
            selectedId={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={({ detail }) => setStatusFilter(detail.selectedId)}
            ariaLabel="Filter interventions by status"
            size="small"
          />
        ) : null}
        {activePlan ? (
          <Table
            trackBy="id"
            items={paginatedInterventions}
            variant="embedded"
            resizableColumns
            stickyHeader
            enableKeyboardNavigation
            selectionType="single"
            selectedItems={selectedItems}
            onSelectionChange={({ detail }) => {
              const item = detail.selectedItems?.[0];
              setSelectedInterventionId(item?.id ?? null);
            }}
            columnDefinitions={visibleColumnDefinitions}
            preferences={preferencesComponent}
            pagination={paginationComponent}
            onColumnWidthsChange={handleColumnWidthsChange}
            empty={
              <Box padding="m">
                {"No interventions defined for this action plan."}
              </Box>
            }
          />
        ) : (
          <Box padding="m">
            <StatusIndicator type="info">Select an action plan to manage interventions.</StatusIndicator>
          </Box>
        )}
      </SpaceBetween>
      <InterventionModal
        visible={formMode !== null}
        mode={formMode || "create"}
        plan={activePlan}
        intervention={formMode === "edit" ? selectedIntervention : null}
        onDismiss={handleModalDismiss}
        onSubmit={handleModalSubmit}
        onClose={canCloseSelected && !forceReadOnly ? handleModalClose : undefined}
        canClose={canCloseSelected && !forceReadOnly}
        readOnly={forceReadOnly || !canModify}
        startInCloseMode={startInCloseMode && formMode === "edit"}
        codeOptions={interventionCodes}
        codesLoading={interventionCodesLoading && interventionCodes.length === 0}
        outcomeOptions={interventionOutcomes}
        outcomesLoading={interventionOutcomesLoading && interventionOutcomes.length === 0}
        fundingStreamOptions={fundingStreams}
        fundingStreamsLoading={fundingStreamsLoading && fundingStreams.length === 0}
        nocVersions={nocVersions}
        nocVersionsLoading={nocVersionsLoading}
        onSearchNocCodes={searchNocCodes}
        planStartDate={activePlan?.startDate || activePlan?.effectiveDate || ""}
      />
      <Modal
        visible={!!pendingDelete}
        onDismiss={() => {
          if (deleteSubmitting) return;
          setPendingDelete(null);
        }}
        closeAriaLabel="Cancel delete intervention"
        header="Delete intervention"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => setPendingDelete(null)} disabled={deleteSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={deleteSubmitting}
              disabled={deleteSubmitting}
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <Box>
            Delete this intervention? Draft, submitted, in-review, changes requested, approved, rejected,
            and planned interventions can be deleted. Active or closed interventions should be closed
            instead to maintain history.
          </Box>
          {pendingDelete ? (
            <Box>
              <strong>Intervention:</strong> {pendingDelete.title || pendingDelete.code || pendingDelete.id}
            </Box>
          ) : null}
        </SpaceBetween>
      </Modal>
    </BoardItem>
  );
};

export default InterventionsWidget;
