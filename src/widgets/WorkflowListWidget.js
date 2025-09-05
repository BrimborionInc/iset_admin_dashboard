import React, { useEffect, useMemo, useState } from 'react';
import { Box, Header, ButtonDropdown, Link, Table, Button, TextFilter, SpaceBetween, Spinner, Modal, Input, Alert } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { apiFetch } from '../auth/apiClient';

const API_BASE = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

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

const formatDate = (dt) => dt ? new Date(dt).toISOString().slice(0, 10) : '';

const WorkflowListWidget = ({ actions, onSelectWorkflow, toggleHelpPanel }) => {
  const [filteringText, setFilteringText] = useState('');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null); // workflow row object
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [alert, setAlert] = useState(null); // { type, text }

  const load = async () => {
    try {
      setLoading(true);
      const resp = await apiFetch('/api/workflows');
      const data = await resp.json().catch(() => []);
      const rows = (data || []).map(r => ({
        id: r.id,
        name: r.name,
        lastModified: formatDate(r.updated_at || r.created_at),
        status: r.status
      }));
      setItems(rows);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load();
    })();
    return () => { mounted = false; };
  }, []);
  const onSelectWorkflowInternal = async (item) => {
    try {
      const resp = await apiFetch(`/api/workflows/${item.id}`);
      if (resp.ok) {
        const data = await resp.json();
        onSelectWorkflow && onSelectWorkflow(data);
        return;
      }
    } catch {}
    onSelectWorkflow && onSelectWorkflow(item);
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
      setAlert({ type: 'success', text: `Deleted workflow \"${deleteTarget.name}\".` });
      setDeleteTarget(null);
      setDeleteConfirm('');
      await load();
    } catch (e) {
      setDeleteError('Delete failed. Please retry or contact support.');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    if (deleting) return; // block close while in-flight
    setDeleteTarget(null);
    setDeleteConfirm('');
    setDeleteError(null);
  };

  const filtered = useMemo(() => {
    const txt = (filteringText || '').toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(txt));
  }, [items, filteringText]);

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
