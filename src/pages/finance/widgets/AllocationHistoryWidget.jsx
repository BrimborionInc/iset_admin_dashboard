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
  Tabs,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { apiFetch } from "../../../auth/apiClient";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-allocations-history-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-allocations-history-preferences-v1";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [
  { label: "10 rows", value: 10 },
  { label: "20 rows", value: 20 },
  { label: "50 rows", value: 50 },
];
const ALL_COLUMN_IDS = ["approvedOn", "amount", "pots", "approvers"];

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
const parseDateOnly = raw => {
  if (!raw || typeof raw !== "string") return null;
  const parts = raw.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    if (Number.isInteger(y) && Number.isInteger(m) && Number.isInteger(d)) {
      const date = new Date(y, m - 1, d);
      if (!Number.isNaN(date.getTime())) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      }
    }
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const AllocationHistoryWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  items = [],
  pendingItems = [],
  onApply,
}) => {
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
  const [evidenceError, setEvidenceError] = useState(null);

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

  const historyItems = Array.isArray(items) ? items : [];
  const pending = Array.isArray(pendingItems)
    ? pendingItems.filter(item => item.status === "approved")
    : [];
  const [activeTab, setActiveTab] = useState("applied");

  const openEvidenceAttachment = async att => {
    if (!att) return;
    const directUrl = att.url && /^https?:\/\//i.test(att.url) ? att.url : null;
    if (directUrl) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!att.key && !att.url) {
      setEvidenceError("Attachment link is unavailable.");
      return;
    }
    setEvidenceError(null);
    try {
      const res = await apiFetch("/api/allocations/evidence/presign-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: att.key || att.url }),
      });
      if (!res || !res.ok) {
        throw new Error("Unable to prepare download.");
      }
      const payload = await res.json().catch(() => null);
      const target = payload?.url;
      if (!target) {
        throw new Error("Download link unavailable.");
      }
      const finalUrl = /^https?:\/\//i.test(target)
        ? target
        : `${process.env.REACT_APP_API_BASE_URL || ""}${target}`;
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setEvidenceError(err?.message || "Failed to open attachment.");
    }
  };

const baseColumnDefinitions = useMemo(
  () => [
    {
      id: "approvedOn",
      header: "Approved on",
      cell: item => item.approvedOn,
    },
    {
      id: "amount",
      header: "Amount",
      cell: item => {
        const numeric = Number(item.amount);
        return Number.isFinite(numeric) ? formatCurrency(numeric) : "-";
      },
    },
    {
      id: "pots",
      header: "Pots",
      cell: item => (
        <Box variant="p">
            {item.potFrom ?? "Unknown"} → {item.potTo ?? "Unknown"}
          </Box>
        ),
      },
      {
        id: "approvers",
        header: "Approval chain",
        cell: item => (Array.isArray(item.approvedBy) ? item.approvedBy.join(" → ") : "-"),
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
    allowed.add("approvedOn");
    return mergedColumnDefinitions.filter(column => allowed.has(column.id));
  }, [mergedColumnDefinitions, visibleColumns]);

  const columnPreferenceOptions = useMemo(
    () =>
      mergedColumnDefinitions.map(column => ({
        id: column.id,
        label: typeof column.header === "string" ? column.header : column.id,
        alwaysVisible: column.id === "approvedOn",
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

  const totalItems = historyItems.length;
  const pagesCount = Math.max(1, Math.ceil(totalItems / pageSize));
  useEffect(() => {
    if (currentPageIndex > pagesCount) {
      setCurrentPageIndex(1);
    }
  }, [currentPageIndex, pagesCount]);

  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return historyItems.slice(start, start + pageSize);
  }, [historyItems, currentPageIndex, pageSize]);

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

  const pendingColumnDefinitions = [
    {
      id: "title",
      header: "Transfer",
      cell: item => (
        <SpaceBetween size="xxs">
          <Box variant="strong">{item.title || `Transfer ${item.id}`}</Box>
          <Box variant="awsui-key-label">
            {item.potFrom ?? "Source"} → {item.potTo ?? "Destination"}
          </Box>
        </SpaceBetween>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      cell: item => {
        const numeric = Number(item.amount);
        return Number.isFinite(numeric) ? formatCurrency(numeric) : "-";
      },
    },
    {
      id: "effectiveDate",
      header: "Effective",
      cell: item => item.metadata?.effectiveDate || item.effectiveDate || "Not set",
    },
    {
      id: "due",
      header: "Due",
      cell: item => {
        const rawDate = item.metadata?.effectiveDate || item.effectiveDate;
        if (!rawDate) return "Not set";
        const date = parseDateOnly(rawDate);
        if (!date) return rawDate;
        const today = parseDateOnly(new Date().toISOString().slice(0, 10));
        const diffMs = date.getTime() - today.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        if (diffDays === -1) return "Yesterday";
        return diffDays > 1 ? `In ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: item => (
        <Link
          href="#"
          onFollow={event => {
            event.preventDefault();
            if (onApply) {
              onApply(item.id);
            }
          }}
        >
          Apply now
        </Link>
      ),
    },
  ];

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
          description="Track pending and applied transfers."
        >
          Transfers
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Transfers widget settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Tabs
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
        tabs={[
          {
            id: "pending",
            label: `Pending transfers (${pending.length})`,
            content: (
              <Table
                items={pending}
                trackBy="id"
                variant="embedded"
                stripedRows
                empty={<Box padding="m">No pending transfers.</Box>}
                columnDefinitions={pendingColumnDefinitions}
              />
            ),
          },
          {
            id: "applied",
            label: `Historical transfers (${historyItems.length})`,
            content: (
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
                  empty={<Box padding="m">No historical transfers available.</Box>}
                  preferences={preferencesComponent}
                  pagination={paginationComponent}
                />
                {selected ? (
                  <SpaceBetween size="s">
                    <ColumnLayout columns={2} variant="text-grid">
                      <SpaceBetween size="xxs">
                        <Box variant="awsui-key-label">Source balance (before → after)</Box>
                        <StatusIndicator type="info">
                          {formatCurrency(selected.before?.source ?? 0)} → {formatCurrency(selected.after?.source ?? 0)}
                        </StatusIndicator>
                      </SpaceBetween>
                      <SpaceBetween size="xxs">
                        <Box variant="awsui-key-label">Destination balance (before → after)</Box>
                        <StatusIndicator type="info">
                          {formatCurrency(selected.before?.destination ?? 0)} →{" "}
                          {formatCurrency(selected.after?.destination ?? 0)}
                        </StatusIndicator>
                      </SpaceBetween>
                    </ColumnLayout>
                    <Table
                      variant="embedded"
                      compact
                      wrapLines
                      trackBy="id"
                      columnDefinitions={[
                        { id: "label", header: "Label", cell: item => item.label || "Evidence" },
                        { id: "type", header: "Type", cell: item => item.type || "Not set" },
                        {
                          id: "attachments",
                          header: "Attachments",
                          cell: item =>
                            item.attachments && item.attachments.length ? (
                              <SpaceBetween size="xxs">
                                {item.attachments.map((att, idx) => (
                                  <Link
                                    key={`${item.id}-att-${idx}`}
                                    href={att.url || "#"}
                                    onFollow={event => {
                                      event.preventDefault();
                                      openEvidenceAttachment(att);
                                    }}
                                    target="_blank"
                                  >
                                    {att.name || att.key || "Attachment"}
                                  </Link>
                                ))}
                              </SpaceBetween>
                            ) : (
                              <Box variant="p">-</Box>
                            ),
                        },
                      ]}
                      items={
                        (() => {
                          const evidenceList =
                            (selected.metadata && Array.isArray(selected.metadata.evidence)
                              ? selected.metadata.evidence
                              : Array.isArray(selected.evidence)
                              ? selected.evidence
                              : []) || [];
                          return evidenceList.map((entry, idx) => {
                            const isObject = entry && typeof entry === "object";
                            return {
                              id: `evidence-${idx}`,
                              label: isObject ? entry.label : entry,
                              type: isObject ? entry.type : null,
                              attachments:
                                isObject && Array.isArray(entry.attachments) ? entry.attachments : [],
                            };
                          });
                        })()
                      }
                      empty={<Box variant="p">No evidence linked.</Box>}
                    />
                    {evidenceError ? (
                      <Box variant="p" color="text-status-error">
                        {evidenceError}
                      </Box>
                    ) : null}
                  </SpaceBetween>
                ) : (
                  <Box variant="awsui-key-label">
                    Select a row to compare before/after balances.
                  </Box>
                )}
              </SpaceBetween>
            ),
          },
        ]}
      />
    </BoardItem>
  );
};

export default AllocationHistoryWidget;
