import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Table,
  Box,
  SpaceBetween,
  Button,
  Header,
  ButtonDropdown,
  Pagination,
  CollectionPreferences,
  Link,
  Modal,
  Flashbar,
  StatusIndicator,
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import BoardItem from '@cloudscape-design/board-components/board-item';
import { useHistory } from 'react-router-dom';
import { apiFetch } from '../auth/apiClient';

const PTMAManagementDashboard = ({ header, headerInfo, toggleHelpPanel }) => {
  const history = useHistory();
  const [selectedItems, setSelectedItems] = useState([]);
  const [ptmas, setPtmas] = useState([]);
  const [items, setItems] = useState([
    {
      id: 'locations-table',
      rowSpan: 7,
      columnSpan: 4,
      data: { title: 'Locations Table', content: null },
      dragHandleAriaLabel: 'Drag handle',
      resizeHandleAriaLabel: 'Resize handle'
    }
  ]);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState(null);
  const [deleteWarning, setDeleteWarning] = useState('');
  const [flashMessages, setFlashMessages] = useState([]); // Define flashMessages state

  const fetchPtmas = () => {
    apiFetch(`/api/ptmas?type=PTMA`)
      .then(response => response.json())
      .then(data => setPtmas(data))
      .catch(error => console.error('Error fetching PTMAs:', error));
  };

  useEffect(() => {
    fetchPtmas();
  }, []);

  const handleNewPtma = () => {
    history.push('/new-ptma');
  };

  const handleDeleteClick = (ptma) => {
    // If you have a check-booked-slots endpoint for PTMA, update here. Otherwise, skip this check or implement as needed.
    setLocationToDelete(ptma);
    setIsDeleteModalVisible(true);
  };

  const handleDeleteConfirm = () => {
    apiFetch(`/api/ptmas/${locationToDelete.id}`, {
      method: 'DELETE',
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setFlashMessages([{ type: 'success', content: 'PTMA deleted successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        fetchPtmas(); // Refresh the PTMAs list
        setIsDeleteModalVisible(false);
        setLocationToDelete(null);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error deleting PTMA', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error deleting PTMA:', error);
        setIsDeleteModalVisible(false);
        setLocationToDelete(null);
      });
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalVisible(false);
    setLocationToDelete(null);
  };

  return (
    <ContentLayout
    >
      <Board
        renderItem={(item) => (
          <BoardItem
            key={item.id}
            {...item}
            header={
              <Header variant="h2" info={<Link variant="info" onClick={() => toggleHelpPanel(item.id)}>Info</Link>}>
                {item.data.title.replace('Locations', 'PTMAs').replace('Location', 'PTMA')}
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
            {item.id === 'locations-table' && (
              <Table
                renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
                  `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
                }
                selectedItems={selectedItems}
                variant="embedded"
                ariaLabels={{
                  selectionGroupLabel: "Items selection",
                  allItemsSelectionLabel: () => "select all",
                  itemSelectionLabel: ({ selectedItems }, item) => item.full_name,
                }}
                columnDefinitions={[
                  {
                    id: "full_name",
                    header: "PTMA Name",
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
                    id: "indigenous_group",
                    header: "Type",
                    cell: e => e.indigenous_group,
                    sortingField: "indigenous_group"
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
                        <Button
                          variant="inline-link"
                          ariaLabel={`Delete ${item.full_name}`}
                          onClick={() => handleDeleteClick(item)}
                        >
                          Delete
                        </Button>
                      </SpaceBetween>
                    ),
                    minWidth: 170
                  }
                ]}
                columnDisplay={[
                  { id: "full_name", visible: true },
                  { id: "code", visible: true },
                  { id: "indigenous_group", visible: true },
                  { id: "alerts", visible: true },
                  { id: "applications", visible: true },
                  { id: "cases", visible: true },
                  { id: "actions", visible: true }
                ]}
                enableKeyboardNavigation
                items={ptmas}
                loadingText="Loading resources"
                stripedRows
                trackBy="id"
                empty={
                  <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
                    <SpaceBetween size="m">
                      <b>No PTMAs</b>
                      <Button onClick={handleNewPtma}>Create PTMA</Button>
                    </SpaceBetween>
                  </Box>
                }
                header={
                  <Header
                    variant="h2"
                    counter={selectedItems.length ? `(${selectedItems.length}/10)` : "(17)"}
                    actions={
                      <SpaceBetween direction="horizontal" size="xs">
                        <ButtonDropdown
                          items={[
                            { text: "Delete", id: "delete", disabled: false },
                            { text: "Deactivate", id: "deactivate", disabled: false },
                            { text: "Suspend", id: "suspend", disabled: false }
                          ]}
                        >
                          Actions
                        </ButtonDropdown>
                        <Button variant="primary" onClick={handleNewPtma}>New PTMA</Button>
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
      <Modal
        visible={isDeleteModalVisible}
        onDismiss={handleDeleteCancel}
        header="Delete PTMA"
        footer={
          <SpaceBetween direction="horizontal" size="s">
            <Button variant="link" onClick={handleDeleteCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleDeleteConfirm} disabled={!!deleteWarning}>Delete</Button>
          </SpaceBetween>
        }
      >
        <p>Are you sure you want to delete the PTMA <strong>{locationToDelete?.location}</strong>? This action cannot be undone.</p>
        <p>Deleting this PTMA will remove all associated configuration information. If there are any booked appointment slots, you will need to remove them first.</p>
        {deleteWarning && <p style={{ color: 'red' }}>{deleteWarning}</p>}
      </Modal>
      <Flashbar items={flashMessages} />
    </ContentLayout>
  );
};

export default PTMAManagementDashboard;
