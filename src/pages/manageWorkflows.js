import React, { useState } from 'react';
import { ContentLayout } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import WorkflowListWidget from '../widgets/WorkflowListWidget';
import WorkflowPreviewWidget from '../widgets/WorkflowPreviewWidget';

const initialItems = [
  { id: 'workflowList', rowSpan: 4, columnSpan: 2, data: { title: 'Workflow List' } },
  { id: 'workflowPreview', rowSpan: 4, columnSpan: 2, data: { title: 'Workflow Preview' } },
];

const ManageWorkflows = () => {
  const [items, setItems] = useState(initialItems);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  const renderItem = item => {
    if (item.id === 'workflowList') {
      return <WorkflowListWidget onSelectWorkflow={setSelectedWorkflow} />;
    }
    if (item.id === 'workflowPreview') {
      return <WorkflowPreviewWidget selectedWorkflow={selectedWorkflow} />;
    }
    return null;
  };

  return (
    <ContentLayout>
      <Board
        renderItem={renderItem}
        items={items}
        onItemsChange={event => setItems(event.detail.items)}
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

export default ManageWorkflows;
