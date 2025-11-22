import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Box,
  Button,
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
import NewActionPlanModal from "../modals/NewActionPlanModal.jsx";
import CloseActionPlanModal from "../modals/CloseActionPlanModal.jsx";
import ConfirmActionPlanModal from "../modals/ConfirmActionPlanModal.jsx";
import ActionPlanDetailsModal from "../modals/ActionPlanDetailsModal.jsx";

const formatLabel = value => {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

const formatDate = value => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};

const getStatusType = status => {
  switch ((status || "").toLowerCase()) {
    case "draft":
      return "pending";
    case "active":
      return "info";
    case "closed":
      return "success";
    default:
      return "info";
  }
};

const getPlanActions = status => {
  const actions = [{ id: "view", text: "View action plan" }];
  switch ((status || "").toLowerCase()) {
    case "draft":
      actions.push(
        { id: "activate", text: "Activate plan" },
        { id: "delete", text: "Delete plan" }
      );
      break;
    case "active":
      actions.push({ id: "close", text: "Close plan" });
      break;
    default:
      break;
  }
  return actions;
};

const PREFERENCES_STORAGE_KEY = "caseworking-action-plans-preferences-v1";
const COLUMN_WIDTHS_STORAGE_KEY = "caseworking-action-plans-column-widths-v1";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [
  { label: "10 plans", value: 10 },
  { label: "20 plans", value: 20 },
  { label: "50 plans", value: 50 },
];
const ALL_COLUMN_IDS = ["title", "dates", "status", "result", "interventions", "actions"];
const REQUIRED_COLUMN_IDS = new Set(["title", "actions"]);

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
    console.warn("[ActionPlansWidget] failed to read stored preferences", error);
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
    console.warn("[ActionPlansWidget] failed to persist preferences", error);
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
    console.warn("[ActionPlansWidget] failed to read stored column widths", error);
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
    console.warn("[ActionPlansWidget] failed to persist column widths", error);
  }
};

const ActionPlansWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    caseData,
    selectedActionPlanId,
    setSelectedActionPlanId,
    refresh,
    activateActionPlan,
    closeActionPlan,
    deleteActionPlan,
  } = useCaseWorkspace();
  const [modalVisible, setModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [closeModalPlan, setCloseModalPlan] = useState(null);
  const [detailsModalPlan, setDetailsModalPlan] = useState(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [closeError, setCloseError] = useState(null);

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

  const buildOpenInterventionMessage = useCallback(
    (items, planId) => {
      if (!Array.isArray(items) || items.length === 0) return null;
      return (
        <SpaceBetween size="xs">
          <span>Close or cancel the following interventions before closing this action plan:</span>
          <Box as="ul" margin={{ left: "l" }}>
            {items.map(item => {
              const code = item.code ? String(item.code).trim() : "";
              const labelParts = [];
              if (code) labelParts.push(code);
              if (item.title) labelParts.push(item.title);
              const display = labelParts.join(" – ") || `Intervention ${item.id}`;
              const statusLabel = formatLabel(item.status) || "Status unknown";
              return (
                <li key={item.id}>
                  <Link
                    href="#case-interventions-widget"
                    onFollow={event => {
                      event.preventDefault();
                      focusIntervention(planId, item.id);
                    }}
                  >
                    {display}
                  </Link>
                  {` (${statusLabel})`}
                </li>
              );
            })}
          </Box>
        </SpaceBetween>
      );
    },
    [focusIntervention]
  );

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Action plans", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const plans = caseData?.actionPlans ?? [];

  const sortedPlans = useMemo(() => {
    const toTimestamp = value => {
      if (!value) return null;
      const date = new Date(value);
      const time = date.getTime();
      return Number.isFinite(time) ? time : null;
    };
    const score = plan =>
      toTimestamp(plan.createdAt) ??
      toTimestamp(plan.updatedAt) ??
      toTimestamp(plan.activatedAt) ??
      toTimestamp(plan.startDate) ??
      0;
    return [...plans].sort((a, b) => {
      const scoreA = score(a);
      const scoreB = score(b);
      if (scoreA === scoreB) {
        return (b.title || "").localeCompare(a.title || "");
      }
      return scoreB - scoreA;
    });
  }, [plans]);

  const initialPreferences = useMemo(() => loadStoredPreferences(), []);
  const [searchQuery, setSearchQuery] = useState(initialPreferences.search);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [visibleColumns, setVisibleColumns] = useState(initialPreferences.visibleColumns);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [columnWidths, setColumnWidths] = useState(() => loadStoredColumnWidths());

  useEffect(() => {
    persistPreferences({ search: searchQuery, pageSize, visibleColumns });
  }, [searchQuery, pageSize, visibleColumns]);

  useEffect(() => {
    persistColumnWidths(columnWidths);
  }, [columnWidths]);

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [searchQuery]);

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

  const filteredPlans = useMemo(() => {
    const text = searchQuery.trim().toLowerCase();
    if (!text) {
      return sortedPlans;
    }
    return sortedPlans.filter(plan => {
      const haystack = [
        plan.title,
        plan.status,
        plan.resultCode,
        plan.ownerName,
        plan.ownerEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(text);
    });
  }, [plans, searchQuery]);

  const totalMatches = filteredPlans.length;
  const pagesCount = totalMatches ? Math.ceil(totalMatches / pageSize) : 1;

  useEffect(() => {
    if (currentPageIndex > pagesCount) {
      setCurrentPageIndex(pagesCount);
    }
  }, [currentPageIndex, pagesCount]);

  const paginatedPlans = useMemo(() => {
    if (!filteredPlans.length) {
      return [];
    }
    const startIndex = (currentPageIndex - 1) * pageSize;
    return filteredPlans.slice(startIndex, startIndex + pageSize);
  }, [filteredPlans, currentPageIndex, pageSize]);

  const handleActionFeedback = message => {
    setSuccessMessage(message);
    setErrorMessage(null);
  };

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const handleCreated = plan => {
    handleActionFeedback(plan?.name ? `Action plan "${plan.name}" created.` : "Action plan created.");
    if (plan?.id) {
      setSelectedActionPlanId(plan.id);
    }
    refresh().catch(() => {});
  };

  const handlePlanAction = useCallback(
    (actionId, plan) => {
      if (!plan || !actionId) return;
      setErrorMessage(null);
      setSuccessMessage(null);
      if (actionId === "view") {
        setDetailsModalPlan(plan);
      } else if (actionId === "activate") {
        setPendingConfirm({ type: "activate", plan });
      } else if (actionId === "close") {
        const openInterventions = (plan.interventions || []).filter(item => {
          const status = (item?.status || "").toLowerCase();
          return status !== "completed" && status !== "cancelled";
        });
        if (openInterventions.length > 0) {
          const message = buildOpenInterventionMessage(openInterventions, plan.id);
          setCloseModalPlan(null);
          setCloseError(null);
          setErrorMessage(
            message || "Close or cancel all interventions before closing this action plan."
          );
          return;
        }
        setCloseError(null);
        setCloseModalPlan(plan);
      } else if (actionId === "delete") {
        setPendingConfirm({ type: "delete", plan });
      }
    },
    [buildOpenInterventionMessage]
  );

  const executePendingAction = async () => {
    if (!pendingConfirm) return;
    const { type, plan } = pendingConfirm;
    setActionSubmitting(true);
    try {
      if (type === "activate") {
        const updated = await activateActionPlan(plan.id);
        handleActionFeedback(`Action plan "${updated?.name || plan.title}" activated.`);
        setSelectedActionPlanId(updated?.id || plan.id);
      } else if (type === "delete") {
        await deleteActionPlan(plan.id);
        handleActionFeedback(`Action plan "${plan.name || plan.title}" deleted.`);
        if (selectedActionPlanId === plan.id) {
          setSelectedActionPlanId(null);
        }
      }
      await refresh().catch(() => {});
    } catch (error) {
      if (error?.code === "open_interventions_block_delete" && Array.isArray(error.interventions)) {
        const message = buildOpenInterventionMessage(error.interventions, plan.id);
        setErrorMessage(
          message || "Delete the plan's interventions before deleting this action plan."
        );
      } else {
        setErrorMessage(error?.message || "Unable to update action plan.");
      }
    } finally {
      setActionSubmitting(false);
      setPendingConfirm(null);
    }
  };

  const handleCloseSubmit = async payload => {
    if (!closeModalPlan) return;
    setCloseSubmitting(true);
    setCloseError(null);
    try {
      const updated = await closeActionPlan(closeModalPlan.id, payload);
      handleActionFeedback(`Action plan "${updated?.name || closeModalPlan.title}" closed.`);
      await refresh().catch(() => {});
      setCloseModalPlan(null);
    } catch (error) {
      if (error?.code === "open_interventions_block_close" && Array.isArray(error.openInterventions)) {
        const message = buildOpenInterventionMessage(
          error.openInterventions,
          closeModalPlan?.id || error.planId || null
        );
        setCloseError(
          message || "Close or cancel all interventions before closing this action plan."
        );
      } else {
        setCloseError(error?.message || "Unable to close action plan.");
      }
    } finally {
      setCloseSubmitting(false);
    }
  };

  const handleCloseDismiss = () => {
    if (closeSubmitting) return;
    setCloseModalPlan(null);
    setCloseError(null);
  };

  const viewPlan = useCallback(
    plan => {
      if (!plan) return;
      if (plan.id) {
        setSelectedActionPlanId(plan.id);
      }
      handlePlanAction("view", plan);
    },
    [handlePlanAction, setSelectedActionPlanId]
  );

  const tableColumns = useMemo(() => {
    const baseColumns = [
      {
        id: "title",
        header: "Plan",
        cell: item => {
          const title = item.title || "Untitled";
          return (
            <Link
              href="#"
              ariaLabel={`View action plan ${title}`}
              onFollow={event => {
                event.preventDefault();
                viewPlan(item);
              }}
            >
              {title}
            </Link>
          );
        },
        isRowHeader: true,
      },
      {
        id: "dates",
        header: "Dates",
        cell: item => `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`,
      },
      {
        id: "status",
        header: "Status",
        cell: item => (
          <StatusIndicator type={getStatusType(item.status)}>
            {formatLabel(item.status || "unknown")}
          </StatusIndicator>
        ),
      },
      {
        id: "result",
        header: "Result",
        cell: item => {
          if (!item.resultCode) return "-";
          return (
            <SpaceBetween size="xxs">
              <span>{formatLabel(item.resultCode)}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-body-secondary)" }}>
                {formatDate(item.resultDate)}
              </span>
            </SpaceBetween>
          );
        },
      },
      {
        id: "interventions",
        header: "Interventions",
        cell: item =>
          Number.isFinite(item.interventionCount)
            ? item.interventionCount
            : item.interventions
            ? item.interventions.length
            : 0,
      },
      {
        id: "actions",
        header: "Actions",
        cell: item => {
          const items = getPlanActions(item.status);
          if (!items.length) {
            return <span style={{ color: "var(--color-text-body-secondary)" }}>None</span>;
          }
          const disabled = actionSubmitting || closeSubmitting;
          return (
            <ButtonDropdown
              ariaLabel={`Actions for ${item.title}`}
              items={items}
              onItemClick={({ detail }) => handlePlanAction(detail.id, item)}
              disabled={disabled}
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
  }, [actionSubmitting, closeSubmitting, columnWidthsMap, handlePlanAction, viewPlan]);

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

  const countText = `${totalMatches} ${totalMatches === 1 ? "plan" : "plans"}`;

  const filterComponent = (
    <TextFilter
      filteringText={searchQuery}
      filteringPlaceholder="Search action plans"
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

  const selectedItems = useMemo(
    () => paginatedPlans.filter(plan => plan.id === selectedActionPlanId),
    [paginatedPlans, selectedActionPlanId]
  );

  const confirmContent = useMemo(() => {
    if (!pendingConfirm) return null;
    const planName = pendingConfirm.plan?.title || "this action plan";
    if (pendingConfirm.type === "activate") {
      return {
        title: "Activate action plan",
        message: `Activate "${planName}"? Only one action plan can be active at a time. Active plans cannot be deleted; close them instead.`,
        confirmLabel: "Activate",
      };
    }
    if (pendingConfirm.type === "delete") {
      return {
        title: "Delete action plan",
        message:
          `Delete "${planName}"? Only draft plans without interventions can be deleted. This action will remove the draft and requires confirmation.`,
        confirmLabel: "Delete",
      };
    }
    return null;
  }, [pendingConfirm]);

  const handleDetailsSaved = async updated => {
    setDetailsModalPlan(null);
    handleActionFeedback(`Action plan "${updated?.name || updated?.title || "Plan"}" updated.`);
    await refresh().catch(() => {});
  };

  const handleDetailsDismiss = () => {
    if (actionSubmitting || closeSubmitting) return;
    setDetailsModalPlan(null);
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description ?? "Manage action plans and select one to edit interventions."}
          actions={
            <Button iconName="add-plus" onClick={() => setModalVisible(true)}>
              New action plan
            </Button>
          }
        >
          {metadata.title ?? "Action plans"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Action plans settings"
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
        <Table
          trackBy="id"
          variant="embedded"
          resizableColumns
          selectionType="single"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => {
            const plan = detail?.selectedItems?.[0];
            if (plan?.id) {
              setSelectedActionPlanId(plan.id);
            }
          }}
          columnDefinitions={visibleColumnDefinitions}
          items={paginatedPlans}
          filter={filterComponent}
          preferences={preferencesComponent}
          pagination={paginationComponent}
          onColumnWidthsChange={handleColumnWidthsChange}
          empty={
            <Box padding="m">
              {sortedPlans.length
                ? "No action plans match your current filters."
                : "No action plans defined yet."}
            </Box>
          }
          header={<Header variant="h3" counter={`(${totalMatches})`}>Action plans</Header>}
        />
      </SpaceBetween>
      {modalVisible && (
        <NewActionPlanModal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          onCreated={plan => {
            setModalVisible(false);
            handleCreated(plan);
          }}
        />
      )}
      <CloseActionPlanModal
        visible={!!closeModalPlan}
        plan={closeModalPlan}
        submitting={closeSubmitting}
        error={closeError}
        onSubmit={handleCloseSubmit}
        onDismiss={handleCloseDismiss}
      />
      <ActionPlanDetailsModal
        visible={!!detailsModalPlan}
        plan={detailsModalPlan}
        onDismiss={handleDetailsDismiss}
        onSaved={handleDetailsSaved}
      />
      <ConfirmActionPlanModal
        visible={!!pendingConfirm}
        title={confirmContent?.title || ""}
        message={confirmContent?.message || ""}
        confirmLabel={confirmContent?.confirmLabel || "Confirm"}
        submitting={actionSubmitting}
        onConfirm={executePendingAction}
        onDismiss={() => {
          if (actionSubmitting) return;
          setPendingConfirm(null);
        }}
      />
    </BoardItem>
  );
};

export default ActionPlansWidget;
