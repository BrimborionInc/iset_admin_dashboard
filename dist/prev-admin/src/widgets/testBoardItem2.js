import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, Button } from '@cloudscape-design/components';

const TestBoardItem2 = () => {
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
          description="This is Test Board Item 2"
          actions={
            <Button variant="primary">Action 2</Button>
          }
        >
          Test Board Item 2
        </Header>
      }
    >
      Content for Test Board Item 2
    </BoardItem>
  );
};

export default TestBoardItem2;
