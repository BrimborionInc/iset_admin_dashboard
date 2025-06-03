import React, { useState } from 'react';
import { ContentLayout, Header } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';

const ManageOrganisations = () => {
  const [items, setItems] = useState([]); // No widgets initially

  return (
    <ContentLayout>
      <Header variant="h1">Manage ISET Holders</Header>
      <Board
        renderItem={() => null} // No widgets to render yet
        onItemsChange={(event) => setItems(event.detail.items)}
        items={items}
        i18nStrings={{
          liveAnnouncementDndStarted: (operationType) =>
            operationType === 'resize' ? 'Resizing' : 'Dragging',
          liveAnnouncementDndItemReordered: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`;
          },
          liveAnnouncementDndItemResized: (operation) => {
            const sizeAnnouncement =
              operation.direction === 'horizontal'
                ? `columns ${operation.placement.width}`
                : `rows ${operation.placement.height}`;
            return `Item resized to ${sizeAnnouncement}.`;
          },
          liveAnnouncementDndItemInserted: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item inserted to ${columns}, ${rows}.`;
          },
          liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
          liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
        }}
      />
    </ContentLayout>
  );
};

export default ManageOrganisations;
