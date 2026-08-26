import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Select,
  SpaceBetween,
  Spinner,
  Textarea
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';
import {
  isSupportedSecureMessageWorkflow,
  normalizeSigningWorkflowRecord,
  selectExactFundingActionPlans,
  signingWorkflowAcceptsInterventionScope,
} from '../lib/signingWorkflowAvailability';
import { resolveApplicationStateFields } from '../utils/applicationStatus';

export {
  isSupportedSecureMessageWorkflow,
  selectExactFundingActionPlans,
} from '../lib/signingWorkflowAvailability';

export const SECURE_MESSAGE_COMPOSE_OPEN_EVENT = 'secure-messaging:open-compose';
export const SECURE_MESSAGE_REFRESH_EVENT = 'secure-messaging:refresh';

export const openSecureMessageCompose = detail => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return false;
  return window.dispatchEvent(new CustomEvent(SECURE_MESSAGE_COMPOSE_OPEN_EVENT, { detail, cancelable: true }));
};

export const createSecureMessageClientOperationId = () => {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
};

const LETTER_DOC_TYPES = new Set(['assessment_approval_letter', 'assessment_denial_letter']);
const toNumberOrNull = value => {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const buildSecureMessageScopePayload = ({
  applicationId,
  interventionId,
  actionPlanId,
  replyToMessageId,
} = {}) => {
  const resolvedApplicationId = toNumberOrNull(applicationId);
  const resolvedInterventionId = toNumberOrNull(interventionId);
  const resolvedActionPlanId = toNumberOrNull(actionPlanId);
  const resolvedReplyToMessageId = toNumberOrNull(replyToMessageId);
  return {
    ...(Number.isInteger(resolvedApplicationId) && resolvedApplicationId > 0
      ? { applicationId: resolvedApplicationId }
      : {}),
    ...(Number.isInteger(resolvedInterventionId) && resolvedInterventionId > 0
      ? { interventionId: resolvedInterventionId }
      : {}),
    ...(Number.isInteger(resolvedActionPlanId) && resolvedActionPlanId > 0
      ? { actionPlanId: resolvedActionPlanId }
      : {}),
    ...(Number.isInteger(resolvedReplyToMessageId) && resolvedReplyToMessageId > 0
      ? { reply_to: resolvedReplyToMessageId }
      : {}),
  };
};

const ACTION_PLAN_SELECTION_ERROR_CODES = new Set([
  'cfa_action_plan_selection_required',
  'cfa_action_plan_scope_conflict',
  'cfa_action_plan_unavailable',
]);

const parseSecureMessageSendFailure = detail => {
  const raw = typeof detail === 'string' ? detail.trim() : '';
  if (!raw) return { code: null, message: 'Failed to send message' };
  try {
    const parsed = JSON.parse(raw);
    return {
      code: parsed?.error || parsed?.code || null,
      message: parsed?.message || parsed?.error || 'Failed to send message',
    };
  } catch (_) {
    return { code: null, message: raw };
  }
};

const SecureMessageComposePanel = ({
  caseId: propCaseId = null,
  caseData = null,
  isCaseWorkspace = false,
  selectedInterventionId = null,
  refreshCaseData,
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
  const [confirmedInterventionId, setConfirmedInterventionId] = useState(null);
  const [fundingActionPlans, setFundingActionPlans] = useState([]);
  const [fundingActionPlansLoading, setFundingActionPlansLoading] = useState(false);
  const [fundingActionPlansLoaded, setFundingActionPlansLoaded] = useState(false);
  const [fundingActionPlansError, setFundingActionPlansError] = useState(null);
  const [selectedFundingActionPlanId, setSelectedFundingActionPlanId] = useState(null);
  const [fundingActionPlanRequired, setFundingActionPlanRequired] = useState(false);
  const composeSendInFlightRef = useRef(false);
  const composeSendAttemptRef = useRef(null);
  const fundingActionPlanLoadGenerationRef = useRef(0);
  const composeScopeIdentityRef = useRef(null);

  const buildComposeContext = useCallback(
    (detail = {}) => {
      const nextIsCaseWorkspace =
        typeof detail.isCaseWorkspace === 'boolean' ? detail.isCaseWorkspace : isCaseWorkspace;
      const nextCaseId = toNumberOrNull(detail.caseId) ?? caseId;
      const hasExplicitApplicationId = Object.prototype.hasOwnProperty.call(detail, 'applicationId');
      const nextApplicationId = hasExplicitApplicationId
        ? toNumberOrNull(detail.applicationId)
        : applicationId;
      const nextApplicantUserId = toNumberOrNull(detail.applicantUserId) ?? applicantUserId;
      const nextApplicantName = detail.applicantName || applicantName || 'Applicant';
      const nextInterventionId = toNumberOrNull(detail.interventionId);
      const nextActionPlanId = toNumberOrNull(detail.actionPlanId ?? detail.planId);
      const suggestedInterventionId = nextIsCaseWorkspace
        ? toNumberOrNull(detail.suggestedInterventionId) ?? interventionId
        : null;

      return {
        mode: detail.mode === 'reply' ? 'reply' : 'new',
        caseId: nextCaseId,
        applicationId: nextApplicationId,
        replyToMessageId: toNumberOrNull(detail.replyToMessageId ?? detail.reply_to),
        applicantUserId: nextApplicantUserId,
        applicantName: nextApplicantName,
        toName: detail.toName || nextApplicantName,
        fromName: detail.fromName || currentStaffName || 'Case Worker',
        caseReference: detail.caseReference || caseReference || (nextCaseId ? `Case ${nextCaseId}` : null),
        interventionId: nextInterventionId,
        actionPlanId: nextActionPlanId,
        suggestedInterventionId,
        isCaseWorkspace: nextIsCaseWorkspace,
        originWorkspaceCaseId: caseId,
        originWorkspaceApplicationId: applicationId,
        originWorkspaceApplicantUserId: applicantUserId,
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
        confirmedInterventionId ||
        (fundingActionPlans.length > 1 && selectedFundingActionPlanId) ||
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
    confirmedInterventionId,
    currentStaffName,
    financialOverviewMode,
    fundingActionPlans.length,
    selectedFundingActionPlanId,
    selectedWorkflowIds.length
  ]);

  const resetComposeDraft = useCallback(() => {
    fundingActionPlanLoadGenerationRef.current += 1;
    composeScopeIdentityRef.current = null;
    composeSendAttemptRef.current = null;
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
    setConfirmedInterventionId(null);
    setFundingActionPlans([]);
    setFundingActionPlansLoading(false);
    setFundingActionPlansLoaded(false);
    setFundingActionPlansError(null);
    setSelectedFundingActionPlanId(null);
    setFundingActionPlanRequired(false);
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
        .map(normalizeSigningWorkflowRecord)
        .filter(isSupportedSecureMessageWorkflow);
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

  const selectedWorkflowRows = useMemo(() => {
    const selected = new Set(selectedWorkflowIds.map(id => Number(id)));
    return filteredWorkflowOptions.filter(workflow => selected.has(Number(workflow.id)));
  }, [filteredWorkflowOptions, selectedWorkflowIds]);
  const selectedFundingAgreement = selectedWorkflowRows.some(
    workflow => workflow.documentType === 'funding_agreement'
  );
  const selectedApprovalLetter = selectedWorkflowRows.some(
    workflow => workflow.documentType === 'assessment_approval_letter'
  );
  const selectedInterventionScopeWorkflows = selectedWorkflowRows.filter(
    signingWorkflowAcceptsInterventionScope
  );
  const acceptsInterventionScope = selectedInterventionScopeWorkflows.length > 0;
  const needsFundingActionPlanContext = Boolean(
    selectedFundingAgreement || (selectedApprovalLetter && fundingActionPlanRequired)
  );
  const suggestedComposeInterventionId = toNumberOrNull(composeContext?.suggestedInterventionId);
  const explicitComposeInterventionId = toNumberOrNull(composeContext?.interventionId);
  const selectedInterventionScopeId = acceptsInterventionScope
    ? explicitComposeInterventionId || confirmedInterventionId || null
    : null;
  const needsFundingActionPlanSelection = Boolean(
    needsFundingActionPlanContext &&
    !selectedInterventionScopeId
  );

  const loadFundingActionPlans = useCallback(async (context = composeContext) => {
    const loadGeneration = fundingActionPlanLoadGenerationRef.current + 1;
    fundingActionPlanLoadGenerationRef.current = loadGeneration;
    const targetCaseId = toNumberOrNull(context?.caseId ?? caseId);
    const targetApplicationId = toNumberOrNull(context?.applicationId ?? applicationId);
    const targetScopeIdentity = `${targetCaseId || ''}:${targetApplicationId || ''}`;
    const loadIsCurrent = () => (
      fundingActionPlanLoadGenerationRef.current === loadGeneration &&
      composeScopeIdentityRef.current === targetScopeIdentity
    );
    if (!targetCaseId || !targetApplicationId) {
      if (loadIsCurrent()) {
        setFundingActionPlans([]);
        setFundingActionPlansLoading(false);
        setFundingActionPlansLoaded(true);
      }
      return [];
    }
    setFundingActionPlansLoading(true);
    setFundingActionPlansError(null);
    try {
      const locallyLoadedPlans = Array.isArray(caseData?.actionPlans) ? caseData.actionPlans : [];
      let rawPlans;
      try {
        const params = new URLSearchParams({ applicationId: String(targetApplicationId) });
        const response = await apiFetch(`/api/cases/${targetCaseId}/workspace?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload?.actionPlans)) throw new Error('Invalid Action Plan response');
        rawPlans = payload.actionPlans;
      } catch (error) {
        if (!selectExactFundingActionPlans(locallyLoadedPlans, targetApplicationId).length) {
          throw error;
        }
        // A loaded case view is a useful selection fallback, but the POST route
        // still revalidates it. Never treat an empty/stale view as proof that
        // the application has no Action Plan.
        rawPlans = locallyLoadedPlans;
      }
      const exactPlans = selectExactFundingActionPlans(rawPlans, targetApplicationId);
      if (!loadIsCurrent()) return [];
      setFundingActionPlans(exactPlans);
      setFundingActionPlansLoaded(true);
      setSelectedFundingActionPlanId(current => {
        const requested = toNumberOrNull(context?.actionPlanId);
        if (requested && exactPlans.some(plan => plan.id === requested)) return requested;
        if (current && exactPlans.some(plan => plan.id === current)) return current;
        return exactPlans.length === 1 ? exactPlans[0].id : null;
      });
      return exactPlans;
    } catch (error) {
      if (!loadIsCurrent()) return [];
      setFundingActionPlans([]);
      // Mark this load attempt complete so a transient API failure does not
      // create an unbounded render/fetch loop. Sending remains available and
      // the server still performs the authoritative application-plan check.
      setFundingActionPlansLoaded(true);
      setFundingActionPlansError('Action Plans could not be loaded. PATH will validate the application when you send.');
      return [];
    } finally {
      if (loadIsCurrent()) setFundingActionPlansLoading(false);
    }
  }, [applicationId, caseData?.actionPlans, caseId, composeContext]);

  useEffect(() => {
    if (!composePanelOpen || !needsFundingActionPlanSelection || fundingActionPlansLoaded || fundingActionPlansLoading) {
      return;
    }
    loadFundingActionPlans();
  }, [
    composePanelOpen,
    fundingActionPlansLoaded,
    fundingActionPlansLoading,
    loadFundingActionPlans,
    needsFundingActionPlanSelection
  ]);

  useEffect(() => {
    if (!acceptsInterventionScope) setConfirmedInterventionId(null);
    if (!selectedFundingAgreement && !selectedApprovalLetter) {
      setFundingActionPlanRequired(false);
    } else if (selectedFundingAgreement) {
      setFundingActionPlanRequired(Boolean(needsFundingActionPlanSelection));
    }
  }, [
    acceptsInterventionScope,
    needsFundingActionPlanSelection,
    selectedApprovalLetter,
    selectedFundingAgreement,
  ]);

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
      fundingActionPlanLoadGenerationRef.current += 1;
      composeScopeIdentityRef.current = `${nextContext.caseId || ''}:${nextContext.applicationId || ''}`;
      composeSendAttemptRef.current = null;
      setComposeContext(nextContext);
      setComposeSubject(typeof detail.subject === 'string' ? detail.subject : '');
      setComposeBody(typeof detail.body === 'string' ? detail.body : '');
      setComposeUrgent(Boolean(detail.urgent));
      setComposeToName(nextContext.toName);
      setComposeFromName(nextContext.fromName);
      setSelectedWorkflowIds([]);
      setFinancialOverviewMode('prefill');
      setConfirmedInterventionId(null);
      setFundingActionPlans([]);
      setFundingActionPlansLoading(false);
      setFundingActionPlansLoaded(false);
      setFundingActionPlansError(null);
      // An event may suggest a plan, but it does not become send authority
      // until the fresh exact-application list validates it below.
      setSelectedFundingActionPlanId(null);
      setFundingActionPlanRequired(false);
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
    const nextApplicationId = Number(applicationId || 0);
    const nextApplicantUserId = Number(applicantUserId || 0);
    if (!nextCaseId) return;
    const contextChanged =
      Number(composeContext.originWorkspaceCaseId || 0) !== nextCaseId ||
      (nextApplicationId > 0 && Number(composeContext.originWorkspaceApplicationId || 0) !== nextApplicationId) ||
      (nextApplicantUserId > 0 && Number(composeContext.originWorkspaceApplicantUserId || 0) !== nextApplicantUserId);
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
    applicationId,
    caseId,
    composeContext,
    composePanelOpen,
    hasComposeDraft,
    resetComposeDraft
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
    if (needsFundingActionPlanSelection && fundingActionPlansLoading) return;
    if (
      needsFundingActionPlanContext &&
      needsFundingActionPlanSelection &&
      fundingActionPlansLoaded &&
      fundingActionPlans.length > 1 &&
      !selectedFundingActionPlanId
    ) {
      setFundingActionPlanRequired(true);
      setComposeError(
        selectedFundingAgreement
          ? 'Choose the Action Plan for this funding agreement.'
          : 'Choose the Action Plan for this approval letter.'
      );
      return;
    }
    if (composeSendInFlightRef.current) return;
    composeSendInFlightRef.current = true;
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
      const sendApplicationId = composeContext && Object.prototype.hasOwnProperty.call(composeContext, 'applicationId')
        ? composeContext.applicationId
        : applicationId;
      const sendInterventionId = selectedInterventionScopeId;
      const sendActionPlanId = sendInterventionId
        ? null
        : (needsFundingActionPlanContext
            ? selectedFundingActionPlanId || null
            : null);
      Object.assign(payload, buildSecureMessageScopePayload({
        applicationId: sendApplicationId,
        interventionId: sendInterventionId,
        actionPlanId: sendActionPlanId,
        replyToMessageId: composeContext?.replyToMessageId,
      }));
      const operationFingerprint = JSON.stringify(payload);
      if (composeSendAttemptRef.current?.fingerprint !== operationFingerprint) {
        composeSendAttemptRef.current = {
          fingerprint: operationFingerprint,
          clientOperationId: createSecureMessageClientOperationId(),
        };
      }
      payload.clientOperationId = composeSendAttemptRef.current.clientOperationId;
      const response = await apiFetch(`/api/cases/${sendCaseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const failure = parseSecureMessageSendFailure(detail);
        const error = new Error(failure.message);
        error.code = failure.code;
        throw error;
      }
      if (typeof refreshCaseData === 'function') {
        try {
          await refreshCaseData();
        } catch (_) {}
      }
      resetComposeDraft();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(SECURE_MESSAGE_REFRESH_EVENT, { detail: { caseId: sendCaseId } }));
      }
    } catch (err) {
      if (ACTION_PLAN_SELECTION_ERROR_CODES.has(err?.code)) {
        setFundingActionPlanRequired(true);
        setSelectedFundingActionPlanId(null);
        await loadFundingActionPlans(composeContext);
      }
      setComposeError(err?.message || 'Failed to send message');
    } finally {
      composeSendInFlightRef.current = false;
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
  const fundingActionPlanOptions = useMemo(
    () => fundingActionPlans.map(plan => ({
      value: String(plan.id),
      label: plan.label,
      description: `Action Plan ${plan.id} - ${plan.status}`,
    })),
    [fundingActionPlans]
  );
  const selectedFundingActionPlanOption = fundingActionPlanOptions.find(
    option => Number(option.value) === Number(selectedFundingActionPlanId)
  ) || null;

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
                  (needsFundingActionPlanSelection && fundingActionPlansLoading) ||
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
              overflowX: 'hidden',
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
                      setConfirmedInterventionId(null);
                      setFundingActionPlanRequired(false);
                      setSelectedFundingActionPlanId(null);
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
              {acceptsInterventionScope && explicitComposeInterventionId ? (
                <FormField label="Intervention context">
                  <Box>
                    {selectedInterventionScopeWorkflows.length === 1 ? 'This form' : 'These forms'} will use intervention {explicitComposeInterventionId}.
                  </Box>
                </FormField>
              ) : null}
              {acceptsInterventionScope && !explicitComposeInterventionId && suggestedComposeInterventionId ? (
                <FormField
                  label="Intervention context"
                  description="Workspace selection is not sent unless you confirm it here."
                >
                  <Checkbox
                    checked={Number(confirmedInterventionId) === Number(suggestedComposeInterventionId)}
                    onChange={({ detail }) => {
                      setConfirmedInterventionId(detail.checked ? suggestedComposeInterventionId : null);
                    }}
                    disabled={composeSending}
                  >
                    Use selected intervention {suggestedComposeInterventionId} for {selectedInterventionScopeWorkflows.length === 1 ? 'this form' : 'these forms'}
                  </Checkbox>
                </FormField>
              ) : null}
              {needsFundingActionPlanSelection ? (
                <FormField
                  label={selectedFundingAgreement
                    ? 'Action Plan for the funding agreement'
                    : 'Action Plan for the approval letter'}
                  description={
                    fundingActionPlans.length > 1
                      ? 'Choose the exact Action Plan for this application. Workspace row selection is not used automatically.'
                      : 'Only an Action Plan belonging to this application can be used.'
                  }
                  errorText={
                    fundingActionPlanRequired && fundingActionPlans.length > 1 && !selectedFundingActionPlanId
                      ? 'Choose an Action Plan.'
                      : undefined
                  }
                >
                  {fundingActionPlansLoading ? (
                    <Box><Spinner size="normal" /> Loading Action Plans...</Box>
                  ) : fundingActionPlanOptions.length ? (
                    <Select
                      selectedOption={selectedFundingActionPlanOption}
                      onChange={({ detail }) => {
                        setSelectedFundingActionPlanId(toNumberOrNull(detail.selectedOption?.value));
                        setComposeError(null);
                      }}
                      options={fundingActionPlanOptions}
                      placeholder="Choose an Action Plan"
                      disabled={composeSending || fundingActionPlanOptions.length === 1}
                    />
                  ) : fundingActionPlansError ? (
                    <Box color="text-status-warning">{fundingActionPlansError}</Box>
                  ) : fundingActionPlansLoaded && selectedFundingAgreement ? (
                    <Box color="text-status-critical">
                      This application has no open Action Plan available for a funding agreement.
                    </Box>
                  ) : null}
                </FormField>
              ) : null}
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
              {composeError ? <Box color="text-status-critical">{composeError}</Box> : null}
            </SpaceBetween>
          </div>
        </Container>
      </div>
    </>
  );
};

export default SecureMessageComposePanel;
