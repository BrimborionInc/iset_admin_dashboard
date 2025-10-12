import React from 'react';
import { Box, Header, ButtonDropdown, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const BlankTemplate = ({ actions, toggleHelpPanel, HelpContent }) => {
  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel && HelpContent && toggleHelpPanel(<HelpContent />, 'Blank Template Help')}
            >
              Info
            </Link>
          }
        >
          Blank Template
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
        {/* Add content for the widget here */}
      </Box>
    </BoardItem>
  );
};

export default BlankTemplate;
