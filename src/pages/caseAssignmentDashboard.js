import React, { useState } from 'react';
import { ContentLayout, Header } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import BlankTemplate from '../widgets/blankTemplate';
import ApplicationsWidget from '../widgets/ApplicationsWidget';

const CaseAssignmentDashboard = ({ header = 'Manage Applications', headerInfo, toggleHelpPanel, updateBreadcrumbs, setSplitPanelOpen, setAvailableItems }) => {
  const [boardItems, setBoardItems] = useState([
  { id: 'applications-unified', rowSpan: 6, columnSpan: 12, data: { title: 'Active Cases' } }
  ]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Handler to trigger refresh in child widgets
  const handleRefresh = () => setRefreshKey(k => k + 1);

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
        onItemsChange={event => setBoardItems(event.detail.items)}
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
        }}
      />
    </ContentLayout>
  );
};

export default CaseAssignmentDashboard;
