import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import IntakeStepTableWidget from '../widgets/IntakeStepTableWidget';
import PreviewIntakeStep from '../widgets/PreviewIntakeStep';
import PreviewStepJson from '../widgets/PreviewStepJSON';

const STORAGE_KEY = 'manage-components-board-layout-v2';

const widgetRegistry = {
  stepLibrary: {
    id: 'stepLibrary',
    title: 'Intake Step Library',
    description: 'Browse, sort, preview, edit, and delete reusable intake steps.',
    defaultRowSpan: 5,
    defaultColumnSpan: 2,
    component: IntakeStepTableWidget,
  },
  previewStep: {
    id: 'previewStep',
    title: 'Preview',
    description: 'Render the selected step using the portal preview service.',
    defaultRowSpan: 5,
    defaultColumnSpan: 2,
    component: PreviewIntakeStep,
  },
  previewJson: {
    id: 'previewJson',
    title: 'Step JSON',
    description: 'Inspect the raw step payload returned by the API.',
    defaultRowSpan: 5,
    defaultColumnSpan: 4,
    component: PreviewStepJson,
  },
};

const defaultLayout = [
  { id: 'stepLibrary', rowSpan: 5, columnSpan: 2 },
  { id: 'previewStep', rowSpan: 5, columnSpan: 2 },
  { id: 'previewJson', rowSpan: 5, columnSpan: 4 },
];

const boardI18nStrings = {
  empty: 'No widgets configured.',
  loading: 'Loading widgets',
  columnAriaLabel: index => `Column ${index + 1}`,
  navigationAriaLabel: 'Board navigation',
  navigationAriaDescription: 'Click on non-empty item to move focus over',
  navigationItemAriaLabel: item => (item ? item.data.title : 'Empty'),
  liveAnnouncementDndStarted: operation => (operation === 'resize' ? 'Resizing widget' : 'Dragging widget'),
  liveAnnouncementDndItemReordered: operation => {
    const position =
      operation.direction === 'horizontal'
        ? `column ${operation.placement.x + 1}`
        : `row ${operation.placement.y + 1}`;
    return `Widget moved to ${position}.`;
  },
  liveAnnouncementDndItemResized: operation => {
    const base =
      operation.direction === 'horizontal'
        ? `columns ${operation.placement.width}`
        : `rows ${operation.placement.height}`;
    return `Widget resized to ${base}.`;
  },
  liveAnnouncementDndItemInserted: operation => {
    const column = `column ${operation.placement.x + 1}`;
    const row = `row ${operation.placement.y + 1}`;
    return `Widget inserted into ${column}, ${row}.`;
  },
  liveAnnouncementDndCommitted: () => 'Drag and drop committed.',
  liveAnnouncementDndDiscarded: () => 'Drag and drop cancelled.',
  liveAnnouncementItemRemoved: () => 'Removed widget.',
};

const loadLayout = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const filtered = parsed.filter(item => item && widgetRegistry[item.id]);
    return filtered.length ? filtered : null;
  } catch {
    return null;
  }
};

const persistLayout = layout => {
  if (typeof window === 'undefined') return;
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
        },
      };
    })
    .filter(Boolean);

const computePaletteItems = items =>
  Object.values(widgetRegistry)
    .filter(definition => !items.some(item => item.id === definition.id))
    .map(definition => ({
      id: definition.id,
      data: {
        title: definition.title,
        description: definition.description,
      },
    }));

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

const ManageIntakeSteps = ({ toggleHelpPanel, setAvailableItems, setSplitPanelOpen }) => {
  const [selectedBlockStep, setSelectedBlockStep] = useState(null);
  const [layout, setLayout] = useState(() => loadLayout() ?? [...defaultLayout]);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems.map(item => item.id)));
  const layoutSignatureRef = useRef(JSON.stringify(exportLayout(boardItems)));

  useEffect(() => {
    const signature = JSON.stringify(paletteItems.map(item => item.id));
    if (signature !== paletteSignatureRef.current) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === 'function') {
        setAvailableItems(paletteItems);
      }
    }

    const nextLayout = exportLayout(boardItems);
    const layoutSignature = JSON.stringify(nextLayout);
    if (layoutSignature !== layoutSignatureRef.current) {
      layoutSignatureRef.current = layoutSignature;
      persistLayout(nextLayout);
    }
  }, [boardItems, paletteItems, setAvailableItems]);

  useEffect(() => {
    const handler = event => {
      const id = event?.detail?.id;
      if (!id || !widgetRegistry[id]) return;
      setLayout(current => {
        if (current.some(item => item.id === id)) return current;
        const definition = widgetRegistry[id];
        return [
          ...current,
          {
            id,
            rowSpan: definition.defaultRowSpan,
            columnSpan: definition.defaultColumnSpan,
          },
        ];
      });
    };
    window.addEventListener('palette:add', handler);
    return () => window.removeEventListener('palette:add', handler);
  }, []);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === 'function') {
      setAvailableItems(paletteItems);
    }
    if (typeof setSplitPanelOpen === 'function') {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  const resetLayout = useCallback(() => {
    const nextLayout = defaultLayout.map(item => ({ ...item }));
    const nextBoardItems = toBoardItems(nextLayout);
    const nextPaletteItems = computePaletteItems(nextBoardItems);
    setLayout(nextLayout);
    paletteSignatureRef.current = JSON.stringify(nextPaletteItems.map(item => item.id));
    layoutSignatureRef.current = JSON.stringify(nextLayout);
    persistLayout(nextLayout);
    if (typeof setAvailableItems === 'function') {
      setAvailableItems(nextPaletteItems);
    }
    if (!nextPaletteItems.length && typeof setSplitPanelOpen === 'function') {
      setSplitPanelOpen(false);
    }
  }, [setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    window.addEventListener('manageComponents:openPalette', openPalette);
    window.addEventListener('manageComponents:resetLayout', resetLayout);
    return () => {
      window.removeEventListener('manageComponents:openPalette', openPalette);
      window.removeEventListener('manageComponents:resetLayout', resetLayout);
    };
  }, [openPalette, resetLayout]);

  const handleItemsChange = useCallback(({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const next = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, next) ? current : next));
  }, []);

  const renderItem = useCallback(
    (item, actions) => {
      const definition = widgetRegistry[item.id];
      if (!definition) return <Box />;
      const Widget = definition.component;
      return (
        <Widget
          actions={actions}
          selectedBlockStep={selectedBlockStep}
          setSelectedBlockStep={setSelectedBlockStep}
          toggleHelpPanel={toggleHelpPanel}
        />
      );
    },
    [selectedBlockStep, toggleHelpPanel]
  );

  return (
    <Board
      boardId="manage-components-dashboard"
      items={boardItems}
      renderItem={renderItem}
      onItemsChange={handleItemsChange}
      i18nStrings={boardI18nStrings}
      empty={
        <Box padding="m" textAlign="center" color="text-status-inactive">
          Add widgets from the palette to manage intake steps.
        </Box>
      }
    />
  );
};

export default ManageIntakeSteps;
