import React, { useCallback, useEffect, useState } from 'react';
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
  Badge
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';

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

const CaseNotesWidget = ({ actions, caseData }) => {
  const caseId = caseData?.id ?? caseData?.case_id ?? null;
  const caseIdentifier =
    caseData?.tracking_id || caseData?.trackingId || (caseId ? `#${caseId}` : null);

  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [draftText, setDraftText] = useState('');
  const [draftError, setDraftError] = useState(null);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const canMutate = Boolean(caseId);

  const resetModalState = () => {
    setDraftText('');
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

  const handleDelete = async (noteId) => {
    if (!noteId || !caseId) return;
    const confirmation = 'Delete this note? This action cannot be undone.';
    if (typeof window !== 'undefined' && !window.confirm(confirmation)) {
      return;
    }
    setPendingDeleteId(noteId);
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
    } catch (err) {
      const message = await getErrorMessage(err, 'Failed to delete note.');
      setError(message);
    } finally {
      setPendingDeleteId(null);
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
      let res;
      if (modalMode === 'edit' && activeNoteId) {
        res = await apiFetch(`/api/cases/${caseId}/notes/${activeNoteId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: trimmed })
        });
      } else {
        res = await apiFetch(`/api/cases/${caseId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: trimmed })
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
      closeModal();
    } catch (err) {
      const message = await getErrorMessage(err, 'Failed to save note.');
      setDraftError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const renderNoteBody = (note) => {
    const text = sanitize(note.body);
    const showFull = expandedIds.has(note.id);
    const limit = 420;
    if (text.length <= limit) {
      return <Box>{text}</Box>;
    }
    return (
      <SpaceBetween size="xxs">
        <Box>{showFull ? text : `${text.slice(0, limit)}...`}</Box>
        <Button variant="inline-link" onClick={() => toggleExpanded(note.id)}>
          {showFull ? 'Show less' : 'Show more'}
        </Button>
      </SpaceBetween>
    );
  };

  const emptyStateMessage = !caseId
    ? 'Case details are still loading. Notes will appear once the case data is available.'
    : 'No notes yet. Use Add note to start the record.';

  return (
    <>
      <BoardItem
        header={
          <Header
            variant="h2"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="primary"
                  iconName="add-plus"
                  onClick={openCreateModal}
                  disabled={!canMutate || isLoading || isRefreshing}
                >
                  Add note
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
          >
            Case Notes
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
                    header={
                      <SpaceBetween direction="horizontal" size="s">
                        <SpaceBetween size="xxs">
                          <Box fontWeight="bold">{authorName}</Box>
                          <SpaceBetween direction="horizontal" size="xs">
                            {authorRole ? <Badge color="blue">{authorRole}</Badge> : null}
                            {note.isPinned ? <Badge color="orange">Pinned</Badge> : null}
                          </SpaceBetween>
                        </SpaceBetween>
                        <Box color="text-body-secondary" variant="small">
                          {timestamp}
                          {editedLabel}
                        </Box>
                      </SpaceBetween>
                    }
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
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </>
  );
};

export default CaseNotesWidget;
