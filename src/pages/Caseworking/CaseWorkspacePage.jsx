import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Board from "@cloudscape-design/board-components/board";
import { Box, SpaceBetween } from "@cloudscape-design/components";
import CaseHeaderWidget from "./caseWorkspace/widgets/CaseHeaderWidget.jsx";
import SupportingDocumentsWidget from "../../widgets/SupportingDocumentsWidget";
import TasksNotesWidget from "./caseWorkspace/widgets/TasksNotesWidget.jsx";
import ActionPlansWidget from "./caseWorkspace/widgets/ActionPlansWidget.jsx";
import InterventionsWidget from "./caseWorkspace/widgets/InterventionsWidget.jsx";
import FinancePanelWidget from "./caseWorkspace/widgets/FinancePanelWidget.jsx";
import CompliancePanelWidget from "./caseWorkspace/widgets/CompliancePanelWidget.jsx";
import ExportPreviewWidget from "./caseWorkspace/widgets/ExportPreviewWidget.jsx";
import CaseWorkspaceCaseHeaderHelp from "../../helpPanelContents/caseWorkspaceCaseHeaderHelp.js";
import SupportingDocumentsHelp from "../../helpPanelContents/supportingDocumentsHelp.js";
import CaseWorkspaceTasksNotesHelp from "../../helpPanelContents/caseWorkspaceTasksNotesHelp.js";
import CaseWorkspaceActionPlansHelp from "../../helpPanelContents/caseWorkspaceActionPlansHelp.js";
import CaseWorkspaceInterventionsHelp from "../../helpPanelContents/caseWorkspaceInterventionsHelp.js";
import CaseWorkspaceFinancePanelHelp from "../../helpPanelContents/caseWorkspaceFinancePanelHelp.js";
import CaseWorkspaceCompliancePanelHelp from "../../helpPanelContents/caseWorkspaceCompliancePanelHelp.js";
import CaseWorkspaceExportPreviewHelp from "../../helpPanelContents/caseWorkspaceExportPreviewHelp.js";
import CaseWorkspaceHelp from "../../helpPanelContents/caseWorkspaceHelp.js";
import { CaseWorkspaceProvider } from "./caseWorkspace/CaseWorkspaceContext.jsx";

const STORAGE_KEY = "iset-case-workspace-layout-v8";

const widgetRegistry = {
  "supporting-documents": {
    id: "supporting-documents",
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
    component: SupportingDocumentsWidget,
    title: "Supporting documents",
    description: "Unified view of uploaded files and secure message attachments.",
    helpComponent: SupportingDocumentsHelp,
    helpTitle: "Supporting documents",
    aiContext: SupportingDocumentsHelp.aiContext,
  },
  caseHeader: {
    id: "caseHeader",
    defaultRowSpan: 2,
    defaultColumnSpan: 4,
    component: CaseHeaderWidget,
    title: "Case header",
    description: null,
    helpComponent: CaseWorkspaceCaseHeaderHelp,
    helpTitle: "Case header",
    aiContext: CaseWorkspaceCaseHeaderHelp.aiContext,
  },
  tasksNotes: {
    id: "tasksNotes",
    defaultRowSpan: 3,
    defaultColumnSpan: 4,
    component: TasksNotesWidget,
    title: "Tasks & notes",
    description: "Notes and follow-ups for the case.",
    helpComponent: CaseWorkspaceTasksNotesHelp,
    helpTitle: "Tasks & notes",
    aiContext: CaseWorkspaceTasksNotesHelp.aiContext,
  },
  actionPlans: {
    id: "actionPlans",
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
    component: ActionPlansWidget,
    title: "Action plans",
    description: "Manage action plans and select one to edit interventions.",
    helpComponent: CaseWorkspaceActionPlansHelp,
    helpTitle: "Action plans",
    aiContext: CaseWorkspaceActionPlansHelp.aiContext,
  },
  interventions: {
    id: "interventions",
    defaultRowSpan: 5,
    defaultColumnSpan: 4,
    component: InterventionsWidget,
    title: "Interventions",
    description: "Edit ILMP-compliant intervention records.",
    helpComponent: CaseWorkspaceInterventionsHelp,
    helpTitle: "Interventions",
    aiContext: CaseWorkspaceInterventionsHelp.aiContext,
  },
  financePanel: {
    id: "financePanel",
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
    component: FinancePanelWidget,
    title: "Finance panel",
    description: null,
    helpComponent: CaseWorkspaceFinancePanelHelp,
    helpTitle: "Finance panel",
    aiContext: CaseWorkspaceFinancePanelHelp.aiContext,
  },
  compliancePanel: {
    id: "compliancePanel",
    defaultRowSpan: 3,
    defaultColumnSpan: 4,
    component: CompliancePanelWidget,
    title: "Compliance",
    description: "ILMP and finance validation status.",
    helpComponent: CaseWorkspaceCompliancePanelHelp,
    helpTitle: "Compliance",
    aiContext: CaseWorkspaceCompliancePanelHelp.aiContext,
  },
  exportPreview: {
    id: "exportPreview",
    defaultRowSpan: 3,
    defaultColumnSpan: 4,
    component: ExportPreviewWidget,
    title: "Export preview",
    description: "Review ILMP XML and finance postings before export.",
    helpComponent: CaseWorkspaceExportPreviewHelp,
    helpTitle: "Export preview",
    aiContext: CaseWorkspaceExportPreviewHelp.aiContext,
  },
};

const defaultLayout = [
  { id: "caseHeader", rowSpan: 2, columnSpan: 4 },
  { id: "tasksNotes", rowSpan: 3, columnSpan: 4 },
  { id: "actionPlans", rowSpan: 4, columnSpan: 4 },
  { id: "interventions", rowSpan: 5, columnSpan: 4 },
  { id: "financePanel", rowSpan: 4, columnSpan: 4 },
  { id: "compliancePanel", rowSpan: 3, columnSpan: 4 },
  { id: "exportPreview", rowSpan: 3, columnSpan: 4 },
  { id: "supporting-documents", rowSpan: 4, columnSpan: 4 },
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

const PALETTE_EXCLUDE_IDS = new Set();

const computePaletteItems = items =>
  Object.values(widgetRegistry)
    .filter(def => !PALETTE_EXCLUDE_IDS.has(def.id))
    .filter(def => !items.some(item => item.id === def.id))
    .map(def => ({ id: def.id, data: { title: def.title, description: def.description } }));

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
  navigationAriaLabel: "Case workspace navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets in the case workspace.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const CaseWorkspacePage = ({
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen,
  toggleHelpPanel,
}) => {
  const { caseId } = useParams();
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? [...defaultLayout]);
  useEffect(() => {
    if (typeof window !== "undefined" && window.console) {
      window.console.info("[CaseWorkspace] layout ids", layout.map(item => item?.id));
    }
  }, [layout]);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  useEffect(() => {
    if (typeof window !== "undefined" && window.console) {
      window.console.info("[CaseWorkspace] board items", boardItems.map(item => item?.id));
    }
  }, [boardItems]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems.map(item => item.id)));

  useEffect(() => {
    if (typeof updateBreadcrumbs === "function") {
      updateBreadcrumbs([
        { text: "Home", href: "/" },
        { text: "Case portfolio", href: "/iset/cases" },
        { text: caseId ?? "Case", href: `/cases/${caseId}` },
      ]);
    }
  }, [updateBreadcrumbs, caseId]);

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
      // ignore storage issues in scaffold
    }
  }, [boardItems, paletteItems, setAvailableItems]);

  const handleItemsChange = useCallback(({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const next = exportLayout(detail.items);
    if (typeof window !== "undefined" && window.console) {
      window.console.info("[CaseWorkspace] onItemsChange", next);
    }
    setLayout(current => (areLayoutsEqual(current, next) ? current : next));
  }, []);

  const renderBoardItem = useCallback(
    (item, actions) => {
      if (!item?.id) return null;
      const definition = widgetRegistry[item.id];
      if (!definition) return null;
      const WidgetComponent = definition.component;
      const enhancedActions = {
        ...actions,
        removeItem: () => {
          if (actions && typeof actions.removeItem === "function") {
            actions.removeItem();
          } else {
            setLayout(current => current.filter(entry => entry.id !== item.id));
          }
        },
      };
      return (
        <WidgetComponent
          actions={enhancedActions}
          metadata={item.data}
          toggleHelpPanel={toggleHelpPanel}
        />
      );
    },
    [setLayout, toggleHelpPanel]
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
    window.addEventListener("iset-case-workspace:openPalette", openHandler);
    window.addEventListener("iset-case-workspace:resetLayout", resetHandler);
    return () => {
      window.removeEventListener("iset-case-workspace:openPalette", openHandler);
      window.removeEventListener("iset-case-workspace:resetLayout", resetHandler);
    };
  }, [openPalette, resetLayout]);

  return (
    <CaseWorkspaceProvider caseId={caseId}>
      <SpaceBetween size="l">
        <Board
          items={boardItems}
          renderItem={renderBoardItem}
          onItemsChange={handleItemsChange}
          i18nStrings={boardI18nStrings}
          empty={<Box padding="m">No widgets configured.</Box>}
        />
      </SpaceBetween>
    </CaseWorkspaceProvider>
  );
};

CaseWorkspacePage.pageHelp = CaseWorkspaceHelp;
CaseWorkspacePage.pageHelp.aiContext = CaseWorkspaceHelp.aiContext;

export default CaseWorkspacePage;









