import React, { useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { Box, SpaceBetween } from "@cloudscape-design/components";

import { SalariesDataProvider } from "./widgets/SalariesDataContext.jsx";
import SalaryControlsWidget from "./widgets/SalaryControlsWidget.jsx";
import SalaryAnnualEntriesWidget from "./widgets/SalaryAnnualEntriesWidget.jsx";
import SalarySummaryWidget from "./widgets/SalarySummaryWidget.jsx";

import FinanceSalaryControlsHelp from "../../helpPanelContents/financeSalaryControlsHelp.js";
import FinanceSalaryAnnualEntriesHelp from "../../helpPanelContents/financeSalaryAnnualEntriesHelp.js";
import FinanceSalarySummaryHelp from "../../helpPanelContents/financeSalarySummaryHelp.js";

const STORAGE_KEY = "finance-salaries-layout-v1";

const widgetRegistry = {
  controls: {
    id: "controls",
    component: SalaryControlsWidget,
    title: "Salary controls",
    description: "Choose the fiscal year and month for regional salary entry.",
    helpComponent: FinanceSalaryControlsHelp,
    helpTitle: "Salary controls",
    aiContext: FinanceSalaryControlsHelp.aiContext,
    defaultRowSpan: 1,
    defaultColumnSpan: 4,
  },
  entries: {
    id: "entries",
    component: SalaryAnnualEntriesWidget,
    title: "Annual salary entries",
    description: "Enter annual salary totals and assigned budget pots for each province or territory.",
    helpComponent: FinanceSalaryAnnualEntriesHelp,
    helpTitle: "Annual salary entries",
    aiContext: FinanceSalaryAnnualEntriesHelp.aiContext,
    defaultRowSpan: 6,
    defaultColumnSpan: 4,
  },
  summary: {
    id: "summary",
    component: SalarySummaryWidget,
    title: "Salary summary",
    description: "At-a-glance totals and coverage for the selected salary year.",
    helpComponent: FinanceSalarySummaryHelp,
    helpTitle: "Salary summary",
    aiContext: FinanceSalarySummaryHelp.aiContext,
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
  },
};

const defaultLayout = [
  { id: "controls", rowSpan: 1, columnSpan: 4 },
  { id: "entries", rowSpan: 6, columnSpan: 4 },
  { id: "summary", rowSpan: 2, columnSpan: 2 },
];

const exportLayout = items =>
  items.map(({ id, rowSpan, columnSpan, columnOffset }) => ({
    id,
    rowSpan,
    columnSpan,
    columnOffset,
  }));

const toBoardItems = layout =>
  layout
    .map(item => {
      const definition = widgetRegistry[item.id];
      if (!definition) return null;
      return {
        id: definition.id,
        rowSpan: item.rowSpan ?? definition.defaultRowSpan,
        columnSpan: item.columnSpan ?? definition.defaultColumnSpan,
        columnOffset: item.columnOffset,
        data: {
          title: definition.title,
          description: definition.description,
          component: definition.component,
          helpComponent: definition.helpComponent,
          helpTitle: definition.helpTitle,
          aiContext: definition.aiContext,
        },
      };
    })
    .filter(Boolean);

const computePaletteItems = boardItems =>
  Object.values(widgetRegistry)
    .filter(widget => !boardItems.some(item => item.id === widget.id))
    .map(widget => ({
      id: widget.id,
      data: {
        title: widget.title,
        description: widget.description,
      },
    }));

const loadLayoutFromStorage = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter(entry => entry && widgetRegistry[entry.id]);
      return filtered.length ? filtered : null;
    }
  } catch (error) {
    console.error("[FinanceSalaries] failed to parse stored layout", error);
  }
  return null;
};

const areLayoutsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) return false;
    if (left.id !== right.id) return false;
    if ((left.rowSpan ?? null) !== (right.rowSpan ?? null)) return false;
    if ((left.columnSpan ?? null) !== (right.columnSpan ?? null)) return false;
    if ((left.columnOffset ?? null) !== (right.columnOffset ?? null)) return false;
  }
  return true;
};

const boardI18nStrings = {
  liveAnnouncementDndStarted: operation => (operation === "resize" ? "Resizing" : "Dragging"),
  liveAnnouncementDndItemReordered: operation => {
    const position = operation.direction === "horizontal"
      ? `column ${operation.placement.x + 1}`
      : `row ${operation.placement.y + 1}`;
    return `Item moved to ${position}.`;
  },
  liveAnnouncementDndItemResized: operation => {
    const base = operation.direction === "horizontal"
      ? `columns ${operation.placement.width}`
      : `rows ${operation.placement.height}`;
    const constraint = operation.direction === "horizontal"
      ? (operation.isMinimalColumnsReached ? " (minimal)" : "")
      : (operation.isMinimalRowsReached ? " (minimal)" : "");
    return `Item resized to ${base}${constraint}.`;
  },
  liveAnnouncementDndItemInserted: operation => {
    const column = `column ${operation.placement.x + 1}`;
    const row = `row ${operation.placement.y + 1}`;
    return `Item inserted to ${column}, ${row}.`;
  },
  liveAnnouncementDndCommitted: operation => `${operation} committed`,
  liveAnnouncementDndDiscarded: operation => `${operation} discarded`,
  liveAnnouncementItemRemoved: op => `Removed item ${op.item.data.title}.`,
  navigationAriaLabel: "Salaries dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets on the Salaries dashboard.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const FinanceSalariesPage = ({
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
  toggleHelpPanel,
}) => {
  const [layout, setLayout] = useState(() =>
    typeof window === "undefined" ? defaultLayout : loadLayoutFromStorage() ?? defaultLayout
  );
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems));

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "Budgets and Finance", href: "/finance/overview" },
        { text: "Salaries", href: "/finance/salaries" },
      ]);
    }
  }, [updateBreadcrumbs]);

  useEffect(() => {
    const signature = JSON.stringify(paletteItems);
    if (paletteSignatureRef.current !== signature) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === "function") {
        setAvailableItems(paletteItems);
      }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
  }, [boardItems, paletteItems, setAvailableItems]);

  useEffect(() => {
    const handlePaletteAdd = event => {
      const id = event?.detail?.id;
      if (!id || !widgetRegistry[id]) {
        return;
      }
      setLayout(current => {
        if (current.some(item => item.id === id)) {
          return current;
        }
        return [...current, { id }];
      });
    };
    window.addEventListener("palette:add", handlePaletteAdd);
    return () => window.removeEventListener("palette:add", handlePaletteAdd);
  }, []);

  useEffect(() => {
    const handleOpenPalette = () => {
      if (typeof setAvailableItems === "function") {
        setAvailableItems(paletteItems);
      }
      if (typeof setSplitPanelOpen === "function") {
        setSplitPanelOpen(true);
      }
    };
    const handleResetLayout = () => {
      setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : defaultLayout));
      window.localStorage.removeItem(STORAGE_KEY);
      if (typeof setAvailableItems === "function") {
        setAvailableItems(computePaletteItems(toBoardItems(defaultLayout)));
      }
    };
    window.addEventListener("financeSalaries:openPalette", handleOpenPalette);
    window.addEventListener("financeSalaries:resetLayout", handleResetLayout);
    return () => {
      window.removeEventListener("financeSalaries:openPalette", handleOpenPalette);
      window.removeEventListener("financeSalaries:resetLayout", handleResetLayout);
    };
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  const handleItemsChange = ({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const nextLayout = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, nextLayout) ? current : nextLayout));
  };

  const renderBoardItem = (item, actions) => {
    if (!item?.data?.component) {
      return null;
    }
    const Component = item.data.component;
    return <Component actions={actions} metadata={item.data} toggleHelpPanel={toggleHelpPanel} />;
  };

  return (
    <SalariesDataProvider>
      <SpaceBetween size="m">
        <Box variant="p" color="text-body-secondary">
          Capture annual salary totals by province or territory, assign them to the appropriate budget pot, and let PATH derive an even monthly value for the year.
        </Box>
        <Board
          renderItem={renderBoardItem}
          items={boardItems}
          onItemsChange={handleItemsChange}
          i18nStrings={boardI18nStrings}
          empty={
            <Box textAlign="center" color="inherit">
              No salary widgets selected.
            </Box>
          }
        />
      </SpaceBetween>
    </SalariesDataProvider>
  );
};

export default FinanceSalariesPage;
