import React, { useState, useEffect } from 'react';
import Board from '@cloudscape-design/board-components/board';
import Header from '@cloudscape-design/components/header';
import { ContentLayout, SpaceBetween, Container, Link } from '@cloudscape-design/components';
import BoardItem from '@cloudscape-design/board-components/board-item';
import SlotManagementWidget from '../widgets/slotManagementWidget';
import AppointmentsTableWidget from '../widgets/appointmentsTableWidget';

const ManageAppointments = ({ toggleHelpPanel }) => {
  const [items, setItems] = useState([
    {
      id: '1',
      rowSpan: 4,
      columnSpan: 4,
      data: { title: 'Slot Management', content: <SlotManagementWidget /> }
    },
    {
      id: '2',
      rowSpan: 4,
      columnSpan: 5,
      data: { title: 'Appointments', content: <AppointmentsTableWidget /> }
    },
  ]);

  const helpPanelContent = (
    <div>
      <h2>Manage Appointments Help</h2>
      <p>
        The Manage Appointments dashboard provides administrators with a comprehensive interface to manage all aspects of appointment scheduling. This includes viewing and managing appointment slots, rescheduling appointments, and tracking appointment statuses. Administrators can also configure appointment rules, send notifications, and ensure compliance with organizational policies. The dashboard offers real-time analytics and reporting, allowing authorized users to monitor appointment trends, identify bottlenecks, and optimize scheduling workflows. Additionally, the system supports integration with external calendars and communication channels, ensuring seamless coordination and communication with clients.
      </p>
    </div>
  );

  return (
    <ContentLayout
      header={
        <Header variant="h1">
        
        </Header>
      }
    >
      <Board
        renderItem={item => (
          <BoardItem
            header={<Header>{item.data.title}</Header>}
            i18nStrings={{
              dragHandleAriaLabel: 'Drag handle',
              dragHandleAriaDescription:
                'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
              resizeHandleAriaLabel: 'Resize handle',
              resizeHandleAriaDescription:
                'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.'
            }}
          >
            {item.data.content}
          </BoardItem>
        )}
        onItemsChange={event => setItems(event.detail.items)}
        items={items}
        i18nStrings={(() => {
          function createAnnouncement(operationAnnouncement, conflicts, disturbed) {
            const conflictsAnnouncement =
              conflicts.length > 0
                ? `Conflicts with ${conflicts.map(c => c.data.title).join(', ')}.`
                : '';
            const disturbedAnnouncement =
              disturbed.length > 0 ? `Disturbed ${disturbed.length} items.` : '';
            return [operationAnnouncement, conflictsAnnouncement, disturbedAnnouncement]
              .filter(Boolean)
              .join(' ');
          }
          return {
            liveAnnouncementDndStarted: operationType =>
              operationType === 'resize' ? 'Resizing' : 'Dragging',
            liveAnnouncementDndItemReordered: operation => {
              const columns = `column ${operation.placement.x + 1}`;
              const rows = `row ${operation.placement.y + 1}`;
              return createAnnouncement(
                `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`,
                operation.conflicts,
                operation.disturbed
              );
            },
            liveAnnouncementDndItemResized: operation => {
              const columnsConstraint = operation.isMinimalColumnsReached ? ' (minimal)' : '';
              const rowsConstraint = operation.isMinimalRowsReached ? ' (minimal)' : '';
              const sizeAnnouncement =
                operation.direction === 'horizontal'
                  ? `columns ${operation.placement.width}${columnsConstraint}`
                  : `rows ${operation.placement.height}${rowsConstraint}`;
              return createAnnouncement(
                `Item resized to ${sizeAnnouncement}.`,
                operation.conflicts,
                operation.disturbed
              );
            },
            liveAnnouncementDndItemInserted: operation => {
              const columns = `column ${operation.placement.x + 1}`;
              const rows = `row ${operation.placement.y + 1}`;
              return createAnnouncement(
                `Item inserted to ${columns}, ${rows}.`,
                operation.conflicts,
                operation.disturbed
              );
            },
            liveAnnouncementDndCommitted: operationType => `${operationType} committed`,
            liveAnnouncementDndDiscarded: operationType => `${operationType} discarded`,
            liveAnnouncementItemRemoved: op =>
              createAnnouncement(`Removed item ${op.item.data.title}.`, [], op.disturbed),
            navigationAriaLabel: 'Board navigation',
            navigationAriaDescription: 'Click on non-empty item to move focus over',
            navigationItemAriaLabel: item => (item ? item.data.title : 'Empty')
          };
        })()}
      />
    </ContentLayout>
  );
};

export default ManageAppointments;
