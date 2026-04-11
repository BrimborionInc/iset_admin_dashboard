const DAY_MS = 86400000;

export const SLA_DEFAULT_DAYS = {
  assignment: 3,
  ei_status_verification: 3,
  assessment: 10,
  program_decision: 2,
};

export const SLA_STAGE_ALLOWLIST = new Set(Object.keys(SLA_DEFAULT_DAYS));

export const SLA_STAGE_LABELS = {
  assignment: 'Assignment',
  ei_status_verification: 'EI Status Verification',
  assessment: 'Assessment',
  program_decision: 'Program decision',
};

export const COMPLETED_APPLICATION_STATUSES = new Set([
  'approved',
  'completed',
  'rejected',
  'declined',
  'cancelled',
  'closed',
  'archived',
]);

export const DECISION_APPLICATION_STATUSES = new Set(['pending_approval', 'decision_ready']);

export const ASSESSMENT_APPLICATION_STATUSES = new Set([
  'in_review',
  'in review',
  'docs_requested',
  'docs requested',
  'action_required',
  'action required',
  'action required (docs requested)',
  'closure_notice',
  'closure notice',
  'pending info',
  'pending information',
  'info requested',
  'information requested',
  'on hold',
  'on_hold',
]);

export function normalizeClosedStatus(status) {
  const key = (status || '').toString().trim().toLowerCase();
  return key === 'withdrawn' ? 'closed' : key;
}

export function isEligibilityPending(value) {
  return !String(value || '').trim();
}

export function isEligibilityComplete(value) {
  return !isEligibilityPending(value);
}

export function getApplicationSlaStageKey({
  rawStatus,
  isAssigned,
  assessmentEligibility,
}) {
  const statusKey = normalizeClosedStatus(rawStatus || '');
  if (COMPLETED_APPLICATION_STATUSES.has(statusKey)) {
    return null;
  }
  if (DECISION_APPLICATION_STATUSES.has(statusKey)) {
    return 'program_decision';
  }
  if (
    isAssigned &&
    isEligibilityPending(assessmentEligibility) &&
    (statusKey === 'submitted' || ASSESSMENT_APPLICATION_STATUSES.has(statusKey))
  ) {
    return 'ei_status_verification';
  }
  if (ASSESSMENT_APPLICATION_STATUSES.has(statusKey) || (statusKey === 'submitted' && isAssigned)) {
    return 'assessment';
  }
  return 'assignment';
}

export function formatApplicationSlaLabel(meta) {
  if (!meta) return 'Unknown';
  if (meta.deltaDays === null || meta.deltaDays === undefined) {
    return meta.label || (meta.stage ? `${SLA_STAGE_LABELS[meta.stage] || 'Timeline'} target unknown` : 'Unknown');
  }
  const stageLabel = SLA_STAGE_LABELS[meta.stage] || 'Timeline';
  if (meta.deltaDays > 0) {
    return `${stageLabel} due in ${meta.deltaDays} day${meta.deltaDays === 1 ? '' : 's'}`;
  }
  if (meta.deltaDays === 0) {
    return `${stageLabel} due today`;
  }
  const overdueDays = Math.abs(meta.deltaDays);
  return `${stageLabel} ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
}

const toDate = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

export function computeApplicationSlaMeta({
  submittedAt,
  createdAt,
  dueAt,
  slaTargets,
  rawStatus,
  isAssigned,
  assessmentEligibility,
}) {
  const submitted = toDate(submittedAt) || toDate(createdAt);
  if (!submitted) {
    return { ageDays: null, due: null, status: 'unknown', deltaDays: null, label: 'Unknown', stage: null };
  }
  const stage = getApplicationSlaStageKey({ rawStatus, isAssigned, assessmentEligibility });
  if (!stage) {
    return {
      ageDays: Math.floor((Date.now() - submitted.getTime()) / DAY_MS),
      due: toDate(dueAt) || submitted,
      status: 'ok',
      deltaDays: null,
      label: 'Complete',
      stage: null,
    };
  }
  const targetDays = Number(slaTargets?.[stage]) || SLA_DEFAULT_DAYS[stage] || 0;
  const nowMs = Date.now();
  if (!targetDays || Number.isNaN(targetDays)) {
    return {
      ageDays: Math.floor((nowMs - submitted.getTime()) / DAY_MS),
      due: null,
      status: 'unknown',
      deltaDays: null,
      label: 'Unknown',
      stage,
    };
  }
  const due = toDate(dueAt) || new Date(submitted.getTime() + targetDays * DAY_MS);
  const deltaDays = Math.floor((due.getTime() - nowMs) / DAY_MS);
  const label = formatApplicationSlaLabel({ stage, deltaDays });
  let status = 'ok';
  if (deltaDays < -4) {
    status = 'critical-overdue';
  } else if (deltaDays < 0) {
    status = 'high-overdue';
  } else if (deltaDays === 0) {
    status = 'due-today';
  } else if (deltaDays <= 3) {
    status = 'due-soon';
  }
  return {
    ageDays: Math.floor((nowMs - submitted.getTime()) / DAY_MS),
    due,
    status,
    deltaDays,
    label,
    stage,
  };
}
