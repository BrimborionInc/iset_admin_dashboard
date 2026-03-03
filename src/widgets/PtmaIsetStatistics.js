import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Box, Header, StatusIndicator } from '@cloudscape-design/components';

const PtmaIsetStatistics = () => {
  return (
    <BoardItem
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.'
      }}
      header={<Header>Location Statistics</Header>}
    >
      <Box>
        <StatusIndicator type="info">Live location statistics are not available yet.</StatusIndicator>
      </Box>
    </BoardItem>
  );
};

export default PtmaIsetStatistics;
