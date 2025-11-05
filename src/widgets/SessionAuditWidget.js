import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  SpaceBetween,
  Alert,
  StatusIndicator,
  ColumnLayout,
  FormField,
  Box,
  Button,
  Header,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import boardItemI18nStrings from './common';

export default function SessionAuditWidget({
  actions,
  metadata,
  toggleHelpPanel,
  headerActions,
  auditError,
  setAuditError,
  auditLoading,
  auditStats,
  auditRecent,
  fetchAudit,
  fetchJSON
}) {
  const handleOpenHelp = () => {
    if (!toggleHelpPanel) return;
    const HelpComponent = metadata?.helpComponent;
    if (!HelpComponent) return;
    const title = metadata?.helpTitle || metadata?.title || 'Session audit';
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
        ariaLabel="Session audit widget settings"
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
          {metadata?.title || 'Session audit'}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        {auditError && <Alert type="error" header="Session audit error">{auditError}</Alert>}
        <SpaceBetween size="xxs">
          <Box fontSize="heading-xs" variant="h4">Session Audit</Box>
          {auditLoading && <StatusIndicator type="loading">Loading</StatusIndicator>}
          {auditStats && (
            <ColumnLayout columns={4} variant="text-grid">
              <FormField label="Total Sessions"><Box>{auditStats.total}</Box></FormField>
              <FormField label="Active Users 24h"><Box>{auditStats.activeUsers24h}</Box></FormField>
              <FormField label="Rows (24h)"><Box>{auditStats.rows24h}</Box></FormField>
              <FormField label="Newest Seen"><Box>{auditStats.newest ? new Date(auditStats.newest).toLocaleString() : '-'}</Box></FormField>
            </ColumnLayout>
          )}
          {auditRecent.length > 0 && (
            <FormField label="Recent Sessions">
              <SpaceBetween size="xxs">
                {auditRecent.map((session, index) => (
                  <Box key={`${session.session_key || 'session'}-${index}`} fontSize="body-s" color="text-status-inactive">
                    {session.user_id} - {new Date(session.last_seen_at).toLocaleTimeString()} - {String(session.session_key || '').slice(0, 10)}
                  </Box>
                ))}
              </SpaceBetween>
            </FormField>
          )}
          <SpaceBetween direction="horizontal" size="xs">
            <Button key="audit-refresh" iconName="refresh" onClick={fetchAudit} loading={auditLoading}>
              Refresh
            </Button>
            <Button
              key="audit-prune"
              iconName="close"
              onClick={async () => {
                try {
                  await fetchJSON('/api/audit/session/prune?days=60', { method: 'POST' });
                  fetchAudit();
                } catch (error) {
                  setAuditError(error.message);
                }
              }}
              disabled={auditLoading}
            >
              Prune &lt;60d
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
}
