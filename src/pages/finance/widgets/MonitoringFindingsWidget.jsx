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
  Button,
  Link,
  CollectionPreferences,
  Pagination,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useMonitoringData } from "./MonitoringDataContext.jsx";

const severityOptions = [
  { value: "all", label: "All severities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statusType = status => {
  switch (status) {
    case "open":
      return "error";
    case "in_progress":
      return "in-progress";
    case "resolved":
      return "success";
    default:
      return "info";
  }
};

const COLUMN_WIDTHS_STORAGE_KEY = "finance-monitoring-findings-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-monitoring-findings-preferences-v1";
const PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 rows" },
  { value: 10, label: "10 rows" },
  { value: 20, label: "20 rows" },
];
const ALL_COLUMN_IDS = ["id", "severity", "category", "description", "owner", "dueDate", "status", "report"];

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
    console.error("[FinanceMonitoring] failed to parse findings column widths", error);
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
    console.error("[FinanceMonitoring] failed to persist findings column widths", error);
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
    console.error("[FinanceMonitoring] failed to parse findings preferences", error);
    return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
  }
};

const MonitoringFindingsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    findings,
    updateFindingStatus,
    reassignFindingOwner,
  } = useMonitoringData();
  const [severityFilter, setSeverityFilter] = useState(severityOptions[0]);
  const [selectedIds, setSelectedIds] = useState([]);

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
            metadata.helpTitle ?? "Monitoring findings",
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
    if (severityFilter.value === "all") {
      return findings;
    }
    return findings.filter(item => item.severity === severityFilter.value);
  }, [findings, severityFilter]);

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [severityFilter]);

  const widthMap = useMemo(
    () => new Map(columnWidths.map(entry => [entry.id, entry.width])),
    [columnWidths]
  );

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: "id",
        header: "Finding",
        width: widthMap.get("id"),
        cell: item => item.id,
      },
      {
        id: "severity",
        header: "Severity",
        width: widthMap.get("severity"),
        cell: item => (
          <StatusIndicator type={item.severity === "high" ? "error" : item.severity === "medium" ? "warning" : "info"}>
            {item.severity}
          </StatusIndicator>
        ),
      },
      {
        id: "category",
        header: "Category",
        width: widthMap.get("category"),
        cell: item => item.category,
      },
      {
        id: "description",
        header: "Description",
        width: widthMap.get("description"),
        cell: item => item.description,
      },
      {
        id: "owner",
        header: "Owner",
        width: widthMap.get("owner"),
        cell: item => item.owner,
      },
      {
        id: "dueDate",
        header: "Due date",
        width: widthMap.get("dueDate"),
        cell: item => item.dueDate,
      },
      {
        id: "status",
        header: "Status",
        width: widthMap.get("status"),
        cell: item => (
          <StatusIndicator type={statusType(item.status)}>
            {item.status.replace(/_/g, " ")}
          </StatusIndicator>
        ),
      },
      {
        id: "report",
        header: "Related report",
        width: widthMap.get("report"),
        cell: item =>
          item.linkedWorkspace ? (
            <Link href={item.linkedWorkspace}>Open workspace</Link>
          ) : (
            item.relatedReport ?? "-"
          ),
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
        console.error("[FinanceMonitoring] failed to persist findings preferences", error);
      }
    }
  }, [pageSize, visibleColumns]);

  const columnPreferenceOptions = useMemo(
    () =>
      ALL_COLUMN_IDS.map(id => ({
        id,
        label:
          id === "id"
            ? "Finding"
            : id === "severity"
              ? "Severity"
              : id === "category"
                ? "Category"
                : id === "description"
                  ? "Description"
                  : id === "owner"
                    ? "Owner"
                    : id === "dueDate"
                      ? "Due date"
                      : id === "status"
                        ? "Status"
                        : "Related report",
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
          visibleSet.add("id");
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

  const selectedFindings = useMemo(
    () =>
      selectedIds
        .map(id => findings.find(item => item.id === id))
        .filter(Boolean),
    [selectedIds, findings]
  );

  const selectedRows = useMemo(() => {
    const setIds = new Set(selectedIds);
    return pagedItems.filter(item => setIds.has(item.id));
  }, [pagedItems, selectedIds]);

  const handleCloseSelected = () => {
    const target = selectedFindings.length ? selectedFindings : filteredItems;
    target.forEach(item => updateFindingStatus(item.id, "resolved"));
    if (!selectedFindings.length) {
      setSelectedIds([]);
    }
  };

  const handleReassignSelected = () => {
    const target = selectedFindings.length ? selectedFindings : filteredItems;
    target.forEach(item => reassignFindingOwner(item.id, "Compliance (Audit)"));
    if (!selectedFindings.length) {
      setSelectedIds([]);
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Log monitoring findings and track remediation progress."
          actions={
            <Select
              options={severityOptions}
              selectedOption={severityFilter}
              onChange={({ detail }) => setSeverityFilter(detail.selectedOption)}
              selectedAriaLabel="Filter monitoring findings"
            />
          }
        >
          Findings log
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Findings log settings"
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
          selectionType="multi"
          selectedItems={selectedRows}
          onSelectionChange={({ detail }) => setSelectedIds(detail.selectedItems.map(item => item.id))}
          columnDefinitions={columnDefinitions}
          variant="embedded"
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          preferences={preferencesComponent}
          pagination={paginationComponent}
          empty={<Box padding="m">No findings recorded for the selected filter.</Box>}
          header={
            <Header variant="h3" counter={`(${filteredItems.length})`}>
              Monitoring findings
            </Header>
          }
        />
        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={handleCloseSelected}>Close selected</Button>
          <Button variant="link" onClick={handleReassignSelected}>
            Reassign to Compliance
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default MonitoringFindingsWidget;

