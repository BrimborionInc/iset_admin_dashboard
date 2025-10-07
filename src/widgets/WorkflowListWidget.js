import React, { useCallback, useMemo, useState } from 'react';
import { Box, Header, ButtonDropdown, Link, Table, Button, TextFilter, SpaceBetween, Modal, Input, Alert } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { apiFetch } from '../auth/apiClient';
import useWidgetDataLoader from '../hooks/useWidgetDataLoader';

const getColumnDefinitions = (onSelectWorkflow, onModify, onDelete) => [
  {
    id: 'id',
    header: 'ID',
    cell: item => item.id,
    sortingField: 'id',
    isRowHeader: true
  },
  {
    id: 'name',
    header: 'Name',
    cell: item => (
      <Button variant="inline-link" onClick={() => onSelectWorkflow(item)}>{item.name}</Button>
    ),
    sortingField: 'name'
  },
  {
    id: 'lastModified',
    header: 'Last Modified',
    cell: item => item.lastModified,
    sortingField: 'lastModified'
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: item => (
      <SpaceBetween direction="horizontal" size="xs">
        <Button variant="inline-link" onClick={() => onModify(item)}>Modify</Button>
        <Button variant="inline-link" onClick={() => onDelete(item)}>Delete</Button>
      </SpaceBetween>
    )
  }
];

const formatDate = (dt) => (dt ? new Date(dt).toISOString().slice(0, 10) : '');

const WorkflowListWidget = ({ actions, onSelectWorkflow, toggleHelpPanel }) => {
  const [filteringText, setFilteringText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [alert, setAlert] = useState(null);

  const loadWorkflows = useCallback(async ({ signal }) => {
    const resp = await apiFetch('/api/workflows', { signal });
    const payload = await resp.json().catch(() => []);
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    return rows.map((r, index) => {
      const rawName = typeof r.name === 'string' ? r.name : (typeof r.title === 'string' ? r.title : '');
      const safeName = rawName && rawName.trim() ? rawName.trim() : `Untitled workflow ${r.id ?? index + 1}`;
      return {
        id: r.id ?? `wf-${index}`,
        name: safeName,
        lastModified: formatDate(r.updated_at || r.created_at),
        status: r.status || 'unknown'
      };
    });
  }, []);

  const {
    data: items = [],
    error: loadError,
    isLoading,
    isRefreshing,
    refresh
  } = useWidgetDataLoader(loadWorkflows, { initialData: [], dependencies: [] });

  const onSelectWorkflowInternal = async (item) => {
    try {
      const resp = await apiFetch(`/api/workflows/${item.id}`);
      if (resp.ok) {
        const data = await resp.json();
        if (onSelectWorkflow) onSelectWorkflow(data);
        return;
      }
    } catch (_) {
      // fall through to best-effort fallback below
    }
    if (onSelectWorkflow) onSelectWorkflow(item);
  };

  const onModify = (item) => {
    window.location.href = `/modify-workflow?id=${encodeURIComponent(item.id)}`;
  };

  const openDelete = (item) => {
    setDeleteTarget(item);
    setDeleteConfirm('');
    setDeleteError(null);
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const resp = await apiFetch(`/api/workflows/${deleteTarget.id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setAlert({ type: 'success', text: `Deleted workflow "${deleteTarget.name}".` });
      setDeleteTarget(null);
      setDeleteConfirm('');
      await refresh();
    } catch (e) {
      setDeleteError('Delete failed. Please retry or contact support.');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteConfirm('');
    setDeleteError(null);
  };

  const filtered = useMemo(() => {
    const txt = (filteringText || '').toLowerCase();
    return (items || []).filter(i => i.name.toLowerCase().includes(txt));
  }, [items, filteringText]);

  const loading = isLoading || isRefreshing;
  const effectiveError = loadError ? (loadError.message || String(loadError)) : null;

  return (
    <BoardItem
      header={
        <Header
          info={<Link variant="info" onClick={() => toggleHelpPanel && toggleHelpPanel()}>Info</Link>}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button iconAlign="right" onClick={() => (window.location.href = '/modify-workflow')}>
                Create New
              </Button>
            </SpaceBetween>
          }
        >
          Workflow Library
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
          onItemClick={() => actions && actions.removeItem && actions.removeItem()}
        />
      }
    >
      <Box>
        <Table
          variant="embedded"
          stickyHeader
          renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
            `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
          }
          columnDefinitions={getColumnDefinitions(onSelectWorkflowInternal, onModify, openDelete)}
          items={filtered}
          loading={loading}
          loadingText="Loading resources"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              <SpaceBetween size="m">
                <b>No workflows</b>
                <Button onClick={() => window.location.href = '/modify-workflow'}>Create workflow</Button>
              </SpaceBetween>
            </Box>
          }
          filter={
            <TextFilter
              filteringPlaceholder="Find workflow"
              filteringText={filteringText}
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              countText={`${filtered.length} matches`}
            />
          }
        />
        {alert && (
          <Box margin={{ top: 's' }}>
            <Alert dismissible onDismiss={() => setAlert(null)} type={alert.type}>{alert.text}</Alert>
          </Box>
        )}
        {effectiveError && (
          <Box margin={{ top: 's' }}>
            <Alert
              type="error"
              action={<Button onClick={() => refresh()} iconName="refresh">Retry</Button>}
            >
              Failed to load workflows. {effectiveError}
            </Alert>
          </Box>
        )}
      </Box>

      {deleteTarget && (
        <Modal
          visible={true}
          onDismiss={cancelDelete}
          header={`Delete Workflow: ${deleteTarget.name}`}
          closeAriaLabel="Close delete workflow dialog"
          size="medium"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={cancelDelete} disabled={deleting}>Cancel</Button>
              <Button
                variant="primary"
                disabled={deleteConfirm.trim() !== 'delete' || deleting}
                loading={deleting}
                onClick={performDelete}
              >
                Delete
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            <Box>
              This will permanently remove the workflow <strong>{deleteTarget.name}</strong>{' '}
              (ID: {deleteTarget.id}). This action cannot be undone.
            </Box>
            <Box fontSize="body-s" color="text-status-inactive">
              If this workflow is currently active in any environment, deletion may affect historical
              audit or review processes. Consider setting status to <em>inactive</em> instead if you
              only want to retire it.
            </Box>
            <Box>
              Type <code>delete</code> to confirm:
              <Input
                autoFocus
                placeholder="delete"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.detail.value)}
                disabled={deleting}
              />
            </Box>
            {deleteError && <Alert type="error">{deleteError}</Alert>}
          </SpaceBetween>
        </Modal>
      )}
    </BoardItem>
  );
};

export default WorkflowListWidget;
