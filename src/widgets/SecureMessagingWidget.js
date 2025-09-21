import React, { useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, SpaceBetween, Box, Alert, FormField, Input, Textarea, Button, Checkbox } from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';

const SecureMessagingWidget = ({ actions, caseData }) => {
  const caseId = caseData?.id;
  const applicantUserId = caseData?.applicant_user_id || null;
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const canSend = subject.trim() && body.trim();

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/cases/${caseId}/messages`);
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [caseId]);

  const onSend = async () => {
    if (!canSend || !caseId) return;
    try {
      const res = await apiFetch(`/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), urgent })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'Failed to send message');
      }
      setSubject('');
      setBody('');
      setUrgent(false);
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to send message');
    }
  };

  const renderMessage = (m) => {
    const fromApplicant = applicantUserId && m.sender_id === applicantUserId;
    const who = fromApplicant ? 'Applicant' : 'Staff';
    const ts = m.created_at ? new Date(m.created_at).toLocaleString() : '';
    return (
      <Box key={m.id} padding={{ vertical: 'xs' }}>
        <Box fontWeight="bold">{who} • {ts}</Box>
        {m.subject ? <Box color="text-body-secondary">{m.subject}</Box> : null}
        <Box whiteSpace="pre-wrap">{m.body}</Box>
      </Box>
    );
  };

  return (
    <BoardItem
      header={<Header variant="h2">Secure Messaging</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        actions && actions.removeItem && (
          <Button ariaLabel="Remove" variant="icon" onClick={() => actions.removeItem()}>×</Button>
        )
      }
    >
      <SpaceBetween size="s">
        <Box color="text-body-secondary">
          Send and view secure messages with the applicant for this case.
        </Box>
        {error && (
          <Alert type="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Box>
          {loading ? 'Loading messages…' : (items.length === 0 ? (
            <Box color="text-body-secondary">No messages yet.</Box>
          ) : (
            <SpaceBetween size="s">
              {items.map(renderMessage)}
            </SpaceBetween>
          ))}
        </Box>
        <SpaceBetween size="s">
          <FormField label="Subject">
            <Input value={subject} onChange={({ detail }) => setSubject(detail.value)} placeholder="Subject" />
          </FormField>
          <FormField label="Message">
            <Textarea value={body} onChange={({ detail }) => setBody(detail.value)} rows={4} placeholder="Write your message" />
          </FormField>
          <Checkbox checked={urgent} onChange={({ detail }) => setUrgent(detail.checked)}>
            Mark as urgent
          </Checkbox>
          <Box>
            <Button variant={canSend ? 'primary' : 'normal'} disabled={!canSend} onClick={onSend}>Send</Button>
          </Box>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default SecureMessagingWidget;

