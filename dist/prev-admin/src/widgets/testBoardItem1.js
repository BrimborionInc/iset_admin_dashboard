import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, Button } from '@cloudscape-design/components';

const TestBoardItem1 = () => {
  return (
    <BoardItem
      i18nStrings={{
        dragHandleAriaLabel: "Drag handle",
        dragHandleAriaDescription: "Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.",
        resizeHandleAriaLabel: "Resize handle",
        resizeHandleAriaDescription: "Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard."
      }}
      header={
        <Header
          description="This is Test Board Item 1"
          actions={
            <Button variant="primary">Action 1</Button>
          }
        >
          Test Board Item 1
        </Header>
      }
    >
      Content for Test Board Item 1
    </BoardItem>
  );
};

export default TestBoardItem1;
