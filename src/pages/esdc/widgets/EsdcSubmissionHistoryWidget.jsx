import React, { useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Table,
  Box,
  ButtonDropdown,
  Link,
  Pagination,
  StatusIndicator
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';

const pageSize = 5;

const statusToIndicator = status => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'accepted') return <StatusIndicator type="success">Accepted</StatusIndicator>;
  if (normalized === 'rejected') return <StatusIndicator type="error">Rejected</StatusIndicator>;
  if (normalized === 'submitted') return <StatusIndicator type="info">Submitted</StatusIndicator>;
  if (normalized === 'ready') return <StatusIndicator type="info">Ready</StatusIndicator>;
  if (normalized === 'prepared') return <StatusIndicator type="info">Prepared</StatusIndicator>;
  if (normalized === 'validated') return <StatusIndicator type="info">Validated</StatusIndicator>;
  return <StatusIndicator type="pending">{status || 'Pending'}</StatusIndicator>;
};

const EsdcSubmissionHistoryWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  history,
  loading,
  onRefresh
}) => {
  const [currentPage, setCurrentPage] = useState(1);

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
          toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Submission history help', metadata.aiContext ?? '');
        }}
      >
        Info
      </Link>
    );
  }, [metadata?.helpComponent, metadata?.helpTitle, metadata?.aiContext, toggleHelpPanel]);

  const historyItems = useMemo(() => (Array.isArray(history) ? history : []), [history]);

  const totalPages = Math.max(1, Math.ceil(historyItems.length / pageSize));

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return historyItems.slice(start, start + pageSize);
  }, [currentPage, historyItems]);

  const formatDateTime = value => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const renderDetails = details => {
    if (!details) return <Box color="text-body-secondary">—</Box>;
    if (typeof details === 'string') {
      try {
        const parsed = JSON.parse(details);
        return renderDetails(parsed);
      } catch {
        return details;
      }
    }
    if (typeof details === 'object') {
      return (
        <Box as="pre" fontFamily="monospace" background="code-editor" padding="xs" borderRadius="small">
          {JSON.stringify(details, null, 2)}
        </Box>
      );
    }
    return String(details);
  };

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          actions={
            onRefresh ? (
              <Link
                variant="inline"
                onFollow={event => {
                  event.preventDefault();
                  onRefresh();
                }}
              >
                Refresh
              </Link>
            ) : undefined
          }
        >
          Submission history
        </Header>
      )}
      settings={typeof actions.removeItem === 'function' ? (
        <ButtonDropdown
          ariaLabel="Submission history settings"
          variant="icon"
          items={[{ id: 'remove', text: 'Remove widget' }]}
          onItemClick={({ detail }) => {
            if (detail?.id === 'remove') {
              actions.removeItem();
            }
          }}
        />
      ) : undefined}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        <Table
          columnDefinitions={[
            {
              id: 'eventType',
              header: 'Event',
              cell: item => statusToIndicator(item.event_type || item.status || '')
            },
            {
              id: 'submittedAt',
              header: 'Occurred at',
              cell: item => formatDateTime(item.occurred_at || item.submittedAt)
            },
            {
              id: 'submittedBy',
              header: 'Actor',
              cell: item => item.actor_user_id ? `User #${item.actor_user_id}` : (item.submittedBy || '—')
            },
            {
              id: 'details',
              header: 'Details',
              cell: item => renderDetails(item.event_details || item.message)
            },
            {
              id: 'checksum',
              header: 'Checksum',
              cell: item => item.payload_checksum || <Box color="text-body-secondary">—</Box>
            }
          ]}
          items={pagedItems}
          resizableColumns
          stickyHeader
          wrapLines
          loading={loading}
          loadingText="Loading submission history"
          empty={<Box textAlign="center">No submissions recorded yet.</Box>}
          variant="container"
        />
        {historyItems.length > pageSize && (
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default EsdcSubmissionHistoryWidget;
