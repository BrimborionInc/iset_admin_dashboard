import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Header, Button, SpaceBetween, Table, TextFilter, ButtonDropdown, Link, Modal, Alert } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { useHistory } from 'react-router-dom';
import IntakeStepLibraryWidgetHelp from '../helpPanelContents/intakeStepLibraryWidgetHelp';
import { apiFetch } from '../auth/apiClient'; // use authenticated fetch wrapper

const IntakeStepTableWidget = ({ actions, setSelectedBlockStep, toggleHelpPanel }) => {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteringText, setFilteringText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [banner, setBanner] = useState(null); // { type: 'info'|'error'|'success', header, message }
  const [selectedId, setSelectedId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const history = useHistory();

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
      setBanner(prev => (prev?.type === 'error' ? null : prev));
      if (selectedId && !list.some(item => item?.id === selectedId)) {
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
  }, [parseJsonBody, selectedId, setSelectedBlockStep]);

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

  const handleModify = (step) => {
    history.push(`/modify-component/${step.id}`);
  };

  const openDeleteModal = (step) => {
    setPendingDelete(step);
    setShowDeleteModal(true);
  };

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

  const handleSelect = (step) => {
    if (!step) return;
    setSelectedId(step.id);
    setSelectedBlockStep?.(step);
  };

  const handleCreateNew = () => {
    history.push('/modify-component/new');
  };

  const filteredSteps = useMemo(() => {
    const search = filteringText.trim().toLowerCase();
    if (!search) return steps;
    return steps.filter(item => {
      const name = (item?.name || '').toString().toLowerCase();
      return name.includes(search);
    });
  }, [steps, filteringText]);

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
              <Button
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
          onItemClick={() => actions.removeItem()}
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
          columnDefinitions={[
            {
              id: 'name',
              header: 'Intake Step',
              cell: item => (
                <Link onFollow={(event) => { event.preventDefault(); handleSelect(item); }}>
                  {item?.name || 'Untitled'}
                </Link>
              ),
              sortingField: 'name',
              isRowHeader: true
            },
            {
              id: 'updated_at',
              header: 'Updated',
              cell: item => item?.updated_at ? new Date(item.updated_at).toLocaleString() : '—',
              sortingField: 'updated_at'
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="inline-link" onClick={() => handleModify(item)} ariaLabel={`Modify ${item?.name || `intake step #${item?.id ?? ''}`}`}>Modify</Button>
                  <Button variant="inline-link" onClick={() => openDeleteModal(item)} ariaLabel={`Delete ${item?.name || `intake step #${item?.id ?? ''}`}`}>Delete</Button>
                </SpaceBetween>
              )
            }
          ]}
          items={filteredSteps}
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
            <TextFilter
              filteringPlaceholder="Find intake step"
              filteringText={filteringText}
              filteringAriaLabel="Filter intake steps"
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              countText={filteredSteps.length === 1 ? '1 match' : `${filteredSteps.length} matches`}
            />
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
      </Box>
    </BoardItem>
  );
};

export default IntakeStepTableWidget;
