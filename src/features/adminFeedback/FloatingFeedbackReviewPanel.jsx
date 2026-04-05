import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  Container,
  ExpandableSection,
  FormField,
  Header,
  Link,
  Select,
  SpaceBetween,
  StatusIndicator,
  Textarea,
} from '@cloudscape-design/components';
import { apiFetch } from '../../auth/apiClient';
import { useMessaging } from '../../pages/messages/MessagingContext.js';
import {
  MAX_INTERNAL_NOTE_CHARS,
  STATUS_OPTIONS,
  formatFeedbackFileSize,
  formatFeedbackRelativeTime,
  formatFeedbackTimestamp,
  getReportTypeLabel,
  getSeverityLabel,
  getStatusIndicatorType,
  getStatusLabel,
  normalizeFeedbackStatus,
} from './constants.js';

function buildContextLabel(contextSnapshot, fallbackTitle = null, fallbackPath = null) {
  if (contextSnapshot && typeof contextSnapshot === 'object') {
    const breadcrumbs = Array.isArray(contextSnapshot.breadcrumbs) ? contextSnapshot.breadcrumbs : [];
    const breadcrumbText = breadcrumbs
      .map(item => (typeof item?.text === 'string' ? item.text.trim() : ''))
      .filter(Boolean);
    if (breadcrumbText.length) {
      return breadcrumbText.join(' / ');
    }
    if (typeof contextSnapshot.pageTitle === 'string' && contextSnapshot.pageTitle.trim()) {
      return contextSnapshot.pageTitle.trim();
    }
    if (typeof contextSnapshot.path === 'string' && contextSnapshot.path.trim()) {
      return contextSnapshot.path.trim();
    }
  }
  if (typeof fallbackTitle === 'string' && fallbackTitle.trim()) return fallbackTitle.trim();
  if (typeof fallbackPath === 'string' && fallbackPath.trim()) return fallbackPath.trim();
  return 'PATH page';
}

function resolveWindowRight({ chatVisible, messageVisible, reporterVisible }) {
  if (typeof window !== 'undefined' && window.innerWidth < 1320) {
    return '1rem';
  }
  if (reporterVisible && chatVisible && messageVisible) {
    return 'calc(2rem + 560px + 440px + 540px)';
  }
  if (reporterVisible && messageVisible) {
    return 'calc(2rem + 560px + 540px)';
  }
  if (reporterVisible && chatVisible) {
    return 'calc(2rem + 560px + 440px)';
  }
  if (reporterVisible) {
    return 'calc(2rem + 560px)';
  }
  if (chatVisible && messageVisible) {
    return 'calc(2rem + 440px + 540px)';
  }
  if (messageVisible) {
    return 'calc(2rem + 540px)';
  }
  if (chatVisible) {
    return 'calc(2rem + 440px)';
  }
  return '2rem';
}

async function parseErrorResponse(response) {
  const payload = await response.json().catch(() => null);
  return payload?.message || `Request failed (${response.status}).`;
}

function formatActorLabel(name, email) {
  if (typeof name === 'string' && name.trim()) return name.trim();
  if (typeof email === 'string' && email.trim()) return email.trim();
  return 'Unknown';
}

export default function FloatingFeedbackReviewPanel({
  visible = false,
  chatVisible = false,
  reporterVisible = false,
  reportId = null,
  openRequestId = 0,
  onClose = () => {},
}) {
  const { pinnedMessage, composeMode } = useMessaging();
  const messageVisible = Boolean(pinnedMessage || composeMode);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusValue, setStatusValue] = useState('submitted');
  const [statusSaving, setStatusSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const rightOffset = useMemo(
    () => resolveWindowRight({ chatVisible, messageVisible, reporterVisible }),
    [chatVisible, messageVisible, reporterVisible]
  );

  const loadDetail = useCallback(async () => {
    if (!reportId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`/api/admin/feedback-reports/${reportId}`);
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      const payload = await response.json().catch(() => null);
      const report = payload?.report || null;
      setDetail(report);
      setStatusValue(normalizeFeedbackStatus(report?.status, 'submitted'));
    } catch (loadError) {
      setDetail(null);
      setError(loadError?.message || 'Failed to load the feedback report.');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    if (!visible || !reportId) return;
    loadDetail();
  }, [loadDetail, openRequestId, reportId, visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, visible]);

  const selectedStatus = STATUS_OPTIONS.find(option => option.value === statusValue) || STATUS_OPTIONS[0];
  const contextLabel = buildContextLabel(detail?.contextSnapshot, detail?.pageTitle, detail?.pagePath);

  const handleSaveStatus = async () => {
    if (!reportId) return;
    setStatusSaving(true);
    setError('');
    try {
      const response = await apiFetch(`/api/admin/feedback-reports/${reportId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: normalizeFeedbackStatus(statusValue, 'submitted') }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      try {
        window.dispatchEvent(
          new CustomEvent('admin-feedback:changed', {
            detail: { action: 'status-updated', reportId },
          })
        );
      } catch (_) {}
      await loadDetail();
    } catch (saveError) {
      setError(saveError?.message || 'Failed to update the feedback report status.');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!reportId) return;
    const trimmedNote = noteText.trim();
    if (!trimmedNote) return;
    setNoteSaving(true);
    setError('');
    try {
      const response = await apiFetch(`/api/admin/feedback-reports/${reportId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText: trimmedNote }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      setNoteText('');
      try {
        window.dispatchEvent(
          new CustomEvent('admin-feedback:changed', {
            detail: { action: 'note-added', reportId },
          })
        );
      } catch (_) {}
      await loadDetail();
    } catch (saveError) {
      setError(saveError?.message || 'Failed to add the internal note.');
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Feedback review window"
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: rightOffset,
        width: 'min(620px, calc(100vw - 2rem))',
        maxWidth: '100%',
        maxHeight: 'calc(100vh - 4rem)',
        zIndex: 1910,
        pointerEvents: visible ? 'auto' : 'none',
        display: visible ? 'block' : 'none',
      }}
    >
      <Container
        header={(
          <Header
            variant="h2"
            actions={(
              <SpaceBetween size="xs" direction="horizontal">
                <Button onClick={loadDetail} disabled={loading || !reportId}>
                  Refresh
                </Button>
                <Button iconName="close" variant="icon" ariaLabel="Close review window" onClick={onClose} />
              </SpaceBetween>
            )}
          >
            {detail?.summary || `Feedback report #${reportId || ''}`}
          </Header>
        )}
        footer={(
          <SpaceBetween size="xs" direction="horizontal">
            <Button onClick={onClose}>Close</Button>
          </SpaceBetween>
        )}
        style={{
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.35)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            maxHeight: 'min(680px, calc(100vh - 12rem))',
            overflowY: 'auto',
            paddingRight: '0.5rem',
          }}
        >
          <SpaceBetween size="l">
            {error ? (
              <Alert type="error" header="Unable to load feedback report" dismissible onDismiss={() => setError('')}>
                {error}
              </Alert>
            ) : null}

            {loading && !detail ? (
              <StatusIndicator type="loading">Loading feedback report</StatusIndicator>
            ) : null}

            {detail ? (
              <>
                <Container header={<Header variant="h3">Overview</Header>}>
                  <SpaceBetween size="l">
                    <ColumnLayout columns={2} variant="text-grid">
                      <div>
                        <Box variant="awsui-key-label">Type</Box>
                        <Box>{getReportTypeLabel(detail.reportType)}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Severity</Box>
                        <Box>{getSeverityLabel(detail.severity)}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Submitted</Box>
                        <Box>{formatFeedbackTimestamp(detail.submittedAt)}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Reporter</Box>
                        <Box>{formatActorLabel(detail.submittedByName, detail.submittedByEmail)}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Current status</Box>
                        <StatusIndicator type={getStatusIndicatorType(detail.status)}>
                          {getStatusLabel(detail.status)}
                        </StatusIndicator>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Captured page</Box>
                        <Box>{contextLabel}</Box>
                      </div>
                    </ColumnLayout>

                    <FormField label="Update status">
                      <SpaceBetween size="xs" direction="horizontal">
                        <Select
                          selectedOption={selectedStatus}
                          options={STATUS_OPTIONS}
                          onChange={({ detail: selectDetail }) => {
                            setStatusValue(normalizeFeedbackStatus(selectDetail.selectedOption?.value, 'submitted'));
                          }}
                        />
                        <Button
                          variant="primary"
                          loading={statusSaving}
                          disabled={statusSaving || selectedStatus.value === detail.status}
                          onClick={handleSaveStatus}
                        >
                          Save status
                        </Button>
                      </SpaceBetween>
                    </FormField>

                    <div>
                      <Box variant="awsui-key-label">Summary</Box>
                      <Box>{detail.summary || '-'}</Box>
                    </div>
                    <div>
                      <Box variant="awsui-key-label">Description</Box>
                      <Box whiteSpace="pre-wrap">{detail.description || '-'}</Box>
                    </div>
                  </SpaceBetween>
                </Container>

                <ExpandableSection headerText="Captured page context">
                  <SpaceBetween size="s">
                    <ColumnLayout columns={2} variant="text-grid">
                      <div>
                        <Box variant="awsui-key-label">Page title</Box>
                        <Box>{detail.pageTitle || contextLabel}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Route</Box>
                        <Box>{detail.pagePath || detail.contextSnapshot?.path || '-'}</Box>
                      </div>
                    </ColumnLayout>
                    {detail.pageUrl || detail.contextSnapshot?.url ? (
                      <div>
                        <Box variant="awsui-key-label">URL</Box>
                        <Box>{detail.pageUrl || detail.contextSnapshot?.url}</Box>
                      </div>
                    ) : null}
                    {Array.isArray(detail.contextSnapshot?.breadcrumbs) && detail.contextSnapshot.breadcrumbs.length ? (
                      <div>
                        <Box variant="awsui-key-label">Breadcrumbs</Box>
                        <Box color="text-body-secondary">
                          {detail.contextSnapshot.breadcrumbs
                            .map(item => (typeof item?.text === 'string' ? item.text.trim() : ''))
                            .filter(Boolean)
                            .join(' / ')}
                        </Box>
                      </div>
                    ) : null}
                    <ColumnLayout columns={3} variant="text-grid">
                      <div>
                        <Box variant="awsui-key-label">Captured</Box>
                        <Box>{formatFeedbackTimestamp(detail.contextSnapshot?.capturedAt || detail.submittedAt)}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Timezone</Box>
                        <Box>{detail.contextSnapshot?.timeZone || '-'}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Viewport</Box>
                        <Box>
                          {detail.contextSnapshot?.viewport?.width && detail.contextSnapshot?.viewport?.height
                            ? `${detail.contextSnapshot.viewport.width} x ${detail.contextSnapshot.viewport.height}`
                            : '-'}
                        </Box>
                      </div>
                    </ColumnLayout>
                  </SpaceBetween>
                </ExpandableSection>

                <Container header={<Header variant="h3">Supporting files</Header>}>
                  <SpaceBetween size="s">
                    {Array.isArray(detail.attachments) && detail.attachments.length ? (
                      detail.attachments.map(attachment => (
                        <Box key={attachment.id} padding={{ bottom: 'xxs' }}>
                          <SpaceBetween size="xxs">
                            <Box variant="awsui-key-label">{attachment.fileName || 'Attachment'}</Box>
                            <Box color="text-body-secondary">
                              {formatFeedbackFileSize(attachment.sizeBytes)}
                              {attachment.mimeType ? ` • ${attachment.mimeType}` : ''}
                            </Box>
                            {attachment.downloadUrl ? (
                              <Link external href={attachment.downloadUrl}>
                                Open attachment
                              </Link>
                            ) : (
                              <Box color="text-status-inactive">Download unavailable</Box>
                            )}
                          </SpaceBetween>
                        </Box>
                      ))
                    ) : (
                      <Box color="text-body-secondary">No supporting files were attached to this report.</Box>
                    )}
                  </SpaceBetween>
                </Container>

                <Container header={<Header variant="h3">Internal notes</Header>}>
                  <SpaceBetween size="m">
                    <FormField
                      label="Add internal note"
                      constraintText={`${noteText.length}/${MAX_INTERNAL_NOTE_CHARS} characters`}
                    >
                      <Textarea
                        value={noteText}
                        rows={4}
                        maxLength={MAX_INTERNAL_NOTE_CHARS}
                        placeholder="Add triage notes, follow-up decisions, or implementation context."
                        onChange={({ detail: changeDetail }) => setNoteText(changeDetail.value)}
                      />
                    </FormField>
                    <SpaceBetween size="xs" direction="horizontal">
                      <Button
                        variant="primary"
                        loading={noteSaving}
                        disabled={noteSaving || !noteText.trim()}
                        onClick={handleAddNote}
                      >
                        Save note
                      </Button>
                    </SpaceBetween>
                    {Array.isArray(detail.notes) && detail.notes.length ? (
                      detail.notes.map(note => (
                        <Box key={note.id} padding={{ bottom: 'xxs' }}>
                          <SpaceBetween size="xxs">
                            <Box variant="awsui-key-label">
                              {formatActorLabel(note.authorName, note.authorEmail)}
                              {` • ${formatFeedbackRelativeTime(note.createdAt) || formatFeedbackTimestamp(note.createdAt)}`}
                            </Box>
                            <Box whiteSpace="pre-wrap">{note.noteText}</Box>
                          </SpaceBetween>
                        </Box>
                      ))
                    ) : (
                      <Box color="text-body-secondary">No internal notes yet.</Box>
                    )}
                  </SpaceBetween>
                </Container>

                <ExpandableSection headerText="Status history">
                  <SpaceBetween size="s">
                    {Array.isArray(detail.history) && detail.history.length ? (
                      detail.history.map(entry => (
                        <Box key={entry.id} padding={{ bottom: 'xxs' }}>
                          <SpaceBetween size="xxs">
                            <Box variant="awsui-key-label">
                              {`${entry.previousStatus ? getStatusLabel(entry.previousStatus) : 'Created'} -> ${getStatusLabel(entry.newStatus)}`}
                            </Box>
                            <Box color="text-body-secondary">
                              {formatActorLabel(entry.changedByName, entry.changedByEmail)}
                              {` • ${formatFeedbackTimestamp(entry.changedAt)}`}
                            </Box>
                          </SpaceBetween>
                        </Box>
                      ))
                    ) : (
                      <Box color="text-body-secondary">No status changes recorded yet.</Box>
                    )}
                  </SpaceBetween>
                </ExpandableSection>
              </>
            ) : null}
          </SpaceBetween>
        </div>
      </Container>
    </div>
  );
}
