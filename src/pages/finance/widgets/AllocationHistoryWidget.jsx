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
  ColumnLayout,
  CollectionPreferences,
  Pagination,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { FINANCE_PEOPLE } from "./financeDemoData.js";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-allocations-history-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-allocations-history-preferences-v1";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [
  { label: "10 rows", value: 10 },
  { label: "20 rows", value: 20 },
  { label: "50 rows", value: 50 },
];
const ALL_COLUMN_IDS = ["approvedOn", "summary", "pots", "approvers"];

const historyEntries = [
  {
    id: "HIST-24028",
    approvedOn: "2024-09-22",
    transferId: "TRF-24014",
    summary: "Moved $120K to Employment Readiness Hubs",
    potFrom: "Urban/Unaffiliated Envelope",
    potTo: "Employment Readiness Hubs",
    approvedBy: [FINANCE_PEOPLE.programLead, FINANCE_PEOPLE.seniorDirector, FINANCE_PEOPLE.ceo],
    before: { source: 520000, destination: 1850000 },
    after: { source: 400000, destination: 1970000 },
  },
  {
    id: "HIST-24025",
    approvedOn: "2024-08-19",
    transferId: "TRF-23998",
    summary: "Returned $65K underspend to Capacity & Infrastructure",
    potFrom: "Women in Trades Cohorts",
    potTo: "Capacity & Infrastructure",
    approvedBy: [FINANCE_PEOPLE.programLead, FINANCE_PEOPLE.seniorDirector],
    before: { source: 210000, destination: 360000 },
    after: { source: 145000, destination: 425000 },
  },
  {
    id: "HIST-24010",
    approvedOn: "2024-07-04",
    transferId: "TRF-23960",
    summary: "Admin reserve draw for innovation pilot",
    potFrom: "Capacity & Infrastructure",
    potTo: "Digital Skills Accelerator",
    approvedBy: [FINANCE_PEOPLE.seniorDirector, FINANCE_PEOPLE.ceo],
    before: { source: 480000, destination: 120000 },
    after: { source: 420000, destination: 180000 },
  },
];

const periodOptions = [
  { value: "fy24", label: "FY2024-25" },
  { value: "fy23", label: "FY2023-24" },
  { value: "custom", label: "Custom range" },
];

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
    console.error("[Allocations] failed to parse history column widths", error);
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
    console.error("[Allocations] failed to persist history column widths", error);
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
    console.error("[Allocations] failed to parse history preferences", error);
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
    console.error("[Allocations] failed to persist history preferences", error);
  }
};

const formatCurrency = value => `$${value.toLocaleString("en-CA")}`;

const AllocationHistoryWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const initialPrefsRef = useRef(loadStoredPreferences());
  const initialPrefs = initialPrefsRef.current;
  const [period, setPeriod] = useState(periodOptions[0]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);
  const [pageSize, setPageSize] = useState(initialPrefs.pageSize);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const visibleSet = new Set(initialPrefs.visibleColumns ?? ALL_COLUMN_IDS);
    visibleSet.add("summary");
    const ordered = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
    return ordered.length ? ordered : ALL_COLUMN_IDS;
  });
  const preferencesRef = useRef(initialPrefs);

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Allocation history",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: "approvedOn",
        header: "Approved on",
        cell: item => item.approvedOn,
      },
      {
        id: "summary",
        header: "Summary",
        cell: item => (
          <SpaceBetween size="xxs">
            <Box variant="strong">{item.summary}</Box>
            <Box variant="awsui-key-label">{item.transferId}</Box>
          </SpaceBetween>
        ),
      },
      {
        id: "pots",
        header: "Pots",
        cell: item => (
          <Box variant="p">
            {item.potFrom} → {item.potTo}
          </Box>
        ),
      },
      {
        id: "approvers",
        header: "Approval chain",
        cell: item => item.approvedBy.join(" → "),
      },
    ],
    []
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
    allowed.add("summary");
    return mergedColumnDefinitions.filter(column => allowed.has(column.id));
  }, [mergedColumnDefinitions, visibleColumns]);

  const columnPreferenceOptions = useMemo(
    () =>
      mergedColumnDefinitions.map(column => ({
        id: column.id,
        label: typeof column.header === "string" ? column.header : column.id,
        alwaysVisible: column.id === "summary",
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

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const selected = selectedItems[0];

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

  const totalItems = historyEntries.length;
  const pagesCount = Math.max(1, Math.ceil(totalItems / pageSize));
  useEffect(() => {
    if (currentPageIndex > pagesCount) {
      setCurrentPageIndex(1);
    }
  }, [currentPageIndex, pagesCount]);

  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return historyEntries.slice(start, start + pageSize);
  }, [historyEntries, currentPageIndex, pageSize]);

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
          visibleSet.add("summary");
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

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          actions={
            <Select
              selectedOption={period}
              options={periodOptions}
              onChange={({ detail }) => setPeriod(detail.selectedOption)}
            />
          }
          description="Audit-ready trail of completed reallocations."
        >
          Allocation history
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Allocation history settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <Table
          items={pagedItems}
          trackBy="id"
          selectionType="single"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
          columnDefinitions={columnDefinitionsForTable}
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          variant="embedded"
          header={
            <Header variant="h3" counter={`(${historyEntries.length})`}>
              Historical transfers
            </Header>
          }
          preferences={preferencesComponent}
          pagination={paginationComponent}
        />
        {selected ? (
          <ColumnLayout columns={2} variant="text-grid">
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Source balance (before → after)</Box>
              <StatusIndicator type="info">
                {formatCurrency(selected.before.source)} → {formatCurrency(selected.after.source)}
              </StatusIndicator>
            </SpaceBetween>
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Destination balance (before → after)</Box>
              <StatusIndicator type="info">
                {formatCurrency(selected.before.destination)} → {formatCurrency(selected.after.destination)}
              </StatusIndicator>
            </SpaceBetween>
          </ColumnLayout>
        ) : (
          <Box variant="awsui-key-label">
            Select a row to compare before/after balances.
          </Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default AllocationHistoryWidget;
