import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { SpaceBetween, Box, Button, Link } from "@cloudscape-design/components";

import BudgetHierarchyWidget from "./widgets/BudgetHierarchyWidget.jsx";
import BudgetPotDetailWidget from "./widgets/BudgetPotDetailWidget.jsx";
import BudgetSavedViewsWidget from "./widgets/BudgetSavedViewsWidget.jsx";
import BudgetBurnRateWidget from "./widgets/BudgetBurnRateWidget.jsx";
import BudgetActiveViewWidget from "./widgets/BudgetActiveViewWidget.jsx";
import BudgetStructureManagerWidget from "./widgets/BudgetStructureManagerWidget.jsx";
import { BudgetsDataProvider } from "./widgets/BudgetsDataContext.jsx";

import FinanceBudgetsHelp from "../../helpPanelContents/financeBudgetsHelp.js";
import FinanceBudgetHierarchyHelp from "../../helpPanelContents/financeBudgetHierarchyHelp.js";
import FinanceBudgetPotDetailHelp from "../../helpPanelContents/financeBudgetPotDetailHelp.js";
import FinanceBudgetSavedViewsHelp from "../../helpPanelContents/financeBudgetSavedViewsHelp.js";
import FinanceBudgetBurnRateHelp from "../../helpPanelContents/financeBudgetBurnRateHelp.js";
import FinanceBudgetActiveViewHelp from "../../helpPanelContents/financeBudgetActiveViewHelp.js";
import FinanceBudgetStructureManagerHelp from "../../helpPanelContents/financeBudgetStructureManagerHelp.js";

const STORAGE_KEY = "finance-budgets-layout-v2";

const widgetRegistry = {
  hierarchy: {
    id: "hierarchy",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: BudgetHierarchyWidget,
    title: "Budget hierarchy",
    description: "Tree and flat views of budget pots with inline KPIs and filters.",
    helpComponent: FinanceBudgetHierarchyHelp,
    helpTitle: "Budget hierarchy",
    aiContext: FinanceBudgetHierarchyHelp.aiContext,
  },
  potDetail: {
    id: "potDetail",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: BudgetPotDetailWidget,
    title: "Pot detail",
    description: "Adjustment history, approvals, evidence, and quick actions for the selected pot.",
    helpComponent: FinanceBudgetPotDetailHelp,
    helpTitle: "Pot detail",
    aiContext: FinanceBudgetPotDetailHelp.aiContext,
  },
  structureManager: {
    id: "structureManager",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: BudgetStructureManagerWidget,
    title: "Structure manager",
    description: "Create and edit budget pots, manage drafts, and publish snapshots.",
    helpComponent: FinanceBudgetStructureManagerHelp,
    helpTitle: "Structure manager",
    aiContext: FinanceBudgetStructureManagerHelp.aiContext,
  },
  savedViews: {
    id: "savedViews",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: BudgetSavedViewsWidget,
    title: "Saved views & exports",
    description: "Manage reporting presets, apply filters, and download CSV/PDF snapshots.",
    helpComponent: FinanceBudgetSavedViewsHelp,
    helpTitle: "Saved views",
    aiContext: FinanceBudgetSavedViewsHelp.aiContext,
  },
  burnRate: {
    id: "burnRate",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: BudgetBurnRateWidget,
    title: "Burn-rate insights",
    description: "Micro indicators showing pacing versus plan with forecast variance highlights.",
    helpComponent: FinanceBudgetBurnRateHelp,
    helpTitle: "Burn-rate insights",
    aiContext: FinanceBudgetBurnRateHelp.aiContext,
  },
  activeView: {
    id: "activeView",
    defaultRowSpan: 1,
    defaultColumnSpan: 4,
    component: BudgetActiveViewWidget,
    title: "Loaded view summary",
    description: "Shows the currently applied saved view and presets.",
    helpComponent: FinanceBudgetActiveViewHelp,
    helpTitle: "Loaded view summary",
    aiContext: FinanceBudgetActiveViewHelp.aiContext,
  },
};

const defaultLayout = [
  { id: "hierarchy", rowSpan: 6, columnSpan: 2 },
  { id: "potDetail", rowSpan: 6, columnSpan: 2 },
  { id: "structureManager", rowSpan: 4, columnSpan: 2 },
  { id: "burnRate", rowSpan: 3, columnSpan: 2 },
];

const exportLayout = items =>
  items.map(({ id, rowSpan, columnSpan, columnOffset }) => ({
    id,
    rowSpan,
    columnSpan,
    columnOffset,
  }));

const toBoardItems = layout =>
  layout.map(item => {
    const definition = widgetRegistry[item.id];
    if (!definition) {
      return item;
    }
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
  });

const loadLayoutFromStorage = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter(entry => entry && widgetRegistry[entry.id]);
      return filtered.length ? filtered : null;
    }
  } catch (err) {
    console.error("[FinanceBudgets] failed to parse stored layout", err);
  }
  return null;
};

const areLayoutsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right || left.id !== right.id ||
      (left.rowSpan ?? null) !== (right.rowSpan ?? null) ||
      (left.columnSpan ?? null) !== (right.columnSpan ?? null) ||
      (left.columnOffset ?? null) !== (right.columnOffset ?? null)) {
      return false;
    }
  }
  return true;
};

const computePaletteItems = items =>
  Object.values(widgetRegistry)
    .filter(def => !items.some(item => item.id === def.id))
    .map(def => ({ id: def.id, data: { title: def.title, description: def.description } }));

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
  navigationAriaLabel: "Budgets dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets on the Budgets dashboard.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const FinanceBudgetsPage = ({
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
  toggleHelpPanel,
}) => {
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? defaultLayout);

  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems));

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "Financial Management", href: "/finance/overview" },
        { text: "Budgets", href: "/finance/budgets" },
      ]);
    }
  }, [updateBreadcrumbs]);

  useEffect(() => {
    const signature = JSON.stringify(paletteItems);
    if (paletteSignatureRef.current !== signature) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === "function") {
        try {
          setAvailableItems(paletteItems);
        } catch {}
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
    } catch {}
  }, [boardItems, paletteItems, setAvailableItems]);

  useEffect(() => {
    const handler = event => {
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
    window.addEventListener("palette:add", handler);
    return () => window.removeEventListener("palette:add", handler);
  }, []);

  const handleItemsChange = ({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) {
      return;
    }
    const next = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, next) ? current : next));
  };

  const renderBoardItem = (item, actions) => {
    if (!item?.id) {
      return null;
    }
    const definition = widgetRegistry[item.id];
    if (!definition) {
      return null;
    }
    const WidgetComponent = definition.component;
    return (
      <WidgetComponent
        actions={actions}
        metadata={item.data}
        toggleHelpPanel={toggleHelpPanel}
      />
    );
  };

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : defaultLayout));
    const defaultPalette = computePaletteItems(toBoardItems(defaultLayout));
    paletteSignatureRef.current = JSON.stringify(defaultPalette);
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(defaultPalette);
      } catch {}
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(paletteItems);
      } catch {}
    }
    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    window.addEventListener("financeBudgets:openPalette", handleOpen);
    window.addEventListener("financeBudgets:resetLayout", handleReset);
    return () => {
      window.removeEventListener("financeBudgets:openPalette", handleOpen);
      window.removeEventListener("financeBudgets:resetLayout", handleReset);
    };
  }, [openPalette, resetLayout]);

  return (
    <BudgetsDataProvider>
      <SpaceBetween size="l">
        <Board
          i18nStrings={boardI18nStrings}
          items={boardItems}
          onItemsChange={handleItemsChange}
          renderItem={renderBoardItem}
          empty={
            <Box padding="m">
              No widgets on the Budgets dashboard. Use the palette to add widgets back.
              <Box margin={{ top: "s" }}>
                <Button
                  variant="link"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeBudgets:resetLayout"))
                  }
                >
                  Restore defaults
                </Button>
              </Box>
            </Box>
          }
        />
        <Box variant="awsui-key-label">
          Need a reminder of the Budgets concept?{" "}
          <Link
            href="#"
            onFollow={event => {
              event.preventDefault();
              if (typeof toggleHelpPanel === "function") {
                const helpContent = React.createElement(FinanceBudgetsHelp);
                toggleHelpPanel(helpContent, "Budgets", FinanceBudgetsHelp.aiContext);
              }
            }}
          >
            Open help
          </Link>
        </Box>
      </SpaceBetween>
    </BudgetsDataProvider>
  );
};

export default FinanceBudgetsPage;
