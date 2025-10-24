import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Box,
  ProgressBar,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';

const summary = {
  mandatoryComplete: 82,
  mandatoryTotal: 89,
  optionalComplete: 46,
  blockingIssues: 7,
  topIssues: [
    { id: 'postal', label: 'Postal code ↔ province mismatch', count: 3 },
    { id: 'dob', label: 'DOB outside 1–100 years', count: 2 },
    { id: 'sin', label: 'SIN checksum failure', count: 2 }
  ]
};

const EsdcParticipantValidationWidget = ({
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
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Validation summary', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  const mandatoryPct = Math.round((summary.mandatoryComplete / summary.mandatoryTotal) * 100);

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>Validation summary</Header>}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="Participant validation summary settings"
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
        <ProgressBar
          value={mandatoryPct}
          description="Mandatory fields complete"
          resultText={`${summary.mandatoryComplete} of ${summary.mandatoryTotal}`}
          variant={mandatoryPct === 100 ? 'success' : 'warning'}
        />
        <Box variant="p">
          Optional fields captured: {summary.optionalComplete}. Blocking issues outstanding: {summary.blockingIssues}.
        </Box>
        <Box variant="h3">Top issues</Box>
        <SpaceBetween size="xs">
          {summary.topIssues.map(issue => (
            <Box key={issue.id} padding="s" borderRadius="medium" border={{ style: 'solid', color: 'border-divider-panel', width: '1px' }}>
              {issue.label}: {issue.count}
            </Box>
          ))}
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default EsdcParticipantValidationWidget;
