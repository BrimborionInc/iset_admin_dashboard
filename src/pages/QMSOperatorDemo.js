import React, { useState } from 'react';
import { Board } from '@cloudscape-design/board-components';
import CounterSignInWidget from '../widgets/CounterSignInWidget';
import CallNextWidget from '../widgets/CallNextWidget';
import SessionInfoWidget from '../widgets/SessionInfoWidget';
import QueueOverviewWidget from '../widgets/QueueOverviewWidget';
import QMSWaitingRoomScreen from '../widgets/QMSWaitingRoomScreen';

const QMSOperatorDemo = ({ toggleHelpPanel }) => {
  const [items, setItems] = useState([
    { id: 'waiting-room-screen', rowSpan: 3, columnSpan: 4, data: { title: 'Waiting Room Screen' } }, // New widget
    { id: 'call-next', rowSpan: 3, columnSpan: 4, data: { title: 'Call Next' } },
    { id: 'queue-overview', rowSpan: 3, columnSpan: 4, data: { title: 'Queue Overview' } },
    { id: 'counter-sign-in', rowSpan: 3, columnSpan: 2, data: { title: '(Demo) Counter Sign-In' } },
    { id: 'session-info', rowSpan: 3, columnSpan: 2, data: { title: '(Demo) Session Info' } },

  ]);

  const [activeUserId, setActiveUserId] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger for refreshing QueueOverviewWidget

  const refreshQueueOverview = () => {
    setRefreshTrigger((prev) => prev + 1); // Increment trigger to refresh
  };

  const removeItem = (id) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  return (
    <Board
      renderItem={(item) => {
        if (item.id === 'counter-sign-in') {
          return <CounterSignInWidget toggleHelpPanel={toggleHelpPanel} actions={{ removeItem: () => removeItem('counter-sign-in') }} setActiveUserId={setActiveUserId} />;
        }
        if (item.id === 'session-info') {
          return <SessionInfoWidget toggleHelpPanel={toggleHelpPanel} actions={{ removeItem: () => removeItem('session-info') }} activeUserId={activeUserId} />;
        }
        if (item.id === 'call-next') {
          return <CallNextWidget toggleHelpPanel={toggleHelpPanel} actions={{ removeItem: () => removeItem('call-next') }} activeUserId={activeUserId} refreshQueueOverview={refreshQueueOverview} />;
        }
        if (item.id === 'waiting-room-screen') {
          return <QMSWaitingRoomScreen toggleHelpPanel={toggleHelpPanel} refreshTrigger={refreshTrigger} actions={{ removeItem: () => removeItem('waiting-room-screen') }} />;
        }
        if (item.id === 'queue-overview') {
          return <QueueOverviewWidget toggleHelpPanel={toggleHelpPanel} actions={{ removeItem: () => removeItem('queue-overview') }} refreshTrigger={refreshTrigger} />;
        }
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
  );
};

export default QMSOperatorDemo;
