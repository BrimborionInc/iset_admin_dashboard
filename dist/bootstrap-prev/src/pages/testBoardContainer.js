import React, { useState } from 'react';
import { Board } from '@cloudscape-design/board-components';
import TestBoardItem1 from '../components/testBoardItem1';
import TestBoardItem2 from '../components/testBoardItem2';
import GeneralInformation from '../components/GeneralInformation'; // Import GeneralInformation

const TestBoardContainer = () => {
  const [items, setItems] = useState([
    {
      id: 'test-board-item-1',
      rowSpan: 2,
      columnSpan: 2,
      data: { title: 'Test Board Item 1' },
    },
    {
      id: 'test-board-item-2',
      rowSpan: 2,
      columnSpan: 2,
      data: { title: 'Test Board Item 2' },
    },
    {
      id: 'general-information',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'General Information' },
    },
  ]);

  return (
    <Board
      renderItem={(item) => {
        if (item.id === 'test-board-item-1') {
          return <TestBoardItem1 />;
        }
        if (item.id === 'test-board-item-2') {
          return <TestBoardItem2 />;
        }
        if (item.id === 'general-information') {
          return <GeneralInformation />;
        }
        return null;
      }}
      items={items}
      onItemsChange={(event) => setItems(event.detail.items)}
      i18nStrings={{
        liveAnnouncementDndStarted: (operationType) =>
          operationType === 'resize' ? 'Resizing' : 'Dragging',
        liveAnnouncementDndItemReordered: (operation) => {
          const columns = `column ${operation.placement.x + 1}`;
          const rows = `row ${operation.placement.y + 1}`;
          return `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`;
        },
        liveAnnouncementDndItemResized: (operation) => {
          const columnsConstraint = operation.isMinimalColumnsReached ? ' (minimal)' : '';
          const rowsConstraint = operation.isMinimalRowsReached ? ' (minimal)' : '';
          const sizeAnnouncement = operation.direction === 'horizontal'
            ? `columns ${operation.placement.width}${columnsConstraint}`
            : `rows ${operation.placement.height}${rowsConstraint}`;
          return `Item resized to ${sizeAnnouncement}.`;
        },
        liveAnnouncementDndItemInserted: (operation) => {
          const columns = `column ${operation.placement.x + 1}`;
          const rows = `row ${operation.placement.y + 1}`;
          return `Item inserted to ${columns}, ${rows}.`;
        },
        liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
        liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
        liveAnnouncementItemRemoved: (op) => `Removed item ${op.item.data.title}.`,
        navigationAriaLabel: 'Board navigation',
        navigationAriaDescription: 'Click on non-empty item to move focus over',
        navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty'),
      }}
    />
  );
};

export default TestBoardContainer;
