import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { useParams } from 'react-router-dom';
import AppointmentStatus from '../widgets/appointmentStatus'; // Import the new widget

const ModifyAppointment = ({ header, headerInfo, toggleHelpPanel, updateBreadcrumbs }) => {
  const { id } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [items, setItems] = useState([
    {
      id: 'appointment-status',
      rowSpan: 3,
      columnSpan: 2,
      data: { title: 'Testing Queue Management' },
    },
    // Add more widgets here as needed
  ]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/appointments/${id}`)
      .then(response => response.json())
      .then(data => {
        setAppointment(data);
        updateBreadcrumbs([
          { text: 'Home', href: '/' },
          { text: 'Manage Appointments', href: '/manage-appointments-new' },
          { text: `Appointment ${data.id}`, href: '#' }
        ]);
      })
      .catch(error => console.error('Error fetching appointment:', error));
  }, [id, updateBreadcrumbs]);

  useEffect(() => {
    if (appointment) {
      updateBreadcrumbs([
        { text: 'Home', href: '/' },
        { text: 'Manage Appointments', href: '/manage-appointments-new' },
        { text: `Appointment ${appointment.id}`, href: '#' }
      ]);
    }
  }, [appointment, updateBreadcrumbs]);

  if (!appointment) {
    return <div>Loading...</div>;
  }

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={headerInfo}>
          {header}
        </Header>
      }
    >
      <Board
        renderItem={(item, actions) => {
          if (item.id === 'appointment-status') {
            return <AppointmentStatus actions={actions} appointmentId={id} />;
          }
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
    </ContentLayout>
  );
};

export default ModifyAppointment;
