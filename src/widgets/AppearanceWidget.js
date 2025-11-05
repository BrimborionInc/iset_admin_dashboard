import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  SpaceBetween,
  Box,
  Toggle,
  Header,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import boardItemI18nStrings from './common';

export default function AppearanceWidget({
  actions,
  metadata,
  toggleHelpPanel,
  headerActions,
  isDarkMode,
  setUseDarkMode
}) {
  const handleOpenHelp = () => {
    if (!toggleHelpPanel) return;
    const HelpComponent = metadata?.helpComponent;
    if (!HelpComponent) return;
    const title = metadata?.helpTitle || metadata?.title || 'Appearance';
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
        ariaLabel="Appearance widget settings"
        variant="icon"
        items={[{ id: 'remove', text: 'Remove widget' }]}
        onItemClick={({ detail }) => {
          if (detail.id === 'remove') {
            actions.removeItem();
          }
        }}
      />
    ) : undefined;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={metadata?.description}
          info={infoLink}
          actions={headerActions}
        >
          {metadata?.title || 'Appearance & Theme'}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        <Box fontSize="body-s" color="text-status-info">
          Dark mode preference (scaffold only).
        </Box>
        <Toggle checked={isDarkMode} onChange={event => setUseDarkMode(event.detail.checked)}>
          Dark Mode
        </Toggle>
      </SpaceBetween>
    </BoardItem>
  );
}
