import React, { useState, useEffect } from 'react';
import { Box, Header, Button, SpaceBetween, Table, TextFilter, ButtonDropdown, Link, Modal, Alert } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useHistory } from 'react-router-dom';
import IntakeStepLibraryWidgetHelp from '../helpPanelContents/intakeStepLibraryWidgetHelp';

const IntakeStepTableWidget = ({ actions, setSelectedBlockStep, toggleHelpPanel }) => {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteringText, setFilteringText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [banner, setBanner] = useState(null); // { type: 'info'|'error', message }
  const history = useHistory();

  useEffect(() => {
    const apiBase = process.env.REACT_APP_API_BASE_URL || '';
    fetch(`${apiBase}/api/steps`)
      .then(async response => {
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || err.message || `HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        const list = Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : []);
        setSteps(list);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching steps:', error);
        setSteps([]);
        setLoading(false);
      });
  }, []);

  const handleModify = (step) => {
    history.push(`/modify-component/${step.id}`);
  };

  const openDeleteModal = (step) => {
    setPendingDelete(step);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const step = pendingDelete;
    if (!step) return;
    try {
      const apiBase = process.env.REACT_APP_API_BASE_URL || '';
      const response = await fetch(`${apiBase}/api/steps/${step.id}`, { method: 'DELETE' });
      if (response.ok) {
        setSteps(prev => prev.filter(item => item.id !== step.id));
        setBanner({ type: 'info', message: 'Step deleted.' });
      } else {
        const error = await response.json().catch(() => ({}));
        setBanner({ type: 'error', message: `Failed to delete step: ${error.error || error.message || response.status}` });
      }
    } catch (error) {
      console.error('Error deleting step:', error);
      setBanner({ type: 'error', message: 'An error occurred while deleting the step.' });
    } finally {
      setShowDeleteModal(false);
      setPendingDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setPendingDelete(null);
  };

  const handleSelect = (step) => {
    setSelectedBlockStep?.(step);
  };

  const handleCreateNew = () => {
    history.push('/modify-component/new');
  };

  return (
    <BoardItem
      header={
        <Header
          description="Manage and modify intake steps used in workflows."
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel && toggleHelpPanel(<IntakeStepLibraryWidgetHelp />, 'Intake Step Library', IntakeStepLibraryWidgetHelp.aiContext)}
            >
              Info
            </Link>
          }
          actions={
            <Button
              iconAlign="right"
              onClick={handleCreateNew} // Add onClick handler
            >
              Create New Step
            </Button>
          }
        >
          Intake Step Library
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions.removeItem()}
        />
      }
    >
      <Box>
        {banner && (
          <Alert
            type={banner.type}
            dismissible
            onDismiss={() => setBanner(null)}
            header={banner.type === 'error' ? 'Delete failed' : 'Step deleted'}
          >
            {banner.message}
          </Alert>
        )}
        <Table
          variant="embedded"
          renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
            `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
          }
          columnDefinitions={[
            {
              id: 'id',
              header: 'ID',
              cell: item => item.id,
              sortingField: 'id',
              isRowHeader: true
            },
            {
              id: 'name',
              header: 'Intake Step',
              cell: item => (
                <Link onClick={() => handleSelect(item)}>
                  {item.name}
                </Link>
              ),
              sortingField: 'name'
            },
            {
              id: 'status',
              header: 'Status',
              cell: item => item.status,
              sortingField: 'status'
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="inline-link" onClick={() => handleModify(item)}>Modify</Button>
                  <Button variant="inline-link" onClick={() => openDeleteModal(item)}>Delete</Button>
                </SpaceBetween>
              )
            }
          ]}
          items={steps.filter(item => item.name.toLowerCase().includes(filteringText.toLowerCase()))}
          loading={loading}
          loadingText="Loading resources"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              <SpaceBetween size="m">
                <b>No resources</b>
                <Button onClick={handleCreateNew}>Create step</Button>
              </SpaceBetween>
            </Box>
          }
          filter={
            <TextFilter
              filteringPlaceholder="Find intake step"
              filteringText={filteringText}
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              countText={`${steps.length} matches`}
            />
          }
        />

        <Modal
          visible={showDeleteModal}
          onDismiss={cancelDelete}
          closeAriaLabel="Close modal"
          header="Delete intake step?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={cancelDelete}>Cancel</Button>
              <Button variant="primary" onClick={confirmDelete}>Delete</Button>
            </SpaceBetween>
          }
        >
          {pendingDelete ? (
            <Box>
              Are you sure you want to delete "{pendingDelete.name}"? This cannot be undone.
            </Box>
          ) : null}
        </Modal>
      </Box>
    </BoardItem>
  );
};

export default IntakeStepTableWidget;
