import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { Box, Button, SpaceBetween } from "@cloudscape-design/components";
import { apiFetch } from "../../auth/apiClient";
import ClientFileImportWidget from "./widgets/ClientFileImportWidget.jsx";
import ClientFileImportWidgetHelp from "../../helpPanelContents/clientFileImportWidgetHelp.js";

const STORAGE_KEY = "iset-client-file-import-dashboard-layout-v1";

const widgetRegistry = {
  "client-file-import": {
    id: "client-file-import",
    defaultRowSpan: 10,
    defaultColumnSpan: 4,
    component: ClientFileImportWidget,
    title: "Client batch import",
    description: "Upload a spreadsheet, review duplicate and match logic, and commit client batch imports.",
    helpComponent: ClientFileImportWidgetHelp,
    helpTitle: "Client batch import",
    aiContext: ClientFileImportWidgetHelp.aiContext,
  },
};

const defaultLayout = [{ id: "client-file-import", rowSpan: 10, columnSpan: 4 }];

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
          helpComponent: definition.helpComponent,
          helpTitle: definition.helpTitle,
          aiContext: definition.aiContext,
        },
      };
    })
    .filter(Boolean);

const computePaletteItems = items =>
  Object.values(widgetRegistry)
    .filter(def => !items.some(item => item.id === def.id))
    .map(def => ({
      id: def.id,
      data: {
        title: def.title,
        description: def.description,
      },
    }));

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

const areLayoutsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
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
    return `Item resized to ${base}.`;
  },
  liveAnnouncementDndItemInserted: operation => {
    const column = `column ${operation.placement.x + 1}`;
    const row = `row ${operation.placement.y + 1}`;
    return `Item inserted to ${column}, ${row}.`;
  },
  liveAnnouncementDndCommitted: operation => `${operation} committed`,
  liveAnnouncementDndDiscarded: operation => `${operation} discarded`,
  liveAnnouncementItemRemoved: op => `Removed item ${op.item.data.title}.`,
  navigationAriaLabel: "Client batch import dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const parseErrorResponse = async response => {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const detailText = [
    payload?.message,
    Array.isArray(payload?.missingHeaders) ? `Missing headers: ${payload.missingHeaders.join(", ")}` : null,
    Array.isArray(payload?.duplicateHeaders) ? `Duplicate headers: ${payload.duplicateHeaders.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return detailText || payload?.error || `Request failed (${response.status})`;
};

const ClientFileImportDashboard = ({
  toggleHelpPanel,
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
}) => {
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? [...defaultLayout]);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [commitError, setCommitError] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems.map(item => item.id)));

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "Configuration", href: "/configuration-settings" },
        { text: "Client Batch Import", href: "/iset/imports/client-files" },
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
          // ignore palette errors
        }
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
    } catch {
      // ignore storage errors
    }
  }, [boardItems, paletteItems, setAvailableItems]);

  const handleItemsChange = useCallback(({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const next = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, next) ? current : next));
  }, []);

  const handlePreviewFile = useCallback(async (file, options = {}) => {
    setPreviewError(null);
    setCommitError(null);
    setCommitResult(null);
    setIsPreviewing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (Number.isInteger(options?.firstDataRowNumber) && options.firstDataRowNumber > 0) {
        formData.append("firstDataRowNumber", String(options.firstDataRowNumber));
      }
      const response = await apiFetch("/api/imports/client-files/dry-run", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      const payload = await response.json();
      setPreview(payload);
      return payload;
    } catch (error) {
      const message = error?.message || "Failed to preview the import.";
      setPreviewError(message);
      throw error;
    } finally {
      setIsPreviewing(false);
    }
  }, []);

  const handleCommit = useCallback(async () => {
    if (!preview?.rows?.length) {
      const error = new Error("Run a dry run before committing the import.");
      setCommitError(error.message);
      throw error;
    }

    setCommitError(null);
    setIsCommitting(true);
    try {
      const response = await apiFetch("/api/imports/client-files/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: preview.fileName || null,
          worksheetName: preview.worksheetName || null,
          rows: preview.rows.map(row => ({
            rowNumber: row.rowNumber,
            ...row.normalized,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      const payload = await response.json();
      setCommitResult(payload);
      return payload;
    } catch (error) {
      const message = error?.message || "Failed to commit the import.";
      setCommitError(message);
      throw error;
    } finally {
      setIsCommitting(false);
    }
  }, [preview]);

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
          preview={preview}
          previewError={previewError}
          commitError={commitError}
          commitResult={commitResult}
          isPreviewing={isPreviewing}
          isCommitting={isCommitting}
          onPreviewFile={handlePreviewFile}
          onCommit={handleCommit}
        />
      );
    },
    [commitError, commitResult, handleCommit, handlePreviewFile, isCommitting, isPreviewing, preview, previewError, toggleHelpPanel]
  );

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : [...defaultLayout]));
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems([]);
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
    window.addEventListener("clientFileImport:openPalette", openHandler);
    window.addEventListener("clientFileImport:resetLayout", resetHandler);
    return () => {
      window.removeEventListener("clientFileImport:openPalette", openHandler);
      window.removeEventListener("clientFileImport:resetLayout", resetHandler);
    };
  }, [openPalette, resetLayout]);

  return (
    <SpaceBetween size="m">
      <Box color="text-body-secondary">
        Upload a backload spreadsheet, review the dry-run match plan, and commit only when every row is ready.
      </Box>
      <Board
        renderItem={renderBoardItem}
        items={boardItems}
        onItemsChange={handleItemsChange}
        i18nStrings={boardI18nStrings}
        empty={
          <Box textAlign="center" color="text-body-secondary">
            Use Add widget to restore the client batch import board item.
          </Box>
        }
      />
    </SpaceBetween>
  );
};

ClientFileImportDashboard.headerActions = (
  <SpaceBetween size="xs" direction="horizontal">
    <Button iconName="add-plus" onClick={() => window.dispatchEvent(new CustomEvent("clientFileImport:openPalette"))}>
      Add widget
    </Button>
    <Button iconName="refresh" onClick={() => window.dispatchEvent(new CustomEvent("clientFileImport:resetLayout"))}>
      Reset layout
    </Button>
  </SpaceBetween>
);

export default ClientFileImportDashboard;
