import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { SpaceBetween, Box } from "@cloudscape-design/components";

import { PaymentsDataProvider } from "../finance/widgets/PaymentsDataContext.jsx";
import PaymentRequestsWidget from "../finance/widgets/PaymentRequestsWidget.jsx";
import PaymentDetailWidget from "../finance/widgets/PaymentDetailWidget.jsx";

const STORAGE_KEY = "program-payments-layout-v1";

const PROGRAM_STATUS_OPTIONS = [
  { value: "all", label: "All packets" },
  { value: "draft", label: "My drafts / needs evidence", statuses: ["draft"] },
  {
    value: "submitted",
    label: "Submitted / in program review",
    statuses: ["submitted", "program_review"],
  },
  { value: "returned", label: "Returned", statuses: ["returned"] },
  { value: "program_approved", label: "Program approved", statuses: ["program_approved"] },
];

const widgetRegistry = {
  requests: {
    id: "requests",
    component: PaymentRequestsWidget,
    title: "Program payment queue",
    description: "Draft, submitted, returned, and approved packets awaiting finance review.",
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
  },
  detail: {
    id: "detail",
    component: PaymentDetailWidget,
    title: "Payment packet detail",
    description: "Upload evidence, resolve returns, and submit packets for approval.",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
  },
};

const defaultLayout = [
  { id: "requests", rowSpan: 5, columnSpan: 4 },
  { id: "detail", rowSpan: 5, columnSpan: 2 },
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
          mode: "program",
          statusOptions: PROGRAM_STATUS_OPTIONS,
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
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter(entry => entry && widgetRegistry[entry.id]);
      return filtered.length ? filtered : null;
    }
  } catch (error) {
    console.error("[ProgramPayments] failed to parse stored layout", error);
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
  navigationAriaLabel: "Program payments dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets on the Program Payments dashboard.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const ProgramPaymentsPage = ({
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
        { text: "ISET Case Portfolio", href: "/iset/cases" },
        { text: "Program Payments", href: "/iset/payments" },
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
    const handleOpenPalette = () => openPalette();
    const handleResetLayout = () => resetLayout();
    window.addEventListener("palette:add", handlePaletteAdd);
    window.addEventListener("programPayments:openPalette", handleOpenPalette);
    window.addEventListener("programPayments:resetLayout", handleResetLayout);
    return () => {
      window.removeEventListener("palette:add", handlePaletteAdd);
      window.removeEventListener("programPayments:openPalette", handleOpenPalette);
      window.removeEventListener("programPayments:resetLayout", handleResetLayout);
    };
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  const handleItemsChange = ({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) {
      return;
    }
    const next = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, next) ? current : next));
  };

  const renderBoardItem = (item, actions) => {
    if (!item || !item.data) {
      return null;
    }
    const Component = item.data.component;
    if (!Component) {
      return null;
    }
    return (
      <Component
        actions={actions}
        metadata={item.data}
        toggleHelpPanel={toggleHelpPanel}
      />
    );
  };

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : defaultLayout));
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("[ProgramPayments] failed to clear layout", error);
    }
  }, []);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === "function") {
      setAvailableItems(paletteItems);
    }
    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  return (
    <PaymentsDataProvider>
      <SpaceBetween size="l">
        <Board
          i18nStrings={boardI18nStrings}
          items={boardItems}
          onItemsChange={handleItemsChange}
          renderItem={renderBoardItem}
          empty={<Box padding="m">No widgets on the Program Payments dashboard.</Box>}
        />
      </SpaceBetween>
    </PaymentsDataProvider>
  );
};

export default ProgramPaymentsPage;
