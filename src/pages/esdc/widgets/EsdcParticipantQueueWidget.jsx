import React, { useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Table,
  Box,
  Badge,
  Button,
  Link,
  CollectionPreferences,
  Pagination,
  ButtonDropdown
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';
import { apiFetch } from '../../../auth/apiClient';

const readinessBadge = status => {
  if (status === 'ready') return <Badge color="green">Ready</Badge>;
  if (status === 'blocked') return <Badge color="red">Blocked</Badge>;
  return <Badge color="orange">Needs review</Badge>;
};

const preferencesKey = 'esdc-participant-queue-preferences-v1';

const EsdcParticipantQueueWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel
}) => {
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = window.localStorage.getItem(preferencesKey);
      return stored ? JSON.parse(stored) : { pageSize: 10 };
    } catch {
      return { pageSize: 10 };
    }
  });
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Participant queue', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  const handlePreferencesChange = ({ detail }) => {
    const next = { ...preferences, ...detail };
    setPreferences(next);
    setCurrentPageIndex(1);
    try {
      window.localStorage.setItem(preferencesKey, JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadQueue() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(preferences.pageSize),
          offset: String((currentPageIndex - 1) * preferences.pageSize)
        });
        const resp = await apiFetch(`/api/esdc/participants?${params}`, {
          signal: controller.signal
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || body.message || `Request failed with ${resp.status}`);
        }
        const data = await resp.json();
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setTotalItems(typeof data.total === 'number' ? data.total : 0);
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          setError(err.message || 'Failed to load participant submissions.');
          setItems([]);
          setTotalItems(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadQueue();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentPageIndex, preferences.pageSize]);

  const pageItems = useMemo(() => items, [items]);
  const pagesCount = useMemo(() => {
    if (totalItems === 0) return 1;
    return Math.max(1, Math.ceil(totalItems / preferences.pageSize));
  }, [totalItems, preferences.pageSize]);

  const renderEmptyState = () => {
    if (error) {
      return <Box textAlign="center" color="text-status-critical">{error}</Box>;
    }
    if (loading) {
      return <Box textAlign="center">Loading participant submissions...</Box>;
    }
    return <Box textAlign="center">No participants waiting for submission.</Box>;
  };

  const formatDateTime = value => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          actions={
            <Button variant="primary" iconName="external">Open workspace</Button>
          }
        >
          Participant submission queue
        </Header>
      )}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="Participant queue settings"
              variant="icon"
              items={[{ id: 'remove', text: 'Remove widget' }]}
              onItemClick={handleSettingsClick}
            />
          )
          : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Table
        columnDefinitions={[
          {
            id: 'participant',
            header: 'Participant',
            cell: item => (
              <Link href={`/esdc/participants/${item.id}`}>
                {item.participant_name || item.tracking_id || `Submission #${item.id}`}
              </Link>
            ),
            sortingField: 'participant_name'
          },
          {
            id: 'referenceId',
            header: 'Reference ID',
            cell: item => item.tracking_id || '—',
            sortingField: 'tracking_id'
          },
          {
            id: 'readiness',
            header: 'Readiness',
            cell: item => readinessBadge(item.readiness_status),
            sortingField: 'readiness_status'
          },
          {
            id: 'submissionStatus',
            header: 'Submission status',
            cell: item => item.submission_status || 'pending',
            sortingField: 'submission_status'
          },
          {
            id: 'lastValidated',
            header: 'Last validated',
            cell: item => formatDateTime(item.last_validated_at),
            sortingField: 'last_validated_at'
          },
          {
            id: 'submittedAt',
            header: 'Submitted',
            cell: item => formatDateTime(item.submitted_at),
            sortingField: 'submitted_at'
          }
        ]}
        items={pageItems}
        resizableColumns
        stickyHeader
        sortingDisabled={false}
        loading={loading}
        loadingText="Loading participant submissions"
        empty={renderEmptyState()}
        variant="embedded"
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            pagesCount={pagesCount}
            onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
          />
        }
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={preferences}
            onConfirm={handlePreferencesChange}
            pageSizePreference={{
              title: 'Page size',
              options: [
                { value: 10, label: '10 participants' },
                { value: 20, label: '20 participants' },
                { value: 50, label: '50 participants' }
              ]
            }}
          />
        }
      />
    </BoardItem>
  );
};

export default EsdcParticipantQueueWidget;
