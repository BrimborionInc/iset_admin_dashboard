import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  FormField,
  Header,
  Input,
  Multiselect,
  RadioGroup,
  SpaceBetween,
  Spinner,
  Textarea
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';
import { resolveApplicationStateFields } from '../utils/applicationStatus';

export const SECURE_MESSAGE_COMPOSE_OPEN_EVENT = 'secure-messaging:open-compose';
export const SECURE_MESSAGE_REFRESH_EVENT = 'secure-messaging:refresh';

export const openSecureMessageCompose = detail => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return false;
  return window.dispatchEvent(new CustomEvent(SECURE_MESSAGE_COMPOSE_OPEN_EVENT, { detail, cancelable: true }));
};

const LETTER_DOC_TYPES = new Set(['assessment_approval_letter', 'assessment_denial_letter']);

const toNumberOrNull = value => {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const SecureMessageComposePanel = ({
  caseId: propCaseId = null,
  caseData = null,
  isCaseWorkspace = false,
  selectedInterventionId = null,
  refreshCaseData,
  onCaseUpdate,
  applicationRowVersion
}) => {
  const caseId = toNumberOrNull(
    propCaseId ??
      caseData?.id ??
      caseData?.case_id ??
      caseData?.caseId
  );
  const applicationId = toNumberOrNull(
    caseData?.application_id ??
      caseData?.applicationId ??
      caseData?.application?.id
  );
  const applicantUserId = toNumberOrNull(
    caseData?.applicant_user_id ??
      caseData?.applicantUserId ??
      caseData?.applicant?.userId ??
      caseData?.applicant?.user_id
  );
  const interventionId = toNumberOrNull(selectedInterventionId);
  const applicantName =
    caseData?.applicant_name ??
    caseData?.applicantName ??
    caseData?.participantName ??
    caseData?.participant_name ??
    'Applicant';
  const assignedToName =
    caseData?.assigned_to_name ??
    caseData?.assignedToName ??
    caseData?.owner?.name ??
    '';
  const currentStaffName = assignedToName || '';
  const caseReference =
    caseData?.case_number ??
    caseData?.caseNumber ??
    caseData?.tracking_id ??
    caseData?.trackingId ??
    caseData?.submission_reference ??
    caseData?.submissionReference ??
    null;

  const applicationState = useMemo(() => {
    return resolveApplicationStateFields({
      applicationStatus:
        caseData?.applicationStatusRaw ??
        caseData?.application_status_raw ??
        caseData?.applicationStatus ??
        caseData?.application_status ??
        null,
      applicationLifecycleStatus:
        caseData?.applicationLifecycleStatus ?? caseData?.application_lifecycle_status ?? null,
      decisionOutcome: caseData?.decisionOutcome ?? caseData?.decision_outcome ?? null,
      awaitingReason:
        caseData?.applicationAwaitingReason ?? caseData?.application_awaiting_reason ?? null,
      closureReason:
        caseData?.applicationClosureReason ?? caseData?.application_closure_reason ?? null,
      caseStatus: caseData?.status ?? null,
      reviewStatus: caseData?.reviewStatus ?? caseData?.review_status ?? null,
    });
  }, [caseData]);
  const canonicalApplicationStatus = applicationState.applicationStatus || null;
  const rawApplicationStatus =
    applicationState.applicationStatusRaw ||
    applicationState.application_status_raw ||
    canonicalApplicationStatus;
  const decisionOutcome = applicationState.decisionOutcome || null;
  const allowedLetterDocTypes = useMemo(() => {
    if (decisionOutcome === 'approved') return new Set(['assessment_approval_letter']);
    if (decisionOutcome === 'denied') return new Set(['assessment_denial_letter']);
    return new Set();
  }, [decisionOutcome]);

  const [composePanelOpen, setComposePanelOpen] = useState(false);
  const [composeContext, setComposeContext] = useState(null);
  const [composeCloseNotice, setComposeCloseNotice] = useState(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeUrgent, setComposeUrgent] = useState(false);
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState(null);
  const [composeToName, setComposeToName] = useState('Applicant');
  const [composeFromName, setComposeFromName] = useState('Case Worker');
  const [workflowOptions, setWorkflowOptions] = useState([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [workflowsError, setWorkflowsError] = useState(null);
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState([]);
  const [financialOverviewMode, setFinancialOverviewMode] = useState('prefill');
  const [recipientConfirmed, setRecipientConfirmed] = useState(false);

  const buildComposeContext = useCallback(
    (detail = {}) => {
      const nextIsCaseWorkspace =
        typeof detail.isCaseWorkspace === 'boolean' ? detail.isCaseWorkspace : isCaseWorkspace;
      const nextCaseId = toNumberOrNull(detail.caseId) ?? caseId;
      const nextApplicationId = toNumberOrNull(detail.applicationId) ?? applicationId;
      const nextApplicantUserId = toNumberOrNull(detail.applicantUserId) ?? applicantUserId;
      const nextApplicantName = detail.applicantName || applicantName || 'Applicant';
      const nextInterventionId = nextIsCaseWorkspace
        ? toNumberOrNull(detail.interventionId) ?? interventionId
        : null;

      return {
        mode: detail.mode === 'reply' ? 'reply' : 'new',
        caseId: nextCaseId,
        applicationId: nextApplicationId,
        applicantUserId: nextApplicantUserId,
        applicantName: nextApplicantName,
        toName: detail.toName || nextApplicantName,
        fromName: detail.fromName || currentStaffName || 'Case Worker',
        caseReference: detail.caseReference || caseReference || (nextCaseId ? `Case ${nextCaseId}` : null),
        interventionId: nextInterventionId,
        isCaseWorkspace: nextIsCaseWorkspace
      };
    },
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

  const hasComposeDraft = useMemo(() => {
    const defaultToName = composeContext?.toName || applicantName || 'Applicant';
    const defaultFromName = composeContext?.fromName || currentStaffName || 'Case Worker';
    return Boolean(
      composeSubject.trim() ||
        composeBody.trim() ||
        composeToName.trim() !== defaultToName.trim() ||
        composeFromName.trim() !== defaultFromName.trim() ||
        selectedWorkflowIds.length > 0 ||
        financialOverviewMode !== 'prefill' ||
        composeUrgent
    );
  }, [
    applicantName,
    composeBody,
    composeContext?.fromName,
    composeContext?.toName,
    composeFromName,
    composeSubject,
    composeToName,
    composeUrgent,
    currentStaffName,
    financialOverviewMode,
    selectedWorkflowIds.length
  ]);

  const resetComposeDraft = useCallback(() => {
    setComposePanelOpen(false);
    setComposeContext(null);
    setComposeSubject('');
    setComposeBody('');
    setComposeToName(applicantName || 'Applicant');
    setComposeFromName(currentStaffName || 'Case Worker');
    setComposeUrgent(false);
    setComposeError(null);
    setSelectedWorkflowIds([]);
    setFinancialOverviewMode('prefill');
    setRecipientConfirmed(false);
  }, [applicantName, currentStaffName]);

  const confirmReplaceComposeDraft = useCallback(
    message => {
      if (!composePanelOpen || !hasComposeDraft || typeof window === 'undefined') return true;
      return window.confirm(message || 'Discard the current secure message draft?');
    },
    [composePanelOpen, hasComposeDraft]
  );

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
          type: (r.workflow_type || r.workflowType || '').trim(),
          documentType: (r.document_type || r.documentType || '').trim()
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

  const filteredWorkflowOptions = useMemo(
    () =>
      workflowOptions.filter(wf => {
        if (!wf.documentType) return true;
        if (!LETTER_DOC_TYPES.has(wf.documentType)) return true;
        return allowedLetterDocTypes.has(wf.documentType);
      }),
    [allowedLetterDocTypes, workflowOptions]
  );

  useEffect(() => {
    if (!selectedWorkflowIds.length) return;
    const allowedIds = new Set(filteredWorkflowOptions.map(wf => wf.id));
    setSelectedWorkflowIds(prev => {
      const next = prev.filter(id => allowedIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [filteredWorkflowOptions, selectedWorkflowIds.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleOpenCompose = event => {
      const detail = event?.detail || {};
      const nextContext = buildComposeContext(detail);
      if (!nextContext.caseId || !nextContext.applicantUserId) return;
      if (!confirmReplaceComposeDraft('Discard the current secure message draft and open another one?')) {
        event.preventDefault();
        return;
      }
      setComposeContext(nextContext);
      setComposeSubject(typeof detail.subject === 'string' ? detail.subject : '');
      setComposeBody(typeof detail.body === 'string' ? detail.body : '');
      setComposeUrgent(Boolean(detail.urgent));
      setComposeToName(nextContext.toName);
      setComposeFromName(nextContext.fromName);
      setSelectedWorkflowIds([]);
      setFinancialOverviewMode('prefill');
      setRecipientConfirmed(false);
      setComposeError(null);
      setComposeCloseNotice(null);
      loadWorkflows();
      setComposePanelOpen(true);
    };
    window.addEventListener(SECURE_MESSAGE_COMPOSE_OPEN_EVENT, handleOpenCompose);
    return () => {
      window.removeEventListener(SECURE_MESSAGE_COMPOSE_OPEN_EVENT, handleOpenCompose);
    };
  }, [buildComposeContext, confirmReplaceComposeDraft, loadWorkflows]);

  useEffect(() => {
    if (!composePanelOpen || !composeContext) return;
    const nextCaseId = Number(caseId || 0);
    const nextApplicantUserId = Number(applicantUserId || 0);
    if (!nextCaseId) return;
    const contextChanged =
      Number(composeContext.caseId || 0) !== nextCaseId ||
      (nextApplicantUserId > 0 && Number(composeContext.applicantUserId || 0) !== nextApplicantUserId);
    if (!contextChanged) return;
    const hadDraft = hasComposeDraft;
    resetComposeDraft();
    if (hadDraft) {
      setComposeCloseNotice(
        'The secure message draft was closed because this workspace changed to another applicant record.'
      );
    }
  }, [
    applicantUserId,
    caseId,
    composeContext,
    composePanelOpen,
    hasComposeDraft,
    resetComposeDraft
  ]);

  const updateStatusToDocsRequested = useCallback(async (targetContext = {}) => {
    const targetCaseId = targetContext.caseId || caseId;
    const targetApplicationId = targetContext.applicationId || applicationId;
    if (!targetCaseId) return;
    const statusKey = rawApplicationStatus || '';
    const shouldUpdateStatus = ['submitted', 'in_review'].includes(statusKey);
    let releaseLock = false;
    try {
      if (targetApplicationId) {
        const lockResponse = await apiFetch(`/api/locks/application/${targetApplicationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (!lockResponse.ok) {
          return;
        }
        releaseLock = true;
      }
      const payload = {
        docsRequested: true,
        docsRequestedSource: 'secure_message'
      };
      if (shouldUpdateStatus) {
        payload.applicationStatus = 'docs_requested';
      }
      const rowVersion =
        Number(caseData?.application_row_version ?? caseData?.applicationRowVersion ?? applicationRowVersion ?? 0) || 0;
      if (rowVersion > 0) {
        payload.expectedRowVersion = rowVersion;
      }
      const response = await apiFetch(`/api/cases/${targetCaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        return;
      }
      if (typeof refreshCaseData === 'function') {
        try {
          await refreshCaseData();
        } catch (_) {}
      } else if (typeof onCaseUpdate === 'function') {
        onCaseUpdate({
          applicationStatus: 'docs_requested',
          application_status: 'docs_requested',
          docs_requested_active: true,
          docs_requested_at: new Date().toISOString()
        });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('case-events-refresh', { detail: { caseId: targetCaseId } }));
        window.dispatchEvent(new CustomEvent('case-reminders-refresh', { detail: { caseId: targetCaseId } }));
      }
    } finally {
      if (targetApplicationId && releaseLock) {
        try {
          await apiFetch(`/api/locks/application/${targetApplicationId}`, { method: 'DELETE' });
        } catch (_) {}
      }
    }
  }, [
    applicationId,
    applicationRowVersion,
    rawApplicationStatus,
    caseData,
    caseId,
    onCaseUpdate,
    refreshCaseData
  ]);

  const handleCancelCompose = () => {
    if (composeSending) return;
    if (hasComposeDraft && typeof window !== 'undefined') {
      const confirmed = window.confirm('Discard this draft message?');
      if (!confirmed) return;
    }
    resetComposeDraft();
  };

  const handleSendMessage = async () => {
    const sendCaseId = composeContext?.caseId || caseId;
    if (!sendCaseId) return;
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
    if (!recipientConfirmed) {
      setComposeError('Confirm the recipient and case before sending.');
      return;
    }
    setComposeSending(true);
    setComposeError(null);
    try {
      const workflowById = new Map(workflowOptions.map(wf => [Number(wf.id), wf]));
      const attachmentsPayload = selectedWorkflowIds.map(id => {
        const workflow = workflowById.get(Number(id));
        const payload = { workflow_id: id };
        if (workflow?.documentType === 'financial_overview') {
          payload.financial_overview_mode = financialOverviewMode === 'blank' ? 'blank' : 'prefill';
        }
        return payload;
      });
      const payload = {
        subject,
        body,
        urgent: composeUrgent,
        toDisplayName: toName,
        fromDisplayName: fromName,
        attachments: attachmentsPayload
      };
      const sendApplicationId = composeContext?.applicationId || applicationId;
      const sendIsCaseWorkspace = composeContext?.isCaseWorkspace ?? isCaseWorkspace;
      const sendInterventionId = composeContext?.interventionId || null;
      if (!sendIsCaseWorkspace && sendApplicationId) {
        payload.applicationId = sendApplicationId;
      }
      if (sendIsCaseWorkspace && sendInterventionId) {
        payload.interventionId = sendInterventionId;
      }
      const response = await apiFetch(`/api/cases/${sendCaseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || 'Failed to send message');
      }
      if (attachmentsPayload.length > 0) {
        await updateStatusToDocsRequested({ caseId: sendCaseId, applicationId: sendApplicationId });
      }
      resetComposeDraft();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(SECURE_MESSAGE_REFRESH_EVENT, { detail: { caseId: sendCaseId } }));
      }
    } catch (err) {
      setComposeError(err?.message || 'Failed to send message');
    } finally {
      setComposeSending(false);
    }
  };

  const composeWindowTitle = composeContext?.mode === 'reply' ? 'Reply to secure message' : 'New secure message';
  const composeContextSummary = [
    composeContext?.applicantName,
    composeContext?.caseReference
  ].filter(Boolean).join(' - ');
  const selectedFinancialOverview = useMemo(() => {
    const selected = new Set(selectedWorkflowIds.map(id => Number(id)));
    return filteredWorkflowOptions.some(wf => selected.has(Number(wf.id)) && wf.documentType === 'financial_overview');
  }, [filteredWorkflowOptions, selectedWorkflowIds]);

  return (
    <>
      {composeCloseNotice && !composePanelOpen ? (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: 'min(580px, calc(100vw - 2rem))',
            zIndex: 1924
          }}
        >
          <Alert type="warning" dismissible onDismiss={() => setComposeCloseNotice(null)}>
            {composeCloseNotice}
          </Alert>
        </div>
      ) : null}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Secure message compose window"
        aria-hidden={!composePanelOpen}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: 'min(580px, calc(100vw - 2rem))',
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 4rem)',
          zIndex: 1925,
          pointerEvents: composePanelOpen ? 'auto' : 'none',
          display: composePanelOpen ? 'block' : 'none'
        }}
      >
        <Container
          header={(
            <Header
              variant="h2"
              description={composeContextSummary || undefined}
              actions={(
                <Button
                  iconName="close"
                  variant="icon"
                  ariaLabel="Close secure message draft"
                  onClick={handleCancelCompose}
                  disabled={composeSending}
                />
              )}
            >
              {composeWindowTitle}
            </Header>
          )}
          footer={(
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
                  !composeFromName.trim() ||
                  !recipientConfirmed
                }
              >
                Send
              </Button>
              <Button
                variant="normal"
                onClick={handleCancelCompose}
                disabled={composeSending}
              >
                Discard
              </Button>
            </SpaceBetween>
          )}
          style={{
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.35)',
            borderRadius: '16px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              maxHeight: 'min(640px, calc(100vh - 12rem))',
              overflowY: 'auto',
              paddingRight: '0.5rem'
            }}
          >
            <SpaceBetween size="s">
              <FormField
                label="To"
                description={`Delivered to the applicant account linked to ${composeContext?.caseReference || 'this case'}.`}
              >
                <Input
                  value={composeToName}
                  placeholder="Applicant"
                  readOnly
                  spellCheck={false}
                  disabled={composeSending}
                />
              </FormField>
              <FormField label="From">
                <Input
                  value={composeFromName}
                  placeholder="Case Worker"
                  readOnly
                  spellCheck={false}
                  disabled={composeSending}
                />
              </FormField>
              <FormField label="Subject">
                <Input
                  value={composeSubject}
                  onChange={({ detail }) => setComposeSubject(detail.value)}
                  placeholder="Subject"
                  spellCheck={true}
                  disabled={composeSending}
                />
              </FormField>
              <FormField label="Message">
                <Textarea
                  value={composeBody}
                  onChange={({ detail }) => setComposeBody(detail.value)}
                  rows={8}
                  placeholder="Write your message"
                  spellCheck={true}
                  disabled={composeSending}
                />
              </FormField>
              <FormField label="Attach form(s) to send">
                {workflowsLoading ? (
                  <Box>
                    <Spinner size="normal" /> Loading forms...
                  </Box>
                ) : workflowsError ? (
                  <Box color="text-status-critical">{workflowsError}</Box>
                ) : filteredWorkflowOptions.length === 0 ? (
                  <Box color="text-body-secondary">No eligible forms (type "Form") available.</Box>
                ) : (
                  <Multiselect
                    placeholder="Select form(s)..."
                    inlineTokens
                    tokenLimit={0}
                    disableBrowserAutocorrect
                    selectedOptions={filteredWorkflowOptions
                      .filter(wf => selectedWorkflowIds.includes(wf.id))
                      .map(wf => ({
                        label: wf.name,
                        value: wf.id,
                        description: wf.type === 'consent-cm-prefill' ? 'Form (CM prefill)' : 'Form (No prefill)'
                      }))}
                    options={filteredWorkflowOptions.map(wf => ({
                      label: wf.name,
                      value: wf.id,
                      description: wf.type === 'consent-cm-prefill' ? 'Form (CM prefill)' : 'Form (No prefill)'
                    }))}
                    keepOpen={false}
                    onChange={({ detail }) => {
                      setSelectedWorkflowIds(detail.selectedOptions.map(opt => opt.value));
                    }}
                    disabled={composeSending}
                  />
                )}
                {filteredWorkflowOptions.length === 0 && workflowOptions.some(wf => LETTER_DOC_TYPES.has(wf.documentType)) && (
                  <Box color="text-body-secondary" fontSize="body-s">
                    Decision letter forms are available only after a decision has been recorded.
                  </Box>
                )}
              </FormField>
              {selectedFinancialOverview ? (
                <FormField label="Financial Overview form mode">
                  <RadioGroup
                    value={financialOverviewMode}
                    onChange={({ detail }) => setFinancialOverviewMode(detail.value)}
                    items={[
                      {
                        value: 'prefill',
                        label: 'Pre-fill with PATH data',
                        description: 'Send the current participant details as editable starting values.'
                      },
                      {
                        value: 'blank',
                        label: 'Send blank form',
                        description: 'Ask the participant to complete the Financial Overview from scratch.'
                      }
                    ]}
                    disabled={composeSending}
                  />
                </FormField>
              ) : null}
              <Checkbox
                checked={!!composeUrgent}
                onChange={({ detail }) => setComposeUrgent(detail.checked)}
                disabled={composeSending}
              >
                Mark as urgent
              </Checkbox>
              <Checkbox
                checked={recipientConfirmed}
                onChange={({ detail }) => setRecipientConfirmed(detail.checked)}
                disabled={composeSending}
              >
                I have checked the recipient and case.
              </Checkbox>
              {composeError ? <Box color="text-status-critical">{composeError}</Box> : null}
            </SpaceBetween>
          </div>
        </Container>
      </div>
    </>
  );
};

export default SecureMessageComposePanel;
