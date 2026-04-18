import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  SpaceBetween,
  Box,
  StatusIndicator,
  Table,
  Header,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import boardItemI18nStrings from './common';

export default function EnvironmentWidget({
  actions,
  metadata,
  toggleHelpPanel,
  headerActions,
  runtime,
  demoToolbarColumns,
  demoToolbarRows,
  demoToolbarSaving
}) {
  const handleOpenHelp = () => {
    if (!toggleHelpPanel) return;
    const HelpComponent = metadata?.helpComponent;
    if (!HelpComponent) return;
    const title = metadata?.helpTitle || metadata?.title || 'Environment';
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
        ariaLabel="Environment widget settings"
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
          {metadata?.title || 'Environment'}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        {runtime ? (
          <Box>NODE_ENV: {runtime.env?.nodeEnv || 'unknown'}</Box>
        ) : (
          <StatusIndicator type="loading">Loading environment</StatusIndicator>
        )}
        <Table
          variant="embedded"
          resizableColumns={false}
          columnDefinitions={demoToolbarColumns}
          items={demoToolbarRows}
          trackBy="role"
          header={
            <Header
              variant="h3"
              description={
                demoToolbarSaving
                  ? "Saving shared runtime visibility..."
                  : "Shared runtime visibility for the demo toolbar."
              }
            >
              Demo Toolbar Visibility
            </Header>
          }
          empty={<Box>No roles available</Box>}
        />
      </SpaceBetween>
    </BoardItem>
  );
}
