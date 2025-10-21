import React, { useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Table,
  Box,
  Select,
  StatusIndicator,
  Slider,
  Button,
  Link,
  CollectionPreferences,
  Pagination,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useMonitoringData } from "./MonitoringDataContext.jsx";

const statusLabels = {
  queued: { label: "Queued", type: "pending" },
  in_progress: { label: "In progress", type: "info" },
  completed: { label: "Completed", type: "success" },
};

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

const COLUMN_WIDTHS_STORAGE_KEY = "finance-monitoring-sampling-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-monitoring-sampling-preferences-v1";
const PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 rows" },
  { value: 10, label: "10 rows" },
  { value: 20, label: "20 rows" },
];
const ALL_COLUMN_IDS = ["label", "tier", "size", "status", "reviewer", "dueDate"];

const loadColumnWidths = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(entry => {
        if (!entry || typeof entry !== "object") return null;
        const id = typeof entry.id === "string" ? entry.id : null;
        const width = Number(entry.width);
        if (!id || !Number.isFinite(width)) return null;
        return { id, width };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("[FinanceMonitoring] failed to parse sampling column widths", error);
    return [];
  }
};

const persistColumnWidths = widths => {
  if (typeof window === "undefined") return;
  try {
    if (Array.isArray(widths) && widths.length) {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    } else {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
    }
  } catch (error) {
    console.error("[FinanceMonitoring] failed to persist sampling column widths", error);
  }
};

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
    }
    const pageSize = PAGE_SIZE_OPTIONS.some(option => option.value === parsed.pageSize)
      ? parsed.pageSize
      : 10;
    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? parsed.visibleColumns.filter(id => ALL_COLUMN_IDS.includes(id))
      : ALL_COLUMN_IDS;
    return { pageSize, visibleColumns };
  } catch (error) {
    console.error("[FinanceMonitoring] failed to parse sampling preferences", error);
    return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
  }
};

const MonitoringSamplingTasksWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    samplingSets,
    updateSamplingStatus,
    reassignSamplingReviewer,
  } = useMonitoringData();
  const [statusFilter, setStatusFilter] = useState(statusOptions[0]);
  const [selectedId, setSelectedId] = useState(null);

  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [visibleColumns, setVisibleColumns] = useState(initialPreferences.visibleColumns);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const preferencesRef = useRef({
    pageSize: initialPreferences.pageSize,
    visibleColumns: initialPreferences.visibleColumns,
  });

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Sampling tasks",
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

  const filteredItems = useMemo(() => {
    if (statusFilter.value === "all") {
      return samplingSets;
    }
    return samplingSets.filter(set => set.status === statusFilter.value);
  }, [samplingSets, statusFilter]);

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [statusFilter]);

  const widthMap = useMemo(
    () => new Map(columnWidths.map(entry => [entry.id, entry.width])),
    [columnWidths]
  );

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: "label",
        header: "Sample set",
        width: widthMap.get("label"),
        cell: item => item.label,
      },
      {
        id: "tier",
        header: "Capacity tier",
        width: widthMap.get("tier"),
        cell: item => item.tier,
      },
      {
        id: "size",
        header: "Sample size",
        width: widthMap.get("size"),
        cell: item => `${item.completed}/${item.size}`,
      },
      {
        id: "status",
        header: "Status",
        width: widthMap.get("status"),
        cell: item => {
          const status = statusLabels[item.status] ?? statusLabels.queued;
          return <StatusIndicator type={status.type}>{status.label}</StatusIndicator>;
        },
      },
      {
        id: "reviewer",
        header: "Reviewer",
        width: widthMap.get("reviewer"),
        cell: item => item.reviewer,
      },
      {
        id: "dueDate",
        header: "Due date",
        width: widthMap.get("dueDate"),
        cell: item => item.dueDate,
      },
    ],
    [widthMap]
  );

  const columnDefinitions = useMemo(() => {
    const visibleSet = new Set(visibleColumns);
    return baseColumnDefinitions.filter(column => visibleSet.has(column.id));
  }, [baseColumnDefinitions, visibleColumns]);

  const pagesCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPageIndex, pageSize]);

  useEffect(() => {
    const currentPrefs = preferencesRef.current;
    if (
      currentPrefs.pageSize !== pageSize ||
      JSON.stringify(currentPrefs.visibleColumns) !== JSON.stringify(visibleColumns)
    ) {
      preferencesRef.current = { pageSize, visibleColumns };
      try {
        window.localStorage.setItem(
          PREFERENCES_STORAGE_KEY,
          JSON.stringify({ pageSize, visibleColumns })
        );
      } catch (error) {
        console.error("[FinanceMonitoring] failed to persist sampling preferences", error);
      }
    }
  }, [pageSize, visibleColumns]);

  const columnPreferenceOptions = useMemo(
    () =>
      ALL_COLUMN_IDS.map(id => ({
        id,
        label:
          id === "label"
            ? "Sample set"
            : id === "tier"
              ? "Capacity tier"
              : id === "size"
                ? "Sample size"
                : id === "status"
                  ? "Status"
                  : id === "reviewer"
                    ? "Reviewer"
                    : "Due date",
      })),
    []
  );

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize,
        contentDisplay: columnPreferenceOptions.map(option => ({
          id: option.id,
          visible: visibleColumns.includes(option.id),
        })),
        columnWidths,
      }}
      pageSizePreference={{
        title: "Rows per page",
        options: PAGE_SIZE_OPTIONS.map(option => ({ value: option.value, label: option.label })),
      }}
      contentDisplayPreference={{
        title: "Visible columns",
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
          visibleSet.add("label");
          const ordered = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
          setVisibleColumns(ordered);
        }
        if (Array.isArray(detail.columnWidths)) {
          const next = detail.columnWidths
            .map(entry => {
              if (!entry || typeof entry !== "object") return null;
              const numeric = Number(entry.width);
              if (typeof entry.id === "string" && Number.isFinite(numeric)) {
                return { id: entry.id, width: numeric };
              }
              return null;
            })
            .filter(Boolean);
          if (next.length) {
            setColumnWidths(next);
            persistColumnWidths(next);
          }
        }
        setCurrentPageIndex(1);
      }}
    />
  );

  const paginationComponent = (
    <Pagination
      currentPageIndex={currentPageIndex}
      pagesCount={pagesCount}
      onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
      disabled={pagesCount <= 1}
    />
  );

  const handleColumnWidthsChange = ({ detail }) => {
    const next = [];
    if (Array.isArray(detail?.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        if (!entry || typeof entry !== "object") return;
        const { id, width } = entry;
        const numeric = Number(width);
        if (typeof id === "string" && Number.isFinite(numeric)) {
          next.push({ id, width: numeric });
        }
      });
    } else if (Array.isArray(detail?.widths)) {
      detail.widths.forEach((width, index) => {
        const column = columnDefinitions[index];
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

  const selectedSampling =
    selectedId ? samplingSets.find(item => item.id === selectedId) ?? null : null;
  const selectedRow = selectedId ? pagedItems.find(item => item.id === selectedId) ?? null : null;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Manage sampling sets and reviewer workload."
          actions={
            <Select
              options={statusOptions}
              selectedOption={statusFilter}
              onChange={({ detail }) => setStatusFilter(detail.selectedOption)}
              selectedAriaLabel="Filter sampling tasks"
            />
          }
        >
          Sampling tasks
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Sampling tasks settings"
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
          selectedItems={selectedRow ? [selectedRow] : []}
          onSelectionChange={({ detail }) => setSelectedId(detail.selectedItems?.[0]?.id ?? null)}
          columnDefinitions={columnDefinitions}
          variant="embedded"
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          preferences={preferencesComponent}
          pagination={paginationComponent}
          empty={<Box padding="m">No sampling tasks match the selected filters.</Box>}
          header={
            <Header variant="h3" counter={`(${filteredItems.length})`}>
              Sampling queue
            </Header>
          }
        />
        {selectedSampling ? (
          <SpaceBetween size="s">
            <Box variant="awsui-key-label">Adjust completion</Box>
            <Slider
              min={0}
              max={selectedSampling.size}
              value={selectedSampling.completed}
              onChange={({ detail }) =>
                updateSamplingStatus(selectedSampling.id, selectedSampling.status, detail.value)
              }
            />
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() =>
                  updateSamplingStatus(selectedSampling.id, "in_progress", selectedSampling.completed)
                }
                disabled={selectedSampling.status === "in_progress"}
              >
                Mark in progress
              </Button>
              <Button
                onClick={() => updateSamplingStatus(selectedSampling.id, "completed", selectedSampling.size)}
                disabled={selectedSampling.status === "completed"}
                iconName="status-positive"
              >
                Complete sample
              </Button>
              <Button
                variant="link"
                onClick={() => reassignSamplingReviewer(selectedSampling.id, "Finance (Meera)")}
              >
                Reassign to Meera
              </Button>
            </SpaceBetween>
            <Box variant="p">Rationale: {selectedSampling.rationale}</Box>
          </SpaceBetween>
        ) : (
          <Box variant="awsui-key-label">Select a sample set to adjust progress or reassign reviewers.</Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default MonitoringSamplingTasksWidget;

