import React, { useEffect, useState } from 'react';
import { Box, Header, ButtonDropdown, Link, Table, Spinner, TextFilter, RadioGroup, Tabs, Modal, Input, Textarea, SpaceBetween, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import SecureMessagesHelpPanelContent from '../helpPanelContents/secureMessagesHelpPanelContent';

const SecureMessagesWidget = ({ actions = {}, toggleHelpPanel, caseData }) => {
  const [messages, setMessages] = useState([]);
  const [evaluators, setEvaluators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [activeTabId, setActiveTabId] = useState('inbox');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState(null);
  const [composeUrgent, setComposeUrgent] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState(null);
  const [showHardDeleteModal, setShowHardDeleteModal] = useState(false);
  const [showEmptyDeletedModal, setShowEmptyDeletedModal] = useState(false);
  const [emptyConfirmText, setEmptyConfirmText] = useState("");
  const [emptyDeleting, setEmptyDeleting] = useState(false);

  const applicantUserId = caseData?.applicant_user_id;

  useEffect(() => {
    if (!applicantUserId) return;
    setLoading(true);
    setError(null);
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch messages');
        return res.json();
      })
      .then(data => {
        // Filter messages where sender_id or recipient_id matches applicantUserId
        setMessages(data.filter(m => m.sender_id === applicantUserId || m.recipient_id === applicantUserId));
      })
      .catch(() => setError('Failed to load messages'))
      .finally(() => setLoading(false));
  }, [applicantUserId]);

  // Fetch evaluators for sender name lookup
  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/intake-officers`)
      .then(res => res.json())
      .then(data => setEvaluators(data))
      .catch(() => setEvaluators([]));
  }, []);

  const handleInfoClick = () => {
    if (typeof toggleHelpPanel === 'function') {
      toggleHelpPanel(<SecureMessagesHelpPanelContent />, 'Secure Messages Help');
    }
  };

  const columns = [
    { id: 'created_at', header: 'Date/Time', cell: m => new Date(m.created_at).toLocaleString() },
    {
      id: 'subject',
      header: 'Subject',
      cell: m => (
        <span style={{
          display: 'inline-block',
          maxWidth: 180,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          verticalAlign: 'middle',
          color: '#0073bb',
          textDecoration: 'underline',
          cursor: 'pointer',
          fontWeight: m.status === 'unread' ? 'bold' : 'normal',
        }}>{m.subject}</span>
      ),
      minWidth: 120,
      maxWidth: 200,
      width: 180,
    },
    {
      id: 'body',
      header: 'Message',
      cell: m => (
        <span style={{
          display: 'inline-block',
          maxWidth: 250,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          verticalAlign: 'middle',
        }}>{m.body}</span>
      ),
      minWidth: 120,
      maxWidth: 300,
      width: 250,
    },
    { id: 'status', header: 'Status', cell: m => m.status },
    { id: 'urgent', header: 'Urgent', cell: m => m.urgent ? 'Yes' : 'No' },
  ];

  const getFilteredMessages = (tab) => {
    if (tab === 'inbox') {
      // Evaluator's view: applicant is sender (messages sent by applicant)
      return messages.filter(m => m.sender_id === applicantUserId && m.deleted !== 1);
    } else if (tab === 'sent') {
      // Evaluator's view: applicant is recipient (messages received by applicant)
      return messages.filter(m => m.recipient_id === applicantUserId && m.deleted !== 1);
    } else if (tab === 'deleted') {
      return messages.filter(m => m.deleted === 1 && (m.sender_id === applicantUserId || m.recipient_id === applicantUserId));
    }
    return [];
  };

  // Placeholder: resolve user name from user id (could be improved with user lookup)
  const getUserName = (userId) => {
    if (!userId) return '';
    if (messages.length === 0) return userId;
    // Try to find a message with this user as sender or recipient and use their name if available
    const msg = messages.find(m => m.sender_id === userId || m.recipient_id === userId);
    return msg?.sender_name || msg?.recipient_name || userId;
  };

  const handleRowClick = async (message) => {
    setSelectedMessage(message);
    setModalOpen(true);
    // Mark as read if it's an unread inbox message
    if (activeTabId === 'inbox' && message.status === 'unread') {
      try {
        await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages/${message.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'read' })
        });
        // Optimistically update local state
        setMessages(msgs => msgs.map(m => m.id === message.id ? { ...m, status: 'read' } : m));
      } catch (e) {
        // Ignore error, not critical for UI
      }
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedMessage(null);
  };

  // Open compose modal
  const handleNewMessage = () => {
    setComposeTo(caseData?.applicant_name || '');
    setComposeSubject('');
    setComposeBody('');
    setComposeError(null);
    setComposeModalOpen(true);
  };

  // Get current evaluator id and name (for From: field)
  const currentEvaluatorId = caseData?.assigned_to_user_id || '';
  const currentEvaluator = evaluators.find(e => e.evaluator_id === currentEvaluatorId);
  const currentEvaluatorName = currentEvaluator ? currentEvaluator.evaluator_name : '';

  // Send message (actual implementation)
  const handleSendMessage = async () => {
    setComposeSending(true);
    setComposeError(null);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: currentEvaluatorId,
          recipient_id: applicantUserId,
          subject: composeSubject,
          body: composeBody,
          urgent: composeUrgent,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send message');
      }
      // Refresh messages after sending
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages`)
        .then(res => res.json())
        .then(data => {
          setMessages(data.filter(m => m.sender_id === applicantUserId || m.recipient_id === applicantUserId));
        });
      setComposeModalOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setComposeUrgent(false);
    } catch (err) {
      setComposeError(err.message || 'Failed to send message');
    } finally {
      setComposeSending(false);
    }
  };

  // Refresh messages from the database
  const handleRefresh = () => {
    if (!applicantUserId) return;
    setLoading(true);
    setError(null);
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch messages');
        return res.json();
      })
      .then(data => {
        setMessages(data.filter(m => m.sender_id === applicantUserId || m.recipient_id === applicantUserId));
      })
      .catch(() => setError('Failed to load messages'))
      .finally(() => setLoading(false));
  };

  const tabContent = (tab) => (
    <React.Fragment>
      <TextFilter
        filteringText={filteringText}
        onChange={({ detail }) => setFilteringText(detail.filteringText)}
        placeholder="Search messages"
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <Box color="error">{error}</Box>
      ) : (
        <Table
          columnDefinitions={columns}
          items={getFilteredMessages(tab).filter(m => {
            if (!filteringText) return true;
            const text = filteringText.toLowerCase();
            return (
              m.subject?.toLowerCase().includes(text) ||
              m.body?.toLowerCase().includes(text) ||
              m.status?.toLowerCase().includes(text)
            );
          })}
          variant="embedded"
          stripedRows
          empty={<Box>No messages found.</Box>}
          onRowClick={({ detail }) => handleRowClick(detail.item)}
          selectionType={null}
        />
      )}
    </React.Fragment>
  );

  // Helper to get display names for modal
  const getModalNames = (msg) => {
    const applicantName = caseData?.applicant_name || 'Applicant';
    // Try to find evaluator name by sender_id
    const evaluator = evaluators.find(e => e.evaluator_id === msg.sender_id);
    const evaluatorName = evaluator ? evaluator.evaluator_name : (msg.sender_name || 'Evaluator');
    if (activeTabId === 'inbox') {
      // Evaluator's view: applicant is sender
      return { from: applicantName, to: evaluatorName };
    } else if (activeTabId === 'sent') {
      // Evaluator's view: applicant is recipient
      // If sender is applicant, show applicant name; else show evaluator name
      if (msg.sender_id === applicantUserId) {
        return { from: applicantName, to: applicantName };
      } else {
        return { from: evaluatorName, to: applicantName };
      }
    } else if (activeTabId === 'deleted') {
      // Infer direction: if sender is applicant, it's sent; else inbox
      if (msg.sender_id === applicantUserId) {
        return { from: applicantName, to: evaluatorName };
      } else {
        return { from: evaluatorName, to: applicantName };
      }
    }
    return { from: '', to: '' };
  };

  // Reply to a message
  const handleReply = async () => {
    if (!selectedMessage) return;
    // Set status to 'replied' on reply
    try {
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages/${selectedMessage.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'replied' })
      });
      setMessages(msgs => msgs.map(m => m.id === selectedMessage.id ? { ...m, status: 'replied' } : m));
    } catch (e) {}
    // Determine To/From for reply
    // If the current evaluator is the recipient, reply goes to the sender (applicant), else to the evaluator
    let replyTo = '';
    let replyToId = '';
    let replyFrom = '';
    let replyFromId = '';
    if (selectedMessage.sender_id === applicantUserId) {
      replyTo = caseData?.applicant_name || '';
      replyToId = applicantUserId;
      replyFrom = currentEvaluatorName;
      replyFromId = currentEvaluatorId;
    } else {
      const senderEval = evaluators.find(e => e.evaluator_id === selectedMessage.sender_id);
      replyTo = senderEval ? senderEval.evaluator_name : '';
      replyToId = selectedMessage.sender_id;
      replyFrom = caseData?.applicant_name || '';
      replyFromId = applicantUserId;
    }
    let replySubject = selectedMessage.subject || '';
    if (!/^Re:/i.test(replySubject)) {
      replySubject = `Re: ${replySubject}`;
    }
    const quotedBody = selectedMessage.body
      ? selectedMessage.body.split('\n').map(line => `> ${line}`).join('\n')
      : '';
    const replyBody = `\n\n${quotedBody}`;
    setComposeTo(replyTo);
    setComposeSubject(replySubject);
    setComposeBody(replyBody);
    setComposeUrgent(false);
    setComposeError(null);
    setComposeModalOpen(true);
  };

  useEffect(() => {
    if (modalOpen && selectedMessage && selectedMessage.id && caseData?.id) {
      setAttachmentsLoading(true);
      setAttachmentsError(null);
      fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages/${selectedMessage.id}/attachments?case_id=${caseData.id}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch attachments');
          return res.json();
        })
        .then(data => setAttachments(data))
        .catch(() => setAttachmentsError('Failed to load attachments'))
        .finally(() => setAttachmentsLoading(false));
    } else {
      setAttachments([]);
      setAttachmentsError(null);
      setAttachmentsLoading(false);
    }
  }, [selectedMessage, modalOpen, caseData?.id]);

  // Delete a message
  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    if (selectedMessage.status === 'archived') {
      // Show confirmation modal for hard delete
      setShowHardDeleteModal(true);
      return;
    }
    try {
      // Set status to 'archived' before soft delete
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages/${selectedMessage.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      });
      setMessages(msgs => msgs.map(m => m.id === selectedMessage.id ? { ...m, status: 'archived' } : m));
    } catch (e) {}
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages/${selectedMessage.id}/delete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to delete message');
      }
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages`)
        .then(res => res.json())
        .then(data => {
          setMessages(data.filter(m => m.sender_id === applicantUserId || m.recipient_id === applicantUserId));
        });
      setModalOpen(false);
      setSelectedMessage(null);
    } catch (err) {
      setError('Failed to delete message');
    }
  };

  // Hard delete handler
  const handleHardDelete = async () => {
    if (!selectedMessage) return;
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages/${selectedMessage.id}/hard-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to hard delete message');
      }
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages`)
        .then(res => res.json())
        .then(data => {
          setMessages(data.filter(m => m.sender_id === applicantUserId || m.recipient_id === applicantUserId));
        });
      setShowHardDeleteModal(false);
      setModalOpen(false);
      setSelectedMessage(null);
    } catch (err) {
      setError('Failed to hard delete message');
      setShowHardDeleteModal(false);
    }
  };

  // Handler for Empty Items action
  const handleEmptyDeleted = () => {
    setShowEmptyDeletedModal(true);
    setEmptyConfirmText("");
  };

  // Handler to actually perform empty deleted
  const handleConfirmEmptyDeleted = async () => {
    setEmptyDeleting(true);
    try {
      // Get all deleted message IDs
      const deletedIds = getFilteredMessages('deleted').map(m => m.id);
      // Call hard delete endpoint for each
      await Promise.all(
        deletedIds.map(id =>
          fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages/${id}/hard-delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );
      // Refresh messages
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/admin/messages`)
        .then(res => res.json())
        .then(data => {
          setMessages(data.filter(m => m.sender_id === applicantUserId || m.recipient_id === applicantUserId));
        });
      setShowEmptyDeletedModal(false);
      setEmptyConfirmText("");
    } catch (err) {
      setError('Failed to empty deleted messages');
    } finally {
      setEmptyDeleting(false);
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          actions={
            <>
              <Button
                variant="icon"
                iconName="refresh"
                ariaLabel="Refresh messages"
                onClick={handleRefresh}
                disabled={loading}
              />
              <Button
                variant="primary"
                onClick={handleNewMessage}
              >
                New Message
              </Button>
            </>
          }
          info={
            <Link
              variant="info"
              onFollow={handleInfoClick}
            >
              Info
            </Link>
          }
        >
          Secure Messages
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
          onItemClick={() => actions.removeItem && actions.removeItem()}
        />
      }
    >
      <Box>
        <Tabs
          activeTabId={activeTabId}
          onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          tabs={[
            {
              label: 'Inbox',
              id: 'inbox',
              content: tabContent('inbox'),
              action: (
                <ButtonDropdown
                  variant="icon"
                  ariaLabel="Inbox actions"
                  items={[{ id: 'deleteAll', text: 'Delete All' }]}
                  expandToViewport={true}
                  onItemClick={() => { /* Placeholder for Delete All */ }}
                />
              ),
            },
            {
              label: 'Sent',
              id: 'sent',
              content: tabContent('sent'),
              action: (
                <ButtonDropdown
                  variant="icon"
                  ariaLabel="Sent actions"
                  items={[{ id: 'deleteAll', text: 'Delete All' }]}
                  expandToViewport={true}
                  onItemClick={() => { /* Placeholder for Delete All */ }}
                />
              ),
            },
            {
              label: 'Deleted',
              id: 'deleted',
              content: tabContent('deleted'),
              action: (
                <ButtonDropdown
                  variant="icon"
                  ariaLabel="Deleted actions"
                  items={[{ id: 'empty', text: 'Empty Items' }]}
                  expandToViewport={true}
                  onItemClick={handleEmptyDeleted}
                />
              ),
            },
          ]}
        />
        <Modal
          visible={modalOpen}
          onDismiss={handleCloseModal}
          header="Message Details"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={handleReply}>Reply</Button>
              {activeTabId === 'sent' && selectedMessage?.status === 'unread' ? (
                <Button variant="normal" onClick={handleDeleteMessage}>Recall</Button>
              ) : (
                <Button variant="normal" onClick={handleDeleteMessage}>Delete</Button>
              )}
              <Button variant="normal" onClick={handleCloseModal}>Close</Button>
            </SpaceBetween>
          }
        >
          {selectedMessage && (() => {
            const { from, to } = getModalNames(selectedMessage);
            return (
              <SpaceBetween size="s">
                <div>
                  <label style={{ fontWeight: 'bold' }}>From:</label>
                  <Input readOnly value={from} />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold' }}>To:</label>
                  <Input readOnly value={to} />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold' }}>Sent:</label>
                  <Input readOnly value={new Date(selectedMessage.created_at).toLocaleString()} />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold' }}>Subject:</label>
                  <Input readOnly value={selectedMessage.subject} />
                </div>
                <div>
                  <label style={{ fontWeight: 'bold' }}>Message:</label>
                  <Textarea readOnly value={selectedMessage.body} rows={6} />
                </div>
                {attachmentsLoading && <Spinner />}
                {attachmentsError && <Box color="error">{attachmentsError}</Box>}
                {attachments.length > 0 && (
                  <div>
                    <label style={{ fontWeight: 'bold' }}>Attachments:</label>
                    <ul style={{ paddingLeft: 20 }}>
                      {attachments.map(att => (
                        <li key={att.id} style={{ marginBottom: 4 }}>
                          <a
                            href={`${process.env.REACT_APP_API_BASE_URL.replace(/\/$/, '')}${att.file_path.startsWith('/') ? '' : '/'}${att.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {att.original_filename}
                          </a>
                          {att.uploaded_at && (
                            <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>
                              ({new Date(att.uploaded_at).toLocaleString()})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </SpaceBetween>
            );
          })()}
        </Modal>
        <Modal
          visible={composeModalOpen}
          onDismiss={() => setComposeModalOpen(false)}
          header="New Message"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                loading={composeSending}
                onClick={handleSendMessage}
                disabled={!composeTo || !composeSubject || !composeBody}
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
                value={composeTo}
                readOnly
                placeholder="Applicant name"
                disabled={composeSending}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold' }}>From:</label>
              <Input
                value={currentEvaluatorName}
                readOnly
                placeholder="Evaluator name"
                disabled
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold' }}>Subject:</label>
              <Input
                value={composeSubject}
                onChange={({ detail }) => setComposeSubject(detail.value)}
                placeholder="Enter subject"
                disabled={composeSending}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold' }}>Message:</label>
              <Textarea
                value={composeBody}
                onChange={({ detail }) => setComposeBody(detail.value)}
                rows={6}
                placeholder="Type your message here..."
                disabled={composeSending}
              />
            </div>
            <div>
              <label style={{ fontWeight: 'bold' }}>Urgent:</label>
              <input
                type="checkbox"
                checked={!!composeUrgent}
                onChange={e => setComposeUrgent(e.target.checked)}
                disabled={composeSending}
                style={{ marginLeft: 8 }}
              />
            </div>
            {composeError && <Box color="error">{composeError}</Box>}
          </SpaceBetween>
        </Modal>
        <Modal
          visible={showHardDeleteModal}
          onDismiss={() => setShowHardDeleteModal(false)}
          header="Permanently Delete Message?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={handleHardDelete}>Delete Permanently</Button>
              <Button variant="normal" onClick={() => setShowHardDeleteModal(false)}>Cancel</Button>
            </SpaceBetween>
          }
        >
          <Box color="error">
            This will permanently delete the message and all its attachments. This action cannot be undone.<br />
            <b>Attachments that have been added to supporting documents will not be removed by this action.</b> Are you sure?
          </Box>
        </Modal>
        <Modal
          visible={showEmptyDeletedModal}
          onDismiss={() => setShowEmptyDeletedModal(false)}
          header="Permanently Delete All Deleted Messages?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                disabled={emptyConfirmText.trim().toLowerCase() !== 'delete' || emptyDeleting}
                loading={emptyDeleting}
                onClick={handleConfirmEmptyDeleted}
              >
                Delete All Permanently
              </Button>
              <Button variant="normal" onClick={() => setShowEmptyDeletedModal(false)} disabled={emptyDeleting}>Cancel</Button>
            </SpaceBetween>
          }
        >
          <Box color="error" margin={{ bottom: 's' }}>
            This will permanently delete all messages in the Deleted tab, including all their attachments. This action cannot be undone.<br />
            <b>Attachments that have been added to supporting documents will not be removed by this action.</b><br />
            To confirm, type <b>delete</b> in the box below.
          </Box>
          <Input
            value={emptyConfirmText}
            onChange={({ detail }) => setEmptyConfirmText(detail.value)}
            placeholder="Type 'delete' to confirm"
            disabled={emptyDeleting}
            autoFocus
          />
        </Modal>
      </Box>
    </BoardItem>
  );
};

export default SecureMessagesWidget;
