import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Table,
  Box,
  Badge,
  Link,
  CollectionPreferences,
  Pagination,
  ButtonDropdown
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

const submissionReason = item => {
  const status = (item.submission_status || 'pending').toLowerCase();
  if (status === 'rejected') return 'Resubmission required';
  const planStatus = (item.action_plan_status || '').toLowerCase();
  const hasFinalResult = Boolean(item.action_plan_result_code && item.action_plan_result_date);
  const isFinalPlan = ['closed', 'ready_to_close', 'ready-to-close', 'ready to close'].includes(planStatus);
  if (isFinalPlan && hasFinalResult) return 'Action plan closed';
  if (planStatus === 'active') return 'Action plan activated';
  if (planStatus === 'draft') return 'Action plan created';
  if (!item.action_plan_id && !planStatus) return 'New client';
  return 'Pending submission';
};

const normalizeIssueList = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {}
    return value.trim() ? [value] : [];
  }
  return [];
};

const submissionDetail = item => {
  if (!item.last_validated_at) return '—';
  const warnings = normalizeIssueList(item.warnings);
  const blocking = normalizeIssueList(item.blocking_issues);
  const readiness = (item.readiness_status || '').toLowerCase();
  const list = readiness === 'blocked' ? blocking : [...blocking, ...warnings];
  if (!list.length) return '—';
  const [first, ...rest] = list;
  return rest.length ? `${first} (+${rest.length} other issue${rest.length > 1 ? 's' : ''})` : first;
};

const preferencesKey = 'esdc-participant-queue-preferences-v1';

const EsdcParticipantQueueWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel
}) => {
  const location = useLocation();
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
  const requestedReadiness = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    const requested = (params.get('readiness') || params.get('filter') || '').trim().toLowerCase();
    if (requested === 'blocked') return 'blocked';
    if (requested === 'needs_review' || requested === 'needs-review' || requested === 'needs review') return 'needs_review';
    if (requested === 'ready') return 'ready';
    return '';
  }, [location.search]);

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
        params.set('groupByClient', 'true');
        if (requestedReadiness) {
          params.set('readiness', requestedReadiness);
        }
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
  }, [currentPageIndex, preferences.pageSize, refreshTick, requestedReadiness]);

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

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
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
              item.case_id
                ? (
                  <Link href={`/cases/${item.case_id}`}>
                    {item.participant_name || `Submission #${item.id}`}
                  </Link>
                )
                : (item.participant_name || `Submission #${item.id}`)
            ),
            sortingField: 'participant_name'
          },
          {
            id: 'readiness',
            header: 'Readiness',
            cell: item => readinessBadge(item.readiness_status || 'needs_review'),
            sortingField: 'readiness_status'
          },
          {
            id: 'submissionStatus',
            header: 'Submission reason',
            cell: item => submissionReason(item)
          },
          {
            id: 'detail',
            header: 'Detail',
            cell: item => submissionDetail(item)
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
