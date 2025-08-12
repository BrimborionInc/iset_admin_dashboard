import React, { useState, useEffect } from 'react';
import { Box, Header, Button, SpaceBetween, Table, TextFilter, ButtonDropdown, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useHistory } from 'react-router-dom';

const IntakeStepTableWidget = ({ actions, setSelectedBlockStep }) => {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteringText, setFilteringText] = useState('');
  const history = useHistory();

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/steps`)
      .then(response => response.json())
      .then(data => {
        setSteps(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching steps:', error);
        setLoading(false);
      });
  }, []);

  const handleModify = (step) => {
    history.push(`/modify-component/${step.id}`);
  };

  const handleDelete = async (step) => {
    if (window.confirm(`Delete intake step "${step.name}"? This cannot be undone.`)) {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/steps/${step.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setSteps(prev => prev.filter(item => item.id !== step.id));
          alert('Step deleted.');
        } else {
          const error = await response.json().catch(() => ({}));
          alert(`Failed to delete step: ${error.error || error.message || response.status}`);
        }
      } catch (error) {
        console.error('Error deleting step:', error);
        alert('An error occurred while deleting the step.');
      }
    }
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
                  <Button variant="inline-link" onClick={() => handleDelete(item)}>Delete</Button>
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
      </Box>
    </BoardItem>
  );
};

export default IntakeStepTableWidget;
