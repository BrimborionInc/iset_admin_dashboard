import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  Box,
  Button,
  SpaceBetween,
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import IntakeStepTableWidget from '../widgets/IntakeStepTableWidget'; // Import the renamed IntakeStepTableWidget
import PreviewIntakeStep from '../widgets/PreviewIntakeStep'; // Import the renamed PreviewIntakeStep
import PreviewNunjucks from '../widgets/PreviewNunjucks'; // Import the PreviewNunjucks widget
import IntakeStepLibraryWidgetHelp from '../helpPanelContents/intakeStepLibraryWidgetHelp';
import PreviewIntakeStepWidgetHelp from '../helpPanelContents/previewIntakeStepWidgetHelp';
import PreviewNunjucksWidgetHelp from '../helpPanelContents/previewNunjucksWidgetHelp';

const ManageIntakeSteps = ({ header, headerInfo, toggleHelpPanel, updateBreadcrumbs }) => { // Rename component
  const [selectedBlockStep, setSelectedBlockStep] = useState(null);

  // Keep board layout in state so drag/resize/remove persists while on this page.
  const STORAGE_KEY = 'manageSteps.board.items.v1';
  const initialItems = [
    { id: 'stepLibrary', rowSpan: 4, columnSpan: 2, data: { title: 'Intake Step Library' } },
    { id: 'previewStep', rowSpan: 4, columnSpan: 2, data: { title: 'Preview' } },
    { id: 'previewNunjucks', rowSpan: 6, columnSpan: 4, data: { title: 'Step JSON' } },
  ];
  const [items, setItems] = useState(initialItems);

  // Restore saved layout on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(i => i && typeof i.id === 'string')) {
          setItems(parsed);
        }
      }
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetLayout = () => {
    setItems(initialItems);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  };

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          info={headerInfo}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={resetLayout}>Reset layout</Button>
            </SpaceBetween>
          }
        >
          {header}
        </Header>
      }
    >
    <Board
      renderItem={(item, actions) => {
        switch (item.id) {
          case 'stepLibrary':
            return (
              <IntakeStepTableWidget
                actions={actions}
                setSelectedBlockStep={setSelectedBlockStep}
                toggleHelpPanel={toggleHelpPanel}
              />
            );
          case 'previewStep':
            return (
              <PreviewIntakeStep
                actions={actions}
                selectedBlockStep={selectedBlockStep}
                toggleHelpPanel={toggleHelpPanel}
              />
            );
          case 'previewNunjucks':
            return (
              <PreviewNunjucks
                actions={actions}
                selectedBlockStep={selectedBlockStep}
                toggleHelpPanel={toggleHelpPanel}
              />
            );
          default:
            return <Box />;
        }
      }}
      items={items}
      onItemsChange={({ detail }) => {
        setItems(detail.items);
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(detail.items)); } catch (_) {}
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
    </ContentLayout>
  );
};

export default ManageIntakeSteps; // Rename export
