import React, { useState } from 'react';
import { ContentLayout, Header } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import BlankTemplate from '../widgets/blankTemplate';
import UnassignedApplicationsWidget from '../widgets/UnassignedApplicationsWidget';
import AssignedCasesWidget from '../widgets/AssignedCasesWidget';

const CaseAssignmentDashboard = ({ header = 'Case Assignment', headerInfo, toggleHelpPanel, updateBreadcrumbs, setSplitPanelOpen, setAvailableItems }) => {
  const [boardItems, setBoardItems] = useState([
    { id: 'unassigned-applications', rowSpan: 4, columnSpan: 4, data: { title: 'Unassigned Applications' } },
    { id: 'assigned-cases', rowSpan: 4, columnSpan: 4, data: { title: 'Assigned Cases' } },
  ]);

  return (
    <ContentLayout
    >
      <Board
        renderItem={(item, actions) => {
          if (item.id === 'blank-template') {
            return <BlankTemplate actions={actions} />;
          }
          if (item.id === 'unassigned-applications') {
            return <UnassignedApplicationsWidget actions={actions} />;
          }
          if (item.id === 'assigned-cases') {
            return <AssignedCasesWidget actions={actions} />;
          }
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
