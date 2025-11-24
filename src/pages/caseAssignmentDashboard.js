import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ContentLayout } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import BlankTemplate from '../widgets/blankTemplate';
import ApplicationsWidget from '../widgets/ApplicationsWidget';
import useCurrentUser from '../hooks/useCurrentUser';

const CaseAssignmentDashboard = ({
  header = 'Manage Applications',
  headerInfo,
  toggleHelpPanel,
  updateBreadcrumbs,
  setSplitPanelOpen,
  setAvailableItems
}) => {
  const { role } = useCurrentUser();

  const widgetRegistry = useMemo(() => ({
    'applications-unified': {
      id: 'applications-unified',
      component: ApplicationsWidget,
      title: 'Active Cases',
      description: 'Unified table of active applications.',
      defaultRowSpan: 6,
      defaultColumnSpan: 12
    }
  }), []);

  const defaultLayout = useMemo(() => {
    return [
      { id: 'applications-unified', rowSpan: 6, columnSpan: 12 }
    ];
  }, []);

  const [layout, setLayout] = useState(defaultLayout);
  const [refreshKey] = useState(0);
  const paletteSignatureRef = useRef(null);

  const boardItems = useMemo(() => {
    return layout
      .filter(item => item && widgetRegistry[item.id])
      .map(entry => {
        const def = widgetRegistry[entry.id];
        return {
          id: def.id,
          rowSpan: entry.rowSpan ?? def.defaultRowSpan,
          columnSpan: entry.columnSpan ?? def.defaultColumnSpan,
          columnOffset: entry.columnOffset,
          data: { title: def.title, description: def.description }
        };
      });
  }, [layout, widgetRegistry]);

  const paletteItems = useMemo(() => {
    return Object.values(widgetRegistry)
      .filter(def => !layout.some(item => item.id === def.id))
      .map(def => ({
        id: def.id,
        data: { title: def.title, description: def.description }
      }));
  }, [layout, widgetRegistry]);

  useEffect(() => {
    setLayout(defaultLayout);
  }, [defaultLayout]);

  useEffect(() => {
    const signature = JSON.stringify(paletteItems.map(item => item.id));
    if (signature !== paletteSignatureRef.current) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === 'function') {
        try {
          setAvailableItems(paletteItems);
        } catch (_) {}
      }
    }
  }, [paletteItems, setAvailableItems]);

  useEffect(() => {
    const handleOpenPalette = () => {
      if (typeof setAvailableItems === 'function') {
        try {
          setAvailableItems(paletteItems);
        } catch (_) {}
      }
      if (typeof setSplitPanelOpen === 'function') {
        setSplitPanelOpen(true);
      }
    };
    const handleResetLayout = () => {
      setLayout(defaultLayout);
      const signature = JSON.stringify(paletteItems.map(item => item.id));
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === 'function') {
        try {
          setAvailableItems(paletteItems);
        } catch (_) {}
      }
    };
    window.addEventListener('caseAssignment:openPalette', handleOpenPalette);
    window.addEventListener('caseAssignment:resetLayout', handleResetLayout);
    return () => {
      window.removeEventListener('caseAssignment:openPalette', handleOpenPalette);
      window.removeEventListener('caseAssignment:resetLayout', handleResetLayout);
    };
  }, [defaultLayout, paletteItems, setAvailableItems, setSplitPanelOpen]);

  return (
    <ContentLayout
    >
      <Board
        renderItem={(item, actions) => {
          if (item.id === 'blank-template') {
            return <BlankTemplate actions={actions} />;
          }
          if (item.id === 'applications-unified') return <ApplicationsWidget actions={actions} refreshKey={refreshKey} />;
          return null;
        }}
        items={boardItems}
        onItemsChange={event => setLayout(event.detail.items)}
        i18nStrings={{
          liveAnnouncementDndStarted: (operationType) =>
            operationType === 'resize' ? 'Resizing' : 'Dragging',
          liveAnnouncementDndItemReordered: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`;
          },
          liveAnnouncementDndItemResized: (operation) => {
            const sizeAnnouncement =
              operation.direction === 'horizontal'
                ? `columns ${operation.placement.width}`
                : `rows ${operation.placement.height}`;
            return `Item resized to ${sizeAnnouncement}.`;
          },
          liveAnnouncementDndItemInserted: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item inserted to ${columns}, ${rows}.`;
          },
          liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
          liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
          liveAnnouncementItemRemoved: operation => `Removed item ${operation.item?.data?.title || ''}.`,
        }}
      />
    </ContentLayout>
  );
};

export default CaseAssignmentDashboard;
