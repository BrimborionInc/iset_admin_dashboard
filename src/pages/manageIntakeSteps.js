import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  Box,
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import IntakeStepTableWidget from '../widgets/IntakeStepTableWidget'; // Import the renamed IntakeStepTableWidget
import PreviewIntakeStep from '../widgets/PreviewIntakeStep'; // Import the renamed PreviewIntakeStep
import PreviewNunjucks from '../widgets/PreviewNunjucks'; // Import the PreviewNunjucks widget

const ManageIntakeSteps = ({ header, headerInfo, toggleHelpPanel, updateBreadcrumbs }) => { // Rename component
  const [selectedBlockStep, setSelectedBlockStep] = useState(null);

  const items = [
    { id: 'stepLibrary', rowSpan: 4, columnSpan: 2, data: { title: 'Intake Step Library', content: <IntakeStepTableWidget setSelectedBlockStep={setSelectedBlockStep} /> } },
    { id: 'previewStep', rowSpan: 4, columnSpan: 2, data: { title: 'Preview', content: <PreviewIntakeStep selectedBlockStep={selectedBlockStep} /> } },
    { id: 'previewNunjucks', rowSpan: 6, columnSpan: 4, data: { title: 'Preview Nunjucks', content: <PreviewNunjucks selectedBlockStep={selectedBlockStep} /> } },
  ];

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={headerInfo}>
          {header}
        </Header>
      }
    >
      <Board
  renderItem={(item) => item.data.content}
  items={items}
  onItemsChange={() => {}}
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
