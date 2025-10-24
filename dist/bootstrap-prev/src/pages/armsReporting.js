import React from 'react';
import { ContentLayout, Button, SpaceBetween } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import BoardItem from '@cloudscape-design/board-components/board-item';

const boardI18nStrings = {
  liveAnnouncementDndStarted: (position, title) => `Picked up item at position ${position + 1}${title ? `, titled ${title}` : ''}.`,
  liveAnnouncementDndItemReordered: (initialPosition, currentPosition, title) => {
    if (initialPosition === currentPosition) {
      return `Item is back to its starting position${title ? `, titled ${title}` : ''}.`;
    }
    return `Item moved from position ${initialPosition + 1} to position ${currentPosition + 1}${title ? `, titled ${title}` : ''}.`;
  },
  liveAnnouncementDndItemCommitted: (initialPosition, currentPosition, title) => {
    if (initialPosition === currentPosition) {
      return `Item was dropped and is back to its starting position${title ? `, titled ${title}` : ''}.`;
    }
    return `Item was dropped at position ${currentPosition + 1}${title ? `, titled ${title}` : ''}.`;
  },
  liveAnnouncementDndDisallowed: () => 'Move not allowed',
  liveAnnouncementItemRemoved: (position, title) => `Removed item at position ${position + 1}${title ? `, titled ${title}` : ''}.`,
  liveAnnouncementItemAdded: (position, title) => `Added item at position ${position + 1}${title ? `, titled ${title}` : ''}.`,
  navigationAriaLabel: 'Board navigation',
  navigationAriaDescription: 'Use arrow keys to navigate between items.'
};

const boardItemI18nStrings = {
  dragHandleAriaLabel: 'Drag handle',
  resizeHandleAriaLabel: 'Resize handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop, or Escape to cancel.',
  resizeHandleAriaDescription: 'Use arrow keys to resize the item.'
};

const ArmsReportingDashboard = () => {
  return (
    <ContentLayout>
      <Board
        items={[
          {
            id: 'arms-reporting-placeholder',
            rowSpan: 7,
            columnSpan: 4,
            data: { title: 'ARMS Reporting', content: null }
          }
        ]}
        i18nStrings={boardI18nStrings}
        renderItem={(item) => (
          <BoardItem
            key={item.id}
            header={<b>ARMS Reporting</b>}
            i18nStrings={boardItemI18nStrings}
            rowSpan={item.rowSpan}
            columnSpan={item.columnSpan}
          >
            <SpaceBetween size="m" direction="vertical">
              <div>ARMS Reporting placeholder content goes here.</div>
              <Button variant="primary">Update Arms</Button>
              <Button>View Reports</Button>
            </SpaceBetween>
          </BoardItem>
        )}
      />
    </ContentLayout>
  );
};

export default ArmsReportingDashboard;
