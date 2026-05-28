import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board from '@cloudscape-design/board-components/board';
import { SpaceBetween, Box } from '@cloudscape-design/components';

import EsdcParticipantQueueWidget from './widgets/EsdcParticipantQueueWidget.jsx';
import EsdcParticipantHistoryWidget from './widgets/EsdcParticipantHistoryWidget.jsx';
import EsdcParticipantQueueHelp from '../../helpPanelContents/esdcParticipantQueueHelp.js';
import EsdcParticipantHistoryHelp from '../../helpPanelContents/esdcParticipantHistoryHelp.js';

const STORAGE_KEY = 'esdc-participants-layout-v6';

const widgetRegistry = {
  queue: {
    id: 'queue',
    defaultRowSpan: 7,
    defaultColumnSpan: 4,
    component: EsdcParticipantQueueWidget,
    title: 'Participant submission queue',
    description: 'Readiness summary, validation, batch XML generation, and participant queue.',
    helpComponent: EsdcParticipantQueueHelp,
    helpTitle: 'Participant queue',
    aiContext: EsdcParticipantQueueHelp.aiContext
  },
  history: {
    id: 'history',
    defaultRowSpan: 5,
    defaultColumnSpan: 4,
    component: EsdcParticipantHistoryWidget,
    title: 'Recent ILMP exports',
    description: 'Latest batch XML downloads and re-export tools.',
    helpComponent: EsdcParticipantHistoryHelp,
    helpTitle: 'Participant submissions history',
    aiContext: EsdcParticipantHistoryHelp.aiContext
  }
};

const defaultLayout = [
  { id: 'queue', rowSpan: 7, columnSpan: 4 }
];

const exportLayout = items =>
  items.map(({ id, rowSpan, columnSpan, columnOffset }) => ({
    id,
    rowSpan,
    columnSpan,
    columnOffset
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
        aiContext: definition.aiContext
      }
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
  } catch (err) {
    console.error('[EsdcParticipantSubmissionsPage] failed to parse stored layout', err);
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
    if (!left || !right || left.id !== right.id ||
      (left.rowSpan ?? null) !== (right.rowSpan ?? null) ||
      (left.columnSpan ?? null) !== (right.columnSpan ?? null)) {
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
  liveAnnouncementDndStarted: operation => (operation === 'resize' ? 'Resizing' : 'Dragging'),
  liveAnnouncementDndItemReordered: operation => {
    const position = operation.direction === 'horizontal'
      ? `column ${operation.placement.x + 1}`
      : `row ${operation.placement.y + 1}`;
    return `Item moved to ${position}.`;
  },
  liveAnnouncementDndItemResized: operation => {
    const base = operation.direction === 'horizontal'
      ? `columns ${operation.placement.width}`
      : `rows ${operation.placement.height}`;
    const constraint = operation.direction === 'horizontal'
      ? (operation.isMinimalColumnsReached ? ' (minimal)' : '')
      : (operation.isMinimalRowsReached ? ' (minimal)' : '');
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
  navigationAriaLabel: 'ILMP Submissions & Exports navigation',
  navigationAriaDescription: 'Use arrow keys to move between widgets.',
  navigationItemAriaLabel: item => (item ? item.data.title : 'Empty')
};

const EsdcParticipantSubmissionsPage = ({
  toggleHelpPanel,
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen
}) => {
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? defaultLayout);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems));

  useEffect(() => {
    if (typeof updateBreadcrumbs === 'function') {
      updateBreadcrumbs([
        { text: 'Home', href: '/' },
        { text: 'ESDC Submissions', href: '/esdc/overview' },
        { text: 'ILMP Submissions & Exports', href: '/esdc/participants' }
      ]);
    }
  }, [updateBreadcrumbs]);

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
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
    } catch {}
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
    window.addEventListener('palette:add', handler);
    return () => window.removeEventListener('palette:add', handler);
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
    return (
      <WidgetComponent
        actions={actions}
        metadata={item.data}
        toggleHelpPanel={toggleHelpPanel}
      />
    );
  };

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : defaultLayout));
    const defaultPalette = computePaletteItems(toBoardItems(defaultLayout));
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
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    window.addEventListener('esdcParticipants:openPalette', handleOpen);
    window.addEventListener('esdcParticipants:resetLayout', handleReset);
    return () => {
      window.removeEventListener('esdcParticipants:openPalette', handleOpen);
      window.removeEventListener('esdcParticipants:resetLayout', handleReset);
    };
  }, [openPalette, resetLayout]);

  return (
    <SpaceBetween size="l">
      <Board
        i18nStrings={boardI18nStrings}
        items={boardItems}
        onItemsChange={handleItemsChange}
        renderItem={renderBoardItem}
        empty={<Box padding="m">No widgets on the dashboard.</Box>}
      />
    </SpaceBetween>
  );
};

export default EsdcParticipantSubmissionsPage;
