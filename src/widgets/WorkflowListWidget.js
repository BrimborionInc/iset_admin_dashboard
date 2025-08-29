import React, { useEffect, useMemo, useState } from 'react';
import { Box, Header, ButtonDropdown, Link, Table, Button, TextFilter, SpaceBetween, Spinner } from '@cloudscape-design/components';
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

const WorkflowListWidget = ({ actions, onSelectWorkflow }) => {
  const [filteringText, setFilteringText] = useState('');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

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

  const onDelete = async (item) => {
    if (!window.confirm(`Delete workflow "${item.name}"? This cannot be undone.`)) return;
    try {
      const resp = await apiFetch(`/api/workflows/${item.id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('Failed');
      await load();
    } catch (e) {
      alert('Failed to delete workflow');
    }
  };

  const filtered = useMemo(() => {
    const txt = (filteringText || '').toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(txt));
  }, [items, filteringText]);

  return (
    <BoardItem
      header={
        <Header
          actions={
            <Button iconAlign="right" onClick={() => (window.location.href = '/modify-workflow')}>
              Create New
            </Button>
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
      columnDefinitions={getColumnDefinitions(onSelectWorkflowInternal, onModify, onDelete)}
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
      </Box>
    </BoardItem>
  );
};

export default WorkflowListWidget;
