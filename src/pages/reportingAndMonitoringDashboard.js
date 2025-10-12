import React, { useState, useEffect, useContext } from 'react';
import {
  ContentLayout,
  Header,
  SpaceBetween
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import BlankTemplate from '../widgets/blankTemplate';
import SlaPerformanceOverview from '../widgets/SlaPerformanceOverview'; // Import the new widget
import ServiceStandard1 from '../widgets/SS1'; // Corrected import path
import LocationSelector from '../context/LocationSelector'; // Corrected import path
import { LocationProvider, LocationContext } from '../context/LocationContext'; // Corrected import path

import SS1 from '../widgets/SS1'; // Import the new widget
import SS2 from '../widgets/SS2'; // Import the new widget
import SS3 from '../widgets/SS3'; // Import the new widget
import ST6 from '../widgets/ST6'; // Import the new widget
import ST7 from '../widgets/ST7'; // Import the new widget
import ST3 from '../widgets/ST3'; // Import the new widget
import ST2 from '../widgets/ST2'; // Import the new widget
import ST8 from '../widgets/ST8'; // Import the new widget

const initialBoardItems = [
  {
    id: 'ss1',
    rowSpan: 3,
    columnSpan: 2,
    data: { title: 'Service Standard 1', description: 'Biometric Appointment Availability', serviceStandard: 'SS1' },
  },
  {
    id: 'ss2',
    rowSpan: 3,
    columnSpan: 2,
    data: { title: 'Service Standard 2', description: 'Biometric Appointment Punctuality', serviceStandard: 'SS2' },
  },
  {
    id: 'ss3',
    rowSpan: 3,
    columnSpan: 2,
    data: { title: 'Service Standard 3', description: 'Biometric Delivery in Language of Choice', serviceStandard: 'SS3' },
  },
  {
    id: 'st6',
    rowSpan: 3,
    columnSpan: 2,
    data: { title: 'Service Target 6', description: 'Appointment Punctuality', serviceStandard: 'ST6' },
  },
  {
    id: 'st7',
    rowSpan: 3,
    columnSpan: 2,
    data: { title: 'Service Target 7', description: 'Walk-In Services Timeliness', serviceStandard: 'ST7' },
  },
  {
    id: 'st3',
    rowSpan: 3,
    columnSpan: 2,
    data: { title: 'Service Target 3', description: 'Package Transmission Timeliness', serviceStandard: 'ST3' },
  },
  {
    id: 'st2',
    rowSpan: 3,
    columnSpan: 2,
    data: { title: 'Service Target 2', description: 'Timely Package Scan Out', serviceStandard: 'ST2' },
  },
  {
    id: 'st8',
    rowSpan: 3,
    columnSpan: 2,
    data: { title: 'Service Target 8', description: 'Client Satisfaction Survey Score', serviceStandard: 'ST8' },
  },
];

const initialPaletteItems = [
  { id: 'sla-performance-overview', data: { title: 'SLA Performance Overview', description: 'Service Level Agreement Performance Overview', serviceStandard: 'SLA' } },
  { id: 'st6', data: { title: 'Service Target 6', description: 'Appointment Punctuality', serviceStandard: 'ST6' } },
  { id: 'st7', data: { title: 'Service Target 7', description: 'Walk-In Services Timeliness', serviceStandard: 'ST7' } },
  { id: 'st3', data: { title: 'Service Target 3', description: 'Package Transmission Timeliness', serviceStandard: 'ST3' } },
  { id: 'st2', data: { title: 'Service Target 2', description: 'Timely Package Scan Out', serviceStandard: 'ST2' } },
  { id: 'st8', data: { title: 'Service Target 8', description: 'Client Satisfaction Survey Score', serviceStandard: 'ST8' } },
  { id: 'ss1', data: { title: 'Service Standard 1', description: 'Biometric Appointment Availability', serviceStandard: 'SS1' } },
  { id: 'ss2', data: { title: 'Service Standard 2', description: 'Biometric Appointment Punctuality', serviceStandard: 'SS2' } },
  { id: 'ss3', data: { title: 'Service Standard 3', description: 'Biometric Delivery in Language of Choice', serviceStandard: 'SS3' } },
];

const ReportingAndMonitoringDashboard = ({ header, headerInfo, toggleHelpPanel, updateBreadcrumbs, setSplitPanelOpen, setAvailableItems }) => {
  const { selectedLocations, setSelectedLocations, locations } = useContext(LocationContext); // Use LocationContext

  const [boardItems, setBoardItems] = useState(initialBoardItems); // Widgets on the board
  const [, setAvailableItemsState] = useState(initialPaletteItems); // Widgets in the palette

  useEffect(() => {
    updateBreadcrumbs([
      { text: 'Home', href: '/' },
      { text: 'Reporting and Monitoring', href: '/reporting-and-monitoring-dashboard' },
    ]);

    // Default to the first country if no locations are selected
    if (selectedLocations.length === 0 && locations.length > 0) {
      const firstCountry = locations[0].options ? locations[0].options[0] : locations[0];
      setSelectedLocations([firstCountry]);
    }

    // Filter available items based on current board items
    const filteredAvailableItems = initialPaletteItems.filter(
      item => !boardItems.some(boardItem => boardItem.id === item.id)
    );
    setAvailableItems(filteredAvailableItems); // Sync available items with parent state
    setAvailableItemsState(filteredAvailableItems); // Sync available items with local state
  }, [updateBreadcrumbs, selectedLocations, setSelectedLocations, locations, boardItems, setAvailableItems]);

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
      setSplitPanelOpen(true); // Ensure the split panel opens
    }
  };

  const handleToggleHelpPanel = (content, title) => {
    toggleHelpPanel(content, title);
  };

  return (
    <LocationProvider>
      <ContentLayout
        header={
          <Header variant="h1" info={headerInfo}>
            {header}
          </Header>
        }
      >
        <SpaceBetween size="l">
          <LocationSelector />
          <Board
            renderItem={(item, actions) => {
              if (item.id === 'blank-template') {
                return <BlankTemplate actions={actions} />;
              }
              if (item.id === 'sla-performance-overview') {
                return <SlaPerformanceOverview actions={actions} />;
              }
              if (item.id === 'service-standard-1') {
                return <ServiceStandard1 actions={{ ...actions, removeItem: () => handleRemoveBoardItem(item.id) }} toggleHelpPanel={handleToggleHelpPanel} />;
              }
              if (item.id === 'ss1') {
                return <SS1 actions={{ ...actions, removeItem: () => handleRemoveBoardItem(item.id) }} toggleHelpPanel={handleToggleHelpPanel} />;
              }
              if (item.id === 'ss2') {
                return <SS2 actions={{ ...actions, removeItem: () => handleRemoveBoardItem(item.id) }} toggleHelpPanel={handleToggleHelpPanel} />;
              }
              if (item.id === 'ss3') {
                return <SS3 actions={{ ...actions, removeItem: () => handleRemoveBoardItem(item.id) }} toggleHelpPanel={handleToggleHelpPanel} />;
              }
              if (item.id === 'st6') {
                return <ST6 actions={{ ...actions, removeItem: () => handleRemoveBoardItem(item.id) }} toggleHelpPanel={handleToggleHelpPanel} />;
              }
              if (item.id === 'st7') {
                return <ST7 actions={{ ...actions, removeItem: () => handleRemoveBoardItem(item.id) }} toggleHelpPanel={handleToggleHelpPanel} />;
              }
              if (item.id === 'st3') {
                return <ST3 actions={{ ...actions, removeItem: () => handleRemoveBoardItem(item.id) }} toggleHelpPanel={handleToggleHelpPanel} />;
              }
              if (item.id === 'st2') {
                return <ST2 actions={{ ...actions, removeItem: () => handleRemoveBoardItem(item.id) }} toggleHelpPanel={handleToggleHelpPanel} />;
              }
              if (item.id === 'st8') {
                return <ST8 actions={{ ...actions, removeItem: () => handleRemoveBoardItem(item.id) }} toggleHelpPanel={handleToggleHelpPanel} />;
              }
              // Render other items here if needed
              return null;
            }}
            items={boardItems}
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
              } else {
                const removedItem = boardItems.find(item => !event.detail.items.some(bItem => bItem.id === item.id));
                if (removedItem) {
                  setAvailableItemsState((prev) => {
                    const newAvailableItems = [...prev, { id: removedItem.id, data: removedItem.data }];
                    console.log("Available Items after removing:", newAvailableItems);
                    return newAvailableItems;
                  });
                }
              }
            }}
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
        </SpaceBetween>
      </ContentLayout>
    </LocationProvider>
  );
};

export default ReportingAndMonitoringDashboard;
