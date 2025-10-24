import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Table,
  Box,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';

const historyItems = [
  {
    id: 'hist-1',
    participantId: '712345678',
    outcome: 'Accepted',
    timestamp: '2025-09-30T15:12:00Z',
    notes: 'Monthly ILMP export pack',
    link: '/esdc/participants/712345678'
  },
  {
    id: 'hist-2',
    participantId: '612340987',
    outcome: 'Rejected',
    timestamp: '2025-09-17T10:05:00Z',
    notes: 'DOB outside range; corrected',
    link: '/esdc/participants/612340987'
  },
  {
    id: 'hist-3',
    participantId: '512349876',
    outcome: 'Accepted',
    timestamp: '2025-09-05T09:44:00Z',
    notes: 'Manual resend after corrections',
    link: '/esdc/participants/512349876'
  }
];

const EsdcParticipantHistoryWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel
}) => {
  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === 'remove' && typeof actions.removeItem === 'function') {
      actions.removeItem();
    }
  };

  const infoLink = metadata?.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Participant history', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>Recent participant submissions</Header>}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="Participant submissions history settings"
              variant="icon"
              items={[{ id: 'remove', text: 'Remove widget' }]}
              onItemClick={handleSettingsClick}
            />
          )
          : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Table
        columnDefinitions={[
          {
            id: 'participant',
            header: 'Participant',
            cell: item => <Link href={item.link}>{item.participantId}</Link>
          },
          {
            id: 'outcome',
            header: 'Outcome',
            cell: item => item.outcome
          },
          {
            id: 'timestamp',
            header: 'Submitted',
            cell: item => new Date(item.timestamp).toLocaleString()
          },
          {
            id: 'notes',
            header: 'Notes',
            cell: item => item.notes
          }
        ]}
        items={historyItems}
        resizableColumns
        stickyHeader
        empty={<Box textAlign="center">No submissions recorded yet.</Box>}
        variant="container"
      />
    </BoardItem>
  );
};

export default EsdcParticipantHistoryWidget;
