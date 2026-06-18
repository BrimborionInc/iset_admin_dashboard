import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board from '@cloudscape-design/board-components/board';
import { Box, SpaceBetween } from '@cloudscape-design/components';
import ApplicationsWidget from '../widgets/ApplicationsWidget';

const STORAGE_KEY = 'case-assignment-dashboard-layout-v2';

const widgetRegistry = {
  applicationsTable: {
    id: 'applicationsTable',
    defaultRowSpan: 7,
    defaultColumnSpan: 4,
    component: ApplicationsWidget,
    title: 'ISET Applications',
    description: 'Review, assign, and open ISET applications in your scope.',
  },
};

const defaultLayout = [{ id: 'applicationsTable', rowSpan: 7, columnSpan: 4 }];

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
        },
      };
    })
    .filter(Boolean);

const loadLayoutFromStorage = () => {
  if (typeof window === 'undefined') return null;
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
    .map(def => ({
      id: def.id,
      data: { title: def.title, description: def.description },
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

const boardI18nStrings = {
  liveAnnouncementDndStarted: operation => (operation === 'resize' ? 'Resizing' : 'Dragging'),
  liveAnnouncementDndItemReordered: operation => {
    const position =
      operation.direction === 'horizontal'
        ? `column ${operation.placement.x + 1}`
        : `row ${operation.placement.y + 1}`;
    return `Item moved to ${position}.`;
  },
  liveAnnouncementDndItemResized: operation => {
    const base =
      operation.direction === 'horizontal'
        ? `columns ${operation.placement.width}`
        : `rows ${operation.placement.height}`;
    const constraint =
      operation.direction === 'horizontal'
        ? operation.isMinimalColumnsReached
          ? ' (minimal)'
          : ''
        : operation.isMinimalRowsReached
          ? ' (minimal)'
          : '';
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
    op?.item?.data?.title ? `Removed item ${op.item.data.title}.` : 'Removed item.',
  navigationAriaLabel: 'Manage ISET Applications dashboard navigation',
  navigationAriaDescription: 'Use arrow keys to move between widgets on the Manage ISET Applications dashboard.',
  navigationItemAriaLabel: item => (item ? item.data.title : 'Empty'),
};

const CaseAssignmentDashboard = ({
  setAvailableItems,
  setSplitPanelOpen,
  toggleHelpPanel,
}) => {
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? [...defaultLayout]);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems.map(item => item.id)));

  useEffect(() => {
    const signature = JSON.stringify(paletteItems.map(item => item.id));
    if (paletteSignatureRef.current !== signature) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === 'function') {
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
      // ignore storage errors
    }
  }, [boardItems, paletteItems, setAvailableItems]);

  useEffect(() => {
    const handlePaletteAdd = event => {
      const id = event?.detail?.id;
      if (!id || !widgetRegistry[id]) return;
      setLayout(current => {
        if (current.some(item => item.id === id)) return current;
        return [...current, { id }];
      });
    };
    window.addEventListener('palette:add', handlePaletteAdd);
    return () => window.removeEventListener('palette:add', handlePaletteAdd);
  }, []);

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
          refreshKey={0}
          toggleHelpPanel={toggleHelpPanel}
        />
      );
    },
    [toggleHelpPanel]
  );

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : [...defaultLayout]));
    const defaultPalette = computePaletteItems(toBoardItems(defaultLayout));
    paletteSignatureRef.current = JSON.stringify(defaultPalette.map(item => item.id));
    if (typeof setAvailableItems === 'function') {
      try {
        setAvailableItems(defaultPalette);
      } catch {
        // ignore
      }
    }
    if (typeof setSplitPanelOpen === 'function') {
      setSplitPanelOpen(false);
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [setAvailableItems, setSplitPanelOpen]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === 'function') {
      try {
        setAvailableItems(paletteItems);
      } catch {
        // ignore
      }
    }
    if (typeof setSplitPanelOpen === 'function') {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const openHandler = () => openPalette();
    const resetHandler = () => resetLayout();
    window.addEventListener('caseAssignment:openPalette', openHandler);
    window.addEventListener('caseAssignment:resetLayout', resetHandler);
    return () => {
      window.removeEventListener('caseAssignment:openPalette', openHandler);
      window.removeEventListener('caseAssignment:resetLayout', resetHandler);
    };
  }, [openPalette, resetLayout]);

  return (
    <SpaceBetween size="l">
      <Board
        items={boardItems}
        renderItem={renderBoardItem}
        onItemsChange={handleItemsChange}
        i18nStrings={boardI18nStrings}
        empty={<Box padding="m">No widgets configured.</Box>}
      />
    </SpaceBetween>
  );
};

export default CaseAssignmentDashboard;
