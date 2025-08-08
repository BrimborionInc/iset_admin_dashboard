import React, { useEffect, useState } from 'react';
import { Header, Box, ButtonDropdown, Table, StatusIndicator, Button, SpaceBetween } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const IsetEvaluatorsWidget = ({ ptmaId, actions = {} }) => {
  const [evaluators, setEvaluators] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ptmaId) return;
    setLoading(true);
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/ptmas/${ptmaId}/evaluators`)
      .then(response => response.json())
      .then(data => {
        setEvaluators(data);
        setLoading(false);
      })
      .catch(error => {
        setEvaluators([]);
        setLoading(false);
      });
  }, [ptmaId]);

  // Stub handlers for actions
  const handleAddEvaluator = () => {
    // TODO: Implement add evaluator logic/modal
    alert('Add Evaluator action');
  };

  const handleEditEvaluator = evaluator => {
    // TODO: Implement edit evaluator logic/modal
    alert(`Edit Evaluator: ${evaluator.name}`);
  };

  const handleRemoveEvaluator = evaluator => {
    // TODO: Implement remove evaluator logic/modal
    alert(`Remove Evaluator: ${evaluator.name}`);
  };

  return (
    <BoardItem
      header={<Header variant="h2">ISET Staff</Header>}
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
          onItemClick={() => actions.removeItem && actions.removeItem()}
        />
      }
    >
      {loading ? (
        <Box textAlign="center" color="inherit" padding="m">
          <StatusIndicator type="loading">Loading staff...</StatusIndicator>
        </Box>
      ) : evaluators.length === 0 ? (
        <Box textAlign="center" color="inherit" padding="m">
          <b>No staff to display.</b>
          <Box margin={{ top: "s" }}>
            <Button onClick={handleAddEvaluator}>Add Staff</Button>
          </Box>
        </Box>
      ) : (
        <Table
          columnDefinitions={[
            {
              id: 'name',
              header: 'Name',
              cell: e => e.name,
              sortingField: 'name'
            },
            {
              id: 'email',
              header: 'Email',
              cell: e => e.email,
              sortingField: 'email'
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: e => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="inline-link" onClick={() => handleEditEvaluator(e)}>
                    Edit
                  </Button>
                  <Button variant="inline-link" onClick={() => handleRemoveEvaluator(e)}>
                    Remove
                  </Button>
                </SpaceBetween>
              ),
              minWidth: 120
            }
          ]}
          items={evaluators}
          trackBy="id"
          variant="embedded"
          loadingText="Loading evaluators..."
          header={
            <Header
              actions={
                <Button onClick={handleAddEvaluator}>Add Staff Member</Button>
              }
            >
              Staff List
            </Header>
          }
        />
      )}
    </BoardItem>
  );
};

export default IsetEvaluatorsWidget;
