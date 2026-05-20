import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  Badge,
  Button,
  ButtonDropdown,
  CopyToClipboard,
  FormField,
  Header,
  Icon,
  Link,
  Modal,
  Select,
  Textarea,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextFilter,
  Hotspot
} from '@cloudscape-design/components';
import { PROGRAM_ADMIN_BUCKETS } from './ProgramAdminWorkQueueWidget';
import { apiFetch } from '../../../auth/apiClient';
import { buildLockConflictMessage } from '../../../hooks/useApplicationLock';
import HomeApprovalsItemsHelp from '../../../helpPanelContents/homeApprovalsItemsHelp';
import HomeWorkQueueItemsHelp from '../../../helpPanelContents/homeWorkQueueItemsHelp';
import { buildApprovalWorkspacePath } from '../../../utils/approvalWorkspaceEntry';
import {
  SLA_DEFAULT_DAYS,
  computeApplicationSlaMeta,
  formatApplicationSlaLabel,
  isEligibilityPending,
} from '../../../utils/applicationSla';
import {
  buildApplicationStatusInfo,
  getApplicationStatusBadgeColor,
  normalizeApplicationStatus,
  normalizeStatusKey,
} from '../../../utils/applicationStatus';
import { resolveAssignedStaffProfileId } from '../../../utils/assignmentIdentity';
import {
  getCaseStatusBadgeColor,
  getCaseStatusIndicatorType,
  getCaseStatusLabel,
  normalizeCaseStatus,
} from '../../../utils/caseStatus';
import {
  formatInterventionStatusLabel,
  resolveInterventionStateFields,
} from '../../../utils/interventionStatus';
import {
  isSortableWorkQueueColumn,
  sortWorkQueueItems,
  toSortTimestamp,
} from './workQueueItemsSorting';

const COLUMN_WIDTHS_STORAGE_KEY = 'work-queue-items-column-widths-v1';
const WATCHLIST_REFRESH_EVENT = 'watchlist:refresh';
const ESDC_OPTIONS = [
  { label: 'CRF', value: 'CRF' },
  { label: 'EI Active Claim', value: 'EI Active Claim' },
  { label: 'EI Reach Back', value: 'EI Reach Back' }
];
const EI_ELIGIBILITY_ROLE_KEYS = new Set([
  'systemadministrator',
  'nwacadministrator',
  'regionalmanager'
]);
const MAX_INLINE_ACTIONS = 2;
const NO_ASSIGNMENT_BUCKET_IDS = new Set([
  'active-clients-checkins',
  'approvals-pipeline',
  'exceptions-escalations',
  'followups-closure',
  'funding-agreements',
  'my-clients',
  'overdue',
  'payments-issues',
  'payments-proof-due',
  'pending-completion',
  'pending-decision'
]);
const NO_ASSIGNMENT_ITEM_TYPES = new Set([
  'Agreement',
  'AwaitingApproval',
  'InterventionApproval',
  'InterventionCompletion',
  'InterventionMilestone',
  'Payment'
]);
const normalizeRoleKey = value =>
  String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');

const formatDateOnly = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const toDate = value => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const getWorkspacePath = item => {
  if (item?.workspacePath) return item.workspacePath;
  const caseId = item?.case_id || item?.caseId || null;
  if (!caseId) return null;
  const type = (item?.type || '').toString().trim().toLowerCase();
  if (type.includes('interventionapproval')) {
    return buildApprovalWorkspacePath({
      basePath: `/cases/${caseId}`,
      approvalType: 'intervention',
      step: 'decision',
      interventionId: item?.interventionId || item?.intervention_id || null,
      planId: item?.actionPlanId || item?.action_plan_id || null,
    });
  }
  if (type.includes('awaitingapproval')) {
    return buildApprovalWorkspacePath({
      basePath: `/application-case/${caseId}`,
      approvalType: 'application',
      step: 'decision',
    });
  }
  if (type.includes('intervention') || type.includes('case')) {
    return `/cases/${caseId}`;
  }
  return `/application-case/${caseId}`;
};

const hasAssignedOwner = item =>
  Boolean(resolveAssignedStaffProfileId(item)) ||
  Boolean(
    typeof item?.owner === 'string' &&
      item.owner.trim() &&
      !['unassigned', '—', '-'].includes(item.owner.trim().toLowerCase())
  );

const getAssignmentActionLabel = item => (hasAssignedOwner(item) ? 'Reassign' : 'Assign');

const resolveCaseId = item => {
  const raw = item?.case_id ?? item?.caseId ?? item?.caseID ?? null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const resolveConflictStaffProfileId = item => item?.staffProfileId || item?.staff_profile_id || null;

const PROVINCE_LABELS = {
  ab: 'Alberta',
  bc: 'British Columbia',
  mb: 'Manitoba',
  nb: 'New Brunswick',
  nl: 'Newfoundland and Labrador',
  ns: 'Nova Scotia',
  nt: 'Northwest Territories',
  nu: 'Nunavut',
  on: 'Ontario',
  pe: 'Prince Edward Island',
  qc: 'Quebec',
  sk: 'Saskatchewan',
  yt: 'Yukon Territory',
  xx: 'Test Region'
};

const normalizeProvinceKey = value => (value || '').toString().trim().toLowerCase();

const normalizeProvinceLabelKey = value =>
  normalizeProvinceKey(value)
    .replace(/&/g, 'and')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const PROVINCE_NAME_TO_CODE = Object.entries(PROVINCE_LABELS).reduce((acc, [code, name]) => {
  const normalized = normalizeProvinceLabelKey(name);
  if (normalized) {
    acc[normalized] = code.toUpperCase();
  }
  return acc;
}, {});

const resolveProvinceCode = value => {
  const raw = normalizeProvinceKey(value);
  if (!raw) return null;
  if (PROVINCE_LABELS[raw]) return raw.toUpperCase();
  if (raw.length === 2) return raw.toUpperCase();
  const normalizedLabel = normalizeProvinceLabelKey(raw);
  return PROVINCE_NAME_TO_CODE[normalizedLabel] || null;
};

const ROLE_DISPLAY_MAP = {
  'system administrator': 'System Administrator',
  'system_admin': 'System Administrator',
  'systemadministrator': 'System Administrator',
  'nwac administrator': 'NWAC Administrator',
  'regional manager': 'Regional Manager',
  'regionalmanager': 'Regional Manager',
  'iset coordinator': 'ISET Coordinator',
  'iset_coordinator': 'ISET Coordinator',
  'isetcoordinator': 'ISET Coordinator'
};

const formatRoleDisplay = role => {
  if (!role) return '—';
  const key = role.toString().trim().toLowerCase().replace(/\s+/g, ' ');
  return ROLE_DISPLAY_MAP[key] || ROLE_DISPLAY_MAP[key.replace(/\s+/g, '')] || ROLE_DISPLAY_MAP[key.replace(/\s+/g, '_')] || role;
};

const ELIGIBILITY_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/tiff'
];
const ELIGIBILITY_MAX_BYTES = 6 * 1024 * 1024;

const getDaysAgo = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  return Math.max(diffDays, 0);
};

const formatDaysAgo = value => {
  const days = getDaysAgo(value);
  if (days === null) return null;
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const formatSlaTargetLabel = meta => {
  return formatApplicationSlaLabel(meta);
};

const computeSlaMeta = (row, slaTargets, rawStatus, isAssigned) => {
  return computeApplicationSlaMeta({
    submittedAt: row.submittedAt || row.receivedAt || row.submitted_at,
    createdAt: row.created_at,
    dueAt: row.dueDate || row.sla_due_at,
    slaTargets,
    rawStatus: rawStatus || row.status || 'submitted',
    isAssigned,
    assessmentEligibility: row.assessment_esdc_eligibility,
  });
};

const computeApprovalSlaMeta = (row, slaTargets) => {
  return computeApplicationSlaMeta({
    submittedAt: row.approvalQueuedAt || row.submittedAt || row.receivedAt || row.submitted_at,
    createdAt: row.created_at,
    dueAt: row.dueDate || row.sla_due_at,
    slaTargets,
    rawStatus: 'pending_approval',
    isAssigned: true,
    assessmentEligibility: row.assessment_esdc_eligibility || 'complete',
  });
};

const renderSlaBadge = meta => {
  const label = formatSlaTargetLabel(meta);
  const title = `Timeline (${meta?.stage || 'unknown'}): ${label} | Age: ${meta?.ageDays ?? 'n/a'}d | Due: ${meta?.due ? meta.due.toLocaleDateString() : 'n/a'}`;
  const badge = (() => {
    switch (meta?.status) {
      case 'critical-overdue':
        return <Badge color="severity-critical">{label}</Badge>;
      case 'high-overdue':
        return <Badge color="severity-high">{label}</Badge>;
      case 'due-today':
        return <Badge color="severity-medium">{label}</Badge>;
      case 'due-soon':
        return <Badge color="severity-low">{label}</Badge>;
      case 'ok':
        return <Badge color="green">{label}</Badge>;
      default:
        return <Badge color="grey">{label || 'Unknown'}</Badge>;
    }
  })();
  return (
    <span title={title} aria-label={title}>
      {badge}
    </span>
  );
};

const formatApprovalSlaBadgeLabel = meta => {
  const deltaDays = meta?.deltaDays;
  if (deltaDays === null || deltaDays === undefined) {
    return meta?.label || 'Unknown';
  }
  if (deltaDays > 0) {
    return `Due in ${deltaDays} day${deltaDays === 1 ? '' : 's'}`;
  }
  if (deltaDays === 0) {
    return 'Due today';
  }
  const overdueDays = Math.abs(deltaDays);
  return `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
};

const renderApprovalSlaBadge = meta => {
  const label = formatApprovalSlaBadgeLabel(meta);
  const title = `Timeline (${meta?.stage || 'unknown'}): ${meta?.label || label} | Age: ${meta?.ageDays ?? 'n/a'}d | Due: ${meta?.due ? meta.due.toLocaleDateString() : 'n/a'}`;
  const badge = (() => {
    switch (meta?.status) {
      case 'critical-overdue':
        return <Badge color="severity-critical">{label}</Badge>;
      case 'high-overdue':
        return <Badge color="severity-high">{label}</Badge>;
      case 'due-today':
        return <Badge color="severity-medium">{label}</Badge>;
      case 'due-soon':
        return <Badge color="severity-low">{label}</Badge>;
      case 'ok':
        return <Badge color="green">{label}</Badge>;
      default:
        return <Badge color="grey">{label || 'Unknown'}</Badge>;
    }
  })();
  return (
    <span title={title} aria-label={title}>
      {badge}
    </span>
  );
};

const getInterventionStatusInfo = row => {
  const typeKey = normalizeStatusKey(row?.type || '');
  const interventionState = resolveInterventionStateFields({
    status: row?.status || row?.intervention_status || null,
    reviewStatus: row?.review_status ?? row?.reviewStatus ?? row?.proposal_review_status ?? row?.proposalReviewStatus ?? null,
    deliveryStatus: row?.delivery_status ?? row?.deliveryStatus ?? null,
  });
  const rawStatus =
    (typeKey.includes('approval')
      ? interventionState.reviewStatus || interventionState.effectiveStatus
      : interventionState.effectiveStatus || interventionState.reviewStatus) ||
    interventionState.legacyStatus ||
    'unknown';
  let statusType = 'info';
  let badgeColor = 'blue';
  switch (rawStatus) {
    case 'draft':
      statusType = 'stopped';
      badgeColor = 'grey';
      break;
    case 'submitted':
    case 'in_review':
      statusType = 'info';
      badgeColor = 'blue';
      break;
    case 'changes_requested':
      statusType = 'warning';
      badgeColor = 'orange';
      break;
    case 'approved':
      statusType = 'success';
      badgeColor = 'green';
      break;
    case 'in_progress':
      statusType = 'info';
      badgeColor = 'blue';
      break;
    case 'suspended':
      statusType = 'warning';
      badgeColor = 'orange';
      break;
    case 'completed':
      statusType = 'success';
      badgeColor = 'green';
      break;
    case 'cancelled':
      statusType = 'stopped';
      badgeColor = 'grey';
      break;
    case 'rejected':
      statusType = 'error';
      badgeColor = 'red';
      break;
    default:
      statusType = 'info';
      badgeColor = 'grey';
      break;
  }
  return {
    rawStatus,
    statusLabel: formatInterventionStatusLabel(rawStatus),
    statusType,
    badgeColor,
  };
};

const getStatusInfo = (row) => {
  const typeKey = normalizeStatusKey(row?.type || '');
  const isCaseLifecycleItem =
    typeKey === 'case' ||
    typeKey === 'clientcase' ||
    typeKey === 'casework' ||
    (typeKey.includes('case') && !typeKey.includes('intervention') && !typeKey.includes('approval'));
  if (isCaseLifecycleItem) {
    const rawStatus = normalizeCaseStatus(row.status || row.case_status || '');
    const isUnassignedCase =
      Boolean(row.case_id ?? row.caseId ?? row.id) &&
      !resolveAssignedStaffProfileId(row) &&
      rawStatus === 'intake';
    const qualifiers = [];
    if (isUnassignedCase) {
      qualifiers.push('Unassigned');
    }
    const baseLabel = getCaseStatusLabel(rawStatus);
    return {
      rawStatus,
      statusLabel: qualifiers.length ? `${baseLabel} • ${qualifiers.join(' • ')}` : baseLabel,
      statusType: getCaseStatusIndicatorType(rawStatus),
      badgeColor: getCaseStatusBadgeColor(rawStatus),
      isUnassignedCase,
    };
  }

  if (typeKey.includes('intervention')) {
    return getInterventionStatusInfo(row);
  }

  return buildApplicationStatusInfo({
    applicationStatus: row.status || row.application_status || null,
    applicationLifecycleStatus: row.application_lifecycle_status ?? row.applicationLifecycleStatus ?? null,
    caseStatus: row.case_status || null,
    caseId: row.case_id ?? row.caseId ?? null,
    assignedUserId: resolveAssignedStaffProfileId(row),
    assessmentEligibility: row.assessment_esdc_eligibility,
    decisionOutcome: row.decision_outcome ?? row.decisionOutcome ?? null,
    awaitingReason: row.application_awaiting_reason ?? row.applicationAwaitingReason ?? null,
    closureReason: row.application_closure_reason ?? row.applicationClosureReason ?? null,
    type: row.type,
  });
};

const boardItemI18n = {
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
};

const settingsDropdown = actions =>
  actions?.removeItem ? (
    <ButtonDropdown
      ariaLabel="Board item settings"
      variant="icon"
      items={[{ id: 'remove', text: 'Remove' }]}
      onItemClick={({ detail }) => {
        if (detail.id === 'remove') {
          actions.removeItem();
        }
      }}
    />
  ) : undefined;

const columnDefinitionsByKey = {
  title: {
    id: 'title',
    header: 'Item',
    cell: item => {
      const displayName = item.applicant || item.applicant_name || item.applicantName || item.title || item.id || '—';
      const workspacePath = getWorkspacePath(item);
      const hasExplicitSecondaryContent = Object.prototype.hasOwnProperty.call(item, 'titleSecondaryContent');
      const hasExplicitSecondaryText = Object.prototype.hasOwnProperty.call(item, 'titleSecondaryText');
      const secondaryContent = hasExplicitSecondaryContent
        ? item.titleSecondaryContent
        : hasExplicitSecondaryText
          ? (item.titleSecondaryText ?? '')
          : (
              [
                item.trackingId || item.id || null,
                formatDateOnly(item.submittedAt || item.receivedAt)
                  ? `Received ${formatDateOnly(item.submittedAt || item.receivedAt)}`
                  : null
              ].filter(Boolean).join(' · ') || '—'
            );
      return (
        <SpaceBetween size="xxs">
          <Box fontWeight="bold">
            <Link
              href={workspacePath || '#'}
              onFollow={event => {
                if (!workspacePath) {
                  event.preventDefault();
                }
              }}
            >
              {displayName}
            </Link>
          </Box>
          {secondaryContent ? (
            <Box fontSize="body-s" color="text-status-inactive">
              {secondaryContent}
            </Box>
          ) : null}
        </SpaceBetween>
      );
    },
    sortingField: 'applicant'
  },
  recommendation: {
    id: 'recommendation',
    header: 'Recommendation',
    cell: item => item.recommendation ? item.recommendation.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—',
    sortingField: 'recommendation'
  },
  intervention: {
    id: 'intervention',
    header: 'Proposed Intervention',
    cell: item => item.intervention_label || item.intervention_code || '—',
    sortingField: 'intervention_code'
  },
  cost: {
    id: 'cost',
    header: 'Proposed Cost',
    cell: item => {
      if (!item.intervention_cost_total) return '—';
      const num = Number(item.intervention_cost_total);
      return Number.isFinite(num) ? `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : item.intervention_cost_total;
    },
    sortingField: 'intervention_cost_total'
  },
  startDate: {
    id: 'startDate',
    header: 'Start Date',
    cell: item => formatDateOnly(item.intervention_start_date) || '—',
    sortingField: 'intervention_start_date'
  },
  type: {
    id: 'type',
    header: 'Type',
    cell: item => item.type || '—',
    sortingField: 'type'
  },
  eiStatus: {
    id: 'eiStatus',
    header: 'EI status',
    cell: item => item.assessment_esdc_eligibility || 'Not yet verified',
    sortingField: 'assessment_esdc_eligibility'
  },
  metricSubject: {
    id: 'metricSubject',
    header: 'Details',
    cell: item => item.metricSubject || item.summary || '—',
    sortingField: 'metricSubject'
  },
  eventDate: {
    id: 'eventDate',
    header: 'Date',
    cell: item => formatDateOnly(item.metricEventDate || item.eventDate) || '—',
    sortingField: 'metricEventDate'
  },
  notes: {
    id: 'notes',
    header: 'Notes',
    cell: item => {
      const list = Array.isArray(item.notes_list) ? item.notes_list.filter(Boolean) : null;
      if (list && list.length) {
        return list.join(' • ');
      }
      return item.notes || '—';
    },
    sortingField: 'notes'
  },
  sin: {
    id: 'sin',
    header: 'SIN',
    cell: item => {
      if (!item.sin) return '—';
      const compactSin = String(item.sin).replace(/\s+/g, '');
      return (
        <CopyToClipboard
          textToCopy={compactSin}
          variant="inline"
          copyButtonAriaLabel={`Copy SIN ${compactSin}`}
          copySuccessText="SIN copied"
          copyErrorText="SIN failed to copy"
        >
          {item.sin}
        </CopyToClipboard>
      );
    },
    sortingField: 'sin'
  },
  region: {
    id: 'region',
    header: 'Province',
    cell: item => {
      const code = resolveProvinceCode(item.address_province || item.region || '');
      return code || '—';
    },
    sortingField: 'region'
  },
  owner: {
    id: 'owner',
    header: 'Owner',
    cell: item => item.owner || 'Unassigned',
    sortingField: 'owner'
  },
  status: {
    id: 'status',
    header: 'Status',
    cell: item => {
      const statusInfo = getStatusInfo(item);
      return <StatusIndicator type={statusInfo.statusType}>{statusInfo.statusLabel}</StatusIndicator>;
    },
    sortingField: 'status'
  },
  staff: {
    id: 'staff',
    header: 'Conflicted Staff',
    cell: item => item.staffEmail || item.owner || '—',
    sortingField: 'staffEmail'
  },
  role: {
    id: 'role',
    header: 'Role',
    cell: item => formatRoleDisplay(item.staffRole),
    sortingField: 'staffRole'
  },
  details: {
    id: 'details',
    header: 'Details',
    cell: item => item.details || item.summary || '—',
    sortingField: 'details'
  },
  signedAt: {
    id: 'signedAt',
    header: 'Signed At',
    cell: item => {
      const date = toDate(item.signedAt || item.submittedAt);
      return date ? date.toLocaleString() : '—';
    },
    sortingField: 'signedAt'
  },
  dueDate: {
    id: 'dueDate',
    header: 'Due',
    sortingField: 'dueDate',
    cell: item => formatDateOnly(item.dueDate) || '—'
  },
  approvalQueuedAt: {
    id: 'approvalQueuedAt',
    header: 'Timeline target',
    sortingField: 'approvalQueuedAt',
    cell: item => formatDateOnly(item.approvalQueuedAt || item.submittedAt || item.receivedAt) || '—'
  },
  actions: {
    id: 'actions',
    header: 'Actions',
    cell: () => null
  }
};

const columnKeysByType = {
  Application: ['title', 'region', 'owner', 'status', 'dueDate', 'actions'],
  Case: ['title', 'region', 'owner', 'status', 'dueDate', 'actions'],
  Intervention: ['title', 'region', 'owner', 'status', 'dueDate', 'actions'],
  InterventionMilestone: ['title', 'intervention', 'region', 'status', 'dueDate', 'actions'],
  Agreement: ['title', 'owner', 'status', 'dueDate', 'actions'],
  Reporting: ['title', 'region', 'status', 'dueDate', 'actions'],
  File: ['title', 'owner', 'status', 'dueDate', 'actions'],
  Conflict: ['title', 'staff', 'role', 'region', 'details', 'signedAt', 'actions'],
  Eligibility: ['title', 'sin', 'region', 'owner', 'status', 'dueDate', 'actions'],
  AwaitingApproval: ['title', 'owner', 'recommendation', 'intervention', 'cost', 'startDate', 'status', 'dueDate', 'actions'],
  InterventionApproval: ['title', 'owner', 'intervention', 'cost', 'startDate', 'status', 'dueDate', 'actions'],
  InterventionCompletion: ['title', 'owner', 'intervention', 'cost', 'startDate', 'status', 'dueDate', 'actions'],
  Exception: ['title', 'notes', 'region', 'owner', 'status', 'dueDate', 'actions'],
  Escalation: ['title', 'notes', 'region', 'owner', 'status', 'dueDate', 'actions'],
  WatchlistHit: ['title', 'sin', 'region', 'owner', 'status', 'notes', 'actions']
};

const mixedColumnKeys = ['title', 'type', 'owner', 'status', 'dueDate', 'actions'];
const approvalColumnKeys = ['title', 'region', 'eiStatus', 'owner', 'approvalQueuedAt', 'actions'];
const metricColumnKeysByPreset = {
  'metric-applications': ['title', 'region', 'owner', 'status', 'eventDate', 'actions'],
  'metric-cases': ['title', 'region', 'owner', 'status', 'actions'],
  'metric-action-plans': ['title', 'metricSubject', 'region', 'owner', 'eventDate', 'actions'],
  'metric-interventions': ['title', 'intervention', 'region', 'owner', 'status', 'eventDate', 'actions']
};

const buildColumns = (types = [], selectedBucketId = null) => {
  if (selectedBucketId === 'pending-decision' || selectedBucketId === 'approvals-pipeline') {
    return approvalColumnKeys;
  }
  if (!types || types.length === 0) {
    return mixedColumnKeys;
  }
  if (types.length === 1) {
    const template = columnKeysByType[types[0]];
    if (template) {
      return template;
    }
    return ['title', 'owner', 'status', 'dueDate', 'actions'];
  }
  return mixedColumnKeys;
};

const loadStoredColumnWidths = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(entry => {
        if (!entry || typeof entry !== 'object') return null;
        const id = typeof entry.id === 'string' ? entry.id : null;
        const width = Number(entry.width);
        if (!id || !Number.isFinite(width)) return null;
        return { id, width };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const persistColumnWidths = widths => {
  if (typeof window === 'undefined') return;
  try {
    if (!Array.isArray(widths) || !widths.length) {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
      return;
    }
    const payload = widths
      .map(entry => {
        if (!entry || typeof entry !== 'object') return null;
        const id = typeof entry.id === 'string' ? entry.id : null;
        const width = Number(entry.width);
        if (!id || !Number.isFinite(width)) return null;
        return { id, width };
      })
      .filter(Boolean);
    if (!payload.length) {
      window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

const WorkQueueItemsTableWidget = ({
  mode = 'queue',
  metricView = null,
  onCloseMetricView,
  selectedBucketId,
  bucketDefinitions = PROGRAM_ADMIN_BUCKETS,
  items = [],
  role,
  actions,
  onRefresh,
  toggleHelpPanel
}) => {
  const isAssessor = role === 'ISET Coordinator';
  const roleKey = normalizeRoleKey(role);
  const canManageEiEligibility = EI_ELIGIBILITY_ROLE_KEYS.has(roleKey);
  const isMetricMode = mode === 'metric';
  const metricItems = isMetricMode && Array.isArray(metricView?.items) ? metricView.items : [];
  const metricLoading = isMetricMode && Boolean(metricView?.loading);
  const metricError = isMetricMode ? metricView?.error || '' : '';
  const [filteringText, setFilteringText] = useState('');
  const [sortingState, setSortingState] = useState({ columnId: null, isDescending: false });
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [eligibilityModalVisible, setEligibilityModalVisible] = useState(false);
  const [eligibilityTarget, setEligibilityTarget] = useState(null);
  const [selectedEligibility, setSelectedEligibility] = useState(null);
  const [eligibilitySubmitting, setEligibilitySubmitting] = useState(false);
  const [eligibilityError, setEligibilityError] = useState(null);
  const [eligibilityFile, setEligibilityFile] = useState(null);
  const [eligibilityFileError, setEligibilityFileError] = useState(null);
  const [eligibilityApplicantId, setEligibilityApplicantId] = useState(null);
  const eligibilityFileInputRef = useRef(null);
  const [watchMap, setWatchMap] = useState(() => new Map());
  const [watchPending, setWatchPending] = useState(new Set());
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [escalationAction, setEscalationAction] = useState(null);
  const [escalationNote, setEscalationNote] = useState('');
  const [escalationSubmitting, setEscalationSubmitting] = useState(false);
  const [escalationError, setEscalationError] = useState(null);
  const selectedBucket =
    useMemo(
      () => (isMetricMode ? null : bucketDefinitions.find(bucket => bucket.id === selectedBucketId) || bucketDefinitions[0] || null),
      [bucketDefinitions, isMetricMode, selectedBucketId]
    );
  const isApprovalQueue = !isMetricMode && (selectedBucketId === 'pending-decision' || selectedBucketId === 'approvals-pipeline');
  const helpContent = isApprovalQueue
    ? <HomeApprovalsItemsHelp />
    : <HomeWorkQueueItemsHelp />;
  const helpTitle = isApprovalQueue ? 'Approval Items' : 'Work Queue Items';
  const helpAiContext = isApprovalQueue
    ? HomeApprovalsItemsHelp.aiContext
    : HomeWorkQueueItemsHelp.aiContext;
  const infoLink = toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(helpContent, helpTitle, helpAiContext || '');
      }}
    >
      Info
    </Link>
  ) : undefined;
  const shouldWrapLines = !isMetricMode && selectedBucket && ['exceptions-escalations', 'unresolved-conflicts'].includes(selectedBucket.id);
  const sourceItems = isMetricMode ? metricItems : items;
  const queueDescription = isApprovalQueue
    ? 'Application assessments, new intervention proposals, and proposed intervention changes waiting for a decision. Select an item to open the review layout.'
    : selectedBucket?.description || selectedBucket?.label;

  const decoratedItems = useMemo(() => {
    return sourceItems.map(item => {
      const caseId = resolveCaseId(item);
      return {
        ...item,
        __caseIdNumeric: caseId,
        __isWatched: caseId ? watchMap.has(caseId) : false
      };
    });
  }, [sourceItems, watchMap]);

  const tableItems = useMemo(() => {
    const scoped = isMetricMode
      ? decoratedItems
      : selectedBucket
        ? decoratedItems.filter(item => item.bucketId === selectedBucket.id)
        : [];
    if (!filteringText) return scoped;
    const needle = filteringText.toLowerCase();
    return scoped.filter(item => {
      const fields = [
        item.applicant,
        item.title,
        item.trackingId,
        item.approvalRequestTypeLabel,
        item.metricSubject,
        item.status,
        item.owner,
        item.region,
        item.notes
      ];
      return fields.some(v => v && String(v).toLowerCase().includes(needle));
    });
  }, [decoratedItems, filteringText, isMetricMode, selectedBucket]);

  const [columnWidths, setColumnWidths] = useState(() => loadStoredColumnWidths());

  const itemTypes = useMemo(() => {
    const types = new Set();
    tableItems.forEach(item => {
      if (item?.type) {
        types.add(item.type);
      }
    });
    return Array.from(types);
  }, [tableItems]);

  const [slaTargets, setSlaTargets] = useState(SLA_DEFAULT_DAYS);
  const resolveEscalationActionMeta = (actionId) => {
    if (actionId === 'respond') {
      return {
        title: 'Respond to escalation',
        body: 'Add guidance or next steps for the requester.',
        submitLabel: 'Send response',
        noteLabel: 'Response notes'
      };
    }
    if (actionId === 'resolve') {
      return {
        title: 'Resolve escalation',
        body: 'Resolving will close the escalation. Add a brief note describing the resolution.',
        submitLabel: 'Resolve',
        noteLabel: 'Resolution notes'
      };
    }
    if (actionId === 'escalate_up') {
      return {
        title: 'Escalate to NWAC Administrator',
        body: 'Forward this escalation to NWAC Administrators. Include the context and what you are requesting.',
        submitLabel: 'Escalate',
        noteLabel: 'Escalation notes'
      };
    }
    return null;
  };
  const openEscalationModal = useCallback((item, actionId) => {
    const meta = resolveEscalationActionMeta(actionId);
    if (!meta) return;
    setEscalationAction({
      actionId,
      item,
      ...meta
    });
    setEscalationNote('');
    setEscalationError(null);
  }, []);

  const openEligibilityModal = useCallback((item) => {
    setEligibilityTarget(item);
    setSelectedEligibility(
      item.assessment_esdc_eligibility
        ? { value: item.assessment_esdc_eligibility, label: item.assessment_esdc_eligibility }
        : null
    );
    const applicantIdFromItem =
      item.applicant_user_id ||
      item.applicantUserId ||
      item.user_id ||
      item.userId ||
      null;
    setEligibilityApplicantId(applicantIdFromItem);
    setEligibilityFile(null);
    setEligibilityFileError(null);
    setEligibilityError(null);
    setEligibilityModalVisible(true);
  }, []);

  const canOfferAssignmentAction = useCallback((item) => {
    if (isAssessor) return false;
    if (!resolveCaseId(item)) return false;
    if (NO_ASSIGNMENT_BUCKET_IDS.has(item?.bucketId)) return false;
    if (NO_ASSIGNMENT_ITEM_TYPES.has(item?.type)) return false;
    return true;
  }, [isAssessor]);

  const getInlineActionKeys = useCallback((item) => {
    const actionKeys = [];
    const addAction = key => {
      if (!key || actionKeys.includes(key) || actionKeys.length >= MAX_INLINE_ACTIONS) return;
      actionKeys.push(key);
    };
    const bucketId = item?.bucketId;
    const assignedOwner = hasAssignedOwner(item);

    if (bucketId === 'exceptions-escalations') {
      if (role !== 'NWAC Administrator' && role !== 'Regional Manager') {
        return actionKeys;
      }
      addAction('respond-escalation');
      addAction(role === 'Regional Manager' ? 'escalate-up' : 'resolve-escalation');
      return actionKeys;
    }

    if (bucketId === 'unresolved-conflicts') {
      if (canOfferAssignmentAction(item)) {
        addAction('assign');
      }
      if (resolveCaseId(item) && resolveConflictStaffProfileId(item)) {
        addAction('resolve-conflict');
      }
      return actionKeys;
    }

    if (bucketId === 'new-applications') {
      if (canOfferAssignmentAction(item)) {
        addAction('assign');
      }
      if (
        assignedOwner &&
        isEligibilityPending(item.assessment_esdc_eligibility) &&
        canManageEiEligibility
      ) {
        addAction('set-eligibility');
      }
      return actionKeys;
    }

    const canSetEligibilityFromPipeline =
      ['pending-assessment', 'in-assessment'].includes(bucketId) &&
      isEligibilityPending(item.assessment_esdc_eligibility);
    if (canSetEligibilityFromPipeline) {
      if (canOfferAssignmentAction(item)) {
        addAction('assign');
      }
      if (canManageEiEligibility) {
        addAction('set-eligibility');
      }
      return actionKeys;
    }

    if (canOfferAssignmentAction(item)) {
      addAction('assign');
    }
    return actionKeys;
  }, [canManageEiEligibility, canOfferAssignmentAction, role]);

  const renderInlineAction = useCallback((actionKey, item) => {
    if (actionKey === 'assign') {
      return (
        <Link
          key="assign"
          href="#"
          onFollow={event => {
            event.preventDefault();
            setAssignTarget(item);
            setAssignModalVisible(true);
          }}
        >
          {getAssignmentActionLabel(item)}
        </Link>
      );
    }
    if (actionKey === 'set-eligibility') {
      return (
        <Link
          key="set-eligibility"
          href="#"
          onFollow={event => {
            event.preventDefault();
            openEligibilityModal(item);
          }}
        >
          Set Eligibility
        </Link>
      );
    }
    if (actionKey === 'respond-escalation') {
      return (
        <Link
          key="respond-escalation"
          href="#"
          onFollow={event => {
            event.preventDefault();
            openEscalationModal(item, 'respond');
          }}
        >
          Respond
        </Link>
      );
    }
    if (actionKey === 'escalate-up') {
      return (
        <Link
          key="escalate-up"
          href="#"
          onFollow={event => {
            event.preventDefault();
            openEscalationModal(item, 'escalate_up');
          }}
        >
          Escalate to NWAC Administrator
        </Link>
      );
    }
    if (actionKey === 'resolve-escalation') {
      return (
        <Link
          key="resolve-escalation"
          href="#"
          onFollow={event => {
            event.preventDefault();
            openEscalationModal(item, 'resolve');
          }}
        >
          Resolve
        </Link>
      );
    }
    if (actionKey === 'resolve-conflict') {
      return (
        <Link
          key="resolve-conflict"
          href="#"
          onFollow={event => {
            event.preventDefault();
            setResolveTarget(item);
          }}
        >
          Resolve
        </Link>
      );
    }
    return null;
  }, [openEligibilityModal, openEscalationModal]);

  const hasInlineActions = useMemo(
    () => !isMetricMode && tableItems.some(item => getInlineActionKeys(item).length > 0),
    [getInlineActionKeys, isMetricMode, tableItems]
  );

  const resolveEscalationId = item => item?.escalation_id || item?.escalationId || null;
  const resolveEscalationApplicationId = item => item?.application_id || item?.applicationId || null;
  const handleEscalationSubmit = useCallback(async () => {
    if (!escalationAction) return;
    const note = escalationNote.trim();
    if (!note) {
      setEscalationError('Add notes before continuing.');
      return;
    }
    const escalationId = resolveEscalationId(escalationAction.item);
    if (!escalationId) {
      setEscalationError('Escalation record missing for this item.');
      return;
    }
    const applicationId = resolveEscalationApplicationId(escalationAction.item);
    if (!applicationId) {
      setEscalationError('Application reference missing for this escalation.');
      return;
    }
    setEscalationSubmitting(true);
    setEscalationError(null);
    let releaseLockAfter = false;
    try {
      const lockResponse = await apiFetch(`/api/locks/application/${applicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      let lockBody = null;
      try {
        lockBody = await lockResponse.json();
      } catch (_) {
        lockBody = null;
      }
      if (!lockResponse.ok) {
        const reason = lockBody?.reason || lockBody?.error || 'locked';
        const message = lockResponse.status === 423
          ? buildLockConflictMessage({ reason, lock: lockBody?.lock })
          : (lockBody?.message || lockBody?.error || 'Failed to acquire a lock for this application.');
        setEscalationError(message);
        return;
      }
      releaseLockAfter = !lockBody?.lock?.reused;

      const actionId = escalationAction.actionId;
      const action = actionId === 'escalate_up' ? 'escalate' : actionId;
      const payload = {
        action,
        note,
        disposition: actionId
      };
      if (actionId === 'escalate_up') {
        payload.targetRole = 'nwac_administrator';
      }
      const response = await apiFetch(`/api/escalations/${escalationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => null);
      if (response.status === 423) {
        const message = buildLockConflictMessage({ reason: body?.reason || body?.error, lock: body?.lock });
        setEscalationError(message);
        return;
      }
      if (!response.ok) {
        throw new Error(body?.message || body?.error || 'Escalation action failed.');
      }
      setEscalationAction(null);
      setEscalationNote('');
      setEscalationError(null);
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
    } catch (error) {
      setEscalationError(error?.message || 'Escalation action failed.');
    } finally {
      setEscalationSubmitting(false);
      if (releaseLockAfter) {
        try {
          await apiFetch(`/api/locks/application/${applicationId}`, { method: 'DELETE' });
        } catch (_) {}
      }
    }
  }, [escalationAction, escalationNote, onRefresh]);

  const notifyWatchlistRefresh = useCallback((detail = {}) => {
    try {
      window.dispatchEvent(new CustomEvent(WATCHLIST_REFRESH_EVENT, { detail }));
    } catch (_) {
      // no-op if window unavailable
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/me/case-watches')
      .then(response => {
        if (!response.ok) {
          throw new Error('fetch_failed');
        }
        return response.json();
      })
      .then(data => {
        if (cancelled) return;
        const map = new Map();
        (Array.isArray(data) ? data : []).forEach(entry => {
          const caseId = resolveCaseId(entry);
          if (caseId) {
            map.set(caseId, entry);
          }
        });
        setWatchMap(map);
      })
      .catch(error => {
        if (cancelled) return;
        console.error('[work-queue-items] failed to load watchlist', error);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  const handleToggleWatch = useCallback(async (item) => {
    const caseId = resolveCaseId(item);
    if (!caseId) {
      return;
    }
    const isCurrentlyWatched = watchMap.has(caseId);
    setWatchPending(prev => {
      const next = new Set(prev);
      next.add(caseId);
      return next;
    });

    try {
      const response = await apiFetch(`/api/cases/${caseId}/watch`, {
        method: isCurrentlyWatched ? 'DELETE' : 'POST',
        headers: isCurrentlyWatched ? undefined : { 'Content-Type': 'application/json' },
        body: isCurrentlyWatched ? undefined : JSON.stringify({})
      });

      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok || (body && body.error)) {
        const err = new Error(body?.error || 'watch_failed');
        err.status = response.status;
        throw err;
      }

      if (isCurrentlyWatched) {
        setWatchMap(prev => {
          const next = new Map(prev);
          next.delete(caseId);
          return next;
        });
        notifyWatchlistRefresh({ caseId, watched: false });
      } else {
        const watchEntry = body?.watch || { caseId };
        setWatchMap(prev => {
          const next = new Map(prev);
          next.set(caseId, watchEntry);
          return next;
        });
        notifyWatchlistRefresh({ caseId, watched: true });
      }
    } catch (error) {
      console.error('[work-queue-items] watch toggle failed', error);
    } finally {
      setWatchPending(prev => {
        const next = new Set(prev);
        next.delete(caseId);
        return next;
      });
    }
  }, [notifyWatchlistRefresh, watchMap]);

  useEffect(() => {
    let cancelled = false;
    const loadSlaTargets = async () => {
      try {
        const res = await apiFetch('/api/config/sla-targets');
        if (!res.ok) throw new Error('Failed to load workflow timing targets');
        const data = await res.json();
        const targets = Array.isArray(data?.targets) ? data.targets : [];
        const next = { ...SLA_DEFAULT_DAYS };
        targets.forEach(item => {
          const key = item.stage_key || item.stage;
          if (!key || !(key in next)) return;
          const hours = item.target_hours ?? item.targetHours;
          if (hours === null || hours === undefined) return;
          const days = Number(hours) / 24;
          if (!Number.isNaN(days) && days > 0) {
            next[key] = Math.round(days);
          }
        });
        if (!cancelled) {
          setSlaTargets(next);
        }
      } catch (_) {
        if (!cancelled) {
          setSlaTargets(SLA_DEFAULT_DAYS);
        }
      }
    };
    loadSlaTargets();
    return () => {
      cancelled = true;
    };
  }, []);

  const columnDefinitions = useMemo(() => {
    let keys = isMetricMode
      ? (metricColumnKeysByPreset[metricView?.columnPreset] || metricColumnKeysByPreset['metric-applications'])
      : buildColumns(itemTypes, selectedBucketId);
    keys = ['watch', ...keys];
    const dedupedKeys = [];
    const seen = new Set();
    keys.forEach(key => {
      if (!seen.has(key)) {
        seen.add(key);
        dedupedKeys.push(key);
      }
    });
    const isMilestoneQueue =
      !isMetricMode &&
      (
        selectedBucketId === 'active-clients-checkins' ||
        selectedBucketId === 'followups-closure' ||
        (itemTypes.length === 1 && itemTypes[0] === 'InterventionMilestone')
      );
    if (isAssessor) {
      keys = dedupedKeys.filter(key => key !== 'owner');
    } else {
      keys = dedupedKeys;
    }
    const widthsMap = new Map(columnWidths.map(entry => [entry.id, entry.width]));
    const watchColumn = {
      id: 'watch',
      header: 'Tag',
      sortingField: '__isWatched',
      minWidth: 45,
      width: widthsMap.get('watch'),
      cell: item => {
        const caseId = item.__caseIdNumeric ?? resolveCaseId(item);
        const isWatchable = Number.isFinite(caseId) && caseId > 0;
        const isWatched = Boolean(item.__isWatched);
        const pending = isWatchable && watchPending.has(caseId);
        const icon = (
          <Icon
            name="flag"
            size="small"
            variant={isWatched ? 'error' : 'normal'}
          />
        );
        return (
          <Button
            variant="icon"
            iconSvg={icon}
            disabled={!isWatchable || pending}
            ariaLabel={isWatched ? 'Untag case' : 'Tag case'}
            onClick={() => handleToggleWatch(item)}
            title={!isWatchable ? 'Case record not yet created' : (isWatched ? 'Remove tag' : 'Tag this case')}
          />
        );
      }
    };
    return keys
      .map(key => {
        if (key === 'watch') {
          return watchColumn;
        }
        const base = columnDefinitionsByKey[key];
        if (!base) return null;
        if (base.id === 'actions' && !hasInlineActions) {
          return null;
        }
        const widthOverride = widthsMap.get(base.id);
        if (base.id === 'metricSubject') {
          return {
            ...base,
            width: widthOverride,
            header: metricView?.subjectLabel || base.header
          };
        }
        if (base.id === 'eventDate') {
          return {
            ...base,
            width: widthOverride,
            header: metricView?.eventDateLabel || base.header
          };
        }
        if (base.id === 'intervention' && isMilestoneQueue) {
          return {
            ...base,
            width: widthOverride,
            header: 'Intervention'
          };
        }
        if (base.id === 'status' && !isMetricMode) {
          return {
            ...base,
            width: widthOverride,
            cell: item => {
              const statusInfo = getStatusInfo(item);
              const normalizedKey = normalizeStatusKey(statusInfo.rawStatus || item.status || '');
              const isDocsRequestedStatus = ['docs_requested', 'action_required', 'action_required_(docs_requested)'].includes(normalizedKey);
              const docsRequestedActive =
                Number(item.docs_requested_active || 0) === 1 || isDocsRequestedStatus;
              const docsRequestedSince =
                item.docs_requested_at ||
                item.docsRequestedAt ||
                item.updatedAt ||
                item.updated_at ||
                item.last_activity_at ||
                item.submittedAt ||
                item.receivedAt ||
                item.submitted_at ||
                item.created_at ||
                null;
              const docsRequestedDays = docsRequestedActive ? getDaysAgo(docsRequestedSince) : null;
              const docsRequestedSuffix = docsRequestedActive ? formatDaysAgo(docsRequestedSince) : null;
              const docsRequestedLabel = docsRequestedActive
                ? `Docs Requested${docsRequestedSuffix ? ` ${docsRequestedSuffix}` : ''}`
                : null;
              const docsRequestedColor = (() => {
                if (!docsRequestedActive || docsRequestedDays === null) return null;
                if (docsRequestedDays > 28) return 'severity-critical';
                if (docsRequestedDays >= 15) return 'severity-high';
                if (docsRequestedDays >= 7) return 'severity-medium';
                if (docsRequestedDays >= 3) return 'severity-low';
                return 'grey';
              })();
              const statusBadgeColor = statusInfo.badgeColor || getApplicationStatusBadgeColor(statusInfo.rawStatus || item.status || 'unknown');
              return (
                <SpaceBetween size="xxs">
                  <Badge color={statusBadgeColor}>{statusInfo.statusLabel}</Badge>
                  {docsRequestedLabel ? (
                    <Badge color={docsRequestedColor || 'grey'}>{docsRequestedLabel}</Badge>
                  ) : null}
                </SpaceBetween>
              );
            }
          };
        }
        if (base.id === 'dueDate' && !isMetricMode) {
          if (isMilestoneQueue) {
            return {
              ...base,
              header: 'Milestone',
              width: widthOverride,
              cell: item => {
                const label = item.milestoneLabel || formatDateOnly(item.dueDate) || '—';
                const color = item.milestoneStatus || 'grey';
                return <Badge color={color}>{label}</Badge>;
              }
            };
          }
          if (selectedBucketId === 'regional-client-cases' || selectedBucketId === 'all-client-cases') {
            return {
              ...base,
              header: 'Next action',
              width: widthOverride,
              cell: item => formatDateOnly(item.dueDate) || '—'
            };
          }
          if (selectedBucketId === 'overdue' || selectedBucketId === 'payments-proof-due') {
            return {
              ...base,
              header: 'Due',
              width: widthOverride,
              cell: item => formatDateOnly(item.dueDate) || '—'
            };
          }
          return {
            ...base,
            header: 'Timeline target',
            width: widthOverride,
            cell: item => renderSlaBadge(
              computeSlaMeta(
                item,
                slaTargets,
                normalizeApplicationStatus(item.status || 'submitted'),
                Boolean(resolveAssignedStaffProfileId(item))
              )
            )
          };
        }
        if (base.id === 'approvalQueuedAt' && !isMetricMode) {
          return {
            ...base,
            header: 'Timeline target',
            width: widthOverride,
            cell: item => renderApprovalSlaBadge(computeApprovalSlaMeta(item, slaTargets))
          };
        }
        if (base.id === 'actions') {
          return {
            ...base,
            width: widthOverride,
            cell: item => {
              const actionKeys = getInlineActionKeys(item);
              if (!actionKeys.length) return null;
              return (
                <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                  {actionKeys.map(actionKey => renderInlineAction(actionKey, item))}
                </SpaceBetween>
              );
            }
          };
        }
        return widthOverride ? { ...base, width: widthOverride } : base;
      })
      .filter(Boolean);
  }, [
    isMetricMode,
    itemTypes,
    metricView?.columnPreset,
    metricView?.eventDateLabel,
    metricView?.subjectLabel,
    selectedBucketId,
    slaTargets,
    columnWidths,
    isAssessor,
    hasInlineActions,
    getInlineActionKeys,
    renderInlineAction,
    watchPending,
    handleToggleWatch
  ]);

  const activeSortingColumn = useMemo(
    () => columnDefinitions.find(column => column.id === sortingState.columnId && isSortableWorkQueueColumn(column)) || null,
    [columnDefinitions, sortingState.columnId]
  );
  const activeSortingColumnId = activeSortingColumn?.id || null;

  const sortedTableItems = useMemo(() => {
    if (!activeSortingColumnId) return tableItems;
    return sortWorkQueueItems(tableItems, activeSortingColumnId, {
      isDescending: sortingState.isDescending,
      resolveProvinceCode,
      formatRoleDisplay,
      resolveStatusLabel: item => getStatusInfo(item).statusLabel,
      resolveDueDateSortValue: item => {
        const isClientCasesQueue =
          selectedBucketId === 'regional-client-cases' ||
          selectedBucketId === 'all-client-cases';
        if (!isMetricMode && !isClientCasesQueue) {
          const meta = computeSlaMeta(
            item,
            slaTargets,
            normalizeApplicationStatus(item.status || 'submitted'),
            Boolean(resolveAssignedStaffProfileId(item))
          );
          const computedDue = toSortTimestamp(meta?.due);
          if (computedDue !== null) {
            return computedDue;
          }
        }
        const rawDue = toSortTimestamp(
          item.dueDate ||
          item.sla_due_at ||
          item.nextActionDueAt ||
          item.next_action_due_at
        );
        return rawDue !== null ? rawDue : item.milestoneLabel || null;
      },
      resolveApprovalTimelineSortValue: item => {
        const meta = computeApprovalSlaMeta(item, slaTargets);
        const computedDue = toSortTimestamp(meta?.due);
        if (computedDue !== null) {
          return computedDue;
        }
        return toSortTimestamp(
          item.approvalQueuedAt ||
          item.approval_queued_at ||
          item.submittedAt ||
          item.receivedAt ||
          item.submitted_at
        );
      }
    });
  }, [
    activeSortingColumnId,
    isMetricMode,
    selectedBucketId,
    slaTargets,
    sortingState.isDescending,
    tableItems
  ]);

  const emptyState = isMetricMode
    ? metricLoading
      ? 'Loading metric results...'
      : metricError
        ? 'Metric results could not be loaded.'
        : 'No records matched this metric for the selected period.'
    : selectedBucket
      ? 'No items are available for this queue yet.'
      : 'Select a work queue to see items.';

  useEffect(() => {
    if (!assignModalVisible || !assignTarget || !resolveCaseId(assignTarget)) {
      return undefined;
    }
    let cancelled = false;
    const loadAssignable = async () => {
      setAssignLoading(true);
      setAssignError(null);
      try {
        const res = await apiFetch('/api/staff/assignable');
        if (!res.ok) throw new Error('assignable_fetch_failed');
        const data = await res.json();
        if (cancelled) return;
        const options = Array.isArray(data)
          ? data.map(staff => ({
              label: `${staff.display_name || staff.email || staff.id} (${staff.role || 'Staff'})`,
              value: String(staff.id)
            }))
          : [];
        setAssignableStaff(options);
      } catch (err) {
        if (!cancelled) {
          setAssignError('Unable to load assignable staff.');
        }
      } finally {
        if (!cancelled) {
          setAssignLoading(false);
        }
      }
    };
    loadAssignable();
    return () => {
      cancelled = true;
    };
  }, [assignModalVisible, assignTarget]);

  const handleAssignSubmit = async () => {
    const caseId = resolveCaseId(assignTarget);
    if (!caseId || !selectedAssignee?.value) {
      setAssignError('Select an assignee.');
      return;
    }
    setAssignSubmitting(true);
    setAssignError(null);
    try {
      const response = await apiFetch(`/api/cases/${caseId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: selectedAssignee.value })
      });
      if (!response.ok) {
        throw new Error('assign_failed');
      }
      const conflictStaffProfileId = resolveConflictStaffProfileId(assignTarget);
      if (assignTarget?.bucketId === 'unresolved-conflicts' && conflictStaffProfileId) {
        try {
          await apiFetch(`/api/cases/${caseId}/conflicts/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staff_profile_id: conflictStaffProfileId })
          });
        } catch (_) {
          // non-fatal
        }
      }
      setAssignModalVisible(false);
      setAssignTarget(null);
      setSelectedAssignee(null);
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
      // mirror ApplicationsWidget behavior: surface assign success to UI
      setAssignError(null);
    } catch (err) {
      setAssignError('Assignment failed. Please try again.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const resolveApplicantUserId = async ({ caseId, fallbackApplicantId }) => {
    if (fallbackApplicantId) return fallbackApplicantId;
    if (!caseId) return null;
    try {
      const res = await apiFetch(`/api/cases/${caseId}`);
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      if (!data) return null;
      return (
        data.applicant_user_id ||
        data.applicantUserId ||
        data.applicant_id ||
        data.applicantId ||
        data.user_id ||
        data.userId ||
        null
      );
    } catch (_) {
      return null;
    }
  };

  const handleEligibilitySubmit = async () => {
    if (!canManageEiEligibility) {
      setEligibilityError('You do not have permission to set EI eligibility.');
      return;
    }
    const caseId = eligibilityTarget?.case_id || eligibilityTarget?.caseId;
    const applicationId = eligibilityTarget?.application_id || eligibilityTarget?.applicationId;
    const applicantUserId =
      eligibilityApplicantId ||
      eligibilityTarget?.applicant_user_id ||
      eligibilityTarget?.applicantUserId ||
      eligibilityTarget?.user_id ||
      eligibilityTarget?.userId ||
      null;
    const value = selectedEligibility?.value || selectedEligibility?.label;
    if (!caseId || !value) {
      setEligibilityError('Select an eligibility value.');
      return;
    }
    if (!eligibilityFile) {
      setEligibilityError('Upload the EI verification document.');
      setEligibilityFileError('Upload the EI verification document.');
      return;
    }
    const resolvedApplicantId = await resolveApplicantUserId({ caseId, fallbackApplicantId: applicantUserId });
    if (!resolvedApplicantId) {
      setEligibilityError('Unable to determine the applicant for this upload.');
      return;
    }
    setEligibilitySubmitting(true);
    setEligibilityError(null);
    setEligibilityFileError(null);
    try {
      if (applicationId) {
        await apiFetch(`/api/locks/application/${applicationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
      }
      const formData = new FormData();
      formData.append('file', eligibilityFile);
      formData.append('label', 'EI Verification');
      formData.append('documentType', 'ei_verification');
      if (caseId) formData.append('caseId', caseId);
      if (applicationId) formData.append('applicationId', applicationId);
      const uploadResponse = await apiFetch(`/api/applicants/${resolvedApplicantId}/documents/upload`, {
        method: 'POST',
        body: formData
      });
      if (!uploadResponse || !uploadResponse.ok) {
        let payload = null;
        try {
          payload = await uploadResponse.json();
        } catch (_) {
          payload = null;
        }
        const code = payload?.error;
        if (code === 'unsupported_file_type') {
          throw new Error('That file type is not allowed. Please upload a PDF, Word (.doc or .docx), JPG, PNG, BMP, or TIFF file.');
        }
        if (code === 'file_too_large') {
          throw new Error('The file is too large to upload.');
        }
        if (code === 'application_required_for_document') {
          throw new Error('Select an application before uploading this document.');
        }
        if (code === 'invalid_document_type') {
          throw new Error('The EI Verification document type is not available.');
        }
        throw new Error('Failed to upload EI verification document.');
      }
      const response = await apiFetch(`/api/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_esdc_eligibility: value })
      });
      if (!response.ok) {
        throw new Error('eligibility_failed');
      }
      if (applicationId) {
        try {
          await apiFetch(`/api/locks/application/${applicationId}`, { method: 'DELETE' });
        } catch (_) {}
      }
      setEligibilityModalVisible(false);
      setEligibilityTarget(null);
      setSelectedEligibility(null);
      setEligibilityFile(null);
      setEligibilityApplicantId(null);
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
    } catch (_) {
      setEligibilityError('Failed to save eligibility. Please try again.');
    } finally {
      setEligibilitySubmitting(false);
    }
  };

  const handleResolveConfirm = async () => {
    const caseId = resolveCaseId(resolveTarget);
    const conflictStaffProfileId = resolveConflictStaffProfileId(resolveTarget);
    if (!caseId || !conflictStaffProfileId) {
      setResolveTarget(null);
      return;
    }
    setResolveSubmitting(true);
    try {
      const resp = await apiFetch(`/api/cases/${caseId}/conflicts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_profile_id: conflictStaffProfileId })
      });
      if (!resp.ok) {
        throw new Error('resolve_failed');
      }
      setResolveTarget(null);
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
    } catch (_) {
      setAssignError('Failed to resolve conflict.');
    } finally {
      setResolveSubmitting(false);
    }
  };
  const escalationHeader = (() => {
    const target = escalationAction?.item?.trackingId || escalationAction?.item?.title || null;
    if (escalationAction?.title && target) return `${escalationAction.title} — ${target}`;
    return escalationAction?.title || 'Escalation action';
  })();
  const metricSummaryParts = [
    metricView?.periodIndependent ? metricView?.scopeNote : metricView?.period?.rangeLabel,
    metricView?.truncated ? `Showing first ${metricItems.length} result(s)` : `${metricItems.length} item(s)`
  ].filter(Boolean);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          actions={
            isMetricMode && typeof onCloseMetricView === 'function' ? (
              <Button onClick={onCloseMetricView}>Back to work queue</Button>
            ) : undefined
          }
          description={
            isMetricMode
              ? metricLoading
                ? 'Loading metric results...'
              : metricSummaryParts.join(' · ') || 'Metric drilldown results.'
              : selectedBucket
                ? `${queueDescription} · ${tableItems.length} item(s)`
                : 'Select a work queue to view its items.'
          }
        >
          <Hotspot hotspotId="home-work-queue-items" direction="right" />
          {isMetricMode
            ? `${metricView?.metricLabel || 'Metric'} Results`
            : selectedBucket
              ? `${selectedBucket.label} Items`
              : 'Work Queue Items'}
        </Header>
      }
      settings={settingsDropdown(actions)}
      i18nStrings={boardItemI18n}
    >
      {metricError ? (
        <Box color="text-status-error" margin={{ bottom: 's' }}>
          {metricError}
        </Box>
      ) : null}
      <Table
        variant="embedded"
        trackBy="id"
        items={sortedTableItems}
        columnDefinitions={columnDefinitions}
        sortingColumn={activeSortingColumn || undefined}
        sortingDescending={sortingState.isDescending}
        onSortingChange={({ detail }) => {
          const columnId = detail?.sortingColumn?.id;
          if (columnId) {
            setSortingState({ columnId, isDescending: Boolean(detail.isDescending) });
          }
        }}
        resizableColumns
        stickyHeader
        enableKeyboardNavigation
        wrapLines={shouldWrapLines}
        loading={metricLoading}
        loadingText="Loading metric results"
        filter={
          <TextFilter
            filteringText={filteringText}
            filteringPlaceholder={isMetricMode ? 'Search metric results' : 'Search queue items'}
            onChange={({ detail }) => setFilteringText(detail.filteringText || '')}
          />
        }
        onColumnWidthsChange={({ detail }) => {
          const widths = Array.isArray(detail?.widths)
            ? detail.widths
            : Array.isArray(detail?.columnWidths)
            ? detail.columnWidths
            : [];
          const parsed = widths
            .map(entry => {
              if (!entry || typeof entry !== 'object') return null;
              const id = typeof entry.id === 'string' ? entry.id : null;
              const width = Number(entry.width);
              if (!id || !Number.isFinite(width)) return null;
              return { id, width };
            })
            .filter(Boolean);
          setColumnWidths(parsed);
          persistColumnWidths(parsed);
        }}
        empty={<Box variant="p">{emptyState}</Box>}
      />
      {canManageEiEligibility && (
        <Modal
          visible={eligibilityModalVisible}
          onDismiss={() => {
            setEligibilityModalVisible(false);
            setEligibilityTarget(null);
            setSelectedEligibility(null);
            setEligibilityFile(null);
            setEligibilityFileError(null);
            setEligibilityApplicantId(null);
            setEligibilityError(null);
          }}
          header="Set EI Eligibility"
          closeAriaLabel="Close eligibility modal"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => {
                  setEligibilityModalVisible(false);
                  setEligibilityTarget(null);
                  setSelectedEligibility(null);
                  setEligibilityFile(null);
                  setEligibilityFileError(null);
                  setEligibilityApplicantId(null);
                  setEligibilityError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={eligibilitySubmitting}
                disabled={!selectedEligibility?.value || !eligibilityFile || eligibilitySubmitting}
                onClick={handleEligibilitySubmit}
              >
                Save
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            {eligibilityError && <Box color="text-status-error">{eligibilityError}</Box>}
            <FormField label="EI Eligibility" stretch>
              <Select
                options={ESDC_OPTIONS}
                selectedOption={selectedEligibility}
                onChange={({ detail }) => setSelectedEligibility(detail.selectedOption || null)}
                filteringType="auto"
                placeholder="Select eligibility"
              />
            </FormField>
            <FormField label="EI Verification document" errorText={eligibilityFileError} stretch>
              <input
                type="file"
                ref={eligibilityFileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
                onChange={event => {
                  const file = event?.target?.files?.[0] || null;
                  if (event?.target) {
                    event.target.value = '';
                  }
                  if (file) {
                    if (!ELIGIBILITY_ALLOWED_MIME_TYPES.includes(file.type)) {
                      setEligibilityFile(null);
                      setEligibilityFileError('Only PDF, Word (.doc or .docx), JPG, PNG, BMP, or TIFF files are allowed.');
                      return;
                    }
                    if (file.size > ELIGIBILITY_MAX_BYTES) {
                      setEligibilityFile(null);
                      setEligibilityFileError('File is too large (max 6 MB).');
                      return;
                    }
                  }
                  setEligibilityFile(file);
                  setEligibilityFileError(file ? null : eligibilityFileError);
                }}
              />
              <SpaceBetween size="xs" direction="horizontal">
                <Button onClick={() => eligibilityFileInputRef.current && eligibilityFileInputRef.current.click()}>
                  Choose file
                </Button>
                <Box>{eligibilityFile ? eligibilityFile.name : 'No file selected'}</Box>
              </SpaceBetween>
              <Box variant="small" color="text-body-secondary">
                Max size 6 MB. Allowed types: PDF, Word (.doc, .docx), JPG, PNG, BMP, TIFF.
              </Box>
            </FormField>
          </SpaceBetween>
        </Modal>
      )}
      <Modal
        visible={assignModalVisible}
        onDismiss={() => {
          setAssignModalVisible(false);
          setAssignTarget(null);
          setSelectedAssignee(null);
          setAssignError(null);
        }}
        header={`${getAssignmentActionLabel(assignTarget)} ${assignTarget?.trackingId || assignTarget?.title || 'item'}`}
        closeAriaLabel="Close assign modal"
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            <Button
              onClick={() => {
                setAssignModalVisible(false);
                setAssignTarget(null);
                setSelectedAssignee(null);
                setAssignError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={assignSubmitting}
              disabled={!selectedAssignee?.value}
              onClick={handleAssignSubmit}
            >
              {getAssignmentActionLabel(assignTarget)}
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          {assignError && (
            <Box color="text-status-error">{assignError}</Box>
          )}
          <FormField label="Assign to" stretch>
            <Select
              placeholder={assignLoading ? 'Loading...' : 'Select assignee'}
              options={assignableStaff}
              selectedOption={selectedAssignee}
              onChange={({ detail }) => setSelectedAssignee(detail.selectedOption || null)}
              disabled={assignLoading}
              filteringType="auto"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={Boolean(escalationAction)}
        onDismiss={() => {
          setEscalationAction(null);
          setEscalationNote('');
          setEscalationError(null);
        }}
        header={escalationHeader}
        closeAriaLabel="Close escalation action"
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            <Button
              onClick={() => {
                setEscalationAction(null);
                setEscalationNote('');
                setEscalationError(null);
              }}
              disabled={escalationSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={escalationSubmitting}
              disabled={escalationSubmitting || !escalationNote.trim()}
              onClick={handleEscalationSubmit}
            >
              {escalationAction?.submitLabel || 'Continue'}
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          {escalationError && <Box color="text-status-error">{escalationError}</Box>}
          {escalationAction?.body && <Box>{escalationAction.body}</Box>}
          <FormField label={escalationAction?.noteLabel || 'Notes'} stretch>
            <Textarea
              value={escalationNote}
              onChange={({ detail }) => setEscalationNote(detail.value)}
              rows={3}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={Boolean(resolveTarget)}
        onDismiss={() => {
          setResolveTarget(null);
        }}
        header="Resolve conflict"
        closeAriaLabel="Close resolve modal"
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            <Button
              onClick={() => setResolveTarget(null)}
              disabled={resolveSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={resolveSubmitting}
              onClick={handleResolveConfirm}
            >
              Resolve
            </Button>
          </SpaceBetween>
        }
      >
        <Box>
          Resolve conflict for {resolveTarget?.trackingId || resolveTarget?.title || 'this item'}?
        </Box>
      </Modal>
    </BoardItem>
  );
};

export default WorkQueueItemsTableWidget;
