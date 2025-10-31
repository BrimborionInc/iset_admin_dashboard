import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "@cloudscape-design/board-components/board";
import { Box, ButtonDropdown, Header, Link, SpaceBetween } from "@cloudscape-design/components";
import { BoardItem } from "@cloudscape-design/board-components";
import CaseWorkspaceCaseHeaderHelp from "../../helpPanelContents/caseWorkspaceCaseHeaderHelp.js";
import CaseWorkspaceActionPlansHelp from "../../helpPanelContents/caseWorkspaceActionPlansHelp.js";
import CaseWorkspaceInterventionsHelp from "../../helpPanelContents/caseWorkspaceInterventionsHelp.js";
import SupportingDocumentsHelp from "../../helpPanelContents/supportingDocumentsHelp.js";
import { boardItemI18nStrings } from "./widgets/common";

const STORAGE_KEY = "iset-case-management-new-layout-v4";

const CaseHeaderBoardWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(
          React.createElement(metadata.helpComponent),
          metadata.helpTitle ?? "Case header",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={
        <Header variant="h2" info={infoLink} description={metadata.description}>
          {metadata.title ?? "Case header"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Case header settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Box variant="p">
        Placeholder case summary widget. Replace with real case header content.
      </Box>
    </BoardItem>
  );
};

const ActionPlansBoardWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(
          React.createElement(metadata.helpComponent),
          metadata.helpTitle ?? "Action plans",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={
        <Header variant="h2" info={infoLink} description={metadata.description}>
          {metadata.title ?? "Action plans"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Action plans settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        <Box variant="p">Placeholder action plans widget.</Box>
        <Box variant="p">Use the palette to experiment with layout.</Box>
      </SpaceBetween>
    </BoardItem>
  );
};

const SupportingDocumentsBoardWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(
          React.createElement(metadata.helpComponent),
          metadata.helpTitle ?? "Supporting documents",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={
        <Header variant="h2" info={infoLink} description={metadata.description}>
          {metadata.title ?? "Supporting documents"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Supporting documents settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        <Box variant="p">
          Placeholder supporting documents widget summarising applicant files. Integrate with the real
          component when ready.
        </Box>
        <Box variant="p">
          Remove this widget to test palette behaviour; it will appear in Available Widgets for re-add.
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

const InterventionsBoardWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(
          React.createElement(metadata.helpComponent),
          metadata.helpTitle ?? "Interventions",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={
        <Header variant="h2" info={infoLink} description={metadata.description}>
          {metadata.title ?? "Interventions"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Interventions settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        <Box variant="p">Placeholder interventions widget.</Box>
        <Box variant="p">Swap in the real interventions component when available.</Box>
      </SpaceBetween>
    </BoardItem>
  );
};

const widgetRegistry = {
  caseHeader: {
    id: "caseHeader",
    defaultRowSpan: 3,
    defaultColumnSpan: 4,
    component: CaseHeaderBoardWidget,
    title: "Case header",
    description: "Participant case summary information and quick actions.",
    helpComponent: CaseWorkspaceCaseHeaderHelp,
    helpTitle: "Case header",
    aiContext: CaseWorkspaceCaseHeaderHelp.aiContext,
  },
  actionPlans: {
    id: "actionPlans",
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
    component: ActionPlansBoardWidget,
    title: "Action plans",
    description: "Manage action plans and select one to edit interventions.",
    helpComponent: CaseWorkspaceActionPlansHelp,
    helpTitle: "Action plans",
    aiContext: CaseWorkspaceActionPlansHelp.aiContext,
  },
  "supporting-documents": {
    id: "supporting-documents",
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
    component: SupportingDocumentsBoardWidget,
    title: "Supporting documents",
    description: "Unified view of uploaded files and secure message attachments.",
    helpComponent: SupportingDocumentsHelp,
    helpTitle: "Supporting documents",
    aiContext: SupportingDocumentsHelp.aiContext,
  },
  interventions: {
    id: "interventions",
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
    component: InterventionsBoardWidget,
    title: "Interventions",
    description: "Edit ILMP-compliant intervention records.",
    helpComponent: CaseWorkspaceInterventionsHelp,
    helpTitle: "Interventions",
    aiContext: CaseWorkspaceInterventionsHelp.aiContext,
  },
};

const defaultLayout = [
  { id: "caseHeader", rowSpan: 2, columnSpan: 4 },
  { id: "actionPlans", rowSpan: 4, columnSpan: 4 },
  { id: "supporting-documents", rowSpan: 4, columnSpan: 4 },
  { id: "interventions", rowSpan: 4, columnSpan: 4 },
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
          helpComponent: definition.helpComponent,
          helpTitle: definition.helpTitle,
          aiContext: definition.aiContext,
        },
        component: definition.component,
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
  navigationAriaLabel: "Case Management (new) dashboard navigation",
  navigationAriaDescription: "Use arrow keys to move between widgets.",
  navigationItemAriaLabel: item => (item ? item.data.title : "Empty"),
};

const CaseWorkspaceNewPage = ({
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
        { text: "Case portfolio", href: "/iset/cases" },
        { text: "Case Management (new)", href: "/iset/cases/new" },
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
      // ignore
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
    setLayout([...defaultLayout]);
    paletteSignatureRef.current = JSON.stringify([]);
    if (typeof setAvailableItems === "function") {
      try {
        setAvailableItems(computePaletteItems(toBoardItems(defaultLayout)));
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
    window.addEventListener("iset-case-workspace-new:openPalette", openHandler);
    window.addEventListener("iset-case-workspace-new:resetLayout", resetHandler);
    return () => {
      window.removeEventListener("iset-case-workspace-new:openPalette", openHandler);
      window.removeEventListener("iset-case-workspace-new:resetLayout", resetHandler);
    };
  }, [openPalette, resetLayout]);

  return (
    <SpaceBetween size="l">
      <Board
        items={boardItems}
        onItemsChange={handleItemsChange}
        renderItem={renderBoardItem}
        empty={<Box padding="m">No widgets configured yet.</Box>}
        i18nStrings={boardI18nStrings}
      />
    </SpaceBetween>
  );
};

export default CaseWorkspaceNewPage;





