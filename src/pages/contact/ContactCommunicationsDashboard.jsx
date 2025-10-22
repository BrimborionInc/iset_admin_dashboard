import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { SpaceBetween, Box } from "@cloudscape-design/components";

import ContactMessageQueueWidget from "./widgets/ContactMessageQueueWidget.jsx";
import ContactMessageInsightsWidget from "./widgets/ContactMessageInsightsWidget.jsx";
import ContactMessageQueueHelp from "../../helpPanelContents/contactMessageQueueHelp.js";
import ContactMessageInsightsHelp from "../../helpPanelContents/contactMessageInsightsHelp.js";

const STORAGE_KEY = "contact-communications-layout-v1";

const widgetRegistry = {
  insights: {
    id: "insights",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: ContactMessageInsightsWidget,
    title: "Contact insights",
    description: "KPI snapshot for portal enquiries.",
    helpComponent: ContactMessageInsightsHelp,
    helpTitle: "Contact message insights",
    aiContext: ContactMessageInsightsHelp.aiContext,
  },
  queue: {
    id: "queue",
    defaultRowSpan: 8,
    defaultColumnSpan: 4,
    component: ContactMessageQueueWidget,
    title: "Contact queue",
    description: "Manage enquiries from the public portal.",
    helpComponent: ContactMessageQueueHelp,
    helpTitle: "Contact message queue",
    aiContext: ContactMessageQueueHelp.aiContext,
  },
};

const defaultLayout = [
  { id: "insights", rowSpan: 4, columnSpan: 2 },
  { id: "queue", rowSpan: 8, columnSpan: 4 },
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

const computePaletteItems = items =>
  Object.values(widgetRegistry)
    .filter(definition => !items.some(item => item.id === definition.id))
    .map(definition => ({
      id: definition.id,
      data: {
        title: definition.title,
        description: definition.description,
      },
    }));

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
  navigationAriaLabel: "Contact communications dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const loadLayoutFromStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter(entry => entry && widgetRegistry[entry.id]);
      return filtered.length ? filtered : null;
    }
  } catch (error) {
    console.error("[ContactCommunications] failed to parse stored layout", error);
  }
  return null;
};

const areLayoutsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right || left.id !== right.id) {
      return false;
    }
    if ((left.rowSpan ?? null) !== (right.rowSpan ?? null)) {
      return false;
    }
    if ((left.columnSpan ?? null) !== (right.columnSpan ?? null)) {
      return false;
    }
  }
  return true;
};

const ContactCommunicationsDashboard = ({
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
  toggleHelpPanel,
}) => {
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? defaultLayout);

  const [insightsRefresh, setInsightsRefresh] = useState(0);
  const bumpInsights = useCallback(() => {
    setInsightsRefresh(prev => prev + 1);
  }, []);

  useEffect(() => {
    bumpInsights();
  }, [bumpInsights]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => bumpInsights();
    window.addEventListener("contactMessages:changed", handler);
    return () => window.removeEventListener("contactMessages:changed", handler);
  }, [bumpInsights]);

  const handleQueueDataChanged = useCallback(() => {
    bumpInsights();
  }, [bumpInsights]);

  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems));

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "ISET Assessment", href: "/case-assignment-dashboard" },
        { text: "Contact Communications", href: "/contact-communications" },
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
        } catch {
          // ignore palette errors
        }
      }
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
      } catch {
        // ignore persistence errors
      }
    }
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
    const extraProps = {};
    if (definition.id === "queue") {
      extraProps.onDataChanged = handleQueueDataChanged;
    } else if (definition.id === "insights") {
      extraProps.refreshToken = insightsRefresh;
    }
    return (
      <WidgetComponent
        actions={actions}
        metadata={item.data}
        toggleHelpPanel={toggleHelpPanel}
        {...extraProps}
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
      } catch {
        // ignore palette errors
      }
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore persistence errors
      }
    }
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(paletteItems);
      } catch {
        // ignore palette errors
      }
    }
    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    window.addEventListener("contactCommunications:openPalette", handleOpen);
    window.addEventListener("contactCommunications:resetLayout", handleReset);
    return () => {
      window.removeEventListener("contactCommunications:openPalette", handleOpen);
      window.removeEventListener("contactCommunications:resetLayout", handleReset);
    };
  }, [openPalette, resetLayout]);

  return (
    <SpaceBetween size="l">
      <Board
        i18nStrings={boardI18nStrings}
        items={boardItems}
        onItemsChange={handleItemsChange}
        renderItem={renderBoardItem}
        empty={<Box padding="m">No widgets on the Contact Communications dashboard.</Box>}
      />
    </SpaceBetween>
  );
};

export default ContactCommunicationsDashboard;
