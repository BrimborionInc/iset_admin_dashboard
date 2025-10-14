import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  Button,
  ButtonDropdown,
  Header,
  Link,
  Pagination,
  SpaceBetween,
  Table,
  TextFilter,
  CollectionPreferences,
  Alert,
} from '@cloudscape-design/components';
import { useHistory } from 'react-router-dom';
import { apiFetch } from '../auth/apiClient';

const BASE_COLUMN_DEFINITIONS = [
  {
    id: 'trackingId',
    header: 'Tracking ID',
    sortingField: 'trackingId',
    minWidth: 180,
    cell: item => <Link href={item.caseLink}>{item.trackingId}</Link>,
  },
  {
    id: 'applicantName',
    header: 'Applicant Name',
    sortingField: 'applicantName',
    isRowHeader: true,
    minWidth: 220,
    cell: item => item.applicantName,
  },
  {
    id: 'status',
    header: 'Status',
    sortingField: 'status',
    minWidth: 140,
    cell: item => item.status,
  },
  {
    id: 'assignedEmail',
    header: 'Assigned To (staff email)',
    sortingField: 'assignedEmail',
    minWidth: 240,
    cell: item => item.assignedEmail,
  },
  {
    id: 'lastActivity',
    header: 'Last Activity',
    sortingField: 'lastActivity',
    minWidth: 200,
    cell: item => item.lastActivity,
  },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_VISIBLE_COLUMNS = BASE_COLUMN_DEFINITIONS.map(col => col.id);

const MyWatchlistWidget = ({ actions }) => {
  const history = useHistory();
  const [rawItems, setRawItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [selectedItems, setSelectedItems] = useState([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [clearLoading, setClearLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    apiFetch('/api/me/case-watches')
      .then(response => {
        if (!response.ok) {
          throw new Error('fetch_failed');
        }
        return response.json();
      })
      .then(data => {
        if (cancelled) return;
        setRawItems(Array.isArray(data) ? data : []);
        setSelectedItems([]);
      })
      .catch(() => {
        if (cancelled) return;
        setRawItems([]);
        setError('Failed to load your watchlist. Please try again.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleRefresh = useCallback(() => {
    setReloadToken(token => token + 1);
    setCurrentPageIndex(1);
  }, []);

  const handleClearSelected = useCallback(async () => {
    const [selected] = selectedItems;
    const caseId = selected?.caseId;
    const numeric = Number(caseId);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setInfoMessage(null);
      setError('Cannot clear flag for this record. It may not have a case ID yet.');
      return;
    }

    setClearLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const response = await apiFetch(`/api/cases/${numeric}/watch`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('unwatch_failed');
      }

      setRawItems(prev => prev.filter(watch => Number(watch?.caseId) !== numeric));
      setSelectedItems([]);
      setInfoMessage('Flag removed. The case is no longer on your watchlist.');
    } catch (err) {
      console.error('[watchlist] clear flag failed', err);
      setError('Unable to remove this case from your watchlist. Please try again.');
    } finally {
      setClearLoading(false);
    }
  }, [selectedItems]);

  const handleCaseFollow = useCallback(
    (event, caseId) => {
      const numeric = Number(caseId);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return;
      }
      event.preventDefault();
      history.push({ pathname: `/application-case/${numeric}` });
    },
    [history]
  );

  const columnDefinitions = useMemo(
    () =>
      BASE_COLUMN_DEFINITIONS.map(column => {
        if (column.id !== 'trackingId') {
          return { ...column };
        }
        return {
          ...column,
          cell: item => (
            <Link
              href={item.caseLink}
              onFollow={event => handleCaseFollow(event, item.caseId)}
              ariaLabel={`Open case ${item.trackingId}`}
            >
              {item.trackingId}
            </Link>
          ),
        };
      }),
    [handleCaseFollow]
  );

  const items = useMemo(
    () =>
      rawItems.map((watch, index) => {
        const numericCaseId = Number(watch?.caseId);
        const caseId = Number.isFinite(numericCaseId) && numericCaseId > 0 ? numericCaseId : null;
        const trackingId = watch?.trackingId || (caseId ? `Case ${caseId}` : 'Unknown');
        const applicantName = watch?.applicantName || watch?.applicantEmail || 'Applicant unavailable';
        const status = watch?.status || 'Unknown';
        const assignedEmail = watch?.assignedStaffEmail || 'Unassigned';
        const lastActivity = watch?.lastActivityAt
          ? new Date(watch.lastActivityAt).toLocaleString()
          : 'Not available';
        return {
          ...watch,
          caseId,
          trackingId,
          applicantName,
          status,
          assignedEmail,
          lastActivity,
          caseLink: caseId ? `/application-case/${caseId}` : '#',
          __recordId:
            caseId !== null ? `case-${caseId}` : `watch-${index}-${watch?.createdAt || 'unknown'}`,
        };
      }),
    [rawItems]
  );

  const filteredItems = useMemo(() => {
    const text = filteringText.trim().toLowerCase();
    if (!text) return items;
    return items.filter(item =>
      [item.trackingId, item.applicantName, item.status, item.assignedEmail, item.lastActivity]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(text))
    );
  }, [filteringText, items]);

  const pagesCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentItems = useMemo(() => {
    const start = (currentPageIndex - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPageIndex, pageSize]);

  const tableColumns = useMemo(
    () => columnDefinitions.filter(column => visibleColumns.includes(column.id)),
    [columnDefinitions, visibleColumns]
  );

  const preferences = useMemo(
    () => ({
      pageSize,
      contentDisplay: columnDefinitions.map(column => ({
        id: column.id,
        visible: visibleColumns.includes(column.id),
      })),
    }),
    [columnDefinitions, pageSize, visibleColumns]
  );

  const columnPreferenceOptions = useMemo(
    () =>
      columnDefinitions.map(column => ({
        id: column.id,
        label: column.header,
        alwaysVisible: Boolean(column.isRowHeader),
      })),
    [columnDefinitions]
  );

  useEffect(() => {
    setCurrentPageIndex(prev => Math.min(prev, pagesCount));
  }, [pagesCount]);

  const headerContent = (
    <Header
      variant="h2"
      counter={`(${filteredItems.length})`}
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            onClick={handleClearSelected}
            loading={clearLoading}
            disabled={!selectedItems.length || clearLoading || loading}
          >
            Clear flag
          </Button>
          <Button
            iconName="refresh"
            variant="icon"
            onClick={handleRefresh}
            ariaLabel="Refresh watchlist"
            disabled={loading}
          />
        </SpaceBetween>
      }
    >
      My Watchlist
    </Header>
  );

  return (
    <BoardItem
      header={headerContent}
      settings={actions?.removeItem ? (
        <ButtonDropdown
          ariaLabel="Board item settings"
          variant="icon"
          items={[{ id: 'remove', text: 'Remove' }]}
          onItemClick={({ detail }) => {
            if (detail.id === 'remove') {
              actions.removeItem();
            }
          }}
        />
      ) : undefined}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription:
          'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription:
          'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
    >
      <SpaceBetween size="s">
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {infoMessage && (
          <Alert type="success" dismissible onDismiss={() => setInfoMessage(null)}>
            {infoMessage}
          </Alert>
        )}
        <Table
          columnDefinitions={tableColumns}
          items={currentItems}
          trackBy="__recordId"
          selectionType="single"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
          variant="embedded"
          stickyHeader
          resizableColumns
          stripedRows
          wrapLines
          loading={loading}
          loadingText="Loading watchlist"
          renderAriaLive={({ firstIndex, lastIndex }) =>
            `Displaying items ${firstIndex} to ${lastIndex} of ${filteredItems.length}`
          }
          ariaLabels={{
            tableLabel: 'My watchlist',
            header: 'My watchlist',
            rowHeader: 'Applicant Name',
          }}
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              <b>No watched cases</b>
            </Box>
          }
          filter={
            <TextFilter
              filteringPlaceholder="Filter watchlist"
              filteringText={filteringText}
              onChange={({ detail }) => {
                setFilteringText(detail.filteringText);
                setCurrentPageIndex(1);
              }}
              countText={`${filteredItems.length} ${filteredItems.length === 1 ? 'match' : 'matches'}`}
            />
          }
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
              onConfirm={({ detail }) => {
                setPageSize(detail.pageSize);
                const nextVisible = (detail.contentDisplay || [])
                  .filter(column => column.visible)
                  .map(column => column.id);
                setVisibleColumns(nextVisible.length ? nextVisible : DEFAULT_VISIBLE_COLUMNS);
                setCurrentPageIndex(1);
              }}
              pageSizePreference={{
                title: 'Page size',
                options: PAGE_SIZE_OPTIONS.map(value => ({ value, label: `${value} rows` })),
              }}
              contentDisplayPreference={{
                title: 'Select visible columns',
                options: columnPreferenceOptions,
              }}
            />
          }
        />
      </SpaceBetween>
    </BoardItem>
  );
};

export default MyWatchlistWidget;
