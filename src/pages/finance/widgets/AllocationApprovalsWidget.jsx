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
  TagEditor,
  CollectionPreferences,
  Pagination,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { FINANCE_PEOPLE } from "./financeDemoData.js";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-allocations-approvals-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-allocations-approvals-preferences-v1";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [
  { label: "10 rows", value: 10 },
  { label: "20 rows", value: 20 },
  { label: "50 rows", value: 50 },
];
const ALL_COLUMN_IDS = ["title", "amount", "stage", "sla", "dueOn", "requestedBy", "actions"];

const stageOptions = [
  { value: "all", label: "All stages" },
  { value: "program", label: "Program manager review" },
  { value: "finance", label: "Finance approval" },
  { value: "executive", label: "Executive certification" },
];

const slaOptions = [
  { value: "any", label: "Any SLA" },
  { value: "on-track", label: "On track" },
  { value: "due-soon", label: "Due soon" },
  { value: "breached", label: "Breached" },
];

const pendingApprovals = [
  {
    id: "TRF-24045",
    stage: "finance",
    title: "Reallocate $95K to Women in Trades Cohorts",
    amount: 95000,
    requestedBy: FINANCE_PEOPLE.programLead,
    submittedOn: "2024-10-11",
    sla: "due-soon",
    dueOn: "2024-10-18",
    potFrom: "Urban/Unaffiliated Envelope",
    potTo: "Women in Trades Cohorts",
    evidence: ["NWAC-BRD-24-07", "ESDC-WIT-2024"],
  },
  {
    id: "TRF-24039",
    stage: "executive",
    title: "Shift $150K to Digital Skills Accelerator pilot",
    amount: 150000,
    requestedBy: FINANCE_PEOPLE.seniorDirector,
    submittedOn: "2024-10-05",
    sla: "on-track",
    dueOn: "2024-10-21",
    potFrom: "Capacity & Infrastructure",
    potTo: "Digital Skills Accelerator",
    evidence: ["NWAC-TRD-15"],
  },
  {
    id: "TRF-24032",
    stage: "program",
    title: "Return $40K underspend to Capacity & Infrastructure",
    amount: 40000,
    requestedBy: FINANCE_PEOPLE.ceo,
    submittedOn: "2024-09-30",
    sla: "breached",
    dueOn: "2024-10-07",
    potFrom: "Employment Readiness Hubs",
    potTo: "Capacity & Infrastructure",
    evidence: ["HUB-FORECAST-Q3"],
  },
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
    console.error("[Allocations] failed to parse approvals column widths", error);
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
    console.error("[Allocations] failed to persist approvals column widths", error);
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
    console.error("[Allocations] failed to read approvals preferences", error);
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
    console.error("[Allocations] failed to persist approvals preferences", error);
  }
};

const SLA_BADGE = {
  "on-track": { type: "success", label: "On track" },
  "due-soon": { type: "warning", label: "Due soon" },
  breached: { type: "error", label: "Breached" },
};

const AllocationApprovalsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const initialPrefsRef = useRef(loadStoredPreferences());
  const initialPrefs = initialPrefsRef.current;
  const [stageFilter, setStageFilter] = useState(stageOptions[0]);
  const [slaFilter, setSlaFilter] = useState(slaOptions[0]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);
  const [pageSize, setPageSize] = useState(initialPrefs.pageSize);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const visibleSet = new Set(initialPrefs.visibleColumns ?? ALL_COLUMN_IDS);
    visibleSet.add("title");
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
            metadata.helpTitle ?? "Pending approvals",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  const filteredItems = useMemo(() => {
    return pendingApprovals.filter(item => {
      const stageMatch =
        stageFilter.value === "all" ? true : item.stage === stageFilter.value;
      const slaMatch =
        slaFilter.value === "any" ? true : item.sla === slaFilter.value;
      return stageMatch && slaMatch;
    });
  }, [stageFilter, slaFilter]);

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: "title",
        header: "Transfer",
        cell: item => (
          <SpaceBetween size="xxs">
            <Box variant="strong">{item.title}</Box>
            <Box variant="awsui-key-label">
              {item.potFrom} → {item.potTo}
            </Box>
          </SpaceBetween>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        cell: item => `$${item.amount.toLocaleString("en-CA")}`,
      },
      {
        id: "stage",
        header: "Stage",
        cell: item => {
          const map = {
            program: "Program manager",
            finance: "Finance review",
            executive: "Executive certification",
          };
          return map[item.stage] ?? item.stage;
        },
      },
      {
        id: "sla",
        header: "SLA status",
        cell: item => {
          const badge = SLA_BADGE[item.sla] ?? { type: "info", label: "Unknown" };
          return <StatusIndicator type={badge.type}>{badge.label}</StatusIndicator>;
        },
      },
      {
        id: "dueOn",
        header: "Due",
        cell: item => item.dueOn,
      },
      {
        id: "requestedBy",
        header: "Requested by",
        cell: item => item.requestedBy,
      },
      {
        id: "actions",
        header: "",
        cell: item => (
          <Link
            href="#"
            onFollow={event => {
              event.preventDefault();
              window.dispatchEvent(
                new CustomEvent("financeAllocations:openTransfer", {
                  detail: { transferId: item.id },
                })
              );
            }}
          >
            Open workflow
          </Link>
        ),
      },
    ],
    []
  );

  const mergedColumnDefinitions = useMemo(() => {
    const widthMap = new Map(columnWidths.map(entry => [entry.id, entry.width]));
    return baseColumnDefinitions.map(column => {
      const storedWidth = widthMap.get(column.id);
      return storedWidth ? { ...column, width: storedWidth } : column;
    });
  }, [baseColumnDefinitions, columnWidths]);

  const columnDefinitionsForTable = useMemo(() => {
    const allowed = new Set(visibleColumns);
    allowed.add("title");
    return mergedColumnDefinitions.filter(column => allowed.has(column.id));
  }, [mergedColumnDefinitions, visibleColumns]);

  const columnPreferenceOptions = useMemo(
    () =>
      mergedColumnDefinitions.map(column => ({
        id: column.id,
        label: typeof column.header === "string" ? column.header : column.id,
        alwaysVisible: column.id === "title",
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
    const temp = [];
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
        temp.push({ id, width: numeric });
      }
    });
    setColumnWidths(temp);
    persistColumnWidths(temp);
  };

  const totalMatches = filteredItems.length;
  const pagesCount = Math.max(1, Math.ceil(totalMatches / pageSize));
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
          visibleSet.add("title");
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
            <SpaceBetween size="xs" direction="horizontal">
              <Select
                selectedOption={stageFilter}
                options={stageOptions}
                onChange={({ detail }) => setStageFilter(detail.selectedOption)}
              />
              <Select
                selectedOption={slaFilter}
                options={slaOptions}
                onChange={({ detail }) => setSlaFilter(detail.selectedOption)}
              />
            </SpaceBetween>
          }
        >
          Pending approvals
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Pending approvals settings"
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
          selectionType="single"
          trackBy="id"
          items={pagedItems}
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
          columnDefinitions={columnDefinitionsForTable}
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          variant="embedded"
          header={
            <Header variant="h3" counter={`(${filteredItems.length})`}>
              Approval queue
            </Header>
          }
          empty={
            <Box padding="m">No pending approvals matching the selected filters.</Box>
          }
          preferences={preferencesComponent}
          pagination={paginationComponent}
        />
        {selected ? (
          <SpaceBetween size="s">
            <Box variant="awsui-key-label">Transfer ID</Box>
            <Box variant="p">
              {selected.id} — submitted {selected.submittedOn} by {selected.requestedBy}
            </Box>
            <Box variant="awsui-key-label">Evidence references</Box>
            <TagEditor
              i18nStrings={{
                triggerLabel: "Evidence",
                modalHeader: "Evidence references (read-only)",
                modalDescription: "Links will open in a new tab in the future implementation.",
                submitButton: "Close",
                cancelButton: "Cancel",
                inputPlaceholder: "Evidence reference",
                removeButton: label => `Remove ${label}`,
              }}
              tags={selected.evidence.map(label => ({ label }))}
              onSubmit={() => {}}
              readOnly
            />
          </SpaceBetween>
        ) : (
          <Box variant="awsui-key-label">
            Select a transfer to review justification and evidence references.
          </Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default AllocationApprovalsWidget;
