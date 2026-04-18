import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Header,
  Table,
  TextFilter,
  Pagination,
  CollectionPreferences,
  SpaceBetween,
  StatusIndicator,
  Popover,
  Badge,
  Button,
  ButtonDropdown,
  Modal,
  FormField,
  Select,
  Alert,
  Link,
} from '@cloudscape-design/components';
import Icon from '@cloudscape-design/components/icon';
import { BoardItem } from '@cloudscape-design/board-components';
import { useHistory, useLocation } from 'react-router-dom';
import { apiFetch } from '../auth/apiClient';
import useCurrentUser from '../hooks/useCurrentUser';
import { getRoleDisplayName } from '../utils/roleDisplay';
import {
  COMPLETED_APPLICATION_STATUSES,
  SLA_DEFAULT_DAYS,
  SLA_STAGE_ALLOWLIST,
  computeApplicationSlaMeta,
} from '../utils/applicationSla';
import {
  buildApplicationStatusInfo,
  normalizeApplicationStatus,
  normalizeStatusKey,
} from '../utils/applicationStatus';
import ApplicationsWidgetHelp from '../helpPanelContents/applicationsWidgetHelp';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_VISIBLE_COLUMNS = ['watch','applicant_name','address_province','tracking_id','status','sla_risk','assigned_user_email','submitted_at','lock_state','actions'];
const COLUMN_WIDTHS_STORAGE_KEY = 'applications-widget-column-widths';
const redactApplicantDisplay = (value) => {
  if (!value) {
    return '-';
  }
  const tokens = String(value)
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length);
  if (!tokens.length) {
    return '-';
  }
  const redactToken = (token) => {
    if (token.length <= 2) {
      return token;
    }
    const first = token[0];
    const last = token[token.length - 1];
    const middle = '*'.repeat(Math.max(0, token.length - 2));
    return `${first}${middle}${last}`;
  };
  return tokens.map(redactToken).join(' ');
};

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

const toDate = value => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const getDaysAgo = value => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  const diffDays = Math.floor((now - date.getTime()) / 86400000);
  return Math.max(diffDays, 0);
};

const formatDaysAgo = value => {
  const days = getDaysAgo(value);
  if (days === null) return null;
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const getDocsRequestedMeta = (row, rawStatus) => {
  const statusKey = normalizeStatusKey(rawStatus || row?.application_status || '');
  const statusIndicatesDocsRequested = ['docs_requested', 'action_required', 'action_required_(docs_requested)'].includes(statusKey);
  const active = Number(row?.docs_requested_active || 0) === 1 || statusIndicatesDocsRequested;
  if (!active) return { active: false, label: null, color: null };
  const requestedAt = row?.docs_requested_at || row?.docsRequestedAt || null;
  const days = getDaysAgo(requestedAt);
  const suffix = formatDaysAgo(requestedAt);
  const label = `Docs Requested${suffix ? ` ${suffix}` : ''}`;
  const color = (() => {
    if (days === null) return 'grey';
    if (days > 28) return 'severity-critical';
    if (days >= 15) return 'severity-high';
    if (days >= 7) return 'severity-medium';
    if (days >= 3) return 'severity-low';
    return 'grey';
  })();
  return { active: true, label, color };
};

const PROVINCE_LABELS = {
  ab: 'Alberta',
  bc: 'British Columbia',
  mb: 'Manitoba',
  nb: 'New Brunswick',
  nl: 'Newfoundland and Labrador',
  ns: 'Nova Scotia',
  nt: 'Northwest Territories',
  nu: 'Nunavut',
  on: 'Ontario',
  pe: 'Prince Edward Island',
  qc: 'Quebec',
  sk: 'Saskatchewan',
  yt: 'Yukon Territory'
};

const getStatusInfo = (row) => {
  return buildApplicationStatusInfo({
    applicationStatus: row.application_status || row.status || null,
    applicationLifecycleStatus: row.application_lifecycle_status ?? row.applicationLifecycleStatus ?? null,
    caseStatus: row.case_status || null,
    caseId: row.case_id,
    assignedUserId: row.assigned_user_id,
    assessmentEligibility: row.assessment_esdc_eligibility,
    decisionOutcome: row.decision_outcome ?? row.decisionOutcome ?? null,
    awaitingReason: row.application_awaiting_reason ?? row.applicationAwaitingReason ?? null,
    closureReason: row.application_closure_reason ?? row.applicationClosureReason ?? null,
  });
};

const computeSlaMeta = (row, slaTargets, rawStatus, isAssigned) => {
  return computeApplicationSlaMeta({
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    dueAt: row.sla_due_at,
    slaTargets,
    rawStatus,
    isAssigned,
    assessmentEligibility: row.assessment_esdc_eligibility,
  });
};

const ApplicationsWidget = ({ actions, refreshKey, toggleHelpPanel }) => {
  const history = useHistory();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [useServerSearch, setUseServerSearch] = useState(true);
  const [serverSearchText, setServerSearchText] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [sortingState, setSortingState] = useState({ columnId: 'submitted_at', isDescending: true });
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [columnWidths, setColumnWidths] = useState(() => loadStoredColumnWidths());
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
  const [slaTargets, setSlaTargets] = useState(SLA_DEFAULT_DAYS);
  const [autoAssignStatus, setAutoAssignStatus] = useState({ loading: true, enabled: null, error: null, rules: [] });
  const {
    userId: currentUserIdRaw,
    displayName: currentUserName,
    role: currentUserRole,
    regionId: currentUserRegionId,
    regionIds: currentUserRegionIds,
  } = useCurrentUser();
  const currentUserId = currentUserIdRaw ? String(currentUserIdRaw) : null;
  const userRole = currentUserRole || '';
  const normalizedUserRole = userRole.trim();
  const locationSearch = location?.search || '';
  const normalizedRegionIds = useMemo(() => {
    if (Array.isArray(currentUserRegionIds) && currentUserRegionIds.length) {
      return Array.from(new Set(currentUserRegionIds.map(Number).filter(Number.isFinite)));
    }
    const parsed = currentUserRegionId != null ? Number(currentUserRegionId) : NaN;
    return Number.isFinite(parsed) ? [parsed] : [];
  }, [currentUserRegionIds, currentUserRegionId]);

  // Apply incoming query param filter (e.g., status=Awaiting EI Validation)
  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const statusFilter = params.get('status') || params.get('statusFilter');
    if (!statusFilter) {
      return;
    }
    const decoded = decodeURIComponent(statusFilter.replace(/\+/g, ' '));
    if (decoded) {
      setFilteringText(decoded);
      setUseServerSearch(false);
      setCurrentPageIndex(1);
    }
  }, [locationSearch]);

  useEffect(() => {
    if (!useServerSearch) {
      setServerSearchText('');
      return;
    }
    const nextSearchText = filteringText.trim();
    const timeoutId = setTimeout(() => {
      setServerSearchText(nextSearchText);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [filteringText, useServerSearch]);

  const isStaffVisible = useCallback((staff) => {
    if (!staff) return false;
    if (normalizedUserRole === 'Regional Manager') {
      if (currentUserId && String(staff.id) === String(currentUserId)) return true;
      const staffRegion = staff.region_id != null ? Number(staff.region_id) : (staff.regionId != null ? Number(staff.regionId) : null);
      return normalizedRegionIds.length && Number.isFinite(staffRegion) && normalizedRegionIds.includes(staffRegion);
    }
    return true;
  }, [normalizedUserRole, normalizedRegionIds, currentUserId]);

  const filteredAssignableStaff = useMemo(() => {
    return Array.isArray(assignableStaff)
      ? assignableStaff.filter(isStaffVisible)
      : [];
  }, [assignableStaff, isStaffVisible]);

  const getSortValue = useCallback((item, columnId) => {
    switch (columnId) {
      case 'watch':
        return item.__isWatched ? 1 : 0;
      case 'applicant_name':
        return (item.applicant_name || '').toLowerCase();
      case 'tracking_id':
        return (item.tracking_id || '').toLowerCase();
      case 'status': {
        const statusInfo = getStatusInfo(item);
        return statusInfo.statusLabel || '';
      }
      case 'sla_risk': {
        const statusInfo = getStatusInfo(item);
        const meta = computeSlaMeta(item, slaTargets, statusInfo.rawStatus, Boolean(item.assigned_user_id));
        if (meta.deltaDays !== null && meta.deltaDays !== undefined) {
          return meta.deltaDays;
        }
        if (meta.due) {
          return meta.due.getTime();
        }
        return Number.POSITIVE_INFINITY;
      }
      case 'assigned_user_email':
        return (item.assigned_user_email || '').toLowerCase();
      case 'address_province':
        return (item.address_province || '').toLowerCase();
      case 'submitted_at': {
        const date = toDate(item.submitted_at) || toDate(item.created_at);
        return date ? date.getTime() : 0;
      }
      case 'lock_state':
        return (item.lock_owner_name || item.lock_owner_email || '').toLowerCase();
      default:
        return '';
    }
  }, [slaTargets]);

  const compareRows = useCallback((columnId, a, b) => {
    const aVal = getSortValue(a, columnId);
    const bVal = getSortValue(b, columnId);
    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }
    return String(aVal).localeCompare(String(bVal));
  }, [getSortValue]);

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

    const renderCaseLink = (row, label) => {
      if (!row?.case_id) {
        return label || '-';
      }
      const text = label || '-';
      return (
        <Button
          variant="inline-link"
          onClick={() => history.push({ pathname: `/application-case/${row.case_id}`, state: { assessorEmail: row.assigned_user_email } })}
        >
          {text}
        </Button>
      );
    };

    return [
      {
        id: 'applicant_name',
        header: 'Applicant',
        cell: i => renderCaseLink(i, i.applicant_name || '-'),
        minWidth: 180,
        sortingComparator: (a, b) => compareRows('applicant_name', a, b)
      },
      {
        id: 'address_province',
        header: 'Province',
        cell: i => {
          const code = (i.address_province || '').toLowerCase();
          return PROVINCE_LABELS[code] || code.toUpperCase() || '-';
        },
        minWidth: 120,
        sortingComparator: (a, b) => compareRows('address_province', a, b)
      },
      {
        id: 'tracking_id',
        header: 'Tracking ID',
        cell: i => renderCaseLink(i, i.tracking_id),
        minWidth: 140,
        isRowHeader: true,
        sortingComparator: (a, b) => compareRows('tracking_id', a, b)
      },
      {
        id: 'status',
        header: 'Status',
        cell: i => {
          const statusInfo = getStatusInfo(i);
          const docsMeta = getDocsRequestedMeta(i, statusInfo.rawStatus);
          return (
            <SpaceBetween size="xxs">
              <StatusIndicator type={statusInfo.statusType}>{statusInfo.statusLabel}</StatusIndicator>
              {docsMeta.active ? (
                <Badge color={docsMeta.color || 'grey'}>{docsMeta.label}</Badge>
              ) : null}
            </SpaceBetween>
          );
        },
        minWidth: 140,
        sortingComparator: (a, b) => compareRows('status', a, b)
      },
      {
        id: 'sla_risk',
        header: 'Overdue',
        cell: i => {
          const statusInfo = getStatusInfo(i);
          const meta = computeSlaMeta(i, slaTargets, statusInfo.rawStatus, Boolean(i.assigned_user_id));
          const badge = (() => {
            switch (meta.status) {
              case 'critical-overdue':
                return <Badge color="severity-critical">{meta.label}</Badge>;
              case 'high-overdue':
                return <Badge color="severity-high">{meta.label}</Badge>;
              case 'due-today':
                return <Badge color="severity-medium">{meta.label}</Badge>;
              case 'due-soon':
                return <Badge color="severity-low">{meta.label}</Badge>;
              case 'ok':
                return <Badge color="green">{meta.label}</Badge>;
              default:
                return <Badge color="grey">Unknown</Badge>;
            }
          })();
          return (
            <span
              title={`Timeline (${meta.stage || 'unknown'}): ${meta.label} | Age: ${meta.ageDays ?? 'n/a'}d | Due: ${meta.due ? meta.due.toLocaleDateString() : 'n/a'}`}
              aria-label={`Timeline ${meta.stage || 'unknown'} ${meta.status || 'unknown'}; Age ${meta.ageDays ?? 'n/a'} days; Due ${meta.due ? meta.due.toLocaleDateString() : 'n/a'}`}
            >
              {badge}
            </span>
          );
        },
        minWidth: 110,
        sortingComparator: (a, b) => compareRows('sla_risk', a, b)
      },
      {
        id: 'assigned_user_email',
        header: 'Owner',
        cell: i => i.case_id ? (i.assigned_user_email || '-') : 'Unassigned',
        minWidth: 200,
        sortingComparator: (a, b) => compareRows('assigned_user_email', a, b)
      },
      {
        id: 'submitted_at',
        header: 'Received',
        cell: i => {
          const date = toDate(i.submitted_at) || toDate(i.created_at);
          return date ? date.toLocaleDateString() : '-';
        },
        minWidth: 140,
        sortingComparator: (a, b) => compareRows('submitted_at', a, b)
      },
      {
        id: 'lock_state',
        header: 'Lock Status',
        cell: lockCell,
        minWidth: 200
      },
    ];
  }, [currentUserId, currentUserName, slaTargets, compareRows]);

  const load = useCallback(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String((currentPageIndex - 1) * pageSize),
    });
    if (serverSearchText) {
      params.set('search', serverSearchText);
    }
    setLoading(true); setError(null);
    apiFetch(`/api/applications?${params.toString()}`)
      .then(res => { if (!res.ok) throw new Error('Fetch failed'); return res.json(); })
      .then(data => { if (!cancelled) { setItems(data.rows || []); setTotalCount(data.count || (data.rows ? data.rows.length : 0)); } })
      .catch(() => { if (!cancelled) setError('Failed to load applications'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pageSize, currentPageIndex, serverSearchText]);

  useEffect(() => {
    const c = load();
    return c;
  }, [load, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    const loadSlaTargets = async () => {
      try {
        const res = await apiFetch('/api/config/sla-targets');
        if (!res.ok) throw new Error('Failed to load workflow timing targets');
        const data = await res.json();
        const targets = Array.isArray(data?.targets) ? data.targets : [];
        const next = { ...SLA_DEFAULT_DAYS };
        targets.forEach(item => {
          const key = item.stage_key || item.stage;
          if (!SLA_STAGE_ALLOWLIST.has(key)) return;
          const hours = item.target_hours ?? item.targetHours;
          if (hours === null || hours === undefined) return;
          const days = Number(hours) / 24;
          if (!Number.isNaN(days) && days > 0) {
            next[key] = Math.round(days);
          }
        });
        if (!cancelled) {
          setSlaTargets(next);
        }
      } catch (_) {
        if (!cancelled) {
          setSlaTargets(SLA_DEFAULT_DAYS);
        }
      }
    };
    loadSlaTargets();
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    setAutoAssignStatus({ loading: true, enabled: null, error: null });
    apiFetch('/api/config/auto-assignment')
      .then(res => {
        if (!res.ok) {
          const err = new Error(`HTTP ${res.status}`);
          err.status = res.status;
          throw err;
        }
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        const rules = Array.isArray(data?.rules) ? data.rules : [];
        setAutoAssignStatus({ loading: false, enabled: !!data?.enabled, error: null, rules });
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[applications] auto-assignment status load failed', err);
        setAutoAssignStatus({ loading: false, enabled: null, error: 'Unavailable', rules: [] });
      });
    return () => { cancelled = true; };
  }, []);

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

    payload.assignee_id = chosen;

    const currentApplicationStatus = (assignTargetCase.application_status || assignTargetCase.status || '').toLowerCase();
    const shouldPromoteStatus = false; // do not auto-change status on assignment
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

      // Status is no longer auto-promoted on assignment.

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
      const province = item.address_province || item['address-province'] || '';
      return {
        ...item,
        __caseIdNumeric: caseId,
        __isWatched: watched,
        address_province: province,
      };
    });
  }, [items, watchMap]);

  // Keep a local pass so status shortcut links and immediate typing feedback still work.
  const filteredItems = decoratedItems
    .filter(i => {
      const s = filteringText.toLowerCase();
      if (!s) return true;
      const statusInfo = getStatusInfo(i);
      const fields = [
        i.tracking_id,
        i.applicant_name,
        i.application_status,
        i.case_status,
        statusInfo?.statusLabel,
        statusInfo?.rawStatus,
        i.assigned_user_email,
        i.ptma_codes,
        i.lock_owner_name,
        i.lock_owner_email,
        i.address_province
      ];
      return fields.some(v => v && String(v).toLowerCase().includes(s));
    })
    .filter(i => !showWatchedOnly || i.__isWatched);

  const sortedItems = useMemo(() => {
    const { columnId, isDescending } = sortingState;
    if (!columnId) return filteredItems;
    const copy = [...filteredItems];
    copy.sort((a, b) => {
      const result = compareRows(columnId, a, b);
      return isDescending ? -result : result;
    });
    return copy;
  }, [filteredItems, sortingState, compareRows]);

  const watchColumn = useMemo(() => ({
    id: 'watch',
    header: 'Flag',
    minWidth: 45,
    sortingComparator: (a, b) => compareRows('watch', a, b),
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
  }), [handleToggleWatch, watchPending, compareRows]);

  const actionsColumn = {
    id: 'actions', header: 'Actions', minWidth: 160, cell: item => {
      const caseStatusLower = normalizeApplicationStatus(item.application_status || item.status || '');
      const unassigned =
        item.case_id &&
        !item.assigned_user_id &&
        !COMPLETED_APPLICATION_STATUSES.has(caseStatusLower);
      const reassignRoles = ['NWAC Administrator','Regional Manager','System Administrator'];
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
              if (found && isStaffVisible(found)) {
                const roleLabel = getRoleDisplayName(found.role || 'Staff') || 'Staff';
                setSelectedAssignee({ label: `${found.display_name || found.email} (${roleLabel})`, value: String(found.id) });
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
      ...detailColumns,
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

  const effectiveTotal = showWatchedOnly ? sortedItems.length : totalCount;
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
  const activeSortingColumn = useMemo(
    () => columnDefinitionsForTable.find(c => c.id === sortingState.columnId),
    [columnDefinitionsForTable, sortingState.columnId]
  );

  const autoAssignSummary = useMemo(() => {
    if (!autoAssignStatus.rules || autoAssignStatus.rules.length === 0) {
      return autoAssignStatus.enabled ? 'Auto assignment enabled, no rules configured.' : 'Auto assignment is off.';
    }
    const toText = (rule) => {
      const label = rule?.label || 'Rule';
      const assignee = rule?.assignee || rule?.assigneeId || 'Unspecified';
      const conditions = Array.isArray(rule?.conditions) ? rule.conditions : [];
      const conditionText = conditions.map(cond => {
        const field = cond.field || 'any';
        const op = cond.op || 'always';
        const values = Array.isArray(cond.value) ? cond.value.join(', ') : '';
        if (op === 'always' || field === 'any') return 'Always';
        return `${field} ${op} ${values}`;
      }).join(' AND ') || 'Always';
      return `${label}: ${conditionText} → ${assignee}`;
    };
    return autoAssignStatus.rules.map(toText).join('\n');
  }, [autoAssignStatus]);

  const autoAssignBadge = useMemo(() => {
    const badgeContent = (() => {
      if (autoAssignStatus.loading) {
        return <StatusIndicator type="loading">Auto assignment</StatusIndicator>;
      }
      if (autoAssignStatus.error) {
        return <StatusIndicator type="stopped">Auto assignment unavailable</StatusIndicator>;
      }
      return autoAssignStatus.enabled
        ? <Badge color="green">Auto assignment on</Badge>
        : <Badge color="grey">Auto assignment off</Badge>;
    })();
    return (
      <Popover
        triggerType="hover"
        size="medium"
        header="Auto assignment"
        content={<Box whiteSpace="pre-line">{autoAssignSummary}</Box>}
      >
        {badgeContent}
      </Popover>
    );
  }, [autoAssignStatus, autoAssignSummary]);

  const headerContent = (
    <Header
      variant="h2"
      info={
        <Link
          variant="info"
          onFollow={() =>
            toggleHelpPanel &&
            toggleHelpPanel(
              <ApplicationsWidgetHelp />,
              'ISET Applications',
              ApplicationsWidgetHelp.aiContext || ''
            )
          }
        >
          Info
        </Link>
      }
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          {autoAssignBadge}
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
        <Box variant="small">This table lists the applications you can work on. NWAC Administrators see all applications, Regional Managers see their assigned and regional files, and ISET Coordinators see only their assigned applications.</Box>
        <Box>
          <SpaceBetween direction="vertical" size="xs">
            {error ? <Box color="error" textAlign="center">{error}</Box> : null}
            <Table
              columnDefinitions={columnDefinitionsForTable}
              items={sortedItems}
              loading={loading}
              loadingText="Loading applications"
              variant="embedded"
              wrapLines
              resizableColumns
              sortingColumn={activeSortingColumn || { id: sortingState.columnId }}
              sortingDescending={sortingState.isDescending}
              onSortingChange={({ detail }) => {
                const columnId = detail?.sortingColumn?.id;
                if (columnId) {
                  setSortingState({ columnId, isDescending: detail.isDescending });
                }
              }}
              onColumnWidthsChange={handleColumnWidthsChange}
              stickyHeader
              stripedRows
              empty={<Box textAlign="center">No applications</Box>}
              ariaLabels={{
                tableLabel: 'Cases table',
                header: 'Cases',
                rowHeader: 'Case ID'
              }}
              renderAriaLive={({ firstIndex, lastIndex }) => `Displaying items ${firstIndex} to ${lastIndex}`}
              filter={
                <TextFilter
                  filteringPlaceholder="Search"
                  filteringText={filteringText}
                  onChange={({ detail }) => {
                    setUseServerSearch(true);
                    setFilteringText(detail.filteringText);
                    setCurrentPageIndex(1);
                  }}
                />
              }
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
          </SpaceBetween>
        </Box>
        {assignModalVisible && (
          <Modal
            visible={assignModalVisible}
            onDismiss={() => { if(!assignSubmitting){ setAssignModalVisible(false); setAssignTargetCase(null);} }}
            header={`Assign Application ${assignTargetCase?.tracking_id || ''}`}
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
                  options={filteredAssignableStaff.map(s => {
                    const roleLabel = getRoleDisplayName(s.role || 'Staff') || 'Staff';
                    return { label: `${s.display_name || s.email} (${roleLabel})`, value: String(s.id) };
                  })}
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
