import React from 'react';
import { Box, Header, ButtonDropdown, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const WorkflowPreviewWidget = ({ selectedWorkflow, actions, toggleHelpPanel, HelpContent }) => {
  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel && HelpContent && toggleHelpPanel(<HelpContent />, 'Workflow Preview Help')}
            >
              Info
            </Link>
          }
        >
          Workflow Preview
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
        {selectedWorkflow ? (
          <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{selectedWorkflow.name}</div>
        ) : (
          <div style={{ color: '#888' }}>Select a workflow to preview</div>
        )}
      </Box>
    </BoardItem>
  );
};

export default WorkflowPreviewWidget;
