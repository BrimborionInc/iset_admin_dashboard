import React from 'react';
import { Box, Header, ButtonDropdown, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import CaseManagementDemoControlsHelp from '../helpPanelContents/CaseManagementDemoControlsHelp';

const CaseManagementDemoControlsWidget = ({ actions, toggleHelpPanel }) => {
  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel && toggleHelpPanel(<CaseManagementDemoControlsHelp />, "Testing and Demo Controls Help")}
            >
              Info
            </Link>
          }
        >
          Testing and Demo Controls
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      columnSpan={4}
      rowSpan={1}
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
        For testing and demo purposes only so you can change which evaluator is viweing this page, without logging out every time.  Will not be included in the actual solution
      </Box>
    </BoardItem>
  );
};

export default CaseManagementDemoControlsWidget;
