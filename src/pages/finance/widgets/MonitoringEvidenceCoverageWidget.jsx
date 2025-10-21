import React, { useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Table,
  Box,
  Select,
  ProgressBar,
  StatusIndicator,
  Link,
  CollectionPreferences,
  Pagination,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useMonitoringData } from "./MonitoringDataContext.jsx";

const riskOptions = [
  { value: "all", label: "All statuses" },
  { value: "success", label: "On track" },
  { value: "warning", label: "At risk" },
  { value: "error", label: "Critical gap" },
];

const COLUMN_WIDTHS_STORAGE_KEY = "finance-monitoring-evidence-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-monitoring-evidence-preferences-v1";
const PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 rows" },
  { value: 10, label: "10 rows" },
  { value: 20, label: "20 rows" },
];
const ALL_COLUMN_IDS = ["program", "coverage", "target", "risk", "due", "owner"];

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
    console.error("[FinanceMonitoring] failed to parse evidence column widths", error);
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
    console.error("[FinanceMonitoring] failed to persist evidence column widths", error);
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
    console.error("[FinanceMonitoring] failed to parse evidence preferences", error);
    return { pageSize: 10, visibleColumns: ALL_COLUMN_IDS };
  }
};

const MonitoringEvidenceCoverageWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    coverage,
    filteredCoverage,
    coverageFilter,
    setCoverageFilter,
  } = useMonitoringData();

  const initialPreferences = useMemo(() => loadPreferences(), []);
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths);
  const [pageSize, setPageSize] = useState(initialPreferences.pageSize);
  const [visibleColumns, setVisibleColumns] = useState(initialPreferences.visibleColumns);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const preferencesRef = useRef({
    pageSize: initialPreferences.pageSize,
    visibleColumns: initialPreferences.visibleColumns,
  });

  const programOptions = useMemo(
    () => [
      { value: "all", label: "All programs" },
      ...coverage.map(entry => ({ value: entry.id, label: entry.program })),
    ],
    [coverage]
  );

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Evidence coverage",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [coverageFilter]);

  const widthMap = useMemo(() => new Map(columnWidths.map(entry => [entry.id, entry.width])), [columnWidths]);

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: "program",
        header: "Program",
        width: widthMap.get("program"),
        cell: item => item.program,
      },
      {
        id: "coverage",
        header: "Coverage",
        width: widthMap.get("coverage"),
        cell: item => (
          <ProgressBar
            value={Math.round(item.coverage * 100)}
            label={`${Math.round(item.coverage * 100)}%`}
            additionalInfo={`${item.missingCount} items outstanding`}
            variant="flash"
            color={item.coverage >= item.target ? "green" : item.coverage >= item.target - 0.1 ? "yellow" : "red"}
          />
        ),
      },
      {
        id: "target",
        header: "Target",
        width: widthMap.get("target"),
        cell: item => `${Math.round(item.target * 100)}%`,
      },
      {
        id: "risk",
        header: "Status",
        width: widthMap.get("risk"),
        cell: item => (
          <StatusIndicator type={item.risk}>
            {item.risk === "success" ? "On track" : item.risk === "warning" ? "Needs attention" : "Critical gap"}
          </StatusIndicator>
        ),
      },
      {
        id: "due",
        header: "Evidence due",
        width: widthMap.get("due"),
        cell: item => item.evidenceDue,
      },
      {
        id: "owner",
        header: "Owner",
        width: widthMap.get("owner"),
        cell: item => item.owner,
      },
    ],
    [widthMap]
  );

  const columnDefinitions = useMemo(() => {
    const visibleSet = new Set(visibleColumns);
    return baseColumnDefinitions.filter(column => visibleSet.has(column.id));
  }, [baseColumnDefinitions, visibleColumns]);

  const pagesCount = Math.max(1, Math.ceil(filteredCoverage.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return filteredCoverage.slice(start, start + pageSize);
  }, [filteredCoverage, currentPageIndex, pageSize]);

  useEffect(() => {
    const currentPrefs = preferencesRef.current;
    if (
      currentPrefs.pageSize !== pageSize ||
      JSON.stringify(currentPrefs.visibleColumns) !== JSON.stringify(visibleColumns))
    {
      preferencesRef.current = { pageSize, visibleColumns };
      try {
        window.localStorage.setItem(
          PREFERENCES_STORAGE_KEY,
          JSON.stringify({ pageSize, visibleColumns })
        );
      } catch (error) {
        console.error("[FinanceMonitoring] failed to persist evidence preferences", error);
      }
    }
  }, [pageSize, visibleColumns]);

  const columnPreferenceOptions = useMemo(
    () =>
      ALL_COLUMN_IDS.map(id => ({
        id,
        label:
          id === "program"
            ? "Program"
            : id === "coverage"
              ? "Coverage"
              : id === "target"
                ? "Target"
                : id === "risk"
                  ? "Status"
                  : id === "due"
                    ? "Evidence due"
                    : "Owner",
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
          visibleSet.add("program");
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

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Monitor evidence completeness and target gaps for remediation."
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Select
                options={riskOptions}
                selectedOption={riskOptions.find(option => option.value === coverageFilter.risk) ?? riskOptions[0]}
                onChange={({ detail }) =>
                  setCoverageFilter(filter => ({ ...filter, risk: detail.selectedOption.value }))
                }
              />
              <Select
                options={programOptions}
                selectedOption={programOptions.find(option => option.value === coverageFilter.program) ?? programOptions[0]}
                onChange={({ detail }) =>
                  setCoverageFilter(filter => ({ ...filter, program: detail.selectedOption.value }))
                }
              />
            </SpaceBetween>
          }
        >
          Evidence coverage
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Evidence coverage settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Table
        items={pagedItems}
        trackBy="id"
        columnDefinitions={columnDefinitions}
        variant="embedded"
        resizableColumns
        onColumnWidthsChange={handleColumnWidthsChange}
        preferences={preferencesComponent}
        pagination={paginationComponent}
        empty={<Box padding="m">No records match the selected filters.</Box>}
      />
    </BoardItem>
  );
};

export default MonitoringEvidenceCoverageWidget;
