import React, { useEffect, useState, useCallback } from 'react';
import { Box, SpaceBetween, Button, StatusIndicator, Header } from '@cloudscape-design/components';
import { Board, BoardItem } from '@cloudscape-design/board-components';
import { apiFetch } from '../auth/apiClient';

async function fetchJSON(path) {
  const res = await apiFetch(path);
  const text = await res.text();
  if (!res.ok) {
    try { const j = JSON.parse(text); throw new Error(j.error || j.message || `Failed ${res.status}`); } catch {
      const snippet = text.slice(0,120).replace(/\s+/g,' ').trim();
      throw new Error(`Failed ${res.status}: ${snippet || 'no body'}`);
    }
  }
  try { return JSON.parse(text); } catch {
    const looksHtml = /<!doctype html/i.test(text);
    throw new Error(looksHtml ? 'Received HTML instead of JSON (check API base/port or proxy config)' : 'Invalid JSON response');
  }
}

export default function ManageSecurityOptions({ updateBreadcrumbs }) {
  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
  const sec = await fetchJSON('/api/config/security');
      setSecurity(sec);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { updateBreadcrumbs && updateBreadcrumbs([{ text: 'Home', href: '/' }, { text: 'Security Dashboard', href: '#' }]); }, [updateBreadcrumbs]);

  const defaultItems = React.useMemo(() => ([
    { id: 'secrets', columnSpan: 2, rowSpan: 4, data: { type: 'secrets' } },
    { id: 'rotation', columnSpan: 2, rowSpan: 4, data: { type: 'rotation' } },
    { id: 'status', columnSpan: 2, rowSpan: 4, data: { type: 'status' } }
  ]), []);
  const [items, setItems] = useState(defaultItems);
  const resetLayout = () => setItems(defaultItems);

  function renderWidget(type) {
    switch (type) {
      case 'secrets':
        return security && (
          <SpaceBetween size="xs">
            {security.secrets.map(s => (
              <Box key={s.key}>{s.key}: {s.present ? s.masked : <i>missing</i>}</Box>
            ))}
            <Box fontSize="body-s" color="text-status-info">Values are masked. Rotation actions will appear here.</Box>
          </SpaceBetween>
        );
      case 'rotation':
        return (
          <SpaceBetween size="s">
            <Box>Integrate automated rotation workflows per secret (e.g., OpenRouter API key, DB password).</Box>
            <Button disabled>Rotate Selected (coming soon)</Button>
          </SpaceBetween>
        );
      case 'status':
        return (
          <SpaceBetween size="xs">
            <Box>Secrets Loaded: {security ? security.secrets.filter(s => s.present).length : 0}</Box>
            <Box>Total Secrets Tracked: {security ? security.secrets.length : 0}</Box>
            {security && <StatusIndicator type={security.secrets.every(s => s.present) ? 'success' : 'warning'}>{security.secrets.every(s => s.present) ? 'All Present' : 'Missing'}</StatusIndicator>}
          </SpaceBetween>
        );
      default:
        return <Box>Unknown widget</Box>;
    }
  }

  const boardI18n = {
    empty: 'No widgets',
    loading: 'Loading',
    columnAriaLabel: i => `Column ${i + 1}`,
    itemPositionAnnouncement: e => `Moved to col ${e.currentColumn + 1} row ${e.currentRow + 1}`,
    liveAnnouncementDndStarted: e => `Picked item ${e.position + 1}`,
    liveAnnouncementDndItemReordered: e => `Item moved to ${e.currentPosition + 1}`,
    liveAnnouncementDndItemResized: e => `Resized to ${e.size.width} by ${e.size.height}`,
    liveAnnouncementDndCommitted: e => `Layout saved. Final position ${e.finalPosition != null ? e.finalPosition + 1 : 'unchanged'}`,
    liveAnnouncementDndDiscarded: () => 'Move canceled',
    liveAnnouncementItemRemoved: e => `Removed item ${e.position + 1}`,
  };
  const boardItemI18n = {
    dragHandleAriaLabel: 'Drag handle',
    dragHandleAriaDescription: 'Press Space or Enter to start dragging the widget',
    dragHandleAriaDescriptionInactive: 'Drag not active',
    resizeHandleAriaLabel: 'Resize handle',
    resizeHandleAriaDescription: 'Press Space or Enter to start resizing the widget',
    resizeHandleAriaDescriptionInactive: 'Resize not active',
    removeItemAriaLabel: 'Remove widget',
    editItemAriaLabel: 'Edit widget',
    dragInactiveItemAriaLabel: 'Draggable widget',
    dragActiveItemAriaLabel: 'Dragging widget',
    resizeInactiveItemAriaLabel: 'Resizable widget',
    resizeActiveItemAriaLabel: 'Resizing widget'
  };

  return (
    <>
      {error && <Box color="text-status-error">{error}</Box>}
      <SpaceBetween size="s">
        <Board
          items={items}
          renderItem={(item, actions) => (
            <BoardItem
              header={
                <Header variant="h2">
                  {item.id === 'secrets' ? 'Secrets Inventory' : item.id === 'rotation' ? 'Key Rotation (Planned)' : 'Security Posture'}
                </Header>
              }
              i18nStrings={boardItemI18n}
              {...actions}
            >
              {renderWidget(item.data.type)}
            </BoardItem>
          )}
          onItemsChange={e => setItems(e.detail.items)}
          i18nStrings={boardI18n}
          empty={<Box>No security data.</Box>}
          ariaLabel="Security widgets board"
        />
        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={resetLayout} variant="link">Reset Layout</Button>
          <Button onClick={load}>Refresh Data</Button>
        </SpaceBetween>
      </SpaceBetween>
    </>
  );
}
