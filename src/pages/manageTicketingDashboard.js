import React, { useEffect, useState } from 'react';
import { Container, Header, Table, Link, SpaceBetween, Button, Alert } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';

const ManageTicketingDashboard = ({ toggleHelpPanel, updateBreadcrumbs, setSplitPanelOpen, splitPanelOpen, setSplitPanelSize, splitPanelSize, setAvailableItems }) => {
  const [ticketMachines, setTicketMachines] = useState([]);
  const [alertVisible, setAlertVisible] = useState(true);
  const [items, setItems] = useState([
    {
      id: 'ticket-machines',
      rowSpan: 3,
      columnSpan: 2,
      data: { title: 'Ticket Machines' },
    },
    {
      id: 'ticket-settings',
      rowSpan: 3,
      columnSpan: 2,
      data: { title: 'Ticket Settings' },
    },
    {
      id: 'ticket-templates',
      rowSpan: 3,
      columnSpan: 2,
      data: { title: 'Ticket Templates' },
    },
  ]);

  useEffect(() => {
    const fetchTicketMachines = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/ticket-machines`);
        const data = await response.json();
        setTicketMachines(data);
      } catch (error) {
        console.error('Error fetching ticket machines:', error);
      }
    };

    fetchTicketMachines();
  }, []);

  return (
    <SpaceBetween size="l">
      <Board
        renderItem={(item) => {
          if (item.id === 'ticket-machines') {
            return (
              <Container
                header={
                  <Header
                    variant="h1"
                    info={<Link variant="info" onClick={() => toggleHelpPanel('manageTicketing')}>Info</Link>}
                  >
                    {item.data.title}
                  </Header>
                }
              >
                {alertVisible && (
                  <Alert
                    onDismiss={() => setAlertVisible(false)}
                    dismissAriaLabel="Close alert"
                    header="Configure Ticket Machines"
                  >
                    Please configure your ticket machines to ensure smooth operation.
                  </Alert>
                )}
                <Table
                  columnDefinitions={[
                    { id: 'name', header: 'Name', cell: item => item.name },
                    { id: 'location', header: 'Location', cell: item => item.location },
                    { id: 'status', header: 'Status', cell: item => item.status },
                  ]}
                  items={ticketMachines}
                  header={<Header>Ticket Machines</Header>}
                />
              </Container>
            );
          }
          if (item.id === 'ticket-settings') {
            return (
              <Container
                header={
                  <Header
                    variant="h1"
                    info={<Link variant="info" onClick={() => toggleHelpPanel('ticketSettings')}>Info</Link>}
                  >
                    {item.data.title}
                  </Header>
                }
              >
                <Alert
                  type="info"
                  header="Configure Ticket Settings"
                >
                  Please configure your ticket settings to ensure smooth operation.
                </Alert>
              </Container>
            );
          }
          if (item.id === 'ticket-templates') {
            return (
              <Container
                header={
                  <Header
                    variant="h1"
                    info={<Link variant="info" onClick={() => toggleHelpPanel('ticketTemplates')}>Info</Link>}
                  >
                    {item.data.title}
                  </Header>
                }
              >
                <Alert
                  type="info"
                  header="Configure Ticket Templates"
                >
                  Please configure your ticket templates to ensure smooth operation.
                </Alert>
              </Container>
            );
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
    </SpaceBetween>
  );
};

export default ManageTicketingDashboard;
