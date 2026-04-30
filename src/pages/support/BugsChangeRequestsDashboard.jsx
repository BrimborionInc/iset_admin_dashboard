import React, { useMemo, useState } from 'react';
import Board from '@cloudscape-design/board-components/board';
import { Box, SpaceBetween } from '@cloudscape-design/components';
import SystemAdminFeedbackQueueWidget from '../home/widgets/SystemAdminFeedbackQueueWidget.jsx';

const BOARD_I18N_STRINGS = {
  liveAnnouncementDndStarted: item => `Picked up item ${item?.data?.title || ''}`,
  liveAnnouncementDndDiscarded: item => `Discarded item ${item?.data?.title || ''}`,
  liveAnnouncementDndItemReordered: () => 'Item reordered',
  liveAnnouncementDndItemResized: () => 'Item resized',
  liveAnnouncementDndCommitted: () => 'Layout updated',
  liveAnnouncementDndItemInserted: () => 'Item inserted',
  navigationAriaLabel: 'Bugs and Change Requests dashboard navigation',
  navigationAriaDescription: 'Use arrow keys to move between dashboard widgets.',
  navigationItemAriaLabel: item => item?.data?.title || 'Dashboard widget',
};

const DEFAULT_ITEMS = [
  {
    id: 'bugs-and-change-requests',
    rowSpan: 9,
    columnSpan: 4,
    data: {
      title: 'Bugs and Change Requests',
    },
  },
];

export default function BugsChangeRequestsDashboard({ toggleHelpPanel }) {
  const defaultItems = useMemo(() => DEFAULT_ITEMS, []);
  const [items, setItems] = useState(defaultItems);

  return (
    <SpaceBetween size="l">
      <Board
        items={items}
        renderItem={() => (
          <SystemAdminFeedbackQueueWidget
            toggleHelpPanel={toggleHelpPanel}
          />
        )}
        onItemsChange={({ detail }) => {
          setItems(detail.items && detail.items.length ? detail.items : defaultItems);
        }}
        i18nStrings={BOARD_I18N_STRINGS}
        empty={<Box padding="m">No widgets on this dashboard.</Box>}
      />
    </SpaceBetween>
  );
}
