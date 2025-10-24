import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Box,
  StatusIndicator,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';

const deadlines = [
  {
    id: 'participant-batch',
    title: 'Participant batch upload',
    due: '2025-11-05',
    status: 'info',
    description: 'Target to send ready participant XML files for October intakes.'
  },
  {
    id: 'q2-report',
    title: 'Q2 reporting package',
    due: '2025-11-15',
    status: 'warning',
    description: 'Financial statements reviewed; outcomes tab still pending validation.'
  },
  {
    id: 'capacity-review',
    title: 'Annual capacity review submission',
    due: '2026-01-10',
    status: 'success',
    description: 'Template confirmed with ESDC. Prep starts December 1.'
  }
];

const statusLabel = status => {
  if (status === 'warning') return 'At risk';
  if (status === 'success') return 'On track';
  return 'Plan';
};

const EsdcUpcomingDeadlinesWidget = ({
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
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Upcoming deadlines', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>Upcoming deadlines</Header>}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="Upcoming deadlines settings"
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
        {deadlines.map(item => (
          <Box key={item.id} padding="m" borderRadius="medium" border={{ style: 'solid', color: 'border-divider-panel', width: '1px' }}>
            <SpaceBetween size="xs">
              <Box variant="h3">{item.title}</Box>
              <StatusIndicator type={item.status}>
                {statusLabel(item.status)} · Due {new Date(item.due).toLocaleDateString()}
              </StatusIndicator>
              <Box variant="p">{item.description}</Box>
            </SpaceBetween>
          </Box>
        ))}
      </SpaceBetween>
    </BoardItem>
  );
};

export default EsdcUpcomingDeadlinesWidget;
