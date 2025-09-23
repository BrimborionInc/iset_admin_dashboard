import React, { useEffect, useState } from 'react';
import { Container, Header, Table, Link, SpaceBetween, Alert } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import ManageTemplates from '../widgets/manageTemplates';
// import ConfigureNotifications from '../widgets/configureNotifications'; // Import the new widget
import NotificationSettingsWidget from '../widgets/notificationSettingsWidget';
import { apiFetch } from '../auth/apiClient';

const ManageNotifications = ({ toggleHelpPanel, updateBreadcrumbs, setSplitPanelOpen, splitPanelOpen, setSplitPanelSize, splitPanelSize, setAvailableItems }) => {
  const [notifications, setNotifications] = useState([]);
  const [alertVisible, setAlertVisible] = useState(true);
  const [items, setItems] = useState([
    {
      id: 'notification-settings-widget',
      rowSpan: 7,
      columnSpan: 4,
      data: { title: 'Notifications Settings' },
    },
    {
      id: 'manage-templates',
      rowSpan: 7,
      columnSpan: 3,
      data: { title: 'Template Editor' },
    },
    // {
    //   id: 'configure-notifications',
    //   rowSpan: 7,
    //   columnSpan: 1,
    //   data: { title: 'Configure Reminders and Notifications' },
    // },
    // Add more widgets here as needed
  ]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
  const response = await apiFetch(`/api/notifications`);
        const data = await response.json();
        setNotifications(data);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };

    fetchNotifications();
  }, []);

  return (
    <SpaceBetween size="l">
      <Board
        renderItem={(item, actions) => {
          if (item.id === 'notification-settings-widget') {
            return (
              <NotificationSettingsWidget
                actions={actions}
                toggleHelpPanel={toggleHelpPanel}
              />
            );
          }
          if (item.id === 'manage-templates') {
            return (
              <ManageTemplates
                actions={actions}
                dragHandleAriaLabel="Drag handle"
                i18nStrings={{
                  dragHandleAriaLabel: 'Drag handle',
                  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
                  resizeHandleAriaLabel: 'Resize handle',
                  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
                }}
              />
            );
          }
          // if (item.id === 'configure-notifications') {
          // return (
          // <ConfigureNotifications
          // actions={actions}
          // dragHandleAriaLabel="Drag handle"
          // i18nStrings={{
          // dragHandleAriaLabel: 'Drag handle',
          // dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
          // resizeHandleAriaLabel: 'Resize handle',
          // resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
          // }}
          // />
          // );
          // }
          // Render other items here if needed
          return null;
        }}
        items={items}
        onItemsChange={(event) => setItems(event.detail.items)}
        i18nStrings={{
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
          navigationAriaLabel: 'Board navigation',
          navigationAriaDescription: 'Click on non-empty item to move focus over',
          navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty'),
        }}
      />
    </SpaceBetween>
  );
};

export default ManageNotifications;
