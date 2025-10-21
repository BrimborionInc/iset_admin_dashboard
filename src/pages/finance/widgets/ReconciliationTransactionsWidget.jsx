import React, { useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Link,
  Table,
  Box,
  Select,
  StatusIndicator,
  TextFilter,
  CollectionPreferences,
  Pagination,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useReconciliationData } from "./ReconciliationDataContext.jsx";
import FinanceReconciliationTransactionsHelp from "../../../helpPanelContents/financeReconciliationTransactionsHelp.js";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-reconciliation-transactions-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-reconciliation-transactions-preferences-v1";

const PAGE_SIZE_OPTIONS = [
  { label: "10 rows", value: 10 },
  { label: "20 rows", value: 20 },
  { label: "50 rows", value: 50 },
];
const ALL_COLUMN_IDS = [
  "id",
  "date",
  "amount",
  "pot",
  "exception",
  "status",
  "evidence",
  "actions",
];
const DEFAULT_PAGE_SIZE = 10;

const exceptionOptions = [
  { label: "All exceptions", value: "all" },
  { label: "Missing evidence", value: "missing_evidence" },
  { label: "Out of period", value: "out_of_period" },
  { label: "Ineligible vendor", value: "ineligible_vendor" },
  { label: "Duplicate claim", value: "duplicate_claim" },
];

const statusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Open", value: "open" },
  { label: "In review", value: "in_review" },
  { label: "Pending", value: "pending" },
  { label: "Resolved", value: "resolved" },
];

const priorityBadge = priority => {
  switch (priority) {
    case "critical":
      return { type: "error", text: "Critical" };
    case "high":
      return { type: "warning", text: "High" };
    case "medium":
      return { type: "info", text: "Medium" };
    default:
      return { type: "success", text: "Low" };
  }
};

const loadColumnWidths = () => {
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
    console.error("[Reconciliation] failed to read transaction column widths", error);
    return [];
  }
};

const persistColumnWidths = widths => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (Array.isArray(widths) && widths.length) {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    } else {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
    }
  } catch (error) {
    console.error("[Reconciliation] failed to persist transaction column widths", error);
  }
};

const loadStoredPreferences = () => {
  if (typeof window === "undefined") {
    return { pageSize: DEFAULT_PAGE_SIZE, visibleColumns: ALL_COLUMN_IDS };
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { pageSize: DEFAULT_PAGE_SIZE, visibleColumns: ALL_COLUMN_IDS };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { pageSize: DEFAULT_PAGE_SIZE, visibleColumns: ALL_COLUMN_IDS };
    }
    const pageSize = PAGE_SIZE_OPTIONS.some(option => option.value === parsed.pageSize)
      ? parsed.pageSize
      : DEFAULT_PAGE_SIZE;
    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? parsed.visibleColumns.filter(id => ALL_COLUMN_IDS.includes(id))
      : ALL_COLUMN_IDS;
    return { pageSize, visibleColumns };
  } catch (error) {
    console.error("[Reconciliation] failed to read transaction preferences", error);
    return { pageSize: DEFAULT_PAGE_SIZE, visibleColumns: ALL_COLUMN_IDS };
  }
};

const persistPreferences = ({ pageSize, visibleColumns }) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload = {
      pageSize: PAGE_SIZE_OPTIONS.some(option => option.value === pageSize)
        ? pageSize
        : DEFAULT_PAGE_SIZE,
      visibleColumns: Array.from(
        new Set(
          (visibleColumns ?? ALL_COLUMN_IDS).filter(id => ALL_COLUMN_IDS.includes(id))
        )
      ),
    };
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("[Reconciliation] failed to persist transaction preferences", error);
  }
};

const ReconciliationTransactionsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    transactions,
    selectedTransactionIds,
    updateSelection,
    selectTransaction,
  } = useReconciliationData();

  const initialPrefsRef = useRef(loadStoredPreferences());
  const initialPrefs = initialPrefsRef.current;

  const [exceptionFilter, setExceptionFilter] = useState(exceptionOptions[0]);
  const [statusFilter, setStatusFilter] = useState(statusOptions[0]);
  const [filteringText, setFilteringText] = useState("");
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);
  const [pageSize, setPageSize] = useState(initialPrefs.pageSize);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const visibleSet = new Set(initialPrefs.visibleColumns ?? ALL_COLUMN_IDS);
    visibleSet.add("id");
    const ordered = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
    return ordered.length ? ordered : ALL_COLUMN_IDS;
  });
  const preferencesRef = useRef(initialPrefs);

  const filteredItems = useMemo(() => {
    const text = filteringText.trim().toLowerCase();
    return transactions.filter(item => {
      const exceptionMatch =
        exceptionFilter.value === "all" ? true : item.exceptionType === exceptionFilter.value;
      const statusMatch = statusFilter.value === "all" ? true : item.status === statusFilter.value;
      const textMatch = !text
        ? true
        : [item.id, item.caseId, item.vendor, item.potName]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(text));
      return exceptionMatch && statusMatch && textMatch;
    });
  }, [transactions, exceptionFilter, statusFilter, filteringText]);

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: "id",
        header: "Transaction",
        cell: item => (
          <SpaceBetween size="xxs">
            <Box variant="strong">{item.id}</Box>
            <Box variant="awsui-key-label">{item.caseId}</Box>
          </SpaceBetween>
        ),
      },
      {
        id: "date",
        header: "Date",
        cell: item => item.date,
      },
      {
        id: "amount",
        header: "Amount",
        cell: item => `$${item.amount.toLocaleString("en-CA", { minimumFractionDigits: 2 })}`,
      },
      {
        id: "pot",
        header: "Pot",
        cell: item => item.potName,
      },
      {
        id: "exception",
        header: "Exception",
        cell: item => item.exceptionType.replace(/_/g, " "),
      },
      {
        id: "status",
        header: "Status",
        cell: item => {
          const badge = priorityBadge(item.priority);
          return <StatusIndicator type={badge.type}>{item.status.toUpperCase()}</StatusIndicator>;
        },
      },
      {
        id: "evidence",
        header: "Evidence",
        cell: item => `${item.evidenceCount} file${item.evidenceCount === 1 ? "" : "s"}`,
      },
      {
        id: "actions",
        header: "",
        cell: item => (
          <SpaceBetween size="xs" direction="horizontal">
            <Link
              href="#"
              onFollow={event => {
                event.preventDefault();
                selectTransaction(item.id);
              }}
            >
              View detail
            </Link>
          </SpaceBetween>
        ),
      },
    ],
    [selectTransaction]
  );

  const mergedColumnDefinitions = useMemo(() => {
    const widthMap = new Map(columnWidths.map(entry => [entry.id, entry.width]));
    return baseColumnDefinitions.map(column => {
      const stored = widthMap.get(column.id);
      return stored ? { ...column, width: stored } : column;
    });
  }, [baseColumnDefinitions, columnWidths]);

  const columnDefinitionsForTable = useMemo(() => {
    const allowed = new Set(visibleColumns);
    allowed.add("id");
    return mergedColumnDefinitions.filter(column => allowed.has(column.id));
  }, [mergedColumnDefinitions, visibleColumns]);

  const columnPreferenceOptions = useMemo(
    () =>
      mergedColumnDefinitions.map(column => ({
        id: column.id,
        label: typeof column.header === "string" ? column.header : column.id,
        alwaysVisible: column.id === "id",
      })),
    [mergedColumnDefinitions]
  );

  const handleColumnWidthsChange = ({ detail }) => {
    const next = [];
    if (Array.isArray(detail?.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const { id, width } = entry;
        const numeric = Number(width);
        if (typeof id === "string" && Number.isFinite(numeric)) {
          next.push({ id, width: numeric });
        }
      });
    } else if (Array.isArray(detail?.widths)) {
      detail.widths.forEach((width, index) => {
        const column = columnDefinitionsForTable[index];
        const numeric = Number(width);
        if (column && Number.isFinite(numeric)) {
          next.push({ id: column.id, width: numeric });
        }
      });
    }
    if (next.length) {
      setColumnWidths(next);
      persistColumnWidths(next);
    }
  };

  const applyColumnWidthUpdates = updates => {
    if (!Array.isArray(updates) || !updates.length) {
      setColumnWidths([]);
      persistColumnWidths([]);
      return;
    }
    const allowedIds = new Set(mergedColumnDefinitions.map(column => column.id));
    const ordered = [];
    updates.forEach(entry => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const { id, width } = entry;
      if (!allowedIds.has(id)) {
        return;
      }
      const numeric = Number(width);
      if (Number.isFinite(numeric)) {
        ordered.push({ id, width: numeric });
      }
    });
    setColumnWidths(ordered);
    persistColumnWidths(ordered);
  };

  const totalItems = filteredItems.length;
  const pagesCount = Math.max(1, Math.ceil(totalItems / pageSize));
  useEffect(() => {
    if (currentPageIndex > pagesCount) {
      setCurrentPageIndex(1);
    }
  }, [currentPageIndex, pagesCount]);

  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPageIndex, pageSize]);

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize,
        contentDisplay: mergedColumnDefinitions.map(column => ({
          id: column.id,
          visible: visibleColumns.includes(column.id),
        })),
        columnWidths,
      }}
      pageSizePreference={{
        title: "Page size",
        options: PAGE_SIZE_OPTIONS.map(option => ({
          value: option.value,
          label: option.label,
        })),
      }}
      contentDisplayPreference={{
        title: "Select columns",
        options: columnPreferenceOptions,
      }}
      onConfirm={({ detail }) => {
        if (detail.pageSize && detail.pageSize !== pageSize) {
          setPageSize(detail.pageSize);
        }
        if (Array.isArray(detail.contentDisplay)) {
          const nextVisible = detail.contentDisplay
            .filter(entry => entry.visible)
            .map(entry => entry.id)
            .filter(id => ALL_COLUMN_IDS.includes(id));
          const visibleSet = new Set(nextVisible);
          visibleSet.add("id");
          const ordered = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
          setVisibleColumns(ordered);
        }
        if (Array.isArray(detail.columnWidths)) {
          applyColumnWidthUpdates(detail.columnWidths);
        }
        setCurrentPageIndex(1);
      }}
    />
  );

  const paginationComponent = (
    <Pagination
      currentPageIndex={currentPageIndex}
      pagesCount={pagesCount}
      disabled={pagesCount <= 1}
      onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
    />
  );

  useEffect(() => {
    const currentPrefs = preferencesRef.current;
    if (
      currentPrefs.pageSize !== pageSize ||
      JSON.stringify(currentPrefs.visibleColumns) !== JSON.stringify(visibleColumns)
    ) {
      preferencesRef.current = { pageSize, visibleColumns };
      persistPreferences({ pageSize, visibleColumns });
    }
  }, [pageSize, visibleColumns]);

  const infoHelper = metadata.helpComponent
    ? metadata
    : {
        helpComponent: FinanceReconciliationTransactionsHelp,
        helpTitle: "Transactions queue",
        aiContext: FinanceReconciliationTransactionsHelp.aiContext,
      };

  const infoLinkComputed =
    toggleHelpPanel && infoHelper.helpComponent
      ? (
          <Link
            variant="info"
            onFollow={event => {
              event.preventDefault();
              const helpContent = React.createElement(infoHelper.helpComponent);
              toggleHelpPanel(helpContent, infoHelper.helpTitle, infoHelper.aiContext);
            }}
          >
            Info
          </Link>
        )
      : undefined;

  const handleSelectionChange = ({ detail }) => {
    const ids = detail.selectedItems?.map(item => item.id) ?? [];
    updateSelection(ids);
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLinkComputed}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Select
                selectedOption={exceptionFilter}
                options={exceptionOptions}
                onChange={({ detail }) => setExceptionFilter(detail.selectedOption)}
                selectedAriaLabel="Filter by exception"
              />
              <Select
                selectedOption={statusFilter}
                options={statusOptions}
                onChange={({ detail }) => setStatusFilter(detail.selectedOption)}
                selectedAriaLabel="Filter by status"
              />
            </SpaceBetween>
          }
          description="Review and triage inbound transactions that need attention."
        >
          Transactions queue
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Transactions queue settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={({ detail }) => {
              if (detail?.id === "remove") {
                actions.removeItem();
              }
            }}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Table
        trackBy="id"
        items={pagedItems}
        selectionType="multi"
        selectedItems={transactions.filter(item => selectedTransactionIds.includes(item.id))}
        onSelectionChange={handleSelectionChange}
        columnDefinitions={columnDefinitionsForTable}
        resizableColumns
        onColumnWidthsChange={handleColumnWidthsChange}
        variant="embedded"
        filter={
          <TextFilter
            filteringText={filteringText}
            onChange={({ detail }) => {
              setFilteringText(detail.filteringText);
              setCurrentPageIndex(1);
            }}
            filteringPlaceholder="Search transactions"
            countText={`${filteredItems.length} match${filteredItems.length === 1 ? "" : "es"}`}
          />
        }
        preferences={preferencesComponent}
        pagination={paginationComponent}
        header={
          <Header variant="h3" counter={`(${filteredItems.length})`}>
            Exceptions
          </Header>
        }
        empty={<Box padding="m">No transactions match the selected filters.</Box>}
      />
    </BoardItem>
  );
};

export default ReconciliationTransactionsWidget;
