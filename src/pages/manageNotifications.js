import React, { useState } from 'react';
import { SpaceBetween } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import NotificationSettingsWidget from '../widgets/notificationSettingsWidget';

const ManageNotifications = ({ toggleHelpPanel }) => {
  const [items, setItems] = useState([
    {
      id: 'notification-settings',
      rowSpan: 7,
      columnSpan: 8,
      data: { title: 'Notification Settings' }
    }
  ]);

  return (
    <SpaceBetween size="l">
      <Board
        renderItem={(item, actions) =>
          item.id === 'notification-settings' ? (
            <NotificationSettingsWidget actions={actions} toggleHelpPanel={toggleHelpPanel} />
          ) : null
        }
        items={items}
        onItemsChange={(event) => setItems(event.detail.items)}
        i18nStrings={{
          liveAnnouncementDndStarted: () => 'Dragging',
          liveAnnouncementDndItemReordered: () => 'Item moved',
          liveAnnouncementDndItemResized: () => 'Item resized',
          liveAnnouncementDndItemInserted: () => 'Item inserted',
          liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
          liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
          liveAnnouncementItemRemoved: (op) => `Removed ${op.item.data.title}`,
          navigationAriaLabel: 'Board navigation',
          navigationAriaDescription: 'Click on non-empty item to move focus over',
          navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty')
        }}
      />
    </SpaceBetween>
  );
};

export default ManageNotifications;
