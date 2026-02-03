import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { Box, SpaceBetween } from "@cloudscape-design/components";
import { apiFetch } from "../../auth/apiClient";
import QueryEditorInputWidget from "./widgets/QueryEditorInputWidget.jsx";
import QueryEditorResultsWidget from "./widgets/QueryEditorResultsWidget.jsx";
import QueryEditorEnvironmentWidget from "./widgets/QueryEditorEnvironmentWidget.jsx";
import QueryEditorInputHelp from "../../helpPanelContents/queryEditorInputHelp";
import QueryEditorResultsHelp from "../../helpPanelContents/queryEditorResultsHelp";
import QueryEditorEnvironmentHelp from "../../helpPanelContents/queryEditorEnvironmentHelp";

const STORAGE_KEY = "configuration-query-editor-layout-v2";

const widgetRegistry = {
  "query-editor": {
    id: "query-editor",
    defaultRowSpan: 6,
    defaultColumnSpan: 4,
    component: QueryEditorInputWidget,
    title: "SQL query editor",
    description: "Run a single SQL statement against the active environment database.",
    helpComponent: QueryEditorInputHelp,
    helpTitle: "Query editor",
    aiContext: QueryEditorInputHelp.aiContext,
  },
  "query-results": {
    id: "query-results",
    defaultRowSpan: 6,
    defaultColumnSpan: 4,
    component: QueryEditorResultsWidget,
    title: "Query results",
    description: "Results or row-affected status for the last statement.",
    helpComponent: QueryEditorResultsHelp,
    helpTitle: "Query results",
    aiContext: QueryEditorResultsHelp.aiContext,
  },
  "query-environment": {
    id: "query-environment",
    defaultRowSpan: 2,
    defaultColumnSpan: 2,
    component: QueryEditorEnvironmentWidget,
    title: "Environment",
    description: "Active runtime environment for this admin session.",
    helpComponent: QueryEditorEnvironmentHelp,
    helpTitle: "Environment",
    aiContext: QueryEditorEnvironmentHelp.aiContext,
  },
};

const defaultLayout = [
  { id: "query-editor", rowSpan: 6, columnSpan: 4 },
  { id: "query-results", rowSpan: 6, columnSpan: 4 },
  { id: "query-environment", rowSpan: 2, columnSpan: 2 },
];

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
  } catch {
    // ignore storage errors
  }
  return null;
};

const persistLayout = layout => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore storage errors
  }
};

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
  liveAnnouncementItemRemoved: op => `Removed item ${op.item.data.title}.`,
  navigationAriaLabel: "Query Editor dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const QueryEditorDashboard = ({
  toggleHelpPanel,
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
}) => {
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? [...defaultLayout]);
  const [sql, setSql] = useState("");
  const [resultSet, setResultSet] = useState(null);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [envLabel, setEnvLabel] = useState("Unknown");
  const [envLoading, setEnvLoading] = useState(false);

  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems.map(item => item.id)));
  const layoutSignatureRef = useRef(JSON.stringify(exportLayout(boardItems)));

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "Configuration", href: "/configuration-settings" },
        { text: "Query Editor", href: "/configuration/query-editor" },
      ]);
    }
  }, [updateBreadcrumbs]);

  useEffect(() => {
    let isMounted = true;
    const loadRuntime = async () => {
      setEnvLoading(true);
      try {
        const response = await apiFetch("/api/config/runtime");
        const data = await response.json();
        const label = data?.env?.nodeEnv || "Unknown";
        if (isMounted) {
          setEnvLabel(label);
        }
      } catch {
        if (isMounted) {
          setEnvLabel("Unknown");
        }
      } finally {
        if (isMounted) {
          setEnvLoading(false);
        }
      }
    };
    loadRuntime();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const paletteSignature = JSON.stringify(paletteItems.map(item => item.id));
    if (paletteSignatureRef.current !== paletteSignature) {
      paletteSignatureRef.current = paletteSignature;
      if (typeof setAvailableItems === "function") {
        try {
          setAvailableItems(paletteItems);
        } catch {
          // ignore palette errors
        }
      }
    }

    const nextLayout = exportLayout(boardItems);
    const layoutSignature = JSON.stringify(nextLayout);
    if (layoutSignatureRef.current !== layoutSignature) {
      layoutSignatureRef.current = layoutSignature;
      persistLayout(nextLayout);
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

  const handleItemsChange = useCallback(({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const next = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, next) ? current : next));
  }, []);

  const runQuery = useCallback(async () => {
    const trimmed = typeof sql === "string" ? sql.trim() : "";
    if (!trimmed) return;
    setIsRunning(true);
    setError(null);
    setResultSet(null);
    try {
      const response = await apiFetch("/api/admin/query-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: trimmed }),
      });
      const text = await response.text();
      let payload = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { error: "invalid_response", message: text };
        }
      }
      if (!response.ok) {
        const message = payload?.message || payload?.error || `Request failed (${response.status})`;
        const details = payload && typeof payload === "object" ? payload : { message };
        setError({ ...details, message });
        return;
      }
      if (payload && Array.isArray(payload.results)) {
        setResultSet(payload);
      } else if (payload) {
        setResultSet({ results: [payload], statements: [trimmed], statementCount: 1 });
      }
    } catch (err) {
      setError({ message: err?.message || "Query failed" });
    } finally {
      setIsRunning(false);
    }
  }, [sql]);

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
          sql={sql}
          setSql={setSql}
          resultSet={resultSet}
          error={error}
          isRunning={isRunning}
          onRun={runQuery}
          envLabel={envLabel}
          envLoading={envLoading}
        />
      );
    },
    [toggleHelpPanel, sql, resultSet, error, isRunning, runQuery, envLabel, envLoading],
  );

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

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : [...defaultLayout]));
    const defaultPalette = computePaletteItems(toBoardItems(defaultLayout));
    paletteSignatureRef.current = JSON.stringify(defaultPalette.map(item => item.id));
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(defaultPalette);
      } catch {
        // ignore palette errors
      }
    }
    layoutSignatureRef.current = JSON.stringify(defaultLayout);
    persistLayout(defaultLayout);
  }, [setAvailableItems]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    window.addEventListener("queryEditor:openPalette", handleOpen);
    window.addEventListener("queryEditor:resetLayout", handleReset);
    return () => {
      window.removeEventListener("queryEditor:openPalette", handleOpen);
      window.removeEventListener("queryEditor:resetLayout", handleReset);
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
          <Box padding="m" textAlign="center" color="text-status-inactive">
            No widgets are available yet. Add widgets once the Query Editor configuration is finalized.
          </Box>
        }
      />
    </SpaceBetween>
  );
};

export default QueryEditorDashboard;
