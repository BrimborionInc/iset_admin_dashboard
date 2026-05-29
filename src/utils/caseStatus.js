export const CASE_FINAL_STATUSES = new Set(['ready_to_close', 'closed', 'archived']);

export const CASE_STATUS_SYNONYMS = Object.freeze({
  action_required: 'intake',
  'action_required_(docs_requested)': 'intake',
  assessed_pending_approval: 'intake',
  'assessed,_pending_approval': 'intake',
  approved: 'initiated',
  assessment_submitted: 'intake',
  assessment_submitted_pending_decision: 'intake',
  in_review: 'intake',
  open: 'intake',
  pending: 'intake',
  pending_approval: 'intake',
  rejected: 'archived',
  review_complete: 'ready_to_close',
  submitted: 'intake',
  withdrawn: 'closed',
});

const CASE_STATUS_LABELS = Object.freeze({
  intake: 'Intake',
  initiated: 'Initiated',
  active: 'Active',
  dormant: 'No Active Plan',
  ready_to_close: 'Ready To Close',
  closed: 'Closed',
  archived: 'Archived',
});

const CASE_STATUS_BADGE_COLORS = Object.freeze({
  intake: 'blue',
  initiated: 'grey',
  active: 'green',
  dormant: 'grey',
  ready_to_close: 'yellow',
  closed: 'green',
  archived: 'grey',
});

export function normalizeCaseStatus(status, fallback = '') {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return CASE_STATUS_SYNONYMS[normalized] || normalized || fallback;
}

export function getCaseStatusLabel(status) {
  const normalized = normalizeCaseStatus(status);
  if (!normalized) {
    return '-';
  }
  return CASE_STATUS_LABELS[normalized] || normalized
    .split(/[_-]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getCaseStatusBadgeColor(status) {
  return CASE_STATUS_BADGE_COLORS[normalizeCaseStatus(status)] || 'grey';
}

export function getCaseStatusIndicatorType(status) {
  switch (normalizeCaseStatus(status)) {
    case 'active':
    case 'closed':
      return 'success';
    case 'ready_to_close':
      return 'warning';
    case 'intake':
    case 'initiated':
    case 'dormant':
    case 'archived':
      return 'info';
    default:
      return 'info';
  }
}
