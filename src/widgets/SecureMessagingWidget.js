import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
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
  Hotspot
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';
import SecureMessagesHelpPanelContent from '../helpPanelContents/secureMessagesHelpPanelContent';
import { useCaseWorkspace } from '../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx';
import { openSecureMessageCompose, SECURE_MESSAGE_REFRESH_EVENT } from './SecureMessageComposePanel.jsx';

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
  return isApplicantRecipient(message, applicantUserId) && !isApplicantSender(message, applicantUserId);
};

const isApplicantSender = (message, applicantUserId) => {
  const applicantId = Number(applicantUserId);
  if (!message || !Number.isFinite(applicantId) || applicantId <= 0) return false;
  const senderActorType = message.sender?.actorType || message.sender?.actor_type || message.sender_actor_type;
  const senderUserId = message.sender?.userId ?? message.sender?.user_id ?? message.sender_user_id;
  return senderActorType === 'applicant_user' && Number(senderUserId) === applicantId;
};

const isApplicantRecipient = (message, applicantUserId) => {
  const applicantId = Number(applicantUserId);
  if (!message || !Number.isFinite(applicantId) || applicantId <= 0) return false;
  const recipientActorType = message.recipient?.actorType || message.recipient?.actor_type || message.recipient_actor_type;
  const recipientUserId = message.recipient?.userId ?? message.recipient?.user_id ?? message.recipient_user_id;
  return recipientActorType === 'applicant_user' && Number(recipientUserId) === applicantId;
};

const getMailboxStatusKey = message => normalizeStatusValue(message?.mailbox_status || message?.status);

const getRecipientStatusKey = message => normalizeStatusValue(message?.recipient_status);

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
  const normalized = normalizeStatusValue(statusKey);
  if (!normalized) return '--';
  return STATUS_LABELS[normalized] || normalizeStatus(normalized);
};

const isUnread = message => {
  return getMailboxStatusKey(message) === 'unread';
};

const canWithdrawMessage = message => {
  if (!message || isMessageDeleted(message)) return false;
  return message.can_withdraw === 1 || message.can_withdraw === true || message.canWithdraw === true;
};

const resolveList = data => (Array.isArray(data) ? data : []);

const normalizeStatusValue = (value) => {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const buildAttachmentUrl = attachment => {
  const directUrl = attachment?.download_url || '';
  if (directUrl) return directUrl;
  return '#';
};

const SecureMessagingWidget = ({
  actions = {},
  toggleHelpPanel,
  caseData: propCaseData
}) => {
  const workspace = useCaseWorkspace();
  const workspaceCaseData = workspace && typeof workspace === 'object' ? workspace.caseData || null : null;
  const isCaseWorkspace = Boolean(workspaceCaseData);
  const caseData = useMemo(() => {
    if (propCaseData) return propCaseData;
    if (workspaceCaseData) return workspaceCaseData;
    return null;
  }, [propCaseData, workspaceCaseData]);
  const selectedInterventionId = workspace?.selectedInterventionId ?? null;

  const rawCaseId =
    caseData?.id ??
    caseData?.case_id ??
    workspace?.caseId ??
    workspaceCaseData?.id ??
    workspaceCaseData?.case_id ??
    null;
  const caseIdNum = Number(rawCaseId);
  const caseId = rawCaseId == null || rawCaseId === '' || Number.isNaN(caseIdNum) ? null : caseIdNum;

  const rawApplicationId =
    caseData?.application_id ??
    caseData?.applicationId ??
    workspaceCaseData?.application_id ??
    workspaceCaseData?.applicationId ??
    workspace?.application_id ??
    workspace?.applicationId ??
    null;
  const applicationIdNum = Number(rawApplicationId);
  const applicationId =
    rawApplicationId == null || rawApplicationId === '' || Number.isNaN(applicationIdNum)
      ? null
      : applicationIdNum;

  const rawApplicantUserId =
    caseData?.applicant_user_id ??
    caseData?.applicantUserId ??
    workspaceCaseData?.applicant_user_id ??
    workspaceCaseData?.applicantUserId ??
    workspace?.applicant_user_id ??
    workspace?.applicantUserId ??
    null;
  const applicantUserIdNum = Number(rawApplicantUserId);
  const applicantUserId =
    rawApplicantUserId == null || rawApplicantUserId === '' || Number.isNaN(applicantUserIdNum)
      ? null
      : applicantUserIdNum;
  const messagingAvailable = Boolean(applicantUserId);

  const selectedInterventionNum = Number(selectedInterventionId);
  const interventionId =
    selectedInterventionId == null || selectedInterventionId === '' || Number.isNaN(selectedInterventionNum)
      ? null
      : selectedInterventionNum;

  const applicantName =
    caseData?.applicant_name ??
    caseData?.applicantName ??
    workspaceCaseData?.applicant_name ??
    workspaceCaseData?.applicantName ??
    workspace?.applicant_name ??
    workspace?.applicantName ??
    'Applicant';
  const assignedToName =
    caseData?.assigned_to_name ??
    caseData?.assignedToName ??
    workspaceCaseData?.assigned_to_name ??
    workspaceCaseData?.assignedToName ??
    workspace?.assigned_to_name ??
    workspace?.assignedToName ??
    '';
  const caseReference =
    caseData?.case_number ??
    caseData?.caseNumber ??
    caseData?.submission_reference ??
    caseData?.submissionReference ??
    workspaceCaseData?.case_number ??
    workspaceCaseData?.caseNumber ??
    workspaceCaseData?.submission_reference ??
    workspaceCaseData?.submissionReference ??
    null;
  const currentStaffName = useMemo(() => assignedToName || '', [assignedToName]);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [messageSorting, setMessageSorting] = useState({ id: 'created_at', descending: true });
  const [activeTabId, setActiveTabId] = useState(TAB_IDS.inbox);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState(null);
  const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawConfirmText, setWithdrawConfirmText] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState(null);
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleRefreshEvent = event => {
      const targetCaseId = Number(event?.detail?.caseId || 0);
      if (!caseId || (targetCaseId && targetCaseId !== caseId)) return;
      loadMessages({ silent: true });
    };
    window.addEventListener(SECURE_MESSAGE_REFRESH_EVENT, handleRefreshEvent);
    return () => {
      window.removeEventListener(SECURE_MESSAGE_REFRESH_EVENT, handleRefreshEvent);
    };
  }, [caseId, loadMessages]);

  const createComposeContext = useCallback(
    ({ mode = 'new', toName = null } = {}) => ({
      mode,
      caseId,
      applicationId,
      applicantUserId,
      applicantName: applicantName || 'Applicant',
      toName: toName || applicantName || 'Applicant',
      fromName: currentStaffName || 'Case Worker',
      caseReference: caseReference || (caseId ? `Case ${caseId}` : null),
      interventionId: isCaseWorkspace ? interventionId : null,
      isCaseWorkspace
    }),
    [
      applicantName,
      applicantUserId,
      applicationId,
      caseId,
      caseReference,
      currentStaffName,
      interventionId,
      isCaseWorkspace
    ]
  );

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
      if (isApplicantSender(message, applicantUserId)) {
        return message.sender_name || applicantName;
      }
      return message.sender_name || 'Staff';
    },
    [applicantUserId, applicantName]
  );

  const getRecipientName = useCallback(
    message => {
      if (!message) return '';
      if (isApplicantRecipient(message, applicantUserId)) {
        return message.recipient_name || applicantName;
      }
      return message.recipient_name || 'Staff';
    },
    [applicantUserId, applicantName]
  );

  const inboxMessages = useMemo(() => {
    if (!applicantUserId) return messages.filter(msg => !isMessageDeleted(msg));
    return messages.filter(
      msg => msg && isApplicantSender(msg, applicantUserId) && !isMessageDeleted(msg)
    );
  }, [messages, applicantUserId]);

  const sentMessages = useMemo(() => {
    if (!applicantUserId) return messages.filter(msg => !isMessageDeleted(msg));
    return messages.filter(
      msg => msg && isApplicantRecipient(msg, applicantUserId) && !isMessageDeleted(msg)
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

  const getMessageFormsCount = useCallback(message => {
    const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
    return attachments.filter(attachment => attachment && attachment.workflow_id).length;
  }, []);

  const openMessage = useCallback(
    async message => {
      if (!message) return;
      setSelectedMessage(message);
      setViewModalOpen(true);
      const isFromApplicant =
        isApplicantSender(message, applicantUserId) &&
        !isApplicantRecipient(message, applicantUserId);
      if (isFromApplicant && isUnread(message)) {
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
        sortingComparator: (a, b) => getSenderName(a).localeCompare(getSenderName(b)),
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
        sortingComparator: (a, b) => String(a?.subject || '').localeCompare(String(b?.subject || '')),
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
        sortingComparator: (a, b) =>
          formatStatusLabel(getDisplayStatusKey(a, applicantUserId))
            .localeCompare(formatStatusLabel(getDisplayStatusKey(b, applicantUserId))),
        minWidth: 180
      },
      {
        id: 'forms',
        header: 'Forms',
        cell: item => {
          const forms = Array.isArray(item?.attachments)
            ? item.attachments.filter(a => a && a.workflow_id)
            : [];
          if (!forms.length) return '—';
          const pending = forms.filter(f => (f.status || '').toLowerCase() === 'pending').length;
          const viewed = forms.filter(f => (f.status || '').toLowerCase() === 'viewed').length;
          const signed = forms.filter(f => (f.status || '').toLowerCase() === 'signed').length;
          const cancelled = forms.filter(f => (f.status || '').toLowerCase() === 'cancelled').length;
          const parts = [];
          if (pending) parts.push(`${pending} pending`);
          if (viewed) parts.push(`${viewed} viewed`);
          if (signed) parts.push(`${signed} signed`);
          if (cancelled) parts.push(`${cancelled} cancelled`);
          return parts.length ? parts.join(' · ') : `${forms.length} attached`;
        },
        sortingComparator: (a, b) => getMessageFormsCount(a) - getMessageFormsCount(b),
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
        sortingComparator: (a, b) => Number(Boolean(a?.urgent)) - Number(Boolean(b?.urgent)),
        minWidth: 80
      }
    ],
    [getSenderName, openMessage, applicantUserId, getMessageFormsCount]
  );

  const activeSortingColumn = useMemo(
    () => columnDefinitions.find(column => column.id === messageSorting.id) || columnDefinitions[0],
    [columnDefinitions, messageSorting.id]
  );

  const sortMessagesForDisplay = useCallback(
    items => {
      const comparator = activeSortingColumn?.sortingComparator;
      if (typeof comparator !== 'function') return items;
      return [...items].sort((a, b) => {
        const result = comparator(a, b);
        return messageSorting.descending ? -result : result;
      });
    },
    [activeSortingColumn, messageSorting.descending]
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
    const params = new URLSearchParams({ case_id: String(caseId) });
    if (interventionId) {
      params.set('intervention_id', String(interventionId));
    }
    apiFetch(`/api/admin/messages/${selectedMessage.id}/attachments?${params.toString()}`)
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
  }, [viewModalOpen, selectedMessage?.id, caseId, applicantUserId, interventionId]);

  const handleCloseModal = () => {
    setViewModalOpen(false);
    setSelectedMessage(null);
    setShowWithdrawModal(false);
    setWithdrawConfirmText('');
    setWithdrawError(null);
  };

  const handleNewMessage = () => {
    if (!caseId || !messagingAvailable) return;
    openSecureMessageCompose(createComposeContext({ mode: 'new' }));
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
    const replyToName = getSenderName(selectedMessage) || applicantName || 'Applicant';
    const nextContext = createComposeContext({ mode: 'reply', toName: replyToName });
    const opened = openSecureMessageCompose({
      ...nextContext,
      subject,
      body: `\n\n${quotedBody}`,
      urgent: false
    });
    if (opened) {
      setViewModalOpen(false);
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
      if (!response.ok) throw new Error('Failed to remove message from Deleted');
      setViewModalOpen(false);
      setSelectedMessage(null);
      await loadMessages({ silent: true });
    } catch (err) {
      setLoadError(err?.message || 'Failed to remove message from Deleted');
    }
  };

  const handleWithdrawMessage = () => {
    if (!selectedMessage || !canWithdrawMessage(selectedMessage)) return;
    setWithdrawConfirmText('');
    setWithdrawError(null);
    setShowWithdrawModal(true);
  };

  const handleConfirmWithdraw = async () => {
    if (!selectedMessage || withdrawing) return;
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      const response = await apiFetch(`/api/admin/messages/${selectedMessage.id}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.message || detail?.error || 'Failed to withdraw message');
      }
      setShowWithdrawModal(false);
      setWithdrawConfirmText('');
      setViewModalOpen(false);
      setSelectedMessage(null);
      await loadMessages({ silent: true });
    } catch (err) {
      setWithdrawError(err?.message || 'Failed to withdraw message');
    } finally {
      setWithdrawing(false);
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
      if (failed) throw new Error('Failed to remove deleted messages');
      setShowEmptyDeletedModal(false);
      setEmptyConfirmText('');
      await loadMessages({ silent: true });
    } catch (err) {
      setLoadError(err?.message || 'Failed to remove deleted messages');
    } finally {
      setEmptyDeleting(false);
    }
  };

  const handleRefresh = () => {
    if (!caseId) return;
    loadMessages({ silent: true });
  };

  const renderTabContent = tabId => {
    const baseItems =
      tabId === TAB_IDS.sent
        ? sentMessages
        : tabId === TAB_IDS.deleted
        ? deletedMessages
        : inboxMessages;
    const itemsForTab = filterMessages(baseItems);
    const sortedItemsForTab = sortMessagesForDisplay(itemsForTab);
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
            items={sortedItemsForTab}
            trackBy="id"
            variant="embedded"
            stripedRows
            resizableColumns
            stickyHeader
            sortingColumn={activeSortingColumn}
            sortingDescending={messageSorting.descending}
            onSortingChange={({ detail }) => {
              const columnId = detail?.sortingColumn?.id;
              if (!columnId) return;
              setMessageSorting({ id: columnId, descending: detail.isDescending });
            }}
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
    const signingAttachments = Array.isArray(selectedMessage.attachments)
      ? selectedMessage.attachments
      : [];
    const typeLabel = (raw) => {
      const val = (raw || '').trim();
      if (val === 'consent-cm-prefill') return 'Form (CM prefill)';
      if (val === 'consent-no-prefill') return 'Form (No prefill)';
      return val || 'Form';
    };
    const statusLabel = (raw) => normalizeStatus(raw || 'pending');
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
        {signingAttachments.length > 0 && (
          <div style={detailRowStyle}>
            <Box as="span" style={detailLabelStyle}>Forms:</Box>
            <ul style={{ paddingLeft: 16, marginTop: 2, marginBottom: 0 }}>
              {signingAttachments.map(att => (
                <li key={att.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{att.workflow_name || `Form ${att.workflow_id || att.id}`}</span>{' '}
                  <span style={{ color: '#687078' }}>({typeLabel(att.workflow_type)})</span>{' '}
                  <span style={{ color: '#414d5c', fontSize: 12 }}>Status: {statusLabel(att.status)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
          <Hotspot hotspotId="app-workspace-secure-messaging" direction="right" />
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
            {selectedMessage && canWithdrawMessage(selectedMessage) ? (
              <Button variant="normal" onClick={handleWithdrawMessage} disabled={withdrawing}>
                Withdraw sent message
              </Button>
            ) : null}
            <Button variant="normal" onClick={handleDeleteMessage} disabled={!selectedMessage}>
              {selectedMessage && isMessageDeleted(selectedMessage) ? 'Remove from Deleted' : 'Move to Deleted'}
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
        visible={showWithdrawModal}
        onDismiss={() => {
          if (withdrawing) return;
          setShowWithdrawModal(false);
          setWithdrawConfirmText('');
          setWithdrawError(null);
        }}
        header="Withdraw sent message?"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={handleConfirmWithdraw}
              disabled={withdrawConfirmText.trim().toLowerCase() !== 'withdraw' || withdrawing}
              loading={withdrawing}
            >
              Withdraw message
            </Button>
            <Button
              variant="normal"
              onClick={() => {
                setShowWithdrawModal(false);
                setWithdrawConfirmText('');
                setWithdrawError(null);
              }}
              disabled={withdrawing}
            >
              Cancel
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <Alert type="warning">
            Withdrawing replaces the subject and body with a neutral withdrawal notice and moves the
            sender and applicant mailbox copies to Deleted. It preserves the audit record.
          </Alert>
          <Input
            value={withdrawConfirmText}
            onChange={({ detail }) => setWithdrawConfirmText(detail.value)}
            placeholder="Type 'withdraw' to confirm"
            autoFocus
            spellcheck={false}
            disabled={withdrawing}
          />
          {withdrawError ? <Box color="text-status-critical">{withdrawError}</Box> : null}
        </SpaceBetween>
      </Modal>
      <Modal
        visible={showHardDeleteModal}
        onDismiss={() => setShowHardDeleteModal(false)}
        header="Remove from Deleted items?"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="primary" onClick={handleHardDelete}>
              Remove from Deleted
            </Button>
            <Button variant="normal" onClick={() => setShowHardDeleteModal(false)}>
              Cancel
            </Button>
          </SpaceBetween>
        }
      >
        <Box color="text-status-critical">
          This removes the message from your Deleted tab only. It does not withdraw the message for
          the applicant or other staff.
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
              Remove All
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
            This removes every message from your Deleted tab only. It does not withdraw messages for
            applicants or other staff. Type <b>delete</b> to confirm.
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

