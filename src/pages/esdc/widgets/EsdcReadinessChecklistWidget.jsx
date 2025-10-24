import React, { useMemo } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Badge,
  Box,
  ButtonDropdown,
  Link,
  ColumnLayout,
  KeyValuePairs
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';

const badgeColorByStatus = {
  ready: 'green',
  'needs_review': 'orange',
  pending: 'blue',
  blocked: 'red',
  accepted: 'teal',
  rejected: 'red'
};

const normalizeList = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeList(parsed);
    } catch {
      return [value];
    }
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
  }
  return [String(value)];
};

const formatDateTime = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const EsdcReadinessChecklistWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  submission,
  loading,
  error
}) => {
  const infoLink = useMemo(() => {
    if (!metadata?.helpComponent || !toggleHelpPanel) {
      return undefined;
    }
    return (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(helpContent, metadata.helpTitle ?? 'ESDC submission readiness', metadata.aiContext ?? '');
        }}
      >
        Info
      </Link>
    );
  }, [metadata?.helpComponent, metadata?.helpTitle, metadata?.aiContext, toggleHelpPanel]);

  const readinessStatus = submission?.readiness_status || 'unknown';
  const submissionStatus = submission?.submission_status || 'pending';
  const lastValidated = formatDateTime(submission?.last_validated_at);
  const submittedAt = formatDateTime(submission?.submitted_at);
  const warnings = useMemo(() => normalizeList(submission?.warnings), [submission?.warnings]);
  const blocking = useMemo(() => normalizeList(submission?.blocking_issues), [submission?.blocking_issues]);

  const readinessBadge = (
    <Badge color={badgeColorByStatus[readinessStatus] || 'blue'}>
      {readinessStatus.replace(/_/g, ' ')}
    </Badge>
  );

  const submissionBadge = (
    <Badge color={badgeColorByStatus[submissionStatus] || 'blue'}>
      {submissionStatus.replace(/_/g, ' ')}
    </Badge>
  );

  const renderList = (items, emptyLabel) => {
    if (!items.length) {
      return <Box color="text-body-secondary">{emptyLabel}</Box>;
    }
    return (
      <SpaceBetween size="xs">
        {items.map((entry, index) => (
          <Box key={`${entry}-${index}`} padding={{ top: 'xxs', bottom: 'xxs' }}>
            {entry}
          </Box>
        ))}
      </SpaceBetween>
    );
  };

  return (
    <BoardItem
      header={(
        <Header variant="h2" info={infoLink}>
          Submission readiness checklist
        </Header>
      )}
      settings={
        typeof actions.removeItem === 'function' ? (
          <ButtonDropdown
            ariaLabel="Submission readiness checklist settings"
            variant="icon"
            onItemClick={({ detail }) => {
              if (detail?.id === 'remove') {
                actions.removeItem();
              }
            }}
            items={[{ id: 'remove', text: 'Remove widget' }]}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {loading && (
          <Box>Loading readiness details…</Box>
        )}
        {!loading && !submission && !error && (
          <Box color="text-body-secondary">Participant submission not found.</Box>
        )}
        {error && !loading && (
          <Box color="text-status-critical">{error}</Box>
        )}
        {submission && (
          <SpaceBetween size="l">
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'Readiness status', value: readinessBadge },
                { label: 'Submission status', value: submissionBadge },
                { label: 'Last validated', value: <Box>{lastValidated}</Box> },
                { label: 'Submitted', value: <Box>{submittedAt}</Box> }
              ]}
            />
            <ColumnLayout columns={2} variant="text-grid" minColumnWidth={260}>
              <Box padding="s" borderRadius="medium" border={{ style: 'solid', color: 'border-divider-panel', width: '1px' }} background="layer-1">
                <SpaceBetween size="xs">
                  <Header variant="h3" description="">Warnings</Header>
                  {renderList(warnings, 'No warnings recorded.')}
                </SpaceBetween>
              </Box>
              <Box padding="s" borderRadius="medium" border={{ style: 'solid', color: 'border-divider-panel', width: '1px' }} background="layer-1">
                <SpaceBetween size="xs">
                  <Header variant="h3" description="">Blocking issues</Header>
                  {renderList(blocking, 'No blocking issues.')}
                </SpaceBetween>
              </Box>
            </ColumnLayout>
          </SpaceBetween>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default EsdcReadinessChecklistWidget;
