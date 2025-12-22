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
  Input,
  Textarea,
  Checkbox,
  Multiselect
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';
import SecureMessagesHelpPanelContent from '../helpPanelContents/secureMessagesHelpPanelContent';
import { useCaseWorkspace } from '../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx';

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

const isUnread = message => {
  if (!message || !message.status) return false;
  return message.status.toString().toLowerCase() === 'unread';
};

const resolveList = data => (Array.isArray(data) ? data : []);

const buildAttachmentUrl = filePath => {
  if (!filePath) return '#';
  const base = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');
  if (!base) return filePath;
  return `${base}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
};

const SecureMessagingWidget = ({ actions = {}, toggleHelpPanel, caseData: propCaseData }) => {
  const workspace = useCaseWorkspace();
  const workspaceCaseData = workspace && typeof workspace === 'object' ? workspace.caseData || null : null;
  const caseData = useMemo(() => {
    if (propCaseData) return propCaseData;
    if (workspaceCaseData) return workspaceCaseData;
    return null;
  }, [propCaseData, workspaceCaseData]);

  const rawCaseId =
    caseData?.id ??
    caseData?.case_id ??
    workspace?.caseId ??
    workspaceCaseData?.id ??
    workspaceCaseData?.case_id ??
    null;
  const caseIdNum = Number(rawCaseId);
  const caseId = rawCaseId == null || rawCaseId === '' || Number.isNaN(caseIdNum) ? null : caseIdNum;

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

  const applicantName =
    caseData?.applicant_name ??
    caseData?.applicantName ??
    workspaceCaseData?.applicant_name ??
    workspaceCaseData?.applicantName ??
    workspace?.applicant_name ??
    workspace?.applicantName ??
    'Applicant';
  const assignedToUserId =
    caseData?.assigned_to_user_id ??
    caseData?.assignedToUserId ??
    workspaceCaseData?.assigned_to_user_id ??
    workspaceCaseData?.assignedToUserId ??
    workspace?.assigned_to_user_id ??
    workspace?.assignedToUserId ??
    null;
  const assignedToName =
    caseData?.assigned_to_name ??
    caseData?.assignedToName ??
    workspaceCaseData?.assigned_to_name ??
    workspaceCaseData?.assignedToName ??
    workspace?.assigned_to_name ??
    workspace?.assignedToName ??
    '';

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
  const [evaluators, setEvaluators] = useState([]);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeUrgent, setComposeUrgent] = useState(false);
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState(null);
  const [composeToName, setComposeToName] = useState('Applicant');
  const [composeFromName, setComposeFromName] = useState('Case Worker');
  const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);
  const [showEmptyDeletedModal, setShowEmptyDeletedModal] = useState(false);
  const [emptyConfirmText, setEmptyConfirmText] = useState('');
  const [emptyDeleting, setEmptyDeleting] = useState(false);
  const [workflowOptions, setWorkflowOptions] = useState([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [workflowsError, setWorkflowsError] = useState(null);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState([]);

  useEffect(() => {
    setFilteringText('');
    setActiveTabId(TAB_IDS.inbox);
  }, [caseId]);

  const loadMessages = useCallback(
    async (options = {}) => {
      if (!caseId) return;
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
    [caseId]
  );

  useEffect(() => {
    if (!caseId) {
      setMessages([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    loadMessages();
  }, [caseId, loadMessages]);

  // Load eligible workflows for attachments
  const loadWorkflows = useCallback(async () => {
    setWorkflowsLoading(true);
    setWorkflowsError(null);
    try {
      const resp = await apiFetch('/api/workflows');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json().catch(() => []);
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      const filtered = rows
        .map(r => ({
          id: r.id,
          name: r.name || `Workflow ${r.id}`,
          type: (r.workflow_type || r.workflowType || '').trim()
        }))
        .filter(r => r.type === 'consent-no-prefill' || r.type === 'consent-cm-prefill');
      setWorkflowOptions(filtered);
    } catch (e) {
      setWorkflowsError(e?.message || 'Failed to load workflows');
      setWorkflowOptions([]);
    } finally {
      setWorkflowsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch('/api/intake-officers')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        if (active) setEvaluators(resolveList(data));
      })
      .catch(() => {
        if (active) setEvaluators([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleInfoClick = () => {
    if (typeof toggleHelpPanel === 'function') {
      toggleHelpPanel(
        <SecureMessagesHelpPanelContent />,
        'Secure Messaging Help',
        SecureMessagesHelpPanelContent.aiContext
      );
    }
  };

  const evaluatorList = useMemo(() => resolveList(evaluators), [evaluators]);

  const getEvaluatorName = useCallback(
    userId => {
      if (!userId) return '';
      const match = evaluatorList.find(
        entry => entry.evaluator_id === userId || entry.user_id === userId
      );
      return match?.evaluator_name || '';
    },
    [evaluatorList]
  );

  const getSenderName = useCallback(
    message => {
      if (!message) return '';
      if (applicantUserId && message.sender_id === applicantUserId) {
        return message.sender_name || applicantName;
      }
      return message.sender_name || getEvaluatorName(message.sender_id) || 'Staff';
    },
    [applicantUserId, applicantName, getEvaluatorName]
  );

  const getRecipientName = useCallback(
    message => {
      if (!message) return '';
      if (applicantUserId && message.recipient_id === applicantUserId) {
        return message.recipient_name || applicantName;
      }
      return message.recipient_name || getEvaluatorName(message.recipient_id) || 'Staff';
    },
    [applicantUserId, applicantName, getEvaluatorName]
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
          msg.status,
          getSenderName(msg),
          getRecipientName(msg)
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(filteringTextLower);
      });
    },
    [filteringTextLower, getSenderName, getRecipientName]
  );

  const openMessage = useCallback(
    async message => {
      if (!message) return;
      setSelectedMessage(message);
      setViewModalOpen(true);
      const isFromApplicant =
        applicantUserId &&
        message.sender_id === applicantUserId &&
        message.recipient_id !== applicantUserId;
      if (isFromApplicant && isUnread(message)) {
        try {
          const response = await apiFetch(`/api/admin/messages/${message.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'read' })
          });
          if (response.ok) {
            setMessages(prev =>
              prev.map(item => (item.id === message.id ? { ...item, status: 'read' } : item))
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
            {normalizeStatus(item?.status)}
          </span>
        ),
        minWidth: 120
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
    [getSenderName, openMessage]
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
    setComposeToName(applicantName || 'Applicant');
    setComposeFromName(currentEvaluatorName || 'Case Worker');
    setSelectedWorkflowIds([]);
    loadWorkflows();
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
    setComposeToName(getSenderName(selectedMessage) || applicantName || 'Applicant');
    setComposeFromName(currentEvaluatorName || 'Case Worker');
    setSelectedWorkflowIds([]);
    loadWorkflows();
    setComposeModalOpen(true);
  };

  const handleSendMessage = async () => {
    if (!caseId) return;
    const subject = composeSubject.trim();
    const body = composeBody.trim();
    const toName = composeToName.trim();
    const fromName = composeFromName.trim();
    if (!subject || !body) {
      setComposeError('Subject and message are required.');
      return;
    }
    if (!toName || !fromName) {
      setComposeError('"To" and "From" names are required.');
      return;
    }
    setComposeSending(true);
    setComposeError(null);
    try {
      const attachmentsPayload = selectedWorkflowIds.map(id => ({ workflow_id: id }));
      const response = await apiFetch(`/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          urgent: composeUrgent,
          toDisplayName: toName,
          fromDisplayName: fromName,
          attachments: attachmentsPayload
        })
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || 'Failed to send message');
      }
      setComposeModalOpen(false);
      setComposeSubject('');
      setComposeBody('');
      setComposeToName(applicantName || 'Applicant');
      setComposeFromName(currentEvaluatorName || 'Case Worker');
      setComposeUrgent(false);
      setSelectedWorkflowIds([]);
      await loadMessages({ silent: true });
    } catch (err) {
      setComposeError(err?.message || 'Failed to send message');
    } finally {
      setComposeSending(false);
    }
  };

  const toggleWorkflowSelection = (id) => {
    setSelectedWorkflowIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
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

  const currentEvaluatorName = useMemo(() => {
    if (!assignedToUserId) return assignedToName || '';
    return getEvaluatorName(assignedToUserId) || assignedToName || '';
  }, [assignedToUserId, assignedToName, getEvaluatorName]);

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
    return (
      <SpaceBetween size="s">
        <div>
          <label style={{ fontWeight: 'bold' }}>From:</label>
          <Input readOnly value={getSenderName(selectedMessage)} />
        </div>
        <div>
          <label style={{ fontWeight: 'bold' }}>To:</label>
          <Input readOnly value={getRecipientName(selectedMessage)} />
        </div>
        <div>
          <label style={{ fontWeight: 'bold' }}>Sent:</label>
          <Input readOnly value={formatDateTime(selectedMessage.created_at)} />
        </div>
        <div>
          <label style={{ fontWeight: 'bold' }}>Subject:</label>
          <Input readOnly value={selectedMessage.subject || '(No subject)'} />
        </div>
        <div>
          <label style={{ fontWeight: 'bold' }}>Message:</label>
          <Textarea readOnly value={selectedMessage.body || ''} rows={6} />
        </div>
        <div>
          <label style={{ fontWeight: 'bold' }}>Urgent:</label>
          <Input readOnly value={selectedMessage.urgent ? 'Yes' : 'No'} />
        </div>
        {signingAttachments.length > 0 && (
          <div>
            <label style={{ fontWeight: 'bold' }}>Forms attached:</label>
            <ul style={{ paddingLeft: 16, marginTop: 4, marginBottom: 4 }}>
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
        {attachments.length > 0 && (
          <div>
            <label style={{ fontWeight: 'bold' }}>Attachments:</label>
            <ul style={{ paddingLeft: 16 }}>
              {attachments.map(attachment => (
                <li key={attachment.id} style={{ marginBottom: 4 }}>
                  <a
                    href={buildAttachmentUrl(attachment.file_path || '')}
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
          </div>
        )}
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
                disabled={loading || refreshing || !caseId}
              />
              <Button variant="primary" onClick={handleNewMessage} disabled={!caseId}>
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
        onDismiss={() => {
          if (!composeSending) setComposeModalOpen(false);
        }}
        header="New Message"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={handleSendMessage}
              loading={composeSending}
              disabled={
                composeSending ||
                !composeSubject.trim() ||
                !composeBody.trim() ||
                !composeToName.trim() ||
                !composeFromName.trim()
              }
            >
              Send
            </Button>
            <Button
              variant="normal"
              onClick={() => setComposeModalOpen(false)}
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
            <Input
              value={composeToName}
              placeholder="Applicant"
              onChange={({ detail }) => setComposeToName(detail.value)}
              disabled={composeSending}
            />
          </div>
          <div>
            <label style={{ fontWeight: 'bold' }}>From:</label>
            <Input
              value={composeFromName}
              placeholder="Case Worker"
              onChange={({ detail }) => setComposeFromName(detail.value)}
              disabled={composeSending}
            />
          </div>
          <div>
            <label style={{ fontWeight: 'bold' }}>Subject:</label>
            <Input
              value={composeSubject}
              onChange={({ detail }) => setComposeSubject(detail.value)}
              placeholder="Subject"
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
              disabled={composeSending}
            />
          </div>
          <div>
            <label style={{ fontWeight: 'bold' }}>Attach form(s) to send:</label>
            {workflowsLoading ? (
              <Box><Spinner size="normal" /> Loading forms…</Box>
            ) : workflowsError ? (
              <Box color="text-status-critical">{workflowsError}</Box>
            ) : workflowOptions.length === 0 ? (
              <Box color="text-body-secondary">No eligible forms (type “Form”) available.</Box>
            ) : (
              <Multiselect
                placeholder="Select form(s)…"
                inlineTokens
                tokenLimit={0}
                disableBrowserAutocorrect
                selectedOptions={workflowOptions
                  .filter(wf => selectedWorkflowIds.includes(wf.id))
                  .map(wf => ({
                    label: wf.name,
                    value: wf.id,
                    description: wf.type === 'consent-cm-prefill' ? 'Form (CM prefill)' : 'Form (No prefill)'
                  }))}
                options={workflowOptions.map(wf => ({
                  label: wf.name,
                  value: wf.id,
                  description: wf.type === 'consent-cm-prefill' ? 'Form (CM prefill)' : 'Form (No prefill)'
                }))}
                onChange={({ detail }) => {
                  setSelectedWorkflowIds(detail.selectedOptions.map(opt => opt.value));
                }}
                disabled={composeSending}
              />
            )}
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
            disabled={emptyDeleting}
          />
        </SpaceBetween>
      </Modal>
    </BoardItem>
  );
};

export default SecureMessagingWidget;

