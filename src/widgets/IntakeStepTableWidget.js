import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Header, Button, SpaceBetween, Table, TextFilter, ButtonDropdown, Link, Modal, Alert, Select, FormField, Input, Textarea, Badge } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useHistory } from 'react-router-dom';
import IntakeStepLibraryWidgetHelp from '../helpPanelContents/intakeStepLibraryWidgetHelp';
import { apiFetch } from '../auth/apiClient'; // use authenticated fetch wrapper

const IntakeStepTableWidget = ({ actions, setSelectedBlockStep, toggleHelpPanel }) => {
  const [steps, setSteps] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupFilter, setGroupFilter] = useState({ label: 'All groups', value: '__all__' });
  const [loading, setLoading] = useState(true);
  const [filteringText, setFilteringText] = useState('');
  const [sortingState, setSortingState] = useState({ columnId: 'name', isDescending: false });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [editableGroups, setEditableGroups] = useState([]);
  const [savingGroups, setSavingGroups] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [banner, setBanner] = useState(null); // { type: 'info'|'error'|'success', header, message }
  const [selectedId, setSelectedId] = useState(null);
  const selectedIdRef = useRef(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const history = useHistory();

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const parseJsonBody = useCallback(async (resp) => {
    try {
      const text = await resp.text();
      if (!text) return null;
      return JSON.parse(text);
    } catch (err) {
      throw new Error('Invalid response from server');
    }
  }, []);

  const fetchSteps = useCallback(async ({ signal, silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const resp = await apiFetch('/api/steps', { signal });
      if (!resp.ok) {
        const payload = await parseJsonBody(resp).catch(() => null);
        const message = payload?.error || payload?.message || `HTTP ${resp.status}`;
        throw new Error(message);
      }
      const payload = await parseJsonBody(resp);
      if (signal?.aborted) return;
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.rows)
            ? payload.rows
            : [];
      setSteps(list);
      setGroups(Array.isArray(payload?.groups) ? payload.groups : []);
      setBanner(prev => (prev?.type === 'error' ? null : prev));
      const activeSelectedId = selectedIdRef.current;
      if (activeSelectedId && !list.some(item => item?.id === activeSelectedId)) {
        setSelectedId(null);
        setSelectedBlockStep?.(null);
      }
    } catch (e) {
      if (signal?.aborted) return;
      console.error('Error fetching steps:', e);
      setSteps([]);
      setBanner({ type: 'error', header: 'Failed to load intake steps', message: e.message || 'Unable to fetch steps.' });
    } finally {
      if (!silent && !signal?.aborted) setLoading(false);
    }
  }, [parseJsonBody, setSelectedBlockStep]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSteps({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchSteps]);

  useEffect(() => {
    const unlisten = history.listen((location) => {
      if (location.pathname === '/manage-components') {
        fetchSteps();
      }
    });
    return unlisten;
  }, [history, fetchSteps]);

  const handleModify = useCallback((step) => {
    history.push(`/modify-component/${step.id}`);
  }, [history]);

  const openDeleteModal = useCallback((step) => {
    setPendingDelete(step);
    setShowDeleteModal(true);
  }, []);

  const openGroupsModal = useCallback(() => {
    setEditableGroups((groups || []).map(group => ({
      localId: group.id || `group-${Math.random().toString(36).slice(2)}`,
      id: group.id || '',
      label: group.label || '',
      description: group.description || '',
      status: group.status || 'active'
    })));
    setShowGroupsModal(true);
  }, [groups]);

  const addEditableGroup = useCallback(() => {
    setEditableGroups(prev => [
      ...prev,
      { localId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`, id: '', label: '', description: '', status: 'active' }
    ]);
  }, []);

  const updateEditableGroup = useCallback((localId, patch) => {
    setEditableGroups(prev => prev.map((group, groupIndex) => (
      group.localId === localId || (!group.localId && groupIndex === localId) ? { ...group, ...patch } : group
    )));
  }, []);

  const saveGroups = useCallback(async () => {
    setSavingGroups(true);
    try {
      const response = await apiFetch('/api/step-groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groups: editableGroups.map(({ localId, ...group }) => group)
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
      }
      setGroups(Array.isArray(payload?.groups) ? payload.groups : []);
      setShowGroupsModal(false);
      setBanner({ type: 'success', header: 'Groups saved', message: 'Intake step groups were updated.' });
      fetchSteps({ silent: true });
    } catch (error) {
      setBanner({ type: 'error', header: 'Unable to save groups', message: error?.message || 'Group changes were not saved.' });
    } finally {
      setSavingGroups(false);
    }
  }, [editableGroups, fetchSteps]);

  const confirmDelete = async () => {
    const step = pendingDelete;
    if (!step) return;
    setIsDeleting(true);
    try {
      const resp = await apiFetch(`/api/steps/${step.id}`, { method: 'DELETE' });
      const payload = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setSteps(prev => prev.filter(item => item.id !== step.id));
        if (selectedId === step.id) {
          setSelectedId(null);
          setSelectedBlockStep?.(null);
        }
        setBanner({ type: 'success', header: 'Step deleted', message: `"${step.name}" was removed.` });
        fetchSteps({ silent: true });
      } else {
        const details = [];
        if (Array.isArray(payload?.workflows) && payload.workflows.length) {
          details.push(`Referenced by: ${payload.workflows.slice(0, 5).join(', ')}`);
        }
        const message = payload?.error || payload?.message || `HTTP ${resp.status}`;
        setBanner({ type: 'error', header: 'Delete failed', message: [message, ...details].filter(Boolean).join('. ') });
      }
    } catch (error) {
      console.error('Error deleting step:', error);
      setBanner({ type: 'error', header: 'Delete failed', message: 'An error occurred while deleting the step.' });
    } finally {
      setShowDeleteModal(false);
      setPendingDelete(null);
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setPendingDelete(null);
  };

  const handleSelect = useCallback((step) => {
    if (!step) return;
    setSelectedId(step.id);
    setSelectedBlockStep?.(step);
  }, [setSelectedBlockStep]);

  const handleCreateNew = () => {
    history.push('/modify-component/new');
  };

  const compareSteps = useCallback((columnId, left, right) => {
    if (columnId === 'updated_at') {
      const leftTime = left?.updated_at ? new Date(left.updated_at).getTime() : 0;
      const rightTime = right?.updated_at ? new Date(right.updated_at).getTime() : 0;
      return leftTime - rightTime;
    }
    if (columnId === 'id') {
      const leftNumber = Number(left?.id);
      const rightNumber = Number(right?.id);
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber;
      }
    }
    if (columnId === 'groupLabel') {
      const leftValue = String(left?.groupLabel || 'Ungrouped').toLowerCase();
      const rightValue = String(right?.groupLabel || 'Ungrouped').toLowerCase();
      return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
    }
    const leftValue = String(left?.[columnId] ?? '').toLowerCase();
    const rightValue = String(right?.[columnId] ?? '').toLowerCase();
    return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
  }, []);

  const groupOptions = useMemo(() => [
    { label: 'All groups', value: '__all__' },
    { label: 'Ungrouped', value: '__ungrouped__' },
    ...groups
      .filter(group => (group.status || 'active') === 'active')
      .map(group => ({ label: group.label || group.id, value: group.id }))
  ], [groups]);

  const filteredSteps = useMemo(() => {
    const search = filteringText.trim().toLowerCase();
    const selectedGroup = groupFilter?.value || '__all__';
    return steps.filter(item => {
      const itemGroups = Array.isArray(item?.groups) ? item.groups : [];
      if (selectedGroup === '__ungrouped__' && itemGroups.length > 0) return false;
      if (selectedGroup !== '__all__' && selectedGroup !== '__ungrouped__' && !itemGroups.includes(selectedGroup)) return false;
      if (!search) return true;
      const name = (item?.name || '').toString().toLowerCase();
      const id = (item?.id || '').toString().toLowerCase();
      const updated = (item?.updated_at || '').toString().toLowerCase();
      const groupLabel = (Array.isArray(item?.groupLabels) ? item.groupLabels.join(' ') : item?.groupLabel || '').toString().toLowerCase();
      const workflows = (item?.workflow_names || '').toString().toLowerCase();
      return name.includes(search) || id.includes(search) || updated.includes(search) || groupLabel.includes(search) || workflows.includes(search);
    });
  }, [steps, filteringText, groupFilter]);

  const sortedSteps = useMemo(() => {
    const next = [...filteredSteps];
    if (!sortingState.columnId) return next;
    next.sort((left, right) => {
      const result = compareSteps(sortingState.columnId, left, right);
      return sortingState.isDescending ? -result : result;
    });
    return next;
  }, [compareSteps, filteredSteps, sortingState]);

  const columnDefinitions = useMemo(() => [
    {
      id: 'name',
      header: 'Intake Step',
      cell: item => (
        <Link onFollow={(event) => { event.preventDefault(); handleSelect(item); }}>
          {item?.name || 'Untitled'}
        </Link>
      ),
      sortingField: 'name',
      sortingComparator: (left, right) => compareSteps('name', left, right),
      minWidth: 220,
      isRowHeader: true
    },
    {
      id: 'id',
      header: 'ID',
      cell: item => item?.id ?? 'Not recorded',
      sortingField: 'id',
      sortingComparator: (left, right) => compareSteps('id', left, right),
      minWidth: 90
    },
    {
      id: 'groupLabel',
      header: 'Group',
      cell: item => {
        const labels = Array.isArray(item?.groupLabels) && item.groupLabels.length ? item.groupLabels : [item?.groupLabel || 'Ungrouped'];
        return (
          <SpaceBetween direction="horizontal" size="xxs">
            {labels.map(label => (
              <Badge key={`${item?.id}-${label}`} color={label === 'Ungrouped' ? 'grey' : 'blue'}>{label}</Badge>
            ))}
          </SpaceBetween>
        );
      },
      sortingField: 'groupLabel',
      sortingComparator: (left, right) => compareSteps('groupLabel', left, right),
      minWidth: 180
    },
    {
      id: 'workflow_names',
      header: 'Used by',
      cell: item => item?.workflow_names || 'Not used',
      minWidth: 220
    },
    {
      id: 'updated_at',
      header: 'Updated',
      cell: item => item?.updated_at ? new Date(item.updated_at).toLocaleString() : 'Not recorded',
      sortingField: 'updated_at',
      sortingComparator: (left, right) => compareSteps('updated_at', left, right),
      minWidth: 180
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: item => (
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="inline-link" onClick={() => handleModify(item)} ariaLabel={`Modify ${item?.name || `intake step #${item?.id ?? ''}`}`}>Modify</Button>
          <Button variant="inline-link" onClick={() => openDeleteModal(item)} ariaLabel={`Delete ${item?.name || `intake step #${item?.id ?? ''}`}`}>Delete</Button>
        </SpaceBetween>
      ),
      minWidth: 150
    }
  ], [compareSteps, handleModify, handleSelect, openDeleteModal]);

  const activeSortingColumn = useMemo(
    () => columnDefinitions.find(column => column.id === sortingState.columnId),
    [columnDefinitions, sortingState.columnId]
  );

  const selectedItems = useMemo(() => {
    if (!selectedId) return [];
    const match = steps.find(item => item?.id === selectedId);
    return match ? [match] : [];
  }, [steps, selectedId]);

  return (
    <BoardItem
      header={
        <Header
          description="Manage and modify intake steps used in workflows."
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel && toggleHelpPanel(<IntakeStepLibraryWidgetHelp />, 'Intake Step Library', IntakeStepLibraryWidgetHelp.aiContext)}
            >
              Info
            </Link>
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button iconName="refresh" onClick={() => fetchSteps()} ariaLabel="Refresh intake steps" loading={loading}>
                Refresh
              </Button>
              <Button onClick={openGroupsModal}>
                Manage groups
              </Button>
              <Button
                iconName="add-plus"
                iconAlign="right"
                onClick={handleCreateNew}
                ariaLabel="Create a new intake step"
              >
                Create New Step
              </Button>
            </SpaceBetween>
          }
        >
          Intake Step Library
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions?.removeItem?.()}
        />
      }
    >
      <Box>
        {banner && (
          <Alert
            type={banner.type}
            dismissible
            onDismiss={() => setBanner(null)}
            header={banner.header || (banner.type === 'error' ? 'Action failed' : 'Notice')}
          >
            {banner.message}
          </Alert>
        )}
        <Table
          variant="embedded"
          selectionType="single"
          trackBy="id"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => {
            const item = detail.selectedItems?.[0];
            if (item) handleSelect(item);
          }}
          renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
            `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
          }
          columnDefinitions={columnDefinitions}
          items={sortedSteps}
          resizableColumns
          stickyHeader
          sortingColumn={activeSortingColumn}
          sortingDescending={sortingState.isDescending}
          onSortingChange={({ detail }) => {
            const columnId = detail?.sortingColumn?.id;
            if (columnId) {
              setSortingState({ columnId, isDescending: detail.isDescending });
            }
          }}
          loading={loading}
          loadingText="Loading resources"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              <SpaceBetween size="m">
                <b>No resources</b>
                <Button onClick={handleCreateNew}>Create step</Button>
              </SpaceBetween>
            </Box>
          }
          filter={
            <SpaceBetween direction="horizontal" size="s">
              <TextFilter
                filteringPlaceholder="Find intake step"
                filteringText={filteringText}
                filteringAriaLabel="Filter intake steps"
                onChange={({ detail }) => setFilteringText(detail.filteringText)}
                countText={filteredSteps.length === 1 ? '1 match' : `${filteredSteps.length} matches`}
              />
              <FormField label="Group">
                <Select
                  selectedOption={groupFilter}
                  onChange={({ detail }) => setGroupFilter(detail.selectedOption)}
                  options={groupOptions}
                  selectedAriaLabel="Selected"
                />
              </FormField>
            </SpaceBetween>
          }
        />

        <Modal
          visible={showDeleteModal}
          onDismiss={cancelDelete}
          closeAriaLabel="Close modal"
          header="Delete intake step?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={cancelDelete}>Cancel</Button>
              <Button variant="primary" onClick={confirmDelete} disabled={isDeleting} loading={isDeleting}>Delete</Button>
            </SpaceBetween>
          }
        >
          {pendingDelete ? (
            <Box>
              Are you sure you want to delete "{pendingDelete.name}"? This cannot be undone.
            </Box>
          ) : null}
        </Modal>

        <Modal
          visible={showGroupsModal}
          onDismiss={() => setShowGroupsModal(false)}
          closeAriaLabel="Close group manager"
          size="large"
          header="Manage intake step groups"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setShowGroupsModal(false)} disabled={savingGroups}>Cancel</Button>
              <Button variant="primary" onClick={saveGroups} loading={savingGroups}>Save groups</Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <Alert type="info">
              Groups organize the intake step library only. Workflow membership still controls which steps are used at runtime.
            </Alert>
            <Table
              variant="embedded"
              trackBy="localId"
              items={editableGroups}
              columnDefinitions={[
                {
                  id: 'label',
                  header: 'Label',
                  cell: item => (
                    <Input
                      value={item.label || ''}
                      onChange={({ detail }) => updateEditableGroup(item.localId, { label: detail.value })}
                      placeholder="Group label"
                      spellcheck={false}
                    />
                  ),
                  minWidth: 180
                },
                {
                  id: 'id',
                  header: 'ID',
                  cell: item => (
                    <Input
                      value={item.id || ''}
                      onChange={({ detail }) => updateEditableGroup(item.localId, { id: detail.value })}
                      placeholder="auto-from-label"
                      spellcheck={false}
                    />
                  ),
                  minWidth: 160
                },
                {
                  id: 'description',
                  header: 'Description',
                  cell: item => (
                    <Textarea
                      value={item.description || ''}
                      onChange={({ detail }) => updateEditableGroup(item.localId, { description: detail.value })}
                      rows={2}
                      spellcheck={true}
                    />
                  ),
                  minWidth: 260
                },
                {
                  id: 'status',
                  header: 'Status',
                  cell: item => (
                    <Select
                      selectedOption={{ value: item.status || 'active', label: item.status === 'archived' ? 'Archived' : 'Active' }}
                      onChange={({ detail }) => updateEditableGroup(item.localId, { status: detail.selectedOption.value })}
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'archived', label: 'Archived' }
                      ]}
                    />
                  ),
                  minWidth: 150
                }
              ]}
              empty={<Box>No groups configured.</Box>}
            />
            <Button iconName="add-plus" onClick={addEditableGroup}>Add group</Button>
          </SpaceBetween>
        </Modal>
      </Box>
    </BoardItem>
  );
};

export default IntakeStepTableWidget;
