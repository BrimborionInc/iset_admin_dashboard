import React, { useState, useEffect } from 'react';
import { Button } from '@cloudscape-design/components';
import WorkflowLibraryWidgetHelp from '../helpPanelContents/workflowLibraryWidgetHelp';
import WorkflowPropertiesWidgetHelp from '../helpPanelContents/workflowPropertiesWidgetHelp';
import WorkflowPreviewWidgetHelp from '../helpPanelContents/workflowPreviewWidgetHelp';
import WorkflowRuntimeSchemaWidgetHelp from '../helpPanelContents/workflowRuntimeSchemaWidgetHelp';
import Board from '@cloudscape-design/board-components/board';
import WorkflowListWidget from '../widgets/WorkflowListWidget';
import WorkflowPreviewWidget from '../widgets/WorkflowPreviewWidget';
import WorkflowPropertiesWidget from '../widgets/WorkflowPropertiesWidget';
import WorkflowRuntimeSchemaWidget from '../widgets/WorkflowRuntimeSchemaWidget';

// Standardized default layout (order + spans) per user spec
const initialItems = [
  { id: 'workflowList', rowSpan: 3, columnSpan: 2, data: { title: 'Workflow Library' } },
  { id: 'workflowProps', rowSpan: 3, columnSpan: 2, data: { title: 'Workflow Properties' } },
  { id: 'workflowPreview', rowSpan: 5, columnSpan: 2, data: { title: 'Workflow Preview' } },
  { id: 'workflowRuntime', rowSpan: 5, columnSpan: 2, data: { title: 'Runtime Schema' } }
];

const STORAGE_KEY = 'manageWorkflows.board.items.v1';

const ManageWorkflows = ({ toggleHelpPanel }) => {
  const [items, setItems] = useState(initialItems);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);

  // Restore saved layout
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(i => i && typeof i.id === 'string')) {
          setItems(parsed);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const resetLayout = () => {
    setItems(initialItems);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const openWidgetHelp = (Comp, title) => {
    if (!toggleHelpPanel) return;
    toggleHelpPanel(<Comp />, title, Comp.aiContext || '');
  };

  const renderItem = (item, actions) => {
    switch (item.id) {
      case 'workflowList':
  return <WorkflowListWidget onSelectWorkflow={setSelectedWorkflow} actions={actions} toggleHelpPanel={() => openWidgetHelp(WorkflowLibraryWidgetHelp, 'Workflow Library')} />;
      case 'workflowPreview':
  return <WorkflowPreviewWidget selectedWorkflow={selectedWorkflow} actions={actions} toggleHelpPanel={() => openWidgetHelp(WorkflowPreviewWidgetHelp, 'Workflow Preview')} HelpContent={WorkflowPreviewWidgetHelp} />;
      case 'workflowProps':
        return (
          <WorkflowPropertiesWidget
            workflow={selectedWorkflow}
            onWorkflowUpdated={setSelectedWorkflow}
            actions={actions}
            toggleHelpPanel={() => openWidgetHelp(WorkflowPropertiesWidgetHelp, 'Workflow Properties')}
          />
        );
      case 'workflowRuntime':
  return <WorkflowRuntimeSchemaWidget selectedWorkflow={selectedWorkflow} actions={actions} toggleHelpPanel={() => openWidgetHelp(WorkflowRuntimeSchemaWidgetHelp, 'Runtime Schema')} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
        <Button onClick={resetLayout} variant="link">Reset layout</Button>
      </div>
      <Board
        renderItem={renderItem}
        items={items}
        onItemsChange={event => {
          setItems(event.detail.items);
          try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(event.detail.items)); } catch { /* ignore */ }
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
    </div>
  );
};

export default ManageWorkflows;
