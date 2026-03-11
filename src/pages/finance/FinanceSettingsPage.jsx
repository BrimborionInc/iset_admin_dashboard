import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { Box, SpaceBetween } from "@cloudscape-design/components";
import FinanceEmailRoutingWidget from "./widgets/FinanceEmailRoutingWidget.jsx";
import FinanceIntacctIntegrationWidget from "./widgets/FinanceIntacctIntegrationWidget.jsx";
import FinancePaymentTypeMappingWidget from "./widgets/FinancePaymentTypeMappingWidget.jsx";
import FinanceSettingsOverviewWidget from "./widgets/FinanceSettingsOverviewWidget.jsx";
import FinancePaymentTypeMappingHelp from "../../helpPanelContents/financePaymentTypeMappingHelp.js";

const STORAGE_KEY = "finance-settings-layout-v2";

const widgetRegistry = {
  overview: {
    id: "overview",
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
    component: FinanceSettingsOverviewWidget,
    title: "Finance settings overview",
    description: "Key goals, dependencies, and guidance for finance configuration.",
    helpComponent: null,
    helpTitle: "Finance settings overview",
    aiContext: null,
  },
  paymentTypeMap: {
    id: "paymentTypeMap",
    defaultRowSpan: 8,
    defaultColumnSpan: 4,
    component: FinancePaymentTypeMappingWidget,
    title: "Payment type mapping",
    description: "Configure allowed payment types, recurrence, submission timing, and evidence rules.",
    helpComponent: FinancePaymentTypeMappingHelp,
    helpTitle: "Payment type mapping",
    aiContext: FinancePaymentTypeMappingHelp.aiContext || null,
  },
  emailRouting: {
    id: "emailRouting",
    defaultRowSpan: 5,
    defaultColumnSpan: 4,
    component: FinanceEmailRoutingWidget,
    title: "Finance email routing",
    description: "Route payment packets to regional finance recipients.",
    helpComponent: null,
    helpTitle: "Finance email routing",
    aiContext: null,
  },
  intacctIntegration: {
    id: "intacctIntegration",
    defaultRowSpan: 9,
    defaultColumnSpan: 4,
    component: FinanceIntacctIntegrationWidget,
    title: "Sage Intacct integration",
    description: "Store Intacct XML Web Services credentials and defaults.",
    helpComponent: null,
    helpTitle: "Sage Intacct integration",
    aiContext: null,
  },
};

const defaultLayout = [
  { id: "overview", rowSpan: 4, columnSpan: 4 },
  { id: "paymentTypeMap", rowSpan: 8, columnSpan: 4 },
  { id: "emailRouting", rowSpan: 5, columnSpan: 4 },
  { id: "intacctIntegration", rowSpan: 9, columnSpan: 4 },
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
    console.error("[FinanceSettings] failed to parse stored layout", err);
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
  navigationAriaLabel: "Finance settings dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets on the Finance settings dashboard.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const FinanceSettingsPage = ({
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
  toggleHelpPanel,
}) => {
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? defaultLayout);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems.map(item => item.id)));
  const layoutSignatureRef = useRef(JSON.stringify(exportLayout(boardItems)));

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "Financial Management", href: "/finance/overview" },
        { text: "Finance Settings", href: "/finance/settings" },
      ]);
    }
  }, [updateBreadcrumbs]);

  useEffect(() => {
    const paletteSignature = JSON.stringify(paletteItems.map(item => item.id));
    if (paletteSignatureRef.current !== paletteSignature) {
      paletteSignatureRef.current = paletteSignature;
      if (typeof setAvailableItems === "function") {
        try {
          setAvailableItems(paletteItems);
        } catch {}
      }
    }
    const layoutSignature = JSON.stringify(exportLayout(boardItems));
    if (layoutSignatureRef.current !== layoutSignature) {
      layoutSignatureRef.current = layoutSignature;
      try {
        window.localStorage.setItem(STORAGE_KEY, layoutSignature);
      } catch {}
    }
  }, [boardItems, paletteItems, setAvailableItems]);

  useEffect(() => {
    const handleAdd = event => {
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
    window.addEventListener("palette:add", handleAdd);
    return () => window.removeEventListener("palette:add", handleAdd);
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
    paletteSignatureRef.current = JSON.stringify(defaultPalette.map(item => item.id));
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(defaultPalette);
      } catch {}
    }
    layoutSignatureRef.current = JSON.stringify(exportLayout(toBoardItems(defaultLayout)));
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
    window.addEventListener("financeSettings:openPalette", handleOpen);
    window.addEventListener("financeSettings:resetLayout", handleReset);
    return () => {
      window.removeEventListener("financeSettings:openPalette", handleOpen);
      window.removeEventListener("financeSettings:resetLayout", handleReset);
    };
  }, [openPalette, resetLayout]);

  return (
    <SpaceBetween size="l">
      <Board
        i18nStrings={boardI18nStrings}
        items={boardItems}
        onItemsChange={handleItemsChange}
        renderItem={renderBoardItem}
        empty={<Box padding="m">No widgets on the dashboard.</Box>}
      />
    </SpaceBetween>
  );
};

export default FinanceSettingsPage;
