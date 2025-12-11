import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  Button,
  ButtonDropdown,
  FormField,
  Header,
  Link,
  Modal,
  Select,
  SpaceBetween,
  StatusIndicator,
  Table
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';
import { getRoleDisplayName } from '../utils/roleDisplay';
import useCurrentUser from '../hooks/useCurrentUser';

const buildColumns = (onReassign, onResolve) => [
  {
    id: 'case',
    header: 'Application Ref',
    cell: item => item.referenceNumber
      ? <Link href={`/application-case/${item.caseId || ''}`}>{item.referenceNumber}</Link>
      : '—',
    sortingField: 'referenceNumber'
  },
  {
    id: 'staff',
    header: 'Staff',
    cell: item => item.staffEmail || '—',
    sortingField: 'staffEmail'
  },
  {
    id: 'role',
    header: 'Role',
    cell: item => getRoleDisplayName(item.staffRole) || item.staffRole || '—',
    sortingField: 'staffRole'
  },
  {
    id: 'region',
    header: 'Region',
    cell: item => (Number.isFinite(item.staffRegionId) ? item.staffRegionId : '—'),
    sortingField: 'staffRegionId'
  },
  {
    id: 'details',
    header: 'Details',
    cell: item => item.details || '—'
  },
  {
    id: 'signedAt',
    header: 'Signed At',
    cell: item => item.signedAt ? new Date(item.signedAt).toLocaleString() : '—',
    sortingField: 'signedAt'
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: item => (
      <SpaceBetween direction="horizontal" size="xs">
        <Button variant="inline-link" onClick={() => onReassign(item)} iconName="share">
          Reassign
        </Button>
        <Button variant="inline-link" onClick={() => onResolve(item)} iconName="status-positive">
          Resolve
        </Button>
      </SpaceBetween>
    )
  }
];

const boardItemI18nStrings = {
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
};

const ConflictDeclarationsWidget = ({ role, refreshKey, actions }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignableLoading, setAssignableLoading] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [assignError, setAssignError] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const { userId: currentUserId, role: currentUserRole, regionId: currentUserRegionId } = useCurrentUser();

  const load = React.useCallback(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    apiFetch('/api/dashboard/conflict-declarations')
      .then(async resp => {
        if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
        const payload = await resp.json();
        if (ignore) return;
        setItems(Array.isArray(payload?.declarations) ? payload.declarations : []);
      })
      .catch(e => {
        if (!ignore) {
          setItems([]);
          setError(e?.message || 'Unable to load conflict declarations.');
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [refreshKey, load]);

  const normalizedRegionId = Number.isFinite(Number(currentUserRegionId)) ? Number(currentUserRegionId) : null;

  const isStaffVisible = useMemo(() => {
    const userRole = (currentUserRole || '').trim();
    return (staff) => {
      if (!staff) return false;
      if (userRole === 'Regional Coordinator') {
        if (currentUserId && String(staff.id) === String(currentUserId)) return true;
        const staffRegion = staff.region_id != null ? Number(staff.region_id) : (staff.staff_region_id != null ? Number(staff.staff_region_id) : null);
        return Number.isFinite(normalizedRegionId) && Number.isFinite(staffRegion) && staffRegion === normalizedRegionId;
      }
      return true;
    };
  }, [currentUserRole, currentUserId, normalizedRegionId]);

  const filteredAssignableStaff = useMemo(() => {
    return Array.isArray(assignableStaff) ? assignableStaff.filter(isStaffVisible) : [];
  }, [assignableStaff, isStaffVisible]);

  const openAssignModal = useCallback((item) => {
    if (!item?.caseId) {
      setAssignError('Case ID missing for reassignment.');
      return;
    }
    setAssignTarget(item);
    setAssignError(null);
    setSelectedAssignee(null);
    setAssignableLoading(true);
    setAssignModalVisible(true);
    apiFetch('/api/staff/assignable')
      .then(r => { if (!r.ok) throw new Error('fetch_failed'); return r.json(); })
      .then(list => {
        setAssignableStaff(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        setAssignableStaff([]);
        setAssignError('Failed to load staff list.');
      })
      .finally(() => setAssignableLoading(false));
  }, []);

  const handleAssignSubmit = useCallback(async () => {
    if (!assignTarget || !selectedAssignee) return;
    setAssignSubmitting(true);
    setAssignError(null);
    const chosen = selectedAssignee.value;
    const payload = {};
    const staffObj = assignableStaff.find(s => String(s.id) === String(chosen));
    if (chosen && String(chosen).startsWith('placeholder-')) {
      payload.placeholder_email = staffObj?.email || 'user@nwac.ca';
    } else {
      payload.assignee_id = chosen;
    }
    const caseId = assignTarget.caseId;
    try {
      const resp = await apiFetch(`/api/cases/${caseId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('assign_failed');
      if (assignTarget.staffProfileId) {
        try {
          await apiFetch(`/api/cases/${caseId}/conflicts/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staff_profile_id: assignTarget.staffProfileId })
          });
        } catch (_) {
          // non-fatal
        }
      }
      setAssignModalVisible(false);
      setAssignTarget(null);
      setSelectedAssignee(null);
      load();
    } catch (err) {
      setAssignError('Assignment failed.');
    } finally {
      setAssignSubmitting(false);
    }
  }, [assignTarget, selectedAssignee, assignableStaff, load]);

  const handleResolveConfirm = useCallback(async () => {
    if (!resolveTarget?.caseId || !resolveTarget?.staffProfileId) return;
    setResolveSubmitting(true);
    try {
      const resp = await apiFetch(`/api/cases/${resolveTarget.caseId}/conflicts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_profile_id: resolveTarget.staffProfileId })
      });
      if (!resp.ok) throw new Error('resolve_failed');
      setResolveTarget(null);
      load();
    } catch (_) {
      setError('Failed to resolve conflict.');
    } finally {
      setResolveSubmitting(false);
    }
  }, [resolveTarget, load]);

  const handleResolve = useCallback((item) => {
    if (!item?.caseId || !item?.staffProfileId) return;
    setResolveTarget(item);
  }, []);

  const columnDefinitions = useMemo(() => buildColumns(openAssignModal, handleResolve), [openAssignModal, handleResolve]);
  const tableItems = useMemo(() => items, [items]);

  return (
    <BoardItem
      i18nStrings={boardItemI18nStrings}
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
      header={(
        <Header
          variant="h2"
          description="Conflicts of interest declared by staff in your remit."
        >
          Conflict Declarations
        </Header>
      )}
    >
      <Table
        items={tableItems}
        columnDefinitions={columnDefinitions}
        loading={loading}
        loadingText="Loading conflict declarations"
        header={<Header variant="h3">Conflict Declarations</Header>}
        empty={<Box textAlign="center">No conflict declarations found.</Box>}
        sortingDisabled={false}
      variant="embedded"
      resizableColumns
      stickyHeader
      wrapLines
      {...(error ? { footer: <StatusIndicator type="error">{error}</StatusIndicator> } : {})}
    />
      {resolveTarget && (
        <Modal
          visible={!!resolveTarget}
          onDismiss={() => { if (!resolveSubmitting) setResolveTarget(null); }}
          header="Resolve conflict declaration"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setResolveTarget(null)} disabled={resolveSubmitting}>Cancel</Button>
              <Button variant="primary" loading={resolveSubmitting} onClick={handleResolveConfirm}>
                Resolve
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            <Box>
              This will mark the declaration as <strong>no conflict</strong> so the assignee can continue working the case.
            </Box>
            <Box>
              The original declaration details will be retained for the record.
            </Box>
          </SpaceBetween>
        </Modal>
      )}
      {assignModalVisible && (
        <Modal
          visible={assignModalVisible}
          onDismiss={() => { if (!assignSubmitting) { setAssignModalVisible(false); setAssignTarget(null); } }}
          header={`Assign Application ${assignTarget?.referenceNumber || ''}`}
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => { if (!assignSubmitting) { setAssignModalVisible(false); setAssignTarget(null); } }} disabled={assignSubmitting}>Cancel</Button>
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
    </BoardItem>
  );
};

export default ConflictDeclarationsWidget;
