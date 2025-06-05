import React, { useState } from 'react';
import { ContentLayout, Header, Alert, Box } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import CaseManagementDemoControlsWidget from '../widgets/CaseManagementDemoControlsWidget';
import CaseManagementDemoControlsHelp from '../helpPanelContents/CaseManagementDemoControlsHelp';

const ManageApplications = ({ toggleHelpPanel }) => {
  const [items, setItems] = useState([
    {
      id: 'case-management-demo-controls',
      columnOffset: 0,
      columnSpan: 4,
      rowSpan: 1,
      data: { actions: { removeItem: () => {} }, toggleHelpPanel },
    },
  ]); // Initial state with the demo controls widget

  const [alertVisible, setAlertVisible] = useState(true); // State to control alert visibility

  return (
    <ContentLayout>
      {alertVisible && (
        <Box margin={{ bottom: 'm' }}>
          <Alert
            type="info"
            dismissible
            onDismiss={() => setAlertVisible(false)}
            header="New Documents Uploaded"
          >
            Applicant Charlie Davis has uploaded new documents 4/22/2025, 9:44:56 AM
          </Alert>
        </Box>
      )}
      <Board
        renderItem={(item) => {
          if (item.id === 'case-management-demo-controls') {
            return <CaseManagementDemoControlsWidget actions={item.data.actions} toggleHelpPanel={toggleHelpPanel} />;
          }
          return null;
        }}
        onItemsChange={(event) => setItems(event.detail.items)}
        items={items}
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

export default ManageApplications;
