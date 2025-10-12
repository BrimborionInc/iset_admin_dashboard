import React, { useState, useEffect } from "react";
import { Board, BoardItem } from "@cloudscape-design/board-components";
import { Box, Header, Button, ButtonDropdown } from "@cloudscape-design/components";

const initialBoardItems = [
  { id: "1", data: { title: "Widget A", description: "This is Widget A" }, rowSpan: 2, columnSpan: 4 },
  { id: "2", data: { title: "Widget B", description: "This is Widget B" }, rowSpan: 2, columnSpan: 4 },
];

const initialPaletteItems = [
  { id: "3", data: { title: "Widget C", description: "This is Widget C" } },
];

const TestConfigDashboard = ({ setSplitPanelOpen, setAvailableItems }) => {
  const [boardItems, setBoardItems] = useState(initialBoardItems); // Widgets on the board
  const [availableItems, setAvailableItemsState] = useState(initialPaletteItems); // Widgets in the palette

  useEffect(() => {
    setAvailableItems(availableItems); // Sync available items with parent state
  }, [availableItems, setAvailableItems]);

  // Move an item from the palette to the board
  const handleAddItemToBoard = (item) => {
    setBoardItems((prev) => {
      const newBoardItems = [...prev, { ...item, rowSpan: 2, columnSpan: 4 }];
      console.log("Board Items after adding:", newBoardItems);
      return newBoardItems;
    });
    setAvailableItemsState((prev) => {
      const newAvailableItems = prev.filter((i) => i.id !== item.id);
      console.log("Available Items after adding:", newAvailableItems);
      return newAvailableItems;
    });
  };

  // Remove an item from the board back to the palette
  const handleRemoveBoardItem = (id) => {
    const removedItem = boardItems.find((item) => item.id === id);
    if (removedItem) {
      setAvailableItemsState((prev) => {
        const newAvailableItems = [...prev, { id: removedItem.id, data: removedItem.data }];
        console.log("Available Items after removing:", newAvailableItems);
        return newAvailableItems;
      });
      setBoardItems((prev) => {
        const newBoardItems = prev.filter((item) => item.id !== id);
        console.log("Board Items after removing:", newBoardItems);
        return newBoardItems;
      });
      setSplitPanelOpen(true); // Open the split panel
    }
  };

  return (
    <Box padding="m">
      {/* Board - Displays widgets added from the palette */}
      <Board
        items={boardItems}
        renderItem={(boardItem) => (
          <BoardItem
            key={boardItem.id}
            header={
              <Header
                description="Board item description"
                actions={
                  <Button
                    iconAlign="right"
                    iconName="external"
                  >
                    View in console
                  </Button>
                }
              >
                {boardItem.data.title}
              </Header>
            }
            settings={
              <ButtonDropdown
                items={[{ id: "remove", text: "Remove" }]}
                ariaLabel="Board item settings"
                variant="icon"
                expandToViewport
                onItemClick={({ detail }) => {
                  if (detail.id === "remove") handleRemoveBoardItem(boardItem.id);
                }}
              />
            }
            i18nStrings={{
              dragHandleAriaLabel: "Drag handle",
              dragHandleAriaDescription:
                "Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.",
              resizeHandleAriaLabel: "Resize handle",
              resizeHandleAriaDescription:
                "Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard."
            }}
          >
            <Box padding="m">
              <p>{boardItem.data.description}</p>
            </Box>
          </BoardItem>
        )}
        onItemsChange={(event) => {
          console.log("Board Items changed:", event.detail.items);
          setBoardItems(event.detail.items);
          const addedItem = event.detail.items.find(item => !boardItems.some(bItem => bItem.id === item.id));
          if (addedItem) {
            setAvailableItemsState((prev) => {
              const newAvailableItems = prev.filter((i) => i.id !== addedItem.id);
              console.log("Available Items after adding:", newAvailableItems);
              return newAvailableItems;
            });
          }
        }}
        i18nStrings={{
          liveAnnouncementDndStarted: (operationType) =>
            operationType === "resize" ? "Resizing" : "Dragging",
          liveAnnouncementDndItemReordered: (operation) =>
            `Item moved to column ${operation.placement.x + 1}, row ${operation.placement.y + 1}.`,
          liveAnnouncementDndItemResized: (operation) =>
            `Item resized to columns ${operation.placement.width}, rows ${operation.placement.height}.`,
          liveAnnouncementDndItemInserted: (operation) =>
            `Item inserted to column ${operation.placement.x + 1}, row ${operation.placement.y + 1}.`,
          liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
          liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
          liveAnnouncementItemRemoved: (op) => `Removed item ${op.item.data.title}.`,
          navigationAriaLabel: "Board navigation",
          navigationAriaDescription: "Click on non-empty item to move focus over",
          navigationItemAriaLabel: (item) => (item ? item.data.title : "Empty")
        }}
      />
    </Box>
  );
};

export default TestConfigDashboard;
