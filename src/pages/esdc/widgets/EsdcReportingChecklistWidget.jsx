import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Box,
  Checkbox,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';

const checklistItems = [
  { id: 'financials', label: 'Financial statements uploaded', checked: true },
  { id: 'outcomes', label: 'Outcomes worksheet completed', checked: false },
  { id: 'narrative', label: 'Narrative summary (PDF)', checked: true },
  { id: 'signoff', label: 'Band council sign-off attached', checked: false }
];

const EsdcReportingChecklistWidget = ({
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
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Reporting checklist', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>Reporting readiness checklist</Header>}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="Reporting readiness checklist settings"
              variant="icon"
              items={[{ id: 'remove', text: 'Remove widget' }]}
              onItemClick={handleSettingsClick}
            />
          )
          : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        {checklistItems.map(item => (
          <Box key={item.id} padding="s" borderRadius="medium" border={{ style: 'solid', color: 'border-divider-panel', width: '1px' }}>
            <Checkbox checked={item.checked} readOnly>
              {item.label}
            </Checkbox>
          </Box>
        ))}
      </SpaceBetween>
    </BoardItem>
  );
};

export default EsdcReportingChecklistWidget;
