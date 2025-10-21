import React, { useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Table,
  Box,
  StatusIndicator,
  CollectionPreferences,
  Pagination,
  Link,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useForecastingData } from "./ForecastingDataContext.jsx";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-forecasting-comparison-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-forecasting-comparison-preferences-v1";
const PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 rows" },
  { value: 10, label: "10 rows" },
];
const ALL_COLUMN_IDS = ["name", "status", "owner", "total", "adminRate", "risk"];

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
    console.error("[FinanceForecasting] failed to parse comparison column widths", error);
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
    console.error("[FinanceForecasting] failed to persist comparison column widths", error);
  }
};

const loadPreferences = () => {
  if (typeof window === "undefined") {
    return { pageSize: 5, visibleColumns: ALL_COLUMN_IDS };
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { pageSize: 5, visibleColumns: ALL_COLUMN_IDS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { pageSize: 5, visibleColumns: ALL_COLUMN_IDS };
    }
    const pageSize = PAGE_SIZE_OPTIONS.some(option => option.value === parsed.pageSize)
      ? parsed.pageSize
      : 5;
    const visibleColumns = Array.isArray(parsed.visibleColumns)
      ? parsed.visibleColumns.filter(id => ALL_COLUMN_IDS.includes(id))
      : ALL_COLUMN_IDS;
    return { pageSize, visibleColumns };
  } catch (error) {
    console.error("[FinanceForecasting] failed to parse comparison preferences", error);
    return { pageSize: 5, visibleColumns: ALL_COLUMN_IDS };
  }
};

const statusIndicator = status => {
  switch (status) {
    case "approved":
      return { type: "success", label: "Approved" };
    case "review":
      return { type: "info", label: "In review" };
    case "draft":
    default:
      return { type: "pending", label: "Draft" };
  }
};

const riskBadge = risk => {
  switch (risk) {
    case "green":
      return { type: "success", label: "Low risk" };
    case "yellow":
      return { type: "warning", label: "Watch" };
    case "red":
      return { type: "error", label: "High risk" };
    default:
      return { type: "info", label: "Unknown" };
  }
};

const ForecastingComparisonWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { comparisonRows, selectScenario } = useForecastingData();

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
    toggleHelpPanel && metadata?.helpComponent ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Scenario comparison",
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

  const widthMap = useMemo(
    () => new Map(columnWidths.map(entry => [entry.id, entry.width])),
    [columnWidths]
  );

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: "name",
        header: "Scenario",
        width: widthMap.get("name"),
        cell: item => item.name,
      },
      {
        id: "status",
        header: "Status",
        width: widthMap.get("status"),
        cell: item => {
          const data = statusIndicator(item.status);
          return <StatusIndicator type={data.type}>{data.label}</StatusIndicator>;
        },
      },
      {
        id: "owner",
        header: "Owner",
        width: widthMap.get("owner"),
        cell: item => item.owner,
      },
      {
        id: "total",
        header: "Total spend",
        width: widthMap.get("total"),
        cell: item => `$${item.total.toLocaleString("en-CA")}`,
      },
      {
        id: "adminRate",
        header: "Admin %",
        width: widthMap.get("adminRate"),
        cell: item => `${item.adminRate.toFixed(1)}%`,
      },
      {
        id: "risk",
        header: "Risk",
        width: widthMap.get("risk"),
        cell: item => {
          const data = riskBadge(item.risk);
          return <StatusIndicator type={data.type}>{data.label}</StatusIndicator>;
        },
      },
    ],
    [widthMap]
  );

  const columnDefinitions = useMemo(() => {
    const visibleSet = new Set(visibleColumns);
    return baseColumnDefinitions.filter(column => visibleSet.has(column.id));
  }, [baseColumnDefinitions, visibleColumns]);

  const pagesCount = Math.max(1, Math.ceil(comparisonRows.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return comparisonRows.slice(start, start + pageSize);
  }, [comparisonRows, currentPageIndex, pageSize]);

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
        console.error("[FinanceForecasting] failed to persist comparison preferences", error);
      }
    }
  }, [pageSize, visibleColumns]);

  const columnPreferenceOptions = useMemo(
    () =>
      ALL_COLUMN_IDS.map(id => ({
        id,
        label:
          id === "name"
            ? "Scenario"
            : id === "status"
              ? "Status"
              : id === "owner"
                ? "Owner"
                : id === "total"
                  ? "Total spend"
                  : id === "adminRate"
                    ? "Admin %"
                    : "Risk",
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
          visibleSet.add("name");
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
          description="Compare scenarios to understand spend, admin %, and risk posture."
        >
          Scenario comparison
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Scenario comparison settings"
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
          variant="embedded"
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          preferences={preferencesComponent}
          pagination={paginationComponent}
          empty={<Box padding="m">No scenarios captured yet.</Box>}
          header={
            <Header variant="h3" counter={`(${comparisonRows.length})`}>
              Scenarios
            </Header>
          }
        />
        <Box variant="awsui-key-label">
          Need to inspect a scenario?{" "}
          <Link
            href="#"
            onFollow={event => {
              event.preventDefault();
              if (pagedItems.length) {
                selectScenario(pagedItems[0].id);
              }
            }}
          >
            Jump to workspace
          </Link>
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

export default ForecastingComparisonWidget;
