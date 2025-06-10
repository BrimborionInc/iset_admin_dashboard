import React, { useState, useEffect } from 'react';
import { Box, Header, ButtonDropdown, Link, Select } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import CaseManagementDemoControlsHelp from '../helpPanelContents/CaseManagementDemoControlsHelp';

const CaseManagementDemoControlsWidget = ({ actions, toggleHelpPanel, evaluators = [], simulatedUser, setSimulatedUser }) => {
  // Handle select change
  const handleUserChange = (event) => {
    const selectedId = event.detail.selectedOption.value;
    const user = evaluators.find(e => e.evaluator_id === selectedId);
    setSimulatedUser(user);
  };

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
      <Box margin={{ bottom: 's' }}>
        <b>Current simulated user:</b> {simulatedUser ? simulatedUser.evaluator_name : 'None'}
      </Box>
      <Select
        selectedOption={simulatedUser ? { label: simulatedUser.evaluator_name, value: simulatedUser.evaluator_id } : null}
        onChange={handleUserChange}
        options={evaluators.map(e => ({ label: e.evaluator_name, value: e.evaluator_id }))}
        placeholder="Select evaluator..."
        ariaLabel="Select evaluator"
        expandToViewport
      />
      <Box margin={{ top: 's' }}>
        For testing and demo purposes only so you can change which evaluator is viewing this page, without logging out every time. Will not be included in the actual solution
      </Box>
    </BoardItem>
  );
};

export default CaseManagementDemoControlsWidget;
