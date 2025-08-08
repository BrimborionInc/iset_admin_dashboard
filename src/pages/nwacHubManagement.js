import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Table,
  Box,
  SpaceBetween,
  Button,
  Header,
  ButtonDropdown,
  Flashbar,
  StatusIndicator,
  Link
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import BoardItem from '@cloudscape-design/board-components/board-item';
import { useHistory } from 'react-router-dom';

const NWACHubManagementDashboard = ({ header, headerInfo, toggleHelpPanel }) => {
  const history = useHistory();
  const [selectedItems, setSelectedItems] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [items, setItems] = useState([
    {
      id: 'nwac-hubs-table',
      rowSpan: 7,
      columnSpan: 4,
      data: { title: 'NWAC Hubs Table', content: null },
      dragHandleAriaLabel: 'Drag handle',
      resizeHandleAriaLabel: 'Resize handle'
    }
  ]);
  const [flashMessages, setFlashMessages] = useState([]);

  // Placeholder fetch for NWAC Hubs
  const fetchHubs = () => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/ptmas?type=Hub`)
      .then(response => response.json())
      .then(data => {
        setHubs(data);
      })
      .catch(error => console.error('Error fetching Hubs:', error));
  };

  useEffect(() => {
    fetchHubs();
  }, []);

  const handleNewHub = () => {
    // Placeholder for navigation to new hub form
    history.push('/new-nwac-hub');
  };

  return (
    <ContentLayout>
      <Board
        renderItem={(item) => (
          <BoardItem
            key={item.id}
            {...item}
            header={
              <Header variant="h2" info={<Link variant="info" onClick={() => toggleHelpPanel && toggleHelpPanel(item.id)}>Info</Link>}>
                NWAC Hubs
              </Header>
            }
            dragHandleAriaLabel={item.dragHandleAriaLabel}
            resizeHandleAriaLabel={item.resizeHandleAriaLabel}
            i18nStrings={{
              dragHandleAriaLabel: 'Drag handle',
              dragHandleAriaDescription:
                'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
              resizeHandleAriaLabel: 'Resize handle',
              resizeHandleAriaDescription:
                'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.',
            }}
          >
            {item.id === 'nwac-hubs-table' && (
              <Table
                renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
                  `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
                }
                selectedItems={selectedItems}
                variant="embedded"
                ariaLabels={{
                  selectionGroupLabel: "Items selection",
                  allItemsSelectionLabel: () => "select all",
                  itemSelectionLabel: ({ selectedItems }, item) => item.name,
                }}
                columnDefinitions={[
                  {
                    id: "full_name",
                    header: "Hub Name",
                    cell: e => e.full_name,
                    sortingField: "full_name",
                    isRowHeader: true
                  },
                  {
                    id: "code",
                    header: "Code",
                    cell: e => e.code,
                    sortingField: "code"
                  },
                  {
                    id: "province",
                    header: "Province",
                    cell: e => e.province,
                    sortingField: "province"
                  },
                  {
                    id: "alerts",
                    header: "Alerts",
                    cell: e => (
                      <StatusIndicator type="warning">
                        {/* Placeholder for alerts */}
                        None
                      </StatusIndicator>
                    )
                  },
                  {
                    id: "applications",
                    header: "Applications",
                    cell: e => (
                      <span>{e.applications}</span>
                    )
                  },
                  {
                    id: "cases",
                    header: "Cases",
                    cell: e => (
                      <span>{e.cases}</span>
                    )
                  },
                  {
                    id: "actions",
                    header: "Actions",
                    cell: item => (
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button
                          variant="inline-link"
                          ariaLabel={`Modify ${item.full_name}`}
                          href={`/modify-ptma/${item.id}`}
                        >
                          Modify
                        </Button>
                      </SpaceBetween>
                    ),
                    minWidth: 100
                  }
                ]}
                columnDisplay={[
                  { id: "full_name", visible: true },
                  { id: "code", visible: true },
                  { id: "province", visible: true },
                  { id: "alerts", visible: true },
                  { id: "applications", visible: true },
                  { id: "cases", visible: true },
                  { id: "actions", visible: true }
                ]}
                enableKeyboardNavigation
                items={hubs}
                loadingText="Loading resources"
                stripedRows
                trackBy="id"
                empty={
                  <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
                    <SpaceBetween size="m">
                      <b>No NWAC Hubs</b>
                      <Button onClick={handleNewHub}>Create NWAC Hub</Button>
                    </SpaceBetween>
                  </Box>
                }
                header={
                  <Header
                    variant="h2"
                    actions={
                      <SpaceBetween direction="horizontal" size="xs">
                        <ButtonDropdown
                          items={[
                            { text: "Delete", id: "delete", disabled: true },
                            { text: "Deactivate", id: "deactivate", disabled: true },
                            { text: "Suspend", id: "suspend", disabled: true }
                          ]}
                        >
                          Actions
                        </ButtonDropdown>
                        <Button variant="primary" onClick={handleNewHub}>New NWAC Hub</Button>
                      </SpaceBetween>
                    }
                  >
                  </Header>
                }
              />
            )}
          </BoardItem>
        )}
        items={items}
        onItemsChange={(event) => setItems(event.detail.items)}
        i18nStrings={{
          liveAnnouncementDndStarted: (operationType) =>
            operationType === 'resize' ? 'Resizing' : 'Dragging',
          liveAnnouncementDndItemReordered: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item moved to ${
              operation.direction === 'horizontal' ? columns : rows
            }.`;
          },
          liveAnnouncementDndItemResized: (operation) => {
            const columnsConstraint = operation.isMinimalColumnsReached
              ? ' (minimal)'
              : '';
            const rowsConstraint = operation.isMinimalRowsReached
              ? ' (minimal)'
              : '';
            const sizeAnnouncement =
              operation.direction === 'horizontal'
                ? `columns ${operation.placement.width}${columnsConstraint}`
                : `rows ${operation.placement.height}${rowsConstraint}`;
            return `Item resized to ${sizeAnnouncement}.`;
          },
          liveAnnouncementDndItemInserted: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item inserted to ${columns}, ${rows}.`;
          },
          liveAnnouncementDndCommitted: (operationType) =>
            `${operationType} committed`,
          liveAnnouncementDndDiscarded: (operationType) =>
            `${operationType} discarded`,
          liveAnnouncementItemRemoved: (op) =>
            `Removed item ${op.item.data.title}.`,
          navigationAriaLabel: 'Board navigation',
          navigationAriaDescription:
            'Click on non-empty item to move focus over',
          navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty'),
        }}
      />
      <Flashbar items={flashMessages} />
    </ContentLayout>
  );
};

export default NWACHubManagementDashboard;
