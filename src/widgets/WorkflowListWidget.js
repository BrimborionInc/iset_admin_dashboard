import React, { useState } from 'react';
import { Box, Header, ButtonDropdown, Link, Table, Button, TextFilter, SpaceBetween } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const getColumnDefinitions = (onSelectWorkflow) => [
  {
    id: 'id',
    header: 'ID',
    cell: item => item.id,
    sortingField: 'id',
    isRowHeader: true
  },
  {
    id: 'name',
    header: 'Name',
    cell: item => (
      <Button variant="inline-link" onClick={() => onSelectWorkflow(item)}>{item.name}</Button>
    ),
    sortingField: 'name'
  },
  {
    id: 'lastModified',
    header: 'Last Modified',
    cell: item => item.lastModified,
    sortingField: 'lastModified'
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: item => (
      <SpaceBetween direction="horizontal" size="xs">
    <Button variant="inline-link" onClick={() => window.location.href = '/modify-workflow'}>Modify</Button>
        <Button variant="inline-link">Delete</Button>
        <Button variant="inline-link">Duplicate</Button>
      </SpaceBetween>
    )
  }
];

const mockData = [
  { id: 1, name: 'ISET', description: 'Indigenous Skills and Employment Training workflow', lastModified: '2025-08-01' },
  { id: 2, name: "Jordan's Principle", description: 'Child First Initiative workflow', lastModified: '2025-07-15' },
];

const WorkflowListWidget = ({ actions, onSelectWorkflow }) => {
  const [filteringText, setFilteringText] = useState('');

  return (
    <BoardItem
      header={
        <Header
          actions={
            <Button iconAlign="right">Create New</Button>
          }
        >
          Workflow List
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
          onItemClick={() => actions && actions.removeItem && actions.removeItem()}
        />
      }
    >
      <Box>
        <Table
          variant="embedded"
          stickyHeader
          renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
            `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
          }
          columnDefinitions={getColumnDefinitions(onSelectWorkflow)}
          items={mockData.filter(item => item.name.toLowerCase().includes(filteringText.toLowerCase()))}
          loading={false}
          loadingText="Loading resources"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              <SpaceBetween size="m">
                <b>No workflows</b>
                <Button>Create workflow</Button>
              </SpaceBetween>
            </Box>
          }
          filter={
            <TextFilter
              filteringPlaceholder="Find workflow"
              filteringText={filteringText}
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              countText={`${mockData.length} matches`}
            />
          }
        />
      </Box>
    </BoardItem>
  );
};

export default WorkflowListWidget;
