import React, { useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  Badge,
  Button,
  ButtonDropdown,
  CopyToClipboard,
  FormField,
  Header,
  Link,
  Modal,
  Select,
  Textarea,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextFilter
} from '@cloudscape-design/components';
import { PROGRAM_ADMIN_BUCKETS } from './ProgramAdminWorkQueueWidget';
import { apiFetch } from '../auth/apiClient';

const COLUMN_WIDTHS_STORAGE_KEY = 'work-queue-items-column-widths-v1';
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

const normalizeClosedStatus = status => {
  const key = (status || '').toString().trim().toLowerCase();
  return key === 'withdrawn' ? 'closed' : key;
};

const COMPLETED_STATUSES = new Set(['approved', 'completed', 'rejected', 'declined', 'cancelled', 'closed', 'archived']);
const DECISION_STATUSES = new Set(['pending_approval']);
const ASSESSMENT_STATUSES = new Set([
  'in_review', 'in review',
  'docs_requested', 'docs requested',
  'action_required', 'action required', 'action required (docs requested)',
  'pending info', 'pending information', 'info requested', 'information requested',
  'on hold', 'on_hold'
]);

const SLA_DEFAULT_DAYS = {
  assignment: 3,
  assessment: 10,
  program_decision: 2
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
  const eligibilityMissing =
    !row.assessment_esdc_eligibility &&
    ['submitted', 'in_review', 'docs_requested', 'pending_approval'].includes(rawStatus);
  const statusType = (() => {
    if (['approved', 'completed'].includes(rawStatus)) return 'success';
    if (['rejected', 'declined'].includes(rawStatus)) return 'error';
    if (['closed', 'cancelled'].includes(rawStatus)) return 'info';
    if (eligibilityMissing) return 'warning';
    if (['docs_requested', 'action_required'].includes(rawStatus)) return 'warning';
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
    cell: item => (
      <SpaceBetween size="xxs">
        <Box fontWeight="bold">{item.applicant || item.applicant_name || item.applicantName || item.title || item.id}</Box>
        <Box fontSize="body-s" color="text-status-inactive">
          {[
            item.trackingId || item.id || null,
            formatDateOnly(item.submittedAt || item.receivedAt)
              ? `Received ${formatDateOnly(item.submittedAt || item.receivedAt)}`
              : null
          ].filter(Boolean).join(' · ') || '—'}
        </Box>
      </SpaceBetween>
    ),
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
    cell: item => item.staffRole || '—',
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
        href={item.workspacePath || '#'}
        onFollow={event => {
          if (!item.workspacePath) {
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
  Agreement: ['title', 'owner', 'status', 'dueDate', 'actions'],
  Reporting: ['title', 'region', 'status', 'dueDate', 'actions'],
  File: ['title', 'owner', 'status', 'dueDate', 'actions'],
  Conflict: ['title', 'staff', 'role', 'region', 'details', 'signedAt', 'actions'],
  Eligibility: ['title', 'sin', 'region', 'owner', 'status', 'dueDate', 'actions'],
  AwaitingApproval: ['title', 'owner', 'recommendation', 'intervention', 'cost', 'startDate', 'status', 'dueDate', 'actions'],
  Exception: ['title', 'region', 'owner', 'status', 'dueDate', 'actions']
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
  actions,
  onRefresh
}) => {
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
  const [selectedBudgetPot, setSelectedBudgetPot] = useState(null);
  const [budgetPotOptions, setBudgetPotOptions] = useState([]);
  const [budgetPotLoading, setBudgetPotLoading] = useState(false);
  const [decisionError, setDecisionError] = useState(null);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [eligibilityModalVisible, setEligibilityModalVisible] = useState(false);
  const [eligibilityTarget, setEligibilityTarget] = useState(null);
  const [selectedEligibility, setSelectedEligibility] = useState(null);
  const [eligibilitySubmitting, setEligibilitySubmitting] = useState(false);
  const [eligibilityError, setEligibilityError] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const selectedBucket =
    useMemo(() => bucketDefinitions.find(bucket => bucket.id === selectedBucketId) || bucketDefinitions[0] || null, [
      bucketDefinitions,
      selectedBucketId
    ]);

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
        item.region
      ];
      return fields.some(v => v && String(v).toLowerCase().includes(needle));
    });
  }, [items, selectedBucket, filteringText]);

  const [columnWidths, setColumnWidths] = useState(() => loadStoredColumnWidths());

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

  const columnDefinitions = useMemo(() => {
    const keys = buildColumns(itemTypes);
    const widthsMap = new Map(columnWidths.map(entry => [entry.id, entry.width]));
    return keys
      .map(key => {
        const base = columnDefinitionsByKey[key];
        if (!base) return null;
        const widthOverride = widthsMap.get(base.id);
        if (base.id === 'dueDate') {
          return {
            ...base,
            width: widthOverride,
            cell: item => {
              const meta = computeSlaMeta(
                item,
                slaTargets,
                normalizeClosedStatus(item.status || 'submitted'),
                Boolean(item.assigned_user_id)
              );
              const title = `SLA (${meta.stage || 'unknown'}): ${meta.label} | Age: ${meta.ageDays ?? 'n/a'}d | Due: ${meta.due ? meta.due.toLocaleDateString() : 'n/a'}`;
              const badge = (() => {
                switch (meta.status) {
                  case 'critical-overdue':
                    return <Badge color="severity-critical">{meta.label}</Badge>;
                  case 'high-overdue':
                    return <Badge color="severity-high">{meta.label}</Badge>;
                  case 'due-today':
                    return <Badge color="severity-medium">{meta.label}</Badge>;
                  case 'due-soon':
                    return <Badge color="severity-low">{meta.label}</Badge>;
                  case 'ok':
                    return <Badge color="green">{meta.label}</Badge>;
                  default:
                    return <Badge color="grey">{meta.label || 'Unknown'}</Badge>;
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
            cell: item => (
              <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                <Link
                  href={item.workspacePath || '#'}
                  onFollow={event => {
                    if (!item.workspacePath) {
                      event.preventDefault();
                    }
                  }}
                >
                  Open workspace
                </Link>
                {item.bucketId === 'unresolved-conflicts' ? (
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
                ) : item.bucketId === 'ei-eligibility-checks' ? (
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
                        setEligibilityModalVisible(true);
                      }}
                    >
                      Set Eligibility
                    </Link>
                  </SpaceBetween>
                ) : item.bucketId === 'applications-awaiting-approval' ? (
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
                        setSelectedBudgetPot(null);
                        setDecisionModalVisible(true);
                        if (!budgetPotOptions.length) {
                          setBudgetPotLoading(true);
                          apiFetch('/api/reference/budget-pots-lite')
                            .then(res => res.ok ? res.json() : [])
                            .then(list => {
                              const active = Array.isArray(list) ? list.filter(p => p.isActive) : [];
                              const opts = active.map(p => ({
                                label: [p.code, p.name].filter(Boolean).join(' - ') || p.name || p.code || p.id,
                                value: p.id
                              }));
                              setBudgetPotOptions(opts);
                            })
                            .catch(() => setBudgetPotOptions([]))
                            .finally(() => setBudgetPotLoading(false));
                        }
                      }}
                    >
                      Make Decision
                    </Link>
                  </SpaceBetween>
                ) : item.bucketId === 'overdue' ? (
                  null
                ) : (
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
                )}
              </SpaceBetween>
            )
          };
        }
        return widthOverride ? { ...base, width: widthOverride } : base;
      })
      .filter(Boolean);
  }, [itemTypes, slaTargets, columnWidths, budgetPotOptions.length]);

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

  const handleEligibilitySubmit = async () => {
    const caseId = eligibilityTarget?.case_id || eligibilityTarget?.caseId;
    const applicationId = eligibilityTarget?.application_id || eligibilityTarget?.applicationId;
    const value = selectedEligibility?.value || selectedEligibility?.label;
    if (!caseId || !value) {
      setEligibilityError('Select an eligibility value.');
      return;
    }
    setEligibilitySubmitting(true);
    setEligibilityError(null);
    try {
      if (applicationId) {
        await apiFetch(`/api/locks/application/${applicationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
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
    const assuranceValue = selectedAssurance?.value;
    const potId = selectedBudgetPot?.value || null;
    if (!caseId || !decisionValue || !assuranceValue || (decisionValue === 'reject' && !decisionReason.trim())) {
      setDecisionError('Fill in all required fields.');
      return;
    }
    setDecisionSubmitting(true);
    setDecisionError(null);
    try {
      if (applicationId) {
        await apiFetch(`/api/locks/application/${applicationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
      }
      const payload = {
        assessment_nwac_review_status: decisionValue === 'approve' ? 'approve' : 'reject',
        assessment_nwac_review: assuranceValue,
        assessment_nwac_reason: decisionValue === 'reject' ? decisionReason : null,
        assessment_intervention_pot_id: potId,
        status: decisionValue === 'approve' ? 'approved' : 'rejected',
        applicationStatus: decisionValue === 'approve' ? 'approved' : 'rejected'
      };
      const response = await apiFetch(`/api/cases/${caseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('decision_failed');
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
      setSelectedBudgetPot(null);
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
    } catch (_) {
      setDecisionError('Failed to save decision. Please try again.');
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
                setEligibilityError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={eligibilitySubmitting}
              disabled={!selectedEligibility?.value}
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
              onChange={({ detail }) => setSelectedDecision(detail.selectedOption || null)}
              options={[
                { label: 'Approve', value: 'approve' },
                { label: 'Reject', value: 'reject' }
              ]}
            />
          </FormField>
          {selectedDecision?.value === 'reject' && (
            <FormField label="Reason for denial" stretch>
              <Textarea
                value={decisionReason}
                onChange={({ detail }) => setDecisionReason(detail.value)}
                rows={3}
              />
            </FormField>
          )}
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
          <FormField label="Budget Pot" stretch>
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
