// New Admin User Management Dashboard (mocked Cognito-based admin roles)
import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Button,
  Header,
  SpaceBetween,
  Table,
  TextFilter,
  Badge,
  Flashbar,
  Modal,
  FormField,
  Input,
  Select,
  Spinner,
  Container,
  ColumnLayout
} from '@cloudscape-design/components';
import Tabs from '@cloudscape-design/components/tabs';
import { buildApiUrl } from '../config/apiConfig';
import { apiFetch } from '../auth/apiClient';
import Board from '@cloudscape-design/board-components/board';
import BoardItem from '@cloudscape-design/board-components/board-item';

// Canonical (flexible) role keys – UI should adapt if list changes later
const ROLE_OPTIONS = [
  { value: 'SysAdmin', label: 'System Admin' },
  { value: 'ProgramAdmin', label: 'Program Admin' },
  { value: 'RegionalCoordinator', label: 'Regional Coordinator' },
  { value: 'Adjudicator', label: 'Adjudicator' }
];

// Users loaded from backend (mock fallback server-side if provider disabled)

export default function UserManagementDashboard() {
  const [items, setItems] = useState([
  { id: 'admin-users-table', rowSpan: 6, columnSpan: 4, data: { title: 'Administrative Users' } },
  { id: 'role-kpis', rowSpan: 3, columnSpan: 1, data: { title: 'Role Distribution' } },
  { id: 'security-compliance', rowSpan: 3, columnSpan: 1, data: { title: 'Security Compliance' } },
  { id: 'metrics-snapshot', rowSpan: 3, columnSpan: 1, data: { title: 'Metrics Snapshot' } },
  { id: 'audit-log', rowSpan: 3, columnSpan: 1, data: { title: 'Recent Admin Actions' } }
  ]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  // Load users once
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingUsers(true);
      try {
  const resp = await apiFetch('/api/admin/users');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json().catch(() => ({ users: [] }));
        if (!cancelled) setUsers(Array.isArray(json.users) ? json.users : []);
      } catch (e) {
        if (!cancelled) {
          pushFlash('error', `Failed to load users (${e.message || 'network'})`);
          setUsers([]);
        }
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);
  const [filteringText, setFilteringText] = useState('');
  const [selected, setSelected] = useState([]); // can be multi
  const [showCreate, setShowCreate] = useState(false);
  const [flashItems, setFlashItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: '', role: null, regionId: '' });
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all');
  const [actionBusy, setActionBusy] = useState(false);
  const [showRoleChange, setShowRoleChange] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState(null);
  const [roleChanging, setRoleChanging] = useState(false);
  const [audit, setAudit] = useState([]); // in-memory audit log

  const QUICK_FILTERS = [
    { id: 'all', label: 'All', predicate: () => true },
    { id: 'disabled', label: 'Disabled', predicate: u => u.status === 'DISABLED' },
    { id: 'pending', label: 'Pending', predicate: u => u.status === 'FORCE_CHANGE_PASSWORD' },
    { id: 'noMfa', label: 'No MFA', predicate: u => !u.mfa },
    { id: 'admins', label: 'Admins', predicate: u => ['SysAdmin','ProgramAdmin'].includes(u.role) },
    { id: 'recent', label: 'Recently Active', predicate: u => u.lastSignIn && (Date.now() - Date.parse(u.lastSignIn)) < 7*24*3600*1000 },
    { id: 'never', label: 'Never Logged In', predicate: u => !u.lastSignIn }
  ];

  const filtered = useMemo(() => {
    const ft = filteringText.trim().toLowerCase();
    const active = QUICK_FILTERS.find(f => f.id === quickFilter) || QUICK_FILTERS[0];
    return users.filter(u => active.predicate(u)).filter(u => !ft || [u.username, u.email, u.role].some(v => String(v).toLowerCase().includes(ft)));
  }, [filteringText, users, quickFilter]);

  // Debounced server search
  useEffect(() => {
    const q = filteringText.trim();
    const handle = setTimeout(async () => {
      try {
        const resp = await apiFetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        if (resp.ok) {
          const json = await resp.json();
          if (Array.isArray(json.users)) setUsers(json.users);
        }
      } catch { /* silent */ }
    }, 550);
    return () => clearTimeout(handle);
  }, [filteringText]);

  const columns = [
    { id: 'username', header: 'Username', cell: i => i.username },
    { id: 'email', header: 'Email', cell: i => i.email },
    { id: 'role', header: 'Role', cell: i => ROLE_OPTIONS.find(r => r.value === i.role)?.label || i.role },
    { id: 'region', header: 'Region', cell: i => i.regionId ?? '—' },
    { id: 'status', header: 'Status', cell: i => <StatusPill status={i.status} /> },
    { id: 'mfa', header: 'MFA', cell: i => i.mfa ? <Badge color="green">Enabled</Badge> : <Badge>MISSING</Badge> },
    { id: 'last', header: 'Last Sign-In', cell: i => i.lastSignIn ? new Date(i.lastSignIn).toLocaleString() : '—' }
  ];

  function pushFlash(type, content) {
    setFlashItems(cur => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2,7);
      const remove = () => setFlashItems(prev => prev.filter(f => f.id !== id));
      const next = { id, type, content, dismissible: true, onDismiss: remove };
      // De-dupe by content
      return [...cur.filter(f => f.content !== content), next];
    });
  }

  function recordAudit(evt) {
    setAudit(a => [{ id: Date.now().toString()+Math.random().toString(36).slice(2,6), time: new Date().toISOString(), ...evt }, ...a].slice(0,50));
  }

  async function doRoleChange() {
    if (!roleChangeTarget?.username || !roleChangeTarget?.newRole) return;
    setRoleChanging(true);
    const username = roleChangeTarget.username;
    const currentRole = users.find(u => u.username === username)?.role;
    try {
      const resp = await apiFetch(`/api/admin/users/${encodeURIComponent(username)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole: roleChangeTarget.newRole, currentRole })
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setUsers(cur => cur.map(u => u.username === username ? { ...u, role: roleChangeTarget.newRole } : u));
      pushFlash('success', `Updated role for ${username} to ${roleChangeTarget.newRole}`);
      recordAudit({ action: 'role-change', actor: 'you', detail: `${currentRole} -> ${roleChangeTarget.newRole}`, target: username });
      setShowRoleChange(false); setRoleChangeTarget(null);
    } catch (e) {
      pushFlash('error', `Role change failed (${e.message})`);
    } finally {
      setRoleChanging(false);
    }
  }

  function handleCreateSubmit() {
    if (!form.email || !form.role) {
      pushFlash('error', 'Email and role are required');
      return;
    }
    setCreating(true);
    const payload = {
      email: form.email,
      role: form.role,
      ...(form.regionId ? { region_id: Number(form.regionId) } : {})
    };
    apiFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(async resp => {
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      // Optimistically add user (mock or real) for immediate feedback
      setUsers(cur => ([...cur, { username: form.email, email: form.email, role: form.role, status: 'FORCE_CHANGE_PASSWORD', regionId: form.regionId ? Number(form.regionId) : null, mfa: false, lastSignIn: null }]));
      recordAudit({ action: 'create', actor: 'you', detail: `Created user as ${form.role}`, target: form.email });
      pushFlash('success', `Created ${form.email} as ${form.role}`);
      setShowCreate(false);
      setForm({ email: '', role: null, regionId: '' });
    }).catch(e => {
      pushFlash('error', `Create failed (${e.message})`);
    }).finally(() => setCreating(false));
  }

  function onSelectionChange(detail) {
    const sel = detail.selectedItems;
    setSelected(sel);
    setInspectorOpen(sel.length === 1);
  }

  function updateSelectedUsers(mapper) {
    const usernames = new Set(selected.map(s => s.username));
    setUsers(cur => cur.map(u => usernames.has(u.username) ? mapper(u) : u));
    // refresh selected references after mutation
    setSelected(cur => cur.map(s => ({ ...users.find(u => u.username === s.username), ...s }))); // shallow refresh
  }

  async function bulkDisable() {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    const targets = [...selected];
    // optimistic
    updateSelectedUsers(u => ({ ...u, status: 'DISABLED' }));
    try {
      const results = await Promise.all(targets.map(t => apiFetch(`/api/admin/users/${encodeURIComponent(t.username)}/disable`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: t.role })
      }).then(r => r.ok ? null : r.status)));
      const failed = results.filter(r => r);
      if (failed.length) {
        pushFlash('error', `Disable failed for ${failed.length} user(s)`);
      } else {
        pushFlash('success', `Disabled ${targets.length} user(s)`);
  targets.forEach(t => recordAudit({ action: 'disable', actor: 'you', detail: 'Disabled account', target: t.username }));
      }
    } catch (e) {
      pushFlash('error', `Disable error: ${e.message}`);
    } finally {
      setActionBusy(false);
      setSelected([]); setInspectorOpen(false);
    }
  }
  async function bulkEnable() {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    const targets = [...selected];
    // optimistic
    updateSelectedUsers(u => ({ ...u, status: u.status === 'FORCE_CHANGE_PASSWORD' ? 'FORCE_CHANGE_PASSWORD' : 'CONFIRMED' }));
    try {
      const results = await Promise.all(targets.map(t => apiFetch(`/api/admin/users/${encodeURIComponent(t.username)}/enable`, {
        method: 'PATCH'
      }).then(r => r.ok ? null : r.status)));
      const failed = results.filter(r => r);
      if (failed.length) {
        pushFlash('error', `Enable failed for ${failed.length} user(s)`);
      } else {
        pushFlash('success', `Enabled ${targets.length} user(s)`);
  targets.forEach(t => recordAudit({ action: 'enable', actor: 'you', detail: 'Enabled account', target: t.username }));
      }
    } catch (e) {
      pushFlash('error', `Enable error: ${e.message}`);
    } finally {
      setActionBusy(false);
      setSelected([]); setInspectorOpen(false);
    }
  }
  async function bulkRemoveRole() {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    const targets = [...selected];
    try {
      const results = await Promise.all(targets.map(t => apiFetch(`/api/admin/users/${encodeURIComponent(t.username)}/role`, { method: 'DELETE' }).then(r => r.ok ? null : r.status)));
      const failed = results.filter(r => r);
      if (failed.length) pushFlash('error', `Remove role failed for ${failed.length}`); else {
        pushFlash('success', `Removed role for ${targets.length} user(s)`);
        setUsers(cur => cur.map(u => targets.find(t => t.username === u.username) ? { ...u, role: '—' } : u));
        targets.forEach(t => recordAudit({ action: 'role-remove', actor: 'you', detail: 'Removed role', target: t.username }));
      }
    } catch (e) {
      pushFlash('error', `Remove role error: ${e.message}`);
    } finally { setActionBusy(false); setSelected([]); setInspectorOpen(false); }
  }

  async function bulkResendInvite() {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    const targets = [...selected];
    try {
      const results = await Promise.all(targets.map(t => apiFetch(`/api/admin/users/${encodeURIComponent(t.username)}/resend-invite`, { method: 'POST' }).then(r => r.ok ? null : r.status)));
      const failed = results.filter(r => r);
      if (failed.length) pushFlash('error', `Resend invite failed for ${failed.length}`); else {
        pushFlash('success', `Resent invite for ${targets.length} user(s)`);
        targets.forEach(t => recordAudit({ action: 'resend-invite', actor: 'you', detail: 'Resent invite', target: t.username }));
      }
    } catch (e) { pushFlash('error', `Resend invite error: ${e.message}`); }
    finally { setActionBusy(false); setSelected([]); setInspectorOpen(false); }
  }
  async function bulkForceReset() {
    if (!selected.length || actionBusy) return;
    setActionBusy(true);
    const targets = [...selected];
    updateSelectedUsers(u => ({ ...u, status: 'FORCE_CHANGE_PASSWORD' }));
    try {
      const results = await Promise.all(targets.map(t => apiFetch(`/api/admin/users/${encodeURIComponent(t.username)}/force-reset`, { method: 'PATCH' }).then(r => r.ok ? null : r.status)));
      const failed = results.filter(r => r);
      if (failed.length) {
        pushFlash('error', `Force reset failed for ${failed.length} user(s)`);
      } else {
        pushFlash('success', `Forced password reset for ${targets.length} user(s)`);
        targets.forEach(t => recordAudit({ action: 'force-reset', actor: 'you', detail: 'Password reset required', target: t.username }));
      }
    } catch (e) {
      pushFlash('error', `Force reset error: ${e.message}`);
    } finally {
      setActionBusy(false);
      setSelected([]); setInspectorOpen(false);
    }
  }

  const roleCounts = useMemo(() => {
    return ROLE_OPTIONS.map(r => ({ role: r.value, label: r.label, count: users.filter(u => u.role === r.value).length }));
  }, [users]);

  const securityMetrics = useMemo(() => {
    const total = users.length || 0;
    const disabled = users.filter(u => u.status === 'DISABLED').length;
    const pending = users.filter(u => u.status === 'FORCE_CHANGE_PASSWORD').length;
    const mfaEnabled = users.filter(u => u.mfa).length;
    const mfaMissing = total - mfaEnabled;
    function pct(v) { return total ? Math.round((v / total) * 100) : 0; }
    return { total, disabled, pending, mfaEnabled, mfaMissing, pct };
  }, [users]);

  const boardI18n = {
    liveAnnouncementDndStarted: op => (op === 'resize' ? 'Resizing' : 'Dragging'),
    liveAnnouncementDndCommitted: op => `${op} committed`,
    liveAnnouncementDndDiscarded: op => `${op} discarded`,
    navigationAriaLabel: 'Board navigation',
    navigationAriaDescription: 'Use arrow keys to navigate board items',
    navigationItemAriaLabel: item => (item ? item.data.title : 'Empty'),
  };

  const itemI18n = {
    dragHandleAriaLabel: 'Drag handle',
    dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space/Enter to drop, Esc to cancel',
    resizeHandleAriaLabel: 'Resize handle',
    resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to adjust, Space/Enter to drop, Esc to cancel'
  };

  return (
    <>
  {flashItems.length > 0 && <Box margin={{ bottom: 'm' }}><Flashbar items={flashItems} /></Box>}
      <Board
        items={items}
        renderItem={item => (
          <BoardItem
            key={item.id}
            {...item}
            header={<Header variant="h2">{item.data.title}</Header>}
            i18nStrings={itemI18n}
            dragHandleAriaLabel={itemI18n.dragHandleAriaLabel}
            resizeHandleAriaLabel={itemI18n.resizeHandleAriaLabel}
          >
            {item.id === 'admin-users-table' && (
              <SpaceBetween size="s">
                <QuickFilters active={quickFilter} setActive={setQuickFilter} options={QUICK_FILTERS} />
                <Table
                  selectionType="multi"
                  onSelectionChange={({ detail }) => onSelectionChange(detail)}
                  selectedItems={selected}
                  trackBy="username"
                  columnDefinitions={columns}
                  items={filtered}
                  loading={loadingUsers}
                  loadingText="Loading administrative users"
                  filter={<TextFilter filteringText={filteringText} onChange={e => setFilteringText(e.detail.filteringText)} filteringPlaceholder="Search users" />}
                  header={<Header
                    actions={
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button onClick={() => setShowCreate(true)} variant="primary" disabled={actionBusy}>Create user</Button>
                        <Button disabled={!selected.length || actionBusy} onClick={bulkDisable}>{actionBusy ? 'Working…' : 'Disable'}</Button>
                        <Button disabled={!selected.length || actionBusy} onClick={bulkEnable}>{actionBusy ? 'Working…' : 'Enable'}</Button>
                        <Button disabled={!selected.length || actionBusy} onClick={bulkForceReset}>{actionBusy ? 'Working…' : 'Force reset'}</Button>
                        <Button disabled={!selected.length || actionBusy} onClick={bulkRemoveRole}>Remove role</Button>
                        <Button disabled={!selected.length || actionBusy} onClick={bulkResendInvite}>Resend invite</Button>
                      </SpaceBetween>
                    }
                    counter={`(${filtered.length})${selected.length ? ` — ${selected.length} selected` : ''}`}
                  >Administrative Users</Header>}
                  empty={<Box textAlign="center" color="inherit"><SpaceBetween size="m"><b>No users</b><Button onClick={() => setShowCreate(true)} variant="primary">Create user</Button></SpaceBetween></Box>}
                />
                {inspectorOpen && selected.length === 1 && (
                  <UserInspector
                    user={selected[0]}
                    onClose={() => { setInspectorOpen(false); setSelected([]); }}
                    onChangeRole={(username, currentRole) => { setShowRoleChange(true); setRoleChangeTarget({ username, newRole: currentRole }); }}
                  />
                )}
              </SpaceBetween>
            )}
            {item.id === 'role-kpis' && (
              <RoleKpisWidget counts={roleCounts} />
            )}
            {item.id === 'security-compliance' && (
              <SecurityComplianceWidget metrics={securityMetrics} />
            )}
            {item.id === 'audit-log' && (
              <AuditLogWidget audit={audit} />
            )}
            {item.id === 'metrics-snapshot' && (
              <MetricsSnapshotWidget users={users} />
            )}
          </BoardItem>
        )}
  onItemsChange={e => setItems(e.detail.items)}
  i18nStrings={boardI18n}
      />

      {showCreate && (
        <Modal
          visible
          header="Invite administrative user"
          onDismiss={() => setShowCreate(false)}
          footer={<SpaceBetween direction="horizontal" size="xs" alignItems="center"><Button onClick={() => setShowCreate(false)} variant="link">Cancel</Button><Button onClick={handleCreateSubmit} variant="primary" disabled={creating}>{creating ? <Spinner size="normal" /> : 'Send invite'}</Button></SpaceBetween>}
        >
          <SpaceBetween size="m">
            <FormField label="Email" stretch><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.detail.value }))} placeholder="user@example.org" /></FormField>
            <FormField label="Role"><Select selectedOption={form.role ? ROLE_OPTIONS.find(r => r.value === form.role) : null} onChange={e => setForm(f => ({ ...f, role: e.detail.selectedOption.value }))} options={ROLE_OPTIONS} placeholder="Select role" /></FormField>
            {form.role && ['RegionalCoordinator','Adjudicator'].includes(form.role) && (
              <FormField label="Region ID (numeric)"><Input value={form.regionId} onChange={e => setForm(f => ({ ...f, regionId: e.detail.value }))} inputMode="numeric" placeholder="e.g. 1" /></FormField>
            )}
            {/* Invitation help text: show mock notice only when Cognito not configured */}
            {((process.env.REACT_APP_COGNITO_CLIENT_ID || '').startsWith('REPLACE_') || (process.env.REACT_APP_AWS_REGION ? false : true)) ? (
              <Box variant="small" color="inherit">A temporary password will be generated (mock mode – no real email sent).</Box>
            ) : (
              <Box variant="small" color="inherit">Cognito will email the user a temporary password they must change on first sign-in.</Box>
            )}
          </SpaceBetween>
        </Modal>
      )}
      {showRoleChange && (
        <Modal
          visible
          header={`Change role: ${roleChangeTarget?.username}`}
          onDismiss={() => { setShowRoleChange(false); setRoleChangeTarget(null); }}
          footer={<SpaceBetween direction="horizontal" size="xs" alignItems="center"><Button onClick={() => { setShowRoleChange(false); setRoleChangeTarget(null); }} variant="link">Cancel</Button><Button onClick={doRoleChange} variant="primary" disabled={roleChanging || !roleChangeTarget?.newRole}>{roleChanging ? <Spinner /> : 'Update role'}</Button></SpaceBetween>}
        >
          <SpaceBetween size="m">
            <FormField label="New Role">
              <Select
                selectedOption={roleChangeTarget?.newRole ? ROLE_OPTIONS.find(r => r.value === roleChangeTarget.newRole) : null}
                onChange={e => setRoleChangeTarget(t => ({ ...t, newRole: e.detail.selectedOption.value }))}
                options={ROLE_OPTIONS}
                placeholder="Select new role"
              />
            </FormField>
            <Box variant="small" color="inherit">Will remove user from current role group and add to the selected role. Region-specific attributes not yet updated here.</Box>
          </SpaceBetween>
        </Modal>
  )}
    </>
  );
}

function StatusPill({ status }) {
  const map = {
    CONFIRMED: { color: 'green', text: 'Active' },
    FORCE_CHANGE_PASSWORD: { color: 'blue', text: 'Pending Reset' },
    DISABLED: { color: 'red', text: 'Disabled' }
  };
  const cfg = map[status] || { color: 'grey', text: status || 'Unknown' };
  return <Badge color={cfg.color}>{cfg.text}</Badge>;
}

function RoleKpisWidget({ counts }) {
  const isMock = (process.env.REACT_APP_COGNITO_CLIENT_ID || '').startsWith('REPLACE_') || (process.env.REACT_APP_AWS_REGION ? false : true);
  return (
    <SpaceBetween size="xs">
      {counts.map(c => (
        <MetricRow key={c.role} label={c.label} value={c.count} badgeColor={c.count ? 'green' : 'grey'} />
      ))}
      {isMock && (
        <Box variant="small" color="inherit">Counts reflect mocked data (Cognito disabled).</Box>
      )}
    </SpaceBetween>
  );
}

function SecurityComplianceWidget({ metrics }) {
  const rows = [
    { label: 'Total users', value: metrics.total },
    { label: 'MFA enabled', value: `${metrics.mfaEnabled} (${metrics.pct(metrics.mfaEnabled)}%)` },
    { label: 'MFA missing', value: `${metrics.mfaMissing} (${metrics.pct(metrics.mfaMissing)}%)` },
    { label: 'Pending password reset', value: `${metrics.pending} (${metrics.pct(metrics.pending)}%)` },
    { label: 'Disabled accounts', value: `${metrics.disabled} (${metrics.pct(metrics.disabled)}%)` },
  ];
  return (
    <SpaceBetween size="xs">
      {rows.map(r => (
        <MetricRow key={r.label} label={r.label} value={r.value} />
      ))}
      <Box variant="small" color="inherit">Derived from current in-memory list.</Box>
    </SpaceBetween>
  );
}

function mapRoleToPermissions(role) {
  switch (role) {
    case 'SysAdmin': return 'All administrative actions';
    case 'ProgramAdmin': return 'Manage regional coordinators & adjudicators';
    case 'RegionalCoordinator': return 'Manage adjudicators within region';
    case 'Adjudicator': return 'Review and adjudicate cases';
    default: return '—';
  }
}

function UserInspector({ user, onClose, onChangeRole }) {
  const profileRows = [
    { label: 'Username', value: user.username },
    { label: 'Email', value: user.email },
    { label: 'Region', value: user.regionId ?? '—' }
  ];
  const roleRows = [
    { label: 'Role', value: ROLE_OPTIONS.find(r => r.value === user.role)?.label || user.role },
    { label: 'Change Role', value: <Button size="small" onClick={() => onChangeRole(user.username, user.role)}>Change</Button> },
    { label: 'Effective Permissions', value: mapRoleToPermissions(user.role) }
  ];
  const securityRows = [
    { label: 'Status', value: <StatusPill status={user.status} /> },
    { label: 'MFA', value: user.mfa ? 'Enabled' : 'Not enabled' }
  ];
  const activityRows = [
    { label: 'Last Sign-In', value: user.lastSignIn ? new Date(user.lastSignIn).toLocaleString() : 'Never' }
  ];

  const tabContent = (rows) => (
    <ColumnLayout columns={3} variant="text-grid">
      {rows.map(r => <KeyValue key={r.label} label={r.label} value={r.value} />)}
    </ColumnLayout>
  );

  const tabs = [
    { id: 'profile', label: 'Profile', content: tabContent(profileRows) },
    { id: 'roles', label: 'Roles & Groups', content: tabContent(roleRows) },
    { id: 'security', label: 'MFA & Security', content: tabContent(securityRows) },
    { id: 'activity', label: 'Activity', content: tabContent(activityRows) }
  ];

  return (
    <Container
      header={<Header variant="h2" actions={<Button onClick={onClose}>Close</Button>}>{user.username}</Header>}
    >
      <Tabs tabs={tabs} ariaLabel="User detail tabs" />
      <Box margin={{ top: 'm' }} variant="small" color="inherit">Future actions: reset password, change role, enable/disable, force password reset.</Box>
    </Container>
  );
}

function QuickFilters({ active, setActive, options }) {
  return (
    <SpaceBetween size="xs" direction="horizontal">
      {options.map(opt => (
        <Button key={opt.id} variant={active === opt.id ? 'primary' : 'normal'} onClick={() => setActive(opt.id)}>{opt.label}</Button>
      ))}
    </SpaceBetween>
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
  if (!audit.length) return <Box variant="small">No actions yet.</Box>;
  return (
    <Table
      columnDefinitions={[
        { id: 'time', header: 'Time', cell: i => new Date(i.time).toLocaleTimeString() },
        { id: 'actor', header: 'Actor', cell: i => i.actor },
        { id: 'action', header: 'Action', cell: i => i.action },
        { id: 'detail', header: 'Detail', cell: i => i.detail },
        { id: 'target', header: 'Target', cell: i => i.target }
      ]}
      items={audit}
      trackBy="id"
      variant="embedded"
    />
  );
}

function MetricsSnapshotWidget({ users }) {
  const now = Date.now();
  const active30d = users.filter(u => u.lastSignIn && (now - Date.parse(u.lastSignIn)) < 30*24*3600*1000).length;
  const new7d = users.filter(u => u.createdAt && (now - Date.parse(u.createdAt)) < 7*24*3600*1000).length;
  const disabled = users.filter(u => u.status === 'DISABLED').length;
  // Failed logins not currently available; placeholder 0.
  const failed24h = 0;
  const rows = [
    { label: 'Active (30d)', value: active30d },
    { label: 'New (7d)', value: new7d },
    { label: 'Disabled', value: disabled },
    { label: 'Failed Logins (24h)', value: failed24h }
  ];
  return (
    <SpaceBetween size="xs">
      {rows.map(r => (
        <MetricRow key={r.label} label={r.label} value={r.value} />
      ))}
      <Box variant="small" color="inherit">Failed login metric placeholder (requires auth event source).</Box>
    </SpaceBetween>
  );
}

function MetricRow({ label, value, badgeColor }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '4px 12px',
      borderBottom: '1px solid #eee'
    }}>
      <span style={{ lineHeight: '18px' }}>{label}</span>
      <Badge color={badgeColor}>{value}</Badge>
    </div>
  );
}
