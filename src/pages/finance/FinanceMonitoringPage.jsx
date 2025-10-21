import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { SpaceBetween, Box, Button } from "@cloudscape-design/components";

import MonitoringEvidenceCoverageWidget from "./widgets/MonitoringEvidenceCoverageWidget.jsx";
import MonitoringSamplingTasksWidget from "./widgets/MonitoringSamplingTasksWidget.jsx";
import MonitoringFindingsWidget from "./widgets/MonitoringFindingsWidget.jsx";
import MonitoringBundlesWidget from "./widgets/MonitoringBundlesWidget.jsx";
import FinanceMonitoringEvidenceHelp from "../../helpPanelContents/financeMonitoringEvidenceHelp.js";
import FinanceMonitoringSamplingHelp from "../../helpPanelContents/financeMonitoringSamplingHelp.js";
import FinanceMonitoringFindingsHelp from "../../helpPanelContents/financeMonitoringFindingsHelp.js";
import FinanceMonitoringBundlesHelp from "../../helpPanelContents/financeMonitoringBundlesHelp.js";
import { MonitoringDataProvider } from "./widgets/MonitoringDataContext.jsx";

const STORAGE_KEY = "finance-monitoring-layout-v1";

const widgetRegistry = {
  evidence: {
    id: "evidence",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: MonitoringEvidenceCoverageWidget,
    title: "Evidence coverage",
    description: "Coverage versus targets with risk filters.",
    helpComponent: FinanceMonitoringEvidenceHelp,
    helpTitle: "Evidence coverage",
    aiContext: FinanceMonitoringEvidenceHelp.aiContext,
  },
  sampling: {
    id: "sampling",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: MonitoringSamplingTasksWidget,
    title: "Sampling tasks",
    description: "Manage sampling sets and reviewer workload.",
    helpComponent: FinanceMonitoringSamplingHelp,
    helpTitle: "Sampling tasks",
    aiContext: FinanceMonitoringSamplingHelp.aiContext,
  },
  findings: {
    id: "findings",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: MonitoringFindingsWidget,
    title: "Findings log",
    description: "Monitor remediation for monitoring findings.",
    helpComponent: FinanceMonitoringFindingsHelp,
    helpTitle: "Findings log",
    aiContext: FinanceMonitoringFindingsHelp.aiContext,
  },
  bundles: {
    id: "bundles",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: MonitoringBundlesWidget,
    title: "Evidence bundles",
    description: "Track evidence bundle requests and delivery.",
    helpComponent: FinanceMonitoringBundlesHelp,
    helpTitle: "Evidence bundles",
    aiContext: FinanceMonitoringBundlesHelp.aiContext,
  },
};

const defaultLayout = [
  { id: "evidence", rowSpan: 6, columnSpan: 2 },
  { id: "sampling", rowSpan: 6, columnSpan: 2 },
  { id: "findings", rowSpan: 4, columnSpan: 2 },
  { id: "bundles", rowSpan: 4, columnSpan: 2 },
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
    console.error("[FinanceMonitoring] failed to parse stored layout", error);
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
      ? (operation.isMinimalColumnsReached ? " (minimal width)" : "")
      : (operation.isMinimalRowsReached ? " (minimal height)" : "");
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
  navigationAriaLabel: "Monitoring and evidence dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between monitoring widgets.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const FinanceMonitoringPage = ({
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
        { text: "Monitoring & Evidence", href: "/finance/monitoring" },
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
          console.error("[FinanceMonitoring] failed to update palette items", error);
        }
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
    } catch (error) {
      console.error("[FinanceMonitoring] failed to persist layout", error);
    }
  }, [boardItems, paletteItems, setAvailableItems]);

  useEffect(() => {
    const handlePaletteAdd = event => {
      const id = event?.detail?.id;
      if (!id || !widgetRegistry[id]) {
        return;
      }
      setLayout(current => {
        if (current.some(entry => entry.id === id)) {
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
        console.error("[FinanceMonitoring] failed to reset palette", error);
      }
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("[FinanceMonitoring] failed to clear layout", error);
    }
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(paletteItems);
      } catch (error) {
        console.error("[FinanceMonitoring] failed to open palette", error);
      }
    }
    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    window.addEventListener("financeMonitoring:openPalette", handleOpen);
    window.addEventListener("financeMonitoring:resetLayout", handleReset);
    return () => {
      window.removeEventListener("financeMonitoring:openPalette", handleOpen);
      window.removeEventListener("financeMonitoring:resetLayout", handleReset);
    };
  }, [openPalette, resetLayout]);

  return (
    <MonitoringDataProvider>
      <SpaceBetween size="l">
        <Board
          i18nStrings={boardI18nStrings}
          items={boardItems}
          onItemsChange={handleItemsChange}
          renderItem={renderBoardItem}
          empty={
            <Box padding="m">
              No widgets on the Monitoring & Evidence dashboard. Use the palette to add widgets back.
              <Box margin={{ top: "s" }}>
                <Button
                  variant="link"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeMonitoring:resetLayout"))
                  }
                >
                  Restore defaults
                </Button>
              </Box>
            </Box>
          }
        />
        <Box variant="awsui-key-label">
          Need guidance on sampling thresholds or evidence storage? Open the help panel for links to capacity-tier rules and workflow notes.
        </Box>
      </SpaceBetween>
    </MonitoringDataProvider>
  );
};

export default FinanceMonitoringPage;
