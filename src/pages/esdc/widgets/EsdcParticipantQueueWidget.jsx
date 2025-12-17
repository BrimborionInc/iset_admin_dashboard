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
  ButtonDropdown,
  TextFilter,
  Select,
  SpaceBetween
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';
import { apiFetch } from '../../../auth/apiClient';

const readinessBadge = status => {
  const value = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (value === 'ready') return <Badge color="green">Ready</Badge>;
  if (value === 'blocked') return <Badge color="red">Blocked</Badge>;
  if (value === 'needs_review') return <Badge color="blue">Needs review</Badge>;
  // Fallback so the cell never renders empty, even on unexpected values.
  return <Badge color="grey">{value || 'Needs review'}</Badge>;
};

const preferencesKey = 'esdc-participant-queue-preferences-v1';

const EsdcParticipantQueueWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel
}) => {
  const [search, setSearch] = useState('');
  const [readiness, setReadiness] = useState('all');
  const [refreshTick, setRefreshTick] = useState(0);
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
  const [expandedItems, setExpandedItems] = useState([]);
  const readinessOptions = [
    { label: 'All readiness', value: 'all' },
    { label: 'Ready', value: 'ready' },
    { label: 'Needs review', value: 'needs_review' },
    { label: 'Blocked', value: 'blocked' }
  ];
  const selectedReadinessOption = readinessOptions.find(opt => opt.value === readiness) || readinessOptions[0];

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
        const trimmedSearch = search.trim();
        if (trimmedSearch) {
          params.set('search', trimmedSearch);
        }
        if (readiness && readiness !== 'all') {
          params.set('readiness', readiness);
        }
        params.set('groupByClient', 'true');
        const resp = await apiFetch(`/api/esdc/participants?${params}`, {
          signal: controller.signal
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || body.message || `Request failed with ${resp.status}`);
        }
        const data = await resp.json();
        if (!cancelled) {
          const nextItems = Array.isArray(data.items) ? data.items : [];
          setItems(nextItems);
          setTotalItems(typeof data.total === 'number' ? data.total : nextItems.length);
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
  }, [currentPageIndex, preferences.pageSize, readiness, search, refreshTick]);

  useEffect(() => {
    const handler = () => setRefreshTick(tick => tick + 1);
    window.addEventListener('esdcParticipants:refresh', handler);
    return () => window.removeEventListener('esdcParticipants:refresh', handler);
  }, []);

  const pageItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
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

  const formatDateOnly = value => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  };

  const openWorkspace = () => {
    if (!items.length) return;
    const targetId = items[0].id;
    if (targetId) {
      window.location.href = `/esdc/participants/${targetId}`;
    }
  };

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          actions={(
            <SpaceBetween size="xs" direction="horizontal">
              <Select
                selectedOption={selectedReadinessOption}
                onChange={({ detail }) => {
                  setReadiness(detail.selectedOption.value);
                  setCurrentPageIndex(1);
                }}
                options={readinessOptions}
              />
            </SpaceBetween>
          )}
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
        trackBy="id"
        columnDefinitions={[
          {
            id: 'participant',
            header: 'Participant',
            cell: item => (
              <Link href={`/esdc/participants/${item.id}`}>
                {item.participant_name || `Submission #${item.id}`}
              </Link>
            ),
            sortingField: 'participant_name'
          },
          {
            id: 'referenceId',
            header: 'Reference ID',
            cell: item => item.case_number || item.tracking_id || '—',
            sortingField: 'tracking_id'
          },
          {
            id: 'readiness',
            header: 'Readiness',
            cell: item => readinessBadge(item.readiness_status || 'needs_review'),
            sortingField: 'readiness_status'
          },
          {
            id: 'submissionStatus',
            header: 'Submission status',
            cell: item => item.submission_status || 'pending',
            sortingField: 'submission_status'
          },
          {
            id: 'planStatus',
            header: 'Plan status',
            cell: item => item.action_plan_status || '—',
            sortingField: 'action_plan_status'
          },
          {
            id: 'planStart',
            header: 'Plan start',
            cell: item => formatDateOnly(item.action_plan_start_date),
            sortingField: 'action_plan_start_date'
          },
          {
            id: 'planResult',
            header: 'Plan result',
            cell: item => {
              if (!item.action_plan_result_code && !item.action_plan_result_date) return '—';
              const date = formatDateOnly(item.action_plan_result_date);
              return `${item.action_plan_result_code || '—'}${date !== '—' ? ` (${date})` : ''}`;
            },
            sortingField: 'action_plan_result_date'
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
        sortingDisabled
        loading={loading}
        loadingText="Loading participant submissions"
        empty={renderEmptyState()}
        variant="embedded"
        expandableRows={{
          getItemChildren: item => (Array.isArray(item.children) && item.children.length ? item.children : []),
          isItemExpandable: item => Array.isArray(item.children) && item.children.length > 0,
          expandedItems,
          onExpandableItemToggle: ({ detail }) => {
            const id = detail.item?.id;
            if (!id) return;
            setExpandedItems(prev => {
              const set = new Set(prev.map(entry => entry.id));
              if (detail.expanded) set.add(id);
              else set.delete(id);
              return Array.from(set).map(entryId => ({ id: entryId }));
            });
          }
        }}
        filter={(
          <TextFilter
            filteringText={search}
            filteringPlaceholder="Search by name or reference"
            onChange={({ detail }) => {
              setSearch(detail.filteringText);
              setCurrentPageIndex(1);
            }}
            countText={`${totalItems} matching`}
          />
        )}
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
