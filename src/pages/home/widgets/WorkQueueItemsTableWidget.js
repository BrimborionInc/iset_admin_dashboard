import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  Badge,
  Button,
  ButtonDropdown,
  CopyToClipboard,
  FormField,
  Header,
  Input,
  Link,
  Modal,
  RadioGroup,
  Select,
  Textarea,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextFilter
} from '@cloudscape-design/components';
import { PROGRAM_ADMIN_BUCKETS } from './ProgramAdminWorkQueueWidget';
import { apiFetch } from '../../../auth/apiClient';

const COLUMN_WIDTHS_STORAGE_KEY = 'work-queue-items-column-widths-v1';
const APPROVAL_COST_THRESHOLD = 25000;
const ESDC_OPTIONS = [
  { label: 'CRF', value: 'CRF' },
  { label: 'EI Active Claim', value: 'EI Active Claim' },
  { label: 'EI Reach Back', value: 'EI Reach Back' }
];

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
  if (type.includes('intervention') || type.includes('case')) {
    return `/cases/${caseId}`;
  }
  return `/application-case/${caseId}`;
};

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
  yt: 'Yukon Territory'
};

const normalizeProvinceCode = value => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 2).toUpperCase();
};

const mapEligibilityToFundingSource = value => {
  if (!value) return null;
  const norm = value.toString().trim().toLowerCase();
  if (!norm) return null;
  if (norm.includes('ei')) return 'EI';
  if (norm.includes('crf')) return 'CRF';
  return null;
};

const toBudgetPotOptions = list => {
  if (!Array.isArray(list)) return [];
  return list
    .filter(pot => {
      const potType = pot?.potType || pot?.pot_type || '';
      const normalizedType = potType ? potType.toString().trim().toLowerCase() : '';
      const isFundingStream = normalizedType === 'funding stream';
      const isActive = pot?.isActive !== false && pot?.is_active !== 0;
      return isActive && isFundingStream;
    })
    .map(pot => {
      const label = [pot.code, pot.name].filter(Boolean).join(' - ') || pot.name || pot.code || pot.id || pot.value;
      const value = pot.id ?? pot.value;
      return {
        label,
        value: value != null ? String(value) : '',
        fundingSource: pot.fundingSource || pot.funding_source || null,
        regions: Array.isArray(pot.regions) ? pot.regions : [],
      };
    })
    .filter(option => option.value)
    .sort((a, b) => (a.label || '').localeCompare(b.label || ''));
};

const ROLE_DISPLAY_MAP = {
  sysadmin: 'System Admin',
  'system administrator': 'System Admin',
  'system_admin': 'System Admin',
  'systemadministrator': 'System Admin',
  'program admin': 'Program Admin',
  'program administrator': 'Program Admin',
  'program_admin': 'Program Admin',
  'programadministrator': 'Program Admin',
  'regional coordinator': 'Regional Manager',
  'regional manager': 'Regional Manager',
  'regional_coordinator': 'Regional Manager',
  'regionalmanager': 'Regional Manager',
  'regionalcoordinator': 'Regional Manager',
  adjudicator: 'ISET Coordinator',
  'application assessor': 'ISET Coordinator',
  'application_assessor': 'ISET Coordinator',
  'applicationassessor': 'ISET Coordinator',
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
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/tiff'
];
const ELIGIBILITY_MAX_BYTES = 6 * 1024 * 1024;

const normalizeClosedStatus = status => {
  const key = (status || '').toString().trim().toLowerCase();
  return key === 'withdrawn' ? 'closed' : key;
};

const normalizeStatusKey = status =>
  (status || '').toString().trim().toLowerCase().replace(/[\s-]+/g, '_');

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

const statusColor = (status = '') => {
  const normalized = normalizeClosedStatus(status);
  if (['approved', 'completed'].includes(normalized)) return 'green';
  if ([
    'submitted',
    'in review',
    'in_review',
    'in progress',
    'in_progress',
    'pending',
    'assigned',
    'pending_approval',
    'decision_ready',
    'ready_to_close',
    'ready to close'
  ].includes(normalized)) {
    return 'blue';
  }
  if (['docs requested', 'docs_requested', 'action required', 'action required (docs requested)', 'closure notice', 'closure_notice'].includes(normalized)) {
    return 'severity-high';
  }
  if (['rejected', 'declined', 'errored'].includes(normalized)) return 'red';
  if (['closed', 'inactive', 'archived'].includes(normalized)) return 'grey';
  return 'grey';
};

const COMPLETED_STATUSES = new Set(['approved', 'completed', 'rejected', 'declined', 'cancelled', 'closed', 'archived']);
const DECISION_STATUSES = new Set(['pending_approval', 'decision_ready']);
const ASSESSMENT_STATUSES = new Set([
  'in_review', 'in review',
  'docs_requested', 'docs requested',
  'action_required', 'action required', 'action required (docs requested)',
  'closure_notice', 'closure notice',
  'pending info', 'pending information', 'info requested', 'information requested',
  'on hold', 'on_hold'
]);

const SLA_DEFAULT_DAYS = {
  assignment: 3,
  assessment: 10,
  program_decision: 2
};

const SLA_STAGE_LABELS = {
  assignment: 'Assignment',
  assessment: 'Assessment',
  program_decision: 'Decision'
};

const formatSlaTargetLabel = meta => {
  if (!meta) return 'Unknown';
  const stageLabel = SLA_STAGE_LABELS[meta.stage] || 'SLA';
  if (meta.deltaDays === null || meta.deltaDays === undefined) {
    return meta.label || `${stageLabel} target unknown`;
  }
  if (meta.deltaDays > 0) {
    return `${stageLabel} due in ${meta.deltaDays} day${meta.deltaDays === 1 ? '' : 's'}`;
  }
  if (meta.deltaDays === 0) {
    return `${stageLabel} due today`;
  }
  const overdueDays = Math.abs(meta.deltaDays);
  return `${stageLabel} ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
};

const computeSlaMeta = (row, slaTargets, rawStatus, isAssigned) => {
  const submitted = toDate(row.submittedAt || row.receivedAt || row.submitted_at || row.created_at);
  if (!submitted) {
    return { ageDays: null, due: null, status: 'unknown', deltaDays: null, label: 'Unknown', stage: null };
  }
  const due = row.dueDate ? toDate(row.dueDate) : null;
  const normalizedStatus = normalizeClosedStatus(rawStatus || row.status || 'submitted');
  if (COMPLETED_STATUSES.has(rawStatus)) {
    return {
      ageDays: Math.floor((Date.now() - submitted.getTime()) / 86400000),
      due: due || submitted,
      status: 'ok',
      deltaDays: null,
      label: 'Complete',
      stage: null
    };
  }
  let targetKey = 'assignment';
  if (DECISION_STATUSES.has(normalizedStatus)) {
    targetKey = 'program_decision';
  } else if (ASSESSMENT_STATUSES.has(normalizedStatus) || (normalizedStatus === 'submitted' && isAssigned)) {
    targetKey = 'assessment';
  } else {
    targetKey = 'assignment';
  }
  const targetDays = Number(slaTargets[targetKey]) || SLA_DEFAULT_DAYS[targetKey] || 0;
  const nowMs = Date.now();
  if (!targetDays || Number.isNaN(targetDays)) {
    return { ageDays: Math.floor((nowMs - submitted.getTime()) / 86400000), due: null, status: 'unknown', deltaDays: null, label: 'Unknown', stage: targetKey };
  }
  const ageDays = Math.floor((nowMs - submitted.getTime()) / 86400000);
  const effectiveDue = due || new Date(submitted.getTime() + targetDays * 86400000);
  const diffDays = Math.floor((effectiveDue.getTime() - nowMs) / 86400000);
  let status = 'ok';
  let label = diffDays > 0 ? `Due in ${diffDays} days` : diffDays === 0 ? 'Due today' : `${Math.abs(diffDays)} days overdue`;
  if (diffDays < -4) {
    status = 'critical-overdue';
  } else if (diffDays < 0) {
    status = 'high-overdue';
  } else if (diffDays === 0) {
    status = 'due-today';
  } else if (diffDays <= 3) {
    status = 'due-soon';
  } else {
    status = 'ok';
  }
  return { ageDays, due: effectiveDue, status, deltaDays: diffDays, label, stage: targetKey };
};

const getStatusInfo = (row) => {
  const applicationStatusRaw = typeof row.status === 'string' ? row.status.trim() : '';
  const rawStatus = normalizeClosedStatus(applicationStatusRaw || 'submitted');
  const label = rawStatus
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  const isUnassignedCase = rawStatus === 'submitted' && !row.assigned_user_id;
  const isInterventionApproval =
    row?.bucketId === 'interventions-awaiting-approval' ||
    row?.type === 'InterventionApproval' ||
    row?.type === 'Intervention';
  const eligibilityMissing =
    !isInterventionApproval &&
    !row.assessment_esdc_eligibility &&
    ['submitted', 'in_review', 'docs_requested', 'pending_approval', 'closure_notice'].includes(rawStatus);
  const statusType = (() => {
    if (['approved', 'completed'].includes(rawStatus)) return 'success';
    if (['rejected', 'declined'].includes(rawStatus)) return 'error';
    if (['closed', 'cancelled'].includes(rawStatus)) return 'info';
    if (eligibilityMissing) return 'warning';
    if (['docs_requested', 'action_required', 'closure_notice', 'closure notice'].includes(rawStatus)) return 'warning';
    return isUnassignedCase || rawStatus === 'new' ? 'pending' : 'info';
  })();
  const qualifiers = [];
  if (isUnassignedCase) qualifiers.push('Unassigned');
  if (eligibilityMissing) qualifiers.push('Awaiting EI Validation');
  const statusLabel = qualifiers.length ? `${label} • ${qualifiers.join(' • ')}` : label;
  return { rawStatus, statusLabel, statusType, isUnassignedCase };
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
          <Box fontSize="body-s" color="text-status-inactive">
            {[
              item.trackingId || item.id || null,
              formatDateOnly(item.submittedAt || item.receivedAt)
                ? `Received ${formatDateOnly(item.submittedAt || item.receivedAt)}`
                : null
            ].filter(Boolean).join(' · ') || '—'}
          </Box>
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
      const code = (item.address_province || item.region || '').toLowerCase();
      return PROVINCE_LABELS[code] || code.toUpperCase() || '—';
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
    cell: item => item.details || item.summary || '—'
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
  actions: {
    id: 'actions',
    header: 'Actions',
    cell: item => (
      <Link
        href={getWorkspacePath(item) || '#'}
        onFollow={event => {
          if (!getWorkspacePath(item)) {
            event.preventDefault();
          }
        }}
      >
        Open workspace
      </Link>
    )
  }
};

const columnKeysByType = {
  Application: ['title', 'region', 'owner', 'status', 'dueDate', 'actions'],
  Intervention: ['title', 'region', 'owner', 'status', 'dueDate', 'actions'],
  InterventionMilestone: ['title', 'intervention', 'region', 'status', 'dueDate', 'actions'],
  Agreement: ['title', 'owner', 'status', 'dueDate', 'actions'],
  Reporting: ['title', 'region', 'status', 'dueDate', 'actions'],
  File: ['title', 'owner', 'status', 'dueDate', 'actions'],
  Conflict: ['title', 'staff', 'role', 'region', 'details', 'signedAt', 'actions'],
  Eligibility: ['title', 'sin', 'region', 'owner', 'status', 'dueDate', 'actions'],
  AwaitingApproval: ['title', 'owner', 'recommendation', 'intervention', 'cost', 'startDate', 'status', 'dueDate', 'actions'],
  InterventionApproval: ['title', 'owner', 'intervention', 'cost', 'startDate', 'status', 'dueDate', 'actions'],
  Exception: ['title', 'notes', 'region', 'owner', 'status', 'dueDate', 'actions'],
  Escalation: ['title', 'notes', 'region', 'owner', 'status', 'dueDate', 'actions']
};

const mixedColumnKeys = ['title', 'type', 'owner', 'status', 'dueDate', 'actions'];

const buildColumns = (types = []) => {
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
  selectedBucketId,
  bucketDefinitions = PROGRAM_ADMIN_BUCKETS,
  items = [],
  selectedItemId,
  onSelectItem,
  role,
  actions,
  onRefresh
}) => {
  const canonicalRole = role === 'Regional Manager' ? 'Regional Coordinator' : role;
  const isAssessor = canonicalRole === 'Application Assessor';
  const canSelectPostingContext = canonicalRole === 'Regional Coordinator' || canonicalRole === 'Program Administrator';
  const [filteringText, setFilteringText] = useState('');
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [selectedAssurance, setSelectedAssurance] = useState(null);
  const [postingContextValue, setPostingContextValue] = useState('external');
  const [selectedBudgetPot, setSelectedBudgetPot] = useState(null);
  const [budgetPotOptions, setBudgetPotOptions] = useState([]);
  const [budgetPotLoading, setBudgetPotLoading] = useState(false);
  const [decisionError, setDecisionError] = useState(null);
  const [postingContextError, setPostingContextError] = useState(null);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [eligibilityModalVisible, setEligibilityModalVisible] = useState(false);
  const [eligibilityTarget, setEligibilityTarget] = useState(null);
  const [selectedEligibility, setSelectedEligibility] = useState(null);
  const [eligibilitySubmitting, setEligibilitySubmitting] = useState(false);
  const [eligibilityError, setEligibilityError] = useState(null);
  const [eligibilityFile, setEligibilityFile] = useState(null);
  const [eligibilityFileError, setEligibilityFileError] = useState(null);
  const [eligibilityApplicantId, setEligibilityApplicantId] = useState(null);
  const eligibilityFileInputRef = useRef(null);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const applicantProvinceCode = normalizeProvinceCode(decisionTarget?.address_province || decisionTarget?.region);
  const applicantProvinceLabel = applicantProvinceCode
    ? PROVINCE_LABELS[applicantProvinceCode.toLowerCase()] || applicantProvinceCode
    : 'Province not set';
  const applicantEligibilityLabel = decisionTarget?.assessment_esdc_eligibility || 'no eligibility recorded';
  const interventionCostValue = useMemo(() => {
    const raw =
      decisionTarget?.intervention_cost_total ??
      decisionTarget?.assessment_intervention_cost_total ??
      decisionTarget?.interventionCost ??
      decisionTarget?.intervention_cost ??
      null;
    if (raw === null || raw === undefined || raw === '') return null;
    const parsed = typeof raw === 'string' ? Number(raw.replace(/[^0-9.-]/g, '')) : Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [decisionTarget]);
  const hasInterventionCost = useMemo(
    () => interventionCostValue !== null && interventionCostValue > 0,
    [interventionCostValue]
  );
  const approvalThresholdBlocked = useMemo(
    () => canonicalRole === 'Regional Coordinator' && interventionCostValue !== null && interventionCostValue >= APPROVAL_COST_THRESHOLD,
    [canonicalRole, interventionCostValue]
  );
  const selectedBucket =
    useMemo(() => bucketDefinitions.find(bucket => bucket.id === selectedBucketId) || bucketDefinitions[0] || null, [
      bucketDefinitions,
      selectedBucketId
    ]);
  const shouldWrapLines = selectedBucket && ['exceptions-escalations', 'unresolved-conflicts'].includes(selectedBucket.id);

  const queueItems = useMemo(() => {
    if (!selectedBucket) {
      return [];
    }
    const scoped = items.filter(item => item.bucketId === selectedBucket.id);
    if (!filteringText) return scoped;
    const needle = filteringText.toLowerCase();
    return scoped.filter(item => {
      const fields = [
        item.applicant,
        item.title,
        item.trackingId,
        item.status,
        item.owner,
        item.region,
        item.notes
      ];
      return fields.some(v => v && String(v).toLowerCase().includes(needle));
    });
  }, [items, selectedBucket, filteringText]);

  const [columnWidths, setColumnWidths] = useState(() => loadStoredColumnWidths());

  useEffect(() => {
    if (isAssessor) {
      setPostingContextValue('external');
    }
  }, [isAssessor]);

  const itemTypes = useMemo(() => {
    const types = new Set();
    queueItems.forEach(item => {
      if (item?.type) {
        types.add(item.type);
      }
    });
    return Array.from(types);
  }, [queueItems]);

  const [slaTargets, setSlaTargets] = useState(SLA_DEFAULT_DAYS);
  const fireEscalationAction = (item, actionId) => {
    try {
      window.dispatchEvent(new CustomEvent('escalation:action', { detail: { actionId, item } }));
    } catch (_) {
      // no-op if window unavailable
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadSlaTargets = async () => {
      try {
        const res = await apiFetch('/api/config/sla-targets');
        if (!res.ok) throw new Error('Failed to load SLA targets');
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

  useEffect(() => {
    if (!decisionModalVisible) return;
    if (!selectedBudgetPot?.value) return;
    const match = budgetPotOptions.find(opt => String(opt.value) === String(selectedBudgetPot.value));
    if (match) {
      if (selectedBudgetPot.label !== match.label) {
        setSelectedBudgetPot(match);
      }
      return;
    }
    if (!budgetPotLoading && budgetPotOptions.length) {
      setSelectedBudgetPot(prev => (prev?.value ? { value: String(prev.value), label: String(prev.value) } : prev));
    }
  }, [decisionModalVisible, selectedBudgetPot, budgetPotOptions, budgetPotLoading]);

  useEffect(() => {
    if (!decisionModalVisible) return;
    if (selectedBudgetPot?.value) return;
    if (!budgetPotOptions.length) return;
    const eligibilityFunding = mapEligibilityToFundingSource(decisionTarget?.assessment_esdc_eligibility);
    const provinceCode = applicantProvinceCode;
    const match = budgetPotOptions.find(opt => {
      const optFunding = opt.fundingSource ? String(opt.fundingSource).toUpperCase() : null;
      const regionList = Array.isArray(opt.regions) ? opt.regions.map(r => String(r).toUpperCase()) : [];
      const fundingOk = eligibilityFunding ? optFunding === eligibilityFunding : true;
      const regionOk = provinceCode ? regionList.length === 0 || regionList.includes(provinceCode) : true;
      return fundingOk && regionOk;
    });
    if (match) {
      setSelectedBudgetPot(match);
    }
  }, [decisionModalVisible, selectedBudgetPot, budgetPotOptions, decisionTarget, applicantProvinceCode]);

  const columnDefinitions = useMemo(() => {
    let keys = buildColumns(itemTypes);
    const isMilestoneQueue =
      selectedBucketId === 'active-clients-checkins' ||
      (itemTypes.length === 1 && itemTypes[0] === 'InterventionMilestone');
    if (isAssessor) {
      keys = keys.filter(key => key !== 'owner');
    }
    const widthsMap = new Map(columnWidths.map(entry => [entry.id, entry.width]));
    return keys
      .map(key => {
        const base = columnDefinitionsByKey[key];
        if (!base) return null;
        const widthOverride = widthsMap.get(base.id);
        if (base.id === 'intervention' && isMilestoneQueue) {
          return {
            ...base,
            width: widthOverride,
            header: 'Intervention'
          };
        }
        if (base.id === 'status') {
          return {
            ...base,
            width: widthOverride,
            cell: item => {
              const statusInfo = getStatusInfo(item);
              const normalizedKey = normalizeStatusKey(statusInfo.rawStatus || item.status || '');
              const isDocsRequestedStatus = ['docs_requested', 'action_required', 'action_required_(docs_requested)'].includes(normalizedKey);
              const docsRequestedSince =
                item.updatedAt ||
                item.updated_at ||
                item.last_activity_at ||
                item.submittedAt ||
                item.receivedAt ||
                item.submitted_at ||
                item.created_at ||
                null;
              const docsRequestedDays = isDocsRequestedStatus ? getDaysAgo(docsRequestedSince) : null;
              const docsRequestedSuffix = isDocsRequestedStatus ? formatDaysAgo(docsRequestedSince) : null;
              const badgeLabel = isDocsRequestedStatus
                ? `Docs Requested${docsRequestedSuffix ? ` ${docsRequestedSuffix}` : ''}`
                : statusInfo.statusLabel;
              const docsRequestedColor = (() => {
                if (!isDocsRequestedStatus || docsRequestedDays === null) return null;
                if (docsRequestedDays > 28) return 'severity-critical';
                if (docsRequestedDays >= 15) return 'severity-high';
                if (docsRequestedDays >= 7) return 'severity-medium';
                if (docsRequestedDays >= 3) return 'severity-low';
                return 'grey';
              })();
              const badgeColor = docsRequestedColor || statusColor(statusInfo.rawStatus || item.status || 'unknown');
              return <Badge color={badgeColor}>{badgeLabel}</Badge>;
            }
          };
        }
        if (base.id === 'dueDate') {
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
          return {
            ...base,
            header: 'SLA Target',
            width: widthOverride,
            cell: item => {
              const meta = computeSlaMeta(
                item,
                slaTargets,
                normalizeClosedStatus(item.status || 'submitted'),
                Boolean(item.assigned_user_id)
              );
              const label = formatSlaTargetLabel(meta);
              const title = `SLA (${meta.stage || 'unknown'}): ${label} | Age: ${meta.ageDays ?? 'n/a'}d | Due: ${meta.due ? meta.due.toLocaleDateString() : 'n/a'}`;
              const badge = (() => {
                switch (meta.status) {
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
            }
          };
        }
        if (base.id === 'actions') {
          return {
            ...base,
            width: widthOverride,
            cell: item => {
              const workspacePath = getWorkspacePath(item);
              return (
                <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                  <Link
                    href={workspacePath || '#'}
                    onFollow={event => {
                      if (!workspacePath) {
                        event.preventDefault();
                      }
                    }}
                  >
                    Open workspace
                  </Link>
                  {(() => {
                    const isEscalationBucket = item.bucketId === 'exceptions-escalations';
                    const canEscalationActions = role === 'Program Administrator' || role === 'Regional Coordinator';
                    if (isEscalationBucket && canEscalationActions) {
                      return (
                        <SpaceBetween size="xxs" direction="horizontal">
                          <Link
                            href="#"
                            onFollow={event => {
                              event.preventDefault();
                              fireEscalationAction(item, 'respond');
                            }}
                          >
                            Respond
                          </Link>
                          {role === 'Regional Coordinator' && (
                            <Link
                              href="#"
                              onFollow={event => {
                                event.preventDefault();
                                fireEscalationAction(item, 'escalate_up');
                              }}
                            >
                              Escalate to Program Admin
                            </Link>
                          )}
                          <Link
                            href="#"
                            onFollow={event => {
                              event.preventDefault();
                              fireEscalationAction(item, 'resolve');
                            }}
                          >
                            Resolve
                          </Link>
                        </SpaceBetween>
                      );
                    }
                    if (item.bucketId === 'unresolved-conflicts') {
                      return (
                        <SpaceBetween size="xxs" direction="horizontal">
                          <Link
                            href="#"
                            onFollow={event => {
                              event.preventDefault();
                              setAssignTarget(item);
                              setAssignModalVisible(true);
                            }}
                          >
                            Reassign
                          </Link>
                          <Link
                            href="#"
                            onFollow={event => {
                              event.preventDefault();
                              setResolveTarget(item);
                            }}
                          >
                            Resolve
                          </Link>
                        </SpaceBetween>
                      );
                    }
                    if (item.bucketId === 'ei-eligibility-checks') {
                      return (
                        <SpaceBetween size="xxs" direction="horizontal">
                          <Link
                            href="#"
                            onFollow={event => {
                              event.preventDefault();
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
                            }}
                          >
                            Set Eligibility
                          </Link>
                        </SpaceBetween>
                      );
                    }
                    if (item.bucketId === 'applications-awaiting-approval') {
                      return (
                        <SpaceBetween size="xxs" direction="horizontal">
                          <Link
                            href="#"
                            onFollow={event => {
                              event.preventDefault();
                              setDecisionTarget(item);
                              setSelectedDecision(null);
                              setDecisionReason('');
                              setSelectedAssurance(null);
                              setDecisionError(null);
                              setPostingContextError(null);
                              const existingPosting =
                                item.assessment_posting_context ||
                                item.postingContext ||
                                item.posting_context ||
                                null;
                              const normalizedPosting =
                                typeof existingPosting === 'string' && ['external', 'internal'].includes(existingPosting.trim().toLowerCase())
                                  ? existingPosting.trim().toLowerCase()
                                  : 'external';
                              setPostingContextValue(isAssessor ? 'external' : normalizedPosting);
                              const existingPotId = item.assessment_intervention_pot_id || item.assessment_budget_pot_id || null;
                              setSelectedBudgetPot(
                                existingPotId ? { value: String(existingPotId), label: String(existingPotId) } : null
                              );
                              setDecisionModalVisible(true);
                              if (!budgetPotOptions.length) {
                                setBudgetPotLoading(true);
                                apiFetch('/api/reference/budget-pots-lite?chargeableOnly=1')
                                  .then(res => (res.ok ? res.json() : []))
                                  .then(list => setBudgetPotOptions(toBudgetPotOptions(list)))
                                  .catch(() => setBudgetPotOptions([]))
                                  .finally(() => setBudgetPotLoading(false));
                              }
                            }}
                          >
                            Make Decision
                          </Link>
                        </SpaceBetween>
                      );
                    }
                    if (item.bucketId === 'interventions-awaiting-approval') {
                      return null;
                    }
                    if (item.bucketId === 'overdue') {
                      return null;
                    }
                    if (isAssessor) {
                      return null;
                    }
                    return (
                      <Link
                        href="#"
                        onFollow={event => {
                          event.preventDefault();
                          setAssignTarget(item);
                          setAssignModalVisible(true);
                        }}
                      >
                        Assign
                      </Link>
                    );
                  })()}
                </SpaceBetween>
              );
            }
          };
        }
        return widthOverride ? { ...base, width: widthOverride } : base;
      })
      .filter(Boolean);
  }, [itemTypes, selectedBucketId, slaTargets, columnWidths, budgetPotOptions.length, role, isAssessor]);

  const selectedItems = useMemo(() => {
    if (!selectedItemId) return [];
    return queueItems.filter(item => item.id === selectedItemId);
  }, [queueItems, selectedItemId]);

  const emptyState = selectedBucket
    ? 'No items are available for this queue yet.'
    : 'Select a work queue to see items.';

  useEffect(() => {
    if (!assignModalVisible || !assignTarget || !(assignTarget.case_id || assignTarget.caseId)) {
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
    const caseId = assignTarget?.case_id || assignTarget?.caseId;
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
      if (assignTarget?.bucketId === 'unresolved-conflicts' && assignTarget?.staffProfileId) {
        try {
          await apiFetch(`/api/cases/${caseId}/conflicts/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staff_profile_id: assignTarget.staffProfileId })
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
          throw new Error('That file type is not allowed. Please upload a PDF or image.');
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

  const handleDecisionSubmit = async () => {
    const caseId = decisionTarget?.case_id || decisionTarget?.caseId;
    const applicationId = decisionTarget?.application_id || decisionTarget?.applicationId;
    const decisionValue = selectedDecision?.value;
    const isApprove = decisionValue === 'approve';
    const isReject = decisionValue === 'reject';
    const isPushBack = decisionValue === 'push_back';
    const assuranceValue = selectedAssurance?.value;
    const potId = selectedBudgetPot?.value || null;
    const postingContext = isAssessor ? 'external' : postingContextValue || 'external';
    const assessmentEligibility = decisionTarget?.assessment_esdc_eligibility || null;
    if (approvalThresholdBlocked && decisionValue === 'approve') {
      setDecisionError(`Regional Coordinators cannot approve applications with total cost \u2265 $${APPROVAL_COST_THRESHOLD.toLocaleString()}. Escalate to NWAC Administrators.`);
      return;
    }
    const requiresBudgetPot = isApprove && hasInterventionCost;
    const requiresAssurance = Boolean(decisionValue && !isPushBack);
    const requiresReason = Boolean(isReject || isPushBack);
    if (!caseId || !decisionValue || (requiresAssurance && !assuranceValue) || (requiresReason && !decisionReason.trim())) {
      setDecisionError('Fill in all required fields.');
      return;
    }
    if (requiresBudgetPot && !potId) {
      setDecisionError('Select a budget pot for the intervention cost.');
      return;
    }
    setDecisionSubmitting(true);
    setDecisionError(null);
    setPostingContextError(null);
    try {
      if (applicationId) {
        await apiFetch(`/api/locks/application/${applicationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
      }
      const payload = {
        assessment_nwac_review_status: decisionValue,
        assessment_nwac_review: requiresAssurance ? assuranceValue : null,
        assessment_nwac_reason: requiresReason ? decisionReason : null,
        assessment_intervention_pot_id: requiresBudgetPot ? potId : null,
        assessment_esdc_eligibility: assessmentEligibility,
        postingContext: requiresBudgetPot ? postingContext : null,
        status: isApprove ? 'initiated' : 'in_review',
        applicationStatus: (isApprove || isReject) ? 'decision_ready' : 'in_review'
      };
      const response = await apiFetch(`/api/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        let details = null;
        try {
          details = await response.json();
        } catch (_) {
          details = null;
        }
        const error = new Error(details?.message || 'Failed to save decision. Please try again.');
        error.code = details?.error;
        throw error;
      }
      if (applicationId) {
        try {
          await apiFetch(`/api/locks/application/${applicationId}`, { method: 'DELETE' });
        } catch (_) {}
      }
      setDecisionModalVisible(false);
      setDecisionTarget(null);
      setSelectedDecision(null);
      setDecisionReason('');
      setSelectedAssurance(null);
      setPostingContextValue('external');
      setPostingContextError(null);
      setSelectedBudgetPot(null);
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
    } catch (err) {
      if (['missing_internal_gl_code', 'missing_external_gl_code', 'posting_context_not_permitted'].includes(err?.code)) {
        setPostingContextError(err?.message || 'Check Paid from selection.');
        setDecisionError(null);
      } else {
        setDecisionError('Failed to save decision. Please try again.');
      }
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const handleResolveConfirm = async () => {
    if (!resolveTarget?.case_id || !resolveTarget?.staffProfileId) {
      setResolveTarget(null);
      return;
    }
    setResolveSubmitting(true);
    try {
      const resp = await apiFetch(`/api/cases/${resolveTarget.case_id}/conflicts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_profile_id: resolveTarget.staffProfileId })
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

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={
            selectedBucket
              ? `${selectedBucket.label} — ${queueItems.length} item(s)`
              : 'Select a work queue to view its items.'
          }
        >
          {selectedBucket ? `${selectedBucket.label} Items` : 'Work Queue Items'}
        </Header>
      }
      settings={settingsDropdown(actions)}
      i18nStrings={boardItemI18n}
    >
      <Table
        variant="embedded"
        trackBy="id"
        items={queueItems}
        columnDefinitions={columnDefinitions}
        selectionType="single"
        selectedItems={selectedItems}
        resizableColumns
        stickyHeader
        enableKeyboardNavigation
        wrapLines={shouldWrapLines}
        filter={
          <TextFilter
            filteringText={filteringText}
            filteringPlaceholder="Search queue items"
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
        onSelectionChange={({ detail }) => {
          const next = detail.selectedItems?.[0];
          if (typeof onSelectItem === 'function') {
            onSelectItem(next?.id || null);
          }
        }}
        empty={<Box variant="p">{emptyState}</Box>}
      />
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
              accept=".pdf,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
              onChange={event => {
                const file = event?.target?.files?.[0] || null;
                if (event?.target) {
                  event.target.value = '';
                }
                if (file) {
                  if (!ELIGIBILITY_ALLOWED_MIME_TYPES.includes(file.type)) {
                    setEligibilityFile(null);
                    setEligibilityFileError('Only PDF, JPG, PNG, BMP, or TIFF files are allowed.');
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
            <Box variant="small" color="text-body-secondary">
              Max size 6 MB. Allowed types: PDF, JPG, PNG, BMP, TIFF.
            </Box>
            <SpaceBetween size="xs" direction="horizontal">
              <Button onClick={() => eligibilityFileInputRef.current && eligibilityFileInputRef.current.click()}>
                Choose file
              </Button>
              <Box>{eligibilityFile ? eligibilityFile.name : 'No file selected'}</Box>
            </SpaceBetween>
          </FormField>
        </SpaceBetween>
      </Modal>
      <Modal
        visible={decisionModalVisible}
        onDismiss={() => {
          setDecisionModalVisible(false);
          setDecisionTarget(null);
          setSelectedDecision(null);
          setDecisionReason('');
          setSelectedAssurance(null);
          setPostingContextValue('external');
          setPostingContextError(null);
          setSelectedBudgetPot(null);
          setDecisionError(null);
        }}
        header="Make Decision"
        closeAriaLabel="Close decision modal"
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            <Button
              onClick={() => {
                setDecisionModalVisible(false);
                setDecisionTarget(null);
                setSelectedDecision(null);
                setDecisionReason('');
                setSelectedAssurance(null);
                setPostingContextValue('external');
                setPostingContextError(null);
                setSelectedBudgetPot(null);
                setDecisionError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={decisionSubmitting}
              onClick={handleDecisionSubmit}
            >
              Save
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          {decisionError && <Box color="text-status-error">{decisionError}</Box>}
          <FormField label="Funding Decision" stretch>
            <Select
              placeholder="Select decision"
              selectedOption={selectedDecision}
              onChange={({ detail }) => {
                if (approvalThresholdBlocked && detail.selectedOption?.value === 'approve') {
                  setDecisionError(`Regional Coordinators cannot approve applications with total cost \u2265 $${APPROVAL_COST_THRESHOLD.toLocaleString()}. Escalate to NWAC Administrators.`);
                  return;
                }
                if (detail.selectedOption?.value === 'push_back') {
                  setSelectedAssurance(null);
                }
                setDecisionError(null);
                setSelectedDecision(detail.selectedOption || null);
              }}
              options={[
                { label: 'Approved', value: 'approve' },
                { label: 'Not Approved', value: 'reject' },
                { label: 'Push back to review', value: 'push_back' }
              ]}
            />
          </FormField>
          {['reject', 'push_back'].includes(selectedDecision?.value) && (
            <FormField
              label={selectedDecision?.value === 'push_back' ? 'Reason for push back' : 'Reason for not approving'}
              stretch
            >
              <Textarea
                value={decisionReason}
                onChange={({ detail }) => setDecisionReason(detail.value)}
                rows={3}
              />
            </FormField>
          )}
          {selectedDecision?.value !== 'push_back' && (
            <FormField label="Assessment Assurance" stretch>
              <Select
                placeholder="Select assurance"
                selectedOption={selectedAssurance}
                onChange={({ detail }) => setSelectedAssurance(detail.selectedOption || null)}
                options={[
                  { label: 'Agree with recommendation', value: 'agree' },
                  { label: 'Disagree with recommendation', value: 'disagree' }
                ]}
              />
            </FormField>
          )}
          {selectedDecision?.value === 'approve' && hasInterventionCost && (
            <>
              <FormField
                label="Budget Pot"
                stretch
                description={`Applicant province: ${applicantProvinceLabel} · Eligibility: ${applicantEligibilityLabel}`}
              >
                <Select
                  placeholder={budgetPotLoading ? 'Loading budget pots' : 'Select budget pot'}
                  selectedOption={selectedBudgetPot}
                  options={budgetPotOptions}
                  statusType={budgetPotLoading ? 'loading' : 'finished'}
                  loadingText="Loading budget pots"
                  onChange={({ detail }) => setSelectedBudgetPot(detail.selectedOption || null)}
                  filteringType="auto"
                />
              </FormField>
              <FormField label="Paid from" errorText={postingContextError} stretch>
                {isAssessor ? (
                  <Input value="External (region/PTMA)" readOnly disabled />
                ) : (
                  <RadioGroup
                    direction="horizontal"
                    value={postingContextValue}
                    onChange={({ detail }) => {
                      setPostingContextError(null);
                      setPostingContextValue(detail.value || 'external');
                    }}
                    items={[
                      { value: 'external', label: 'External (region/PTMA)' },
                      { value: 'internal', label: 'Internal (NWAC)' }
                    ]}
                  />
                )}
              </FormField>
            </>
          )}
        </SpaceBetween>
      </Modal>
      <Modal
        visible={assignModalVisible}
        onDismiss={() => {
          setAssignModalVisible(false);
          setAssignTarget(null);
          setSelectedAssignee(null);
          setAssignError(null);
        }}
        header={`Assign ${assignTarget?.trackingId || assignTarget?.title || 'item'}`}
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
              Assign
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
