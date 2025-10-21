import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { SpaceBetween, Box, Button, Link } from "@cloudscape-design/components";

import AllocationTransferWizardWidget from "./widgets/AllocationTransferWizardWidget.jsx";
import AllocationApprovalsWidget from "./widgets/AllocationApprovalsWidget.jsx";
import AllocationHistoryWidget from "./widgets/AllocationHistoryWidget.jsx";
import AllocationPolicyWidget from "./widgets/AllocationPolicyWidget.jsx";
import AllocationSnapshotsWidget from "./widgets/AllocationSnapshotsWidget.jsx";

import FinanceAllocationsHelp from "../../helpPanelContents/financeAllocationsHelp.js";
import FinanceAllocationTransferWizardHelp from "../../helpPanelContents/financeAllocationTransferWizardHelp.js";
import FinanceAllocationApprovalsHelp from "../../helpPanelContents/financeAllocationApprovalsHelp.js";
import FinanceAllocationHistoryHelp from "../../helpPanelContents/financeAllocationHistoryHelp.js";
import FinanceAllocationPolicyHelp from "../../helpPanelContents/financeAllocationPolicyHelp.js";
import FinanceAllocationSnapshotsHelp from "../../helpPanelContents/financeAllocationSnapshotsHelp.js";

const STORAGE_KEY = "finance-allocations-layout-v1";

const widgetRegistry = {
  wizard: {
    id: "wizard",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: AllocationTransferWizardWidget,
    title: "Transfer wizard",
    description: "Stage reallocations with guardrails before routing for approval.",
    helpComponent: FinanceAllocationTransferWizardHelp,
    helpTitle: "Transfer wizard",
    aiContext: FinanceAllocationTransferWizardHelp.aiContext,
  },
  approvals: {
    id: "approvals",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: AllocationApprovalsWidget,
    title: "Pending approvals",
    description: "Monitor reallocation requests by stage, SLA, and approver.",
    helpComponent: FinanceAllocationApprovalsHelp,
    helpTitle: "Pending approvals",
    aiContext: FinanceAllocationApprovalsHelp.aiContext,
  },
  history: {
    id: "history",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: AllocationHistoryWidget,
    title: "Allocation history",
    description: "Audit trail of completed reallocations with balance deltas.",
    helpComponent: FinanceAllocationHistoryHelp,
    helpTitle: "Allocation history",
    aiContext: FinanceAllocationHistoryHelp.aiContext,
  },
  policy: {
    id: "policy",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: AllocationPolicyWidget,
    title: "Policy exceptions",
    description: "Identify admin cap, capital restriction, and SoD issues.",
    helpComponent: FinanceAllocationPolicyHelp,
    helpTitle: "Policy exceptions",
    aiContext: FinanceAllocationPolicyHelp.aiContext,
  },
  snapshots: {
    id: "snapshots",
    defaultRowSpan: 1,
    defaultColumnSpan: 4,
    component: AllocationSnapshotsWidget,
    title: "Allocation snapshots",
    description: "Point-in-time references for board, audit, and ESDC queries.",
    helpComponent: FinanceAllocationSnapshotsHelp,
    helpTitle: "Allocation snapshots",
    aiContext: FinanceAllocationSnapshotsHelp.aiContext,
  },
};

const defaultLayout = [
  { id: "wizard", rowSpan: 6, columnSpan: 2 },
  { id: "approvals", rowSpan: 6, columnSpan: 2 },
  { id: "history", rowSpan: 4, columnSpan: 2 },
  { id: "policy", rowSpan: 4, columnSpan: 2 },
  { id: "snapshots", rowSpan: 3, columnSpan: 4 },
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
    console.error("[FinanceAllocations] failed to parse stored layout", error);
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
  navigationAriaLabel: "Allocations dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets on the Allocations dashboard.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const FinanceAllocationsPage = ({
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
  toggleHelpPanel,
}) => {
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? defaultLayout);
  const [prefillRequest, setPrefillRequest] = useState(null);

  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems));

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "Financial Management", href: "/finance/overview" },
        { text: "Allocations & Transfers", href: "/finance/allocations" },
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
          console.error("[FinanceAllocations] failed updating palette items", error);
        }
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
    } catch (error) {
      console.error("[FinanceAllocations] failed to persist layout", error);
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

  useEffect(() => {
    const handleNavigate = event => {
      const { target, potId } = event?.detail || {};
      if (target === "allocations") {
        setPrefillRequest({ potId, receivedAt: new Date().toISOString() });
        if (typeof setSplitPanelOpen === "function") {
          setSplitPanelOpen(false);
        }
      }
    };
    window.addEventListener("financeBudgets:navigate", handleNavigate);
    return () => window.removeEventListener("financeBudgets:navigate", handleNavigate);
  }, [setSplitPanelOpen]);

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
    const extraProps =
      item.id === "wizard"
        ? {
            prefillRequest,
            onPrefillConsumed: () => setPrefillRequest(null),
          }
        : {};
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
      } catch (error) {
        console.error("[FinanceAllocations] failed resetting palette", error);
      }
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("[FinanceAllocations] failed clearing persisted layout", error);
    }
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(paletteItems);
      } catch (error) {
        console.error("[FinanceAllocations] failed opening palette", error);
      }
    }
    if (typeof setSplitPanelOpen === "function") {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    window.addEventListener("financeAllocations:openPalette", handleOpen);
    window.addEventListener("financeAllocations:resetLayout", handleReset);
    return () => {
      window.removeEventListener("financeAllocations:openPalette", handleOpen);
      window.removeEventListener("financeAllocations:resetLayout", handleReset);
    };
  }, [openPalette, resetLayout]);

  return (
    <SpaceBetween size="l">
      <Board
        i18nStrings={boardI18nStrings}
        items={boardItems}
        onItemsChange={handleItemsChange}
        renderItem={renderBoardItem}
        empty={
          <Box padding="m">
            No widgets on the Allocations dashboard. Use the palette to add widgets back.
            <Box margin={{ top: "s" }}>
              <Button
                variant="link"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("financeAllocations:resetLayout"))
                }
              >
                Restore defaults
              </Button>
            </Box>
          </Box>
        }
      />
      <Box variant="awsui-key-label">
        Need a refresher on Allocations &amp; Transfers?{" "}
        <Link
          href="#"
          onFollow={event => {
            event.preventDefault();
            if (typeof toggleHelpPanel === "function") {
              const helpContent = React.createElement(FinanceAllocationsHelp);
              toggleHelpPanel(
                helpContent,
                "Allocations & Transfers",
                FinanceAllocationsHelp.aiContext
              );
            }
          }}
        >
          Open help
        </Link>
      </Box>
    </SpaceBetween>
  );
};

export default FinanceAllocationsPage;
