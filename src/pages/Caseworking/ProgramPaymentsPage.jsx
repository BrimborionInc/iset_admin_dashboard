import React, { useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { SpaceBetween, Box, Link } from "@cloudscape-design/components";

import { PaymentsDataProvider } from "../finance/widgets/PaymentsDataContext.jsx";
import PaymentRequestsWidget from "../finance/widgets/PaymentRequestsWidget.jsx";
import PaymentDetailWidget from "../finance/widgets/PaymentDetailWidget.jsx";
import PaymentCommunicationWidget from "../finance/widgets/PaymentCommunicationWidget.jsx";
import PaymentSlaWidget from "../finance/widgets/PaymentSlaWidget.jsx";
import FinancePaymentsHelp from "../../helpPanelContents/financePaymentsHelp.js";
import FinancePaymentRequestsHelp from "../../helpPanelContents/financePaymentRequestsHelp.js";
import FinancePaymentDetailHelp from "../../helpPanelContents/financePaymentDetailHelp.js";
import FinancePaymentCommsHelp from "../../helpPanelContents/financePaymentCommsHelp.js";
import FinancePaymentSlaHelp from "../../helpPanelContents/financePaymentSlaHelp.js";

const STORAGE_KEY = "program-payments-layout-v3";

const widgetRegistry = {
  requests: {
    id: "requests",
    component: PaymentRequestsWidget,
    mode: "program",
    title: "Payment packet queue",
    description: "Payment packets across the cases you can access.",
    helpComponent: FinancePaymentRequestsHelp,
    helpTitle: "Payment packet queue",
    aiContext: FinancePaymentRequestsHelp.aiContext,
    defaultRowSpan: 5,
    defaultColumnSpan: 4,
  },
  detail: {
    id: "detail",
    component: PaymentDetailWidget,
    mode: "program",
    title: "Payment packet detail",
    description: "Packet lines, evidence, validation, send, and follow-up.",
    helpComponent: FinancePaymentDetailHelp,
    helpTitle: "Payment detail",
    aiContext: FinancePaymentDetailHelp.aiContext,
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
  },
  comms: {
    id: "comms",
    component: PaymentCommunicationWidget,
    mode: "program",
    title: "Payment communications",
    description: "Finance email handoff and follow-up communication log.",
    helpComponent: FinancePaymentCommsHelp,
    helpTitle: "Payment communications",
    aiContext: FinancePaymentCommsHelp.aiContext,
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
  },
  sla: {
    id: "sla",
    component: PaymentSlaWidget,
    mode: "program",
    title: "SLA snapshot",
    description: "Evidence completeness and payment follow-up timing.",
    helpComponent: FinancePaymentSlaHelp,
    helpTitle: "SLA snapshot",
    aiContext: FinancePaymentSlaHelp.aiContext,
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
  },
};

const defaultLayout = [
  { id: "requests", rowSpan: 5, columnSpan: 4 },
  { id: "detail", rowSpan: 4, columnSpan: 2 },
  { id: "comms", rowSpan: 4, columnSpan: 4 },
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
          mode: definition.mode,
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
  navigationAriaLabel: "Payments dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets on the Payments dashboard.",
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
        { text: "ISET Clients", href: "/iset/cases" },
        { text: "Payments", href: "/iset/payments" },
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
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error("[ProgramPayments] failed to clear layout", error);
      }
    };
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

  return (
    <PaymentsDataProvider autoSelectFirst={false}>
      <SpaceBetween size="l">
        <Board
          i18nStrings={boardI18nStrings}
          items={boardItems}
          onItemsChange={handleItemsChange}
          renderItem={renderBoardItem}
          empty={<Box padding="m">No widgets on the Payments dashboard.</Box>}
        />
        <Box variant="awsui-key-label">
          Need to revisit the Payments workflow description?{" "}
          <Link
            href="#"
            onFollow={event => {
              event.preventDefault();
              if (typeof toggleHelpPanel === "function") {
                const helpContent = React.createElement(FinancePaymentsHelp);
                toggleHelpPanel(helpContent, "Payments", FinancePaymentsHelp.aiContext);
              }
            }}
          >
            Open help
          </Link>
        </Box>
      </SpaceBetween>
    </PaymentsDataProvider>
  );
};

export default ProgramPaymentsPage;
