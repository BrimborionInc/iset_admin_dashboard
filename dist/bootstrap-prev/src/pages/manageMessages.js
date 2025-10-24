import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  Box, // Add Box import
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { useParams } from 'react-router-dom';
import ApplicantDetails from '../widgets/applicantDetails'; // Import the new widget
import ComposeMessageWidget from '../widgets/composeMessage'; // Import the ComposeMessageWidget

const ManageMessages = ({ header, headerInfo, toggleHelpPanel, updateBreadcrumbs }) => {
  const { id } = useParams();
  const [error, setError] = useState(null); // Add error state
  const [items, setItems] = useState([
    {
      id: 'applicant-details',
      rowSpan: 5,
      columnSpan: 2,
      data: { title: 'Applicant Details' },
    },
    {
      id: 'compose-message',
      rowSpan: 5,
      columnSpan: 2,
      data: { title: 'Compose Message' },
    },
    // Add more widgets here as needed
  ]);
  const [selectedUserEmails, setSelectedUserEmails] = useState([]); // Add state for selected users' emails

  useEffect(() => {
    updateBreadcrumbs([
      { text: 'Home', href: '/' },
      { text: 'Manage Messages', href: '/manage-messages' },
      { text: `Template ${id}`, href: '#' }
    ]);
  }, [id, updateBreadcrumbs]);

  const handleUserSelect = (user) => {
    console.log('User selected:', user); // This should correctly log {label: 'bob@example.com', value: 2}
    
    if (!selectedUserEmails.some(option => option.value === user.value)) {
        setSelectedUserEmails(prevEmails => [...prevEmails, user]); // Simply add user as-is
    }
  };

  if (error) {
    return <div>{error}</div>; // Display error message
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
                if (item.id === 'applicant-details') {
                    return <ApplicantDetails actions={actions} onSelectUser={handleUserSelect} />;
                }
                if (item.id === 'compose-message') {
                    console.log ('Selected User Emails:', selectedUserEmails);
                    return <ComposeMessageWidget actions={actions} recipient={selectedUserEmails} />;
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

export default ManageMessages;
