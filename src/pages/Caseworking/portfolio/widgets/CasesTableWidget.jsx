import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  CollectionPreferences,
  FormField,
  Header,
  Link,
  Modal,
  Pagination,
  Select,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextFilter,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { usePortfolioCases } from "../PortfolioCaseContext.jsx";
import useCurrentUser from "../../../../hooks/useCurrentUser.js";
import { apiFetch } from "../../../../auth/apiClient.js";
import { getCaseStatusBadgeColor, getCaseStatusLabel } from "../../../../utils/caseStatus.js";
import useCasesData from "../hooks/useCasesData.js";
const COLUMN_WIDTHS_KEY = "iset-portfolio-cases-table-widths-v2";
const PREFERENCES_KEY = "iset-portfolio-cases-table-preferences-v2";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 rows" },
  { value: 10, label: "10 rows" },
  { value: 20, label: "20 rows" },
  { value: 9999, label: "Show All" },
];
const DEFAULT_STATUS_FILTERS = [
  "initiated",
  "active",
  "dormant",
  "ready_to_close",
  "closed",
  "archived",
];
const CLIENT_CATEGORY_OPTIONS = [
  { label: "Show Open Clients", value: "active" },
  { label: "Show Funded Clients", value: "funded" },
  { label: "Show No Active Plan Clients", value: "dormant" },
  { label: "Show Denied / Ineligible Clients", value: "ineligible_reporting" },
  { label: "Show All Clients", value: "all" },
];

const formatDate = value => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

const formatDateTime = value => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const getDayDiffFromToday = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const dueMidnight = new Date(date);
  dueMidnight.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((dueMidnight.getTime() - today.getTime()) / 86400000);
};

const getNextActionBadgeColor = value => {
  const diffDays = getDayDiffFromToday(value);
  if (diffDays === null) return null;
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return overdueDays > 7 ? "red" : "yellow";
  }
  if (diffDays <= 7) return "blue";
  return "green";
};

const groupedColumns = [
  {
    id: "client",
    header: "Client",
    cell: item => {
      if (item.isChild) {
        return (
          <Link href={item.caseHref || "#"} onFollow={event => event.preventDefault()}>
            {item.trackingId ? `Case ${item.trackingId}` : `Case ${item.id || ""}`}
          </Link>
        );
      }
      return (
        <Link href={item.caseHref || "#"} onFollow={event => event.preventDefault()}>
          {item.clientName || item.trackingId || item.id}
        </Link>
      );
    },
    minWidth: 220,
    isRowHeader: true,
  },
  {
    id: "status",
    header: "Status",
    cell: item => {
      const rawStatus = item.isChild ? item.status || item.statusLabel : item.primaryStatus || item.primaryStatusLabel;
      const color = getCaseStatusBadgeColor(rawStatus);
      const label = getCaseStatusLabel(rawStatus);
      return <Badge color={color}>{label}</Badge>;
    },
    minWidth: 140,
  },
  {
    id: "owner",
    header: "Owner",
    cell: item => {
      if (item.isChild) return item.ownerName ?? "Unassigned";
      if (item.caseCount === 1) return item.ownerName ?? "Unassigned";
      return "-";
    },
    minWidth: 160,
  },
  {
    id: "openTasks",
    header: "Open tasks",
    cell: item => {
      const open = Number.isFinite(item.openTasks) ? item.openTasks : 0;
      const overdue = Number.isFinite(item.overdueTasks) ? item.overdueTasks : 0;
      const badgeColor = overdue > 0 ? "red" : open > 0 ? "blue" : "grey";
      const content =
        overdue > 0 ? (
          <SpaceBetween size="xxs">
            <Badge color={badgeColor}>{open}</Badge>
            <Box fontSize="body-s" color="text-status-error">
              {overdue} overdue
            </Box>
          </SpaceBetween>
        ) : (
          <Badge color={badgeColor}>{open}</Badge>
        );
      if (item.isChild || item.caseCount === 1) return content;
      return "-";
    },
    minWidth: 160,
  },
  {
    id: "openInterventions",
    header: "Open interventions",
    cell: item => {
      const open = Number.isFinite(item.openInterventions) ? item.openInterventions : 0;
      const total = Number.isFinite(item.totalInterventions) ? item.totalInterventions : 0;
      const statusValue =
        item?.status ||
        item?.primaryStatus ||
        item?.singleCase?.status ||
        item?.raw?.status ||
        null;
      const normalizedStatus =
        typeof statusValue === "string"
          ? statusValue.trim().toLowerCase().replace(/[\s-]+/g, "_")
          : "";
      const isDormant = normalizedStatus === "dormant";
      const badgeColor = isDormant ? "grey" : open > 0 ? "blue" : "green";
      const content = <Badge color={badgeColor}>{`${open} / ${total}`}</Badge>;
      if (item.isChild || item.caseCount === 1) return content;
      return "-";
    },
    minWidth: 160,
  },
  {
    id: "nextActionDue",
    header: "Next action due",
    cell: item => {
      const value = item.nextActionDueAt;
      if (item.isChild || item.caseCount === 1) {
        const badgeColor = getNextActionBadgeColor(value);
        if (!badgeColor) return "-";
        return <Badge color={badgeColor}>{formatDate(value)}</Badge>;
      }
      return "-";
    },
    minWidth: 160,
  },
  {
    id: "lastTouch",
    header: "Last touch",
    cell: item => {
      if (item.isChild) return formatDateTime(item.lastActivityAt);
      if (item.caseCount === 1) return formatDateTime(item.lastActivityAt);
      return "-";
    },
    minWidth: 180,
  },
];

const groupedColumnIds = groupedColumns.map(column => column.id);

const loadColumnWidths = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(entry => {
        if (!entry || typeof entry !== "object") return null;
        const { id, width } = entry;
        const numeric = Number(width);
        return typeof id === "string" && Number.isFinite(numeric)
          ? { id, width: numeric }
          : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return {
      pageSize: DEFAULT_PAGE_SIZE,
      visibleColumns: [...groupedColumnIds],
    };
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return {
        pageSize: DEFAULT_PAGE_SIZE,
        visibleColumns: [...groupedColumnIds],
      };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {
        pageSize: DEFAULT_PAGE_SIZE,
        visibleColumns: [...groupedColumnIds],
      };
    }
    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? parsed.visibleColumns.filter(id => groupedColumnIds.includes(id))
      : [...groupedColumnIds];
    const pageSize = PAGE_SIZE_OPTIONS.some(option => option.value === parsed.pageSize)
      ? parsed.pageSize
      : DEFAULT_PAGE_SIZE;
    return {
      pageSize,
      visibleColumns: visibleColumns.length ? visibleColumns : [...groupedColumnIds],
    };
  } catch {
    return {
      pageSize: DEFAULT_PAGE_SIZE,
      visibleColumns: [...groupedColumnIds],
    };
  }
};

const persistColumnWidths = widths => {
  if (typeof window === "undefined") return;
  try {
    if (Array.isArray(widths) && widths.length) {
      window.localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(widths));
    } else {
      window.localStorage.removeItem(COLUMN_WIDTHS_KEY);
    }
  } catch {
    // ignore persistence issues in scaffold mode
  }
};

const persistPreferences = preferences => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // ignore persistence issues in scaffold mode
  }
};

const CasesTableWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const history = useHistory();
  const { role: currentRole } = useCurrentUser();
  const isApplicationAssessor = currentRole === "ISET Coordinator";
  const canManageAssignments = !isApplicationAssessor;
  const {
    searchText,
    setSearchText,
    selectedAgreements,
    clearAgreementFilters,
  } = usePortfolioCases();

  const [columnWidths, setColumnWidths] = useState(() => loadColumnWidths());
  const [preferences, setPreferences] = useState(() => loadPreferences());
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [clientCategory, setClientCategory] = useState(CLIENT_CATEGORY_OPTIONS[0]);
  const [sortingState, setSortingState] = useState({ columnId: "lastTouch", isDescending: true });
  const preferencesRef = useRef(preferences);
  const pageSize = preferences.pageSize ?? DEFAULT_PAGE_SIZE;

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignModalMode, setAssignModalMode] = useState("assign");
  const [assignTargetCase, setAssignTargetCase] = useState(null);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignableLoading, setAssignableLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);

  const formatStaffLabel = useCallback(staff => {
    if (!staff) return "Staff";
    const display =
      staff.display_name || staff.name || staff.email || `Staff #${staff.id ?? "?"}`;
    const role = staff.primary_role || staff.role || null;
    return role ? `${display} (${role})` : display;
  }, []);

  const {
    items: liveItems,
    totalCount: liveTotalCount,
    loading: liveLoading,
    error: liveError,
    refresh: refreshLiveCases,
  } = useCasesData({
    enabled: true,
    searchText,
    statusFilters: DEFAULT_STATUS_FILTERS,
    ownerFilters: undefined,
    clientCategory: clientCategory?.value || "active",
    page: currentPageIndex,
    pageSize,
    sort: {
      column: sortingState.columnId,
      direction: sortingState.isDescending ? "desc" : "asc",
    },
  });

  const assignableOptions = useMemo(
    () =>
      assignableStaff.map(staff => ({
        value: String(staff.id),
        label: formatStaffLabel(staff),
      })),
    [assignableStaff, formatStaffLabel]
  );

  const fetchAssignableStaff = useCallback(
    async targetCase => {
      setAssignableLoading(true);
      setAssignError(null);
      try {
        const response = await apiFetch("/api/staff/assignable");
        if (!response.ok) {
          throw new Error(`Failed to load staff (${response.status})`);
        }
        const list = await response.json();
        const normalized = Array.isArray(list)
          ? list.filter(staff => Number.isFinite(Number(staff?.id)))
          : [];
        setAssignableStaff(normalized);
        const ownerId = targetCase?.raw?.owner?.id ?? null;
        if (ownerId) {
          const found = normalized.find(staff => Number(staff.id) === Number(ownerId));
          setSelectedAssignee(
            found ? { value: String(found.id), label: formatStaffLabel(found) } : null
          );
        } else {
          setSelectedAssignee(null);
        }
      } catch (err) {
        setAssignError(err?.message || "Failed to load staff list");
        setAssignableStaff([]);
        setSelectedAssignee(null);
      } finally {
        setAssignableLoading(false);
      }
    },
    [formatStaffLabel]
  );

  const closeAssignModal = useCallback(() => {
    setAssignModalVisible(false);
    setAssignTargetCase(null);
    setSelectedAssignee(null);
    setAssignError(null);
  }, []);

  const handleAssignSubmit = useCallback(async () => {
    if (!assignTargetCase) {
      setAssignError("No case selected.");
      return;
    }
    const numericId = Number.parseInt(assignTargetCase.id, 10);
    if (!Number.isFinite(numericId)) {
      setAssignError("Invalid case identifier.");
      return;
    }
    const assigneeValue = selectedAssignee?.value;
    if (!assigneeValue) {
      setAssignError("Select a staff member.");
      return;
    }
    setAssignSubmitting(true);
    setAssignError(null);
    try {
      const endpoint =
        assignModalMode === "reassign"
          ? `/api/cases/${numericId}/reassign`
          : `/api/cases/${numericId}/assign`;
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: Number(assigneeValue) }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.detail || body?.error || `Assignment failed (${response.status})`;
        throw new Error(message);
      }
      const staffMatch = assignableStaff.find(
        staff => Number(staff.id) === Number(assigneeValue)
      );
      const assigneeLabel =
        staffMatch?.display_name ||
        staffMatch?.name ||
        staffMatch?.email ||
        selectedAssignee?.label ||
        `Staff #${assigneeValue}`;
      const caseLabel =
        assignTargetCase?.raw?.trackingId ||
        assignTargetCase?.trackingId ||
        assignTargetCase?.id;
      setAssignSuccess(
        assignModalMode === "reassign"
          ? `Case ${caseLabel} reassigned to ${assigneeLabel}.`
          : `Case ${caseLabel} assigned to ${assigneeLabel}.`
      );
      closeAssignModal();
      if (typeof refreshLiveCases === "function") {
        refreshLiveCases({ page: currentPageIndex });
      }
    } catch (err) {
      setAssignError(err?.message || "Failed to assign case");
    } finally {
      setAssignSubmitting(false);
    }
  }, [
    assignTargetCase,
    selectedAssignee,
    assignModalMode,
    refreshLiveCases,
    currentPageIndex,
    closeAssignModal,
    assignableStaff,
  ]);

  const handleCaseAction = useCallback(
    (caseItem, actionType) => {
      if (!caseItem?.id) return;
      const numericId = Number.parseInt(caseItem.id, 10);
      if (!Number.isFinite(numericId)) {
        return;
      }
      setAssignModalMode(actionType === "reassign" ? "reassign" : "assign");
      setAssignTargetCase(caseItem);
      setAssignModalVisible(true);
      setAssignError(null);
      setSelectedAssignee(null);
      fetchAssignableStaff(caseItem);
    },
    [fetchAssignableStaff]
  );

  useEffect(() => {
    const liveTotal = Number.isFinite(liveTotalCount) ? liveTotalCount : 0;
    const maxPage = Math.max(1, Math.ceil(Math.max(liveTotal, 1) / pageSize));
    setCurrentPageIndex(previous => (previous > maxPage ? maxPage : previous));
  }, [liveTotalCount, pageSize]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(
          helpContent,
          metadata.helpTitle ?? "Portfolio cases table",
          metadata.aiContext ?? ""
        );
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

  const handlePreferencesConfirm = ({ detail }) => {
    const nextVisible = detail.contentDisplay
      ? detail.contentDisplay.filter(entry => entry.visible).map(entry => entry.id)
      : preferences.visibleColumns;
    const normalisedVisible = groupedColumnIds.filter(id => nextVisible.includes(id));
    const nextPreferences = {
      pageSize: detail.pageSize ?? pageSize,
      visibleColumns: normalisedVisible.length ? normalisedVisible : [...groupedColumnIds],
    };
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    persistPreferences(nextPreferences);

    if (Array.isArray(detail.columnWidths) && detail.columnWidths.length) {
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
        persistColumnWidths(widths);
      }
    }
    setCurrentPageIndex(1);
  };

  const handleColumnWidthsChange = ({ detail }) => {
    const resolved = [];
    if (Array.isArray(detail?.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        const numeric = Number(entry?.width);
        if (typeof entry?.id === "string" && Number.isFinite(numeric)) {
          resolved.push({ id: entry.id, width: numeric });
        }
      });
    } else if (Array.isArray(detail?.widths)) {
      detail.widths.forEach((width, index) => {
        const column = groupedColumns[index];
        const numeric = Number(width);
        if (column && Number.isFinite(numeric)) {
          resolved.push({ id: column.id, width: numeric });
        }
      });
    }
    if (resolved.length) {
      setColumnWidths(resolved);
      persistColumnWidths(resolved);
    }
  };

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize,
        contentDisplay: groupedColumns.map(column => ({
          id: column.id,
          visible: preferences.visibleColumns.includes(column.id),
        })),
        columnWidths,
      }}
      pageSizePreference={{
        title: "Page size",
        options: PAGE_SIZE_OPTIONS,
      }}
      contentDisplayPreference={{
        title: "Select columns",
        options: groupedColumns.map(column => ({
          id: column.id,
          label: column.header,
          alwaysVisible: column.id === "client",
        })),
      }}
      onConfirm={handlePreferencesConfirm}
    />
  );

  const itemsToRender = liveItems;
  const totalCount = Number.isFinite(liveTotalCount) ? liveTotalCount : liveItems.length;
  const pagesCountEffective = Math.max(1, Math.ceil(Math.max(totalCount, 1) / pageSize));
  const pagination = (
    <Pagination
      currentPageIndex={currentPageIndex}
      pagesCount={pagesCountEffective}
      onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
      disabled={pagesCountEffective <= 1}
    />
  );
  const totalMatchesText = liveLoading
    ? "Loading…"
    : `${totalCount} client${totalCount === 1 ? "" : "s"}`;
  const emptyState = liveError ? (
    <Box padding="m">
      <StatusIndicator type="error">
        Failed to load cases: {liveError.message || liveError.status || "Unknown error"}
      </StatusIndicator>
    </Box>
  ) : (
    <Box padding="m">No cases match the current filters.</Box>
  );

  const actionsColumn = useMemo(
    () => ({
      id: "actions",
      header: "Actions",
      minWidth: 180,
      cell: item => {
        const hasOwner =
          Boolean(item?.raw?.owner?.id) ||
          (item?.ownerName && item.ownerName.toLowerCase() !== "unassigned");
        return (
          <SpaceBetween size="xs" direction="horizontal">
            <Button
              variant="inline-link"
              disabled={!canManageAssignments || hasOwner}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                handleCaseAction(item, "assign");
              }}
            >
              Assign
            </Button>
            <Button
              variant="inline-link"
              disabled={!canManageAssignments || !hasOwner}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                handleCaseAction(item, "reassign");
              }}
            >
              Reassign
            </Button>
          </SpaceBetween>
        );
      },
    }),
    [handleCaseAction, canManageAssignments]
  );

  const columnsToRender = useMemo(() => {
    const visibleSet = new Set(preferences.visibleColumns);
    const columns = groupedColumns
      .filter(column => visibleSet.has(column.id))
      .map(column => {
        const storedWidth = columnWidths.find(entry => entry.id === column.id);
        const sortableColumn = { ...column, sortingField: column.id };
        return storedWidth ? { ...sortableColumn, width: storedWidth.width } : sortableColumn;
      });
    return columns;
  }, [preferences.visibleColumns, columnWidths]);

  const activeSortingColumn = useMemo(
    () => columnsToRender.find(column => column.id === sortingState.columnId),
    [columnsToRender, sortingState.columnId]
  );

  const selectedAgreement = selectedAgreements?.[0] || null;
  const handleClientCategoryChange = ({ detail }) => {
    const nextOption = detail?.selectedOption || CLIENT_CATEGORY_OPTIONS[0];
    setClientCategory(nextOption);
    setCurrentPageIndex(1);
    setExpandedItems([]);
  };
  const headerActionItems = [];
  headerActionItems.push(
    <Select
      key="client-category"
      selectedOption={clientCategory}
      options={CLIENT_CATEGORY_OPTIONS}
      onChange={handleClientCategoryChange}
      ariaLabel="Client category filter"
      selectedAriaLabel="selected"
    />
  );
  if (selectedAgreement) {
    headerActionItems.push(
      <Button key="clear" iconName="close" onClick={clearAgreementFilters}>
        Clear filter
      </Button>
    );
  }

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description ?? "Review and open ISET cases that match your filters."}
          actions={
            headerActionItems.length ? (
              <SpaceBetween direction="horizontal" size="xs">
                {headerActionItems}
              </SpaceBetween>
            ) : undefined
          }
        >
          {metadata.title ?? "Clients"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Cases table settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {assignSuccess && (
          <Alert
            type="success"
            onDismiss={() => setAssignSuccess(null)}
            statusIconAriaLabel="Success"
          >
            {assignSuccess}
          </Alert>
        )}
        <Table
          trackBy="id"
          columnDefinitions={columnsToRender}
          items={itemsToRender}
          resizableColumns
          variant="embedded"
          loading={liveLoading}
          sortingColumn={activeSortingColumn || { id: sortingState.columnId }}
          sortingDescending={sortingState.isDescending}
          onSortingChange={({ detail }) => {
            const columnId = detail?.sortingColumn?.id;
            if (!columnId) return;
            setSortingState({ columnId, isDescending: detail.isDescending });
            setCurrentPageIndex(1);
            setExpandedItems([]);
          }}
          header={<Header variant="h3" counter={`(${totalCount})`}>ISET Clients</Header>}
          empty={emptyState}
          filter={
            <TextFilter
              filteringText={searchText}
              filteringPlaceholder="Search by client or owner"
              onChange={({ detail }) => {
                setSearchText(detail.filteringText);
                setCurrentPageIndex(1);
              }}
              countText={totalMatchesText}
            />
          }
          pagination={pagination}
          preferences={preferencesComponent}
          onColumnWidthsChange={handleColumnWidthsChange}
          expandableRows={{
            getItemChildren: item => (Array.isArray(item.cases) && item.cases.length > 1 ? item.cases : []),
            isItemExpandable: item => Array.isArray(item.cases) && item.cases.length > 1,
            expandedItems,
            onExpandableItemToggle: ({ detail }) => {
              const itemId = detail.item?.id;
              if (!itemId) return;
              setExpandedItems(prev => {
                const set = new Set(prev.map(entry => entry.id));
                if (detail.expanded) {
                  set.add(itemId);
                } else {
                  set.delete(itemId);
                }
                return Array.from(set).map(id => ({ id }));
              });
            },
          }}
          onRowClick={({ detail }) => {
            const caseId = detail?.item?.isChild
              ? detail.item.id
              : detail?.item?.caseCount === 1
                ? detail.item.singleCase?.id
                : null;
            if (caseId) {
              history.push(`/cases/${caseId}`);
            }
          }}
        />
      </SpaceBetween>
      {assignModalVisible && (
        <Modal
          visible
          header={assignModalMode === "reassign" ? "Reassign Case" : "Assign Case"}
          closeAriaLabel="Close assignment modal"
          onDismiss={closeAssignModal}
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={closeAssignModal}>Cancel</Button>
              <Button
                variant="primary"
                loading={assignSubmitting}
                disabled={assignableLoading || assignSubmitting || !selectedAssignee}
                onClick={handleAssignSubmit}
              >
                {assignModalMode === "reassign" ? "Reassign" : "Assign"}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            {assignError && (
              <Alert type="error" statusIconAriaLabel="Error">
                {assignError}
              </Alert>
            )}
            <FormField
              label="Staff member"
              description="Choose who should own this case."
            >
              <Select
                disabled={assignableLoading}
                loadingText="Loading staff..."
                placeholder={assignableLoading ? "Loading staff..." : "Select staff"}
                options={assignableOptions}
                selectedOption={selectedAssignee}
                onChange={({ detail }) => setSelectedAssignee(detail.selectedOption)}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}
    </BoardItem>
  );
};

export default CasesTableWidget;
