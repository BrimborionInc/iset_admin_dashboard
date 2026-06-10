// Admin User Management Dashboard (Cognito staff roles plus PATH applicant accounts)
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Badge,
  Box,
  Button,
  CollectionPreferences,
  ColumnLayout,
  Container,
  Flashbar,
  FormField,
  Header,
  Input,
  Modal,
  Multiselect,
  Pagination,
  SegmentedControl,
  Select,
  SpaceBetween,
  Spinner,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import Tabs from '@cloudscape-design/components/tabs';
import { useHistory, useLocation } from 'react-router-dom';
import { apiFetch } from '../auth/apiClient';
import { getRoleDisplayName } from '../utils/roleDisplay';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { value: 'System_Administrator', label: getRoleDisplayName('System_Administrator') },
  { value: 'NWAC_Administrator', label: getRoleDisplayName('NWAC_Administrator') },
  { value: 'Regional_Manager', label: getRoleDisplayName('Regional_Manager') },
  { value: 'ISET_Coordinator', label: getRoleDisplayName('ISET_Coordinator') },
];

const ROLE_LABEL_BY_VALUE = new Map(ROLE_OPTIONS.map(option => [option.value, option.label]));
const ADMIN_USER_FILTER_IDS = new Set(['all', 'disabled', 'pending', 'noMfa', 'admins', 'recent', 'never']);
const APPLICANT_ACCOUNT_STATUS_IDS = new Set(['no_account', 'created', 'invitation_sent', 'activated']);

const MANAGEABLE_ROLE_VALUES_BY_ROLE = {
  'System Administrator': ['System_Administrator', 'NWAC_Administrator', 'Regional_Manager', 'ISET_Coordinator'],
  'NWAC Administrator': ['NWAC_Administrator', 'Regional_Manager', 'ISET_Coordinator'],
  'Regional Manager': ['ISET_Coordinator'],
};

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10 rows' },
  { value: 20, label: '20 rows' },
  { value: 50, label: '50 rows' },
  { value: 100, label: '100 rows' },
];

const ADMIN_VISIBLE_COLUMNS = ['name', 'email', 'role', 'region', 'status', 'mfa', 'last'];
const APPLICANT_VISIBLE_COLUMNS = ['applicant', 'email', 'case', 'region', 'status', 'actions'];

const STATUS_SORT_RANK = {
  CONFIRMED: 1,
  FORCE_CHANGE_PASSWORD: 2,
  DISABLED: 3,
};

const APPLICANT_STATUS_FILTERS = [
  { id: '', text: 'All' },
  { id: 'no_account', text: 'Needs account' },
  { id: 'created', text: 'Ready to invite' },
  { id: 'invitation_sent', text: 'Invitation sent' },
  { id: 'activated', text: 'Activated' },
];

async function readResponseJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

async function getResponseErrorMessage(resp) {
  const json = await readResponseJson(resp);
  return json?.detail || json?.message || json?.error || `HTTP ${resp.status}`;
}

function buildBulkFailureMessage(prefix, failures) {
  if (!failures.length) return prefix;
  const sample = failures
    .slice(0, 2)
    .map(failure => `${failure.username}: ${failure.error}`)
    .join('; ');
  const remainder = failures.length > 2 ? ` (+${failures.length - 2} more)` : '';
  return `${prefix} ${sample}${remainder}`;
}

function textValue(value) {
  return String(value || '').toLowerCase();
}

function compareStrings(left, right) {
  return String(left || '').localeCompare(String(right || ''), undefined, { sensitivity: 'base', numeric: true });
}

function compareDates(left, right) {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0);
}

function stableSort(items, column, descending) {
  if (!column) return items;
  const compare = column.sortingComparator || ((left, right) => compareStrings(left?.[column.sortingField || column.id], right?.[column.sortingField || column.id]));
  const direction = descending ? -1 : 1;
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const result = compare(left.item, right.item);
      return result === 0 ? left.index - right.index : result * direction;
    })
    .map(entry => entry.item);
}

function paginateItems(items, pageIndex, pageSize) {
  const start = Math.max(0, (pageIndex - 1) * pageSize);
  return items.slice(start, start + pageSize);
}

function pagesFor(total, pageSize) {
  return Math.max(1, Math.ceil(Math.max(total, 1) / pageSize));
}

function applyColumnWidths(columns, columnWidths) {
  const widthById = new Map((columnWidths || []).map(entry => [entry.id, entry.width]));
  return columns.map(column => (
    widthById.has(column.id) ? { ...column, width: widthById.get(column.id) } : column
  ));
}

function contentDisplayFromColumns(columns, visibleColumns) {
  const visible = new Set(visibleColumns);
  return columns.map(column => ({ id: column.id, visible: visible.has(column.id) }));
}

function visibleColumnDefinitions(columns, visibleColumns, columnWidths, alwaysVisible = []) {
  const visible = new Set([...visibleColumns, ...alwaysVisible]);
  return applyColumnWidths(columns.filter(column => visible.has(column.id)), columnWidths);
}

function columnPreferenceOptions(columns, alwaysVisible = []) {
  const always = new Set(alwaysVisible);
  return columns.map(column => ({
    id: column.id,
    label: typeof column.header === 'string' ? column.header : column.id,
    alwaysVisible: always.has(column.id),
  }));
}

function extractColumnWidths(detail) {
  if (!Array.isArray(detail?.columnWidths)) return [];
  return detail.columnWidths
    .map(entry => {
      const width = Number(entry?.width);
      return typeof entry?.id === 'string' && Number.isFinite(width)
        ? { id: entry.id, width }
        : null;
    })
    .filter(Boolean);
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

export default function UserManagementDashboard() {
  const location = useLocation();
  const history = useHistory();
  const { currentUser } = useAuth();
  const currentRole = currentUser?.role || null;
  const canManageAdminUsers = ['System Administrator', 'NWAC Administrator', 'Regional Manager'].includes(currentRole);
  const canManageApplicantAccounts = canManageAdminUsers || currentRole === 'ISET Coordinator';

  const initialUrlState = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    const requestedTab = params.get('tab');
    const requestedFilter = params.get('filter');
    const requestedApplicantStatus = params.get('status');
    const pageTabId = requestedTab === 'applicant-accounts' && canManageApplicantAccounts
      ? 'applicant-accounts'
      : (requestedTab === 'admin-users' && canManageAdminUsers
        ? 'admin-users'
        : (canManageAdminUsers ? 'admin-users' : 'applicant-accounts'));

    return {
      pageTabId,
      quickFilter: ADMIN_USER_FILTER_IDS.has(requestedFilter) ? requestedFilter : 'all',
      applicantStatusFilter: APPLICANT_ACCOUNT_STATUS_IDS.has(requestedApplicantStatus) ? requestedApplicantStatus : '',
    };
  }, [location.search, canManageAdminUsers, canManageApplicantAccounts]);

  const replaceUrlState = useCallback((updates = {}) => {
    const params = new URLSearchParams(location.search || '');
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '' || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const query = params.toString();
    history.replace(`${location.pathname}${query ? `?${query}` : ''}`);
  }, [history, location.pathname, location.search]);

  const [pageTabId, setPageTabId] = useState(initialUrlState.pageTabId);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [regionOptions, setRegionOptions] = useState([]);
  const [filteringText, setFilteringText] = useState('');
  const [selected, setSelected] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [flashItems, setFlashItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', displayName: '', role: null, regionId: '', regionIds: [] });
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState(initialUrlState.quickFilter);
  const [actionBusy, setActionBusy] = useState(false);
  const [showRoleChange, setShowRoleChange] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState(null);
  const [roleChanging, setRoleChanging] = useState(false);
  const [audit, setAudit] = useState([]);
  const [showRegionEdit, setShowRegionEdit] = useState(false);
  const [regionEditTarget, setRegionEditTarget] = useState(null);
  const [regionEditIds, setRegionEditIds] = useState([]);
  const [regionEditId, setRegionEditId] = useState('');
  const [regionEditBusy, setRegionEditBusy] = useState(false);
  const [adminPageIndex, setAdminPageIndex] = useState(1);
  const [adminPageSize, setAdminPageSize] = useState(20);
  const [adminVisibleColumns, setAdminVisibleColumns] = useState(ADMIN_VISIBLE_COLUMNS);
  const [adminSorting, setAdminSorting] = useState({ columnId: 'email', isDescending: false });
  const [adminColumnWidths, setAdminColumnWidths] = useState([]);

  const [applicantAccounts, setApplicantAccounts] = useState([]);
  const [applicantAccountsTotal, setApplicantAccountsTotal] = useState(0);
  const [loadingApplicantAccounts, setLoadingApplicantAccounts] = useState(false);
  const [applicantFilteringText, setApplicantFilteringText] = useState('');
  const [applicantStatusFilter, setApplicantStatusFilter] = useState(initialUrlState.applicantStatusFilter);
  const [applicantActionClientId, setApplicantActionClientId] = useState(null);
  const [applicantPageIndex, setApplicantPageIndex] = useState(1);
  const [applicantPageSize, setApplicantPageSize] = useState(20);
  const [applicantVisibleColumns, setApplicantVisibleColumns] = useState(APPLICANT_VISIBLE_COLUMNS);
  const [applicantSorting, setApplicantSorting] = useState({ columnId: 'status', isDescending: false });
  const [applicantColumnWidths, setApplicantColumnWidths] = useState([]);

  const manageableRoleValues = useMemo(() => (
    MANAGEABLE_ROLE_VALUES_BY_ROLE[currentRole] || []
  ), [currentRole]);

  const manageableRoleOptions = useMemo(() => (
    ROLE_OPTIONS.filter(option => manageableRoleValues.includes(option.value))
  ), [manageableRoleValues]);

  const pushFlash = useCallback((type, content) => {
    setFlashItems(cur => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
      const remove = () => setFlashItems(prev => prev.filter(item => item.id !== id));
      const next = { id, type, content, dismissible: true, onDismiss: remove };
      return [...cur.filter(item => item.content !== content), next];
    });
  }, []);

  const loadUsers = useCallback(async () => {
    if (!canManageAdminUsers) {
      setUsers([]);
      setLoadingUsers(false);
      return;
    }
    setLoadingUsers(true);
    try {
      const resp = await apiFetch('/api/admin/users');
      if (!resp.ok) throw new Error(await getResponseErrorMessage(resp));
      const json = await resp.json().catch(() => ({ users: [] }));
      setUsers(Array.isArray(json.users) ? json.users : []);
    } catch (error) {
      pushFlash('error', `Failed to load users (${error.message || 'network'})`);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [canManageAdminUsers, pushFlash]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!canManageAdminUsers) {
      setRegionOptions([]);
      return undefined;
    }
    let cancelled = false;
    async function loadRegions() {
      try {
        const resp = await apiFetch('/api/regions/canada');
        if (!resp.ok) throw new Error(await getResponseErrorMessage(resp));
        const data = await resp.json().catch(() => []);
        if (cancelled) return;
        const options = (Array.isArray(data) ? data : [])
          .map(row => ({
            regionId: Number(row.regionId),
            code: String(row.code || '').trim().toUpperCase(),
            name: row.name || row.code || '',
          }))
          .filter(row => Number.isFinite(row.regionId) && row.code);
        setRegionOptions(options);
      } catch {
        if (!cancelled) setRegionOptions([]);
      }
    }
    loadRegions();
    return () => { cancelled = true; };
  }, [canManageAdminUsers]);

  useEffect(() => {
    if (canManageAdminUsers && pageTabId === 'applicant-accounts') return;
    if (!canManageAdminUsers && canManageApplicantAccounts) {
      setPageTabId('applicant-accounts');
      return;
    }
    if (canManageAdminUsers) {
      setPageTabId('admin-users');
    }
  }, [canManageAdminUsers, canManageApplicantAccounts, pageTabId]);

  useEffect(() => {
    setPageTabId(initialUrlState.pageTabId);
    setQuickFilter(initialUrlState.quickFilter);
    setApplicantStatusFilter(initialUrlState.applicantStatusFilter);
  }, [initialUrlState]);

  const quickFilters = useMemo(() => [
    { id: 'all', label: 'All', predicate: () => true },
    { id: 'disabled', label: 'Disabled', predicate: user => user.status === 'DISABLED' },
    { id: 'pending', label: 'Pending first sign-in', predicate: user => user.status === 'FORCE_CHANGE_PASSWORD' },
    { id: 'noMfa', label: 'No MFA', predicate: user => !user.mfa },
    { id: 'admins', label: 'Administrators', predicate: user => ['System_Administrator', 'NWAC_Administrator'].includes(user.role) },
    { id: 'recent', label: 'Recently active', predicate: user => user.lastSignIn && (Date.now() - Date.parse(user.lastSignIn)) < 7 * 24 * 3600 * 1000 },
    { id: 'never', label: 'Never signed in', predicate: user => !user.lastSignIn },
  ], []);

  const regionCodeById = useMemo(() => {
    const map = new Map();
    regionOptions.forEach(row => {
      map.set(Number(row.regionId), row.code);
    });
    return map;
  }, [regionOptions]);

  const resolveRegionCode = useCallback((regionId) => {
    const numeric = Number(regionId);
    if (!Number.isFinite(numeric)) return '-';
    return regionCodeById.get(numeric) || '-';
  }, [regionCodeById]);

  const regionSelectOptions = useMemo(() => (
    regionOptions.map(row => ({
      label: row.code,
      description: row.name,
      value: String(row.regionId),
    }))
  ), [regionOptions]);

  const regionOptionById = useMemo(() => {
    const map = new Map();
    regionSelectOptions.forEach(opt => {
      map.set(opt.value, opt);
    });
    return map;
  }, [regionSelectOptions]);

  const resolveRegionLabel = useCallback((regionIds) => {
    const ids = Array.isArray(regionIds) ? regionIds : [];
    const codes = ids
      .map(id => resolveRegionCode(id))
      .filter(code => code && code !== '-');
    const uniqueCodes = Array.from(new Set(codes));
    return uniqueCodes.length ? uniqueCodes.join(', ') : '-';
  }, [resolveRegionCode]);

  const resolveUserRegionLabel = useCallback((user) => {
    const ids = Array.isArray(user?.regionIds) && user.regionIds.length
      ? user.regionIds
      : (user?.regionId != null ? [user.regionId] : []);
    return resolveRegionLabel(ids);
  }, [resolveRegionLabel]);

  const resolveRegionOptionsByIds = useCallback((ids) => {
    if (!Array.isArray(ids)) return [];
    return ids
      .map(id => regionOptionById.get(String(id)))
      .filter(Boolean);
  }, [regionOptionById]);

  const recordAudit = useCallback((evt) => {
    setAudit(current => [{
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      time: new Date().toISOString(),
      ...evt,
    }, ...current].slice(0, 50));
  }, []);

  const updateUsersByUsername = useCallback((usernames, updater) => {
    const targetSet = usernames instanceof Set ? usernames : new Set(usernames);
    setUsers(current => current.map(user => (targetSet.has(user.username) ? updater(user) : user)));
    setSelected(current => current.map(user => (targetSet.has(user.username) ? updater(user) : user)));
  }, []);

  const mergeBulkUserPayload = useCallback((resultMap, fallbackUpdater) => (
    user => {
      const payload = resultMap.get(user.username)?.payload || null;
      const nextStatus = payload?.status || fallbackUpdater(user).status;
      const nextEnabled = typeof payload?.enabled === 'boolean'
        ? payload.enabled
        : nextStatus !== 'DISABLED';
      return { ...user, status: nextStatus, enabled: nextEnabled };
    }
  ), []);

  const runBulkUserAction = useCallback(async (targets, requestFactory) => (
    Promise.all(targets.map(async target => {
      try {
        const resp = await requestFactory(target);
        const payload = await readResponseJson(resp);
        if (!resp.ok) {
          return {
            ok: false,
            username: target.username,
            error: payload?.detail || payload?.message || payload?.error || `HTTP ${resp.status}`,
            target,
          };
        }
        return { ok: true, username: target.username, payload, target };
      } catch (error) {
        return { ok: false, username: target.username, error: error.message || 'network', target };
      }
    }))
  ), []);

  const adminColumns = useMemo(() => ([
    {
      id: 'name',
      header: 'Name',
      cell: item => item.displayName || item.name || '-',
      sortingComparator: (left, right) => compareStrings(left.displayName || left.name, right.displayName || right.name),
      minWidth: 180,
    },
    { id: 'email', header: 'Email', cell: item => item.email, sortingField: 'email', minWidth: 220 },
    { id: 'username', header: 'Username', cell: item => item.username, sortingField: 'username', minWidth: 220 },
    {
      id: 'role',
      header: 'Role',
      cell: item => ROLE_LABEL_BY_VALUE.get(item.role) || item.role || '-',
      sortingComparator: (left, right) => compareStrings(ROLE_LABEL_BY_VALUE.get(left.role) || left.role, ROLE_LABEL_BY_VALUE.get(right.role) || right.role),
      minWidth: 170,
    },
    {
      id: 'region',
      header: 'Regions',
      cell: item => resolveUserRegionLabel(item),
      sortingComparator: (left, right) => compareStrings(resolveUserRegionLabel(left), resolveUserRegionLabel(right)),
      minWidth: 120,
    },
    {
      id: 'status',
      header: 'Status',
      cell: item => <StatusPill status={item.status} />,
      sortingComparator: (left, right) => (STATUS_SORT_RANK[left.status] || 99) - (STATUS_SORT_RANK[right.status] || 99),
      minWidth: 140,
    },
    {
      id: 'mfa',
      header: 'MFA',
      cell: item => (item.mfa ? <Badge color="green">Enabled</Badge> : <Badge color="red">Missing</Badge>),
      sortingComparator: (left, right) => Number(Boolean(left.mfa)) - Number(Boolean(right.mfa)),
      minWidth: 110,
    },
    {
      id: 'last',
      header: 'Last sign-in',
      cell: item => formatDateTime(item.lastSignIn),
      sortingComparator: (left, right) => compareDates(left.lastSignIn, right.lastSignIn),
      minWidth: 170,
    },
    {
      id: 'created',
      header: 'Created',
      cell: item => formatDate(item.createdAt),
      sortingComparator: (left, right) => compareDates(left.createdAt, right.createdAt),
      minWidth: 130,
    },
  ]), [resolveUserRegionLabel]);

  const filteredAdminUsers = useMemo(() => {
    const search = filteringText.trim().toLowerCase();
    const active = quickFilters.find(filter => filter.id === quickFilter) || quickFilters[0];
    return users
      .filter(user => active.predicate(user))
      .filter(user => !search || [
        user.username,
        user.email,
        user.name,
        user.displayName,
        user.role,
        ROLE_LABEL_BY_VALUE.get(user.role),
        resolveUserRegionLabel(user),
      ].some(value => textValue(value).includes(search)));
  }, [filteringText, users, quickFilter, quickFilters, resolveUserRegionLabel]);

  const adminActiveSortingColumn = useMemo(
    () => adminColumns.find(column => column.id === adminSorting.columnId) || adminColumns[0],
    [adminColumns, adminSorting.columnId],
  );

  const sortedAdminUsers = useMemo(
    () => stableSort(filteredAdminUsers, adminActiveSortingColumn, adminSorting.isDescending),
    [filteredAdminUsers, adminActiveSortingColumn, adminSorting.isDescending],
  );

  const adminPagesCount = pagesFor(sortedAdminUsers.length, adminPageSize);
  const adminItemsPage = useMemo(
    () => paginateItems(sortedAdminUsers, adminPageIndex, adminPageSize),
    [sortedAdminUsers, adminPageIndex, adminPageSize],
  );

  useEffect(() => {
    const pages = pagesFor(sortedAdminUsers.length, adminPageSize);
    if (adminPageIndex > pages) setAdminPageIndex(pages);
  }, [adminPageIndex, adminPageSize, sortedAdminUsers.length]);

  const quickFilterCounts = useMemo(() => {
    const counts = {};
    quickFilters.forEach(filter => {
      counts[filter.id] = users.filter(filter.predicate).length;
    });
    return counts;
  }, [users, quickFilters]);

  const roleCounts = useMemo(() => (
    ROLE_OPTIONS.map(role => ({
      role: role.value,
      label: role.label,
      count: users.filter(user => user.role === role.value).length,
    }))
  ), [users]);

  const securityMetrics = useMemo(() => {
    const total = users.length || 0;
    const disabled = users.filter(user => user.status === 'DISABLED').length;
    const pending = users.filter(user => user.status === 'FORCE_CHANGE_PASSWORD').length;
    const mfaEnabled = users.filter(user => user.mfa).length;
    const mfaMissing = total - mfaEnabled;
    const active30d = users.filter(user => user.lastSignIn && (Date.now() - Date.parse(user.lastSignIn)) < 30 * 24 * 3600 * 1000).length;
    const percent = value => (total ? Math.round((value / total) * 100) : 0);
    return { total, disabled, pending, mfaEnabled, mfaMissing, active30d, percent };
  }, [users]);

  const loadApplicantAccounts = useCallback(async () => {
    if (!canManageApplicantAccounts) {
      setApplicantAccounts([]);
      setApplicantAccountsTotal(0);
      setLoadingApplicantAccounts(false);
      return;
    }
    setLoadingApplicantAccounts(true);
    try {
      const params = new URLSearchParams();
      const query = applicantFilteringText.trim();
      if (query) params.set('q', query);
      if (applicantStatusFilter) params.set('status', applicantStatusFilter);
      params.set('page', String(applicantPageIndex));
      params.set('pageSize', String(applicantPageSize));
      params.set('sortField', applicantSorting.columnId);
      params.set('sortDirection', applicantSorting.isDescending ? 'desc' : 'asc');
      const resp = await apiFetch(`/api/admin/applicants?${params.toString()}`);
      if (!resp.ok) throw new Error(await getResponseErrorMessage(resp));
      const json = await resp.json().catch(() => ({ users: [] }));
      const rows = Array.isArray(json.users) ? json.users : [];
      setApplicantAccounts(rows);
      setApplicantAccountsTotal(Number.isFinite(Number(json.total)) ? Number(json.total) : rows.length);
    } catch (error) {
      pushFlash('error', `Failed to load applicant accounts (${error.message || 'network'})`);
      setApplicantAccounts([]);
      setApplicantAccountsTotal(0);
    } finally {
      setLoadingApplicantAccounts(false);
    }
  }, [
    applicantFilteringText,
    applicantPageIndex,
    applicantPageSize,
    applicantSorting.columnId,
    applicantSorting.isDescending,
    applicantStatusFilter,
    canManageApplicantAccounts,
    pushFlash,
  ]);

  useEffect(() => {
    if (!canManageApplicantAccounts) {
      setApplicantAccounts([]);
      setApplicantAccountsTotal(0);
      setLoadingApplicantAccounts(false);
      return undefined;
    }
    const handle = setTimeout(() => {
      loadApplicantAccounts();
    }, applicantFilteringText.trim() ? 350 : 0);
    return () => clearTimeout(handle);
  }, [applicantFilteringText, applicantStatusFilter, applicantPageIndex, applicantPageSize, applicantSorting, canManageApplicantAccounts, loadApplicantAccounts]);

  const runApplicantAction = useCallback(async (clientId, action) => {
    if (!clientId) return;
    const label = action === 'create' ? 'Create account' : 'Send activation';
    setApplicantActionClientId(clientId);
    try {
      const endpoint = action === 'create'
        ? `/api/admin/applicants/${clientId}/create-account`
        : `/api/admin/applicants/${clientId}/send-activation`;
      const resp = await apiFetch(endpoint, { method: 'POST' });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(json?.detail || json?.message || json?.error || `HTTP ${resp.status}`);
      }
      pushFlash('success', action === 'create' ? 'Applicant account created.' : 'Activation email sent.');
      recordAudit({
        actor: currentUser?.displayName || currentUser?.email || 'Current user',
        action: label,
        detail: json?.user?.email || json?.user?.applicantName || 'Applicant',
        target: json?.user?.caseNumber || `Client ${clientId}`,
      });
      await loadApplicantAccounts();
    } catch (error) {
      pushFlash('error', `${label} failed (${error.message || 'network'})`);
    } finally {
      setApplicantActionClientId(null);
    }
  }, [currentUser, loadApplicantAccounts, pushFlash, recordAudit]);

  const applicantColumns = useMemo(() => ([
    { id: 'applicant', header: 'Applicant', cell: item => item.applicantName, sortingField: 'applicantName', minWidth: 160 },
    { id: 'email', header: 'Email', cell: item => item.email || '-', sortingField: 'email', minWidth: 200 },
    { id: 'case', header: 'Case', cell: item => item.caseNumber || '-', sortingField: 'caseNumber', minWidth: 110 },
    { id: 'region', header: 'Region', cell: item => item.regionCode || '-', sortingField: 'regionCode', minWidth: 80 },
    { id: 'manager', header: 'Case manager', cell: item => item.caseManagerName || '-', sortingField: 'caseManagerName', minWidth: 180 },
    {
      id: 'status',
      header: 'Status',
      cell: item => <ApplicantAccountStatusPill status={item.accountStatus} label={item.accountStatusLabel} />,
      sortingField: 'accountStatus',
      minWidth: 130,
    },
    { id: 'invited', header: 'Invitation sent', cell: item => formatDate(item.invitedAt), sortingField: 'invitedAt', minWidth: 120 },
    { id: 'activated', header: 'Activated', cell: item => formatDate(item.activatedAt), sortingField: 'activatedAt', minWidth: 120 },
    {
      id: 'actions',
      header: 'Actions',
      minWidth: 190,
      cell: item => (
        <SpaceBetween direction="horizontal" size="xs">
          {item.canCreateAccount ? (
            <Button size="small" loading={applicantActionClientId === item.clientId} onClick={() => runApplicantAction(item.clientId, 'create')}>
              Create account
            </Button>
          ) : null}
          {item.canSendActivation ? (
            <Button size="small" variant="primary" loading={applicantActionClientId === item.clientId} onClick={() => runApplicantAction(item.clientId, 'send')}>
              Send activation
            </Button>
          ) : null}
          {item.canResendActivation ? (
            <Button size="small" variant="primary" loading={applicantActionClientId === item.clientId} onClick={() => runApplicantAction(item.clientId, 'send')}>
              Resend activation
            </Button>
          ) : null}
          {!item.canCreateAccount && !item.canSendActivation && !item.canResendActivation ? (
            <Box variant="small" color="inherit">-</Box>
          ) : null}
        </SpaceBetween>
      ),
    },
  ]), [applicantActionClientId, runApplicantAction]);

  const applicantActiveSortingColumn = useMemo(
    () => applicantColumns.find(column => column.id === applicantSorting.columnId) || applicantColumns[0],
    [applicantColumns, applicantSorting.columnId],
  );

  const selectedCanDisable = selected.length > 0 && selected.every(user => user.status !== 'DISABLED');
  const selectedCanEnable = selected.length > 0 && selected.every(user => user.status === 'DISABLED');
  const selectedCanForceReset = selected.length > 0 && selected.every(user => !['DISABLED', 'FORCE_CHANGE_PASSWORD'].includes(user.status));
  const selectedCanRemoveRole = selected.length > 0 && selected.every(user => user.role && user.role !== '-');
  const selectedCanResendInvite = selected.length > 0 && selected.every(user => user.status === 'FORCE_CHANGE_PASSWORD');

  function handleTopTabChange(tabId) {
    setPageTabId(tabId);
    replaceUrlState({ tab: tabId });
  }

  function handleQuickFilterChange(tabId) {
    setQuickFilter(tabId);
    setAdminPageIndex(1);
    setSelected([]);
    setInspectorOpen(false);
    replaceUrlState({ tab: 'admin-users', filter: tabId });
  }

  function handleApplicantStatusChange(statusId) {
    setApplicantStatusFilter(statusId);
    setApplicantPageIndex(1);
    replaceUrlState({ tab: 'applicant-accounts', status: statusId });
  }

  function onSelectionChange(detail) {
    const sel = detail.selectedItems;
    setSelected(sel);
    setInspectorOpen(sel.length === 1);
  }

  async function bulkDisable() {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    const targets = [...selected];
    try {
      const results = await runBulkUserAction(targets, target => apiFetch(`/api/admin/users/${encodeURIComponent(target.username)}/disable`, { method: 'PATCH' }));
      const succeeded = results.filter(result => result.ok);
      const failed = results.filter(result => !result.ok);
      if (succeeded.length) {
        const resultMap = new Map(succeeded.map(result => [result.username, result]));
        updateUsersByUsername(
          succeeded.map(result => result.username),
          mergeBulkUserPayload(resultMap, user => ({ ...user, status: 'DISABLED' })),
        );
        pushFlash('success', `Disabled ${succeeded.length} user(s)`);
        succeeded.forEach(result => recordAudit({ action: 'disable', actor: 'you', detail: 'Disabled account', target: result.username }));
      }
      if (failed.length) pushFlash('error', buildBulkFailureMessage('Disable failed for', failed));
    } catch (error) {
      pushFlash('error', `Disable error: ${error.message}`);
    } finally {
      setActionBusy(false);
      setSelected([]);
      setInspectorOpen(false);
    }
  }

  async function bulkEnable() {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    const targets = [...selected];
    try {
      const results = await runBulkUserAction(targets, target => apiFetch(`/api/admin/users/${encodeURIComponent(target.username)}/enable`, { method: 'PATCH' }));
      const succeeded = results.filter(result => result.ok);
      const failed = results.filter(result => !result.ok);
      if (succeeded.length) {
        const resultMap = new Map(succeeded.map(result => [result.username, result]));
        updateUsersByUsername(
          succeeded.map(result => result.username),
          mergeBulkUserPayload(resultMap, user => ({ ...user, status: user.status === 'DISABLED' ? 'CONFIRMED' : user.status })),
        );
        pushFlash('success', `Enabled ${succeeded.length} user(s)`);
        succeeded.forEach(result => recordAudit({ action: 'enable', actor: 'you', detail: 'Enabled account', target: result.username }));
      }
      if (failed.length) pushFlash('error', buildBulkFailureMessage('Enable failed for', failed));
    } catch (error) {
      pushFlash('error', `Enable error: ${error.message}`);
    } finally {
      setActionBusy(false);
      setSelected([]);
      setInspectorOpen(false);
    }
  }

  async function bulkRemoveRole() {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    const targets = [...selected];
    try {
      const results = await runBulkUserAction(targets, target => apiFetch(`/api/admin/users/${encodeURIComponent(target.username)}/role`, { method: 'DELETE' }));
      const succeeded = results.filter(result => result.ok);
      const failed = results.filter(result => !result.ok);
      if (succeeded.length) {
        updateUsersByUsername(succeeded.map(result => result.username), user => ({ ...user, role: '-' }));
        pushFlash('success', `Removed role for ${succeeded.length} user(s)`);
        succeeded.forEach(result => recordAudit({ action: 'role-remove', actor: 'you', detail: 'Removed role', target: result.username }));
      }
      if (failed.length) pushFlash('error', buildBulkFailureMessage('Remove role failed for', failed));
    } catch (error) {
      pushFlash('error', `Remove role error: ${error.message}`);
    } finally {
      setActionBusy(false);
      setSelected([]);
      setInspectorOpen(false);
    }
  }

  async function bulkResendInvite() {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    const targets = [...selected];
    try {
      const results = await runBulkUserAction(targets, target => apiFetch(`/api/admin/users/${encodeURIComponent(target.username)}/resend-invite`, { method: 'POST' }));
      const succeeded = results.filter(result => result.ok);
      const failed = results.filter(result => !result.ok);
      if (succeeded.length) {
        pushFlash('success', `Resent invite for ${succeeded.length} user(s)`);
        succeeded.forEach(result => recordAudit({ action: 'resend-invite', actor: 'you', detail: 'Resent invite', target: result.username }));
      }
      if (failed.length) pushFlash('error', buildBulkFailureMessage('Resend invite failed for', failed));
    } catch (error) {
      pushFlash('error', `Resend invite error: ${error.message}`);
    } finally {
      setActionBusy(false);
      setSelected([]);
      setInspectorOpen(false);
    }
  }

  async function bulkForceReset() {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    const targets = [...selected];
    try {
      const results = await runBulkUserAction(targets, target => apiFetch(`/api/admin/users/${encodeURIComponent(target.username)}/force-reset`, { method: 'PATCH' }));
      const succeeded = results.filter(result => result.ok);
      const failed = results.filter(result => !result.ok);
      if (succeeded.length) {
        updateUsersByUsername(succeeded.map(result => result.username), user => ({ ...user, status: 'FORCE_CHANGE_PASSWORD' }));
        pushFlash('success', `Forced password reset for ${succeeded.length} user(s)`);
        succeeded.forEach(result => recordAudit({ action: 'force-reset', actor: 'you', detail: 'Password reset required', target: result.username }));
      }
      if (failed.length) pushFlash('error', buildBulkFailureMessage('Force reset failed for', failed));
    } catch (error) {
      pushFlash('error', `Force reset error: ${error.message}`);
    } finally {
      setActionBusy(false);
      setSelected([]);
      setInspectorOpen(false);
    }
  }

  function openRegionEdit(user) {
    if (!user) return;
    const ids = Array.isArray(user.regionIds) && user.regionIds.length
      ? user.regionIds.map(value => String(value))
      : (user.regionId != null ? [String(user.regionId)] : []);
    setRegionEditTarget(user);
    setRegionEditIds(ids);
    setRegionEditId(ids.length ? ids[0] : '');
    setShowRegionEdit(true);
  }

  function closeRegionEdit() {
    setShowRegionEdit(false);
    setRegionEditTarget(null);
    setRegionEditIds([]);
    setRegionEditId('');
    setRegionEditBusy(false);
  }

  async function saveRegionEdit() {
    if (!regionEditTarget) return;
    const username = regionEditTarget.username;
    const role = regionEditTarget.role;
    let payload = null;
    let nextRegionIds = [];
    let nextRegionId = null;

    if (role === 'Regional_Manager') {
      const ids = regionEditIds.map(value => Number(value)).filter(Number.isFinite);
      if (!ids.length) {
        pushFlash('error', 'Select at least one region');
        return;
      }
      payload = { region_ids: ids };
      nextRegionIds = Array.from(new Set(ids));
      nextRegionId = nextRegionIds[0] ?? null;
    } else if (role === 'ISET_Coordinator') {
      const numeric = Number(regionEditId);
      if (!Number.isFinite(numeric)) {
        pushFlash('error', 'Select a region');
        return;
      }
      payload = { region_id: numeric };
      nextRegionIds = [numeric];
      nextRegionId = numeric;
    } else {
      pushFlash('error', 'Regions apply only to Regional Managers and ISET Coordinators');
      return;
    }

    setRegionEditBusy(true);
    try {
      const resp = await apiFetch(`/api/admin/users/${encodeURIComponent(username)}/attributes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(await getResponseErrorMessage(resp));
      updateUsersByUsername([username], user => ({ ...user, regionId: nextRegionId, regionIds: nextRegionIds.length ? nextRegionIds : null }));
      recordAudit({ action: 'region-update', actor: 'you', detail: 'Updated regions', target: username });
      pushFlash('success', `Updated regions for ${username}`);
      closeRegionEdit();
    } catch (error) {
      pushFlash('error', `Region update failed (${error.message})`);
    } finally {
      setRegionEditBusy(false);
    }
  }

  async function saveProfileEdit(user, values) {
    const username = user?.username;
    const name = String(values?.name || '').trim();
    const displayName = String(values?.displayName || '').trim() || name;
    if (!username) return null;
    if (!name) throw new Error('Name is required');

    const resp = await apiFetch(`/api/admin/users/${encodeURIComponent(username)}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, display_name: displayName }),
    });
    if (!resp.ok) throw new Error(await getResponseErrorMessage(resp));
    const json = await resp.json().catch(() => null);
    const nextName = json?.name || name;
    const nextDisplayName = json?.displayName || json?.display_name || displayName || nextName;
    updateUsersByUsername([username], current => ({ ...current, name: nextName, displayName: nextDisplayName }));
    recordAudit({ action: 'profile-update', actor: 'you', detail: 'Updated staff profile', target: username });
    pushFlash('success', `Updated profile for ${username}`);
    return { name: nextName, displayName: nextDisplayName };
  }

  async function doRoleChange() {
    if (!roleChangeTarget?.username || !roleChangeTarget?.newRole) return;
    setRoleChanging(true);
    const username = roleChangeTarget.username;
    const currentUserRole = users.find(user => user.username === username)?.role;
    try {
      const resp = await apiFetch(`/api/admin/users/${encodeURIComponent(username)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole: roleChangeTarget.newRole }),
      });
      if (!resp.ok) throw new Error(await getResponseErrorMessage(resp));
      const json = await resp.json().catch(() => null);
      updateUsersByUsername([username], user => ({ ...user, role: json?.role || roleChangeTarget.newRole }));
      pushFlash('success', `Updated role for ${username} to ${ROLE_LABEL_BY_VALUE.get(roleChangeTarget.newRole) || roleChangeTarget.newRole}`);
      recordAudit({ action: 'role-change', actor: 'you', detail: `${currentUserRole} -> ${roleChangeTarget.newRole}`, target: username });
      setShowRoleChange(false);
      setRoleChangeTarget(null);
    } catch (error) {
      pushFlash('error', `Role change failed (${error.message})`);
    } finally {
      setRoleChanging(false);
    }
  }

  function handleCreateSubmit() {
    const email = form.email.trim();
    const name = form.name.trim();
    const displayName = form.displayName.trim() || name;
    if (!email || !form.role) {
      pushFlash('error', 'Email and role are required');
      return;
    }
    if (!name) {
      pushFlash('error', 'Name is required');
      return;
    }
    const regionIds = form.role === 'Regional_Manager'
      ? form.regionIds.map(value => Number(value)).filter(Number.isFinite)
      : [];
    const regionId = form.regionId ? Number(form.regionId) : null;
    if (form.role === 'Regional_Manager' && !regionIds.length) {
      pushFlash('error', 'At least one region is required for Regional Managers');
      return;
    }
    if (form.role === 'ISET_Coordinator' && !Number.isFinite(regionId)) {
      pushFlash('error', 'Region is required for ISET Coordinators');
      return;
    }
    setCreating(true);
    const payload = {
      email,
      name,
      display_name: displayName,
      role: form.role,
      ...(form.role === 'Regional_Manager' ? { region_ids: regionIds } : {}),
      ...(form.role === 'ISET_Coordinator' && Number.isFinite(regionId) ? { region_id: regionId } : {}),
    };
    apiFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async resp => {
      if (!resp.ok) throw new Error(await getResponseErrorMessage(resp));
      const primaryRegionId = regionIds.length ? regionIds[0] : (Number.isFinite(regionId) ? regionId : null);
      setUsers(current => ([...current, {
        username: email,
        email,
        name,
        displayName,
        role: form.role,
        status: 'FORCE_CHANGE_PASSWORD',
        regionId: primaryRegionId,
        regionIds: regionIds.length ? regionIds : null,
        mfa: false,
        lastSignIn: null,
        createdAt: new Date().toISOString(),
      }]));
      recordAudit({ action: 'create', actor: 'you', detail: `Created user as ${ROLE_LABEL_BY_VALUE.get(form.role) || form.role}`, target: email });
      pushFlash('success', `Created ${email} as ${ROLE_LABEL_BY_VALUE.get(form.role) || form.role}`);
      setShowCreate(false);
      setForm({ email: '', name: '', displayName: '', role: null, regionId: '', regionIds: [] });
    }).catch(error => {
      pushFlash('error', `Create failed (${error.message})`);
    }).finally(() => setCreating(false));
  }

  const adminColumnDefinitions = visibleColumnDefinitions(adminColumns, adminVisibleColumns, adminColumnWidths);
  const applicantColumnDefinitions = visibleColumnDefinitions(applicantColumns, applicantVisibleColumns, applicantColumnWidths, ['actions']);

  const adminPreferences = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize: adminPageSize,
        contentDisplay: contentDisplayFromColumns(adminColumns, adminVisibleColumns),
        columnWidths: adminColumnWidths,
      }}
      pageSizePreference={{
        title: 'Page size',
        options: PAGE_SIZE_OPTIONS,
      }}
      contentDisplayPreference={{
        title: 'Select visible columns',
        options: columnPreferenceOptions(adminColumns),
      }}
      onConfirm={({ detail }) => {
        setAdminPageSize(detail.pageSize || adminPageSize);
        if (Array.isArray(detail.contentDisplay)) {
          const nextVisible = detail.contentDisplay.filter(column => column.visible).map(column => column.id);
          setAdminVisibleColumns(nextVisible.length ? nextVisible : ADMIN_VISIBLE_COLUMNS);
        }
        const widths = extractColumnWidths(detail);
        if (widths.length) setAdminColumnWidths(widths);
        setAdminPageIndex(1);
      }}
    />
  );

  const applicantPreferences = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={{
        pageSize: applicantPageSize,
        contentDisplay: contentDisplayFromColumns(applicantColumns, applicantVisibleColumns),
        columnWidths: applicantColumnWidths,
      }}
      pageSizePreference={{
        title: 'Page size',
        options: PAGE_SIZE_OPTIONS,
      }}
      contentDisplayPreference={{
        title: 'Select visible columns',
        options: columnPreferenceOptions(applicantColumns, ['actions']),
      }}
      onConfirm={({ detail }) => {
        setApplicantPageSize(detail.pageSize || applicantPageSize);
        if (Array.isArray(detail.contentDisplay)) {
          const nextVisible = detail.contentDisplay.filter(column => column.visible).map(column => column.id);
          setApplicantVisibleColumns(nextVisible.length ? nextVisible : APPLICANT_VISIBLE_COLUMNS);
        }
        const widths = extractColumnWidths(detail);
        if (widths.length) setApplicantColumnWidths(widths);
        setApplicantPageIndex(1);
      }}
    />
  );

  const adminUsersPanel = (
    <SpaceBetween size="m">
      <Container
        header={
          <Header
            variant="h2"
            counter={`(${filteredAdminUsers.length})${selected.length ? ` - ${selected.length} selected` : ''}`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setShowCreate(true)} variant="primary" disabled={actionBusy}>Create user</Button>
                <Button disabled={!selectedCanDisable || actionBusy} onClick={bulkDisable}>{actionBusy ? 'Working...' : 'Disable'}</Button>
                <Button disabled={!selectedCanEnable || actionBusy} onClick={bulkEnable}>{actionBusy ? 'Working...' : 'Enable'}</Button>
                <Button disabled={!selectedCanForceReset || actionBusy} onClick={bulkForceReset}>{actionBusy ? 'Working...' : 'Force reset'}</Button>
                <Button disabled={!selectedCanRemoveRole || actionBusy} onClick={bulkRemoveRole}>Remove role</Button>
                <Button disabled={!selectedCanResendInvite || actionBusy} onClick={bulkResendInvite}>Resend invite</Button>
              </SpaceBetween>
            }
          >
            Staff access
          </Header>
        }
      >
        <SpaceBetween size="m">
          <Tabs
            ariaLabel="Administrative user filters"
            activeTabId={quickFilter}
            onChange={({ detail }) => handleQuickFilterChange(detail.activeTabId)}
            tabs={quickFilters.map(filter => ({
              id: filter.id,
              label: `${filter.label} (${quickFilterCounts[filter.id] ?? 0})`,
              content: null,
            }))}
          />
          <Table
            selectionType="multi"
            onSelectionChange={({ detail }) => onSelectionChange(detail)}
            selectedItems={selected}
            trackBy="username"
            columnDefinitions={adminColumnDefinitions}
            items={adminItemsPage}
            loading={loadingUsers}
            loadingText="Loading administrative users"
            variant="embedded"
            stickyHeader
            stripedRows
            wrapLines
            resizableColumns
            sortingColumn={adminActiveSortingColumn}
            sortingDescending={adminSorting.isDescending}
            onSortingChange={({ detail }) => {
              const columnId = detail?.sortingColumn?.id;
              if (!columnId) return;
              setAdminSorting({ columnId, isDescending: detail.isDescending });
              setAdminPageIndex(1);
            }}
            onColumnWidthsChange={({ detail }) => {
              const widths = extractColumnWidths(detail);
              if (widths.length) setAdminColumnWidths(widths);
            }}
            filter={
              <TextFilter
                filteringText={filteringText}
                onChange={({ detail }) => {
                  setFilteringText(detail.filteringText);
                  setAdminPageIndex(1);
                }}
                filteringPlaceholder="Search staff users"
                countText={`${filteredAdminUsers.length} ${filteredAdminUsers.length === 1 ? 'match' : 'matches'}`}
              />
            }
            empty={
              <Box textAlign="center" color="inherit">
                <SpaceBetween size="m">
                  <b>No staff users found</b>
                  <Button onClick={() => setShowCreate(true)} variant="primary">Create user</Button>
                </SpaceBetween>
              </Box>
            }
            pagination={
              <Pagination
                currentPageIndex={adminPageIndex}
                pagesCount={adminPagesCount}
                onChange={({ detail }) => setAdminPageIndex(detail.currentPageIndex)}
              />
            }
            preferences={adminPreferences}
            ariaLabels={{
              tableLabel: 'Administrative users',
              selectionGroupLabel: 'Administrative user selection',
            }}
          />
          {inspectorOpen && selected.length === 1 && (
            <UserInspector
              user={selected[0]}
              onClose={() => { setInspectorOpen(false); setSelected([]); }}
              onChangeRole={(username, currentRoleValue) => { setShowRoleChange(true); setRoleChangeTarget({ username, newRole: currentRoleValue }); }}
              resolveRegionLabel={resolveUserRegionLabel}
              onEditRegions={openRegionEdit}
              onSaveProfile={saveProfileEdit}
            />
          )}
        </SpaceBetween>
      </Container>

      <Container header={<Header variant="h2">Access overview</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          <MetricBlock label="Total staff users" value={securityMetrics.total} />
          <MetricBlock label="MFA missing" value={`${securityMetrics.mfaMissing} (${securityMetrics.percent(securityMetrics.mfaMissing)}%)`} />
          <MetricBlock label="Pending first sign-in" value={`${securityMetrics.pending} (${securityMetrics.percent(securityMetrics.pending)}%)`} />
          <MetricBlock label="Active in 30 days" value={`${securityMetrics.active30d} (${securityMetrics.percent(securityMetrics.active30d)}%)`} />
        </ColumnLayout>
        <Box margin={{ top: 'm' }}>
          <ColumnLayout columns={4} variant="text-grid">
            {roleCounts.map(count => (
              <MetricBlock key={count.role} label={count.label} value={count.count} />
            ))}
          </ColumnLayout>
        </Box>
      </Container>

      {audit.length ? (
        <Container header={<Header variant="h2">Recent changes this session</Header>}>
          <AuditLogWidget audit={audit} />
        </Container>
      ) : null}
    </SpaceBetween>
  );

  const applicantAccountsPanel = (
    <Container
      header={
        <Header
          variant="h2"
          counter={`(${applicantAccountsTotal})`}
          description="Create missing participant PATH accounts, send activation emails, and track account activation."
          actions={<Button iconName="refresh" onClick={loadApplicantAccounts} disabled={loadingApplicantAccounts} ariaLabel="Refresh applicant accounts">Refresh</Button>}
        >
          Participant PATH accounts
        </Header>
      }
    >
      <SpaceBetween size="m">
        <SegmentedControl
          selectedId={applicantStatusFilter}
          onChange={({ detail }) => handleApplicantStatusChange(detail.selectedId)}
          options={APPLICANT_STATUS_FILTERS}
          ariaLabel="Applicant account status filter"
        />
        <Table
          variant="embedded"
          trackBy="clientId"
          columnDefinitions={applicantColumnDefinitions}
          items={applicantAccounts}
          loading={loadingApplicantAccounts}
          loadingText="Loading applicant accounts"
          stickyHeader
          stripedRows
          wrapLines
          resizableColumns
          sortingColumn={applicantActiveSortingColumn}
          sortingDescending={applicantSorting.isDescending}
          onSortingChange={({ detail }) => {
            const columnId = detail?.sortingColumn?.id;
            if (!columnId || columnId === 'actions') return;
            setApplicantSorting({ columnId, isDescending: detail.isDescending });
            setApplicantPageIndex(1);
          }}
          onColumnWidthsChange={({ detail }) => {
            const widths = extractColumnWidths(detail);
            if (widths.length) setApplicantColumnWidths(widths);
          }}
          filter={
            <TextFilter
              filteringText={applicantFilteringText}
              onChange={({ detail }) => {
                setApplicantFilteringText(detail.filteringText);
                setApplicantPageIndex(1);
              }}
              filteringPlaceholder="Search applicant accounts"
              countText={`${applicantAccountsTotal} ${applicantAccountsTotal === 1 ? 'match' : 'matches'}`}
            />
          }
          pagination={
            <Pagination
              currentPageIndex={applicantPageIndex}
              pagesCount={pagesFor(applicantAccountsTotal, applicantPageSize)}
              onChange={({ detail }) => setApplicantPageIndex(detail.currentPageIndex)}
            />
          }
          preferences={applicantPreferences}
          empty={
            <Box textAlign="center" color="inherit">
              <b>No applicant accounts found</b>
            </Box>
          }
          ariaLabels={{
            tableLabel: 'Applicant accounts',
          }}
        />
      </SpaceBetween>
    </Container>
  );

  const dashboardTabs = [];
  if (canManageAdminUsers) {
    dashboardTabs.push({ id: 'admin-users', label: 'Staff access', content: adminUsersPanel });
  }
  if (canManageApplicantAccounts) {
    dashboardTabs.push({ id: 'applicant-accounts', label: 'Participant PATH accounts', content: applicantAccountsPanel });
  }

  return (
    <>
      {flashItems.length > 0 && <Box margin={{ bottom: 'm' }}><Flashbar items={flashItems} /></Box>}
      <Tabs
        activeTabId={pageTabId}
        onChange={({ detail }) => handleTopTabChange(detail.activeTabId)}
        tabs={dashboardTabs}
        ariaLabel="User management areas"
      />

      {showCreate && (
        <Modal
          visible
          header="Invite administrative user"
          onDismiss={() => setShowCreate(false)}
          footer={
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Button onClick={() => setShowCreate(false)} variant="link">Cancel</Button>
              <Button onClick={handleCreateSubmit} variant="primary" disabled={creating}>{creating ? <Spinner size="normal" /> : 'Send invite'}</Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <FormField label="Email" stretch>
              <Input value={form.email} onChange={event => setForm(current => ({ ...current, email: event.detail.value }))} placeholder="user@example.org" spellcheck={false} />
            </FormField>
            <FormField label="Name" stretch>
              <Input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.detail.value }))} placeholder="e.g. Jane Doe" spellcheck={false} />
            </FormField>
            <FormField label="Display name" stretch description="Shown in assignments and audit trails. Defaults to Name.">
              <Input value={form.displayName} onChange={event => setForm(current => ({ ...current, displayName: event.detail.value }))} placeholder="e.g. Jane D." spellcheck={false} />
            </FormField>
            <FormField label="Role">
              <Select
                selectedOption={form.role ? manageableRoleOptions.find(role => role.value === form.role) : null}
                onChange={event => setForm(current => ({ ...current, role: event.detail.selectedOption.value, regionId: '', regionIds: [] }))}
                options={manageableRoleOptions}
                placeholder="Select role"
              />
            </FormField>
            {form.role === 'Regional_Manager' && (
              <FormField label="Regions">
                <Multiselect
                  selectedOptions={resolveRegionOptionsByIds(form.regionIds)}
                  onChange={event => setForm(current => ({ ...current, regionIds: event.detail.selectedOptions.map(option => option.value) }))}
                  options={regionSelectOptions}
                  placeholder="Select regions"
                  inlineTokens
                />
              </FormField>
            )}
            {form.role === 'ISET_Coordinator' && (
              <FormField label="Region">
                <Select
                  selectedOption={form.regionId ? regionOptionById.get(String(form.regionId)) : null}
                  onChange={event => setForm(current => ({ ...current, regionId: event.detail.selectedOption.value }))}
                  options={regionSelectOptions}
                  placeholder="Select region"
                />
              </FormField>
            )}
            <Box variant="small" color="inherit">Cognito will email the user a temporary password they must change on first sign-in.</Box>
          </SpaceBetween>
        </Modal>
      )}

      {showRegionEdit && regionEditTarget && (
        <Modal
          visible
          header={`Update regions: ${regionEditTarget.username}`}
          onDismiss={closeRegionEdit}
          footer={
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Button onClick={closeRegionEdit} variant="link">Cancel</Button>
              <Button onClick={saveRegionEdit} variant="primary" disabled={regionEditBusy}>{regionEditBusy ? <Spinner size="normal" /> : 'Save changes'}</Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            {regionEditTarget.role === 'Regional_Manager' && (
              <FormField label="Regions">
                <Multiselect
                  selectedOptions={resolveRegionOptionsByIds(regionEditIds)}
                  onChange={event => setRegionEditIds(event.detail.selectedOptions.map(option => option.value))}
                  options={regionSelectOptions}
                  placeholder="Select regions"
                  inlineTokens
                />
              </FormField>
            )}
            {regionEditTarget.role === 'ISET_Coordinator' && (
              <FormField label="Region">
                <Select
                  selectedOption={regionEditId ? regionOptionById.get(String(regionEditId)) : null}
                  onChange={event => setRegionEditId(event.detail.selectedOption.value)}
                  options={regionSelectOptions}
                  placeholder="Select region"
                />
              </FormField>
            )}
            <Box variant="small" color="inherit">Updates database-backed region access for this user.</Box>
          </SpaceBetween>
        </Modal>
      )}

      {showRoleChange && (
        <Modal
          visible
          header={`Change role: ${roleChangeTarget?.username}`}
          onDismiss={() => { setShowRoleChange(false); setRoleChangeTarget(null); }}
          footer={
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              <Button onClick={() => { setShowRoleChange(false); setRoleChangeTarget(null); }} variant="link">Cancel</Button>
              <Button onClick={doRoleChange} variant="primary" disabled={roleChanging || !roleChangeTarget?.newRole}>{roleChanging ? <Spinner /> : 'Update role'}</Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <FormField label="New role">
              <Select
                selectedOption={roleChangeTarget?.newRole ? ROLE_OPTIONS.find(role => role.value === roleChangeTarget.newRole) : null}
                onChange={event => setRoleChangeTarget(current => ({ ...current, newRole: event.detail.selectedOption.value }))}
                options={manageableRoleOptions}
                placeholder="Select new role"
              />
            </FormField>
            <Box variant="small" color="inherit">This replaces the user's current admin role. Confirm region access after saving for Regional Managers or ISET Coordinators.</Box>
          </SpaceBetween>
        </Modal>
      )}
    </>
  );
}

function StatusPill({ status }) {
  const map = {
    CONFIRMED: { color: 'green', text: 'Active' },
    FORCE_CHANGE_PASSWORD: { color: 'blue', text: 'Pending reset' },
    DISABLED: { color: 'red', text: 'Disabled' },
  };
  const cfg = map[status] || { color: 'grey', text: status || 'Unknown' };
  return <Badge color={cfg.color}>{cfg.text}</Badge>;
}

function ApplicantAccountStatusPill({ status, label }) {
  const map = {
    no_account: { color: 'grey', text: label || 'No account' },
    created: { color: 'blue', text: label || 'Ready to invite' },
    invitation_sent: { color: 'green', text: label || 'Invitation sent' },
    activated: { color: 'green', text: label || 'Activated' },
  };
  const cfg = map[status] || { color: 'grey', text: label || status || 'Unknown' };
  return <Badge color={cfg.color}>{cfg.text}</Badge>;
}

function mapRoleToPermissions(role) {
  switch (role) {
    case 'System_Administrator': return 'All administrative actions';
    case 'NWAC_Administrator': return 'Manage NWAC administrators, regional managers, and ISET coordinators';
    case 'Regional_Manager': return 'Manage ISET coordinators';
    case 'ISET_Coordinator': return 'Coordinate assigned ISET cases';
    default: return '-';
  }
}

function UserInspector({ user, onClose, onChangeRole, resolveRegionLabel, onEditRegions, onSaveProfile }) {
  const canEditRegions = ['Regional_Manager', 'ISET_Coordinator'].includes(user.role);
  const initialProfileForm = useMemo(() => ({
    name: user.name || '',
    displayName: user.displayName || user.name || '',
  }), [user.displayName, user.name]);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    setProfileForm(initialProfileForm);
    setProfileError('');
  }, [initialProfileForm]);

  const profileDirty = profileForm.name !== initialProfileForm.name
    || profileForm.displayName !== initialProfileForm.displayName;

  async function handleProfileSave() {
    if (!onSaveProfile || profileSaving) return;
    const name = profileForm.name.trim();
    const displayName = profileForm.displayName.trim();
    if (!name) {
      setProfileError('Name is required');
      return;
    }
    setProfileSaving(true);
    setProfileError('');
    try {
      const updated = await onSaveProfile(user, { name, displayName });
      if (updated) {
        setProfileForm({
          name: updated.name || name,
          displayName: updated.displayName || displayName || updated.name || name,
        });
      }
    } catch (error) {
      setProfileError(error.message || 'Profile update failed');
    } finally {
      setProfileSaving(false);
    }
  }

  const profileRows = [
    { label: 'Username', value: user.username },
    { label: 'Email', value: user.email },
    { label: 'Regions', value: resolveRegionLabel ? resolveRegionLabel(user) : '-' },
  ];
  if (canEditRegions && onEditRegions) {
    profileRows.push({ label: 'Edit regions', value: <Button size="small" onClick={() => onEditRegions(user)}>Edit</Button> });
  }
  const roleRows = [
    { label: 'Role', value: ROLE_LABEL_BY_VALUE.get(user.role) || user.role },
    { label: 'Change role', value: <Button size="small" onClick={() => onChangeRole(user.username, user.role)}>Change</Button> },
    { label: 'Effective permissions', value: mapRoleToPermissions(user.role) },
  ];
  const securityRows = [
    { label: 'Status', value: <StatusPill status={user.status} /> },
    { label: 'MFA', value: user.mfa ? 'Enabled' : 'Not enabled' },
  ];
  const activityRows = [
    { label: 'Last sign-in', value: user.lastSignIn ? new Date(user.lastSignIn).toLocaleString() : 'Never' },
  ];

  const tabContent = rows => (
    <ColumnLayout columns={3} variant="text-grid">
      {rows.map(row => <KeyValue key={row.label} label={row.label} value={row.value} />)}
    </ColumnLayout>
  );

  const profileContent = (
    <SpaceBetween size="m">
      {tabContent(profileRows)}
      <ColumnLayout columns={2}>
        <FormField label="Name" errorText={profileError}>
          <Input
            value={profileForm.name}
            onChange={event => setProfileForm(current => ({ ...current, name: event.detail.value }))}
            spellcheck={false}
          />
        </FormField>
        <FormField label="Display name">
          <Input
            value={profileForm.displayName}
            onChange={event => setProfileForm(current => ({ ...current, displayName: event.detail.value }))}
            spellcheck={false}
          />
        </FormField>
      </ColumnLayout>
      <SpaceBetween direction="horizontal" size="xs">
        <Button variant="primary" onClick={handleProfileSave} disabled={!profileDirty || profileSaving}>
          {profileSaving ? <Spinner size="normal" /> : 'Save profile'}
        </Button>
        <Button onClick={() => { setProfileForm(initialProfileForm); setProfileError(''); }} disabled={!profileDirty || profileSaving}>
          Reset
        </Button>
      </SpaceBetween>
    </SpaceBetween>
  );

  const tabs = [
    { id: 'profile', label: 'Profile', content: profileContent },
    { id: 'roles', label: 'Roles and groups', content: tabContent(roleRows) },
    { id: 'security', label: 'MFA and security', content: tabContent(securityRows) },
    { id: 'activity', label: 'Activity', content: tabContent(activityRows) },
  ];

  return (
    <Container header={<Header variant="h2" actions={<Button onClick={onClose}>Close</Button>}>{user.username}</Header>}>
      <Tabs tabs={tabs} ariaLabel="User detail tabs" />
      <Box margin={{ top: 'm' }} variant="small" color="inherit">
        Use the table toolbar for account actions. Resend invite applies only while the user is still pending first sign-in.
      </Box>
    </Container>
  );
}

function KeyValue({ label, value }) {
  return (
    <Box>
      <div className="awsui-util-label">{label}</div>
      <div>{value}</div>
    </Box>
  );
}

function AuditLogWidget({ audit }) {
  return (
    <Table
      columnDefinitions={[
        { id: 'time', header: 'Time', cell: item => new Date(item.time).toLocaleTimeString(), sortingComparator: (left, right) => compareDates(left.time, right.time) },
        { id: 'actor', header: 'Actor', cell: item => item.actor },
        { id: 'action', header: 'Action', cell: item => item.action },
        { id: 'detail', header: 'Detail', cell: item => item.detail },
        { id: 'target', header: 'Target', cell: item => item.target },
      ]}
      items={audit}
      trackBy="id"
      variant="embedded"
      resizableColumns
      empty={<Box variant="small">No changes in this session.</Box>}
    />
  );
}

function MetricBlock({ label, value }) {
  return (
    <Box>
      <Box variant="awsui-key-label">{label}</Box>
      <Box variant="strong" fontSize="heading-m">{value}</Box>
    </Box>
  );
}
