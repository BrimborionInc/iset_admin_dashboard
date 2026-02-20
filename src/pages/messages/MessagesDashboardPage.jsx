import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Link,
  SpaceBetween,
  Table,
  Tabs,
  TextFilter,
} from '@cloudscape-design/components';
import { apiFetch } from '../../auth/apiClient';
import { useMessaging } from './MessagingContext';

const formatDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const MessagesDashboardPage = () => {
  const { pinnedMessage, pinMessage, unpinMessage, startNewMessage } = useMessaging();

  const [filteringText, setFilteringText] = useState('');
  const [activeTabId, setActiveTabId] = useState('inbox');
  const [sortColumnId, setSortColumnId] = useState('receivedAt');
  const [sortDescending, setSortDescending] = useState(true);

  const [messagesByFolder, setMessagesByFolder] = useState({
    inbox: [],
    sent: [],
    deleted: [],
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const folders = ['inbox', 'sent', 'deleted'];
      const results = await Promise.all(
        folders.map(async (folder) => {
          const resp = await apiFetch(`/api/me/staff-messages?folder=${folder}`);
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || `Failed to load ${folder} messages`);
          }
          const json = await resp.json();
          return [folder, json.items || []];
        })
      );
      const next = { inbox: [], sent: [], deleted: [] };
      results.forEach(([folder, items]) => { next[folder] = items; });
      setMessagesByFolder(next);
    } catch (err) {
      setLoadError(err?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const onRefresh = () => fetchMessages();
    window.addEventListener('staff-messages:refresh', onRefresh);
    return () => window.removeEventListener('staff-messages:refresh', onRefresh);
  }, [fetchMessages]);

  const emitRefreshEvent = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent('staff-messages:refresh'));
    } catch {}
  }, []);

  const softDeleteMessage = useCallback((message) => {
    if (!message) return;
    apiFetch(`/api/me/staff-messages/${message.id}/delete`, { method: 'PUT' })
      .then(() => emitRefreshEvent())
      .catch((err) => console.error('Delete failed', err));
  }, [emitRefreshEvent]);

  const restoreMessage = useCallback((message) => {
    if (!message) return;
    apiFetch(`/api/me/staff-messages/${message.id}/restore`, { method: 'PUT' })
      .then(() => emitRefreshEvent())
      .catch((err) => console.error('Restore failed', err));
  }, [emitRefreshEvent]);

  const permanentlyDeleteMessage = useCallback((message) => {
    if (!message) return;
    apiFetch(`/api/me/staff-messages/${message.id}`, { method: 'DELETE' })
      .then(() => {
        if (pinnedMessage?.id && pinnedMessage.id === message.id) {
          unpinMessage();
        }
      })
      .then(() => emitRefreshEvent())
      .catch((err) => console.error('Purge failed', err));
  }, [emitRefreshEvent, pinnedMessage?.id, unpinMessage]);

  const markAsRead = useCallback((message) => {
    if (!message?.id || !message.unread) return;
    apiFetch(`/api/me/staff-messages/${message.id}/read`, { method: 'PATCH' })
      .then(() => emitRefreshEvent())
      .catch(() => {});
    setMessagesByFolder(prev => {
      const next = { ...prev };
      ['inbox', 'sent', 'deleted'].forEach(folder => {
        next[folder] = (next[folder] || []).map(item => (
          item.id === message.id ? { ...item, unread: false, readAt: new Date().toISOString() } : item
        ));
      });
      return next;
    });
  }, [emitRefreshEvent]);

  const markAsUnread = useCallback((message) => {
    if (!message?.id || message.unread) return;
    apiFetch(`/api/me/staff-messages/${message.id}/unread`, { method: 'PATCH' })
      .then(() => emitRefreshEvent())
      .catch(() => {});
    setMessagesByFolder(prev => {
      const next = { ...prev };
      ['inbox', 'sent', 'deleted'].forEach(folder => {
        next[folder] = (next[folder] || []).map(item => (
          item.id === message.id ? { ...item, unread: true, readAt: null } : item
        ));
      });
      return next;
    });
  }, [emitRefreshEvent]);

  const resolveCounterparty = useCallback((item, mode) => {
    if (!item) return { profile: null, extra: 0 };
    const recipients = Array.isArray(item.recipients) ? item.recipients : [];
    const sender = item.sender || null;
    const folderHint = mode === 'deleted' ? (item.deletedFrom || item.deleted_from) : mode;

    if (folderHint === 'sent') {
      const primary = recipients[0] || sender || null;
      return { profile: primary, extra: Math.max(0, recipients.length - 1) };
    }

    const primary = sender || recipients[0] || null;
    return { profile: primary, extra: 0 };
  }, []);

  const rows = useMemo(() => {
    const source = messagesByFolder[activeTabId] || [];
    const lower = filteringText.trim().toLowerCase();
    if (!lower) return source;
    return source.filter(item => {
      const haystack = [
        item.subject,
        item.preview,
        item.sender?.displayName,
        item.sender?.primaryRole,
        ...(Array.isArray(item.recipients) ? item.recipients.map(r => `${r.displayName} ${r.primaryRole}`) : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(lower);
    });
  }, [activeTabId, filteringText, messagesByFolder]);

  const comparatorById = useMemo(() => ({
    receivedAt: (a, b) => {
      const dA = new Date(a.receivedAt || a.created_at || 0).getTime() || 0;
      const dB = new Date(b.receivedAt || b.created_at || 0).getTime() || 0;
      return dA - dB;
    },
    fromTo: (a, b) => {
      const left = resolveCounterparty(a, activeTabId).profile;
      const right = resolveCounterparty(b, activeTabId).profile;
      const nameA = (left?.displayName || left?.email || '').toLowerCase();
      const nameB = (right?.displayName || right?.email || '').toLowerCase();
      if (nameA === nameB) return 0;
      return nameA < nameB ? -1 : 1;
    },
    subject: (a, b) => {
      const sA = (a.subject || '').toLowerCase();
      const sB = (b.subject || '').toLowerCase();
      if (sA === sB) return 0;
      return sA < sB ? -1 : 1;
    },
  }), [activeTabId, resolveCounterparty]);

  const sortedRows = useMemo(() => {
    if (!sortColumnId || !comparatorById[sortColumnId]) return rows;
    const sorted = [...rows].sort((a, b) => comparatorById[sortColumnId](a, b));
    if (sortDescending) sorted.reverse();
    return sorted;
  }, [comparatorById, rows, sortColumnId, sortDescending]);

  const tabCounts = useMemo(() => ({
    inbox: messagesByFolder.inbox?.length || 0,
    sent: messagesByFolder.sent?.length || 0,
    deleted: messagesByFolder.deleted?.length || 0,
  }), [messagesByFolder]);

  const renderPersonCell = useCallback((profile, extraCount = 0) => {
    if (!profile) return <Box>—</Box>;
    const name = profile.displayName || profile.email || profile.display_name || `Staff #${profile.staffProfileId || profile.staff_profile_id || profile.id}`;
    const role = profile.primaryRole || profile.primary_role || '—';
    return (
      <SpaceBetween size="xxs">
        <SpaceBetween size="xxs" direction="horizontal" alignItems="center">
          <Box fontWeight="bold">{name}</Box>
          {extraCount > 0 && <Badge color="blue">+{extraCount}</Badge>}
        </SpaceBetween>
        <Box fontSize="body-s" color="text-status-inactive">{role}</Box>
      </SpaceBetween>
    );
  }, []);

  const columnDefinitions = useMemo(() => ([
    {
      id: 'receivedAt',
      header: 'Date/Time',
      sortingComparator: comparatorById.receivedAt,
      cell: item => (
        <span style={{ fontWeight: item.unread ? 'bold' : 'normal' }}>
          {formatDateTime(item.receivedAt)}
        </span>
      ),
      minWidth: 160,
    },
    {
      id: 'fromTo',
      header: activeTabId === 'sent' ? 'To' : (activeTabId === 'deleted' ? 'From/To' : 'From'),
      sortingComparator: comparatorById.fromTo,
      cell: item => {
        const { profile, extra } = resolveCounterparty(item, activeTabId);
        return renderPersonCell(profile, extra);
      },
      minWidth: 160,
    },
    {
      id: 'subject',
      header: 'Subject',
      sortingComparator: comparatorById.subject,
      cell: item => {
        const isPinned = pinnedMessage?.id === item.id;
        return (
          <SpaceBetween size="xs" direction="horizontal">
            <Link
              href="#"
              onFollow={event => {
                event.preventDefault();
                if (isPinned) {
                  unpinMessage();
                } else {
                  pinMessage(item);
                  markAsRead(item);
                }
              }}
            >
              <span style={{ fontWeight: item.unread ? 'bold' : 'normal' }}>
                {item.subject || '(No subject)'}
              </span>
            </Link>
            {isPinned && <Badge color="blue">Pinned</Badge>}
          </SpaceBetween>
        );
      },
      minWidth: 260,
    },
    {
      id: 'preview',
      header: 'Preview',
      cell: item => item.preview || '—',
      minWidth: 320,
    },
    {
      id: 'actions',
      header: '',
      minWidth: 180,
      width: 180,
      cell: item => (
        <SpaceBetween size="xs" direction="horizontal">
          {activeTabId === 'deleted' ? (
            <>
              <Button
                iconName="undo"
                variant="inline-icon"
                ariaLabel="Restore message"
                onClick={() => restoreMessage(item)}
              />
              <Button
                iconName="remove"
                variant="inline-icon"
                ariaLabel="Delete message permanently"
                onClick={() => permanentlyDeleteMessage(item)}
              />
            </>
          ) : (
            <>
              {activeTabId === 'inbox' && !item.unread && (
                <Button
                  variant="inline-link"
                  onClick={() => markAsUnread(item)}
                >
                  Mark unread
                </Button>
              )}
              <Button
                iconName="remove"
                variant="inline-icon"
                ariaLabel="Move message to deleted"
                onClick={() => softDeleteMessage(item)}
              />
            </>
          )}
        </SpaceBetween>
      ),
    },
  ]), [activeTabId, comparatorById, markAsRead, markAsUnread, permanentlyDeleteMessage, pinMessage, pinnedMessage?.id, renderPersonCell, resolveCounterparty, restoreMessage, softDeleteMessage, unpinMessage]);

  const table = (
    <Table
      items={sortedRows}
      columnDefinitions={columnDefinitions}
      loading={loading}
      variant="borderless"
      trackBy="id"
      resizableColumns
      sortingColumn={sortColumnId ? columnDefinitions.find(col => col.id === sortColumnId) : undefined}
      sortingDescending={sortDescending}
      onSortingChange={({ detail }) => {
        setSortColumnId(detail.sortingColumn.id);
        setSortDescending(detail.isDescending);
      }}
      empty={<Box textAlign="center">{loadError ? loadError : 'No messages.'}</Box>}
      filter={
        <TextFilter
          filteringText={filteringText}
          filteringPlaceholder="Search messages"
          onChange={({ detail }) => setFilteringText(detail.filteringText)}
        />
      }
    />
  );

  return (
    <SpaceBetween size="m">
      {pinnedMessage && (
        <Container>
          <Box variant="p">
            Pinned message: <strong>{pinnedMessage.subject || '(No subject)'}</strong>
          </Box>
        </Container>
      )}
      <Container>
        <Tabs
          activeTabId={activeTabId}
          onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          actions={<Button variant="primary" onClick={startNewMessage}>New message</Button>}
          tabs={[
            { id: 'inbox', label: `Inbox (${tabCounts.inbox})`, content: table },
            { id: 'sent', label: `Sent (${tabCounts.sent})`, content: table },
            { id: 'deleted', label: `Deleted Items (${tabCounts.deleted})`, content: table },
          ]}
        />
      </Container>
    </SpaceBetween>
  );
};

export default MessagesDashboardPage;
