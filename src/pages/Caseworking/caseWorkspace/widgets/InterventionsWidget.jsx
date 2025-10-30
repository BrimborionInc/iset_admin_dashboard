import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Badge,
  Box,
  ButtonDropdown,
  CollectionPreferences,
  Header,
  Link,
  Pagination,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextFilter,
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

const statusIndicatorType = status => {
  const value = (status || "").toLowerCase();
  if (value === "completed") return "success";
  if (value === "cancelled") return "stopped";
  if (value === "suspended") return "warning";
  return "info";
};

const renderComplianceBadge = status => {
  switch ((status || "").toLowerCase()) {
    case "ok":
      return <Badge color="green">OK</Badge>;
    case "warning":
      return <Badge color="blue">Warning</Badge>;
    case "error":
      return <Badge color="red">Error</Badge>;
    default:
      return <Badge color="grey">Pending</Badge>;
  }
};

const PREFERENCES_STORAGE_KEY = "caseworking-interventions-preferences-v1";
const COLUMN_WIDTHS_STORAGE_KEY = "caseworking-interventions-column-widths-v1";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [
  { label: "10 interventions", value: 10 },
  { label: "20 interventions", value: 20 },
  { label: "50 interventions", value: 50 },
];
const ALL_COLUMN_IDS = ["code", "title", "status", "dates", "outcome", "duration", "cost", "pot", "compliance"];
const REQUIRED_COLUMN_IDS = new Set(["code", "title"]);

const DEFAULT_PREFERENCES = {
  search: "",
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
    const search = typeof parsed.search === "string" ? parsed.search : DEFAULT_PREFERENCES.search;
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
      search,
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
  } = useCaseWorkspace();
  const [selectedInterventionId, setSelectedInterventionId] = useState(null);
  const [formMode, setFormMode] = useState(null);
  const [startInCloseMode, setStartInCloseMode] = useState(false);
  const [forceReadOnly, setForceReadOnly] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const initialPreferences = useMemo(() => loadStoredPreferences(), []);
  const [searchQuery, setSearchQuery] = useState(initialPreferences.search);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [visibleColumns, setVisibleColumns] = useState(initialPreferences.visibleColumns);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [columnWidths, setColumnWidths] = useState(() => loadStoredColumnWidths());
  const preloadCodesAttemptedRef = useRef(false);
  const preloadOutcomesAttemptedRef = useRef(false);

  const activePlan = useMemo(
    () => caseData?.actionPlans?.find(plan => plan.id === selectedActionPlanId),
    [caseData, selectedActionPlanId]
  );

  const normaliseStatus = status => (status || "").toLowerCase();
  const isClosedStatus = status => ["completed", "cancelled"].includes(normaliseStatus(status));
  const isOpenStatus = status => !isClosedStatus(status);

  const interventions = activePlan?.interventions ?? [];
  const selectedIntervention = useMemo(
    () => interventions.find(item => item.id === selectedInterventionId) || null,
    [interventions, selectedInterventionId]
  );

  useEffect(() => {
    setSelectedInterventionId(null);
    setFormMode(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    setStartInCloseMode(false);
    setForceReadOnly(false);
  }, [activePlan?.id]);

  useEffect(() => {
    persistPreferences({ search: searchQuery, pageSize, visibleColumns });
  }, [searchQuery, pageSize, visibleColumns]);

  useEffect(() => {
    persistColumnWidths(columnWidths);
  }, [columnWidths]);

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [searchQuery, activePlan?.id]);

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
      const padded = valueStr.length === 1 ? `0${valueStr}` : valueStr;
      map.set(valueStr, `${padded} - ${label}`);
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

  const filteredInterventions = useMemo(() => {
    const text = searchQuery.trim().toLowerCase();
    if (!text) {
      return interventions;
    }
    return interventions.filter(item => {
      const codeLabel = codeLabelMap.get(String(item.code ?? "")) ?? String(item.code ?? "");
      const outcomeLabel = outcomeLabelMap.get(String(item.outcome ?? "")) ?? String(item.outcome ?? "");
      const haystack = [
        codeLabel,
        item.title,
        item.description,
        item.status,
        outcomeLabel,
        item.potId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(text);
    });
  }, [interventions, searchQuery, codeLabelMap, outcomeLabelMap]);

  const totalMatches = filteredInterventions.length;
  const pagesCount = totalMatches ? Math.ceil(totalMatches / pageSize) : 1;

  useEffect(() => {
    if (currentPageIndex > pagesCount) {
      setCurrentPageIndex(pagesCount);
    }
  }, [currentPageIndex, pagesCount]);

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

  const planStatus = (activePlan?.status || "").toLowerCase();
  const canModify = !!activePlan && ["draft", "active"].includes(planStatus);
  const canCloseSelected =
    canModify &&
    !!selectedIntervention &&
    isOpenStatus(selectedIntervention?.status);
  const canViewSelected = !!selectedIntervention;

  const openCreateModal = () => {
    if (!activePlan) {
      setErrorMessage("Select an action plan before adding interventions.");
      return;
    }
    setStartInCloseMode(false);
    setForceReadOnly(false);
    setSuccessMessage(null);
    setErrorMessage(null);
    setFormMode("create");
  };

  const openViewModal = (interventionToView = null) => {
    if (!activePlan) {
      setErrorMessage("Select an action plan before viewing interventions.");
      return;
    }
    const target = interventionToView || selectedIntervention;
    if (!target) {
      setErrorMessage("Select an intervention to view.");
      return;
    }
    setStartInCloseMode(false);
    setForceReadOnly(!canModify || !isOpenStatus(target.status));
    setSuccessMessage(null);
    setErrorMessage(null);
    if (!selectedIntervention || target.id !== selectedInterventionId) {
      setSelectedInterventionId(target.id);
    }
    setFormMode("edit");
  };

  const openCloseModal = () => {
    if (!activePlan) {
      setErrorMessage("Select an action plan before closing interventions.");
      return;
    }
    if (!selectedIntervention) {
      setErrorMessage("Select an intervention to close.");
      return;
    }
    if (!canCloseSelected) {
      setErrorMessage(
        "Interventions that are already completed or cancelled cannot be closed again."
      );
      return;
    }
    setSuccessMessage(null);
    setErrorMessage(null);
    setForceReadOnly(false);
    setStartInCloseMode(true);
    setFormMode("edit");
  };

  const handleActionDropdown = ({ detail }) => {
    switch (detail?.id) {
      case "add":
        openCreateModal();
        break;
      case "view":
        openViewModal();
        break;
      case "close":
        openCloseModal();
        break;
      default:
        break;
    }
  };

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
    return result;
  };

  const tableColumns = useMemo(() => {
    const baseColumns = [
      {
        id: "code",
        header: "Code",
        cell: item => {
          const value = item.code !== undefined && item.code !== null ? String(item.code) : "";
          if (!value) return "-";
          const label = codeLabelMap.get(value) ?? value;
          return (
            <Link
              href="#"
              ariaLabel={`View intervention ${label}`}
              onFollow={event => {
                event.preventDefault();
                openViewModal(item);
              }}
            >
              {label}
            </Link>
          );
        },
        isRowHeader: true,
      },
      {
        id: "title",
        header: "Description",
        cell: item =>
          item.title ? (
            <Link
              href="#"
              ariaLabel={`View intervention ${item.title}`}
              onFollow={event => {
                event.preventDefault();
                openViewModal(item);
              }}
            >
              {item.title}
            </Link>
          ) : (
            "-"
          ),
      },
      {
        id: "status",
        header: "Status",
        cell: item => (
          <StatusIndicator type={statusIndicatorType(item.status)}>
            {formatLabel(item.status)}
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
      { id: "cost", header: "Cost", cell: item => formatCurrency(item.cost) },
      { id: "pot", header: "Budget pot", cell: item => item.potId ?? "Unmapped" },
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
    ];

    return baseColumns.map(column =>
      columnWidthsMap.has(column.id)
        ? { ...column, width: columnWidthsMap.get(column.id) }
        : column
    );
  }, [codeLabelMap, outcomeLabelMap, columnWidthsMap]);

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

  const countText = `${totalMatches} ${totalMatches === 1 ? "intervention" : "interventions"}`;

  const filterComponent = (
    <TextFilter
      filteringText={searchQuery}
      filteringPlaceholder="Search interventions"
      countText={countText}
      onChange={({ detail }) => setSearchQuery(detail.filteringText || "")}
    />
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
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={
            metadata.description ??
            "Manage ILMP-compliant intervention data, including budget pots and outcomes."
          }
          actions={
            <ButtonDropdown
              variant="primary"
              disabled={!canModify && !canViewSelected && !canCloseSelected}
              onItemClick={handleActionDropdown}
              items={[
                { id: "add", text: "Add intervention", disabled: !canModify },
                { id: "view", text: "View intervention", disabled: !canViewSelected },
                { id: "close", text: "Close intervention", disabled: !canCloseSelected },
              ]}
            >
              Actions
            </ButtonDropdown>
          }
        >
          {metadata.title ?? "Interventions"}
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
            onRowClick={({ detail }) => {
              const item = detail?.item;
              if (!item?.id) return;
              setSelectedInterventionId(item.id);
            }}
            columnDefinitions={visibleColumnDefinitions}
            filter={filterComponent}
            preferences={preferencesComponent}
            pagination={paginationComponent}
            onColumnWidthsChange={handleColumnWidthsChange}
            empty={
              <Box padding="m">
                {interventions.length
                  ? "No interventions match your current filters."
                  : "No interventions defined for this action plan."}
              </Box>
            }
            header={<Header variant="h3" counter={`(${totalMatches})`}>Interventions</Header>}
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
      />
    </BoardItem>
  );
};

export default InterventionsWidget;
