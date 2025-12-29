import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BoardItem } from '@cloudscape-design/board-components';

import {
  Header,
  Box,
  ColumnLayout,
  Badge,
  Spinner,
  ButtonDropdown,
  Select,
  Alert,
  FormField,
  SpaceBetween,
  Button,
  Modal,
  Link,
  Input,
  Textarea,
  StatusIndicator
} from '@cloudscape-design/components';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import { apiFetch } from '../auth/apiClient';
import ApplicationOverviewHelp from '../helpPanelContents/applicationOverviewHelp';
import useCurrentUser from '../hooks/useCurrentUser';
import useApplicationLock, { buildLockConflictMessage } from '../hooks/useApplicationLock';
import { toCanonicalRole } from '../context/RoleMatrixContext';
import {
  canEditCaseStatus,
  getCaseStatusContext,
  getRoleGroups,
  isStatusTransitionAllowed,
} from '../utils/rbac';

const SLA_DEFAULT_DAYS = {
  assignment: 3,
  assessment: 10,
  program_decision: 2
};
const SLA_STAGE_ALLOWLIST = new Set(['assignment', 'assessment', 'program_decision']);

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDaysAgo(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  const diffDays = Math.floor((now - date.getTime()) / 86400000);
  return Math.max(diffDays, 0);
}

function formatDaysAgo(value) {
  const days = getDaysAgo(value);
  if (days === null) return null;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function normalizeClosedStatus(status) {
  const key = (status || '').toString().trim().toLowerCase();
  return key === 'withdrawn' ? 'closed' : key;
}

function statusColor(status = '') {
  const normalized = normalizeClosedStatus(status);
  if (['approved', 'completed'].includes(normalized)) return 'green';
  if (['submitted', 'in review', 'in_review', 'in progress', 'pending', 'assigned', 'pending_approval', 'decision_ready'].includes(normalized)) return 'blue';
  if (['docs requested', 'docs_requested', 'action required', 'action required (docs requested)', 'closure notice', 'closure_notice'].includes(normalized)) return 'severity-high';
  if (['rejected', 'declined', 'errored'].includes(normalized)) return 'red';
  if (['closed', 'inactive', 'archived'].includes(normalized)) return 'grey';
  return 'grey';
}

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
const APPLICATION_TERMINAL_STATUSES = new Set(['approved', 'completed', 'rejected', 'declined', 'cancelled', 'closed', 'archived']);
const ASSIGN_BLOCKED_STATUSES = new Set(['approved', 'archived', 'closed']);
const CLOSURE_NOTICE_ELIGIBLE_STATUSES = new Set(['submitted', 'in_review', 'docs_requested', 'pending_approval']);
const RESUME_REVIEW_STATUSES = new Set(['docs_requested', 'closure_notice']);
const CLOSE_ALLOWED_STATUSES = new Set(['submitted', 'in_review', 'docs_requested', 'pending_approval', 'closure_notice']);
const ARCHIVE_ALLOWED_STATUSES = new Set(['approved', 'completed', 'rejected', 'closed']);

const APPLICATION_LAYOUT_ACTIONS = [
  {
    id: 'review-assessment',
    text: 'Review application',
    description: 'Focus on the submitted application and assessment.',
  },
  {
    id: 'documents-messages',
    text: 'Documents and messages',
    description: 'Switch to supporting documents and secure messaging.',
  },
  {
    id: 'notes-calendar',
    text: 'Notes and case calendar',
    description: 'Review notes alongside upcoming reminders.',
  },
  {
    id: 'audit-trail',
    text: 'View audit trail',
    description: 'Review the application with the events timeline.',
  },
];

const APPLICATION_LAYOUT_ACTION_MAP = {
  'review-assessment': 'reviewAssessment',
  'documents-messages': 'documentsMessages',
  'notes-calendar': 'notesCalendar',
  'audit-trail': 'auditTrail',
};

const toDate = value => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const getStatusInfo = (row) => {
  const applicationStatusRaw = typeof row.application_status === 'string' ? row.application_status.trim() : '';
  const caseStatusRaw = typeof row.case_status === 'string' ? row.case_status.trim() : '';
  const fallbackStatus = row.case_id ? 'submitted' : 'new';
  const rawStatus = normalizeClosedStatus(applicationStatusRaw || caseStatusRaw || fallbackStatus);
  const label = rawStatus
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  const isUnassignedCase = Boolean(row.case_id) && !row.assigned_user_id && rawStatus === 'submitted';
  const statusType = (() => {
    if (['approved', 'completed'].includes(rawStatus)) return 'success';
    if (['rejected', 'declined'].includes(rawStatus)) return 'error';
    if (['closed', 'cancelled'].includes(rawStatus)) return 'info';
    if (['docs_requested', 'action_required', 'closure_notice', 'closure notice'].includes(rawStatus)) return 'warning';
    return isUnassignedCase || rawStatus === 'new' ? 'pending' : 'info';
  })();
  const statusLabel = isUnassignedCase ? `${label} • Unassigned` : label;
  return { rawStatus, statusLabel, statusType, isUnassignedCase };
};

const canonicalizeRole = (role) => {
  if (!role) return '';
  return role.toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const normalizeEscalationRole = (roleKey) => {
  if (!roleKey) return '';
  if (roleKey === 'application_assessor') return 'coordinator';
  if (roleKey === 'regional_coordinator') return 'regional_manager';
  if (roleKey === 'program_admin') return 'program_administrator';
  return roleKey;
};

const formatRoleLabel = (roleKey) => {
  if (!roleKey) return 'reviewer';
  return roleKey
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const computeSlaMeta = (application, slaTargets, rawStatus, isAssigned) => {
  const submitted = toDate(application?.submitted_at) || toDate(application?.created_at);
  if (!submitted) {
    return { label: 'Unknown', color: 'grey' };
  }
  if (COMPLETED_STATUSES.has(rawStatus)) {
    return { label: 'Complete', color: 'green' };
  }
  let targetKey = 'assignment';
  if (DECISION_STATUSES.has(rawStatus)) {
    targetKey = 'program_decision';
  } else if (ASSESSMENT_STATUSES.has(rawStatus) || (rawStatus === 'submitted' && isAssigned)) {
    targetKey = 'assessment';
  }
  const targetDays = Number(slaTargets[targetKey]) || SLA_DEFAULT_DAYS[targetKey] || 0;
  if (!targetDays || Number.isNaN(targetDays)) {
    return { label: 'Unknown', color: 'grey' };
  }
  const nowMs = Date.now();
  const due = toDate(application?.sla_due_at) || new Date(submitted.getTime() + targetDays * 86400000);
  const diffDays = Math.floor((due.getTime() - nowMs) / 86400000);
  const stageLabel = targetKey === 'program_decision' ? 'Decision' : targetKey === 'assessment' ? 'Assessment' : 'Assignment';
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    let color = 'grey';
    if (overdueDays > 28) color = 'severity-critical';
    else if (overdueDays >= 15) color = 'severity-high';
    else if (overdueDays >= 7) color = 'severity-medium';
    else if (overdueDays >= 3) color = 'severity-low';
    const label = `${stageLabel} ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`;
    return { label, color };
  }
  if (diffDays === 0) return { label: `${stageLabel} due today`, color: 'severity-medium' };
  if (diffDays <= 3) return { label: `${stageLabel} due in ${diffDays} days`, color: 'severity-low' };
  return { label: `${stageLabel} due in ${diffDays} days`, color: 'green' };
};

const APPLICATION_STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Action Required', value: 'docs_requested' },
  { label: 'Closure Notice', value: 'closure_notice' },
  { label: 'Pending Approval', value: 'pending_approval' },
  { label: 'Decision Ready', value: 'decision_ready' },
  { label: 'Approved', value: 'approved' },
  { label: 'Completed', value: 'completed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Closed', value: 'closed' },
  { label: 'Archived', value: 'archived' },
];

const APPLICATION_STATUS_LABEL_MAP = APPLICATION_STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});
APPLICATION_STATUS_LABEL_MAP.withdrawn = 'Closed';

const buildCanadaRegionLookup = (rows = []) => {
  const lookup = {};
  if (!Array.isArray(rows)) return lookup;
  rows.forEach(row => {
    const code = row?.code ? String(row.code).trim().toUpperCase() : '';
    const name = row?.name_en ? String(row.name_en).trim() : '';
    if (code && name) {
      lookup[code] = name;
    }
    if (name) {
      lookup[name.toLowerCase()] = name;
    }
  });
  return lookup;
};

const extractRegionCode = value => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (/^[a-z]{2}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const token = trimmed.split(/[\s-]/)[0];
  if (token && /^[a-z]{2}$/i.test(token)) {
    return token.toUpperCase();
  }
  return '';
};

const formatStatusLabel = value => {
  if (!value) return 'Unknown';
  const normalised = String(value).trim().toLowerCase();
  if (APPLICATION_STATUS_LABEL_MAP[normalised]) {
    return APPLICATION_STATUS_LABEL_MAP[normalised];
  }
  return normalised
    .split(/[_-]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const ApplicationOverviewWidget = ({
  actions,
  application_id,
  caseData,
  toggleHelpPanel,
  applicationRowVersion,
  onRowVersionUpdate,
}) => {
  const DetailItem = ({ label, value }) => (
    <SpaceBetween size="xxs">
      <Box color="text-body-secondary" fontSize="body-s">{label}</Box>
      {React.isValidElement(value) ? (
        value
      ) : (
        <Box fontWeight="bold">{value ?? '-'}</Box>
      )}
    </SpaceBetween>
  );

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(Boolean(application_id));
  const [error, setError] = useState(null);
  const [statusValue, setStatusValue] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);
  const manualStatusRef = useRef(null);
  const [slaTargets, setSlaTargets] = useState(SLA_DEFAULT_DAYS);
  const [escalation, setEscalation] = useState(null);
  const [escalationLoading, setEscalationLoading] = useState(false);
  const [quickActionNote, setQuickActionNote] = useState('');
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [regionLookup, setRegionLookup] = useState(() => {
    if (typeof window !== 'undefined' && window.__ISET_CANADA_REGION_LOOKUP) {
      return window.__ISET_CANADA_REGION_LOOKUP;
    }
    return null;
  });
  const [checklistMissingCount, setChecklistMissingCount] = useState(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistRefreshKey, setChecklistRefreshKey] = useState(0);
  const [rowVersion, setRowVersion] = useState(() => {
    const fromProp = Number(applicationRowVersion || 0);
    const fromCase = Number(caseData?.application_row_version || 0);
    const fromApp = Number(application?.row_version || 0);
    return Math.max(fromProp || 0, fromCase || 0, fromApp || 0, 0);
  });
  const {
    userId: currentUserId,
    displayName: currentUserName,
    role: currentUserRole,
    regionId: currentUserRegionId,
  } = useCurrentUser();
  const userRole = currentUserRole || '';
  const canonicalRole = toCanonicalRole(userRole || '');
  const canonicalRoleKey = canonicalizeRole(canonicalRole || '');
  const isSystemAdminRole = canonicalRole === 'System Administrator';
  const isProgramAdminRole = canonicalRole === 'Program Administrator';
  const isRegionalManagerRole = canonicalRole === 'Regional Coordinator';
  const [confirmStatusChange, setConfirmStatusChange] = useState(null);
  const {
    lockState,
    acquireLock,
    releaseLock,
    refreshLock: refreshLockHeartbeat,
    isLockedByMe
  } = useApplicationLock(application_id);
  const activeLock = useMemo(() => {
    if (lockState.owned && lockState.lock) {
      return lockState.lock;
    }
    const lockOwnerId = application?.lock_owner_id ?? caseData?.lock_owner_id;
    const lockOwnerName = application?.lock_owner_name ?? caseData?.lock_owner_name;
    const lockOwnerEmail = application?.lock_owner_email ?? caseData?.lock_owner_email;
    const lockExpiresAt = application?.lock_expires_at ?? caseData?.lock_expires_at;
    if (lockOwnerId || lockOwnerName || lockOwnerEmail) {
      return {
        applicationId: application_id || null,
        ownerUserId: lockOwnerId != null ? String(lockOwnerId) : null,
        ownerDisplayName: lockOwnerName || null,
        ownerEmail: lockOwnerEmail || null,
        expiresAt: lockExpiresAt || null,
        acquiredAt: null,
        ttlMinutes: null,
        heartbeatMinutes: null,
        reused: false
      };
    }
    return null;
  }, [
    application?.lock_expires_at,
    application?.lock_owner_email,
    application?.lock_owner_id,
    application?.lock_owner_name,
    caseData?.lock_expires_at,
    caseData?.lock_owner_email,
    caseData?.lock_owner_id,
    caseData?.lock_owner_name,
    application_id,
    lockState.lock,
    lockState.owned
  ]);
  const lockOwnerId = activeLock?.ownerUserId ? String(activeLock.ownerUserId) : null;
  const lockHeldByCurrentUser = Boolean(isLockedByMe || (currentUserId && lockOwnerId && String(currentUserId) === lockOwnerId));
  const lockedByAnotherUser = Boolean(lockOwnerId && !lockHeldByCurrentUser);
  const lockOwnerLabel = useMemo(() => {
    if (!activeLock) return '';
    if (lockHeldByCurrentUser) {
      return currentUserName || 'You';
    }
    return activeLock.ownerDisplayName || activeLock.ownerEmail || activeLock.ownerUserId || 'Unknown';
  }, [activeLock, currentUserName, lockHeldByCurrentUser]);
  const lockExpiresLabel = useMemo(() => {
    if (!activeLock?.expiresAt) return '';
    return formatDateTime(activeLock.expiresAt);
  }, [activeLock?.expiresAt]);
  const [lockAlertDismissed, setLockAlertDismissed] = useState(false);
  const lockAlertMessage = useMemo(() => {
    const lockExpiresAt = activeLock?.expiresAt ? new Date(activeLock.expiresAt) : null;
    if (lockedByAnotherUser) {
      return buildLockConflictMessage({ reason: 'owned_by_other', lock: activeLock });
    }
    if (lockHeldByCurrentUser) {
      const ownerLabel = currentUserName || activeLock?.ownerDisplayName || 'you';
      const expiresFragment = lockExpiresAt ? ` (expires ${lockExpiresAt.toLocaleTimeString()})` : '';
      return `You (${ownerLabel}) currently hold an edit lock${expiresFragment}. Save or cancel to release it for other users.`;
    }
    return null;
  }, [activeLock, currentUserName, lockHeldByCurrentUser, lockedByAnotherUser]);

  useEffect(() => {
    const shouldHide =
      lockAlertDismissed &&
      !lockedByAnotherUser &&
      !(lockHeldByCurrentUser && lockAlertMessage);
    if (!shouldHide) return;
    setLockAlertDismissed(false);
  }, [lockAlertDismissed, lockHeldByCurrentUser, lockedByAnotherUser, lockAlertMessage]);

  useEffect(() => {
    const incoming = Number(applicationRowVersion || 0);
    if (incoming && incoming > rowVersion) {
      setRowVersion(incoming);
    }
  }, [applicationRowVersion, rowVersion]);

  useEffect(() => {
    if (regionLookup || typeof window === 'undefined') return;
    let cancelled = false;
    apiFetch('/api/regions/canada')
      .then(res => {
        if (!res.ok) throw new Error('Region lookup failed');
        return res.json();
      })
      .then(rows => {
        if (cancelled) return;
        const lookup = buildCanadaRegionLookup(rows);
        window.__ISET_CANADA_REGION_LOOKUP = lookup;
        setRegionLookup(lookup);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [regionLookup]);

  const fetchEscalation = useCallback(async () => {
    if (!application_id) {
      setEscalation(null);
      return null;
    }
    setEscalationLoading(true);
    try {
      const res = await apiFetch(`/api/escalations?applicationId=${application_id}`);
      if (!res.ok) {
        throw new Error('Failed to load escalation');
      }
      const body = await res.json();
      const items = Array.isArray(body?.items) ? body.items : [];
      const open = items.find(item => item.state !== 'resolved') || items[0] || null;
      setEscalation(open || null);
      return open;
    } catch (_) {
      setEscalation(null);
      return null;
    } finally {
      setEscalationLoading(false);
    }
  }, [application_id]);

  const fetchLatestApplication = useCallback(async () => {
    if (!application_id) return null;
    try {
      const res = await apiFetch(`/api/applications/${application_id}`);
      if (!res.ok) return null;
      const data = await res.json();
      let payload = data.payload_json;
      if (payload && typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { payload = {}; }
      }
      data.__payload = payload || {};
      setApplication(data);
      const incomingVersion = Number(data?.row_version || 0);
      if (incomingVersion) {
        setRowVersion(prev => (incomingVersion > prev ? incomingVersion : prev));
        if (typeof onRowVersionUpdate === 'function') {
          onRowVersionUpdate(incomingVersion);
        }
      }
      return data;
    } catch (_) {
      return null;
    }
  }, [application_id, fetchEscalation, onRowVersionUpdate]);


  useEffect(() => {
    let cancelled = false;
    if (!application_id) {
      setApplication(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    apiFetch(`/api/applications/${application_id}`)
      .then(async res => {
        if (res.ok) return res.json();
        let message = 'Failed to load application';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch (_) {
          // ignore json parse issues
        }
        if (res.status === 404) message = 'Application not found';
        if (res.status === 401) message = 'Not authorized to view this application';
        const err = new Error(message);
        err.status = res.status;
        throw err;
      })
      .then(data => {
        if (cancelled) return;
        let payload = data.payload_json;
        if (payload && typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch (_) {
            payload = {};
          }
        }
        data.__payload = payload || {};
        setApplication(data);
        const incomingVersion = Number(data?.row_version || 0);
        if (incomingVersion) {
          setRowVersion(prev => (incomingVersion > prev ? incomingVersion : prev));
          if (typeof onRowVersionUpdate === 'function') {
            onRowVersionUpdate(incomingVersion);
          }
        }
        fetchEscalation().catch(() => {});
      })
      .catch(err => {
        if (!cancelled) {
          setApplication(null);
          setError(err?.message || 'Failed to load application');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [application_id]);

  const applicationStatusFromCase = caseData?.applicationStatus ?? caseData?.application_status ?? null;

  useEffect(() => {
    if (savingStatus) return;
    const nextStatus = applicationStatusFromCase || application?.status || caseData?.status || '';
    const manual = manualStatusRef.current;
    if (manual) {
      if (nextStatus === manual.pending) {
        manualStatusRef.current = null;
        if ((nextStatus || '') !== (statusValue || '')) {
          setStatusValue(nextStatus || '');
        }
        return;
      }
      if (nextStatus === manual.previous || (!nextStatus && manual.previous)) {
        return;
      }
      manualStatusRef.current = null;
    }
    if ((nextStatus || '') !== (statusValue || '')) {
      setStatusValue(nextStatus || '');
    }
  }, [applicationStatusFromCase, caseData?.status, application?.status, savingStatus, statusValue]);

  // Keep the cached application row_version in sync with fresher caseData values to avoid stale optimistic tokens.
  useEffect(() => {
    const incomingVersion = Number(caseData?.application_row_version || 0);
    if (!incomingVersion) return;
    setRowVersion(prev => (incomingVersion > prev ? incomingVersion : prev));
    setApplication(prev => {
      if (!prev) return prev;
      const currentVersion = Number(prev.row_version || 0);
      if (incomingVersion > currentVersion) {
        return { ...prev, row_version: incomingVersion };
      }
      return prev;
    });
  }, [caseData?.application_row_version]);

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
          if (!SLA_STAGE_ALLOWLIST.has(key)) return;
          const hours = item.target_hours ?? item.targetHours;
          if (hours === null || hours === undefined) return;
          const days = Number(hours) / 24;
          if (!Number.isNaN(days) && days > 0) {
            next[key] = Math.round(days);
          }
        });
        if (!cancelled) setSlaTargets(next);
      } catch (_) {
        if (!cancelled) setSlaTargets(SLA_DEFAULT_DAYS);
      }
    };
    loadSlaTargets();
    return () => {
      cancelled = true;
    };
  }, []);

  const { answers, payload } = useMemo(() => {
    if (!application) return { answers: {}, payload: {} };
    const payload = application.__payload || {};
    const rawAnswers = payload.answers || payload.intake_answers || payload;
    return {
      payload,
      answers: rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {},
    };
  }, [application]);
  const applicantUserId = useMemo(
    () =>
      caseData?.applicant_user_id ??
      caseData?.applicantUserId ??
      application?.applicant_user_id ??
      application?.applicantUserId ??
      null,
    [application, caseData]
  );
  const provinceSource = useMemo(
    () =>
      caseData?.application_address_province ||
      caseData?.application_province_fallback ||
      caseData?.submission_address_province ||
      caseData?.address_province ||
      answers['address-province'] ||
      answers['province'] ||
      application?.address_province ||
      application?.application_address_province ||
      application?.application_province ||
      application?.province ||
      null,
    [answers, application, caseData]
  );
  const provinceLabel = useMemo(() => {
    if (!provinceSource) return '';
    const raw = String(provinceSource).trim();
    if (!raw) return '';
    const code = extractRegionCode(raw);
    if (regionLookup) {
      if (code && regionLookup[code]) {
        return `${regionLookup[code]} (${code})`;
      }
      const byName = regionLookup[raw.toLowerCase()];
      if (byName) {
        return code ? `${byName} (${code})` : byName;
      }
    }
    return code || raw;
  }, [provinceSource, regionLookup]);

  useEffect(() => {
    if (!applicantUserId) {
      setChecklistMissingCount(null);
      setChecklistLoading(false);
      return;
    }
    let cancelled = false;
    setChecklistLoading(true);
    const query = application_id ? `?applicationId=${application_id}` : '';
    apiFetch(`/api/applicants/${applicantUserId}/document-checklist${query}`)
      .then(res => {
        if (!res.ok) throw new Error('Checklist lookup failed');
        return res.json();
      })
      .then(payload => {
        if (cancelled) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const reported = Number(payload?.missingRequiredCount);
        const computed = items.filter(item => item && item.required !== false && item.status !== 'complete').length;
        const missingCount = Number.isFinite(reported) ? reported : computed;
        setChecklistMissingCount(missingCount);
      })
      .catch(() => {
        if (!cancelled) setChecklistMissingCount(null);
      })
      .finally(() => {
        if (!cancelled) setChecklistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicantUserId, application_id, checklistRefreshKey]);

  useEffect(() => {
    if (!applicantUserId || typeof window === 'undefined') return;
    const handleRefresh = event => {
      const targetApplicant = event?.detail?.applicantUserId;
      if (targetApplicant && String(targetApplicant) !== String(applicantUserId)) return;
      setChecklistRefreshKey(key => key + 1);
    };
    window.addEventListener('iset:supporting-documents:refresh', handleRefresh);
    return () => window.removeEventListener('iset:supporting-documents:refresh', handleRefresh);
  }, [applicantUserId]);

  const fallbackStatusRaw = statusValue || applicationStatusFromCase || application?.status || '';
  const fallbackStatus = normalizeClosedStatus(fallbackStatusRaw);
  const normalizedStatusKey = (fallbackStatus || '').toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
  const statusContext = getCaseStatusContext(fallbackStatus);
  const roleAccess = getRoleGroups(canonicalRole || userRole);
  const { canonicalStatus, isFinalStatus } = statusContext;
  const {
    isSystemAdministratorRole,
    isAdminRole,
    isRegionalCoordinatorRole,
    isApplicationAssessorRole
  } = roleAccess;
  const roleKey = normalizeEscalationRole(canonicalRoleKey);
  const canEditStatus = isSystemAdministratorRole && canEditCaseStatus({
    role: canonicalRole || userRole,
    status: fallbackStatus,
    hasCase: Boolean(caseData?.id),
  });

  const statusOption = APPLICATION_STATUS_OPTIONS.find(option => option.value === fallbackStatus);
  const statusLabel = statusOption?.label || formatStatusLabel(fallbackStatus);
  const selectedStatusOption = statusOption || (fallbackStatus ? { label: statusLabel, value: fallbackStatus } : null);
  const docsRequestedSince = application?.updated_at || caseData?.updated_at || application?.created_at || null;
  const isDocsRequestedStatus = ['docs_requested', 'action_required', 'action_required_(docs_requested)'].includes(normalizedStatusKey);
  const docsRequestedDays = isDocsRequestedStatus ? getDaysAgo(docsRequestedSince) : null;
  const docsRequestedSuffix = docsRequestedDays !== null
    ? `${docsRequestedDays} day${docsRequestedDays === 1 ? '' : 's'} ago`
    : null;
  const badgeLabel = isDocsRequestedStatus
    ? `Docs Requested${docsRequestedSuffix ? ` ${docsRequestedSuffix}` : ''}`
    : statusLabel;
  const docsRequestedColor = (() => {
    if (!isDocsRequestedStatus || docsRequestedDays === null) return null;
    if (docsRequestedDays > 28) return 'severity-critical';
    if (docsRequestedDays >= 15) return 'severity-high';
    if (docsRequestedDays >= 7) return 'severity-medium';
    if (docsRequestedDays >= 3) return 'severity-low';
    return 'grey';
  })();
  const badgeColor = docsRequestedColor || statusColor(statusOption?.value || fallbackStatus || 'unknown');
  const statusSelectDisabled = !canEditStatus || savingStatus || lockedByAnotherUser;
  const hasOpenEscalation = escalation && escalation.state && escalation.state !== 'resolved';
  const escalationOwnerRole = normalizeEscalationRole(canonicalizeRole(escalation?.current_owner_role || escalation?.currentOwnerRole));
  const isEscalationOwner = Boolean(hasOpenEscalation && escalationOwnerRole && escalationOwnerRole === roleKey);
  const escalationBadgeLabel = hasOpenEscalation
    ? `Escalated to ${formatRoleLabel(escalationOwnerRole || escalation?.target_role || escalation?.targetRole || '')}`
    : null;
  const escalationTargetRoleLabel = roleKey === 'regional_manager' ? 'Program Administrator' : 'Regional Manager';
  const hasCaseId = Boolean(caseData?.id);
  const canAssign = hasCaseId && !ASSIGN_BLOCKED_STATUSES.has(normalizedStatusKey) && (isAdminRole || isRegionalCoordinatorRole);
  const canPutOnClosureNotice = hasCaseId && CLOSURE_NOTICE_ELIGIBLE_STATUSES.has(normalizedStatusKey);
  const canResumeReview = hasCaseId && RESUME_REVIEW_STATUSES.has(normalizedStatusKey);
  const canCloseApplication = hasCaseId && CLOSE_ALLOWED_STATUSES.has(normalizedStatusKey) && (isAdminRole || isRegionalCoordinatorRole);
  const canArchiveApplication = hasCaseId && ARCHIVE_ALLOWED_STATUSES.has(normalizedStatusKey) && isAdminRole;
  const canReopenClosed = hasCaseId && normalizedStatusKey === 'closed' && isAdminRole;
  const canReopenArchived = hasCaseId && normalizedStatusKey === 'archived' && isSystemAdministratorRole;
  const canReopenApplication = canReopenClosed || canReopenArchived;
  const canEscalate = hasCaseId && !APPLICATION_TERMINAL_STATUSES.has(normalizedStatusKey) && !hasOpenEscalation && (isApplicationAssessorRole || isRegionalCoordinatorRole);
  const canEscalateUp = hasOpenEscalation && isEscalationOwner && roleKey === 'regional_manager';
  const canRespondEscalation = hasOpenEscalation && isEscalationOwner;
  const canResolveEscalation = hasOpenEscalation && isEscalationOwner;
  const quickActionItems = useMemo(() => {
    const items = [];
    if (canAssign) {
      items.push({ id: 'assign', text: 'Assign / reassign' });
    }
    if (canPutOnClosureNotice) {
      items.push({ id: 'closure-notice', text: 'Put on closure notice' });
    }
    if (canResumeReview) {
      items.push({ id: 'resume-review', text: 'Resume review' });
    }
    if (canCloseApplication) {
      items.push({ id: 'close', text: 'Close application' });
    }
    if (canArchiveApplication) {
      items.push({ id: 'archive', text: 'Archive application' });
    }
    if (canReopenApplication) {
      items.push({ id: 'reopen', text: 'Reopen application' });
    }
    if (canEscalate) {
      items.push({ id: 'escalate', text: `Escalate to ${escalationTargetRoleLabel}` });
    }
    if (canRespondEscalation) {
      items.push({ id: 'respond-escalation', text: 'Respond to escalation' });
    }
    if (canResolveEscalation) {
      items.push({ id: 'resolve-escalation', text: 'Resolve escalation' });
    }
    if (canEscalateUp) {
      items.push({ id: 'escalate-up', text: 'Escalate to Program Administrator' });
    }
    items.push(...APPLICATION_LAYOUT_ACTIONS);
    return items;
  }, [
    canAssign,
    canPutOnClosureNotice,
    canResumeReview,
    canCloseApplication,
    canArchiveApplication,
    canReopenApplication,
    canEscalate,
    canRespondEscalation,
    canResolveEscalation,
    canEscalateUp,
    escalationTargetRoleLabel,
  ]);

  const handleConfirmDismiss = () => setConfirmStatusChange(null);
  const [quickActionConfirm, setQuickActionConfirm] = useState(null);
  const [quickActionConfirmInput, setQuickActionConfirmInput] = useState('');

  const selectOptionByValue = value =>
    APPLICATION_STATUS_OPTIONS.find(option => option.value === value) ||
    { value, label: formatStatusLabel(value) };

  const loadAssignable = useCallback(async () => {
    setAssignLoading(true);
    setAssignError(null);
    try {
      const res = await apiFetch('/api/staff/assignable');
      if (!res.ok) {
        throw new Error('assignable_fetch_failed');
      }
      const data = await res.json();
      const rawStaff = Array.isArray(data) ? data : [];
      const filteredStaff = rawStaff.filter(staff => {
        if (isSystemAdminRole) return true;
        if (isProgramAdminRole) {
          const staffRole = toCanonicalRole(staff?.role || staff?.primary_role || staff?.primaryRole || '');
          return staffRole !== 'System Administrator';
        }
        if (isRegionalManagerRole) {
          const staffRegion = Number(staff?.region_id ?? staff?.regionId ?? null);
          const userRegion = Number(currentUserRegionId ?? null);
          return Number.isFinite(staffRegion) && Number.isFinite(userRegion) && staffRegion === userRegion;
        }
        return false;
      });
      const options = filteredStaff.map(staff => ({
        label: `${staff.display_name || staff.email || staff.id} (${staff.role || 'Staff'})`,
        value: String(staff.id),
      }));
      setAssignableStaff(options);
      const currentOwnerId =
        caseData?.assigned_user_id ??
        caseData?.assigned_to_user_id ??
        caseData?.assignedUserId ??
        caseData?.owner?.id ??
        null;
      if (currentOwnerId && options.some(option => option.value === String(currentOwnerId))) {
        setSelectedAssignee(options.find(option => option.value === String(currentOwnerId)) || null);
      }
    } catch (err) {
      setAssignableStaff([]);
      setAssignError('Unable to load assignable staff.');
    } finally {
      setAssignLoading(false);
    }
  }, [
    caseData?.assigned_user_id,
    caseData?.assigned_to_user_id,
    caseData?.assignedUserId,
    caseData?.owner?.id,
    currentUserRegionId,
    isProgramAdminRole,
    isRegionalManagerRole,
    isSystemAdminRole,
  ]);

  const handleAssignSubmit = useCallback(async () => {
    const caseId = caseData?.id;
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
        body: JSON.stringify({ assignee_id: selectedAssignee.value }),
      });
      if (!response.ok) {
        throw new Error('assign_failed');
      }
      setAssignModalVisible(false);
      setSelectedAssignee(null);
      if (typeof actions?.refreshCaseData === 'function') {
        await actions.refreshCaseData();
      } else {
        await fetchLatestApplication();
      }
    } catch (err) {
      setAssignError('Assignment failed. Please try again.');
    } finally {
      setAssignSubmitting(false);
    }
  }, [actions, caseData?.id, fetchLatestApplication, selectedAssignee]);

  const requestLayoutSwitch = useCallback(layoutId => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('applicationAssessment:set-layout', {
        detail: { layoutId },
      })
    );
  }, []);

  const handleQuickActionSelect = ({ detail }) => {
    const actionId = detail?.id;
    if (!actionId) return;
    const layoutId = APPLICATION_LAYOUT_ACTION_MAP[actionId];
    if (layoutId) {
      requestLayoutSwitch(layoutId);
      return;
    }
    if (lockedByAnotherUser) {
      setStatusFeedback({
        type: 'warning',
        content: lockAlertMessage || 'This case is currently locked by another user.'
      });
      return;
    }

    const buildConfirm = ({ title, body, targetStatus, actionLabel, noteHint, confirmWord, resolveEscalation, requireNote = true }) => ({
      type: 'status',
      title,
      body,
      targetStatus,
      targetOption: selectOptionByValue(targetStatus),
      actionLabel,
      requireNote,
      noteHint,
      confirmWord,
      resolveEscalation
    });

    if (actionId === 'assign') {
      setAssignError(null);
      setSelectedAssignee(null);
      setAssignModalVisible(true);
      loadAssignable().catch(() => {});
      return;
    }

    if (actionId === 'closure-notice') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm(buildConfirm({
        title: 'Put on closure notice',
        body: 'Use this when the applicant has not responded or supplied key documents. This keeps the application open while it is flagged for closure.',
        targetStatus: 'closure_notice',
        actionLabel: 'Closure notice',
        noteHint: 'Include that if the applicant does not respond, escalate to a manager or admin for closure.'
      }));
      return;
    }

    if (actionId === 'resume-review') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm(buildConfirm({
        title: 'Resume review',
        body: 'Resume review and return this application to In Review.',
        targetStatus: 'in_review',
        actionLabel: 'Resume review',
        requireNote: false
      }));
      return;
    }

    if (actionId === 'close') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm(buildConfirm({
        title: 'Close application',
        body: 'Closing will move this application to Closed. Use this when the applicant requests closure or is no longer pursuing the application.',
        targetStatus: 'closed',
        actionLabel: 'Close application',
        resolveEscalation: true
      }));
      return;
    }

    if (actionId === 'archive') {
      if (hasOpenEscalation) {
        setStatusFeedback({
          type: 'info',
          content: 'Archiving is blocked while an escalation is open. Resolve the escalation before archiving.',
        });
        return;
      }
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm(buildConfirm({
        title: 'Archive application',
        body: 'Archiving hides this application from standard views until restored by an administrator.',
        targetStatus: 'archived',
        actionLabel: 'Archive application'
      }));
      return;
    }

    if (actionId === 'reopen') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm(buildConfirm({
        title: 'Reopen application',
        body: 'Reopening will return this application to In Review.',
        targetStatus: 'in_review',
        actionLabel: 'Reopen application'
      }));
      return;
    }

    if (actionId === 'escalate') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm({
        type: 'escalation',
        actionId: 'escalate',
        title: 'Escalate application',
        body: `Escalate this application to the ${escalationTargetRoleLabel}. Provide a reason to help them address it.`,
        requireNote: true
      });
      return;
    }

    if (actionId === 'respond-escalation') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm({
        type: 'escalation',
        actionId: 'respond',
        title: 'Respond to escalation',
        body: 'Add guidance or next steps for the requester.',
        requireNote: true
      });
      return;
    }

    if (actionId === 'resolve-escalation') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm({
        type: 'escalation',
        actionId: 'resolve',
        title: 'Resolve escalation',
        body: 'Resolving will close the escalation. Add a brief note describing the resolution.',
        requireNote: true
      });
      return;
    }

    if (actionId === 'escalate-up') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm({
        type: 'escalation',
        actionId: 'escalate_up',
        title: 'Escalate to Program Administrator',
        body: 'Forward this escalation to Program Administrators. Include the context and what you are requesting.',
        requireNote: true
      });
      return;
    }
  };

  const handleConfirmProceed = async () => {
    if (!confirmStatusChange) return;
    const { nextStatus, nextOption } = confirmStatusChange;
    setConfirmStatusChange(null);
    await runStatusUpdate(nextStatus, nextOption);
  };

  const confirmModalVisible = Boolean(confirmStatusChange);
  const confirmTargetLabel = confirmStatusChange?.nextOption?.label || confirmStatusChange?.nextStatus;
  const confirmCurrentLabel = badgeLabel || formatStatusLabel(canonicalStatus) || 'current status';
  const quickModalVisible = Boolean(quickActionConfirm);

  const buildActionNote = ({ actionLabel, fromStatus, toStatus, note }) => {
    const fromLabel = formatStatusLabel(fromStatus);
    const toLabel = formatStatusLabel(toStatus);
    const trimmedNote = (note || '').trim();
    const action = actionLabel || 'Status update';
    if (!trimmedNote) {
      return `${action} (${fromLabel} -> ${toLabel})`;
    }
    return `${action} (${fromLabel} -> ${toLabel}): ${trimmedNote}`;
  };

  const saveCaseNote = async ({ caseId, actionLabel, fromStatus, toStatus, note }) => {
    const trimmed = (note || '').trim();
    if (!trimmed) return true;
    const body = buildActionNote({ actionLabel, fromStatus, toStatus, note: trimmed });
    const response = await apiFetch(`/api/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    });
    if (!response.ok) {
      throw new Error('note_save_failed');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('case-notes-refresh', { detail: { caseId } }));
      window.dispatchEvent(new CustomEvent('case-events-refresh', { detail: { caseId } }));
    }
    return true;
  };

  const resolveEscalationIfNeeded = async (note) => {
    if (!hasOpenEscalation || !escalation?.id) return;
    const response = await apiFetch(`/api/escalations/${escalation.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', note: (note || '').trim(), disposition: 'resolve' })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.message || body?.error || 'Failed to resolve escalation.';
      throw new Error(message);
    }
  };

  const runStatusUpdate = async (nextStatus, nextOption, options = {}) => {
    const {
      note = '',
      actionLabel = '',
      resolveEscalation = false,
      blockOnEscalation = false,
    } = options;
    if (!caseData?.id) {
      setStatusFeedback({ type: 'error', content: 'Case details are unavailable; cannot update status.' });
      return;
    }
    if (blockOnEscalation && hasOpenEscalation) {
      setStatusFeedback({
        type: 'info',
        content: 'This action is blocked while an escalation is open. Resolve the escalation before proceeding.',
      });
      return;
    }
    const previousStatus = statusValue;
    const label = nextOption?.label || formatStatusLabel(nextStatus);
    setStatusFeedback(null);
    manualStatusRef.current = { pending: nextStatus, previous: previousStatus || '' };
    setStatusValue(nextStatus);
    setSavingStatus(true);
    let releaseAfter = false;
    let noteSaved = true;
    try {
      if (!lockState.owned) {
        const lockResult = await acquireLock();
        if (!lockResult?.ok) {
          const message = buildLockConflictMessage(lockResult);
          manualStatusRef.current = null;
          setStatusValue(previousStatus);
          setStatusFeedback({ type: 'warning', content: message });
          return;
        }
        releaseAfter = Boolean(lockResult.localOwner);
      } else if (lockHeldByCurrentUser) {
        releaseAfter = true;
        refreshLockHeartbeat().catch(() => {});
      }

      if (resolveEscalation) {
        await resolveEscalationIfNeeded(note);
      }

      const expectedRowVersion = Number(rowVersion || caseData?.application_row_version || application?.row_version || 0);
      const payload = { applicationStatus: nextStatus };
      if (expectedRowVersion > 0) {
        payload.expectedRowVersion = expectedRowVersion;
      }
      const response = await apiFetch(`/api/cases/${caseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let body = null;
      try {
        body = await response.json();
      } catch (_) {
        body = null;
      }

      if (response.status === 423) {
        const message = buildLockConflictMessage({ reason: body?.reason || body?.error, lock: body?.lock });
        manualStatusRef.current = null;
        setStatusValue(previousStatus);
        setStatusFeedback({ type: 'warning', content: message });
        if (releaseAfter) {
          releaseLock({ silent: true }).catch(() => {});
        }
        return;
      }

      if (response.status === 409) {
        manualStatusRef.current = null;
        setStatusValue(previousStatus);
        const currentRowVersion = Number(body?.currentRowVersion ?? body?.application_row_version);
        if (currentRowVersion) {
          setRowVersion(prev => (currentRowVersion > prev ? currentRowVersion : prev));
          if (typeof onRowVersionUpdate === 'function') {
            onRowVersionUpdate(currentRowVersion);
          }
          setApplication(prev => (prev ? { ...prev, row_version: currentRowVersion } : prev));
        }
        await fetchLatestApplication();
        if (typeof actions?.refreshCaseData === 'function') {
          try { await actions.refreshCaseData(); } catch (_) {}
        }
        setStatusFeedback({ type: 'warning', content: 'Another user updated this application first. The latest status has been reloaded.' });
        if (releaseAfter) {
          releaseLock({ silent: true }).catch(() => {});
        }
        return;
      }
      if (!response.ok) {
        const message = body?.error || 'Failed to update status.';
        throw new Error(message);
      }

      try {
        await saveCaseNote({
          caseId: caseData.id,
          actionLabel: actionLabel || label,
          fromStatus: previousStatus || '',
          toStatus: nextStatus,
          note,
        });
      } catch (_) {
        noteSaved = false;
      }

      await fetchLatestApplication();
      if (typeof actions?.refreshCaseData === 'function') {
        try {
          await actions.refreshCaseData();
        } catch (_) {
          // ignore refresh failures, local state already updated
        }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('case-events-refresh', { detail: { caseId: caseData.id } }));
      }
      await fetchEscalation().catch(() => {});
      if (!noteSaved) {
        setStatusFeedback({
          type: 'warning',
          content: `Application status updated to ${label}, but the note could not be saved. Please add the note manually.`,
        });
      } else {
        setStatusFeedback({ type: 'success', content: `Application status updated to ${label}.` });
      }
    } catch (err) {
      manualStatusRef.current = null;
      setStatusValue(previousStatus);
      setStatusFeedback({ type: 'error', content: err?.message || 'Failed to update status.' });
    } finally {
      setSavingStatus(false);
      if (releaseAfter) {
        releaseLock({ silent: true }).catch(() => {});
      }
    }
  };

  const runEscalationAction = async (actionId, meta = {}) => {
    if (!application_id) {
      setStatusFeedback({ type: 'error', content: 'Application unavailable; cannot perform escalation action.' });
      return;
    }
    if (lockedByAnotherUser) {
      setStatusFeedback({ type: 'warning', content: lockAlertMessage || 'This case is currently locked by another user.' });
      return;
    }
    const note = (meta?.note || '').trim();
    if (!note) {
      setStatusFeedback({ type: 'warning', content: 'Please provide notes before continuing.' });
      return;
    }
    const isCreate = actionId === 'escalate' && !escalation;
    if (!isCreate && !escalation?.id) {
      setStatusFeedback({ type: 'error', content: 'No escalation is available for this action.' });
      return;
    }

    let releaseAfter = false;
    try {
      setSavingStatus(true);
      if (!lockState.owned) {
        const lockResult = await acquireLock();
        if (!lockResult?.ok) {
          const message = buildLockConflictMessage(lockResult);
          setStatusFeedback({ type: 'warning', content: message });
          setSavingStatus(false);
          return;
        }
        releaseAfter = Boolean(lockResult.localOwner);
      } else if (lockHeldByCurrentUser) {
        releaseAfter = true;
        refreshLockHeartbeat().catch(() => {});
      }

      let endpoint = '';
      let payload = {};
      if (isCreate) {
        const targetRole = roleKey === 'regional_manager' ? 'program_administrator' : 'regional_manager';
        endpoint = '/api/escalations';
        payload = {
          applicationId: application_id,
          caseId: caseData?.id || caseData?.case_id || null,
          reason: note,
          details: note,
          targetRole
        };
      } else {
        const targetRole = actionId === 'escalate_up' ? 'program_administrator' : escalation?.target_role || escalation?.targetRole || null;
        endpoint = `/api/escalations/${escalation.id}/respond`;
        payload = {
          action: actionId === 'escalate_up' ? 'escalate' : actionId,
          note,
          disposition: actionId,
          targetRole
        };
      }

      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => null);
      if (response.status === 423) {
        const message = buildLockConflictMessage({ reason: body?.reason || body?.error, lock: body?.lock });
        setStatusFeedback({ type: 'warning', content: message });
        setSavingStatus(false);
        if (releaseAfter) releaseLock({ silent: true }).catch(() => {});
        return;
      }
      if (!response.ok) {
        const message = body?.message || body?.error || 'Escalation action failed.';
        throw new Error(message);
      }

      await fetchEscalation();
      if (typeof actions?.refreshCaseData === 'function') {
        try { await actions.refreshCaseData(); } catch (_) {}
      }
      if (isCreate) {
        const targetEmail = body?.target_email || null;
        const targetLabel = targetEmail || 'Regional Manager';
        setStatusFeedback({ type: 'success', content: `Application escalated to ${targetLabel}.` });
      } else if (actionId === 'escalate_up' || actionId === 'escalate') {
        const targetEmail = body?.target_email || null;
        const targetLabel = targetEmail || 'Program Administrator';
        setStatusFeedback({ type: 'success', content: `Application escalated to ${targetLabel}.` });
      } else {
        setStatusFeedback({ type: 'success', content: 'Escalation updated.' });
      }
    } catch (err) {
      setStatusFeedback({ type: 'error', content: err?.message || 'Escalation action failed.' });
    } finally {
      setSavingStatus(false);
      if (releaseAfter) {
        releaseLock({ silent: true }).catch(() => {});
      }
    }
  };

  const handleStatusChange = ({ detail }) => {
    const nextOption = detail.selectedOption;
    const nextStatus = nextOption?.value;
    if (!nextStatus || nextStatus === statusValue) return;
    if (lockedByAnotherUser) {
      setStatusFeedback({
        type: 'warning',
        content: lockAlertMessage || 'This case is currently locked by another user.'
      });
      return;
    }

    if (statusSelectDisabled) {
      const message = !canEditStatus
        ? 'Status changes in this widget are limited to system administrators.'
        : 'Status changes are not permitted right now.';
      setStatusFeedback({ type: 'info', content: message });
      return;
    }

    const canonicalNextStatus = getCaseStatusContext(nextStatus).canonicalStatus;
    if (!isStatusTransitionAllowed({ role: canonicalRole || userRole, fromStatus: canonicalStatus, toStatus: canonicalNextStatus })) {
      setStatusFeedback({
        type: 'info',
        content: 'That status change is not available for your role.',
      });
      return;
    }

    if (isSystemAdministratorRole && isFinalStatus && canonicalNextStatus !== canonicalStatus) {
      setConfirmStatusChange({ nextStatus, nextOption });
      return;
    }

    runStatusUpdate(nextStatus, nextOption);
  };

  const statusFormField = isSystemAdministratorRole ? (
    <FormField stretch={true} label="" description="">
      <Select
        selectedOption={selectedStatusOption}
        options={APPLICATION_STATUS_OPTIONS}
        onChange={handleStatusChange}
        placeholder={canEditStatus ? 'Select status' : 'Status unavailable'}
        disabled={statusSelectDisabled}
        statusType={savingStatus ? 'loading' : undefined}
        loadingText="Updating status"
        empty="No status options available"
        expandToViewport
        ariaLabel="Application status"
      />
    </FormField>
  ) : hasOpenEscalation ? (
    <Badge color="severity-medium">{escalationBadgeLabel || 'Escalated'}</Badge>
  ) : (
    <Badge color={badgeColor}>{badgeLabel}</Badge>
  );

  const overviewItems = [];

  const referenceNumber = payload?.submission_snapshot?.reference_number || caseData?.tracking_id;
  if (referenceNumber) {
    overviewItems.push({
      label: 'Reference #',
      value: (
        <CopyToClipboard
          copyButtonAriaLabel="Copy reference number"
          copyErrorText="Reference number failed to copy"
          copySuccessText="Reference number copied"
          textToCopy={referenceNumber}
          variant="inline"
        />
      ),
    });
  }

  overviewItems.push({ label: 'Application Status', value: statusFormField });

  const preferredName = answers['preferred-name'];
  if (preferredName) overviewItems.push({ label: 'Preferred Name', value: preferredName });

  const applicantName = caseData?.applicant_name || [answers['first-name'], answers['middle-names'], answers['last-name']].filter(Boolean).join(' ');

  const contactEmail = caseData?.applicant_email || answers['contact-email-address'] || answers.email;
  if (contactEmail) {
    overviewItems.push({
      label: 'Email',
      value: (
        <CopyToClipboard
          copyButtonAriaLabel="Copy applicant email"
          copyErrorText="Email failed to copy"
          copySuccessText="Email copied"
          textToCopy={contactEmail}
          variant="inline"
        />
      )
    });
  }

  const phoneNumber = caseData?.applicant_phone || answers['telephone-day'] || answers['telephone-alt'];
  if (phoneNumber) overviewItems.push({ label: 'Phone', value: phoneNumber });

  if (provinceLabel) overviewItems.push({ label: 'Province / Territory', value: provinceLabel });

  if (application?.created_at) overviewItems.push({ label: 'Received At', value: formatDateTime(application.created_at) });
  if (application?.updated_at) overviewItems.push({ label: 'Last Updated', value: formatDateTime(application.updated_at) });
  if (application) {
    const assigned = Boolean(
      caseData?.assigned_user_id ||
      caseData?.assigned_to_user_id ||
      application?.assigned_user_id ||
      application?.assigned_to_user_id ||
      application?.assigned_evaluator ||
      application?.assigned_evaluator_id
    );
    const statusInfo = getStatusInfo({ application_status: fallbackStatus, case_status: null, case_id: null, assigned_user_id: assigned });
    const slaMeta = computeSlaMeta(application, slaTargets, statusInfo.rawStatus, assigned);
    overviewItems.push({
      label: 'SLA Status',
      value: <Badge color={slaMeta.color}>{slaMeta.label}</Badge>
    });
  }

  if (applicantUserId) {
    let checklistValue = 'Unavailable';
    if (checklistLoading) {
      checklistValue = 'Loading...';
    } else if (Number.isFinite(checklistMissingCount)) {
      if (checklistMissingCount > 0) {
        checklistValue = (
          <Badge color="severity-high">
            {`${checklistMissingCount} missing`}
          </Badge>
        );
      } else {
        checklistValue = <Badge color="green">Complete</Badge>;
      }
    }
    overviewItems.push({ label: 'Document Checklist', value: checklistValue });
  }

  const assignedName = caseData?.assigned_user_name || application?.assigned_evaluator?.name;
  const assignedEmail = caseData?.assigned_user_email || application?.assigned_evaluator?.email;
  if (assignedName || assignedEmail) {
    const display = assignedName && assignedEmail ? `${assignedName} (${assignedEmail})` : (assignedName || assignedEmail);
    overviewItems.push({ label: 'Assigned Evaluator', value: display });
  }

  if (caseData?.assigned_user_ptma_name) {
    overviewItems.push({ label: 'Assigned PTMA', value: caseData.assigned_user_ptma_name });
  }

  if (activeLock) {
    if (lockOwnerLabel) {
      overviewItems.push({ label: 'Lock Owner', value: lockOwnerLabel });
    }
    if (lockExpiresLabel) {
      overviewItems.push({ label: 'Lock Expires', value: lockExpiresLabel });
    }
  }

  // Removed separate caseStatusSection; status selector now inline in overviewItems

  const overviewContent = loading ? (
    <Box textAlign="center" padding="m">
      <Spinner />
    </Box>
  ) : error ? (
    <Box color="text-status-critical">{error}</Box>
  ) : overviewItems.length ? (
    <ColumnLayout columns={6} minColumnWidth={160} variant="text-grid" borders="vertical">
      {overviewItems.map(item => (
        <DetailItem key={item.label} label={item.label} value={item.value} />
      ))}
    </ColumnLayout>
  ) : (
    <Box color="text-status-inactive">No overview data available.</Box>
  );

  const headerTitle = applicantName ? `Application Overview - ${applicantName}` : 'Application Overview';

  return (
    <BoardItem
      header={
        <Header
          actions={
            (
              <SpaceBetween direction="horizontal" size="xs">
                {quickActionItems.length ? (
                  <ButtonDropdown
                    items={quickActionItems}
                    onItemClick={handleQuickActionSelect}
                    ariaLabel="Quick actions"
                    expandToViewport
                    disabled={savingStatus || quickActionItems.length === 0}
                  >
                    Quick actions
                  </ButtonDropdown>
                ) : null}
              </SpaceBetween>
            )
          }
          info={
            toggleHelpPanel ? (
              <Link
                variant="info"
                onFollow={() =>
                  toggleHelpPanel(
                    <ApplicationOverviewHelp />,
                    'Application Overview Help',
                    ApplicationOverviewHelp.aiContext
                  )
                }
              >
                Info
              </Link>
            ) : undefined
          }
        >
          {headerTitle}
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      settings={
        actions && actions.removeItem && (
          <ButtonDropdown
            items={[{ id: 'remove', text: 'Remove' }]}
            ariaLabel="Application overview settings"
            variant="icon"
            onItemClick={() => actions.removeItem()}
          />
        )
      }
    >
      <SpaceBetween size="l">
        {lockAlertMessage && !lockAlertDismissed && (
          <Alert
            type={lockedByAnotherUser ? 'warning' : 'info'}
            dismissible
            onDismiss={() => setLockAlertDismissed(true)}
          >
            {lockAlertMessage}
          </Alert>
        )}
        {statusFeedback && (
          <Alert
            type={statusFeedback.type}
            dismissible
            onDismiss={() => setStatusFeedback(null)}
          >
            {statusFeedback.content}
          </Alert>
        )}
        {overviewContent}
        <Modal
          visible={assignModalVisible}
          onDismiss={() => {
            if (assignSubmitting) return;
            setAssignModalVisible(false);
            setSelectedAssignee(null);
            setAssignError(null);
          }}
          header="Assign / reassign application"
          closeAriaLabel="Close assign modal"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => {
                  if (assignSubmitting) return;
                  setAssignModalVisible(false);
                  setSelectedAssignee(null);
                  setAssignError(null);
                }}
                disabled={assignSubmitting}
              >
                Cancel
              </Button>
              <Button variant="primary" loading={assignSubmitting} onClick={handleAssignSubmit}>
                Save
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            {assignError ? <StatusIndicator type="error">{assignError}</StatusIndicator> : null}
            <FormField
              label="Assignee"
              description="Select the staff member who will own this application."
              stretch
            >
              <Select
                placeholder={assignLoading ? 'Loading staff...' : 'Select assignee'}
                selectedOption={selectedAssignee}
                options={assignableStaff}
                onChange={({ detail }) => setSelectedAssignee(detail.selectedOption || null)}
                statusType={assignLoading ? 'loading' : 'finished'}
                filteringType="auto"
                disabled={assignLoading}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
        {confirmModalVisible && (
          <Modal
            visible={confirmModalVisible}
            onDismiss={handleConfirmDismiss}
            closeAriaLabel="Close confirmation"
            header="Confirm status change"
            footer={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={handleConfirmDismiss} disabled={savingStatus}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmProceed}
                  loading={savingStatus}
                  disabled={savingStatus}
                >
                  Change status
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween direction="vertical" size="s">
              <Box>
                This application is currently marked as {confirmCurrentLabel}. Changing a finalized status should only be done when absolutely necessary.
              </Box>
              <Box fontWeight="bold">
                Do you want to move it to {confirmTargetLabel || 'the selected status'}?
              </Box>
            </SpaceBetween>
          </Modal>
        )}
        {quickModalVisible && (
          <Modal
            visible={quickModalVisible}
            onDismiss={() => {
              setQuickActionConfirm(null);
              setQuickActionConfirmInput('');
              setQuickActionNote('');
            }}
            closeAriaLabel="Close quick action confirmation"
            header={quickActionConfirm?.title || 'Confirm action'}
            footer={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  onClick={() => {
                    setQuickActionConfirm(null);
                    setQuickActionConfirmInput('');
                    setQuickActionNote('');
                  }}
                  disabled={savingStatus}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (quickActionConfirm?.type === 'escalation') {
                      const actionId = quickActionConfirm?.actionId;
                      const note = quickActionNote;
                      setQuickActionConfirm(null);
                      setQuickActionConfirmInput('');
                      setQuickActionNote('');
                      runEscalationAction(actionId, { note });
                      return;
                    }
                    if (!quickActionConfirm?.targetStatus) {
                      setQuickActionConfirm(null);
                      setQuickActionConfirmInput('');
                      setQuickActionNote('');
                      return;
                    }
                    const targetOption = quickActionConfirm?.targetOption;
                    const note = quickActionNote;
                    const actionLabel = quickActionConfirm?.actionLabel;
                    const resolveEscalation = Boolean(quickActionConfirm?.resolveEscalation);
                    const blockOnEscalation = Boolean(quickActionConfirm?.blockOnEscalation);
                    setQuickActionConfirm(null);
                    setQuickActionConfirmInput('');
                    setQuickActionNote('');
                    runStatusUpdate(quickActionConfirm.targetStatus, targetOption, {
                      note,
                      actionLabel,
                      resolveEscalation,
                      blockOnEscalation,
                    });
                  }}
                  loading={savingStatus}
                  disabled={
                    savingStatus ||
                    (quickActionConfirm?.confirmWord &&
                      quickActionConfirmInput.trim().toLowerCase() !== quickActionConfirm.confirmWord) ||
                    (quickActionConfirm?.requireNote && !quickActionNote.trim())
                  }
                >
                  Confirm
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween direction="vertical" size="s">
              <Box>{quickActionConfirm?.body}</Box>
              {quickActionConfirm?.targetOption ? (
                <Box fontWeight="bold">
                  This will set status to {quickActionConfirm.targetOption.label}.
                </Box>
              ) : null}
              {quickActionConfirm?.requireNote ? (
                <FormField
                  label="Notes"
                  description={quickActionConfirm?.noteHint || 'Provide context for this action.'}
                >
                  <Textarea
                    value={quickActionNote}
                    onChange={e => setQuickActionNote(e.detail.value || '')}
                    rows={3}
                  />
                </FormField>
              ) : null}
              {quickActionConfirm?.confirmWord ? (
                <FormField label={`Type "${quickActionConfirm.confirmWord}" to confirm`}>
                  <Input
                    value={quickActionConfirmInput}
                    onChange={e => setQuickActionConfirmInput(e.detail.value || '')}
                    placeholder={quickActionConfirm.confirmWord}
                  />
                </FormField>
              ) : null}
            </SpaceBetween>
          </Modal>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ApplicationOverviewWidget;

