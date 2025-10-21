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
  CollectionPreferences,
  Pagination,
  Button,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useReportsData } from "./ReportsDataContext.jsx";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-reports-validation-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-reports-validation-preferences-v1";
const PAGE_SIZE_OPTIONS = [
  { label: "5 rows", value: 5 },
  { label: "10 rows", value: 10 },
  { label: "20 rows", value: 20 },
];
const ALL_COLUMN_IDS = ["id", "severity", "category", "message", "assignedTo", "status", "links"];

const severityOptions = [
  { value: "all", label: "All severities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statusIndicatorType = status => {
  switch (status) {
    case "open":
      return "error";
    case "in_progress":
      return "in-progress";
    case "resolved":
      return "success";
    default:
      return "pending";
  }
};

const loadColumnWidths = () => {
  if (typeof window === "undefined") {
    return [];
  }
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
    console.error("[FinanceReports] failed to parse validation column widths", error);
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
    console.error("[FinanceReports] failed to persist validation column widths", error);
  }
};

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
    }
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
    console.error("[FinanceReports] failed to parse validation preferences", error);
    return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
  }
};

const ReportsValidationSummaryWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    findingsForSelectedReport,
    resolveFinding,
    reassignFinding,
    selectedReport,
  } = useReportsData();
  const [severityFilter, setSeverityFilter] = useState(severityOptions[0]);
  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [visibleColumns, setVisibleColumns] = useState(initialPreferences.visibleColumns);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const preferencesRef = useRef({ pageSize: initialPreferences.pageSize, visibleColumns: initialPreferences.visibleColumns });

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(helpContent, metadata.helpTitle ?? "Validation summary", metadata.aiContext ?? "");
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
      return findingsForSelectedReport;
    }
    return findingsForSelectedReport.filter(item => item.severity === severityFilter.value);
  }, [findingsForSelectedReport, severityFilter]);

  const pagesCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPageIndex, pageSize]);

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [severityFilter, pageSize, selectedReport]);

  const widthMap = useMemo(() => new Map(columnWidths.map(entry => [entry.id, entry.width])), [columnWidths]);

  const columnDefinitions = useMemo(() => {
    const base = [
      {
        id: "id",
        header: "Finding ID",
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
        id: "message",
        header: "Detail",
        width: widthMap.get("message"),
        cell: item => item.message,
      },
      {
        id: "assignedTo",
        header: "Owner",
        width: widthMap.get("assignedTo"),
        cell: item => item.assignedTo,
      },
      {
        id: "status",
        header: "Status",
        width: widthMap.get("status"),
        cell: item => (
          <StatusIndicator type={statusIndicatorType(item.status)}>
            {item.status.replace(/_/g, " ")}
          </StatusIndicator>
        ),
      },
      {
        id: "links",
        header: "Remediation link",
        width: widthMap.get("links"),
        cell: item =>
          item.linkedWorkspace ? (
            <Link href={item.linkedWorkspace}>Open workspace</Link>
          ) : (
            "-"
          ),
      },
    ];
    const visibleSet = new Set(visibleColumns);
    return base.filter(column => visibleSet.has(column.id));
  }, [visibleColumns, widthMap]);

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

  const columnPreferenceOptions = useMemo(
    () =>
      ALL_COLUMN_IDS.map(id => ({
        id,
        label:
          id === "id"
            ? "Finding ID"
            : id === "assignedTo"
              ? "Owner"
              : id === "links"
                ? "Remediation link"
                : id.charAt(0).toUpperCase() + id.slice(1),
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
      try {
        window.localStorage.setItem(
          PREFERENCES_STORAGE_KEY,
          JSON.stringify({ pageSize, visibleColumns })
        );
      } catch (error) {
        console.error("[FinanceReports] failed to persist validation preferences", error);
      }
    }
  }, [pageSize, visibleColumns]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Review validation findings before certification."
          actions={
            <Select
              selectedOption={severityFilter}
              options={severityOptions}
              onChange={({ detail }) => setSeverityFilter(detail.selectedOption)}
              selectedAriaLabel="Filter validation findings by severity"
            />
          }
        >
          Validation summary
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Validation summary settings"
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
          columnDefinitions={columnDefinitions}
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          variant="embedded"
          empty={
            <Box padding="m">
              {selectedReport
                ? "No validation findings for this report."
                : "Select a report to see validation findings."}
            </Box>
          }
          header={
            <Header variant="h3" counter={`(${filteredItems.length})`}>
              Validation findings
            </Header>
          }
          preferences={preferencesComponent}
          pagination={paginationComponent}
        />
        <SpaceBetween size="xs" direction="horizontal">
          <Button
            disabled={!filteredItems.some(item => item.status !== "resolved")}
            onClick={() => {
              filteredItems.forEach(item => resolveFinding(item.id, "resolved"));
            }}
          >
            Mark filtered resolved
          </Button>
          <Button
            variant="link"
            onClick={() => {
              filteredItems.forEach(item => reassignFinding(item.id, "Finance (Meera)"));
            }}
          >
            Reassign to Finance
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default ReportsValidationSummaryWidget;
