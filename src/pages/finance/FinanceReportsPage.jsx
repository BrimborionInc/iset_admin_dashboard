import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { SpaceBetween, Box, Button } from "@cloudscape-design/components";

import ReportsLifecycleWidget from "./widgets/ReportsLifecycleWidget.jsx";
import ReportsValidationSummaryWidget from "./widgets/ReportsValidationSummaryWidget.jsx";
import ReportsCertificationWidget from "./widgets/ReportsCertificationWidget.jsx";
import ReportsExportHistoryWidget from "./widgets/ReportsExportHistoryWidget.jsx";
import FinanceReportsLifecycleHelp from "../../helpPanelContents/financeReportsLifecycleHelp.js";
import FinanceReportsValidationHelp from "../../helpPanelContents/financeReportsValidationHelp.js";
import FinanceReportsCertificationHelp from "../../helpPanelContents/financeReportsCertificationHelp.js";
import FinanceReportsExportHistoryHelp from "../../helpPanelContents/financeReportsExportHistoryHelp.js";
import { ReportsDataProvider } from "./widgets/ReportsDataContext.jsx";

const STORAGE_KEY = "finance-reports-layout-v1";

const widgetRegistry = {
  lifecycle: {
    id: "lifecycle",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: ReportsLifecycleWidget,
    title: "Report lifecycle",
    description: "Stage tracker with due dates and telemetry.",
    helpComponent: FinanceReportsLifecycleHelp,
    helpTitle: "Report lifecycle",
    aiContext: FinanceReportsLifecycleHelp.aiContext,
  },
  validation: {
    id: "validation",
    defaultRowSpan: 3,
    defaultColumnSpan: 2,
    component: ReportsValidationSummaryWidget,
    title: "Validation summary",
    description: "Group, filter, and resolve validation findings.",
    helpComponent: FinanceReportsValidationHelp,
    helpTitle: "Validation summary",
    aiContext: FinanceReportsValidationHelp.aiContext,
  },
  certification: {
    id: "certification",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: ReportsCertificationWidget,
    title: "Certification & telemetry",
    description: "Signatory status, telemetry, and lock readiness.",
    helpComponent: FinanceReportsCertificationHelp,
    helpTitle: "Certification & telemetry",
    aiContext: FinanceReportsCertificationHelp.aiContext,
  },
  exports: {
    id: "exports",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: ReportsExportHistoryWidget,
    title: "Export history",
    description: "Submission packages and acknowledgements.",
    helpComponent: FinanceReportsExportHistoryHelp,
    helpTitle: "Export history",
    aiContext: FinanceReportsExportHistoryHelp.aiContext,
  },
};

const defaultLayout = [
  { id: "lifecycle", rowSpan: 6, columnSpan: 2 },
  { id: "validation", rowSpan: 6, columnSpan: 2 },
  { id: "certification", rowSpan: 4, columnSpan: 2 },
  { id: "exports", rowSpan: 4, columnSpan: 2 },
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
    console.error("[FinanceReports] failed to parse stored layout", error);
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
  navigationAriaLabel: "Financial reports dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between report widgets.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const FinanceReportsPage = ({
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
        { text: "Financial Reports", href: "/finance/reports" },
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
          console.error("[FinanceReports] failed to update palette items", error);
        }
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
    } catch (error) {
      console.error("[FinanceReports] failed to persist layout", error);
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
        console.error("[FinanceReports] failed to reset palette", error);
      }
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("[FinanceReports] failed to clear stored layout", error);
    }
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(paletteItems);
      } catch (error) {
        console.error("[FinanceReports] failed to open palette", error);
      }
    }
    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    window.addEventListener("financeReports:openPalette", handleOpen);
    window.addEventListener("financeReports:resetLayout", handleReset);
    return () => {
      window.removeEventListener("financeReports:openPalette", handleOpen);
      window.removeEventListener("financeReports:resetLayout", handleReset);
    };
  }, [openPalette, resetLayout]);

  return (
    <ReportsDataProvider>
      <SpaceBetween size="l">
        <Board
          i18nStrings={boardI18nStrings}
          items={boardItems}
          onItemsChange={handleItemsChange}
          renderItem={renderBoardItem}
          empty={
            <Box padding="m">
              No widgets on the Financial Reports dashboard. Use the palette to add widgets back.
              <Box margin={{ top: "s" }}>
                <Button
                  variant="link"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeReports:resetLayout"))
                  }
                >
                  Restore defaults
                </Button>
              </Box>
            </Box>
          }
        />
        <Box variant="awsui-key-label">
          Need a refresher on reporting workflow expectations? Open the help panel to review lifecycle,
          validation, certification, and export guidance.
        </Box>
      </SpaceBetween>
    </ReportsDataProvider>
  );
};

export default FinanceReportsPage;
