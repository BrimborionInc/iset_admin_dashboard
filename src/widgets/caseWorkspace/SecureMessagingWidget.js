import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Box,
  Button,
  ButtonDropdown,
  Link,
  Spinner,
  TextFilter,
  Table,
  Tabs,
  Modal,
  Container,
  Input,
  Textarea,
  Checkbox
} from '@cloudscape-design/components';
import { apiFetch } from '../../auth/apiClient';
import SecureMessagesHelpPanelContent from '../../helpPanelContents/secureMessagesHelpPanelContent';

const TAB_IDS = {
  inbox: 'inbox',
  sent: 'sent',
  deleted: 'deleted'
};

const formatDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const normalizeStatus = status => {
  if (!status) return '--';
  return status
    .toString()
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
};

const normalizeStatusKey = value => {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const STATUS_LABELS = {
  unread: 'Unread',
  read: 'Read',
  sent: 'Sent',
  replied: 'Replied',
  read_by_applicant: 'Read by applicant',
  applicant_replied: 'Applicant replied'
};

const isMessageDeleted = message => {
  if (!message) return false;
  if (message.deleted === 1 || message.deleted === true) return true;
  if (typeof message.deleted === 'string') {
    const lowered = message.deleted.toLowerCase();
    if (lowered === '1' || lowered === 'true') return true;
  }
  const status = typeof message.status === 'string' ? message.status.toLowerCase() : '';
  if (status === 'deleted' || status === 'archived') return true;
  if (message.deleted_at) return true;
  return false;
};

const isSentToApplicant = (message, applicantUserId) => {
  const applicantId = Number(applicantUserId);
  if (!message || !Number.isFinite(applicantId) || applicantId <= 0) return false;
  return Number(message.recipient_id) === applicantId && Number(message.sender_id) !== applicantId;
};

const getMailboxStatusKey = message => normalizeStatusKey(message?.mailbox_status || message?.status);

const getRecipientStatusKey = message => normalizeStatusKey(message?.recipient_status);

const getDisplayStatusKey = (message, applicantUserId) => {
  if (isSentToApplicant(message, applicantUserId)) {
    const recipientStatus = getRecipientStatusKey(message);
    if (recipientStatus === 'replied') return 'applicant_replied';
    if (recipientStatus === 'read') return 'read_by_applicant';
    return 'sent';
  }
  const mailboxStatus = getMailboxStatusKey(message);
  return mailboxStatus === 'unread' ? 'unread' : 'read';
};

const formatStatusLabel = statusKey => {
  const normalized = normalizeStatusKey(statusKey);
  if (!normalized) return '--';
  return STATUS_LABELS[normalized] || normalizeStatus(normalized);
};

const isUnread = message => {
  return getMailboxStatusKey(message) === 'unread';
};

const resolveList = data => (Array.isArray(data) ? data : []);

const buildAttachmentUrl = attachment => {
  const directUrl = attachment?.download_url || '';
  if (directUrl) return directUrl;
  return '#';
};

const SecureMessagingWidget = ({ actions = {}, toggleHelpPanel, caseData }) => {
  const rawCaseId = caseData?.id ?? null;
  const caseIdNum = Number(rawCaseId);
  const caseId = rawCaseId == null || rawCaseId === '' || Number.isNaN(caseIdNum) ? null : caseIdNum;
  const rawApplicantUserId = caseData?.applicant_user_id ?? null;
  const applicantUserIdNum = Number(rawApplicantUserId);
  const applicantUserId =
    rawApplicantUserId == null || rawApplicantUserId === '' || Number.isNaN(applicantUserIdNum)
      ? null
      : applicantUserIdNum;
  const messagingAvailable = Boolean(applicantUserId);
  const applicantName = caseData?.applicant_name || 'Applicant';
  const assignedToName = caseData?.assigned_to_name || '';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [activeTabId, setActiveTabId] = useState(TAB_IDS.inbox);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState(null);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeUrgent, setComposeUrgent] = useState(false);
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState(null);
  const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);
  const [showEmptyDeletedModal, setShowEmptyDeletedModal] = useState(false);
  const [emptyConfirmText, setEmptyConfirmText] = useState('');
  const [emptyDeleting, setEmptyDeleting] = useState(false);

  useEffect(() => {
    setFilteringText('');
    setActiveTabId(TAB_IDS.inbox);
  }, [caseId]);

  const loadMessages = useCallback(
    async (options = {}) => {
      if (!caseId || !messagingAvailable) {
        setMessages([]);
        setLoadError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const { silent = false } = options;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setMessages([]);
      }
      setLoadError(null);
      try {
        const response = await apiFetch(`/api/cases/${caseId}/messages`);
        if (!response.ok) throw new Error('Failed to load messages');
        const data = await response.json().catch(() => []);
        const items = Array.isArray(data?.items) ? data.items : resolveList(data);
        const scopedItems = caseId
          ? items.filter(item => {
              const messageCaseId = item?.case_id ?? item?.caseId ?? null;
              if (messageCaseId == null) return true;
              const numericMsgCaseId = Number(messageCaseId);
              return !Number.isNaN(numericMsgCaseId) && numericMsgCaseId === caseId;
            })
          : items;
        setMessages(scopedItems);

      } catch (err) {
        setLoadError(err?.message || 'Failed to load messages');
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [caseId, messagingAvailable]
  );

  useEffect(() => {
    if (!caseId || !messagingAvailable) {
      setMessages([]);
      setLoadError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    loadMessages();
  }, [caseId, loadMessages, messagingAvailable]);

  const handleInfoClick = () => {
    if (typeof toggleHelpPanel === 'function') {
      toggleHelpPanel(
        <SecureMessagesHelpPanelContent />,
        'Secure Messaging Help',
        SecureMessagesHelpPanelContent.aiContext
      );
    }
  };

  const getSenderName = useCallback(
    message => {
      if (!message) return '';
      if (applicantUserId && message.sender_id === applicantUserId) {
        return message.sender_name || applicantName;
      }
      return message.sender_name || 'Staff';
    },
    [applicantUserId, applicantName]
  );

  const getRecipientName = useCallback(
    message => {
      if (!message) return '';
      if (applicantUserId && message.recipient_id === applicantUserId) {
        return message.recipient_name || applicantName;
      }
      return message.recipient_name || 'Staff';
    },
    [applicantUserId, applicantName]
  );

  const inboxMessages = useMemo(() => {
    if (!applicantUserId) return messages.filter(msg => !isMessageDeleted(msg));
    return messages.filter(
      msg => msg && msg.sender_id === applicantUserId && !isMessageDeleted(msg)
    );
  }, [messages, applicantUserId]);

  const sentMessages = useMemo(() => {
    if (!applicantUserId) return messages.filter(msg => !isMessageDeleted(msg));
    return messages.filter(
      msg => msg && msg.recipient_id === applicantUserId && !isMessageDeleted(msg)
    );
  }, [messages, applicantUserId]);

  const deletedMessages = useMemo(
    () => messages.filter(msg => isMessageDeleted(msg)),
    [messages]
  );

  const filteringTextLower = filteringText.trim().toLowerCase();

  const filterMessages = useCallback(
    list => {
      if (!filteringTextLower) return list;
      return list.filter(msg => {
        if (!msg) return false;
        const haystack = [
          msg.subject,
          msg.body,
          formatStatusLabel(getDisplayStatusKey(msg, applicantUserId)),
          getSenderName(msg),
          getRecipientName(msg)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(filteringTextLower);
      });
    },
    [filteringTextLower, getSenderName, getRecipientName, applicantUserId]
  );

  const openMessage = useCallback(
    async message => {
      if (!message) return;
      setSelectedMessage(message);
      setViewModalOpen(true);
      if (applicantUserId && message.sender_id === applicantUserId && isUnread(message)) {
        try {
          const response = await apiFetch(`/api/admin/messages/${message.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'read' })
          });
          if (response.ok) {
            setMessages(prev =>
              prev.map(item =>
                item.id === message.id
                  ? { ...item, status: 'read', mailbox_status: 'read' }
                  : item
              )
            );
          }
        } catch (err) {
          // best-effort only
        }
      }
    },
    [applicantUserId]
  );

  const columnDefinitions = useMemo(
    () => [
      {
        id: 'created_at',
        header: 'Date/Time',
        cell: item => (
          <span style={{ fontWeight: isUnread(item) ? 'bold' : 'normal' }}>
            {formatDateTime(item?.created_at)}
          </span>
        ),
        sortingComparator: (a, b) =>
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
        minWidth: 160
      },
      {
        id: 'from',
        header: 'From',
        cell: item => (
          <span style={{ fontWeight: isUnread(item) ? 'bold' : 'normal' }}>{getSenderName(item)}</span>
        ),
        minWidth: 140
      },
      {
        id: 'subject',
        header: 'Subject',
        cell: item => (
          <Link
            href="#"
            onFollow={event => {
              event.preventDefault();
              openMessage(item);
            }}
            variant="primary"
            style={{
              display: 'inline-block',
              maxWidth: 240,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: isUnread(item) ? 'bold' : 'normal'
            }}
          >
            {item?.subject || '(No subject)'}
          </Link>
        ),
        minWidth: 200
      },
      {
        id: 'status',
        header: 'Status',
        cell: item => (
          <span style={{ fontWeight: isUnread(item) ? 'bold' : 'normal' }}>
            {formatStatusLabel(getDisplayStatusKey(item, applicantUserId))}
          </span>
        ),
        minWidth: 180
      },
      {
        id: 'urgent',
        header: 'Urgent',
        cell: item => (
          <span style={{ fontWeight: isUnread(item) ? 'bold' : 'normal' }}>
            {item?.urgent ? 'Yes' : 'No'}
          </span>
        ),
        minWidth: 80
      }
    ],
    [getSenderName, openMessage, applicantUserId]
  );

  useEffect(() => {
    if (!viewModalOpen || !selectedMessage?.id || !caseId) {
      setAttachments([]);
      setAttachmentsLoading(false);
      setAttachmentsError(null);
      return;
    }
    let cancelled = false;
    setAttachmentsLoading(true);
    setAttachmentsError(null);
    apiFetch(`/api/admin/messages/${selectedMessage.id}/attachments?case_id=${caseId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load attachments');
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        const list = resolveList(data);
        setAttachments(list);
        if (
          list.length > 0 &&
          applicantUserId &&
          typeof window !== 'undefined' &&
          typeof window.dispatchEvent === 'function'
        ) {
          window.dispatchEvent(
            new CustomEvent('iset:supporting-documents:refresh', {
              detail: { applicantUserId }
            })
          );
        }
      })
      .catch(err => {
        if (!cancelled) {
          setAttachments([]);
          setAttachmentsError(err?.message || 'Failed to load attachments');
        }
      })
      .finally(() => {
        if (!cancelled) setAttachmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewModalOpen, selectedMessage?.id, caseId, applicantUserId]);

  const handleCloseModal = () => {
    setViewModalOpen(false);
    setSelectedMessage(null);
  };

  const handleNewMessage = () => {
    setComposeSubject('');
    setComposeBody('');
    setComposeUrgent(false);
    setComposeError(null);
    setComposeModalOpen(true);
  };

  const handleReply = () => {
    if (!selectedMessage) return;
    const baseSubject = selectedMessage.subject || '(No subject)';
    const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;
    const quotedBody = selectedMessage.body
      ? selectedMessage.body
          .split('\n')
          .map(line => `> ${line}`)
          .join('\n')
      : '';
    setComposeSubject(subject);
    setComposeBody(`\n\n${quotedBody}`);
    setComposeUrgent(false);
    setComposeError(null);
    setComposeModalOpen(true);
  };

  const handleCancelCompose = () => {
    if (composeSending) return;
    const hasDraft = composeSubject.trim() || composeBody.trim() || Boolean(composeUrgent);
    if (hasDraft && typeof window !== 'undefined') {
      const confirmed = window.confirm('Discard this draft message?');
      if (!confirmed) return;
    }
    setComposeModalOpen(false);
  };

  const handleSendMessage = async () => {
    if (!caseId) return;
    if (!composeSubject.trim() || !composeBody.trim()) {
      setComposeError('Subject and message are required.');
      return;
    }
    setComposeSending(true);
    setComposeError(null);
    try {
      const response = await apiFetch(`/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: composeSubject.trim(),
          body: composeBody.trim(),
          urgent: composeUrgent
        })
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || 'Failed to send message');
      }
      setComposeModalOpen(false);
      setComposeSubject('');
      setComposeBody('');
      setComposeUrgent(false);
      await loadMessages({ silent: true });
    } catch (err) {
      setComposeError(err?.message || 'Failed to send message');
    } finally {
      setComposeSending(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    if (isMessageDeleted(selectedMessage)) {
      setShowHardDeleteModal(true);
      return;
    }
    try {
      await apiFetch(`/api/admin/messages/${selectedMessage.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      });
    } catch (err) {
      // continue to delete even if status update fails
    }
    try {
      const response = await apiFetch(`/api/admin/messages/${selectedMessage.id}/delete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to delete message');
      setViewModalOpen(false);
      setSelectedMessage(null);
      await loadMessages({ silent: true });
    } catch (err) {
      setLoadError(err?.message || 'Failed to delete message');
    }
  };

  const handleHardDelete = async () => {
    if (!selectedMessage) return;
    setShowHardDeleteModal(false);
    try {
      const response = await apiFetch(`/api/admin/messages/${selectedMessage.id}/hard-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to permanently delete message');
      setViewModalOpen(false);
      setSelectedMessage(null);
      await loadMessages({ silent: true });
    } catch (err) {
      setLoadError(err?.message || 'Failed to permanently delete message');
    }
  };

  const handleEmptyDeleted = () => {
    setEmptyConfirmText('');
    setShowEmptyDeletedModal(true);
  };

  const handleConfirmEmptyDeleted = async () => {
    setEmptyDeleting(true);
    const deletedIds = messages.filter(item => isMessageDeleted(item)).map(item => item.id);
    try {
      const responses = await Promise.all(
        deletedIds.map(id =>
          apiFetch(`/api/admin/messages/${id}/hard-delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
          })
        )
      );
      const failed = responses.find(res => !res.ok);
      if (failed) throw new Error('Failed to empty deleted messages');
      setShowEmptyDeletedModal(false);
      setEmptyConfirmText('');
      await loadMessages({ silent: true });
    } catch (err) {
      setLoadError(err?.message || 'Failed to empty deleted messages');
    } finally {
      setEmptyDeleting(false);
    }
  };

  const handleRefresh = () => {
    if (!caseId) return;
    loadMessages({ silent: true });
  };

  const currentStaffName = useMemo(() => assignedToName || '', [assignedToName]);

  const renderTabContent = tabId => {
    const baseItems =
      tabId === TAB_IDS.sent
        ? sentMessages
        : tabId === TAB_IDS.deleted
        ? deletedMessages
        : inboxMessages;
    const itemsForTab = filterMessages(baseItems);
    return (
      <SpaceBetween size="s">
        <TextFilter
          filteringText={filteringText}
          onChange={({ detail }) => setFilteringText(detail.filteringText)}
          placeholder="Search messages"
        />
        {loading ? (
          <Spinner />
        ) : loadError ? (
          <Box color="text-status-critical">{loadError}</Box>
        ) : (
          <Table
            columnDefinitions={columnDefinitions}
            items={itemsForTab}
            trackBy="id"
            variant="embedded"
            stripedRows
            resizableColumns
            stickyHeader
            empty={<Box>No messages found.</Box>}
            onRowClick={({ detail }) => openMessage(detail.item)}
          />
        )}
        {refreshing && !loading ? (
          <Box color="text-body-secondary">Refreshing...</Box>
        ) : null}
      </SpaceBetween>
    );
  };

  const tabs = [
    {
      label: `Inbox (${inboxMessages.length})`,
      id: TAB_IDS.inbox,
      content: renderTabContent(TAB_IDS.inbox)
    },
    {
      label: `Sent (${sentMessages.length})`,
      id: TAB_IDS.sent,
      content: renderTabContent(TAB_IDS.sent)
    },
    {
      label: `Deleted (${deletedMessages.length})`,
      id: TAB_IDS.deleted,
      content: renderTabContent(TAB_IDS.deleted),
      action: (
        <ButtonDropdown
          variant="icon"
          ariaLabel="Deleted actions"
          items={[{ id: 'empty', text: 'Empty Items' }]}
          expandToViewport
          disabled={deletedMessages.length === 0}
          onItemClick={({ detail }) => {
            if (detail.id === 'empty') handleEmptyDeleted();
          }}
        />
      )
    }
  ];

  const renderMessageDetails = () => {
    if (!selectedMessage) return null;
    const detailRowStyle = {
      display: 'grid',
      gridTemplateColumns: '88px 1fr',
      columnGap: '10px',
      alignItems: 'start'
    };
    const detailLabelStyle = { fontWeight: 700, color: '#414d5c', paddingTop: '2px' };
    const detailValueStyle = { color: '#16191f' };
    return (
      <SpaceBetween size="s">
        <div style={detailRowStyle}>
          <Box as="span" style={detailLabelStyle}>From:</Box>
          <Box style={detailValueStyle}>{getSenderName(selectedMessage)}</Box>
        </div>
        <div style={detailRowStyle}>
          <Box as="span" style={detailLabelStyle}>To:</Box>
          <Box style={detailValueStyle}>{getRecipientName(selectedMessage)}</Box>
        </div>
        <div style={detailRowStyle}>
          <Box as="span" style={detailLabelStyle}>Sent:</Box>
          <Box style={detailValueStyle}>{formatDateTime(selectedMessage.created_at)}</Box>
        </div>
        <div style={detailRowStyle}>
          <Box as="span" style={detailLabelStyle}>Subject:</Box>
          <Box style={detailValueStyle} fontWeight="bold">{selectedMessage.subject || '(No subject)'}</Box>
        </div>
        <Container>
          <div
            style={{
              height: '220px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap'
            }}
          >
            {selectedMessage.body || '(No message body)'}
          </div>
        </Container>
        {attachmentsLoading && <Spinner />}
        {attachmentsError && <Box color="text-status-critical">{attachmentsError}</Box>}
        <div style={detailRowStyle}>
          <Box as="span" style={detailLabelStyle}>Files:</Box>
          {attachments.length > 0 ? (
            <ul style={{ paddingLeft: 16, marginTop: 2, marginBottom: 0 }}>
              {attachments.map(attachment => (
                <li key={attachment.id} style={{ marginBottom: 4 }}>
                  <a
                    href={buildAttachmentUrl(attachment)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {attachment.original_filename || 'Attachment'}
                  </a>
                  {attachment.uploaded_at ? (
                    <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>
                      ({formatDateTime(attachment.uploaded_at)})
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Box color="text-body-secondary">No attachments.</Box>
          )}
        </div>
      </SpaceBetween>
    );
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="icon"
                iconName="refresh"
                ariaLabel="Refresh"
                onClick={handleRefresh}
                disabled={loading || refreshing || !caseId || !messagingAvailable}
              />
              <Button variant="primary" onClick={handleNewMessage} disabled={!caseId || !messagingAvailable}>
                New Message
              </Button>
            </SpaceBetween>
          }
          info={
            toggleHelpPanel ? (
              <Link variant="info" onFollow={handleInfoClick}>
                Info
              </Link>
            ) : undefined
          }
        >
          Secure Messaging
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription:
          'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription:
          'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        actions?.removeItem ? (
          <ButtonDropdown
            items={[{ id: 'remove', text: 'Remove' }]}
            ariaLabel="Widget settings"
            variant="icon"
            onItemClick={({ detail }) => {
              if (detail.id === 'remove') actions.removeItem();
            }}
          />
        ) : null
      }
    >
      <SpaceBetween size="m">
        <Box variant="small" color="text-body-secondary">
          Use the inbox, sent, and deleted tabs to manage secure communications with the applicant. The
          workflow mirrors familiar email clients while keeping attachments tied to supporting documents.
        </Box>
        {!caseId ? (
          <Box color="text-status-warning">Messages will be available once the case is fully loaded.</Box>
        ) : !messagingAvailable ? (
          <Box color="text-body-secondary">
            Secure messaging becomes available after a participant applicant account is linked to this case.
          </Box>
        ) : (
          <Tabs
            activeTabId={activeTabId}
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
            tabs={tabs}
          />
        )}
      </SpaceBetween>
      <Modal
        visible={viewModalOpen}
        onDismiss={handleCloseModal}
        header="Message Details"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="primary" onClick={handleReply} disabled={!selectedMessage}>
              Reply
            </Button>
            <Button variant="normal" onClick={handleDeleteMessage} disabled={!selectedMessage}>
              {selectedMessage && isMessageDeleted(selectedMessage) ? 'Permanently Delete' : 'Delete'}
            </Button>
            <Button variant="normal" onClick={handleCloseModal}>
              Close
            </Button>
          </SpaceBetween>
        }
      >
        {renderMessageDetails()}
      </Modal>
      <Modal
        visible={composeModalOpen}
        onDismiss={() => {}}
        header="New Message"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={handleSendMessage}
              loading={composeSending}
              disabled={composeSending || !composeSubject.trim() || !composeBody.trim()}
            >
              Send
            </Button>
            <Button
              variant="normal"
              onClick={handleCancelCompose}
              disabled={composeSending}
            >
              Cancel
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <div>
            <label style={{ fontWeight: 'bold' }}>To:</label>
            <Input readOnly value={applicantName} />
          </div>
          <div>
            <label style={{ fontWeight: 'bold' }}>From:</label>
            <Input readOnly value={currentStaffName || 'Case staff'} />
          </div>
          <div>
            <label style={{ fontWeight: 'bold' }}>Subject:</label>
            <Input
              value={composeSubject}
              onChange={({ detail }) => setComposeSubject(detail.value)}
              placeholder="Subject"
              spellcheck={true}
              disabled={composeSending}
            />
          </div>
          <div>
            <label style={{ fontWeight: 'bold' }}>Message:</label>
            <Textarea
              value={composeBody}
              onChange={({ detail }) => setComposeBody(detail.value)}
              rows={6}
              placeholder="Write your message"
              spellcheck={true}
              disabled={composeSending}
            />
          </div>
          <Checkbox
            checked={!!composeUrgent}
            onChange={({ detail }) => setComposeUrgent(detail.checked)}
            disabled={composeSending}
          >
            Mark as urgent
          </Checkbox>
          {composeError ? <Box color="text-status-critical">{composeError}</Box> : null}
        </SpaceBetween>
      </Modal>
      <Modal
        visible={showHardDeleteModal}
        onDismiss={() => setShowHardDeleteModal(false)}
        header="Permanently Delete Message?"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="primary" onClick={handleHardDelete}>
              Delete Permanently
            </Button>
            <Button variant="normal" onClick={() => setShowHardDeleteModal(false)}>
              Cancel
            </Button>
          </SpaceBetween>
        }
      >
        <Box color="text-status-critical">
          This permanently removes the message and any attachments. Attachments already promoted into
          supporting documents will remain available there.
        </Box>
      </Modal>
      <Modal
        visible={showEmptyDeletedModal}
        onDismiss={() => setShowEmptyDeletedModal(false)}
        header="Empty Deleted Items?"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={handleConfirmEmptyDeleted}
              disabled={emptyConfirmText.trim().toLowerCase() !== 'delete' || emptyDeleting}
              loading={emptyDeleting}
            >
              Delete All Permanently
            </Button>
            <Button
              variant="normal"
              onClick={() => setShowEmptyDeletedModal(false)}
              disabled={emptyDeleting}
            >
              Cancel
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <Box color="text-status-critical">
            This irreversibly deletes every message in Deleted Items. Attachments already copied into
            supporting documents are unaffected. Type <b>delete</b> to confirm.
          </Box>
          <Input
            value={emptyConfirmText}
            onChange={({ detail }) => setEmptyConfirmText(detail.value)}
            placeholder="Type 'delete' to confirm"
            autoFocus
            spellcheck={false}
            disabled={emptyDeleting}
          />
        </SpaceBetween>
      </Modal>
    </BoardItem>
  );
};

export default SecureMessagingWidget;

