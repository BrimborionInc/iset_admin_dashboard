import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import TemplateEditorProvider, {
  TemplateLibraryWidget,
  TemplateEditorWidget
} from '../widgets/manageTemplates';

const widgetRegistry = {
  'template-library': {
    id: 'template-library',
    defaultRowSpan: 7,
    defaultColumnSpan: 1,
    component: TemplateLibraryWidget,
    title: 'Template Library',
    description: 'Select templates to edit or remove them from the catalogue.'
  },
  'template-editor': {
    id: 'template-editor',
    defaultRowSpan: 7,
    defaultColumnSpan: 3,
    component: TemplateEditorWidget,
    title: 'Template Editor',
    description: 'Edit bilingual content, apply formatting, and preview the rendered output.'
  }
};

const STORAGE_KEY = 'template-editor-dashboard-layout.v2';

const defaultLayout = [
  { id: 'template-library', rowSpan: 7, columnSpan: 1 },
  { id: 'template-editor', rowSpan: 7, columnSpan: 3 }
];

const exportLayout = (items = []) =>
  items.map(({ id, rowSpan, columnSpan, columnOffset }) => ({
    id,
    rowSpan,
    columnSpan,
    columnOffset
  }));

const toBoardItems = (layout = []) =>
  layout.map((item) => {
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
        description: definition.description
      }
    };
  });

const loadLayoutFromStorage = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((entry) => entry && widgetRegistry[entry.id]);
      return filtered.length ? filtered : null;
    }
  } catch (err) {
    console.error('[TemplateEditorDashboard] Failed to parse stored layout', err);
  }
  return null;
};

const computePaletteItems = (layout = []) =>
  Object.values(widgetRegistry)
    .filter((definition) => !layout.some((entry) => entry.id === definition.id))
    .map((definition) => ({
      id: definition.id,
      data: { title: definition.title, description: definition.description }
    }));

const areLayoutsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right || left.id !== right.id ||
      (left.rowSpan ?? null) !== (right.rowSpan ?? null) ||
      (left.columnSpan ?? null) !== (right.columnSpan ?? null)) {
      return false;
    }
  }
  return true;
};

const boardI18nStrings = {
  liveAnnouncementDndStarted: (operationType) =>
    operationType === 'resize' ? 'Resizing' : 'Dragging',
  liveAnnouncementDndItemReordered: (operation) => {
    const columns = `column ${operation.placement.x + 1}`;
    const rows = `row ${operation.placement.y + 1}`;
    return `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`;
  },
  liveAnnouncementDndItemResized: (operation) => {
    const columnsConstraint = operation.isMinimalColumnsReached ? ' (minimal)' : '';
    const rowsConstraint = operation.isMinimalRowsReached ? ' (minimal)' : '';
    const sizeAnnouncement = operation.direction === 'horizontal'
      ? `columns ${operation.placement.width}${columnsConstraint}`
      : `rows ${operation.placement.height}${rowsConstraint}`;
    return `Item resized to ${sizeAnnouncement}.`;
  },
  liveAnnouncementDndItemInserted: (operation) => {
    const columns = `column ${operation.placement.x + 1}`;
    const rows = `row ${operation.placement.y + 1}`;
    return `Item inserted to ${columns}, ${rows}.`;
  },
  liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
  liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
  liveAnnouncementItemRemoved: (op) => `Removed item ${op.item.data.title}.`,
  navigationAriaLabel: 'Template editor dashboard navigation',
  navigationAriaDescription: 'Use arrow keys to move between widgets.',
  navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty')
};

const TemplateEditorDashboard = ({
  toggleHelpPanel,
  setSplitPanelOpen,
  setAvailableItems
}) => {
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? defaultLayout);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(layout), [layout]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch (err) {
      console.error('[TemplateEditorDashboard] Failed to persist layout', err);
    }
  }, [layout]);

  useEffect(() => {
    const signature = JSON.stringify(paletteItems);
    if (paletteSignatureRef.current !== signature) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === 'function') {
        try {
          setAvailableItems(paletteItems);
        } catch {}
      }
    }
  }, [paletteItems, setAvailableItems]);

  useEffect(() => {
    const handleAdd = (event) => {
      const id = event?.detail?.id;
      if (!id || !widgetRegistry[id]) return;
      setLayout((current) => {
        if (current.some((item) => item.id === id)) {
          return current;
        }
        return [...current, { id }];
      });
    };
    window.addEventListener('palette:add', handleAdd);
    return () => window.removeEventListener('palette:add', handleAdd);
  }, []);

  const handleItemsChange = ({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const nextLayout = exportLayout(detail.items);
    setLayout((current) => (areLayoutsEqual(current, nextLayout) ? current : nextLayout));
  };

  const resetLayout = useCallback(() => {
    setLayout((current) => (areLayoutsEqual(current, defaultLayout) ? current : defaultLayout));
    const defaultPalette = computePaletteItems(defaultLayout);
    paletteSignatureRef.current = JSON.stringify(defaultPalette);
    if (typeof setAvailableItems === 'function') {
      try {
        setAvailableItems(defaultPalette);
      } catch {}
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === 'function') {
      try {
        setAvailableItems(paletteItems);
      } catch {}
    }
    if (typeof setSplitPanelOpen === 'function') {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpenPalette = () => openPalette();
    const handleResetLayout = () => resetLayout();
    window.addEventListener('templateEditor:openPalette', handleOpenPalette);
    window.addEventListener('templateEditor:resetLayout', handleResetLayout);
    return () => {
      window.removeEventListener('templateEditor:openPalette', handleOpenPalette);
      window.removeEventListener('templateEditor:resetLayout', handleResetLayout);
    };
  }, [openPalette, resetLayout]);

  const renderBoardItem = (item, actions) => {
    if (!item?.id) return null;
    const definition = widgetRegistry[item.id];
    if (!definition) return null;
    const WidgetComponent = definition.component;
    return (
      <WidgetComponent
        actions={actions}
        dragHandleAriaLabel="Drag handle"
        i18nStrings={{
          dragHandleAriaLabel: 'Drag handle',
          dragHandleAriaDescription:
            'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
          resizeHandleAriaLabel: 'Resize handle',
          resizeHandleAriaDescription:
            'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
        }}
      />
    );
  };

  return (
    <TemplateEditorProvider toggleHelpPanel={toggleHelpPanel}>
      <SpaceBetween size="l">
        <Board
          items={boardItems}
          onItemsChange={handleItemsChange}
          renderItem={renderBoardItem}
          i18nStrings={boardI18nStrings}
          empty={<Box padding="m">No widgets on the dashboard.</Box>}
        />
      </SpaceBetween>
    </TemplateEditorProvider>
  );
};

export default TemplateEditorDashboard;
