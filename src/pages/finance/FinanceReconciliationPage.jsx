import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { SpaceBetween, Box, Button, Link } from "@cloudscape-design/components";

import ReconciliationTransactionsWidget from "./widgets/ReconciliationTransactionsWidget.jsx";
import ReconciliationExceptionDetailWidget from "./widgets/ReconciliationExceptionDetailWidget.jsx";
import ReconciliationBulkActionsWidget from "./widgets/ReconciliationBulkActionsWidget.jsx";
import ReconciliationSyncStatusWidget from "./widgets/ReconciliationSyncStatusWidget.jsx";
import { ReconciliationDataProvider } from "./widgets/ReconciliationDataContext.jsx";

import FinanceReconciliationHelp from "../../helpPanelContents/financeReconciliationHelp.js";
import FinanceReconciliationTransactionsHelp from "../../helpPanelContents/financeReconciliationTransactionsHelp.js";
import FinanceReconciliationDetailHelp from "../../helpPanelContents/financeReconciliationDetailHelp.js";
import FinanceReconciliationBulkHelp from "../../helpPanelContents/financeReconciliationBulkHelp.js";
import FinanceReconciliationSyncHelp from "../../helpPanelContents/financeReconciliationSyncHelp.js";

const STORAGE_KEY = "finance-reconciliation-layout-v1";

const widgetRegistry = {
  transactions: {
    id: "transactions",
    defaultRowSpan: 6,
    defaultColumnSpan: 4,
    component: ReconciliationTransactionsWidget,
    title: "Transactions queue",
    description: "Inbound transactions requiring reconciliation actions.",
    helpComponent: FinanceReconciliationTransactionsHelp,
    helpTitle: "Transactions queue",
    aiContext: FinanceReconciliationTransactionsHelp.aiContext,
  },
  detail: {
    id: "detail",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: ReconciliationExceptionDetailWidget,
    title: "Exception detail",
    description: "Full context for the selected transaction.",
    helpComponent: FinanceReconciliationDetailHelp,
    helpTitle: "Exception detail",
    aiContext: FinanceReconciliationDetailHelp.aiContext,
  },
  bulkActions: {
    id: "bulkActions",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: ReconciliationBulkActionsWidget,
    title: "Bulk actions",
    description: "Apply actions to selected transactions at once.",
    helpComponent: FinanceReconciliationBulkHelp,
    helpTitle: "Bulk actions",
    aiContext: FinanceReconciliationBulkHelp.aiContext,
  },
  syncStatus: {
    id: "syncStatus",
    defaultRowSpan: 2,
    defaultColumnSpan: 4,
    component: ReconciliationSyncStatusWidget,
    title: "Sync status",
    description: "Monitor ingest health for reconciliation feeds.",
    helpComponent: FinanceReconciliationSyncHelp,
    helpTitle: "Sync status",
    aiContext: FinanceReconciliationSyncHelp.aiContext,
  },
};

const defaultLayout = [
  { id: "transactions", rowSpan: 7, columnSpan: 4 },
  { id: "detail", rowSpan: 3, columnSpan: 2 },
  { id: "bulkActions", rowSpan: 3, columnSpan: 2 },
  { id: "syncStatus", rowSpan: 2, columnSpan: 4 },
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
  } catch (error) {
    console.error("[FinanceReconciliation] failed to parse stored layout", error);
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
    if (
      !left ||
      !right ||
      left.id !== right.id ||
      (left.rowSpan ?? null) !== (right.rowSpan ?? null) ||
      (left.columnSpan ?? null) !== (right.columnSpan ?? null) ||
      (left.columnOffset ?? null) !== (right.columnOffset ?? null)
    ) {
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
    const position =
      operation.direction === "horizontal"
        ? `column ${operation.placement.x + 1}`
        : `row ${operation.placement.y + 1}`;
    return `Item moved to ${position}.`;
  },
  liveAnnouncementDndItemResized: operation => {
    const base =
      operation.direction === "horizontal"
        ? `columns ${operation.placement.width}`
        : `rows ${operation.placement.height}`;
    const constraint =
      operation.direction === "horizontal"
        ? operation.isMinimalColumnsReached
          ? " (minimal)"
          : ""
        : operation.isMinimalRowsReached
          ? " (minimal)"
          : "";
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
  navigationAriaLabel: "Reconciliation dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets on the Reconciliation dashboard.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const FinanceReconciliationPage = ({
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
        { text: "Reconciliation", href: "/finance/reconciliation" },
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
        } catch (error) {
          console.error("[FinanceReconciliation] failed to update palette items", error);
        }
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
    } catch (error) {
      console.error("[FinanceReconciliation] failed to persist layout", error);
    }
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
      } catch (error) {
        console.error("[FinanceReconciliation] failed to reset palette", error);
      }
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("[FinanceReconciliation] failed to clear stored layout", error);
    }
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(paletteItems);
      } catch (error) {
        console.error("[FinanceReconciliation] failed to open palette", error);
      }
    }
    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    window.addEventListener("financeReconciliation:openPalette", handleOpen);
    window.addEventListener("financeReconciliation:resetLayout", handleReset);
    return () => {
      window.removeEventListener("financeReconciliation:openPalette", handleOpen);
      window.removeEventListener("financeReconciliation:resetLayout", handleReset);
    };
  }, [openPalette, resetLayout]);

  return (
    <ReconciliationDataProvider>
      <SpaceBetween size="l">
        <Board
          i18nStrings={boardI18nStrings}
          items={boardItems}
          onItemsChange={handleItemsChange}
          renderItem={renderBoardItem}
          empty={
            <Box padding="m">
              No widgets on the Reconciliation dashboard. Use the palette to add widgets back.
              <Box margin={{ top: "s" }}>
                <Button
                  variant="link"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeReconciliation:resetLayout"))
                  }
                >
                  Restore defaults
                </Button>
              </Box>
            </Box>
          }
        />
        <Box variant="awsui-key-label">
          Need a refresher on Reconciliation?{" "}
          <Link
            href="#"
            onFollow={event => {
              event.preventDefault();
              if (typeof toggleHelpPanel === "function") {
                const helpContent = React.createElement(FinanceReconciliationHelp);
                toggleHelpPanel(
                  helpContent,
                  "Reconciliation",
                  FinanceReconciliationHelp.aiContext
                );
              }
            }}
          >
            Open help
          </Link>
        </Box>
      </SpaceBetween>
    </ReconciliationDataProvider>
  );
};

export default FinanceReconciliationPage;
