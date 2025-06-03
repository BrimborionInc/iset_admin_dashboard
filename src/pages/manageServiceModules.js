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
} from '@cloudscape-design/components';
import { useHistory } from 'react-router-dom';

const ServiceModulesManagementDashboard = ({ header, headerInfo, toggleHelpPanel }) => {
  const history = useHistory();
  const [selectedItems, setSelectedItems] = useState([]);
  const [serviceModules, setServiceModules] = useState([]);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState(null);
  const [flashMessages, setFlashMessages] = useState([]);

  const fetchServiceModules = () => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/service-modules`)
      .then(response => response.json())
      .then(data => {
        setServiceModules(data);
      })
      .catch(error => console.error('Error fetching service modules:', error));
  };

  useEffect(() => {
    fetchServiceModules();
  }, []);

  const handleNewModule = () => {
    history.push('/new-service-module');
  };

  const handleDeleteClick = (module) => {
    setModuleToDelete(module);
    setIsDeleteModalVisible(true);
  };

  const handleDeleteConfirm = () => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/service-modules/${moduleToDelete.id}`, {
      method: 'DELETE',
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setFlashMessages([{ type: 'success', content: 'Service module deleted successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        fetchServiceModules();
        setIsDeleteModalVisible(false);
        setModuleToDelete(null);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error deleting service module', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error deleting service module:', error);
        setIsDeleteModalVisible(false);
        setModuleToDelete(null);
      });
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalVisible(false);
    setModuleToDelete(null);
  };

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={headerInfo}>
          {header}
        </Header>
      }
    >
      <Table
        renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
          `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
        }
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        selectedItems={selectedItems}
        variant="embedded"
        ariaLabels={{
          selectionGroupLabel: "Items selection",
          allItemsSelectionLabel: () => "select all",
          itemSelectionLabel: ({ selectedItems }, item) => item.name,
        }}
        columnDefinitions={[
          { id: "name", header: "Name", cell: e => e.name, sortingField: "name", isRowHeader: true },
          { id: "description", header: "Description", cell: e => e.description },
          { id: "status", header: "Status", cell: e => e.status },
          {
            id: "actions",
            header: "Actions",
            cell: item => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="inline-link"
                  ariaLabel={`Modify ${item.name}`}
                  href={`/modify-service-module/${item.id}`}
                >
                  Modify
                </Button>
                <Button
                  variant="inline-link"
                  ariaLabel={`Delete ${item.name}`}
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
          { id: "name", visible: true },
          { id: "description", visible: true },
          { id: "status", visible: true },
          { id: "actions", visible: true }
        ]}
        enableKeyboardNavigation
        items={serviceModules}
        loadingText="Loading resources"
        selectionType="multi"
        stripedRows
        trackBy="id"
        empty={
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No resources</b>
              <Button onClick={handleNewModule}>Create resource</Button>
            </SpaceBetween>
          </Box>
        }
        header={
          <Header
            variant="h2"
            counter={selectedItems.length ? `(${selectedItems.length}/10)` : "(10)"}
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
                <Button variant="primary" onClick={handleNewModule}>New Service Module</Button>
              </SpaceBetween>
            }
          >
            Service Modules
          </Header>
        }
        pagination={<Pagination currentPageIndex={1} pagesCount={2} />}
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={{
              pageSize: 10,
              contentDisplay: [
                { id: "name", visible: true },
                { id: "description", visible: true },
                { id: "status", visible: true }
              ]
            }}
            pageSizePreference={{
              title: "Page size",
              options: [
                { value: 10, label: "10 resources" },
                { value: 20, label: "20 resources" }
              ]
            }}
            wrapLinesPreference={{}}
            stripedRowsPreference={{}}
            contentDensityPreference={{}}
            contentDisplayPreference={{
              options: [
                { id: "name", label: "Name", alwaysVisible: true },
                { id: "description", label: "Description" },
                { id: "status", label: "Status" }
              ]
            }}
            stickyColumnsPreference={{
              firstColumns: {
                title: "Stick first column(s)",
                description: "Keep the first column(s) visible while horizontally scrolling the table content.",
                options: [
                  { label: "None", value: 0 },
                  { label: "First column", value: 1 },
                  { label: "First two columns", value: 2 }
                ]
              },
              lastColumns: {
                title: "Stick last column",
                description: "Keep the last column visible while horizontally scrolling the table content.",
                options: [
                  { label: "None", value: 0 },
                  { label: "Last column", value: 1 }
                ]
              }
            }}
          />
        }
      />
      <Modal
        visible={isDeleteModalVisible}
        onDismiss={handleDeleteCancel}
        header="Delete Service Module"
        footer={
          <SpaceBetween direction="horizontal" size="s">
            <Button variant="link" onClick={handleDeleteCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleDeleteConfirm}>Delete</Button>
          </SpaceBetween>
        }
      >
        <p>Are you sure you want to delete the service module <strong>{moduleToDelete?.name}</strong>? This action cannot be undone.</p>
      </Modal>
      <Flashbar items={flashMessages} />
    </ContentLayout>
  );
};

export default ServiceModulesManagementDashboard;
