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
  Hotspot,
  Link,
  Modal,
  Pagination,
  Select,
  SpaceBetween,
  StatusIndicator,
  Table,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import InterventionModal from "../modals/InterventionModal.jsx";
import {
  formatInterventionStatusLabel,
  isInterventionActivatableStatus,
  isInterventionClosedStatus,
  isInterventionClosableStatus,
  isInterventionDeletableStatus,
  isInterventionProposalStatus,
  isInterventionApprovalLetterFollowUpPending,
  resolveInterventionApprovalLetterFollowUp,
  normalizeInterventionStatus,
  resolveInterventionStateFields,
} from "../../../../utils/interventionStatus.js";

const formatCurrency = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
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

const formatDateRange = (startValue, endValue) => {
  const startLabel = formatDate(startValue);
  const endLabel = formatDate(endValue);
  if (startLabel === "-" && endLabel === "-") return "-";
  if (endLabel === "-" || startLabel === endLabel) return startLabel;
  if (startLabel === "-") return endLabel;
  return `${startLabel} - ${endLabel}`;
};

const toTimestamp = value => {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
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

const getEiStatusValue = item => {
  const metadata = parseMetadata(item?.metadata);
  const review = metadata?.review || {};
  return review.eiStatus || review.ei_status || "";
};

const formatEiStatusLabel = value => {
  if (!value) return "";
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized === "crf") return "CRF";
  if (normalized === "ei active claim" || normalized === "ei active") return "EI Active Claim";
  if (normalized === "ei reach back" || normalized === "ei reachback" || normalized === "reach back" || normalized === "reachback") {
    return "EI Reach Back";
  }
  return String(value).trim();
};

const getRevisionMetadata = item => {
  const metadata = parseMetadata(item?.metadata);
  const revision = metadata?.revision;
  return revision && typeof revision === "object" ? revision : null;
};

const getRevisionSourceInterventionId = item => {
  const revision = getRevisionMetadata(item);
  const sourceId = revision?.sourceInterventionId ?? revision?.source_intervention_id ?? null;
  return sourceId ? String(sourceId) : null;
};

const getStatusDisplayLabel = item => {
  const state = resolveInterventionStateFields(item);
  if (state.reviewStatus === "submitted" && !state.deliveryStatus) {
    const eiStatusLabel = formatEiStatusLabel(getEiStatusValue(item));
    return `Submitted - ${eiStatusLabel || "Awaiting EI status verification"}`;
  }
  const approvalLetterFollowUp = resolveInterventionApprovalLetterFollowUp(item);
  if (approvalLetterFollowUp.eligible && !approvalLetterFollowUp.letterSent) {
    return approvalLetterFollowUp.isRevision
      ? "Revision approved - letter pending"
      : "Approved - letter pending";
  }
  return formatInterventionStatusLabel(item);
};

const getInterventionRelationshipStatus = (item, openRevisionDraftsBySourceId) => {
  const revisionSourceInterventionId = getRevisionSourceInterventionId(item);
  if (revisionSourceInterventionId) {
    return {
      badgeText: "Revision",
      badgeColor: "blue",
    };
  }

  const relatedRevision =
    item?.id && openRevisionDraftsBySourceId instanceof Map
      ? openRevisionDraftsBySourceId.get(String(item.id))
      : null;
  if (!relatedRevision?.id) return null;

  const revisionState = resolveInterventionStateFields(relatedRevision);
  const badgeText =
    revisionState.reviewStatus === "draft"
      ? "Revision draft"
      : revisionState.reviewStatus === "changes_requested"
        ? "Revision changes requested"
        : "Revision pending";
  return {
    badgeText,
    badgeColor: "blue",
  };
};

const getComparableStatus = item => {
  const state = resolveInterventionStateFields(item);
  return state.effectiveStatus || normalizeInterventionStatus(item?.status ?? item, null);
};
const isDraftStatus = status => resolveInterventionStateFields(status).reviewStatus === "draft";
const isProposalWorkflowOpen = intervention =>
  isInterventionProposalStatus(intervention) ||
  isInterventionApprovalLetterFollowUpPending(intervention);
const isBlockingProposalStatus = intervention => isProposalWorkflowOpen(intervention);
const isRevisionEligibleStatus = status =>
  ["approved", "in_progress", "suspended"].includes(getComparableStatus(status));

const statusIndicatorType = status => {
  if (isInterventionApprovalLetterFollowUpPending(status)) return "warning";
  const value = getComparableStatus(status);
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
  const closed = isInterventionClosedStatus(item);
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
  { id: "rejected", text: "Denied" },
  { id: "approved", text: "Approved" },
  { id: "in_progress", text: "In progress" },
  { id: "closed", text: "Closed" },
];
const ALL_COLUMN_IDS = [
  "code",
  "cost",
  "status",
  "dates",
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
    reviseIntervention,
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
  const statusFilterOptions = useMemo(
    () => STATUS_FILTER_OPTIONS.map(option => ({ value: option.id, label: option.text })),
    []
  );
  const selectedStatusOption =
    statusFilterOptions.find(option => option.value === statusFilter) || statusFilterOptions[0];

  const activePlan = useMemo(
    () => caseData?.actionPlans?.find(plan => plan.id === selectedActionPlanId),
    [caseData, selectedActionPlanId]
  );
  const prevPlanIdRef = useRef(activePlan?.id ?? null);
  const activePlanRef = useRef(activePlan);
  const hasBlockingProposal = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.some(plan =>
      (plan.interventions || []).some(intervention => isBlockingProposalStatus(intervention))
    );
  }, [caseData]);
  const hasOpenProposal = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.some(plan =>
      (plan.interventions || []).some(intervention => isProposalWorkflowOpen(intervention))
    );
  }, [caseData]);
  const latestBlockingProposal = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    let selected = null;
    plans.forEach(plan => {
      (plan.interventions || []).forEach(intervention => {
        if (!isProposalWorkflowOpen(intervention)) return;
        const score =
          toTimestamp(intervention?.updatedAt) ??
          toTimestamp(intervention?.createdAt) ??
          0;
        if (!selected || score >= selected.score) {
          selected = {
            score,
            planId: plan?.id ?? null,
            interventionId: intervention?.id ?? null,
          };
        }
      });
    });
    return selected;
  }, [caseData]);
  const openRevisionDraftsBySourceId = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    const map = new Map();
    plans.forEach(plan => {
      (plan.interventions || []).forEach(intervention => {
        if (!isInterventionProposalStatus(intervention)) return;
        const revisionMetadata = parseMetadata(intervention?.metadata)?.revision;
        const sourceInterventionId = revisionMetadata?.sourceInterventionId;
        if (!sourceInterventionId) return;
        const existing = map.get(String(sourceInterventionId));
        const existingTime = new Date(existing?.updatedAt || existing?.createdAt || 0).getTime();
        const nextTime = new Date(intervention?.updatedAt || intervention?.createdAt || 0).getTime();
        if (!existing || nextTime >= existingTime) {
          map.set(String(sourceInterventionId), intervention);
        }
      });
    });
    return map;
  }, [caseData]);

  const interventions = activePlan?.interventions ?? [];
  const selectedIntervention = useMemo(
    () => interventions.find(item => item.id === selectedInterventionId) || null,
    [interventions, selectedInterventionId]
  );
  const selectedInterventionPendingRevision = useMemo(() => {
    if (!selectedIntervention || isInterventionProposalStatus(selectedIntervention)) return null;
    return openRevisionDraftsBySourceId.get(String(selectedIntervention.id)) || null;
  }, [openRevisionDraftsBySourceId, selectedIntervention]);
  const selectedInterventionPendingRevisionStatusLabel = useMemo(
    () =>
      selectedInterventionPendingRevision
        ? getStatusDisplayLabel(selectedInterventionPendingRevision)
        : null,
    [selectedInterventionPendingRevision]
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
      const value = getComparableStatus(item);
      if (statusFilter === "closed") {
        return isInterventionClosedStatus(item);
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
    canModify && !!selectedIntervention && isInterventionClosableStatus(selectedIntervention);
  const activePlanHasBlockingProposal = useMemo(
    () =>
      !!activePlan &&
      (activePlan.interventions || []).some(intervention => isProposalWorkflowOpen(intervention)),
    [activePlan]
  );

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
    [dispatchWizardSelection, setSelectedInterventionId]
  );

  const focusIntervention = useCallback(
    (planId, interventionId) => {
      if (!planId || !interventionId) return;
      if (typeof setSelectedActionPlanId === "function") {
        setSelectedActionPlanId(planId);
      }
      requestAnimationFrame(() => {
        const container = document.getElementById("case-interventions-widget");
        if (container?.scrollIntoView) {
          container.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        window.dispatchEvent(
          new CustomEvent("iset:focus-intervention", {
            detail: { planId, interventionId },
          })
        );
      });
    },
    [setSelectedActionPlanId]
  );

  const focusBlockingProposal = useCallback(() => {
    if (!latestBlockingProposal?.planId || !latestBlockingProposal?.interventionId) return;
    focusIntervention(latestBlockingProposal.planId, latestBlockingProposal.interventionId);
  }, [focusIntervention, latestBlockingProposal]);

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
      const approvalLetterFollowUp = resolveInterventionApprovalLetterFollowUp(intervention);
      if (approvalLetterFollowUp.eligible) {
        items.push({
          id: "approval-letter",
          text: approvalLetterFollowUp.letterSent
            ? "View approval follow-up"
            : approvalLetterFollowUp.isRevision
              ? "Prepare funding revision letter"
              : "Prepare approval letters",
        });
      }
      if (canModify) {
        const normalized = getComparableStatus(intervention);
        const matchingRevisionDraft = intervention?.id
          ? openRevisionDraftsBySourceId.get(String(intervention.id))
          : null;
        if (isRevisionEligibleStatus(normalized) && (matchingRevisionDraft || !hasOpenProposal)) {
          items.push({
            id: "revise",
            text: matchingRevisionDraft ? "Resume revision draft" : "Revise approved intervention",
          });
        }
        if (isInterventionActivatableStatus(intervention)) {
          items.push({ id: "activate", text: "Activate intervention" });
        }
        if (isInterventionClosableStatus(intervention)) {
          items.push({ id: "close", text: "Close intervention" });
        }
        if (isInterventionDeletableStatus(intervention)) {
          items.push({ id: "delete", text: "Delete intervention" });
        }
      }
      return items;
    },
    [canModify, hasOpenProposal, openRevisionDraftsBySourceId]
  );

  const openDraftWizard = () => {
    if (!activePlan) {
      setErrorMessage("Select an action plan before starting a proposal.");
      return;
    }
    if (hasBlockingProposal) {
      setErrorMessage("A proposal is already in progress. Resume it from the table.");
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
      if (isInterventionProposalStatus(target)) {
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
      if (!canModify || !isInterventionClosableStatus(target)) {
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
    if (!isInterventionActivatableStatus(target)) {
      setErrorMessage("Only approved interventions can be activated.");
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await updateIntervention(activePlan.id, target.id, { deliveryStatus: "in_progress" });
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

  const handleReviseIntervention = useCallback(
    async interventionToRevise => {
      const target = interventionToRevise || selectedIntervention;
      if (!target?.id) {
        setErrorMessage("Select an intervention to revise.");
        return;
      }
      const existingRevisionDraft = openRevisionDraftsBySourceId.get(String(target.id));
      setErrorMessage(null);
      setSuccessMessage(null);
      if (existingRevisionDraft?.id) {
        openInterventionInWizard(existingRevisionDraft);
        return;
      }
      if (hasOpenProposal) {
        setErrorMessage("A proposal is already in progress. Resume it from the table.");
        return;
      }
      try {
        const draft = await reviseIntervention(target.id);
        if (draft?.actionPlanId && typeof setSelectedActionPlanId === "function") {
          setSelectedActionPlanId(draft.actionPlanId);
        }
        if (draft?.id) {
          openInterventionInWizard(draft);
          setSuccessMessage(
            `Revision draft opened for "${target.title || target.code || "Intervention"}".`
          );
          return;
        }
        setErrorMessage("Unable to open the revision draft.");
      } catch (err) {
        setErrorMessage(err?.message || "Unable to start intervention revision.");
      }
    },
    [
      hasOpenProposal,
      openInterventionInWizard,
      openRevisionDraftsBySourceId,
      reviseIntervention,
      selectedIntervention,
      setSelectedActionPlanId,
    ]
  );

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
        id: "status",
        header: "Status",
        cell: item => {
          const relationshipStatus = getInterventionRelationshipStatus(item, openRevisionDraftsBySourceId);
          return (
            <SpaceBetween size="xxs">
              <StatusIndicator type={statusIndicatorType(item)}>
                {getStatusDisplayLabel(item)}
              </StatusIndicator>
              {relationshipStatus ? (
                <Badge color={relationshipStatus.badgeColor}>{relationshipStatus.badgeText}</Badge>
              ) : null}
            </SpaceBetween>
          );
        },
      },
      {
        id: "dates",
        header: "Start - End",
        cell: item => formatDateRange(item.startDate, item.endDate),
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
            <span
              onClick={event => event.stopPropagation()}
              onMouseDown={event => event.stopPropagation()}
              onKeyDown={event => event.stopPropagation()}
            >
              <ButtonDropdown
                ariaLabel={`Actions for ${label}`}
                items={items}
                onItemClick={({ detail }) => {
                  if (item?.id) {
                    setSelectedInterventionId(item.id);
                  }
                  if (detail?.id === "resume") {
                    resumeDraft(item);
                  } else if (detail?.id === "revise") {
                    handleReviseIntervention(item);
                  } else if (detail?.id === "view") {
                    openWizardView(item);
                  } else if (detail?.id === "approval-letter") {
                    openInterventionInWizard(item);
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
            </span>
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
    columnWidthsMap,
    getInterventionActionItems,
    formMode,
    handleReviseIntervention,
    openRevisionDraftsBySourceId,
    openWizardView,
    openInterventionInWizard,
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
            <SpaceBetween direction="horizontal" size="s">
              <Select
                selectedOption={selectedStatusOption}
                onChange={({ detail }) => setStatusFilter(detail.selectedOption?.value || "all")}
                options={statusFilterOptions}
                placeholder="Filter status"
                disabled={!activePlan}
                ariaLabel="Filter interventions by status"
              />
              <Button
                iconName="add-plus"
                disabled={!canModify || hasBlockingProposal}
                onClick={openDraftWizard}
              >
                Propose intervention
              </Button>
            </SpaceBetween>
          }
        >
          <Hotspot hotspotId="case-workspace-interventions" direction="right" />
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
          <Alert
            type="info"
            header="Proposal in progress"
            action={
              latestBlockingProposal?.planId &&
              latestBlockingProposal?.interventionId &&
              !activePlanHasBlockingProposal ? (
                <Button onClick={focusBlockingProposal}>Go to proposal</Button>
              ) : null
            }
          >
            A proposal is already in progress for this case. Complete its approval-letter follow-up before starting another proposal or revision.
          </Alert>
        )}
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
              if (item) {
                const isProposal = isInterventionProposalStatus(item);
                if (isProposal) {
                  openInterventionInWizard(item);
                }
              }
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
        pendingRevision={selectedInterventionPendingRevision}
        pendingRevisionStatusLabel={selectedInterventionPendingRevisionStatusLabel}
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
            Delete this intervention? Draft, submitted, in-review, changes requested, approved,
            and denied interventions can be deleted. Deleting will also remove any draft payment packages
            and budget cost items tied to this intervention. Active or closed interventions should be closed
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
