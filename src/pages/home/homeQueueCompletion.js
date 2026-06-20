import {
  normalizeApplicationStatus,
  normalizeDecisionOutcome,
} from '../../utils/applicationStatus';
import { buildApprovalWorkspacePath } from '../../utils/approvalWorkspaceEntry';

export const isDeniedCompletionRow = (row = {}) => {
  const decisionOutcome = normalizeDecisionOutcome(row.decision_outcome ?? row.decisionOutcome);
  if (decisionOutcome === 'denied') {
    return true;
  }
  return normalizeApplicationStatus(row.application_status ?? row.applicationStatus ?? row.status) === 'rejected';
};

export const isDenialDecisionLetterSent = (row = {}) =>
  row.denial_decision_letter_sent === true ||
  row.decisionLetterSentDenial === true ||
  row.denialDecisionLetterSent === true ||
  row.decision_letter_sent_denial === true ||
  Number(row.denial_decision_letter_sent || 0) === 1 ||
  Number(row.decisionLetterSentDenial || 0) === 1 ||
  Number(row.denialDecisionLetterSent || 0) === 1 ||
  Number(row.decision_letter_sent_denial || 0) === 1;

export const isPendingCompletionApplicationRow = (row = {}) => {
  const statusKey = normalizeApplicationStatus(row.application_status ?? row.applicationStatus ?? row.status ?? '');
  const lifecycleKey = normalizeApplicationStatus(
    row.application_lifecycle_status ?? row.applicationLifecycleStatus ?? ''
  );
  if (['completed', 'closed', 'archived', 'withdrawn', 'cancelled'].includes(statusKey)) {
    return false;
  }
  if (['closed', 'archived'].includes(lifecycleKey)) {
    return false;
  }
  if (isDeniedCompletionRow(row) && isDenialDecisionLetterSent(row)) {
    return false;
  }
  const decisionOutcome = normalizeDecisionOutcome(row.decision_outcome ?? row.decisionOutcome);
  return (
    lifecycleKey === 'decision_recorded' ||
    ['approved', 'rejected'].includes(statusKey) ||
    decisionOutcome === 'approved' ||
    decisionOutcome === 'denied'
  );
};

export const buildPendingCompletionApplicationSummary = (row = {}) => {
  const statusKey = normalizeApplicationStatus(row.application_status || row.status || '');
  if (statusKey === 'approved') {
    return 'Approved file still needs approval-letter, document/signature, or final checklist follow-through before completion.';
  }
  if (isDeniedCompletionRow(row)) {
    return isDenialDecisionLetterSent(row)
      ? 'Denied file is complete because the denial letter has been sent.'
      : 'Denied file is waiting for the denial letter before completion.';
  }
  return 'Decision-recorded file still needs post-decision follow-through before completion.';
};

export const isApprovalDecisionLetterSent = (row = {}) =>
  row.approval_decision_letter_sent === true ||
  row.decisionLetterSentApproval === true ||
  row.approvalDecisionLetterSent === true ||
  row.decision_letter_sent_approval === true ||
  Number(row.approval_decision_letter_sent || 0) === 1 ||
  Number(row.decisionLetterSentApproval || 0) === 1 ||
  Number(row.approvalDecisionLetterSent || 0) === 1 ||
  Number(row.decision_letter_sent_approval || 0) === 1;

export const resolvePendingCompletionApplicationStep = (row = {}) => {
  const decisionOutcome = normalizeDecisionOutcome(row.decision_outcome ?? row.decisionOutcome);
  const statusKey = normalizeApplicationStatus(row.application_status ?? row.applicationStatus ?? row.status ?? '');
  const isApproved = decisionOutcome === 'approved' || statusKey === 'approved';
  if (isApproved && isApprovalDecisionLetterSent(row)) {
    return 'fundingDocs';
  }
  return 'communication';
};

export const buildPendingCompletionApplicationWorkspacePath = (basePath, row = {}) =>
  buildApprovalWorkspacePath({
    basePath,
    approvalType: 'application',
    step: resolvePendingCompletionApplicationStep(row),
  });
