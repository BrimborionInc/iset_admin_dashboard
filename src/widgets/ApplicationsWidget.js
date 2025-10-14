import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Header,
  Table,
  Spinner,
  TextFilter,
  Pagination,
  CollectionPreferences,
  SpaceBetween,
  StatusIndicator,
  Badge,
  Button,
  ButtonDropdown,
  Modal,
  FormField,
  Select,
  Alert,
  Toggle
} from '@cloudscape-design/components';
import Icon from '@cloudscape-design/components/icon';
import { BoardItem } from '@cloudscape-design/board-components';
import { useHistory } from 'react-router-dom';
import { apiFetch } from '../auth/apiClient';
import useCurrentUser from '../hooks/useCurrentUser';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_VISIBLE_COLUMNS = ['watch','tracking_id','status','lock_state','sla_risk','assigned_user_email','submitted_at','actions'];
const COLUMN_WIDTHS_STORAGE_KEY = 'applications-widget-column-widths';

const loadStoredColumnWidths = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(entry => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const id = typeof entry.id === 'string' ? entry.id : null;
        const numericWidth = Number(entry.width);
        if (!id || !Number.isFinite(numericWidth)) {
          return null;
        }
        return { id, width: numericWidth };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('[applications] failed to read stored column widths', error);
    return [];
  }
};

const persistColumnWidths = (widths) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!Array.isArray(widths) || widths.length === 0) {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(widths));
    }
  } catch (error) {
    console.error('[applications] failed to persist column widths', error);
  }
};

const computeSlaMeta = (row) => {
  // Placeholder: assume SLA due 14 days after submitted_at until backend provides sla_due_at
  const submitted = new Date(row.submitted_at);
  const now = Date.now();
  const ageDays = Math.floor((now - submitted.getTime()) / 86400000);
  const due = row.sla_due_at ? new Date(row.sla_due_at) : new Date(submitted.getTime() + 14 * 86400000);
  const overdue = Date.now() > due.getTime();
  return { ageDays, due, overdue };
};

const ApplicationsWidget = ({ actions, refreshKey }) => {
  const history = useHistory();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [columnWidths, setColumnWidths] = useState(() => loadStoredColumnWidths());
  const [selectedItems, setSelectedItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTargetCase, setAssignTargetCase] = useState(null);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignableLoading, setAssignableLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState(null); // Cloudscape Select expects {label,value}
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [watchMap, setWatchMap] = useState(() => new Map());
  const [watchLoading, setWatchLoading] = useState(true);
  const [watchPending, setWatchPending] = useState(new Set());
  const [showWatchedOnly, setShowWatchedOnly] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const {
    userId: currentUserIdRaw,
    displayName: currentUserName,
    role: currentUserRole,
  } = useCurrentUser();
  const currentUserId = currentUserIdRaw ? String(currentUserIdRaw) : null;
  const userRole = currentUserRole || '';
  const normalizedUserRole = userRole.trim();

  const detailColumns = useMemo(() => {
    const lockCell = (row) => {
      if (row.is_unassigned) return '-';
      const ownerId = row.lock_owner_id ? String(row.lock_owner_id) : null;
      const ownerName = row.lock_owner_name || row.lock_owner_email || null;
      if (!ownerId && !ownerName) {
        return <Badge color="green">Available</Badge>;
      }
      const isSelf = currentUserId && ownerId && currentUserId === ownerId;
      const display = isSelf ? (currentUserName || 'You') : (ownerName || 'In use');
      const expires = row.lock_expires_at ? new Date(row.lock_expires_at) : null;
      const meta = expires ? ` (expires ${expires.toLocaleTimeString()})` : '';
      const type = isSelf ? 'success' : 'warning';
      return (
        <StatusIndicator type={type} ariaLabel={isSelf ? 'Locked by you' : `Locked by ${display}`}>
          {display}{meta}
        </StatusIndicator>
      );
    };

    return [
      { id: 'tracking_id', header: 'Case / Submission ID', cell: i => i.tracking_id, minWidth: 140, isRowHeader: true },
      {
        id: 'status',
        header: 'Status',
        cell: i => {
          let rawStatus = i.case_id ? (i.status || 'submitted') : 'New';
          const unassigned = i.case_id && !i.assigned_user_id && ['open','submitted'].includes(rawStatus.toLowerCase());
          const display = unassigned ? 'Unassigned' : (rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1));
          const type = unassigned ? 'pending' : (!i.case_id ? 'pending' : (display === 'Closed' ? 'success' : (i.sla_risk === 'overdue' ? 'warning' : 'info')));
          return <StatusIndicator type={type}>{display}</StatusIndicator>;
        },
        minWidth: 120
      },
      {
        id: 'lock_state',
        header: 'In Use',
        cell: lockCell,
        minWidth: 200
      },
      {
        id: 'sla_risk',
        header: 'SLA Health',
        cell: i => {
          const meta = computeSlaMeta(i);
          const badge = meta.overdue ? <Badge color="red">Overdue</Badge> : <Badge color="green">OK</Badge>;
          return (
            <span title={`Age: ${meta.ageDays}d | Due: ${meta.due.toLocaleDateString()}${meta.overdue ? ' (Overdue)' : ''}`} aria-label={`SLA ${meta.overdue ? 'Overdue' : 'OK'}; Age ${meta.ageDays} days; Due ${meta.due.toLocaleDateString()}`}>{badge}</span>
          );
        },
        minWidth: 110
      },
      { id: 'assigned_user_email', header: 'Owner', cell: i => i.case_id ? (i.assigned_user_email || '-') : 'Unassigned', minWidth: 200 },
      { id: 'submitted_at', header: 'Received', cell: i => new Date(i.submitted_at).toLocaleDateString(), minWidth: 140 },
    ];
  }, [currentUserId, currentUserName]);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    apiFetch(`/api/applications?limit=${pageSize}&offset=${(currentPageIndex-1)*pageSize}`)
      .then(res => { if (!res.ok) throw new Error('Fetch failed'); return res.json(); })
      .then(data => { if (!cancelled) { setItems(data.rows || []); setTotalCount(data.count || (data.rows ? data.rows.length : 0)); } })
      .catch(() => { if (!cancelled) setError('Failed to load applications'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pageSize, currentPageIndex]);

  useEffect(() => {
    const c = load();
    return c;
  }, [load, refreshKey]);

  useEffect(() => {
    persistColumnWidths(columnWidths);
  }, [columnWidths]);

  const addAlert = useCallback((alert) => {
    setAlerts(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, ...alert }]);
  }, []);
  const dismissAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const loadWatchList = useCallback(() => {
    let cancelled = false;
    setWatchLoading(true);
    apiFetch('/api/me/case-watches')
      .then((res) => {
        if (!res.ok) {
          const error = new Error(`HTTP ${res.status}`);
          error.status = res.status;
          throw error;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const map = new Map();
        (Array.isArray(data) ? data : []).forEach((entry) => {
          const caseId = Number(entry?.caseId ?? entry?.case_id);
          if (Number.isFinite(caseId) && caseId > 0) {
            map.set(caseId, entry);
          }
        });
        setWatchMap(map);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[applications] failed to load watchlist', error);
        addAlert({
          type: 'error',
          header: 'Watchlist unavailable',
          content: 'We could not load your flagged cases. Flag indicators may be incomplete until the page is refreshed.',
        });
      })
      .finally(() => {
        if (!cancelled) {
          setWatchLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [addAlert]);

  useEffect(() => {
    const cleanup = loadWatchList();
    return cleanup;
  }, [loadWatchList, refreshKey, currentUserId]);

  const handleAssignSubmit = useCallback(async () => {
    if (!assignTargetCase || !selectedAssignee) return;
    if (!assignTargetCase.case_id) {
      setAssignError('Case details are unavailable; cannot assign.');
      return;
    }

    setAssignSubmitting(true);
    setAssignError(null);

    const chosen = selectedAssignee.value;
    const staffObj = assignableStaff.find(s => String(s.id) === String(chosen));
    const payload = {};

    if (chosen && String(chosen).startsWith('placeholder-')) {
      payload.placeholder_email = staffObj?.email || 'user@nwac.ca';
    } else {
      payload.assignee_id = chosen;
    }

    const shouldPromoteStatus = (assignTargetCase.status || '').toLowerCase() === 'submitted';
    const isReassign = Boolean(assignTargetCase?.assigned_user_id);
    const trackingLabel = assignTargetCase?.tracking_id || assignTargetCase?.case_id;
    const assigneeLabel = selectedAssignee?.label;
    try {
      const response = await apiFetch(`/api/cases/${assignTargetCase.case_id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('assign_failed');
      }

      if (shouldPromoteStatus) {
        const statusResponse = await apiFetch(`/api/cases/${assignTargetCase.case_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'in_review' }),
        });

        if (!statusResponse.ok) {
          addAlert({
            type: 'warning',
            header: 'Status update failed',
            content: `Case ${trackingLabel} was assigned but could not be moved to In Review. Please refresh and try again.`
          });
          throw new Error('status_update_failed');
        }
      }

      setAssignSubmitting(false);
      setAssignModalVisible(false);
      setAssignTargetCase(null);
      setSelectedAssignee(null);
      load();
      addAlert({
        type: 'success',
        header: isReassign ? 'Case reassigned' : 'Case assigned',
        content: `Case ${trackingLabel} ${isReassign ? 'reassigned' : 'assigned'} to ${assigneeLabel || 'selected staff'}.`
      });
    } catch (error) {
      setAssignSubmitting(false);
      if (error?.message === 'status_update_failed') {
        setAssignError('Case assigned but status update to In Review failed. Please refresh and try again.');
        load();
      } else {
        setAssignError('Assignment failed');
        addAlert({
          type: 'error',
          header: 'Assignment failed',
          content: `Case ${trackingLabel} could not be assigned. Please try again.`
        });
      }
    }
  }, [assignTargetCase, selectedAssignee, assignableStaff, load, addAlert]);

  const handleToggleWatch = useCallback(async (item) => {
    const caseIdNumeric = Number(item?.case_id ?? item?.__caseIdNumeric);
    if (!Number.isFinite(caseIdNumeric) || caseIdNumeric <= 0) {
      addAlert({
        type: 'info',
        header: 'Flag not available',
        content: 'This record does not yet have a case ID. Open the case to create one before flagging it.',
      });
      return;
    }
    const caseId = caseIdNumeric;
    const isCurrentlyWatched = watchMap.has(caseId);

    setWatchPending((prev) => {
      const next = new Set(prev);
      next.add(caseId);
      return next;
    });

    try {
      const response = await apiFetch(`/api/cases/${caseId}/watch`, {
        method: isCurrentlyWatched ? 'DELETE' : 'POST',
        headers: isCurrentlyWatched ? undefined : { 'Content-Type': 'application/json' },
        body: isCurrentlyWatched ? undefined : JSON.stringify({}),
      });

      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok || (body && body.error)) {
        const err = new Error(body?.error || 'watch_failed');
        err.status = response.status;
        throw err;
      }

      if (isCurrentlyWatched) {
        setWatchMap((prev) => {
          const next = new Map(prev);
          next.delete(caseId);
          return next;
        });
        addAlert({
          type: 'info',
          header: 'Case unflagged',
          content: `${item.tracking_id || `Case ${caseId}`} removed from your watchlist.`,
        });
      } else {
        const watchEntry = body?.watch || { caseId };
        setWatchMap((prev) => {
          const next = new Map(prev);
          next.set(caseId, watchEntry);
          return next;
        });
        addAlert({
          type: 'success',
          header: 'Case flagged',
          content: `${item.tracking_id || `Case ${caseId}`} added to your watchlist.`,
        });
      }
    } catch (error) {
      console.error('[applications] watch toggle failed', error);
      addAlert({
        type: 'error',
        header: 'Watch action failed',
        content: 'We could not update your watchlist. Please try again.',
      });
    } finally {
      setWatchPending((prev) => {
        const next = new Set(prev);
        next.delete(caseId);
        return next;
      });
    }
  }, [watchMap, addAlert]);

  const decoratedItems = useMemo(() => {
    return items.map((item) => {
      const numericCaseId = Number(item.case_id);
      const caseId = Number.isFinite(numericCaseId) && numericCaseId > 0 ? numericCaseId : null;
      const watched = caseId ? watchMap.has(caseId) : false;
      return {
        ...item,
        __caseIdNumeric: caseId,
        __isWatched: watched,
      };
    });
  }, [items, watchMap]);

  // Client filtering (post-fetch) for quick text search; can be pushed server-side later
  const filteredItems = decoratedItems
    .filter(i => {
      const s = filteringText.toLowerCase();
      return !s || [i.tracking_id, i.status, i.assigned_user_email, i.ptma_codes, i.lock_owner_name, i.lock_owner_email]
        .some(v => v && String(v).toLowerCase().includes(s));
    })
    .filter(i => !showWatchedOnly || i.__isWatched);

  const watchColumn = useMemo(() => ({
    id: 'watch',
    header: 'Flag',
    minWidth: 45,
    cell: (item) => {
      const caseId = item.__caseIdNumeric ?? Number(item.case_id);
      const isWatchable = Number.isFinite(caseId) && caseId > 0;
      const isWatched = Boolean(item.__isWatched);
      const pending = isWatchable && watchPending.has(caseId);
      const icon = (
        <Icon
          name="flag"
          size="small"
          variant={isWatched ? 'error' : 'normal'}
        />
      );
      return (
        <Button
          variant="icon"
          iconSvg={icon}
          disabled={!isWatchable || pending}
          ariaLabel={isWatched ? 'Unflag case' : 'Flag case'}
          onClick={() => handleToggleWatch(item)}
          title={!isWatchable ? 'Case record not yet created' : (isWatched ? 'Remove flag' : 'Flag this case')}
        />
      );
    },
  }), [handleToggleWatch, watchPending]);

  const actionsColumn = {
    id: 'actions', header: 'Actions', minWidth: 160, cell: item => {
      const unassigned = item.case_id && !item.assigned_user_id && ['open','submitted'].includes((item.status || '').toLowerCase());
      const reassignRoles = ['Program Administrator','Regional Coordinator','System Administrator'];
      const canReassign = item.case_id && item.assigned_user_id && reassignRoles.includes(normalizedUserRole);
      const lockOwnerId = item.lock_owner_id ? String(item.lock_owner_id) : null;
      const lockOwnerName = item.lock_owner_name || item.lock_owner_email || (lockOwnerId ? `User ${lockOwnerId}` : null);
      const lockedByMe = lockOwnerId && currentUserId && lockOwnerId === currentUserId;
      const lockedByAnother = lockOwnerId && !lockedByMe;
      const lockExpiresAt = item.lock_expires_at ? new Date(item.lock_expires_at) : null;
      const lockExpiryNote = lockExpiresAt && !Number.isNaN(lockExpiresAt.getTime())
        ? ` (expires ${lockExpiresAt.toLocaleTimeString()})`
        : '';
      const lockMessage = lockedByAnother ? `Locked by ${lockOwnerName || 'another user'}${lockExpiryNote}` : null;

      const openAssignModal = (caseItem, preselectId, options = {}) => {
        if (options.lockBlocked) {
          addAlert({
            type: 'warning',
            header: 'Assignment blocked',
            content: options.reason || 'This record is currently locked by another staff member. Try again once it is released.',
          });
          return;
        }
        setAssignTargetCase(caseItem); setAssignModalVisible(true); setSelectedAssignee(null); setAssignError(null);
        setAssignableLoading(true);
        apiFetch('/api/staff/assignable')
          .then(r => { if(!r.ok) throw new Error('fetch_failed'); return r.json(); })
          .then(list => {
            setAssignableStaff(list || []);
            if (preselectId) {
              const found = list.find(s => String(s.id) === String(preselectId) || s.email === caseItem.assigned_user_email);
              if (found) {
                setSelectedAssignee({ label: `${found.display_name || found.email} (${found.role || 'Staff'})`, value: String(found.id) });
              } else if (caseItem.assigned_user_email) {
                // Add current assignee if not in list
                const tempOpt = { label: `${caseItem.assigned_user_email} (Current)`, value: String(preselectId) };
                setSelectedAssignee(tempOpt);
              }
            }
          })
          .catch(() => {
            setAssignError('Failed to load staff');
            addAlert({ type: 'error', header: 'Unable to load staff', content: 'Could not load assignable staff list.' });
          })
          .finally(() => setAssignableLoading(false));
      };
      return (
        <SpaceBetween size="xxs">
          <SpaceBetween direction="horizontal" size="xs">
          {item.case_id && (
            <Button
              variant="inline-link"
              onClick={() => history.push({ pathname: `/application-case/${item.case_id}`, state: { assessorEmail: item.assigned_user_email } })}
            >
              View
            </Button>
          )}
          {unassigned && (
            <Button
              variant="inline-link"
              onClick={() => openAssignModal(item, null, { lockBlocked: lockedByAnother, reason: lockMessage })}
              disabled={lockedByAnother}
              ariaLabel={lockedByAnother ? `Assign disabled: ${lockMessage}` : undefined}
            >
              Assign
            </Button>
          )}
          {canReassign && (
            <Button
              variant="inline-link"
              onClick={() => openAssignModal(item, item.assigned_user_id, { lockBlocked: lockedByAnother, reason: lockMessage })}
              disabled={lockedByAnother}
              ariaLabel={lockedByAnother ? `Reassign disabled: ${lockMessage}` : undefined}
            >
              Reassign
            </Button>
          )}
          {!item.case_id && <span style={{ color: '#888' }}>-</span>}
          </SpaceBetween>
          {lockedByAnother && (
            <Box fontSize="body-s" color="text-status-inactive">
              {lockMessage}
            </Box>
          )}
        </SpaceBetween>
      );
    }
  };
  const widthOverrides = useMemo(() => {
    const map = new Map();
    columnWidths.forEach(({ id, width }) => {
      if (typeof id === 'string' && Number.isFinite(width)) {
        map.set(id, width);
      }
    });
    return map;
  }, [columnWidths]);

  const applyWidth = useCallback((column) => {
    if (!column) {
      return null;
    }
    const override = widthOverrides.get(column.id);
    if (typeof override === 'number' && !Number.isNaN(override)) {
      return { ...column, width: override };
    }
    return column;
  }, [widthOverrides]);

  const allColumns = useMemo(() => {
    const base = [
      watchColumn,
      detailColumns.find(column => column.id === 'tracking_id'),
      detailColumns.find(column => column.id === 'status'),
      detailColumns.find(column => column.id === 'lock_state'),
      detailColumns.find(column => column.id === 'sla_risk'),
      detailColumns.find(column => column.id === 'assigned_user_email'),
      detailColumns.find(column => column.id === 'submitted_at'),
      actionsColumn,
    ].filter(Boolean);
    return base.map(applyWidth).filter(Boolean);
  }, [watchColumn, detailColumns, actionsColumn, applyWidth]);

  const columnDefinitionsForTable = useMemo(() => (
    allColumns.filter(c => visibleColumns.includes(c.id) || c.id === 'actions' || c.id === 'watch')
  ), [allColumns, visibleColumns]);

  const allColumnIds = useMemo(() => allColumns.map(column => column.id), [allColumns]);

  const baseColumnsForPreferences = useMemo(() => [watchColumn, ...detailColumns], [watchColumn, detailColumns]);

  const mergeColumnWidths = useCallback((updates) => {
    if (!Array.isArray(updates) || updates.length === 0) {
      return;
    }

    setColumnWidths(prev => {
      const validIds = new Set(allColumnIds);
      const map = new Map();

      prev.forEach(({ id, width }) => {
        if (validIds.has(id) && Number.isFinite(width)) {
          map.set(id, width);
        }
      });

      updates.forEach(({ id, width }) => {
        if (!id || !validIds.has(id)) {
          return;
        }
        const numericWidth = Number(width);
        if (Number.isFinite(numericWidth)) {
          map.set(id, numericWidth);
        }
      });

      const ordered = [];
      allColumnIds.forEach(id => {
        if (map.has(id)) {
          ordered.push({ id, width: map.get(id) });
          map.delete(id);
        }
      });

      map.forEach((width, id) => {
        ordered.push({ id, width });
      });

      return ordered;
    });
  }, [allColumnIds]);

  const handleColumnWidthsChange = useCallback(({ detail }) => {
    if (!detail) {
      return;
    }

    const next = [];

    if (Array.isArray(detail.columnWidths)) {
      detail.columnWidths.forEach(entry => {
        if (!entry || typeof entry !== 'object') {
          return;
        }
        const { id, width } = entry;
        if (typeof id === 'string' && Number.isFinite(Number(width))) {
          next.push({ id, width: Number(width) });
        }
      });
    } else if (Array.isArray(detail.widths)) {
      detail.widths.forEach((width, index) => {
        const column = columnDefinitionsForTable[index];
        if (column && Number.isFinite(Number(width))) {
          next.push({ id: column.id, width: Number(width) });
        }
      });
    }

    if (next.length > 0) {
      mergeColumnWidths(next);
    }
  }, [columnDefinitionsForTable, mergeColumnWidths]);

  const effectiveTotal = showWatchedOnly ? filteredItems.length : totalCount;
  const pagesCount = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const preferences = {
    pageSize,
    contentDisplay: baseColumnsForPreferences.map(c => ({ id: c.id, visible: visibleColumns.includes(c.id) })),
    columnWidths,
  };
  const columnPreferenceOptions = [
    { id: 'watch', label: 'Flag', alwaysVisible: true },
    ...detailColumns.map(c => ({
      id: c.id,
      label: typeof c.header === 'string' ? c.header : c.id,
      alwaysVisible: c.id === 'tracking_id'
    })),
    { id: 'actions', label: 'Actions', alwaysVisible: true }
  ];

  const headerContent = (
    <Header
      variant="h2"
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Toggle
              checked={showWatchedOnly}
              onChange={({ detail }) => setShowWatchedOnly(detail.checked)}
            >
              My watched cases
            </Toggle>
            {watchLoading && <Spinner size="small" />}
          </div>
          <Button
            iconName="refresh"
            onClick={() => { setCurrentPageIndex(1); load(); }}
            ariaLabel="Refresh applications"
          />
        </SpaceBetween>
      }
    >
      ISET Applications
    </Header>
  );

  return (
    <BoardItem
      header={headerContent}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={<ButtonDropdown items={[{ id: 'remove', text: 'Remove' }]} ariaLabel="Board item settings" variant="icon" onItemClick={() => actions?.removeItem?.()} />}
    >
      <SpaceBetween direction="vertical" size="xs">
        {alerts.map(alert => (
          <Alert
            key={alert.id}
            type={alert.type}
            header={alert.header}
            dismissible
            onDismiss={() => dismissAlert(alert.id)}
          >
            {alert.content}
          </Alert>
        ))}
        <Box variant="small">The table shows applications in your purview.  Progam Admins can see all applications. Regional Coordinators can see applications assigned to them, or to assessors in their region.  Assessors can only see applications assigned to them.</Box>
        <Box>
          <SpaceBetween direction="vertical" size="xs">
            {loading ? (
              <Box textAlign="center" padding="m"><Spinner /> Loading...</Box>
            ) : error ? (
              <Box color="error" textAlign="center">{error}</Box>
            ) : (
              <Table
                columnDefinitions={columnDefinitionsForTable}
                items={filteredItems}
                loading={false}
                variant="embedded"
                wrapLines
                resizableColumns
                onColumnWidthsChange={handleColumnWidthsChange}
                stickyHeader
                stripedRows
                selectionType="multi"
                selectedItems={selectedItems}
                onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
                empty={<Box textAlign="center">No cases</Box>}
                ariaLabels={{
                  selectionGroupLabel: 'Cases',
                  allItemsSelectionLabel: () => 'select all',
                  itemSelectionLabel: ({ selectedItems }, item) => item.tracking_id,
                  tableLabel: 'Cases table',
                  header: 'Cases',
                  rowHeader: 'Case ID'
                }}
                renderAriaLive={({ firstIndex, lastIndex }) => `Displaying items ${firstIndex} to ${lastIndex}`}
                filter={<TextFilter filteringPlaceholder="Search" filteringText={filteringText} onChange={({ detail }) => { setFilteringText(detail.filteringText); setCurrentPageIndex(1); }} />}
                pagination={<Pagination currentPageIndex={currentPageIndex} pagesCount={pagesCount} onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)} />}
                preferences={
                  <CollectionPreferences
                    title="Preferences"
                    confirmLabel="Confirm"
                    cancelLabel="Cancel"
                    preferences={preferences}
                    pageSizePreference={{ title: 'Page size', options: PAGE_SIZE_OPTIONS.map(v => ({ value: v, label: `${v} rows` })) }}
                    contentDisplayPreference={{ title: 'Select visible columns', options: columnPreferenceOptions }}
                    onConfirm={({ detail }) => {
                      if (detail.pageSize !== undefined) {
                        setPageSize(detail.pageSize);
                      }
                      if (Array.isArray(detail.contentDisplay)) {
                        const nextVisible = detail.contentDisplay
                          .filter(c => c.visible)
                          .map(c => c.id);
                        if (!nextVisible.includes('watch')) {
                          nextVisible.unshift('watch');
                        }
                        setVisibleColumns(nextVisible);
                        setCurrentPageIndex(1);
                      }
                      if (Array.isArray(detail.columnWidths)) {
                        const sanitized = detail.columnWidths
                          .map(entry => {
                            if (!entry || typeof entry !== 'object') {
                              return null;
                            }
                            const { id, width } = entry;
                            if (typeof id !== 'string' || !Number.isFinite(Number(width))) {
                              return null;
                            }
                            return { id, width: Number(width) };
                          })
                          .filter(Boolean);

                        if (sanitized.length > 0) {
                          mergeColumnWidths(sanitized);
                        }
                      }
                    }}
                  />
                }
              />
            )}
          </SpaceBetween>
        </Box>
        {assignModalVisible && (
          <Modal
            visible={assignModalVisible}
            onDismiss={() => { if(!assignSubmitting){ setAssignModalVisible(false); setAssignTargetCase(null);} }}
            header={`Assign Case ${assignTargetCase?.tracking_id || ''}`}
            footer={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => { if(!assignSubmitting){ setAssignModalVisible(false); setAssignTargetCase(null);} }} disabled={assignSubmitting}>Cancel</Button>
                <Button
                  variant="primary"
                  loading={assignSubmitting}
                  disabled={!selectedAssignee || assignSubmitting}
                  onClick={handleAssignSubmit}
                >
                  Assign
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween direction="vertical" size="s">
              {assignError && <Box color="error">{assignError}</Box>}
              <FormField label="Select Assignee" description="Choose staff to own this case." stretch>
                <Select
                  disabled={assignableLoading}
                  loadingText="Loading staff..."
                  placeholder={assignableLoading ? 'Loading...' : 'Select staff'}
                  options={assignableStaff.map(s => ({ label: `${s.display_name || s.email} (${s.role || 'Staff'})`, value: String(s.id) }))}
                  selectedOption={selectedAssignee}
                  onChange={({ detail }) => setSelectedAssignee(detail.selectedOption)}
                />
              </FormField>
            </SpaceBetween>
          </Modal>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ApplicationsWidget;


