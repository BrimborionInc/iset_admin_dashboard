import React, { useEffect, useState } from 'react';
import { ContentLayout, Header, SpaceBetween } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import AccessControlMatrix from '../widgets/AccessControlMatrix';

const initialBoardItems = [
  { id: 'access-control-matrix', rowSpan: 4, columnSpan: 6, data: { title: 'Access Control Matrix' } },
];

const initialPaletteItems = [];

export default function AccessControlDashboard({ updateBreadcrumbs, setAvailableItems }) {
  const [boardItems, setBoardItems] = useState(initialBoardItems);

  useEffect(() => {
    updateBreadcrumbs([
      { text: 'Home', href: '/' },
      { text: 'Security Settings', href: '/manage-security-options' },
      { text: 'Access Control', href: '/access-control' },
    ]);
    setAvailableItems(initialPaletteItems);
  }, [updateBreadcrumbs, setAvailableItems]);

  return (
    <ContentLayout >
      <SpaceBetween size="l">
        <Board
          renderItem={(item) => {
            if (item.id === 'access-control-matrix') {
              return <AccessControlMatrix />;
            }
            return null;
          }}
          items={boardItems}
          onItemsChange={(event) => setBoardItems(event.detail.items)}
          i18nStrings={{
            liveAnnouncementDndStarted: (op) => (op === 'resize' ? 'Resizing' : 'Dragging'),
            liveAnnouncementDndCommitted: (op) => `${op} committed`,
            liveAnnouncementDndDiscarded: (op) => `${op} discarded`,
            navigationAriaLabel: 'Board navigation',
            navigationAriaDescription: 'Click on non-empty item to move focus over',
            navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty'),
          }}
        />
      </SpaceBetween>
    </ContentLayout>
  );
}
