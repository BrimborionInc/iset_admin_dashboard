import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, FormField, Input, Multiselect, SpaceBetween, Textarea } from '@cloudscape-design/components';
import { apiFetch } from '../../auth/apiClient';
import { getRoleDisplayName } from '../../utils/roleDisplay';
import { useMessaging } from './MessagingContext';

const formatDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const PinnedMessagePanel = () => {
  const { pinnedMessage, composeMode, startNewMessage, startReply, startReplyAll, cancelCompose, unpinMessage } = useMessaging();

  const [subjectValue, setSubjectValue] = useState('');
  const [bodyValue, setBodyValue] = useState('');
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [staffStatus, setStaffStatus] = useState('pending');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const isComposing = !!composeMode;
  const isReply = composeMode === 'reply';

  const pinnedMeta = useMemo(() => {
    if (!pinnedMessage) return null;
    return {
      subject: pinnedMessage.subject || '(No subject)',
      body: pinnedMessage.body || pinnedMessage.preview || '',
      sender: pinnedMessage.sender || null,
      recipients: Array.isArray(pinnedMessage.recipients) ? pinnedMessage.recipients : [],
      participants: Array.isArray(pinnedMessage.participants) ? pinnedMessage.participants : [],
      ownerId: pinnedMessage.ownerStaffProfileId || pinnedMessage.owner_staff_profile_id || null,
      folder: pinnedMessage.folder || null,
      deletedFrom: pinnedMessage.deletedFrom || pinnedMessage.deleted_from || null,
      receivedAt: pinnedMessage.receivedAt || pinnedMessage.created_at || pinnedMessage.timestamp || null,
    };
  }, [pinnedMessage]);

  const formatRoleDescription = useCallback((profile) => {
    if (!profile) return '';
    const rawRole = profile.primaryRole || profile.primary_role || '';
    if (!rawRole) return '';
    const displayRole = getRoleDisplayName(rawRole);
    const shouldShowRegion = displayRole === 'ISET Coordinator' || displayRole === 'Regional Manager';
    const roleLabel = shouldShowRegion ? displayRole : rawRole;
    const regionCode = profile.regionCode || profile.region_code || null;
    if (shouldShowRegion && regionCode) {
      const trimmedRegion = String(regionCode).trim();
      if (trimmedRegion) {
        return `${roleLabel} (${trimmedRegion.toUpperCase()})`;
      }
    }
    return roleLabel;
  }, []);

  const profileToOption = useCallback((profile) => {
    if (!profile) return null;
    const id = profile.staffProfileId || profile.staff_profile_id || profile.id;
    if (!id) return null;
    const label = profile.displayName || profile.display_name || profile.email || `Staff #${id}`;
    const desc = formatRoleDescription(profile) || profile.primaryRole || profile.primary_role || '';
    const rawRole = profile.primaryRole || profile.primary_role || '';
    return {
      value: String(id),
      label,
      description: desc || undefined,
      filteringTags: [profile.email, desc, rawRole].filter(Boolean),
    };
  }, [formatRoleDescription]);

  const loadStaffOptions = useCallback(async (filteringText = '') => {
    setStaffStatus('loading');
    try {
      const params = new URLSearchParams();
      if (filteringText) params.set('q', filteringText);
      const resp = await apiFetch(`/api/me/staff-profiles?${params.toString()}`);
      if (!resp.ok) {
        throw new Error('Failed to load staff');
      }
      const json = await resp.json();
      const options = (json?.items || []).map(profileToOption).filter(Boolean);
      setRecipientOptions(options);
      setStaffStatus('finished');
    } catch (err) {
      setStaffStatus('error');
    }
  }, [profileToOption]);

  useEffect(() => {
    loadStaffOptions('');
  }, [loadStaffOptions]);

  useEffect(() => {
    if (!isComposing) return;
    setSendError(null);
    if (composeMode === 'new') {
      setSelectedRecipients([]);
      setSubjectValue('');
      setBodyValue('');
      return;
    }
    if ((composeMode === 'reply' || composeMode === 'replyAll') && pinnedMeta) {
      const baseSubject = pinnedMeta.subject || '';
      setSubjectValue(baseSubject.toLowerCase().startsWith('re:') ? baseSubject : `Re: ${baseSubject}`);
      setBodyValue('');

      const fromProfile = pinnedMeta.sender || null;
      const participants = pinnedMeta.participants || [];
      const ownerId = Number(pinnedMeta.ownerId);

      if (composeMode === 'replyAll') {
        const targets = participants
          .filter(p => {
            const pid = Number(p.staffProfileId || p.staff_profile_id || p.id);
            return Number.isFinite(pid) && pid !== ownerId;
          })
          .map(profileToOption)
          .filter(Boolean);
        setSelectedRecipients(targets);
      } else if (composeMode === 'reply') {
        const target = profileToOption(fromProfile);
        setSelectedRecipients(target ? [target] : []);
      }
      return;
    }
  }, [composeMode, isComposing, pinnedMeta, profileToOption]);

  const handleSend = useCallback(async () => {
    if (!bodyValue.trim()) {
      setSendError('Message body is required.');
      return;
    }
    if (composeMode === 'new' && !subjectValue.trim()) {
      setSendError('Subject is required.');
      return;
    }
    if (composeMode === 'new' && !selectedRecipients.length) {
      setSendError('Choose at least one recipient.');
      return;
    }
    setSendError(null);
    setSending(true);
    try {
      const payload = {
        subject: subjectValue,
        body: bodyValue,
        toStaffProfileIds: selectedRecipients.map(opt => Number(opt.value)),
      };
      if (composeMode !== 'new' && pinnedMessage?.threadId) {
        payload.threadId = pinnedMessage.threadId;
      }
      const resp = await apiFetch('/api/me/staff-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || 'Failed to send message');
      }
      try { window.dispatchEvent(new CustomEvent('staff-messages:refresh')); } catch {}
      cancelCompose();
      unpinMessage();
    } catch (err) {
      setSendError(err?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [bodyValue, cancelCompose, composeMode, pinnedMessage?.threadId, selectedRecipients, subjectValue, unpinMessage]);

  if (isComposing) {
    return (
      <SpaceBetween size="s">
        <Box variant="p">{isReply ? 'Reply to the selected message.' : 'Compose a new secure message.'}</Box>
        <form>
          <SpaceBetween size="s">
            <FormField
              label="To"
              errorText={sendError && !selectedRecipients.length && composeMode === 'new' ? sendError : undefined}
              description="Select one or more staff recipients."
            >
              <Multiselect
                filteringType="manual"
                statusType={staffStatus}
                onLoadItems={({ detail }) => loadStaffOptions(detail.filteringText || '')}
                selectedOptions={selectedRecipients}
                onChange={({ detail }) => setSelectedRecipients(detail.selectedOptions)}
                options={recipientOptions}
                placeholder="Choose recipients"
                selectedAriaLabel="Selected"
                tokenLimit={4}
                keepOpen={false}
              />
            </FormField>
            <FormField label="Subject">
              <Input value={subjectValue} onChange={({ detail }) => setSubjectValue(detail.value)} placeholder="Subject" />
            </FormField>
            <FormField label="Message">
              <Textarea
                value={bodyValue}
                onChange={({ detail }) => setBodyValue(detail.value)}
                placeholder="Type a message…"
                rows={6}
              />
            </FormField>
            {sendError && (
              <Box color="text-status-error" fontSize="body-s">
                {sendError}
              </Box>
            )}
            <SpaceBetween size="xs" direction="horizontal">
              <Button variant="primary" disabled={sending} onClick={handleSend}>
                Send
              </Button>
              <Button onClick={cancelCompose}>Cancel</Button>
            </SpaceBetween>
          </SpaceBetween>
        </form>
      </SpaceBetween>
    );
  }

  if (!pinnedMessage || !pinnedMeta) {
    return (
      <SpaceBetween size="s">
        <Box variant="p">Start a new secure message to staff.</Box>
        <Button variant="primary" onClick={startNewMessage}>New message</Button>
      </SpaceBetween>
    );
  }

  return (
    <SpaceBetween size="s">
      <Box fontWeight="bold">{pinnedMeta.subject}</Box>
      <Box variant="small" color="text-body-secondary">
        From {pinnedMeta.sender?.displayName || pinnedMeta.sender?.email || 'Unknown sender'}
        {pinnedMeta.receivedAt ? ` • ${formatDateTime(pinnedMeta.receivedAt)}` : ''}
      </Box>
      <Box variant="p">{pinnedMeta.body || '—'}</Box>
      <SpaceBetween size="xs" direction="horizontal">
        <Button variant="primary" onClick={startReply}>Reply</Button>
        <Button onClick={startReplyAll}>Reply all</Button>
        <Button onClick={unpinMessage}>Unpin</Button>
      </SpaceBetween>
    </SpaceBetween>
  );
};

export default PinnedMessagePanel;
