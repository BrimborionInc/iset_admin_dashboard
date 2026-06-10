import React, { useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Table,
  Box,
  CollectionPreferences,
  Pagination,
  Slider,
  Textarea,
  Button,
  Link,
  Select,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useForecastingData } from "./ForecastingDataContext.jsx";

const COLUMN_WIDTHS_STORAGE_KEY = "finance-forecasting-workspace-widths-v1";
const PREFERENCES_STORAGE_KEY = "finance-forecasting-workspace-preferences-v1";
const PAGE_SIZE_OPTIONS = [
  { value: 5, label: "5 rows" },
  { value: 10, label: "10 rows" },
  { value: 20, label: "20 rows" },
];
const ALL_COLUMN_IDS = ["pot", "currentForecast", "scenarioForecast", "variance", "justification"];

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
    console.error("[FinanceForecasting] failed to parse workspace column widths", error);
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
    console.error("[FinanceForecasting] failed to persist workspace column widths", error);
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
    console.error("[FinanceForecasting] failed to parse workspace preferences", error);
    return { pageSize: 5, visibleColumns: ALL_COLUMN_IDS };
  }
};

const ForecastingScenarioWorkspaceWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    scenarios,
    activeScenario,
    activeScenarioId,
    selectScenario,
    updateAdjustment,
    duplicateScenario,
    promoteScenario,
    createScenario,
  } = useForecastingData();
  const [selectedAdjustmentId, setSelectedAdjustmentId] = useState(null);
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
            metadata.helpTitle ?? "Scenario workspace",
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

  const adjustments = useMemo(() => activeScenario?.adjustments ?? [], [activeScenario?.adjustments]);

  useEffect(() => {
    setCurrentPageIndex(1);
    setSelectedAdjustmentId(null);
  }, [activeScenarioId]);

  const widthMap = useMemo(
    () => new Map(columnWidths.map(entry => [entry.id, entry.width])),
    [columnWidths]
  );

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: "pot",
        header: "Pot",
        width: widthMap.get("pot"),
        cell: item => item.pot,
      },
      {
        id: "currentForecast",
        header: "Current forecast",
        width: widthMap.get("currentForecast"),
        cell: item => `$${item.currentForecast.toLocaleString("en-CA")}`,
      },
      {
        id: "scenarioForecast",
        header: "Scenario forecast",
        width: widthMap.get("scenarioForecast"),
        cell: item => `$${item.scenarioForecast.toLocaleString("en-CA")}`,
      },
      {
        id: "variance",
        header: "Variance",
        width: widthMap.get("variance"),
        cell: item => {
          const value = item.variance;
          const prefix = value > 0 ? "+" : "";
          return (
            <span style={{ color: value > 0 ? "#0f62fe" : value < 0 ? "#d4351c" : "inherit" }}>
              {prefix}${value.toLocaleString("en-CA")}
            </span>
          );
        },
      },
      {
        id: "justification",
        header: "Justification",
        width: widthMap.get("justification"),
        cell: item => item.justification,
      },
    ],
    [widthMap]
  );

  const columnDefinitions = useMemo(() => {
    const visibleSet = new Set(visibleColumns);
    return baseColumnDefinitions.filter(column => visibleSet.has(column.id));
  }, [baseColumnDefinitions, visibleColumns]);

  const pagesCount = Math.max(1, Math.ceil(adjustments.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return adjustments.slice(start, start + pageSize);
  }, [adjustments, currentPageIndex, pageSize]);

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
        console.error("[FinanceForecasting] failed to persist workspace preferences", error);
      }
    }
  }, [pageSize, visibleColumns]);

  const columnPreferenceOptions = useMemo(
    () =>
      ALL_COLUMN_IDS.map(id => ({
        id,
        label:
          id === "pot"
            ? "Pot"
            : id === "currentForecast"
              ? "Current forecast"
              : id === "scenarioForecast"
                ? "Scenario forecast"
                : id === "variance"
                  ? "Variance"
                  : "Justification",
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
          visibleSet.add("pot");
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

  const selectedAdjustment = useMemo(
    () => adjustments.find(item => item.id === selectedAdjustmentId) ?? null,
    [adjustments, selectedAdjustmentId]
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Adjust forecasts for the active scenario and capture rationale."
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Select
                selectedOption={
                  scenarios
                    .map(scenario => ({ value: scenario.id, label: scenario.name }))
                    .find(option => option.value === activeScenarioId) ??
                  { value: activeScenarioId, label: activeScenario?.name ?? "Scenario" }
                }
                options={scenarios.map(scenario => ({
                  value: scenario.id,
                  label: scenario.name,
                }))}
                onChange={({ detail }) => selectScenario(detail.selectedOption.value)}
              />
              <Button onClick={() => duplicateScenario(activeScenarioId)} iconName="copy">
                Duplicate
              </Button>
              <Button onClick={() => promoteScenario(activeScenarioId, "review")} iconName="upload">
                Send for review
              </Button>
              <Button onClick={() => createScenario({ name: "New draft scenario" })} iconName="add-plus">
                New scenario
              </Button>
            </SpaceBetween>
          }
        >
          Scenario workspace
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Scenario workspace settings"
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
          selectedItems={
            selectedAdjustment ? pagedItems.filter(item => item.id === selectedAdjustment.id) : []
          }
          onSelectionChange={({ detail }) =>
            setSelectedAdjustmentId(detail.selectedItems?.[0]?.id ?? null)
          }
          columnDefinitions={columnDefinitions}
          variant="embedded"
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          preferences={preferencesComponent}
          pagination={paginationComponent}
          empty={<Box padding="m">No adjustments recorded for this scenario.</Box>}
          header={
            <Header variant="h3" counter={`(${adjustments.length})`}>
              Scenario adjustments
            </Header>
          }
        />
        {selectedAdjustment ? (
          <SpaceBetween size="s">
            <Box variant="awsui-key-label">Edit forecast for {selectedAdjustment.pot}</Box>
            <Slider
              min={Math.max(0, selectedAdjustment.currentForecast * 0.6)}
              max={selectedAdjustment.currentForecast * 1.4}
              step={5_000}
              value={selectedAdjustment.scenarioForecast}
              onChange={({ detail }) =>
                updateAdjustment(
                  activeScenarioId,
                  selectedAdjustment.id,
                  detail.value,
                  selectedAdjustment.justification
                )
              }
            />
            <Textarea
              rows={3}
              value={selectedAdjustment.justification}
              onChange={({ detail }) =>
                updateAdjustment(
                  activeScenarioId,
                  selectedAdjustment.id,
                  selectedAdjustment.scenarioForecast,
                  detail.value
                )
              }
              placeholder="Capture adjustments, approvals, or risk notes."
            />
          </SpaceBetween>
        ) : (
          <Box variant="awsui-key-label">
            Select a pot to adjust the scenario forecast and provide justification.
          </Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ForecastingScenarioWorkspaceWidget;
