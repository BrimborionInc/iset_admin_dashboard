import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  SpaceBetween,
  Alert,
  StatusIndicator,
  ColumnLayout,
  FormField,
  Select,
  Input,
  Box,
  Header,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import boardItemI18nStrings from './common';

export default function LockingConfigWidget({
  actions,
  metadata,
  toggleHelpPanel,
  headerActions,
  lockingError,
  setLockingError,
  lockingLoading,
  lockingUi,
  lockingModeOptions,
  lockingConfig,
  defaultLockingConfig,
  setLockingEdits
}) {
  const { selectedMode, ttlInput, heartbeatInput, ttlError, heartbeatError, disableInputs } = lockingUi;

  const handleOpenHelp = () => {
    if (!toggleHelpPanel) return;
    const HelpComponent = metadata?.helpComponent;
    if (!HelpComponent) return;
    const title = metadata?.helpTitle || metadata?.title || 'Record locking';
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
        ariaLabel="Record locking widget settings"
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
          {metadata?.title || 'Record locking'}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        {lockingError && (
          <Alert type="error" header="Locking configuration error" onDismiss={() => setLockingError(null)} dismissible>
            {lockingError}
          </Alert>
        )}
        {lockingLoading ? (
          <StatusIndicator type="loading">Loading locking settings</StatusIndicator>
        ) : (
          <ColumnLayout columns={2} variant="text-grid">
            <FormField label="Mode" description="Choose whether to require pessimistic locks during editing sessions.">
              <Select
                selectedOption={selectedMode}
                options={lockingModeOptions}
                disabled={disableInputs}
                onChange={({ detail }) => {
                  const next = detail.selectedOption?.value || defaultLockingConfig.mode;
                  setLockingEdits(prev => ({ ...(prev || {}), mode: next }));
                }}
              />
            </FormField>
            <FormField
              label="Lock timeout (minutes)"
              description="Locks expire automatically when the timeout is reached."
              errorText={ttlError || undefined}
            >
              <Input
                type="number"
                value={ttlInput}
                disabled={disableInputs}
                onChange={({ detail }) =>
                  setLockingEdits(prev => ({ ...(prev || {}), lockTtlMinutes: detail.value }))
                }
                placeholder={String(lockingConfig?.lockTtlMinutes ?? defaultLockingConfig.lockTtlMinutes)}
              />
            </FormField>
            <FormField
              label="Heartbeat interval (minutes)"
              description="Optional: automatically refresh the lock before it expires."
              errorText={heartbeatError || undefined}
            >
              <Input
                type="number"
                value={heartbeatInput}
                disabled={disableInputs}
                onChange={({ detail }) =>
                  setLockingEdits(prev => ({ ...(prev || {}), heartbeatMinutes: detail.value }))
                }
                placeholder="e.g. 2"
              />
            </FormField>
            <Box />
          </ColumnLayout>
        )}
        <Box variant="small" color="text-status-inactive">
          Locks are automatically released on save, on cancel, or when the timeout elapses. Heartbeats run only while the
          editor keeps the form open.
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
}
