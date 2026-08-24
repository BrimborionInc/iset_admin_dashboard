import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Box,
  SpaceBetween,
  Link,
  Button,
  ButtonDropdown
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';

const notes = [
  {
    id: 'note-1',
    author: 'Program Reporting Team',
    timestamp: '2025-10-20T11:12:00Z',
    text: 'Awaiting confirmation from external auditor regarding Schedule B totals.'
  },
  {
    id: 'note-2',
    author: 'Program Team',
    timestamp: '2025-10-18T09:05:00Z',
    text: 'Outcome metrics collected, pending validation from community partners.'
  }
];

const EsdcReportingNotesWidget = ({
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
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Reporting notes', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          actions={<Button iconName="add-plus">Add note</Button>}
        >
          Submission notes & follow-ups
        </Header>
      )}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="Reporting submission notes settings"
              variant="icon"
              items={[{ id: 'remove', text: 'Remove widget' }]}
              onItemClick={handleSettingsClick}
            />
          )
          : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {notes.map(note => (
          <Box key={note.id} padding="m" borderRadius="medium" border={{ style: 'solid', color: 'border-divider-panel', width: '1px' }}>
            <Box variant="awsui-key-label">{note.author}</Box>
            <Box variant="p">{new Date(note.timestamp).toLocaleString()}</Box>
            <Box variant="p">{note.text}</Box>
          </Box>
        ))}
      </SpaceBetween>
    </BoardItem>
  );
};

export default EsdcReportingNotesWidget;
