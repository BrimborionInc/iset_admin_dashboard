import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Box,
  ButtonDropdown,
  SpaceBetween,
  Button,
  Container,
  Spinner,
  Alert,
  Modal,
  FormField,
  Textarea,
  Badge,
  Link,
  DatePicker,
  Hotspot
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';
import CaseNotesHelp from '../helpPanelContents/caseNotesHelp';
import { useCaseWorkspace } from '../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx';
import { formatReminderBusinessDate, getReminderBusinessDayDiffDays } from '../lib/reminderBusinessDay';

const NOTE_LENGTH_LIMIT = 5000;

const formatTimestamp = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString();
};

const sanitize = (value) => (typeof value === 'string' ? value : '');

const toTime = (value) => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const toDatePickerValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const toIsoUtcFromDateInput = (value) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\//g, '-');
  const parts = normalized.split('-');
  if (parts.length !== 3) return null;
  const [yearStr, monthStr, dayStr] = parts;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  // Use midday UTC so timezone offsets don't shift the calendar day
  const utcMs = Date.UTC(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(utcMs)) return null;
  return new Date(utcMs).toISOString();
};

const formatFollowUpDate = (value) => {
  const label = formatReminderBusinessDate(value);
  return label || null;
};

const classifyFollowUpStatus = (value) => {
  if (!value) return null;
  const diffDays = getReminderBusinessDayDiffDays(value, new Date());
  if (diffDays === null) return null;
  if (diffDays > 0) {
    return { color: 'red', label: 'Overdue follow-up' };
  }
  if (diffDays === 0) {
    return { color: 'green', label: 'Follow-up today' };
  }
  if (diffDays >= -7) {
    return { color: 'yellow', label: 'Follow-up due soon' };
  }
  return { color: 'blue', label: 'Scheduled follow-up' };
};

const sortNotesByPinned = (list = []) =>
  [...list].sort((a, b) => {
    const pinnedDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
    if (pinnedDiff !== 0) return pinnedDiff;
    return toTime(b.createdAt) - toTime(a.createdAt);
  });

const getErrorMessage = async (err, fallback) => {
  if (!err) return fallback;
  if (typeof err.json === 'function') {
    try {
      const body = await err.json();
      return body?.error || body?.message || fallback;
    } catch (_) {
      // ignore parse errors
    }
  }
  if (err.message) return err.message;
  return fallback;
};

const CaseNotesWidget = ({ actions, caseData: propCaseData, toggleHelpPanel }) => {
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
  const caseId = rawCaseId == null || rawCaseId === '' ? null : rawCaseId;
  const caseIdentifier =
    caseData?.tracking_id ??
    caseData?.trackingId ??
    workspaceCaseData?.tracking_id ??
    workspaceCaseData?.trackingId ??
    workspace?.tracking_id ??
    workspace?.trackingId ??
    (caseId ? `#${caseId}` : null);

  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [draftText, setDraftText] = useState('');
  const [draftFollowUpDate, setDraftFollowUpDate] = useState('');
  const [draftError, setDraftError] = useState(null);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [pendingAcknowledgeId, setPendingAcknowledgeId] = useState(null);

  const canMutate = Boolean(caseId);

  const resetModalState = () => {
    setDraftText('');
    setDraftFollowUpDate('');
    setDraftError(null);
    setActiveNoteId(null);
    setIsSaving(false);
  };

  const openCreateModal = () => {
    if (!canMutate) return;
    setModalMode('create');
    resetModalState();
    setIsModalOpen(true);
  };

  const openEditModal = (note) => {
    if (!canMutate || !note) return;
    setModalMode('edit');
    setDraftText(note.body || '');
    setDraftFollowUpDate(toDatePickerValue(note.followUpAt));
    setDraftError(null);
    setActiveNoteId(note.id || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetModalState();
  };

  const loadNotes = useCallback(
    async ({ silent = false } = {}) => {
      if (!caseId) {
        setNotes([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const res = await apiFetch(`/api/cases/${caseId}/notes`);
        if (!res.ok) throw res;
        const data = await res.json();
        const normalized = Array.isArray(data) ? sortNotesByPinned(data) : [];
        setNotes(normalized);
        setExpandedIds(new Set());
      } catch (err) {
        const message = await getErrorMessage(err, 'Failed to load case notes.');
        setError(message);
        if (!silent) setNotes([]);
      } finally {
        if (silent) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [caseId]
  );

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    const handler = event => {
      const targetCaseId = event?.detail?.caseId;
      if (!caseId) return;
      if (targetCaseId && Number(targetCaseId) !== Number(caseId)) return;
      loadNotes({ silent: true });
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('case-notes-refresh', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('case-notes-refresh', handler);
      }
    };
  }, [caseId, loadNotes]);

  const handleRefresh = () => {
    if (!caseId || isLoading) return;
    loadNotes({ silent: true });
  };

  const toggleExpanded = (noteId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const [deletePrompt, setDeletePrompt] = useState({ open: false, noteId: null });

  const handleDelete = async (noteId) => {
    if (!noteId || !caseId) return;
    setDeletePrompt({ open: true, noteId });
  };

  const confirmDelete = async () => {
    const noteId = deletePrompt.noteId;
    if (!noteId || !caseId) {
      setDeletePrompt({ open: false, noteId: null });
      return;
    }
    setPendingDeleteId(noteId);
    setDeletePrompt({ open: false, noteId: null });
    setError(null);
    try {
      const res = await apiFetch(`/api/cases/${caseId}/notes/${noteId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw res;
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('case-reminders-refresh', { detail: { caseId } }));
        window.dispatchEvent(new CustomEvent('case-events-refresh', { detail: { caseId } }));
      }
    } catch (err) {
      const message = await getErrorMessage(err, 'Failed to delete note.');
      setError(message);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleAcknowledgeReminder = async (note) => {
    if (!note?.reminderId || !caseId) return;
    setPendingAcknowledgeId(note.id);
    setError(null);
    try {
      const res = await apiFetch(`/api/reminders/${note.reminderId}/acknowledge`, { method: 'POST' });
      if (!res.ok) throw res;
      await loadNotes({ silent: true });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('case-reminders-refresh', { detail: { caseId } }));
        window.dispatchEvent(new CustomEvent('case-events-refresh', { detail: { caseId } }));
        window.dispatchEvent(new CustomEvent('case-notes-refresh', { detail: { caseId } }));
      }
    } catch (err) {
      const message = await getErrorMessage(err, 'Failed to acknowledge reminder.');
      setError(message);
    } finally {
      setPendingAcknowledgeId(null);
    }
  };

  const handleSave = async () => {
    if (!caseId) {
      setDraftError('Case details are not available.');
      return;
    }
    const trimmed = sanitize(draftText).trim();
    if (!trimmed) {
      setDraftError('Please enter a note.');
      return;
    }
    if (trimmed.length > NOTE_LENGTH_LIMIT) {
      setDraftError(`Notes are limited to ${NOTE_LENGTH_LIMIT} characters.`);
      return;
    }
    setIsSaving(true);
    setDraftError(null);
    try {
      const followUpAtPayload = toIsoUtcFromDateInput(draftFollowUpDate);
      const requestBody = { body: trimmed };
      if (followUpAtPayload) {
        requestBody.followUpAt = followUpAtPayload;
      } else if (modalMode === 'edit') {
        requestBody.followUpAt = null;
      }
      let res;
      if (modalMode === 'edit' && activeNoteId) {
        res = await apiFetch(`/api/cases/${caseId}/notes/${activeNoteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
      } else {
        res = await apiFetch(`/api/cases/${caseId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
      }
      if (!res.ok) throw res;
      const payload = await res.json();
      setNotes((prev) =>
        sortNotesByPinned([
          ...prev.filter((note) => note.id !== payload.id),
          payload
        ])
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('case-reminders-refresh', { detail: { caseId } }));
        window.dispatchEvent(new CustomEvent('case-events-refresh', { detail: { caseId } }));
      }
      closeModal();
    } catch (err) {
      const message = await getErrorMessage(err, 'Failed to save note.');
      setDraftError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderNoteHeader = (note, { authorName, authorRole, timestamp, editedLabel }) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px' }}>
        <Box fontWeight="bold">{authorName}</Box>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {authorRole ? <Badge color="blue">{authorRole}</Badge> : null}
          {note.isPinned ? <Badge color="orange">Pinned</Badge> : null}
        </div>
      </div>
      <Box color="text-body-secondary" variant="small">
        {timestamp}
        {editedLabel}
      </Box>
    </div>
  );

  const renderNoteBody = (note) => {
    const text = sanitize(note.body);
    const showFull = expandedIds.has(note.id);
    const limit = 420;
    const displayDate = formatFollowUpDate(note.followUpAt);
  const followUpStatus = classifyFollowUpStatus(note.followUpAt);
    const canAcknowledgeReminder = note.followUpAt && note.reminderId;

    const textContent =
      text.length <= limit ? (
        <Box>{text}</Box>
      ) : (
        <SpaceBetween size="xxs">
          <Box>{showFull ? text : `${text.slice(0, limit)}...`}</Box>
          <Button variant="inline-link" onClick={() => toggleExpanded(note.id)}>
            {showFull ? 'Show less' : 'Show more'}
          </Button>
        </SpaceBetween>
      );

    const followUpSummary = displayDate ? (
      <div
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--color-border-container-divider, #d5dbdb)',
          backgroundColor: 'var(--color-background-container-content, #f8f8f8)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center'
        }}
      >
        <Box fontWeight="bold">Follow-up</Box>
        {followUpStatus ? <Badge color={followUpStatus.color}>{followUpStatus.label}</Badge> : null}
        <Box color="text-body-secondary">Due {displayDate}</Box>
        {canAcknowledgeReminder ? (
          <Button
            size="small"
            onClick={() => handleAcknowledgeReminder(note)}
            loading={pendingAcknowledgeId === note.id}
          >
            Acknowledge reminder
          </Button>
        ) : null}
      </div>
    ) : null;

    return (
      <SpaceBetween size="s">
        {followUpSummary}
        {textContent}
      </SpaceBetween>
    );
  };

  const emptyStateMessage = !caseId
    ? 'Case details are still loading. Notes will appear once the case data is available.'
    : 'No notes yet. Use New note to start the record.';

  return (
    <>
      <Modal
        visible={deletePrompt.open}
        header="Delete note"
        onDismiss={() => setDeletePrompt({ open: false, noteId: null })}
        closeAriaLabel="Close delete note confirmation"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => setDeletePrompt({ open: false, noteId: null })}>Cancel</Button>
            <Button variant="primary" loading={pendingDeleteId === deletePrompt.noteId} onClick={confirmDelete}>
              Delete
            </Button>
          </SpaceBetween>
        }
      >
        <Box>Delete this note? This action cannot be undone.</Box>
      </Modal>
      <BoardItem
        header={
          <Header
            variant="h2"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="add-plus" onClick={openCreateModal} disabled={!canMutate || isLoading || isRefreshing}>
                  New note
                </Button>
                <Button
                  variant="icon"
                  iconName="refresh"
                  ariaLabel="Refresh notes"
                  onClick={handleRefresh}
                  disabled={!canMutate || isLoading || isRefreshing}
                />
              </SpaceBetween>
            }
            info={
              toggleHelpPanel ? (
                <Link
                  variant="info"
                  onFollow={() =>
                  toggleHelpPanel(
                    <CaseNotesHelp />,
                    'Notes and Reminders Help',
                    CaseNotesHelp.aiContext
                  )
                }
              >
                Info
              </Link>
            ) : undefined
          }
        >
          <Hotspot hotspotId="app-workspace-notes-tasks" direction="right" />
          Notes and Reminders
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
              ariaLabel="Board item settings"
              variant="icon"
              onItemClick={() => actions.removeItem()}
            />
          ) : null
        }
      >
        <SpaceBetween size="m">
          <Box variant="small" color="text-body-secondary">
            Keep internal updates for this case together. Notes are visible to staff members only.
            {caseIdentifier ? ` Currently viewing case ${caseIdentifier}.` : ''}
          </Box>
          {isLoading ? (
            <Box textAlign="center" padding="m">
              <Spinner />
              <Box>Loading case notes...</Box>
            </Box>
          ) : error ? (
            <Alert type="error" header="Unable to load notes">
              {error}
            </Alert>
          ) : notes.length === 0 ? (
            <Box color="text-body-secondary">{emptyStateMessage}</Box>
          ) : (
            <SpaceBetween size="s">
              {notes.map((note) => {
                const author = note.author || {};
                const authorName =
                  author.displayName || author.name || author.email || 'Unknown';
                const authorRole = author.role || null;
                const timestamp = formatTimestamp(note.editedAt || note.updatedAt || note.createdAt);
                const editedLabel = note.editedAt ? ' (edited)' : '';
                return (
                  <Container
                    key={note.id}
                    header={renderNoteHeader(note, { authorName, authorRole, timestamp, editedLabel })}
                    footer={
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button
                          variant="inline-link"
                          onClick={() => openEditModal(note)}
                          disabled={!canMutate}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="inline-link"
                          onClick={() => handleDelete(note.id)}
                          disabled={!canMutate || pendingDeleteId === note.id}
                          loading={pendingDeleteId === note.id}
                        >
                          Delete
                        </Button>
                      </SpaceBetween>
                    }
                  >
                    {renderNoteBody(note)}
                  </Container>
                );
              })}
            </SpaceBetween>
          )}
        </SpaceBetween>
      </BoardItem>

      <Modal
        onDismiss={closeModal}
        visible={isModalOpen}
        closeAriaLabel="Close case note form"
        header={modalMode === 'edit' ? 'Edit note' : 'Add note'}
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={closeModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={isSaving}>
              Save note
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="m">
          <FormField
            label="Follow-up date"
            description="Optional. Setting a follow-up date will create a reminder for this case."
          >
            <DatePicker
              value={draftFollowUpDate}
              onChange={({ detail }) => setDraftFollowUpDate(detail.value)}
              placeholder="YYYY-MM-DD"
              isClearable
            />
          </FormField>
          <FormField
            label="Note"
            errorText={draftError}
            constraintText={`Share context that will help other staff follow the case. (${NOTE_LENGTH_LIMIT} character limit).`}
          >
            <Textarea
              value={draftText}
              autosize
              onChange={({ detail }) => setDraftText(detail.value)}
              placeholder="Add internal details, next steps, or reminders for the team."
              rows={6}
              spellcheck={true}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </>
  );
};

export default CaseNotesWidget;
