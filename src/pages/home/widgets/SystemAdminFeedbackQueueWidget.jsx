import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Header,
  Link,
  Pagination,
  Select,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import { apiFetch } from '../../../auth/apiClient';
import HomeSystemAdminFeedbackQueueHelp from '../../../helpPanelContents/homeSystemAdminFeedbackQueueHelp.js';
import {
  REPORT_TYPE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  formatFeedbackRelativeTime,
  formatFeedbackTimestamp,
  getReportTypeLabel,
  getSeverityLabel,
  getStatusIndicatorType,
  getStatusLabel,
} from '../../../features/adminFeedback/constants.js';

const boardItemI18nStrings = {
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
};

const PAGE_SIZE = 8;

async function parseJson(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed (${response.status}).`);
  }
  return payload;
}

function openFeedbackComposer(reportType = 'bug') {
  try {
    window.dispatchEvent(
      new CustomEvent('admin-feedback:open-composer', {
        detail: { reportType },
      })
    );
  } catch (_) {}
}

function openFeedbackReview(reportId) {
  try {
    window.dispatchEvent(
      new CustomEvent('admin-feedback:open-review', {
        detail: { reportId },
      })
    );
  } catch (_) {}
}

export default function SystemAdminFeedbackQueueWidget({
  actions,
  refreshKey = 0,
  toggleHelpPanel,
}) {
  const [reports, setReports] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [reportTypeFilter, setReportTypeFilter] = useState('all');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchText]);

  useEffect(() => {
    setCurrentPageIndex(1);
  }, [debouncedSearch, reportTypeFilter, statusFilter]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(Math.max(0, (currentPageIndex - 1) * PAGE_SIZE)),
        status: statusFilter,
        reportType: reportTypeFilter,
      });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      const payload = await parseJson(
        await apiFetch(`/api/dashboard/admin-feedback-reports?${params.toString()}`)
      );
      setReports(Array.isArray(payload?.items) ? payload.items : []);
      setMetrics(payload?.metrics || null);
      setTotalItems(Number(payload?.total || 0));
    } catch (loadError) {
      setReports([]);
      setMetrics(null);
      setTotalItems(0);
      setError(loadError?.message || 'Failed to load bug and change-request reports.');
    } finally {
      setLoading(false);
    }
  }, [currentPageIndex, debouncedSearch, reportTypeFilter, statusFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports, refreshKey, refreshNonce]);

  useEffect(() => {
    const handleChanged = () => setRefreshNonce(value => value + 1);
    window.addEventListener('admin-feedback:changed', handleChanged);
    return () => window.removeEventListener('admin-feedback:changed', handleChanged);
  }, []);

  const infoLink = toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(
          <HomeSystemAdminFeedbackQueueHelp />,
          'Bugs and Change Requests',
          HomeSystemAdminFeedbackQueueHelp.aiContext || ''
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  const statusFilterOption = STATUS_FILTER_OPTIONS.find(option => option.value === statusFilter) || STATUS_FILTER_OPTIONS[0];
  const reportTypeFilterOption = REPORT_TYPE_FILTER_OPTIONS.find(option => option.value === reportTypeFilter) || REPORT_TYPE_FILTER_OPTIONS[0];

  const metricItems = useMemo(
    () => [
      {
        id: 'awaitingTriage',
        label: 'Awaiting triage',
        value: Number(metrics?.awaitingTriage || 0),
        description: 'Newly submitted reports that still need an initial review.',
      },
      {
        id: 'highPriorityOpen',
        label: 'High / critical open',
        value: Number(metrics?.highPriorityOpen || 0),
        description: 'Open reports marked high or critical severity.',
      },
      {
        id: 'inProgress',
        label: 'In progress',
        value: Number(metrics?.inProgress || 0),
        description: 'Reports currently being triaged, planned, or actively worked.',
      },
      {
        id: 'openChangeRequests',
        label: 'Open change requests',
        value: Number(metrics?.openChangeRequests || 0),
        description: 'Open requests for workflow or interface changes.',
      },
    ],
    [metrics]
  );

  const columnDefinitions = useMemo(
    () => [
      {
        id: 'submittedAt',
        header: 'Submitted',
        cell: item => (
          <SpaceBetween size="xxs">
            <Box>{formatFeedbackTimestamp(item.submittedAt)}</Box>
            <Box color="text-status-inactive">{formatFeedbackRelativeTime(item.submittedAt)}</Box>
          </SpaceBetween>
        ),
        minWidth: 170,
      },
      {
        id: 'type',
        header: 'Type',
        cell: item => getReportTypeLabel(item.reportType),
        minWidth: 140,
      },
      {
        id: 'severity',
        header: 'Severity',
        cell: item => getSeverityLabel(item.severity),
        minWidth: 110,
      },
      {
        id: 'status',
        header: 'Status',
        cell: item => (
          <StatusIndicator type={getStatusIndicatorType(item.status)}>
            {getStatusLabel(item.status)}
          </StatusIndicator>
        ),
        minWidth: 130,
      },
      {
        id: 'summary',
        header: 'Summary',
        cell: item => (
          <SpaceBetween size="xxs">
            <Box fontWeight="bold">{item.summary || 'Untitled report'}</Box>
            <Box color="text-status-inactive">
              {item.attachmentCount ? `${item.attachmentCount} attachment${item.attachmentCount === 1 ? '' : 's'}` : 'No attachments'}
            </Box>
          </SpaceBetween>
        ),
        minWidth: 250,
      },
      {
        id: 'reporter',
        header: 'Reporter',
        cell: item => (
          <SpaceBetween size="xxs">
            <Box>{item.submittedByName || 'Unknown'}</Box>
            {item.submittedByEmail ? (
              <Box color="text-status-inactive">{item.submittedByEmail}</Box>
            ) : null}
          </SpaceBetween>
        ),
        minWidth: 180,
      },
      {
        id: 'page',
        header: 'Captured page',
        cell: item => (
          <SpaceBetween size="xxs">
            <Box>{item.pageTitle || item.pagePath || 'PATH page'}</Box>
            {item.pagePath ? (
              <Box color="text-status-inactive">{item.pagePath}</Box>
            ) : null}
          </SpaceBetween>
        ),
        minWidth: 220,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: item => (
          <Link
            href="#"
            onFollow={event => {
              event.preventDefault();
              openFeedbackReview(item.id);
            }}
          >
            Open review
          </Link>
        ),
        minWidth: 120,
      },
    ],
    []
  );

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          counter={totalItems ? `(${totalItems})` : undefined}
          actions={(
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={() => openFeedbackComposer('bug')}>Report</Button>
              <Button onClick={loadReports} disabled={loading}>
                Refresh
              </Button>
            </SpaceBetween>
          )}
        >
          Bugs and Change Requests
        </Header>
      )}
      settings={
        actions?.removeItem ? (
          <ButtonDropdown
            ariaLabel="Bugs and Change Requests settings"
            variant="icon"
            items={[{ id: 'remove', text: 'Remove widget' }]}
            onItemClick={({ detail }) => {
              if (detail.id === 'remove') {
                actions.removeItem();
              }
            }}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {error ? <Alert type="error">{error}</Alert> : null}

        <ColumnLayout columns={4} variant="text-grid">
          {metricItems.map(metric => (
            <Box key={metric.id} padding={{ right: 's' }}>
              <SpaceBetween size="xxs">
                <Box variant="awsui-key-label">{metric.label}</Box>
                <Box variant="strong" fontSize="display-l">
                  {loading ? '...' : metric.value}
                </Box>
                <Box variant="small" color="text-body-secondary">
                  {metric.description}
                </Box>
              </SpaceBetween>
            </Box>
          ))}
        </ColumnLayout>

        <SpaceBetween size="s">
          <div style={{ display: 'flex', alignItems: 'end', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '220px', flex: '1 1 280px' }}>
              <TextFilter
                filteringText={searchText}
                filteringPlaceholder="Search summary, reporter, or page"
                onChange={({ detail }) => setSearchText(detail.filteringText)}
              />
            </div>
            <div style={{ minWidth: '180px' }}>
              <Select
                selectedOption={statusFilterOption}
                options={STATUS_FILTER_OPTIONS}
                onChange={({ detail }) => setStatusFilter(detail.selectedOption?.value || 'open')}
              />
            </div>
            <div style={{ minWidth: '180px' }}>
              <Select
                selectedOption={reportTypeFilterOption}
                options={REPORT_TYPE_FILTER_OPTIONS}
                onChange={({ detail }) => setReportTypeFilter(detail.selectedOption?.value || 'all')}
              />
            </div>
          </div>

          <Table
            items={reports}
            loading={loading}
            loadingText="Loading bug and change-request reports"
            columnDefinitions={columnDefinitions}
            wrapLines
            stickyHeader
            variant="embedded"
            resizableColumns
            empty={(
              <Box padding="m" color="text-body-secondary">
                No reports match the current filters.
              </Box>
            )}
            pagination={(
              <Pagination
                currentPageIndex={currentPageIndex}
                pagesCount={Math.max(1, Math.ceil(totalItems / PAGE_SIZE))}
                onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
              />
            )}
          />
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
}
