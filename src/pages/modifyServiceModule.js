import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  Link,
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { useParams } from 'react-router-dom';
import GeneralServiceModuleInformation from '../widgets/GeneralServiceModuleInformation';
import ResourceRequirements from '../widgets/ResourceRequirements';
import ComponentWorkflow from '../widgets/ComponentWorkflow'; // Import ComponentWorkflow

const ModifyServiceModule = ({ header, headerInfo, toggleHelpPanel, updateBreadcrumbs }) => {
  const { id } = useParams();
  const [serviceModule, setServiceModule] = useState(null);
  const [items, setItems] = useState([
    {
      id: 'general-information',
      rowSpan: 3, // Change rowSpan from 4 to 3
      columnSpan: 2,
      data: { title: 'General Information' },
    },
    {
      id: 'resource-requirements',
      rowSpan: 3,
      columnSpan: 2,
      data: { title: 'Resource Requirements' },
    },
    {
      id: 'component-workflow',
      rowSpan: 9, // Update rowSpan to 12
      columnSpan: 4, // Update columnSpan to 4
      data: { title: 'Service Module Workflow' },
    },
    // Add more widgets here as needed
  ]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/service-modules/${id}`)
      .then(response => response.json())
      .then(data => {
        setServiceModule(data);
        updateBreadcrumbs([
          { text: 'Home', href: '/' },
          { text: 'Manage Service Modules', href: '/service-modules-management-dashboard' },
          { text: data.name, href: '#' }
        ]);
      })
      .catch(error => console.error('Error fetching service module:', error));
  }, [id, updateBreadcrumbs]);

  useEffect(() => {
    if (serviceModule) {
      updateBreadcrumbs([
        { text: 'Home', href: '/' },
        { text: 'Manage Service Modules', href: '/service-modules-management-dashboard' },
        { text: serviceModule.name, href: '#' }
      ]);
    }
  }, [serviceModule, updateBreadcrumbs]);

  if (!serviceModule) {
    return <div>Loading...</div>;
  }

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={headerInfo}>
          {header}
        </Header>
      }
    >
      <Board
        renderItem={(item) => {
          if (item.id === 'general-information') {
            return <GeneralServiceModuleInformation />;
          }
          if (item.id === 'resource-requirements') {
            return <ResourceRequirements />;
          }
          if (item.id === 'component-workflow') {
            return <ComponentWorkflow serviceModuleId={id} />; // Pass serviceModuleId to ComponentWorkflow
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
    </ContentLayout>
  );
};

export default ModifyServiceModule;
