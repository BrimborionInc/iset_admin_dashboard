import React, { useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Link,
  Table,
  Box,
  Multiselect,
  StatusIndicator,
  CollectionPreferences,
  Pagination,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-allocations-policy-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-allocations-policy-preferences-v1";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [
  { label: "10 rows", value: 10 },
  { label: "20 rows", value: 20 },
  { label: "50 rows", value: 50 },
];
const ALL_COLUMN_IDS = ["summary", "category", "risk", "action", "owner"];

const policyIssues = [
  {
    id: "POL-ADM-001",
    category: "Administration cap",
    risk: "High",
    summary: "Women in Trades Cohorts admin flat-rate projected at 18.9%.",
    action: "Attach ESDC waiver reference before submission.",
    owner: "Finance",
  },
  {
    id: "POL-CAP-004",
    category: "Capital restriction",
    risk: "Medium",
    summary: "Capacity & Infrastructure requires pre-approval for capital draws.",
    action: "Include capital approval memo or retag to eligible operating pot.",
    owner: "Program manager",
  },
  {
    id: "POL-SOD-002",
    category: "Segregation of duties",
    risk: "Medium",
    summary: "Requester and approver roles overlap for TRF-24032.",
    action: "Reassign approver or add secondary reviewer.",
    owner: "Executive",
  },
];

const categoryOptions = [
  { label: "Administration cap", value: "Administration cap" },
  { label: "Capital restriction", value: "Capital restriction" },
  { label: "Segregation of duties", value: "Segregation of duties" },
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
    console.error("[Allocations] failed to parse policy column widths", error);
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
    console.error("[Allocations] failed to persist policy column widths", error);
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
    console.error("[Allocations] failed to parse policy preferences", error);
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
    console.error("[Allocations] failed to persist policy preferences", error);
  }
};

const AllocationPolicyWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const initialPrefsRef = useRef(loadStoredPreferences());
  const initialPrefs = initialPrefsRef.current;
  const [categoryFilter, setCategoryFilter] = useState([]);
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
            metadata.helpTitle ?? "Policy exceptions",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  const selectedCategories = categoryFilter.map(option => option.value);
  const filteredItems = useMemo(() => {
    if (!selectedCategories.length) {
      return policyIssues;
    }
    return policyIssues.filter(issue => selectedCategories.includes(issue.category));
  }, [selectedCategories]);

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: "summary",
        header: "Policy warning",
        cell: item => (
          <SpaceBetween size="xxs">
            <Box variant="strong">{item.summary}</Box>
            <Box variant="awsui-key-label">{item.id}</Box>
          </SpaceBetween>
        ),
      },
      {
        id: "category",
        header: "Category",
        cell: item => item.category,
      },
      {
        id: "risk",
        header: "Risk",
        cell: item => (
          <StatusIndicator
            type={item.risk === "High" ? "error" : item.risk === "Medium" ? "warning" : "info"}
          >
            {item.risk}
          </StatusIndicator>
        ),
      },
      {
        id: "action",
        header: "Required action",
        cell: item => item.action,
      },
      {
        id: "owner",
        header: "Owner",
        cell: item => item.owner,
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
            <Multiselect
              placeholder="Filter categories"
              selectedOptions={categoryFilter}
              options={categoryOptions}
              onChange={({ detail }) => setCategoryFilter(detail.selectedOptions)}
              deselectAriaLabel={option => `Remove ${option.label}`}
              tokenLimit={3}
            />
          }
          description="Resolve policy exceptions before submitting reallocations."
        >
          Policy exceptions
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Policy exceptions settings"
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
          columnDefinitions={columnDefinitionsForTable}
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          variant="embedded"
          header={
            <Header variant="h3" counter={`(${filteredItems.length})`}>
              Outstanding policies
            </Header>
          }
          empty={<Box padding="m">No policy exceptions detected.</Box>}
          preferences={preferencesComponent}
          pagination={paginationComponent}
        />
        <Box variant="awsui-key-label">
          Link each exception to supporting evidence before submission to avoid workflow rework.
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

export default AllocationPolicyWidget;
