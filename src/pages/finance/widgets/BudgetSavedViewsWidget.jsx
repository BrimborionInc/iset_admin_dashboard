import React, { useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Table,
  Box,
  Button,
  Link,
  Select,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";

const PREFERENCE_STORAGE_KEY = "finance-budget-hierarchy-preferences-v1";
const COLUMN_WIDTHS_STORAGE_KEY = "finance-budget-saved-views-widths-v1";

const savedViews = [
  {
    id: "nwac-master",
    name: "NWAC master envelope",
    audience: "Executive",
    description: "Tree view of NWAC administration plus PTMA regions with overrun watch on client commitments.",
    presets: { viewMode: "tree", riskFilter: "overrun", timeframe: "fy25" },
    exports: ["CSV snapshot", "PDF board pack"],
  },
  {
    id: "regional-west",
    name: "Western PTMA commitments",
    audience: "Regional finance",
    description: "Flat list filtered to BC and Alberta PTMAs to track client funds vs. stewardship balances.",
    presets: { viewMode: "flat", riskFilter: "underspend", timeframe: "fy25-q2" },
    exports: ["CSV snapshot"],
  },
  {
    id: "northern-equity",
    name: "Northern equity watch",
    audience: "Operations",
    description: "Tree view focusing on Prairies, Atlantic, and Northern PTMAs with guardrails for top-ups.",
    presets: { viewMode: "tree", riskFilter: "underspend", timeframe: "fy25-q3" },
    exports: ["CSV snapshot", "JSON API payload"],
  },
];

const exportOptions = [
  { label: "CSV snapshot", value: "csv" },
  { label: "PDF board pack", value: "pdf" },
  { label: "JSON API payload", value: "json" },
];

const getInitialSelection = () => {
  if (typeof window === "undefined") {
    return [];
  }
  let hasStoredPrefs = false;
  try {
    const raw = window.localStorage.getItem(PREFERENCE_STORAGE_KEY);
    if (raw) {
      hasStoredPrefs = true;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const match = savedViews.find(
          view =>
            view?.presets?.viewMode === parsed.viewMode &&
            view?.presets?.riskFilter === parsed.riskFilter
        );
        if (match) {
          return [match];
        }
      }
    }
  } catch (error) {
    console.error("[Budgets] failed to parse saved view preferences", error);
  }
  if (hasStoredPrefs) {
    return [];
  }
  return savedViews.slice(0, 1);
};

const BudgetSavedViewsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const [selectedItems, setSelectedItems] = useState(() => getInitialSelection());
  const [exportFormat, setExportFormat] = useState(exportOptions[0]);
  const [columnWidths, setColumnWidths] = useState(() => {
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
      console.error("[Budgets] failed to read saved view column widths", error);
      return [];
    }
  });
  const hasDispatchedInitial = useRef(false);

  useEffect(() => {
    if (hasDispatchedInitial.current) {
      return;
    }
    const initial = selectedItems[0];
    if (!initial) {
      return;
    }
    hasDispatchedInitial.current = true;
    window.dispatchEvent(
      new CustomEvent("financeBudgets:viewLoaded", {
        detail: {
          viewId: initial.id,
          viewName: initial.name,
          description: initial.description,
          presets: initial.presets,
        },
      })
    );
  }, [selectedItems]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Saved views", metadata.aiContext ?? "");
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

  const handleViewLoad = view => {
    setSelectedItems([view]);
    window.dispatchEvent(
      new CustomEvent("financeBudgets:viewLoaded", {
        detail: {
          viewId: view.id,
          viewName: view.name,
          description: view.description,
          presets: view.presets,
        },
      })
    );
  };

  const handleExport = () => {
    const view = selectedItems[0];
    if (!view) return;
    window.dispatchEvent(
      new CustomEvent("financeBudgets:export", {
        detail: { viewId: view.id, format: exportFormat.value, presets: view.presets },
      })
    );
  };

  const actionsArea = (
    <SpaceBetween direction="horizontal" size="s">
      <Button
        iconName="add-plus"
        onClick={() => window.dispatchEvent(new CustomEvent("financeBudgets:newView"))}
      >
        New view
      </Button>
      <Select
        selectedOption={exportFormat}
        onChange={({ detail }) => setExportFormat(detail.selectedOption)}
        options={exportOptions}
        selectedAriaLabel="Export format"
      />
      <Button iconName="download" onClick={handleExport}>
        Export
      </Button>
    </SpaceBetween>
  );

  const selectedViewId = selectedItems[0]?.id;

  const tableItems = useMemo(() => savedViews, []);

  const columnDefinitions = useMemo(() => {
    const widthMap = new Map(columnWidths.map(entry => [entry.id, entry.width]));
    return [
      {
        id: "name",
        header: "View",
        width: widthMap.get("name"),
        cell: item => (
          <SpaceBetween size="xxs">
            <Box variant="strong">{item.name}</Box>
            <Box variant="awsui-key-label">{item.audience}</Box>
            <Box variant="p">{item.description}</Box>
          </SpaceBetween>
        ),
      },
      {
        id: "exports",
        header: "Available exports",
        width: widthMap.get("exports"),
        cell: item => item.exports.join(", "),
      },
      {
        id: "actions",
        header: "",
        width: widthMap.get("actions"),
        cell: item => (
          <Button variant="link" onClick={() => handleViewLoad(item)}>
            Load view
          </Button>
        ),
      },
    ];
  }, [columnWidths]);

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
        const column = columnDefinitions[index];
        const numeric = Number(width);
        if (column && Number.isFinite(numeric)) {
          next.push({ id: column.id, width: numeric });
        }
      });
    }
    if (next.length) {
      setColumnWidths(next);
      try {
        window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error("[Budgets] failed to persist saved view column widths", error);
      }
    }
  };

  return (
    <BoardItem
      header={
        <Header variant="h2" info={infoLink} actions={actionsArea}>
          Saved views &amp; exports
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Saved views settings"
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
          items={tableItems}
          trackBy="id"
          selectionType="single"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => {
            const view = detail.selectedItems?.[0];
            if (view) {
              handleViewLoad(view);
            } else {
              setSelectedItems([]);
            }
          }}
          columnDefinitions={columnDefinitions}
          resizableColumns
          onColumnWidthsChange={handleColumnWidthsChange}
          variant="embedded"
          header={
            <Header variant="h3" counter={`(${tableItems.length})`}>
              Saved configurations
            </Header>
          }
        />
        <Box variant="awsui-key-label">
          Loaded view: {selectedViewId ? selectedViewId : "None"}
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

export default BudgetSavedViewsWidget;
