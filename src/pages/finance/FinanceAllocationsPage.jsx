import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import {
  SpaceBetween,
  Box,
  Button,
  Link,
  Modal,
  ColumnLayout,
  StatusIndicator,
  Textarea,
  Table,
} from "@cloudscape-design/components";
import { apiFetch } from "../../auth/apiClient";

import AllocationTransferWizardWidget from "./widgets/AllocationTransferWizardWidget.jsx";
import AllocationApprovalsWidget from "./widgets/AllocationApprovalsWidget.jsx";
import AllocationHistoryWidget from "./widgets/AllocationHistoryWidget.jsx";
import AllocationPolicyWidget from "./widgets/AllocationPolicyWidget.jsx";
import AllocationSnapshotsWidget from "./widgets/AllocationSnapshotsWidget.jsx";
import { AllocationsDataProvider, useAllocationsData } from "./widgets/AllocationsDataContext.jsx";

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

const FinanceAllocationsPageContent = ({
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
  toggleHelpPanel,
}) => {
  const {
    potOptions,
    potMetrics,
    approvals,
    history,
    snapshots,
    createAllocation,
    approveAllocation,
    rejectAllocation,
    applyAllocation,
    scheduleAllocation,
  } = useAllocationsData();
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? defaultLayout);
  const [prefillRequest, setPrefillRequest] = useState(null);
  const [transferModalId, setTransferModalId] = useState(null);
  const [actionComment, setActionComment] = useState("");
  const [evidenceError, setEvidenceError] = useState(null);
  const allAllocations = useMemo(
    () => [...(approvals || []), ...(history || [])],
    [approvals, history]
  );
  const openTransfer = useMemo(
    () => allAllocations.find(item => String(item.id) === String(transferModalId)) || null,
    [allAllocations, transferModalId]
  );

  const openEvidenceAttachment = async att => {
    if (!att) return;
    const directUrl = att.url && /^https?:\/\//i.test(att.url) ? att.url : null;
    if (directUrl) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!att.key && !att.url) {
      setEvidenceError("Attachment link is unavailable.");
      return;
    }
    setEvidenceError(null);
    try {
      const res = await apiFetch("/api/allocations/evidence/presign-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: att.key || att.url }),
      });
      if (!res || !res.ok) {
        throw new Error("Unable to prepare download.");
      }
      const payload = await res.json().catch(() => null);
      const target = payload?.url;
      if (!target) {
        throw new Error("Download link unavailable.");
      }
      const finalUrl = /^https?:\/\//i.test(target)
        ? target
        : `${process.env.REACT_APP_API_BASE_URL || ""}${target}`;
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setEvidenceError(err?.message || "Failed to open attachment.");
    }
  };

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

  useEffect(() => {
    const handleOpenTransfer = event => {
      const transferId = event?.detail?.transferId;
      if (transferId) {
        setTransferModalId(String(transferId));
      }
    };
    window.addEventListener("financeAllocations:openTransfer", handleOpenTransfer);
    return () => window.removeEventListener("financeAllocations:openTransfer", handleOpenTransfer);
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
    if (item.id === "wizard") {
      extraProps.prefillRequest = prefillRequest;
      extraProps.onPrefillConsumed = () => setPrefillRequest(null);
      extraProps.potOptions = potOptions;
      extraProps.potMetrics = potMetrics;
      extraProps.createAllocation = createAllocation;
    }
    if (item.id === "approvals") {
      extraProps.items = approvals;
      extraProps.onApprove = approveAllocation;
      extraProps.onReject = rejectAllocation;
      extraProps.onApply = applyAllocation;
    }
    if (item.id === "history") {
      extraProps.items = history;
      extraProps.pendingItems = approvals;
      extraProps.onApply = applyAllocation;
    }
    if (item.id === "policy") {
      extraProps.items = [];
    }
    if (item.id === "snapshots") {
      extraProps.items = snapshots;
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
    const handleOpenTransfer = event => {
      const transferId = event?.detail?.transferId;
      if (transferId) {
        setTransferModalId(String(transferId));
      }
    };
    window.addEventListener("financeAllocations:openPalette", handleOpen);
    window.addEventListener("financeAllocations:resetLayout", handleReset);
    window.addEventListener("financeAllocations:openTransfer", handleOpenTransfer);
    return () => {
      window.removeEventListener("financeAllocations:openPalette", handleOpen);
      window.removeEventListener("financeAllocations:resetLayout", handleReset);
      window.removeEventListener("financeAllocations:openTransfer", handleOpenTransfer);
    };
  }, [openPalette, resetLayout]);

  const handleCloseModal = () => {
    setTransferModalId(null);
    setActionComment("");
  };

  const formatDisplayDate = value => {
    if (!value) return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-CA");
  };

  return (
    <>
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
      <Modal
        visible={!!openTransfer}
        onDismiss={handleCloseModal}
        closeAriaLabel="Close transfer workflow"
        header={openTransfer ? `Transfer ${openTransfer.id}` : "Transfer"}
      >
        {openTransfer ? (
          <SpaceBetween size="m">
            {(() => {
              const rawEffective =
                openTransfer.metadata?.effectiveDate ||
                openTransfer.effectiveDate ||
                openTransfer.metadata?.effective_date;
              const effectiveDateObj = rawEffective ? new Date(rawEffective) : null;
              const effectiveIsFuture =
                effectiveDateObj && effectiveDateObj.getTime() > Date.now();
              return (
                <ColumnLayout columns={2} variant="text-grid">
                  <SpaceBetween size="xxs">
                    <Box variant="awsui-key-label">Submitted</Box>
                    <Box variant="p">
                      {openTransfer.submittedOn ?? "N/A"} by{" "}
                      {openTransfer.requestedBy ?? "Unassigned"}
                    </Box>
                  </SpaceBetween>
                  <SpaceBetween size="xxs">
                    <Box variant="awsui-key-label">Status</Box>
                    <StatusIndicator
                      type={
                        openTransfer.status === "approved"
                          ? "success"
                          : openTransfer.status === "rejected"
                          ? "error"
                          : openTransfer.status === "applied"
                          ? "success"
                          : "info"
                      }
                    >
                      {openTransfer.status || "proposed"}
                    </StatusIndicator>
                  </SpaceBetween>
                  <SpaceBetween size="xxs">
                    <Box variant="awsui-key-label">Source → Destination</Box>
                    <Box variant="p">
                      {openTransfer.potFrom ?? "Unknown"} → {openTransfer.potTo ?? "Unknown"}
                    </Box>
                  </SpaceBetween>
                  <SpaceBetween size="xxs">
                    <Box variant="awsui-key-label">Amount</Box>
                    <Box variant="p">
                      {Number.isFinite(Number(openTransfer.amount))
                        ? `$${Number(openTransfer.amount).toLocaleString("en-CA")}`
                        : "-"}
                    </Box>
                  </SpaceBetween>
                  <SpaceBetween size="xxs">
                    <Box variant="awsui-key-label">Effective date</Box>
                    <Box variant="p">
                      {formatDisplayDate(rawEffective)}
                      {effectiveIsFuture ? " (scheduled)" : ""}
                    </Box>
                  </SpaceBetween>
                </ColumnLayout>
              );
            })()}
            <ColumnLayout columns={2} variant="text-grid">
            </ColumnLayout>
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Justification</Box>
              <Box variant="p">{openTransfer.justification || "No justification provided."}</Box>
            </SpaceBetween>
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Evidence references</Box>
              <Table
                variant="embedded"
                compact
                wrapLines
                items={
                  Array.isArray(openTransfer.metadata?.evidence)
                    ? openTransfer.metadata.evidence.map((entry, idx) => {
                        const isObject = entry && typeof entry === "object";
                        return {
                          id: `ev-${idx}`,
                          label: isObject ? entry.label : entry,
                          type: isObject ? entry.type : null,
                          attachments:
                            isObject && Array.isArray(entry.attachments) ? entry.attachments : [],
                        };
                      })
                    : []
                }
                columnDefinitions={[
                  { id: "label", header: "Label", cell: item => item.label || "Evidence" },
                  { id: "type", header: "Type", cell: item => item.type || "Not set" },
                  {
                    id: "attachments",
                    header: "Attachments",
                    cell: item =>
                      item.attachments && item.attachments.length ? (
                        <SpaceBetween size="xxs">
                          {item.attachments.map((att, attIdx) => (
                            <Link
                              key={`${item.id}-att-${attIdx}`}
                              href={att.url || "#"}
                              onFollow={event => {
                                event.preventDefault();
                                openEvidenceAttachment(att);
                              }}
                              target="_blank"
                            >
                              {att.name || att.key || "Attachment"}
                            </Link>
                          ))}
                        </SpaceBetween>
                      ) : (
                        <Box variant="p">-</Box>
                      ),
                  },
                ]}
                trackBy="id"
                empty={<Box variant="p">No evidence references provided.</Box>}
              />
              {evidenceError ? (
                <Box variant="p" color="text-status-error">
                  {evidenceError}
                </Box>
              ) : null}
            </SpaceBetween>
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Reviewer comment</Box>
              <Textarea
                value={actionComment}
                onChange={({ detail }) => setActionComment(detail.value)}
                placeholder="Add an approval or rejection note (optional)."
                rows={3}
              />
            </SpaceBetween>
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                disabled={!openTransfer?.id || openTransfer.status !== "proposed"}
                onClick={async () => {
                  try {
                    await approveAllocation(openTransfer.id);
                    setActionComment("");
                    handleCloseModal();
                  } catch (err) {
                    console.error("[Allocations] approve failed", err);
                  }
                }}
              >
                Approve
              </Button>
              <Button
                disabled={!openTransfer?.id || openTransfer.status !== "proposed"}
                onClick={async () => {
                  try {
                    await rejectAllocation(openTransfer.id, actionComment);
                    setActionComment("");
                    handleCloseModal();
                  } catch (err) {
                    console.error("[Allocations] reject failed", err);
                  }
                }}
              >
                Reject
              </Button>
              <Button variant="link" onClick={handleCloseModal}>
                Close
              </Button>
            </SpaceBetween>
          </SpaceBetween>
        ) : (
          <Box>Loading transfer...</Box>
        )}
      </Modal>
    </>
  );
};

const FinanceAllocationsPage = props => (
  <AllocationsDataProvider>
    <FinanceAllocationsPageContent {...props} />
  </AllocationsDataProvider>
);

export default FinanceAllocationsPage;
