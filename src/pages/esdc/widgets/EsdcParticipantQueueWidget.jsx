import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
  Header,
  Table,
  Box,
  Badge,
  Link,
  CollectionPreferences,
  Pagination,
  ButtonDropdown,
  Button,
  Input,
  Modal,
  SpaceBetween,
  StatusIndicator
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';
import { apiFetch } from '../../../auth/apiClient';
import './EsdcParticipantQueueWidget.css';

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

const collectIssueLists = item => {
  let warnings = normalizeIssueList(item?.warnings);
  let blocking = normalizeIssueList(item?.blocking_issues);
  if (Array.isArray(item?.children) && item.children.length) {
    item.children.forEach(child => {
      warnings = warnings.concat(normalizeIssueList(child?.warnings));
      blocking = blocking.concat(normalizeIssueList(child?.blocking_issues));
    });
  }
  return {
    warnings: Array.from(new Set(warnings.filter(Boolean))),
    blocking: Array.from(new Set(blocking.filter(Boolean)))
  };
};

const submissionDetail = item => {
  if (!item.last_validated_at) return '—';
  const { warnings, blocking } = collectIssueLists(item);
  const readiness = (item.readiness_status || '').toLowerCase();
  const list = readiness === 'blocked' ? blocking : [...blocking, ...warnings];
  if (!list.length) return '—';
  const [first, ...rest] = list;
  return rest.length ? `${first} (+${rest.length} other issue${rest.length > 1 ? 's' : ''})` : first;
};

const primaryCaseId = item =>
  item?.case_id ||
  (Array.isArray(item?.children) ? item.children.find(child => child?.case_id)?.case_id : null) ||
  null;

const renderParticipantLink = item => {
  const label = item.participant_name || `Submission #${item.id}`;
  const caseId = primaryCaseId(item);
  return caseId ? <Link href={`/cases/${caseId}`}>{label}</Link> : label;
};

const summaryDefaults = { total: 0, ready: 0, needsReview: 0, blocked: 0 };

const preferencesKey = 'esdc-participant-queue-preferences-v1';

const defaultBatchFilename = () => `esdc-participants-${new Date().toISOString().slice(0, 10)}.xml`;

const normaliseXmlFilename = value => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return defaultBatchFilename();
  return trimmed.toLowerCase().endsWith('.xml') ? trimmed : `${trimmed}.xml`;
};

const downloadXmlFile = (xml, filename) => {
  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = normaliseXmlFilename(filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

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
  const [validatingAll, setValidatingAll] = useState(false);
  const [summary, setSummary] = useState(summaryDefaults);
  const [expandedItems, setExpandedItems] = useState([]);
  const [sorting, setSorting] = useState({
    sortingColumn: null,
    isDescending: false
  });
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchAlert, setBatchAlert] = useState(null);
  const [batchXml, setBatchXml] = useState('');
  const [batchSkipped, setBatchSkipped] = useState([]);
  const [batchParticipants, setBatchParticipants] = useState([]);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [filename, setFilename] = useState(defaultBatchFilename);
  const canUseNativeSaveDialog = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
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
        if (sorting.sortingColumn?.sortingField) {
          params.set('sortField', sorting.sortingColumn.sortingField);
          params.set('sortDirection', sorting.isDescending ? 'desc' : 'asc');
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
          setSummary(data.summary && typeof data.summary === 'object' ? { ...summaryDefaults, ...data.summary } : summaryDefaults);
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          setError(err.message || 'Failed to load participant submissions.');
          setItems([]);
          setTotalItems(0);
          setSummary(summaryDefaults);
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
  }, [currentPageIndex, preferences.pageSize, refreshTick, requestedReadiness, sorting]);

  const handleValidateAll = async () => {
    setValidatingAll(true);
    setError(null);
    try {
      const resp = await apiFetch('/api/esdc/participants/validate-all', { method: 'POST' });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(body.error || body.message || `Validation failed with ${resp.status}`);
      }
      setRefreshTick(tick => tick + 1);
      try {
        window.dispatchEvent(new CustomEvent('esdcParticipants:refresh'));
      } catch (_) {}
    } catch (err) {
      setError(err.message || 'Failed to validate participant submissions.');
    } finally {
      setValidatingAll(false);
    }
  };

  useEffect(() => {
    const handler = () => setRefreshTick(tick => tick + 1);
    window.addEventListener('esdcParticipants:refresh', handler);
    return () => window.removeEventListener('esdcParticipants:refresh', handler);
  }, []);

  const triggerSharedRefresh = () => {
    setRefreshTick(tick => tick + 1);
    try {
      window.dispatchEvent(new CustomEvent('esdcParticipants:refresh'));
    } catch (_) {}
  };

  const prepareBatch = async () => {
    setBatchLoading(true);
    setBatchAlert(null);
    setBatchXml('');
    setBatchSkipped([]);
    setBatchParticipants([]);
    try {
      const resp = await apiFetch('/api/esdc/participants/batch-prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setBatchAlert({
          type: 'error',
          message: body.error || body.message || 'Batch prepare failed.'
        });
        setBatchModalVisible(true);
        return;
      }
      const participants = Array.isArray(body.participants) ? body.participants : [];
      const skipped = Array.isArray(body.skipped) ? body.skipped : [];
      setBatchXml(body.xml || '');
      setBatchParticipants(participants);
      setBatchSkipped(skipped);
      setBatchAlert({
        type: participants.length ? 'success' : 'info',
        message: participants.length
          ? `Generated batch XML for ${participants.length} exportable participant${participants.length === 1 ? '' : 's'}.${skipped.length ? ` Excluded ${skipped.length} blocked record${skipped.length === 1 ? '' : 's'}.` : ''}`
          : (skipped.length
              ? `No exportable participants were available. ${skipped.length} blocked record${skipped.length === 1 ? '' : 's'} remain excluded until their ILMP blockers are resolved.`
              : 'No exportable participants were available for batch generation.')
      });
      setBatchModalVisible(true);
      triggerSharedRefresh();
    } catch (err) {
      setBatchAlert({ type: 'error', message: err?.message || 'Batch prepare failed.' });
      setBatchModalVisible(true);
    } finally {
      setBatchLoading(false);
    }
  };

  const submitBatch = async () => {
    setBatchLoading(true);
    setBatchAlert(null);
    let fileHandle = null;
    let selectedFilename = normaliseXmlFilename(filename);
    try {
      if (canUseNativeSaveDialog) {
        try {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: selectedFilename,
            types: [
              {
                description: 'XML file',
                accept: {
                  'application/xml': ['.xml'],
                  'text/xml': ['.xml']
                }
              }
            ]
          });
          selectedFilename = normaliseXmlFilename(fileHandle?.name || selectedFilename);
          setFilename(selectedFilename);
        } catch (err) {
          if (err?.name === 'AbortError') {
            return;
          }
          throw err;
        }
      }
      const resp = await apiFetch('/api/esdc/participants/batch-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedFilename })
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setBatchSkipped(Array.isArray(body.skipped) ? body.skipped : []);
        setBatchAlert({ type: 'error', message: body.error || body.message || 'Batch submit failed.' });
        setBatchXml('');
        return;
      }
      const participants = Array.isArray(body.participants) ? body.participants : [];
      const skipped = Array.isArray(body.skipped) ? body.skipped : [];
      setBatchXml(body.xml || '');
      setBatchParticipants(participants);
      setBatchSkipped(skipped);
      setBatchAlert({
        type: 'success',
        message: `Downloaded batch ${body.batchId || ''} for ${participants.length} exportable participant${participants.length === 1 ? '' : 's'}.${skipped.length ? ` Excluded ${skipped.length} blocked record${skipped.length === 1 ? '' : 's'}.` : ''}`
      });
      triggerSharedRefresh();
      if (body.xml) {
        if (fileHandle) {
          try {
            const writable = await fileHandle.createWritable();
            await writable.write(new Blob([body.xml], { type: 'text/xml;charset=utf-8;' }));
            await writable.close();
          } catch (err) {
            downloadXmlFile(body.xml, body.filename || selectedFilename);
            setBatchAlert({
              type: 'warning',
              message: `The native save dialog could not write the XML file, so PATH used the browser download instead. ${err?.message || ''}`.trim()
            });
          }
        } else {
          downloadXmlFile(body.xml, body.filename || selectedFilename);
        }
      }
      setBatchModalVisible(false);
    } catch (err) {
      setBatchAlert({ type: 'error', message: err?.message || 'Batch submit failed.' });
    } finally {
      setBatchLoading(false);
    }
  };

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

  const readinessBuckets = [
    {
      key: 'ready',
      label: 'Ready',
      value: summary.ready,
      description: 'Eligible for batch XML generation.'
    },
    {
      key: 'needs-review',
      label: 'Needs review',
      value: summary.needsReview,
      description: 'Warnings or soft mandatory gaps to check before submission.'
    },
    {
      key: 'blocked',
      label: 'Blocked',
      value: summary.blocked,
      description: 'Hard validation failures that must be fixed first.'
    }
  ];

  const issuesList = batchSkipped.length ? (
    <SpaceBetween size="xxs">
      <Box variant="strong">Excluded from batch</Box>
      <Box as="ul" padding={{ left: 'm' }}>
        {batchSkipped.map(item => (
          <li key={`${item.id}-${item.case_id || ''}`}>
            <Link href={item.case_id ? `/cases/${item.case_id}` : `/esdc/participants/${item.id}`}>
              {item.participant_name || item.tracking_id || `Submission #${item.id}`}
            </Link>
            {item.detail ? ` - ${item.detail}` : ''}
          </li>
        ))}
      </Box>
    </SpaceBetween>
  ) : null;

  return (
    <>
      <BoardItem
        header={(
          <Header
            variant="h2"
            info={infoLink}
            actions={(
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  loading={validatingAll}
                  onClick={handleValidateAll}
                  disabled={loading || totalItems === 0}
                >
                  Validate all
                </Button>
                <Button
                  variant="primary"
                  iconName="download"
                  loading={batchLoading}
                  onClick={prepareBatch}
                  disabled={loading || summary.ready === 0}
                >
                  Generate batch XML
                </Button>
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
        <SpaceBetween size="m">
          {batchAlert && (
            <Alert type={batchAlert.type} dismissible onDismiss={() => setBatchAlert(null)}>
              {batchAlert.message}
            </Alert>
          )}
          <div className="esdc-readiness-buckets">
            {readinessBuckets.map(bucket => (
              <div
                key={bucket.key}
                className={`esdc-readiness-bucket esdc-readiness-bucket--${bucket.key}`}
                aria-label={`${bucket.label}: ${bucket.value}. ${bucket.description}`}
              >
                <span className="esdc-readiness-bucket__marker" aria-hidden="true" />
                <div className="esdc-readiness-bucket__count">{bucket.value}</div>
                <div className="esdc-readiness-bucket__label">{bucket.label}</div>
                <div className="esdc-readiness-bucket__description">{bucket.description}</div>
              </div>
            ))}
          </div>
          <Table
            trackBy="id"
            columnDefinitions={[
              {
                id: 'participant',
                header: 'Participant',
                cell: renderParticipantLink,
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
                cell: item => submissionReason(item),
                sortingField: 'submission_reason'
              },
              {
                id: 'detail',
                header: 'Detail',
                cell: item => submissionDetail(item),
                sortingField: 'detail'
              }
            ]}
            items={pageItems}
            resizableColumns
            stickyHeader
            sortingColumn={sorting.sortingColumn}
            sortingDescending={sorting.isDescending}
            onSortingChange={({ detail }) => {
              setSorting({
                sortingColumn: detail.sortingColumn,
                isDescending: detail.isDescending
              });
              setCurrentPageIndex(1);
            }}
            loading={loading}
            loadingText="Loading participant submissions"
            empty={renderEmptyState()}
            variant="embedded"
            expandableRows={{
              getItemChildren: item => (Array.isArray(item.children) && item.children.length > 1 ? item.children : []),
              isItemExpandable: item => Array.isArray(item.children) && item.children.length > 1,
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
        </SpaceBetween>
      </BoardItem>
      <Modal
        visible={batchModalVisible}
        header="Generate batch XML"
        closeAriaLabel="Close batch XML modal"
        onDismiss={() => setBatchModalVisible(false)}
        footer={(
          <SpaceBetween size="xs" direction="horizontal">
            <Button variant="normal" onClick={() => setBatchModalVisible(false)}>Cancel</Button>
            <Button
              variant="primary"
              iconName="download"
              onClick={submitBatch}
              loading={batchLoading}
              disabled={!batchXml || batchParticipants.length === 0}
            >
              {canUseNativeSaveDialog ? 'Save XML and mark exported' : 'Download XML and mark exported'}
            </Button>
          </SpaceBetween>
        )}
      >
        <SpaceBetween size="m">
          {batchAlert && (
            <Alert type={batchAlert.type}>
              {batchAlert.message}
            </Alert>
          )}
          {batchLoading && <StatusIndicator type="loading">Preparing batch XML</StatusIndicator>}
          <div className="esdc-batch-modal-summary" aria-label="Batch XML summary">
            <div>
              <div className="esdc-batch-modal-summary__value">{batchParticipants.length}</div>
              <div className="esdc-batch-modal-summary__label">Ready participants</div>
            </div>
            <div>
              <div className="esdc-batch-modal-summary__value">{batchSkipped.length}</div>
              <div className="esdc-batch-modal-summary__label">Excluded records</div>
            </div>
          </div>
          {issuesList}
          <SpaceBetween size="xs">
            <Box variant="strong">Filename</Box>
            <Input
              value={filename}
              onChange={({ detail }) => setFilename(detail.value)}
              spellcheck={false}
            />
          </SpaceBetween>
        </SpaceBetween>
      </Modal>
    </>
  );
};

export default EsdcParticipantQueueWidget;
