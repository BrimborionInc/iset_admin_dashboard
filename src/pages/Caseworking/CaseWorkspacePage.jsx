import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Board from "@cloudscape-design/board-components/board";
import { Box, SpaceBetween } from "@cloudscape-design/components";
import CaseHeaderWidget from "./caseWorkspace/widgets/CaseHeaderWidget.jsx";
import SupportingDocumentsWidget from "../../widgets/SupportingDocumentsWidget";
import SecureMessagingWidget from "../../widgets/SecureMessagingWidget";
import CaseNotesWidget from "../../widgets/CaseNotesWidget";
import CaseCalendarWidget from "../../widgets/CaseCalendarWidget";
import ActionPlansWidget from "./caseWorkspace/widgets/ActionPlansWidget.jsx";
import InterventionsWidget from "./caseWorkspace/widgets/InterventionsWidget.jsx";
import FinancePanelWidget from "./caseWorkspace/widgets/FinancePanelWidget.jsx";
import CompliancePanelWidget from "./caseWorkspace/widgets/CompliancePanelWidget.jsx";
import ParticipantDetailsWidget from "./caseWorkspace/widgets/ParticipantDetailsWidget.jsx";
import ExportPreviewWidget from "./caseWorkspace/widgets/ExportPreviewWidget.jsx";
import InterventionAssessmentWidget from "./caseWorkspace/widgets/InterventionAssessmentWidget.jsx";
import CasePaymentRequestsWidget from "./caseWorkspace/widgets/CasePaymentRequestsWidget.jsx";
import CasePaymentDetailWidget from "./caseWorkspace/widgets/CasePaymentDetailWidget.jsx";
import CaseWorkspaceCaseHeaderHelp from "../../helpPanelContents/caseWorkspaceCaseHeaderHelp.js";
import SupportingDocumentsHelp from "../../helpPanelContents/supportingDocumentsHelp.js";
import SecureMessagesHelpPanelContent from "../../helpPanelContents/secureMessagesHelpPanelContent.js";
import CaseNotesHelp from "../../helpPanelContents/caseNotesHelp.js";
import CaseCalendarHelp from "../../helpPanelContents/caseCalendarHelp.js";
import CaseWorkspaceActionPlansHelp from "../../helpPanelContents/caseWorkspaceActionPlansHelp.js";
import CaseWorkspaceInterventionsHelp from "../../helpPanelContents/caseWorkspaceInterventionsHelp.js";
import CaseWorkspaceFinancePanelHelp from "../../helpPanelContents/caseWorkspaceFinancePanelHelp.js";
import CaseWorkspaceCompliancePanelHelp from "../../helpPanelContents/caseWorkspaceCompliancePanelHelp.js";
import CaseWorkspaceParticipantDetailsHelp from "../../helpPanelContents/caseWorkspaceParticipantDetailsHelp.js";
import CaseWorkspaceExportPreviewHelp from "../../helpPanelContents/caseWorkspaceExportPreviewHelp.js";
import CaseWorkspaceHelp from "../../helpPanelContents/caseWorkspaceHelp.js";
import { CaseWorkspaceProvider } from "./caseWorkspace/CaseWorkspaceContext.jsx";
import { PaymentsDataProvider } from "../finance/widgets/PaymentsDataContext.jsx";

const STORAGE_KEY = "iset-case-workspace-layout-v13";

const widgetRegistry = {
  "supporting-documents": {
    id: "supporting-documents",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: SupportingDocumentsWidget,
    title: "Supporting documents",
    description: "Unified view of uploaded files and secure message attachments.",
    helpComponent: SupportingDocumentsHelp,
    helpTitle: "Supporting documents",
    aiContext: SupportingDocumentsHelp.aiContext,
  },
  "case-notes": {
    id: "case-notes",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: CaseNotesWidget,
    title: "Notes and tasks",
    description: "Keep internal notes and follow-ups visible to the case team.",
    helpComponent: CaseNotesHelp,
    helpTitle: "Notes and tasks",
    aiContext: CaseNotesHelp.aiContext,
  },
  "case-calendar": {
    id: "case-calendar",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: CaseCalendarWidget,
    title: "Case calendar",
    description: "Timeline of reminders, deadlines, and milestones.",
    helpComponent: CaseCalendarHelp,
    helpTitle: "Case calendar",
    aiContext: CaseCalendarHelp.aiContext,
  },
  "secure-messaging": {
    id: "secure-messaging",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: SecureMessagingWidget,
    title: "Secure messaging",
    description: "Read and send case-linked messages, including attachments.",
    helpComponent: SecureMessagesHelpPanelContent,
    helpTitle: "Secure messaging",
    aiContext: SecureMessagesHelpPanelContent.aiContext,
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
  actionPlans: {
    id: "actionPlans",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: ActionPlansWidget,
    title: "Action plans",
    description: "Manage action plans and select one to edit interventions.",
    helpComponent: CaseWorkspaceActionPlansHelp,
    helpTitle: "Action plans",
    aiContext: CaseWorkspaceActionPlansHelp.aiContext,
  },
  interventions: {
    id: "interventions",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: InterventionsWidget,
    title: "Interventions",
    description: "Edit ILMP-compliant intervention records.",
    helpComponent: CaseWorkspaceInterventionsHelp,
    helpTitle: "Interventions",
    aiContext: CaseWorkspaceInterventionsHelp.aiContext,
  },
  interventionAssessment: {
    id: "interventionAssessment",
    defaultRowSpan: 6,
    defaultColumnSpan: 4,
    component: InterventionAssessmentWidget,
    title: "Intervention assessment",
    description: "Propose a new intervention for approval.",
    helpComponent: CaseWorkspaceInterventionsHelp,
    helpTitle: "Intervention assessment",
    aiContext: CaseWorkspaceInterventionsHelp.aiContext,
  },
  financePanel: {
    id: "financePanel",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: FinancePanelWidget,
    title: "Finance panel",
    description: null,
    helpComponent: CaseWorkspaceFinancePanelHelp,
    helpTitle: "Finance panel",
    aiContext: CaseWorkspaceFinancePanelHelp.aiContext,
  },
  compliancePanel: {
    id: "compliancePanel",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: CompliancePanelWidget,
    title: "Compliance",
    description: "ILMP and finance validation status.",
    helpComponent: CaseWorkspaceCompliancePanelHelp,
    helpTitle: "Compliance",
    aiContext: CaseWorkspaceCompliancePanelHelp.aiContext,
  },
  exportPreview: {
    id: "exportPreview",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: ExportPreviewWidget,
    title: "Export preview",
    description: "Review ILMP XML and finance postings before export.",
    helpComponent: CaseWorkspaceExportPreviewHelp,
    helpTitle: "Export preview",
    aiContext: CaseWorkspaceExportPreviewHelp.aiContext,
  },
  participantDetails: {
    id: "participantDetails",
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: ParticipantDetailsWidget,
    title: "Participant details",
    description:
      "Refer to the application form for the original submission. Case Managers must keep these details current based on participant updates. Handle this sensitive personal data carefully and avoid duplicating it elsewhere.",
    helpComponent: CaseWorkspaceParticipantDetailsHelp,
    helpTitle: "Participant details",
    aiContext: CaseWorkspaceParticipantDetailsHelp.aiContext,
  },
  "payments-queue": {
    id: "payments-queue",
    defaultRowSpan: 5,
    defaultColumnSpan: 4,
    component: CasePaymentRequestsWidget,
    title: "Payment packet queue",
    description: "Program payment packets tied to this case.",
  },
  "payments-detail": {
    id: "payments-detail",
    defaultRowSpan: 5,
    defaultColumnSpan: 2,
    component: CasePaymentDetailWidget,
    title: "Payment packet detail",
    description: "Evidence, approvals, and line items for the selected packet.",
  },
};

const defaultLayout = [
  { id: "caseHeader", rowSpan: 2, columnSpan: 4 },
  { id: "participantDetails", rowSpan: 8, columnSpan: 2 },
  { id: "actionPlans", rowSpan: 4, columnSpan: 2 },
  { id: "case-calendar", rowSpan: 5, columnSpan: 2 },
  { id: "interventions", rowSpan: 4, columnSpan: 2 },
  { id: "case-notes", rowSpan: 5, columnSpan: 2 },
  { id: "supporting-documents", rowSpan: 3, columnSpan: 2 },
  { id: "secure-messaging", rowSpan: 4, columnSpan: 2 },
];

const proposeInterventionLayout = [
  { id: "caseHeader", rowSpan: 3, columnSpan: 4 },
  { id: "participantDetails", rowSpan: 7, columnSpan: 2 },
  { id: "interventionAssessment", rowSpan: 7, columnSpan: 2 },
];

const managePlansLayout = [
  { id: "caseHeader", rowSpan: 3, columnSpan: 4 },
  { id: "actionPlans", rowSpan: 3, columnSpan: 4 },
  { id: "interventions", rowSpan: 3, columnSpan: 4 },
];

const notesCalendarLayout = [
  { id: "caseHeader", rowSpan: 3, columnSpan: 4 },
  { id: "case-notes", rowSpan: 6, columnSpan: 2 },
  { id: "case-calendar", rowSpan: 6, columnSpan: 2 },
];

const documentsMessagesLayout = [
  { id: "caseHeader", rowSpan: 3, columnSpan: 4 },
  { id: "supporting-documents", rowSpan: 6, columnSpan: 2 },
  { id: "secure-messaging", rowSpan: 6, columnSpan: 2 },
];

const managePaymentsLayout = [
  { id: "caseHeader", rowSpan: 3, columnSpan: 4 },
  { id: "payments-queue", rowSpan: 5, columnSpan: 4 },
  { id: "payments-detail", rowSpan: 5, columnSpan: 4 },
  { id: "interventions", rowSpan: 4, columnSpan: 4 },
  { id: "actionPlans", rowSpan: 4, columnSpan: 4 },
];

const esdcValidationLayout = [
  { id: "caseHeader", rowSpan: 3, columnSpan: 4 },
  { id: "compliancePanel", rowSpan: 6, columnSpan: 2 },
  { id: "exportPreview", rowSpan: 6, columnSpan: 2 },
];

const QUICK_ACTION_LAYOUTS = {
  managePlans: managePlansLayout,
  notesCalendar: notesCalendarLayout,
  documentsMessages: documentsMessagesLayout,
  managePayments: managePaymentsLayout,
  esdcValidation: esdcValidationLayout,
  proposeIntervention: proposeInterventionLayout,
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
  const paymentFilters = useMemo(() => (caseId ? { caseId } : {}), [caseId]);
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? [...defaultLayout]);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
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
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("iset-case-workspace:widget-removed", { detail: { id: item.id } })
            );
          }
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

  const addWidgetToLayout = useCallback((widgetId, overrides = {}) => {
    if (!widgetId || !widgetRegistry[widgetId]) return;
    setLayout(current => {
      const existing = current.find(item => item.id === widgetId);
      const nextItem = {
        id: widgetId,
        rowSpan: overrides.rowSpan ?? existing?.rowSpan,
        columnSpan: overrides.columnSpan ?? existing?.columnSpan,
        columnOffset: overrides.columnOffset ?? existing?.columnOffset,
      };
      if (existing) {
        const next = current.map(item => (item.id === widgetId ? nextItem : item));
        return areLayoutsEqual(current, next) ? current : next;
      }
      return [...current, nextItem];
    });
  }, []);

  const applyLayout = useCallback(nextLayout => {
    if (!Array.isArray(nextLayout) || nextLayout.length === 0) return;
    setLayout(current => (areLayoutsEqual(current, nextLayout) ? current : [...nextLayout]));
  }, [setLayout]);

  useEffect(() => {
    const openHandler = () => openPalette();
    const resetHandler = () => resetLayout();
    const proposeHandler = () => {
      applyLayout(proposeInterventionLayout);
    };
    const setLayoutHandler = event => {
      const detail = event?.detail || {};
      const nextLayout = Array.isArray(detail.layout) ? detail.layout : QUICK_ACTION_LAYOUTS[detail.layoutId];
      if (nextLayout) {
        applyLayout(nextLayout);
      }
    };
    const addWidgetHandler = event => {
      const detail = event?.detail || {};
      addWidgetToLayout(detail.id, detail);
    };
    window.addEventListener("iset-case-workspace:openPalette", openHandler);
    window.addEventListener("iset-case-workspace:resetLayout", resetHandler);
    window.addEventListener("iset:intervention-assessment:new", proposeHandler);
    window.addEventListener("iset-case-workspace:set-layout", setLayoutHandler);
    window.addEventListener("iset-case-workspace:add-widget", addWidgetHandler);
    return () => {
      window.removeEventListener("iset-case-workspace:openPalette", openHandler);
      window.removeEventListener("iset-case-workspace:resetLayout", resetHandler);
      window.removeEventListener("iset:intervention-assessment:new", proposeHandler);
      window.removeEventListener("iset-case-workspace:set-layout", setLayoutHandler);
      window.removeEventListener("iset-case-workspace:add-widget", addWidgetHandler);
    };
  }, [addWidgetToLayout, applyLayout, openPalette, resetLayout]);

  return (
    <CaseWorkspaceProvider caseId={caseId}>
      <PaymentsDataProvider filters={paymentFilters}>
        <SpaceBetween size="l">
          <Board
            items={boardItems}
            renderItem={renderBoardItem}
            onItemsChange={handleItemsChange}
            i18nStrings={boardI18nStrings}
            empty={<Box padding="m">No widgets configured.</Box>}
          />
        </SpaceBetween>
      </PaymentsDataProvider>
    </CaseWorkspaceProvider>
  );
};

CaseWorkspacePage.pageHelp = CaseWorkspaceHelp;
CaseWorkspacePage.pageHelp.aiContext = CaseWorkspaceHelp.aiContext;

export default CaseWorkspacePage;









