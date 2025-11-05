import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  SpaceBetween,
  Box,
  Header,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import boardItemI18nStrings from './common';

export default function SecretsWidget({
  actions,
  metadata,
  toggleHelpPanel,
  headerActions,
  security,
  canSeeAny,
  fullyAdmin
}) {
  const handleOpenHelp = () => {
    if (!toggleHelpPanel) return;
    const HelpComponent = metadata?.helpComponent;
    if (!HelpComponent) return;
    const title = metadata?.helpTitle || metadata?.title || 'Secrets';
    const context = metadata?.aiContext || '';
    toggleHelpPanel(<HelpComponent />, title, context);
  };

  const infoLink =
    metadata?.helpComponent && toggleHelpPanel ? (
      <Link variant="info" onClick={handleOpenHelp}>
        Info
      </Link>
    ) : undefined;

  const settingsMenu =
    actions && typeof actions.removeItem === 'function' ? (
      <ButtonDropdown
        ariaLabel="Secrets widget settings"
        variant="icon"
        items={[{ id: 'remove', text: 'Remove widget' }]}
        onItemClick={({ detail }) => {
          if (detail.id === 'remove') {
            actions.removeItem();
          }
        }}
      />
    ) : undefined;

  let content;
  if (!security) {
    content = <Box fontSize="body-s" color="text-status-inactive">Secrets unavailable.</Box>;
  } else if (!canSeeAny) {
    content = <Box fontSize="body-s" color="text-status-inactive">Insufficient role to view secrets.</Box>;
  } else {
    content = (
      <SpaceBetween size="xs">
        {security.secrets.map(secret => (
          <Box key={secret.key}>
            {secret.key}: {secret.present ? secret.masked : <i>missing</i>}
          </Box>
        ))}
        {!fullyAdmin && (
          <Box fontSize="body-s" color="text-status-info">
            Additional privileges required to view fuller detail.
          </Box>
        )}
      </SpaceBetween>
    );
  }

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={metadata?.description}
          info={infoLink}
          actions={headerActions}
        >
          {metadata?.title || 'Secrets'}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      {content}
    </BoardItem>
  );
}
