import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { Box, SpaceBetween } from "@cloudscape-design/components";
import CasesTableWidget from "./portfolio/widgets/CasesTableWidget.jsx";
import SummaryMetricsWidget from "./portfolio/widgets/SummaryMetricsWidget.jsx";
import FinanceOverviewWidget from "./portfolio/widgets/FinanceOverviewWidget.jsx";
import PortfolioCasesTableHelp from "../../helpPanelContents/portfolioCasesTableHelp.js";
import PortfolioSummaryMetricsHelp from "../../helpPanelContents/portfolioSummaryMetricsHelp.js";
import PortfolioFinanceOverviewHelp from "../../helpPanelContents/portfolioFinanceOverviewHelp.js";
import { PortfolioCaseProvider } from "./portfolio/PortfolioCaseContext.jsx";

const STORAGE_KEY = "iset-portfolio-dashboard-layout-v1";

const widgetRegistry = {
  summaryMetrics: {
    id: "summaryMetrics",
    defaultRowSpan: 2,
    defaultColumnSpan: 4,
    component: SummaryMetricsWidget,
    title: "Case summary",
    description: "Snapshot of active, ready-to-close, and financial totals for the current filters.",
    helpComponent: PortfolioSummaryMetricsHelp,
    helpTitle: "Portfolio summary metrics",
    aiContext: PortfolioSummaryMetricsHelp.aiContext,
  },
  financeOverview: {
    id: "financeOverview",
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
    component: FinanceOverviewWidget,
    title: "Finance overview",
    description: "Allocated funding versus actual and committed costs by agreement.",
    helpComponent: PortfolioFinanceOverviewHelp,
    helpTitle: "Portfolio finance overview",
    aiContext: PortfolioFinanceOverviewHelp.aiContext,
  },
  casesTable: {
    id: "casesTable",
    defaultRowSpan: 6,
    defaultColumnSpan: 4,
    component: CasesTableWidget,
    title: "Cases",
    description: "Monitor all cases you can access and open the case workspace for detailed management.",
    helpComponent: PortfolioCasesTableHelp,
    helpTitle: "Portfolio cases table",
    aiContext: PortfolioCasesTableHelp.aiContext,
  },
};

const defaultLayout = [{ id: "casesTable", rowSpan: 6, columnSpan: 4 }];

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

const loadLayoutFromStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const filtered = parsed.filter(entry => entry && widgetRegistry[entry.id]);
    return filtered.length ? filtered : null;
  } catch {
    return null;
  }
};

const computePaletteItems = items =>
  Object.values(widgetRegistry)
    .filter(def => !items.some(item => item.id === def.id))
    .map(def => ({
      id: def.id,
      data: { title: def.title, description: def.description },
    }));

const areLayoutsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
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
  liveAnnouncementItemRemoved: op =>
    op?.item?.data?.title ? `Removed item ${op.item.data.title}.` : "Removed item.",
  navigationAriaLabel: "ISET portfolio dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets on the portfolio dashboard.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const PortfolioDashboardPage = ({
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
  toggleHelpPanel,
}) => {
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? [...defaultLayout]);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems.map(item => item.id)));

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "ISET Assessment", href: "/case-assignment-dashboard" },
        { text: "Case portfolio", href: "/iset/cases" },
      ]);
    }
  }, [updateBreadcrumbs]);

  useEffect(() => {
    const signature = JSON.stringify(paletteItems.map(item => item.id));
    if (paletteSignatureRef.current !== signature) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === "function") {
        try {
          setAvailableItems(paletteItems);
        } catch {
          // ignore
        }
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
    } catch {
      // ignore storage errors in scaffold
    }
  }, [boardItems, paletteItems, setAvailableItems]);

  const handleItemsChange = useCallback(({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const next = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, next) ? current : next));
  }, []);

  const renderBoardItem = useCallback(
    (item, actions) => {
      if (!item?.id) return null;
      const definition = widgetRegistry[item.id];
      if (!definition) return null;
      const WidgetComponent = definition.component;
      return (
        <WidgetComponent
          actions={actions}
          metadata={item.data}
          toggleHelpPanel={toggleHelpPanel}
        />
      );
    },
    [toggleHelpPanel]
  );

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : [...defaultLayout]));
    const defaultPalette = computePaletteItems(toBoardItems(defaultLayout));
    paletteSignatureRef.current = JSON.stringify(defaultPalette.map(item => item.id));
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(defaultPalette);
      } catch {
        // ignore
      }
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(paletteItems);
      } catch {
        // ignore
      }
    }
    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const openHandler = () => openPalette();
    const resetHandler = () => resetLayout();
    window.addEventListener("iset-portfolio:openPalette", openHandler);
    window.addEventListener("iset-portfolio:resetLayout", resetHandler);
    return () => {
      window.removeEventListener("iset-portfolio:openPalette", openHandler);
      window.removeEventListener("iset-portfolio:resetLayout", resetHandler);
    };
  }, [openPalette, resetLayout]);

  return (
    <PortfolioCaseProvider>
      <SpaceBetween size="l">
        <Board
          items={boardItems}
          renderItem={renderBoardItem}
          onItemsChange={handleItemsChange}
          i18nStrings={boardI18nStrings}
          empty={<Box padding="m">No widgets configured.</Box>}
        />
      </SpaceBetween>
    </PortfolioCaseProvider>
  );
};

export default PortfolioDashboardPage;
