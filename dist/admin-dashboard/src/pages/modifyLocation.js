import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  Link,
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { useParams } from 'react-router-dom';
import GeneralLocationInformation from '../widgets/GeneralLocationInformation'; // Import GeneralLocationInformation
import ContactInformation from '../widgets/ContactInformation'; // Import ContactInformation
import IsetEvaluatorsWidget from '../widgets/IsetEvaluatorsWidget'; // Import the new widget
import PtmaIsetStatistics from '../widgets/PtmaIsetStatistics'; // Import the new widget

const ModifyLocation = ({ header, headerInfo, toggleHelpPanel, updateBreadcrumbs }) => {
  const { id } = useParams();
  const [ptma, setPtma] = useState(null);
  const [items, setItems] = useState([
    {
      id: 'general-information',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'General Information' },
    },
    {
      id: 'iset-evaluators',
      rowSpan: 4,
      columnSpan: 2,
      data: { title: 'ISET Evaluators' },
    },
    {
      id: 'contact-information',
      rowSpan: 3,
      columnSpan: 2,
      data: { title: 'Contact Information' },
    },
    {
      id: 'ptma-iset-statistics',
      rowSpan: 3,
      columnSpan: 2,
      data: { title: 'PTMA ISET Statistics' },
    }
  ]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/ptmas/${id}`)
      .then(response => response.json())
      .then(data => {
        setPtma(data);
        console.log('Updating breadcrumbs with PTMA:', data.location);
        updateBreadcrumbs([
          { text: 'Home', href: '/' },
          { text: 'Manage Locations', href: '/ptma-management' },
          { text: data.location, href: '#' }
        ]);
      })
      .catch(error => console.error('Error fetching PTMA:', error));
  }, [id, updateBreadcrumbs]);

  useEffect(() => {
    if (ptma) {
      updateBreadcrumbs([
        { text: 'Home', href: '/' },
        { text: 'Manage Locations', href: '/ptma-management' },
        { text: ptma.location, href: '#' }
      ]);
    }
  }, [ptma, updateBreadcrumbs]);

  if (!ptma) {
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
            return <GeneralLocationInformation ptma={ptma} />;
          }
          if (item.id === 'iset-evaluators') {
            return <IsetEvaluatorsWidget ptmaId={id} />;
          }
          if (item.id === 'contact-information') {
            return <ContactInformation ptma={ptma} />;
          }
          if (item.id === 'ptma-iset-statistics') {
            return <PtmaIsetStatistics />;
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

export default ModifyLocation;
