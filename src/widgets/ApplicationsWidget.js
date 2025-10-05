import React, { useEffect, useState, useCallback } from 'react';
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
  Select
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useHistory } from 'react-router-dom';
import { apiFetch } from '../auth/apiClient';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const computeSlaMeta = (row) => {
  // Placeholder: assume SLA due 14 days after submitted_at until backend provides sla_due_at
  const submitted = new Date(row.submitted_at);
  const now = Date.now();
  const ageDays = Math.floor((now - submitted.getTime()) / 86400000);
  const due = row.sla_due_at ? new Date(row.sla_due_at) : new Date(submitted.getTime() + 14 * 86400000);
  const overdue = Date.now() > due.getTime();
  return { ageDays, due, overdue };
};

const columnDefinitions = [
  { id: 'tracking_id', header: 'Case / Submission ID', cell: i => i.tracking_id, minWidth: 140, isRowHeader: true },
  { id: 'status', header: 'Status', cell: i => {
      // Normalize display: if no assignee & status 'submitted'/'open' show 'Unassigned'
      let rawStatus = i.case_id ? (i.status || 'submitted') : 'New';
      const unassigned = i.case_id && !i.assigned_user_id && ['open','submitted'].includes(rawStatus.toLowerCase());
      const display = unassigned ? 'Unassigned' : (rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1));
      const type = unassigned ? 'pending' : (!i.case_id ? 'pending' : (display === 'Closed' ? 'success' : (i.sla_risk === 'overdue' ? 'warning' : 'info')));
      return <StatusIndicator type={type}>{display}</StatusIndicator>;
    }, minWidth: 120 },
  { id: 'sla_risk', header: 'SLA Health', cell: i => {
      const meta = computeSlaMeta(i);
      const badge = meta.overdue ? <Badge color="red">Overdue</Badge> : <Badge color="green">OK</Badge>;
      return (
        <span title={`Age: ${meta.ageDays}d | Due: ${meta.due.toLocaleDateString()}${meta.overdue ? ' (Overdue)' : ''}`} aria-label={`SLA ${meta.overdue ? 'Overdue' : 'OK'}; Age ${meta.ageDays} days; Due ${meta.due.toLocaleDateString()}`}>{badge}</span>
      );
    }, minWidth: 110 },
  { id: 'assigned_user_email', header: 'Owner', cell: i => i.case_id ? (i.assigned_user_email || '—') : 'Unassigned', minWidth: 200 },
  { id: 'submitted_at', header: 'Received', cell: i => new Date(i.submitted_at).toLocaleDateString(), minWidth: 140 },
];
const defaultVisibleColumns = ['tracking_id','status','sla_risk','assigned_user_email','submitted_at','actions'];

const ApplicationsWidget = ({ actions, refreshKey }) => {
  const history = useHistory();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(defaultVisibleColumns);
  const [selectedItems, setSelectedItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTargetCase, setAssignTargetCase] = useState(null);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignableLoading, setAssignableLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState(null); // Cloudscape Select expects {label,value}
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Fetch user role (supports real auth + simulated dev role via localStorage fallbacks)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          const role = data?.auth?.role || data?.auth?.primary_role || null;
          if (!cancelled && role) setUserRole(role);
        } else {
          // Fallback simulation: check common localStorage keys
          const keys = ['demoRole','simRole','simulatedRole','isetRole','role','currentRole','userRole'];
          for (const k of keys) {
            const v = window.localStorage.getItem(k);
            if (v) { setUserRole(v); break; }
          }
        }
      } catch (_) {
        // Silent; attempt localStorage fallback
        const keys = ['demoRole','simRole','simulatedRole','isetRole','role','currentRole','userRole'];
        for (const k of keys) {
          const v = window.localStorage.getItem(k);
          if (v) { setUserRole(v); break; }
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
          throw new Error('status_update_failed');
        }
      }

      setAssignSubmitting(false);
      setAssignModalVisible(false);
      setAssignTargetCase(null);
      setSelectedAssignee(null);
      load();
    } catch (error) {
      setAssignSubmitting(false);
      if (error?.message === 'status_update_failed') {
        setAssignError('Case assigned but status update to In Review failed. Please refresh and try again.');
        load();
      } else {
        setAssignError('Assignment failed');
      }
    }
  }, [assignTargetCase, selectedAssignee, assignableStaff, load]);

  // Client filtering (post-fetch) for quick text search; can be pushed server-side later
  const filteredItems = items.filter(i => {
    const s = filteringText.toLowerCase();
    return !s || [i.tracking_id, i.status, i.assigned_user_email, i.ptma_codes].some(v => v && v.toLowerCase().includes(s));
  });

  const actionsColumn = {
    id: 'actions', header: 'Actions', minWidth: 160, cell: item => {
      const unassigned = item.case_id && !item.assigned_user_id && ['open','submitted'].includes((item.status || '').toLowerCase());
  const reassignRoles = ['Program Administrator','Regional Coordinator','System Administrator'];
  const canReassign = item.case_id && item.assigned_user_id && reassignRoles.includes((userRole || '').trim());
      const openAssignModal = (caseItem, preselectId) => {
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
          .catch(() => setAssignError('Failed to load staff'))
          .finally(() => setAssignableLoading(false));
      };
      return (
        <SpaceBetween direction="horizontal" size="xs">
          {item.case_id && (
            <Button variant="inline-link" onClick={() => history.push(`/application-case/${item.case_id}`)}>View</Button>
          )}
          {unassigned && (
            <Button variant="inline-link" onClick={() => openAssignModal(item, null)}>Assign</Button>
          )}
          {canReassign && (
            <Button variant="inline-link" onClick={() => openAssignModal(item, item.assigned_user_id)}>Reassign</Button>
          )}
          {!item.case_id && <span style={{ color: '#888' }}>—</span>}
        </SpaceBetween>
      );
    }
  };
  const allColumns = [...columnDefinitions, actionsColumn];

  const pagesCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const preferences = {
    pageSize,
    contentDisplay: columnDefinitions.map(c => ({ id: c.id, visible: visibleColumns.includes(c.id) }))
  };

  return (
    <BoardItem
  header={<Header variant="h2" actions={<Button iconName="refresh" onClick={() => { setCurrentPageIndex(1); load(); }} ariaLabel="Refresh applications"/>}>ISET Applications</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={<ButtonDropdown items={[{ id: 'remove', text: 'Remove' }]} ariaLabel="Board item settings" variant="icon" onItemClick={() => actions?.removeItem?.()} />}
    >
      <SpaceBetween direction="vertical" size="xs">
  <Box variant="small">The table shows applications in your purview.  Progam Admins can see all applications. Regional Coordinators can see applications assigned to them, or to assessors in their region.  Assessors can only see applications assigned to them.</Box>
        <Box>
          {loading ? <Box textAlign="center" padding="m"><Spinner /> Loading...</Box> : error ? <Box color="error" textAlign="center">{error}</Box> : (
            <Table
              columnDefinitions={allColumns.filter(c => visibleColumns.includes(c.id) || c.id === 'actions')}
              items={filteredItems}
              loading={false}
              variant="embedded"
              wrapLines
              resizableColumns
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
              preferences={<CollectionPreferences title="Preferences" confirmLabel="Confirm" cancelLabel="Cancel" preferences={preferences} pageSizePreference={{ title: 'Page size', options: PAGE_SIZE_OPTIONS.map(v => ({ value: v, label: `${v} rows` })) }} contentDisplayPreference={{ title: 'Select visible columns', options: columnDefinitions.map(c => ({ id: c.id, label: c.header, alwaysVisible: c.id === 'tracking_id' })).concat([{ id: 'actions', label: 'Actions', alwaysVisible: true }]) }} onConfirm={({ detail }) => { setPageSize(detail.pageSize); setVisibleColumns(detail.contentDisplay.filter(c => c.visible).map(c => c.id)); setCurrentPageIndex(1); }} />}
            />
          )}
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


