import React from 'react';
import { SplitPanel, Box, Header } from '@cloudscape-design/components';
import { ItemsPalette, BoardItem } from '@cloudscape-design/board-components';
import ChartImage from '../assets/images/chart-placeholder.png'; // Import a generic chart image

const CustomSplitPanel = ({ availableItems, handleItemSelect, splitPanelSize, setSplitPanelSize, splitPanelOpen, setSplitPanelOpen }) => {
    return (
    <SplitPanel
      header="Available Widgets"
      closeBehavior="hide"
      hidePreferencesButton={true}
      size={splitPanelSize}
      onResize={({ detail }) => setSplitPanelSize(detail.size)}
      open={splitPanelOpen}
      onDismiss={() => setSplitPanelOpen(false)}
      i18nStrings={{
        closeButtonAriaLabel: "Close panel",
        openButtonAriaLabel: "Open panel",
        preferencesTitle: "Preferences",
      }}
    >
      <ItemsPalette
        items={availableItems}
        onItemSelect={({ detail }) => {
                    try {
            const id = detail && detail.item && detail.item.id;
            if (id) window.dispatchEvent(new CustomEvent('palette:add', { detail: { id } }));
          } catch (err) {
                      }
          if (handleItemSelect) handleItemSelect(detail.item);
        }}
        i18nStrings={{ header: "Available Widgets" }}
        renderItem={(item) => (
          <BoardItem
            key={item.id}
            header={<Header>{item.data.title}</Header>}
            i18nStrings={{
              dragHandleAriaLabel: "Drag handle",
              dragHandleAriaDescription:
                "Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.",
            }}
          >
            <Box padding="m" display="flex" alignItems="center">
              {/* Icon (Left-aligned) */}
              <img 
                src={ChartImage} 
                alt="Chart" 
                style={{ width: '50px', height: 'auto', marginRight: '10px', flexShrink: 0 }} 
              />

              {/* Description Text (Right of Icon) */}
              <Box flexGrow={1}>
                <p>{item.data.description}</p>
              </Box>
            </Box>

          </BoardItem>
        )}
      />
    </SplitPanel>
  );
};

export default CustomSplitPanel;

