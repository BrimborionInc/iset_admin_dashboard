import React, { useState, useEffect } from 'react';
import { Box, Header, Button, SpaceBetween, Table, TextFilter, ButtonDropdown, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useHistory } from 'react-router-dom';

const BlockStepLibrary = ({ actions, setSelectedBlockStep }) => { // Add setSelectedBlockStep to props
  const [blockSteps, setBlockSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteringText, setFilteringText] = useState('');
  const history = useHistory();

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/blocksteps`)
      .then(response => response.json())
      .then(data => {
        setBlockSteps(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching block steps:', error);
        setLoading(false);
      });
  }, []);

  const handleModify = (blockStep) => {
    history.push(`/modify-component/${blockStep.id}`);
  };

  const handleDelete = async (blockStep) => {
    if (window.confirm(`Are you sure you want to delete BlockStep "${blockStep.name}"?`)) {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/blocksteps/${blockStep.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setBlockSteps(prev => prev.filter(item => item.id !== blockStep.id));
          alert('BlockStep deleted successfully.');
        } else {
          const error = await response.json();
          alert(`Failed to delete BlockStep: ${error.message}`);
        }
      } catch (error) {
        console.error('Error deleting BlockStep:', error);
        alert('An error occurred while deleting the BlockStep.');
      }
    }
  };

  const handleSelect = (blockStep) => {
    console.log("Selected BlockStep:", blockStep); // Debugging output
    setSelectedBlockStep(blockStep); // Use setSelectedBlockStep from props
  };

  const handleCreateNew = () => {
    history.push('/modify-component/new');
  };

  return (
    <BoardItem
      header={
        <Header
          description="Manage and modify the WCAG frontend blocks that are used to assemble intake workflows."
          actions={
            <Button
              iconAlign="right"
              onClick={handleCreateNew} // Add onClick handler
            >
              Create New
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
          items={blockSteps.filter(item => item.name.toLowerCase().includes(filteringText.toLowerCase()))}
          loading={loading}
          loadingText="Loading resources"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              <SpaceBetween size="m">
                <b>No resources</b>
                <Button>Create resource</Button>
              </SpaceBetween>
            </Box>
          }
          filter={
            <TextFilter
              filteringPlaceholder="Find intake step"
              filteringText={filteringText}
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              countText={`${blockSteps.length} matches`}
            />
          }
        />
      </Box>
    </BoardItem>
  );
};

export default BlockStepLibrary;
