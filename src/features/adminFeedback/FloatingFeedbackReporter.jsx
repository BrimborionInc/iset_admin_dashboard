import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  Container,
  ExpandableSection,
  FileUpload,
  FormField,
  Header,
  Input,
  Select,
  SpaceBetween,
  Textarea,
} from '@cloudscape-design/components';
import { apiFetch } from '../../auth/apiClient';
import { useMessaging } from '../../pages/messages/MessagingContext.js';
import {
  ACCEPTED_FILE_TYPES,
  MAX_ATTACHMENTS,
  MAX_DESCRIPTION_CHARS,
  MAX_SUMMARY_CHARS,
  REPORT_TYPE_OPTIONS,
  SEVERITY_OPTIONS,
  getReportTypeLabel,
  normalizeRequestedType,
  normalizeSeverity,
} from './constants.js';

const emptySubmission = null;

function buildContextLabel(contextSnapshot) {
  if (!contextSnapshot || typeof contextSnapshot !== 'object') {
    return 'Current PATH page';
  }
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
  return 'Current PATH page';
}

function formatCapturedAt(contextSnapshot) {
  const rawValue = contextSnapshot?.capturedAt || null;
  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString('en-CA');
}

function getSubmitLabel(reportType) {
  return reportType === 'change_request' ? 'Submit change request' : 'Submit bug report';
}

function getSuccessLabel(reportType) {
  return reportType === 'change_request' ? 'Change request submitted' : 'Bug report submitted';
}

function resolveWindowRight({ chatVisible, messageVisible, reviewVisible }) {
  if (typeof window !== 'undefined' && window.innerWidth < 1180) {
    return '1rem';
  }
  if (reviewVisible && chatVisible && messageVisible) {
    return 'calc(2rem + 620px + 440px + 540px)';
  }
  if (reviewVisible && messageVisible) {
    return 'calc(2rem + 620px + 540px)';
  }
  if (reviewVisible && chatVisible) {
    return 'calc(2rem + 620px + 440px)';
  }
  if (reviewVisible) {
    return 'calc(2rem + 620px)';
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
  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }
  const errorCode = payload?.error || null;
  if (errorCode === 'unsupported_file_type') {
    return 'That file type is not supported. Upload PDF, Word, Excel, CSV, text, PNG, or JPG files.';
  }
  if (errorCode === 'file_too_large') {
    const maxBytes = Number(payload?.maxBytes);
    const maxMb = Number.isFinite(maxBytes) && maxBytes > 0
      ? Math.ceil(maxBytes / (1024 * 1024))
      : null;
    return maxMb
      ? `One of the files is too large. The maximum supported size is ${maxMb} MB per file.`
      : 'One of the files is too large to upload.';
  }
  if (errorCode === 'attachments_limit_exceeded') {
    return `You can attach up to ${MAX_ATTACHMENTS} files per report.`;
  }
  if (errorCode === 'invalid_report_type') {
    return 'The selected report type is not valid.';
  }
  if (errorCode === 'invalid_severity') {
    return 'The selected severity is not valid.';
  }
  if (errorCode === 'description_required') {
    return 'Describe the bug or requested change before submitting.';
  }
  if (errorCode === 'feedback_storage_unavailable') {
    return 'The feedback-reporting tables are not available yet in this environment.';
  }
  return payload?.message || `Failed to submit the report (${response.status}).`;
}

export default function FloatingFeedbackReporter({
  visible = false,
  chatVisible = false,
  reviewVisible = false,
  openRequestId = 0,
  requestedReportType = 'bug',
  requestedContextSnapshot = null,
  onSubmitSuccess = () => {},
  onClose = () => {},
}) {
  const { pinnedMessage, composeMode } = useMessaging();
  const messageVisible = Boolean(pinnedMessage || composeMode);

  const [reportType, setReportType] = useState(normalizeRequestedType(requestedReportType));
  const [severity, setSeverity] = useState('medium');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [contextSnapshot, setContextSnapshot] = useState(requestedContextSnapshot || null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(emptySubmission);

  const rightOffset = useMemo(
    () => resolveWindowRight({ chatVisible, messageVisible, reviewVisible }),
    [chatVisible, messageVisible, reviewVisible]
  );

  const hasDraft = Boolean(
    summary.trim() ||
    description.trim() ||
    (Array.isArray(attachments) && attachments.length)
  );

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

  useEffect(() => {
    if (!openRequestId) return;
    const nextRequestedType = normalizeRequestedType(requestedReportType);
    if (submissionResult || !hasDraft) {
      setReportType(nextRequestedType);
      setSeverity('medium');
      setSummary('');
      setDescription('');
      setAttachments([]);
      setContextSnapshot(requestedContextSnapshot || null);
      setSubmitError(null);
      setSubmissionResult(emptySubmission);
      return;
    }
    if (!contextSnapshot && requestedContextSnapshot) {
      setContextSnapshot(requestedContextSnapshot);
    }
  }, [
    contextSnapshot,
    hasDraft,
    openRequestId,
    requestedContextSnapshot,
    requestedReportType,
    submissionResult,
  ]);

  const handleResetDraft = () => {
    setReportType(normalizeRequestedType(requestedReportType));
    setSeverity('medium');
    setSummary('');
    setDescription('');
    setAttachments([]);
    setContextSnapshot(requestedContextSnapshot || null);
    setSubmitError(null);
    setSubmissionResult(emptySubmission);
  };

  const handleAttachmentChange = ({ detail }) => {
    const nextFiles = Array.isArray(detail?.value) ? detail.value : [];
    if (nextFiles.length > MAX_ATTACHMENTS) {
      setAttachments(nextFiles.slice(0, MAX_ATTACHMENTS));
      setSubmitError(`You can attach up to ${MAX_ATTACHMENTS} files per report.`);
      return;
    }
    setAttachments(nextFiles);
    if (submitError) {
      setSubmitError(null);
    }
  };

  const handleSubmit = async () => {
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setSubmitError('Describe the bug or requested change before submitting.');
      return;
    }

    const formData = new FormData();
    formData.append('reportType', reportType);
    formData.append('severity', normalizeSeverity(severity));
    if (summary.trim()) {
      formData.append('summary', summary.trim());
    }
    formData.append('description', trimmedDescription);
    if (contextSnapshot) {
      formData.append('contextSnapshot', JSON.stringify(contextSnapshot));
    }
    attachments.forEach(file => {
      formData.append('attachments', file);
    });

    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await apiFetch('/api/admin/feedback-reports', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }
      const payload = await response.json().catch(() => ({}));
      const createdReport = payload?.report || payload || {};
      setSummary('');
      setDescription('');
      setAttachments([]);
      setSubmissionResult(createdReport);
      try {
        window.dispatchEvent(
          new CustomEvent('admin-feedback:changed', {
            detail: {
              action: 'created',
              reportId: createdReport.id || null,
            },
          })
        );
      } catch (_) {}
      try {
        onSubmitSuccess(createdReport);
      } catch (_) {}
      onClose();
    } catch (error) {
      setSubmitError(error?.message || 'Failed to submit the report.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedReportType = REPORT_TYPE_OPTIONS.find(option => option.value === reportType) || REPORT_TYPE_OPTIONS[0];
  const selectedSeverity = SEVERITY_OPTIONS.find(option => option.value === severity) || SEVERITY_OPTIONS[2];
  const contextLabel = buildContextLabel(contextSnapshot);
  const capturedAtLabel = formatCapturedAt(contextSnapshot);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Bug reporting and change request window"
      aria-hidden={!visible}
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: rightOffset,
        width: 'min(560px, calc(100vw - 2rem))',
        maxWidth: '100%',
        maxHeight: 'calc(100vh - 4rem)',
        zIndex: 1900,
        pointerEvents: visible ? 'auto' : 'none',
        display: visible ? 'block' : 'none',
      }}
    >
      <Container
        header={(
          <Header
            variant="h2"
            actions={(
              <Button
                iconName="close"
                variant="icon"
                ariaLabel="Close report window"
                onClick={onClose}
              />
            )}
          >
            {submissionResult ? getSuccessLabel(reportType) : getReportTypeLabel(reportType)}
          </Header>
        )}
        footer={submissionResult ? (
          <SpaceBetween size="xs" direction="horizontal">
            <Button onClick={onClose}>Close</Button>
            <Button variant="primary" onClick={handleResetDraft}>Report another</Button>
          </SpaceBetween>
        ) : (
          <SpaceBetween size="xs" direction="horizontal">
            <Button onClick={handleResetDraft} disabled={submitting || (!hasDraft && !contextSnapshot)}>
              Clear draft
            </Button>
            <Button onClick={onClose} disabled={submitting}>Close</Button>
            <Button variant="primary" onClick={handleSubmit} loading={submitting}>
              {getSubmitLabel(reportType)}
            </Button>
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
            maxHeight: 'min(620px, calc(100vh - 12rem))',
            overflowY: 'auto',
            paddingRight: '0.5rem',
          }}
        >
          <SpaceBetween size="l">
            {submitError ? (
              <Alert type="error" header="Unable to submit report" dismissible onDismiss={() => setSubmitError(null)}>
                {submitError}
              </Alert>
            ) : null}

            {submissionResult ? (
              <SpaceBetween size="l">
                <Alert type="success" header={getSuccessLabel(reportType)}>
                  {`Report #${submissionResult.id || 'new'} has been recorded.`}
                </Alert>
                <Container header={<Header variant="h3">Submission summary</Header>}>
                  <SpaceBetween size="m">
                    <ColumnLayout columns={2} variant="text-grid">
                      <div>
                        <Box variant="awsui-key-label">Type</Box>
                        <Box>{getReportTypeLabel(submissionResult.reportType || reportType)}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Severity</Box>
                        <Box>{submissionResult.severity || selectedSeverity.label}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Captured page</Box>
                        <Box>{contextLabel}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Attachments</Box>
                        <Box>{Number(submissionResult.attachmentCount || 0)}</Box>
                      </div>
                    </ColumnLayout>
                    <Box color="text-body-secondary">
                      Keep working in PATH. This window can be closed without affecting the rest of the console.
                    </Box>
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            ) : (
              <SpaceBetween size="l">
                <Box color="text-body-secondary">
                  Please submit your bug report or change request below.
                </Box>

                <Container header={<Header variant="h3">Report details</Header>}>
                  <SpaceBetween size="l">
                    <ColumnLayout columns={2}>
                      <FormField label="Report type">
                        <Select
                          selectedOption={selectedReportType}
                          onChange={({ detail }) => setReportType(normalizeRequestedType(detail.selectedOption?.value))}
                          options={REPORT_TYPE_OPTIONS}
                        />
                      </FormField>
                      <FormField label="Impact / severity">
                        <Select
                          selectedOption={selectedSeverity}
                          onChange={({ detail }) => setSeverity(normalizeSeverity(detail.selectedOption?.value))}
                          options={SEVERITY_OPTIONS}
                        />
                      </FormField>
                    </ColumnLayout>

                    <FormField
                      label="Short summary"
                      description="Optional, but it helps triage the report quickly."
                      constraintText={`${summary.length}/${MAX_SUMMARY_CHARS} characters`}
                    >
                      <Input
                        value={summary}
                        maxLength={MAX_SUMMARY_CHARS}
                        placeholder={reportType === 'change_request' ? 'e.g., Add export filter by region' : 'e.g., Case notes save button stalls'}
                        onChange={({ detail }) => {
                          setSummary(detail.value);
                          if (submitError) {
                            setSubmitError(null);
                          }
                        }}
                      />
                    </FormField>

                    <FormField
                      label={reportType === 'change_request' ? 'Requested change' : 'Bug description'}
                      description={reportType === 'change_request'
                        ? 'Explain the problem being solved, the desired outcome, and any constraints.'
                        : 'Describe what you expected, what happened instead, and any visible errors or reproduction steps.'}
                      constraintText={`${description.length}/${MAX_DESCRIPTION_CHARS} characters`}
                    >
                      <Textarea
                        value={description}
                        rows={8}
                        maxLength={MAX_DESCRIPTION_CHARS}
                        placeholder={reportType === 'change_request'
                          ? 'Describe the workflow gap, desired behavior, and who is affected.'
                          : 'Describe the steps to reproduce, visible error, and incorrect behavior.'}
                        onChange={({ detail }) => {
                          setDescription(detail.value);
                          if (submitError) {
                            setSubmitError(null);
                          }
                        }}
                      />
                    </FormField>

                    <FormField
                      label="Supporting files"
                      description="Optional. Attach screenshots, spreadsheets, documents, or notes that support the request."
                      constraintText={`Up to ${MAX_ATTACHMENTS} files. Accepted: PDF, Word, Excel, CSV, text, PNG, JPG.`}
                    >
                      <FileUpload
                        value={attachments}
                        onChange={handleAttachmentChange}
                        multiple
                        accept={ACCEPTED_FILE_TYPES}
                        loading={submitting}
                      />
                    </FormField>
                  </SpaceBetween>
                </Container>

                <ExpandableSection headerText="Captured page context">
                  <SpaceBetween size="s">
                    <ColumnLayout columns={2} variant="text-grid">
                      <div>
                        <Box variant="awsui-key-label">Page</Box>
                        <Box>{contextLabel}</Box>
                      </div>
                      <div>
                        <Box variant="awsui-key-label">Captured</Box>
                        <Box>{capturedAtLabel || 'Just now'}</Box>
                      </div>
                    </ColumnLayout>
                    {typeof contextSnapshot?.path === 'string' && contextSnapshot.path ? (
                      <div>
                        <Box variant="awsui-key-label">Route</Box>
                        <Box>{contextSnapshot.path}</Box>
                      </div>
                    ) : null}
                    {Array.isArray(contextSnapshot?.breadcrumbs) && contextSnapshot.breadcrumbs.length ? (
                      <div>
                        <Box variant="awsui-key-label">Breadcrumbs</Box>
                        <Box color="text-body-secondary">
                          {contextSnapshot.breadcrumbs
                            .map(item => (typeof item?.text === 'string' ? item.text.trim() : ''))
                            .filter(Boolean)
                            .join(' / ')}
                        </Box>
                      </div>
                    ) : null}
                  </SpaceBetween>
                </ExpandableSection>
              </SpaceBetween>
            )}
          </SpaceBetween>
        </div>
      </Container>
    </div>
  );
}
