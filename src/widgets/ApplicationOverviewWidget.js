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
  DatePicker,
  StatusIndicator,
  Toggle,
  Hotspot
} from '@cloudscape-design/components';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import { apiFetch } from '../auth/apiClient';
import ApplicantWatchlistHitDetailsModal from '../components/ApplicantWatchlistHitDetailsModal.jsx';
import ApplicationOverviewHelp from '../helpPanelContents/applicationOverviewHelp';
import useCurrentUser from '../hooks/useCurrentUser';
import useApplicationLock, { buildLockConflictMessage } from '../hooks/useApplicationLock';
import { toCanonicalRole } from '../context/RoleMatrixContext';
import { buildApplicantWatchlistIdentity, formatSinDisplay } from '../utils/applicantWatchlist';
import {
  SLA_DEFAULT_DAYS,
  SLA_STAGE_ALLOWLIST,
  computeApplicationSlaMeta,
  normalizeClosedStatus,
} from '../utils/applicationSla';
import {
  canEditApplicationStatus,
  getApplicationStatusContext,
  getRoleGroups,
  isApplicationStatusTransitionAllowed,
  requiresFinalApplicationStatusConfirmation,
} from '../utils/rbac';
import {
  APPLICATION_HOLD_AWAITING_REASONS,
  APPLICATION_STATUS_OPTIONS,
  buildApplicationStatusInfo,
  getApplicationAwaitingReasonLabel,
  getApplicationStatusBadgeColor,
  getApplicationStatusLabel,
  mapWorkflowStatusToPersistenceStatus,
  normalizeApplicationStatus,
  normalizeStatusKey,
} from '../utils/applicationStatus';
import { resolveAssignedStaffProfileId } from '../utils/assignmentIdentity';

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

const APPLICATION_TERMINAL_STATUSES = new Set(['approved', 'completed', 'rejected', 'declined', 'cancelled', 'closed', 'archived']);
const ASSIGN_BLOCKED_STATUSES = new Set(['approved', 'archived', 'closed']);
const CLOSURE_NOTICE_ELIGIBLE_STATUSES = new Set(['submitted', 'in_review', 'docs_requested', 'pending_approval', 'on_hold']);
const PARK_ALLOWED_STATUSES = new Set(['submitted', 'in_review', 'docs_requested', 'pending_approval', 'closure_notice']);
const RESUME_REVIEW_STATUSES = new Set(['docs_requested', 'closure_notice', 'on_hold']);
const WITHDRAW_ALLOWED_STATUSES = new Set(['submitted', 'in_review', 'docs_requested', 'pending_approval', 'closure_notice', 'on_hold']);
const ARCHIVE_ALLOWED_STATUSES = new Set(['approved', 'completed', 'rejected', 'closed']);
const HOLD_REVIEW_DEFAULT_DAYS = 30;

const HOLD_REASON_OPTIONS = [
  { label: APPLICATION_HOLD_AWAITING_REASONS.external_funding, value: 'external_funding' },
  { label: APPLICATION_HOLD_AWAITING_REASONS.future_start, value: 'future_start' },
  { label: APPLICATION_HOLD_AWAITING_REASONS.applicant_pause, value: 'applicant_pause' },
  { label: APPLICATION_HOLD_AWAITING_REASONS.internal_follow_up, value: 'internal_follow_up' },
  { label: APPLICATION_HOLD_AWAITING_REASONS.other_hold, value: 'other_hold' },
];

function getApplicationReportingArtifact(caseContext, applicationId) {
  const artifacts = caseContext?.applicationReportingArtifacts;
  if (!artifacts || typeof artifacts !== 'object' || !applicationId) return null;
  const direct = artifacts[String(applicationId)] || artifacts[Number(applicationId)];
  return direct && typeof direct === 'object' ? direct : null;
}

const getDatePickerValueDaysFromNow = days => {
  const date = new Date(Date.now() + days * 86400000);
  return date.toISOString().slice(0, 10);
};

const toReminderIsoFromDateInput = value => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return `${trimmed}T09:00:00.000Z`;
};

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

const getStatusInfo = (row) => {
  return buildApplicationStatusInfo({
    applicationStatus: row.application_status || row.case_status || null,
    applicationLifecycleStatus: row.application_lifecycle_status ?? row.applicationLifecycleStatus ?? null,
    caseStatus: row.case_status || null,
    caseId: row.case_id,
    assignedUserId: resolveAssignedStaffProfileId(row),
    assessmentEligibility: row.assessment_esdc_eligibility,
    decisionOutcome: row.decision_outcome ?? row.decisionOutcome ?? null,
    awaitingReason: row.application_awaiting_reason ?? row.applicationAwaitingReason ?? null,
    closureReason: row.application_closure_reason ?? row.applicationClosureReason ?? null,
    type: row.type,
    includeEligibilityQualifier: false,
  });
};

const canonicalizeRole = (role) => {
  if (!role) return '';
  return role.toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const normalizeEscalationRole = (roleKey) => {
  if (!roleKey) return '';
  if (roleKey === 'application_assessor') return 'iset_coordinator';
  if (roleKey === 'regional_coordinator') return 'regional_manager';
  if (roleKey === 'program_admin' || roleKey === 'program_administrator') return 'nwac_administrator';
  return roleKey;
};

const formatRoleLabel = (roleKey) => {
  const normalized = normalizeEscalationRole(roleKey);
  if (!normalized) return 'reviewer';
  if (normalized === 'nwac_administrator') return 'NWAC Administrator';
  if (normalized === 'regional_manager') return 'Regional Manager';
  if (normalized === 'iset_coordinator') return 'ISET Coordinator';
  if (normalized === 'system_administrator') return 'System Administrator';
  return roleKey
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const computeSlaMeta = (application, caseData, slaTargets, rawStatus, isAssigned) => {
  const meta = computeApplicationSlaMeta({
    submittedAt: application?.submitted_at,
    createdAt: application?.created_at,
    dueAt: application?.sla_due_at,
    slaTargets,
    rawStatus,
    isAssigned,
    assessmentEligibility: application?.assessment_esdc_eligibility || caseData?.assessment_esdc_eligibility,
  });
  if (!meta || meta.status === 'unknown') {
    return { label: 'Unknown', color: 'grey' };
  }
  if (!meta.stage) {
    return { label: meta.label || 'Complete', color: 'green' };
  }
  if (meta.deltaDays < 0) {
    const overdueDays = Math.abs(meta.deltaDays);
    let color = 'grey';
    if (overdueDays > 28) color = 'severity-critical';
    else if (overdueDays >= 15) color = 'severity-high';
    else if (overdueDays >= 7) color = 'severity-medium';
    else if (overdueDays >= 3) color = 'severity-low';
    return { label: meta.label, color };
  }
  if (meta.deltaDays === 0) return { label: meta.label, color: 'severity-medium' };
  if (meta.deltaDays <= 3) return { label: meta.label, color: 'severity-low' };
  return { label: meta.label, color: 'green' };
};

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
  return getApplicationStatusLabel(value);
};

const ApplicationOverviewWidget = ({
  actions,
  application_id,
  caseData,
  refreshCaseData,
  onCaseUpdate,
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
  const [docsRequestSaving, setDocsRequestSaving] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);
  const manualStatusRef = useRef(null);
  const [slaTargets, setSlaTargets] = useState(SLA_DEFAULT_DAYS);
  const [escalation, setEscalation] = useState(null);
  const [escalationLoading, setEscalationLoading] = useState(false);
  const [quickActionNote, setQuickActionNote] = useState('');
  const [quickActionHoldReason, setQuickActionHoldReason] = useState(HOLD_REASON_OPTIONS[0]);
  const [quickActionReviewDate, setQuickActionReviewDate] = useState('');
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignableStaff, setAssignableStaff] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [watchlistModalOpen, setWatchlistModalOpen] = useState(false);
  const [watchlistNotes, setWatchlistNotes] = useState('');
  const [watchlistError, setWatchlistError] = useState(null);
  const [watchlistSaving, setWatchlistSaving] = useState(false);
  const [watchlistHitDetails, setWatchlistHitDetails] = useState(null);
  const [watchlistHitLoading, setWatchlistHitLoading] = useState(false);
  const [watchlistHitError, setWatchlistHitError] = useState(null);
  const [watchlistHitDetailsOpen, setWatchlistHitDetailsOpen] = useState(false);
  const watchlistHitRequestRef = useRef(0);
  const [regionLookup, setRegionLookup] = useState(() => {
    if (typeof window !== 'undefined' && window.__ISET_CANADA_REGION_LOOKUP) {
      return window.__ISET_CANADA_REGION_LOOKUP;
    }
    return null;
  });
  const [checklistMissingCount, setChecklistMissingCount] = useState(null);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistRefreshKey, setChecklistRefreshKey] = useState(0);
  const [checklistGateLabel, setChecklistGateLabel] = useState('');
  const [rowVersion, setRowVersion] = useState(() => {
    const fromProp = Number(applicationRowVersion || 0);
    const fromCase = Number(caseData?.application_row_version || 0);
    const fromApp = Number(application?.row_version || 0);
    return Math.max(fromProp || 0, fromCase || 0, fromApp || 0, 0);
  });
  const {
    userId: currentUserId,
    staffProfileId: currentStaffProfileId,
    displayName: currentUserName,
    email: currentUserEmail,
    role: currentUserRole,
    regionId: currentUserRegionId,
    regionIds: currentUserRegionIds,
  } = useCurrentUser();
  const userRole = currentUserRole || '';
  const canonicalRole = toCanonicalRole(userRole || '');
  const canonicalRoleKey = canonicalizeRole(canonicalRole || '');
  const isSystemAdminRole = canonicalRole === 'System Administrator';
  const isProgramAdminRole = canonicalRole === 'NWAC Administrator';
  const isRegionalManagerRole = canonicalRole === 'Regional Manager';
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

  const refreshCasePayload = useCallback(async () => {
    if (typeof refreshCaseData === 'function') {
      return refreshCaseData();
    }
    if (typeof actions?.refreshCaseData === 'function') {
      return actions.refreshCaseData();
    }
    return null;
  }, [actions, refreshCaseData]);


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
        if (!res.ok) throw new Error('Failed to load workflow timing targets');
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
  const applicantName =
    caseData?.applicant_name ||
    caseData?.applicantName ||
    [answers['first-name'], answers['middle-names'], answers['last-name']].filter(Boolean).join(' ');
  const watchlistIdentity = useMemo(
    () =>
      buildApplicantWatchlistIdentity({
        caseContext: caseData?.caseContext,
        answers,
        payload,
        fallbackName: applicantName,
      }),
    [answers, applicantName, caseData?.caseContext, payload]
  );
  const watchlistCaseId = caseData?.id ?? caseData?.case_id ?? null;
  const watchlistApplicationId = application_id ?? caseData?.application_id ?? null;
  const watchlistReady =
    Boolean(watchlistIdentity.fullName) &&
    Boolean(watchlistIdentity.dob) &&
    Boolean(watchlistIdentity.sin) &&
    watchlistIdentity.sin.length === 9;
  const canAddToWatchlist = Boolean(watchlistCaseId || watchlistApplicationId);
  const watchlistDisplayName = watchlistIdentity.fullName || 'Unavailable';
  const watchlistDisplayDob = watchlistIdentity.dob || 'Unavailable';
  const watchlistDisplaySin = formatSinDisplay(watchlistIdentity.sin) || 'Unavailable';
  const watchlistExplanation =
    'Adding an applicant or participant to the watchlist means their future applications will be flagged for administrator review. Use this when the applicant owes money to the program or when there are similar risk concerns. If a new application is received with the same Social Insurance Number, administrators will be alerted automatically.';
  const loadWatchlistHitDetails = useCallback(async () => {
    if (!application_id) {
      watchlistHitRequestRef.current += 1;
      setWatchlistHitDetails(null);
      setWatchlistHitError(null);
      setWatchlistHitLoading(false);
      return null;
    }

    const requestId = watchlistHitRequestRef.current + 1;
    watchlistHitRequestRef.current = requestId;
    setWatchlistHitLoading(true);
    setWatchlistHitDetails(null);
    setWatchlistHitError(null);
    try {
      const response = await apiFetch(`/api/applications/${application_id}/watchlist-hit`);
      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {
        payload = null;
      }
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Unable to load watchlist details.');
      }
      const nextDetails = payload?.hasHit ? payload : null;
      if (watchlistHitRequestRef.current === requestId) {
        setWatchlistHitDetails(nextDetails);
        setWatchlistHitError(null);
      }
      return nextDetails;
    } catch (err) {
      if (watchlistHitRequestRef.current === requestId) {
        setWatchlistHitDetails(null);
        setWatchlistHitError(err?.message || 'Unable to load watchlist details.');
      }
      return null;
    } finally {
      if (watchlistHitRequestRef.current === requestId) {
        setWatchlistHitLoading(false);
      }
    }
  }, [application_id]);
  const watchlistHitSummary = watchlistHitDetails?.summary || null;
  const selectedReportingArtifact = getApplicationReportingArtifact(caseData?.caseContext, application_id);
  const selectedReportingTrigger = selectedReportingArtifact?.reportingTrigger || selectedReportingArtifact?.trigger || null;
  const isSelectedReportingWithdrawal =
    selectedReportingTrigger === 'withdrawal' ||
    selectedReportingArtifact?.reportingSeedSource === 'withdrawn_reporting';
  const isReportingOnlyApplication = Boolean(
    caseData?.caseContext?.reportingOnlyDenied ||
    caseData?.caseContext?.reportingOnlyDeniedIneligible ||
    caseData?.caseContext?.reportingOnlyWithdrawal ||
    caseData?.caseContext?.reportingCorrectionAllowed ||
    selectedReportingArtifact?.reportingCorrectionAllowed
  );
  const reportingApplicationLabel = caseData?.caseContext?.reportingOnlyWithdrawal || isSelectedReportingWithdrawal
    ? 'withdrawn application'
    : 'denied application';
  const ilmpCompliance = caseData?.compliance?.ilmp || null;
  const ilmpStatus = ilmpCompliance?.status || 'pending';
  const ilmpStatusType = ilmpStatus === 'clean'
    ? 'success'
    : ilmpStatus === 'blocked'
      ? 'error'
      : ilmpStatus === 'warning'
        ? 'warning'
        : 'info';
  const ilmpStatusLabel = ilmpStatus === 'clean'
    ? 'Ready for ESDC queue'
    : ilmpStatus === 'blocked'
      ? 'Blocked from ESDC queue'
      : ilmpStatus === 'warning'
        ? 'Needs ILMP review'
        : 'Pending validation';
  const ilmpMessages = Array.isArray(ilmpCompliance?.messages) ? ilmpCompliance.messages : [];
  const ilmpParticipantWorkspacePath = caseData?.esdc_submission_id
    ? `/esdc/participants/${caseData.esdc_submission_id}`
    : null;
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
    void loadWatchlistHitDetails();
  }, [loadWatchlistHitDetails]);

  useEffect(() => {
    setWatchlistHitDetailsOpen(false);
  }, [application_id]);

  useEffect(() => {
    if (!applicantUserId) {
      setChecklistMissingCount(null);
      setChecklistLoading(false);
      setChecklistGateLabel('');
      return;
    }
    let cancelled = false;
    setChecklistLoading(true);
    const params = new URLSearchParams();
    if (application_id) {
      params.set('applicationId', String(application_id));
    } else {
      const caseId = caseData?.id ?? caseData?.case_id ?? null;
      if (caseId) params.set('caseId', String(caseId));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
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
        setChecklistGateLabel(typeof payload?.gateLabel === 'string' ? payload.gateLabel : '');
      })
      .catch(() => {
        if (!cancelled) setChecklistMissingCount(null);
        if (!cancelled) setChecklistGateLabel('');
      })
      .finally(() => {
        if (!cancelled) setChecklistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicantUserId, application_id, caseData?.id, caseData?.case_id, checklistRefreshKey]);

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
  const fallbackStatus = normalizeApplicationStatus(normalizeClosedStatus(fallbackStatusRaw));
  const fallbackStatusRawKey = normalizeStatusKey(fallbackStatusRaw);
  const applicationClosureReason =
    caseData?.application_closure_reason ??
    caseData?.applicationClosureReason ??
    application?.application_closure_reason ??
    application?.applicationClosureReason ??
    application?.closure_reason ??
    null;
  const applicationClosureReasonKey = normalizeStatusKey(applicationClosureReason);
  const isWithdrawnApplication =
    fallbackStatusRawKey === 'withdrawn' ||
    (fallbackStatus === 'closed' && applicationClosureReasonKey === 'withdrawn');
  const normalizedStatusKey = fallbackStatus;
  const statusContext = getApplicationStatusContext(fallbackStatus);
  const roleAccess = getRoleGroups(canonicalRole || userRole);
  const { canonicalStatus } = statusContext;
  const {
    isSystemAdministratorRole,
    isAdminRole,
    isRegionalCoordinatorRole,
    isApplicationAssessorRole
  } = roleAccess;
  const roleKey = normalizeEscalationRole(canonicalRoleKey);
  const canEditStatus = isAdminRole && canEditApplicationStatus({
    role: canonicalRole || userRole,
    status: fallbackStatus,
    hasCase: Boolean(caseData?.id),
  });

  const statusOption = isWithdrawnApplication
    ? { label: 'Withdrawn', value: fallbackStatusRawKey === 'withdrawn' ? 'withdrawn' : fallbackStatus }
    : APPLICATION_STATUS_OPTIONS.find(option => option.value === fallbackStatus);
  const statusLabel = statusOption?.label || formatStatusLabel(fallbackStatus);
  const selectedStatusOption = statusOption || (fallbackStatus ? { label: statusLabel, value: fallbackStatus } : null);
  const isDocsRequestedStatus = ['docs_requested', 'action_required', 'action_required_(docs_requested)'].includes(normalizedStatusKey);
  const docsRequestedActive =
    Number(caseData?.docs_requested_active ?? application?.docs_requested_active ?? 0) === 1 || isDocsRequestedStatus;
  const docsRequestedAt = caseData?.docs_requested_at ?? application?.docs_requested_at ?? null;
  const docsRequestedSince = docsRequestedAt || application?.updated_at || caseData?.updated_at || application?.created_at || null;
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
  const statusBadgeColor = getApplicationStatusBadgeColor(statusOption?.value || fallbackStatus || 'unknown');
  const statusSelectDisabled = !canEditStatus || savingStatus || docsRequestSaving || lockedByAnotherUser;
  const docsRequestToggleDisabled =
    docsRequestSaving || savingStatus || lockedByAnotherUser || !caseData?.id;
  const handleDocsRequestedToggle = ({ detail }) => {
    const nextActive = detail.checked;
    if (nextActive === docsRequestedActive) return;
    runDocsRequestedUpdate(nextActive);
  };
  const hasOpenEscalation = escalation && escalation.state && escalation.state !== 'resolved';
  const escalationOwnerRole = normalizeEscalationRole(canonicalizeRole(escalation?.current_owner_role || escalation?.currentOwnerRole));
  const isEscalationOwner = Boolean(hasOpenEscalation && escalationOwnerRole && escalationOwnerRole === roleKey);
  const escalationBadgeLabel = hasOpenEscalation
    ? `Escalated to ${formatRoleLabel(escalationOwnerRole || escalation?.target_role || escalation?.targetRole || '')}`
    : null;
  const escalationTargetRoleLabel = roleKey === 'regional_manager' ? 'NWAC Administrator' : 'Regional Manager';
  const hasCaseId = Boolean(caseData?.id);
  const canAssign = hasCaseId && !ASSIGN_BLOCKED_STATUSES.has(normalizedStatusKey) && (isAdminRole || isRegionalCoordinatorRole);
  const canPutOnClosureNotice = hasCaseId && CLOSURE_NOTICE_ELIGIBLE_STATUSES.has(normalizedStatusKey);
  const canPutOnHold = hasCaseId && PARK_ALLOWED_STATUSES.has(normalizedStatusKey);
  const canResumeReview = hasCaseId && RESUME_REVIEW_STATUSES.has(normalizedStatusKey);
  const canWithdrawApplication = hasCaseId && WITHDRAW_ALLOWED_STATUSES.has(normalizedStatusKey) && (isAdminRole || isRegionalCoordinatorRole);
  const canArchiveApplication = hasCaseId && ARCHIVE_ALLOWED_STATUSES.has(normalizedStatusKey) && isAdminRole;
  const canReopenClosed = hasCaseId && normalizedStatusKey === 'closed' && isAdminRole;
  const canReopenArchived = hasCaseId && normalizedStatusKey === 'archived' && isSystemAdministratorRole;
  const canReopenApplication = canReopenClosed || canReopenArchived;
  const canReleaseLock = Boolean(application_id);
  const canEscalate = hasCaseId && !APPLICATION_TERMINAL_STATUSES.has(normalizedStatusKey) && !hasOpenEscalation && (isApplicationAssessorRole || isRegionalCoordinatorRole);
  const canEscalateUp = hasOpenEscalation && isEscalationOwner && roleKey === 'regional_manager';
  const canRespondEscalation = hasOpenEscalation && isEscalationOwner;
  const canResolveEscalation = hasOpenEscalation && isEscalationOwner;
  const quickLayoutItems = useMemo(() => APPLICATION_LAYOUT_ACTIONS, []);

  const quickActionItems = useMemo(() => {
    const actionsById = {
      'add-watchlist': canAddToWatchlist ? { id: 'add-watchlist', text: 'Add applicant to watchlist' } : null,
      assign: canAssign ? { id: 'assign', text: 'Assign / reassign' } : null,
      'resume-review': canResumeReview ? { id: 'resume-review', text: 'Resume review' } : null,
      'put-on-hold': canPutOnHold ? { id: 'put-on-hold', text: 'Put on hold' } : null,
      escalate: canEscalate ? { id: 'escalate', text: `Escalate to ${escalationTargetRoleLabel}` } : null,
      'respond-escalation': canRespondEscalation ? { id: 'respond-escalation', text: 'Respond to escalation' } : null,
      'resolve-escalation': canResolveEscalation ? { id: 'resolve-escalation', text: 'Resolve escalation' } : null,
      'escalate-up': canEscalateUp ? { id: 'escalate-up', text: 'Escalate to NWAC Administrator' } : null,
      'closure-notice': canPutOnClosureNotice ? { id: 'closure-notice', text: 'Put on closure notice' } : null,
      withdraw: canWithdrawApplication ? { id: 'withdraw', text: 'Withdraw application' } : null,
      archive: canArchiveApplication ? { id: 'archive', text: 'Archive application' } : null,
      reopen: canReopenApplication ? { id: 'reopen', text: 'Reopen application' } : null,
      'release-lock': canReleaseLock ? { id: 'release-lock', text: 'Release lock' } : null,
    };
    const order = [
      'add-watchlist',
      'assign',
      'resume-review',
      'put-on-hold',
      'escalate',
      'respond-escalation',
      'resolve-escalation',
      'escalate-up',
      'closure-notice',
      'withdraw',
      'archive',
      'reopen',
      'release-lock',
    ];
    return order.reduce((acc, id) => {
      const item = actionsById[id];
      if (item) acc.push(item);
      return acc;
    }, []);
  }, [
    canAssign,
    canAddToWatchlist,
    canPutOnClosureNotice,
    canPutOnHold,
    canResumeReview,
    canWithdrawApplication,
    canArchiveApplication,
    canReopenApplication,
    canReleaseLock,
    canEscalate,
    canRespondEscalation,
    canResolveEscalation,
    canEscalateUp,
    escalationTargetRoleLabel,
  ]);

  const handleConfirmDismiss = () => setConfirmStatusChange(null);
  const [quickActionConfirm, setQuickActionConfirm] = useState(null);
  const [quickActionConfirmInput, setQuickActionConfirmInput] = useState('');

  const resetQuickActionState = () => {
    setQuickActionConfirm(null);
    setQuickActionConfirmInput('');
    setQuickActionNote('');
    setQuickActionHoldReason(HOLD_REASON_OPTIONS[0]);
    setQuickActionReviewDate('');
  };

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
          const userRegions = Array.isArray(currentUserRegionIds) && currentUserRegionIds.length
            ? currentUserRegionIds.map(Number).filter(Number.isFinite)
            : (Number.isFinite(Number(currentUserRegionId)) ? [Number(currentUserRegionId)] : []);
          return Number.isFinite(staffRegion) && userRegions.length && userRegions.includes(staffRegion);
        }
        return false;
      });
      const options = filteredStaff.map(staff => ({
        label: `${staff.display_name || staff.email || staff.id} (${staff.role || 'Staff'})`,
        value: String(staff.id),
      }));
      setAssignableStaff(options);
      const currentOwnerId =
        resolveAssignedStaffProfileId({
          assignedStaffProfileId: caseData?.assignedStaffProfileId,
          assigned_staff_profile_id: caseData?.assigned_staff_profile_id,
          assignedUserId: caseData?.assignedUserId,
          assigned_user_id: caseData?.assigned_user_id,
          assignedToUserId: caseData?.assignedToUserId,
          assigned_to_user_id: caseData?.assigned_to_user_id,
        }) ??
        resolveAssignedStaffProfileId({
          staffProfileId:
            caseData?.owner?.staffProfileId ||
            caseData?.owner?.staff_profile_id ||
            caseData?.owner?.id,
        }) ??
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
    caseData?.assignedStaffProfileId,
    caseData?.assigned_staff_profile_id,
    caseData?.assignedUserId,
    caseData?.assigned_user_id,
    caseData?.assignedToUserId,
    caseData?.assigned_to_user_id,
    caseData?.owner?.staffProfileId,
    caseData?.owner?.staff_profile_id,
    caseData?.owner?.id,
    currentUserRegionId,
    currentUserRegionIds,
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
      if (typeof refreshCaseData === 'function' || typeof actions?.refreshCaseData === 'function') {
        await refreshCasePayload();
      } else {
        await fetchLatestApplication();
      }
    } catch (err) {
      setAssignError('Assignment failed. Please try again.');
    } finally {
      setAssignSubmitting(false);
    }
  }, [actions, caseData?.id, fetchLatestApplication, refreshCaseData, refreshCasePayload, selectedAssignee]);

  const handleWatchlistSubmit = useCallback(async () => {
    if (!watchlistReady) {
      setWatchlistError('Name, date of birth, and SIN are required to add to the watchlist.');
      return;
    }
    setWatchlistSaving(true);
    setWatchlistError(null);
    try {
      const response = await apiFetch('/api/applicant-watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: watchlistCaseId,
          applicationId: watchlistApplicationId,
          fullName: watchlistIdentity.fullName,
          firstName: watchlistIdentity.firstName,
          lastName: watchlistIdentity.lastName,
          dob: watchlistIdentity.dob,
          sin: watchlistIdentity.sin,
          notes: watchlistNotes.trim() || null,
        }),
      });
      if (response.ok) {
        setStatusFeedback({
          type: 'success',
          content: 'Applicant added to the watchlist.',
        });
        setWatchlistModalOpen(false);
        setWatchlistNotes('');
        await loadWatchlistHitDetails();
        return;
      }
      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {}
      if (response.status === 409) {
        setWatchlistError('This applicant is already on the watchlist.');
        return;
      }
      if (response.status === 400 && payload?.error === 'identity_missing') {
        setWatchlistError('Name, date of birth, and SIN are required to add to the watchlist.');
        return;
      }
      if (response.status === 400 && payload?.error === 'notes_too_long') {
        setWatchlistError(`Notes must be ${payload.max || 2000} characters or fewer.`);
        return;
      }
      setWatchlistError('Unable to add to the watchlist. Please try again.');
    } catch (_) {
      setWatchlistError('Unable to add to the watchlist. Please try again.');
    } finally {
      setWatchlistSaving(false);
    }
  }, [
    watchlistReady,
    watchlistCaseId,
    watchlistApplicationId,
    watchlistIdentity,
    watchlistNotes,
    loadWatchlistHitDetails,
  ]);

  const requestLayoutSwitch = useCallback(layoutId => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('applicationAssessment:set-layout', {
        detail: { layoutId },
      })
    );
  }, []);

  const handleQuickLayoutSelect = useCallback(({ detail }) => {
    const layoutId = APPLICATION_LAYOUT_ACTION_MAP[detail?.id];
    if (layoutId) {
      requestLayoutSwitch(layoutId);
    }
  }, [requestLayoutSwitch]);

  const releaseApplicationLockNow = useCallback(async () => {
    if (!application_id) {
      setStatusFeedback({ type: 'info', content: 'No application lock is available to release.' });
      return;
    }
    setStatusFeedback(null);
    setSavingStatus(true);
    try {
      const response = await apiFetch(`/api/locks/application/${application_id}`, { method: 'DELETE' });
      let body = null;
      try {
        body = await response.json();
      } catch (_) {
        body = null;
      }
      if (response.status === 423) {
        const message = buildLockConflictMessage({ reason: body?.reason || body?.error, lock: body?.lock });
        setStatusFeedback({ type: 'warning', content: message });
        return;
      }
      if (!response.ok) {
        throw new Error(body?.message || body?.error || 'Failed to release lock.');
      }

      // Clear local lock state and refresh lock metadata.
      await releaseLock({ silent: true }).catch(() => {});
      await fetchLatestApplication();
      try {
        await refreshCasePayload();
      } catch (_) {}

      if (body?.released === false) {
        setStatusFeedback({ type: 'info', content: 'No active lock to release.' });
      } else {
        setStatusFeedback({ type: 'success', content: 'Lock released.' });
      }
    } catch (err) {
      setStatusFeedback({ type: 'error', content: err?.message || 'Failed to release lock.' });
    } finally {
      setSavingStatus(false);
    }
  }, [application_id, fetchLatestApplication, refreshCasePayload, releaseLock]);

  const handleQuickActionSelect = ({ detail }) => {
    const actionId = detail?.id;
    if (!actionId) return;
    const layoutId = APPLICATION_LAYOUT_ACTION_MAP[actionId];
    if (layoutId) {
      requestLayoutSwitch(layoutId);
      return;
    }
    if (actionId === 'add-watchlist') {
      setWatchlistError(null);
      setWatchlistNotes('');
      setWatchlistModalOpen(true);
      return;
    }
    if (actionId === 'release-lock') {
      releaseApplicationLockNow();
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

    if (actionId === 'put-on-hold') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionHoldReason(HOLD_REASON_OPTIONS[0]);
      setQuickActionReviewDate(getDatePickerValueDaysFromNow(HOLD_REVIEW_DEFAULT_DAYS));
      setQuickActionConfirm(buildConfirm({
        title: 'Put application on hold',
        body: 'Use this when the application should stay open but leave active assessment and decision queues while PATH waits for an external answer, future start date, applicant pause, or internal follow-up.',
        targetStatus: 'on_hold',
        actionLabel: 'Put on hold',
        noteHint: 'Add enough context so the next reviewer knows what PATH is waiting for.',
        requireNote: false,
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

    if (actionId === 'withdraw') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm(buildConfirm({
        title: 'Withdraw application',
        body: 'Withdrawing will move this application to Withdrawn. Use this when the applicant has withdrawn or is no longer pursuing the application.',
        targetStatus: 'withdrawn',
        actionLabel: 'Withdraw application',
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
        title: 'Escalate to NWAC Administrator',
        body: 'Forward this escalation to NWAC Administrators. Include the context and what you are requesting.',
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
  const confirmCurrentLabel = statusLabel || formatStatusLabel(canonicalStatus) || 'current status';
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

  const createHoldReviewReminder = async ({ caseId, applicationId, dueDate, reasonLabel, note }) => {
    const dueAt = toReminderIsoFromDateInput(dueDate);
    if (!dueAt || !caseId) return true;
    const assignedStaffProfileId = resolveAssignedStaffProfileId({
      assignedStaffProfileId: caseData?.assignedStaffProfileId,
      assigned_staff_profile_id: caseData?.assigned_staff_profile_id,
      assignedUserId: caseData?.assignedUserId,
      assigned_user_id: caseData?.assigned_user_id,
      assignedToUserId: caseData?.assignedToUserId,
      assigned_to_user_id: caseData?.assigned_to_user_id,
    });
    const response = await apiFetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId,
        applicationId: applicationId || application_id || null,
        title: 'Review parked application',
        description: [
          reasonLabel ? `Reason: ${reasonLabel}` : null,
          note ? `Context: ${note}` : null,
        ].filter(Boolean).join('\n') || null,
        category: 'Application hold review',
        status: 'open',
        dueAt,
        assignedStaffProfileId: assignedStaffProfileId || null,
        metadata: {
          source: 'application_on_hold_quick_action',
          reason: reasonLabel || null,
        },
      }),
    });
    if (!response.ok) {
      throw new Error('hold_review_reminder_save_failed');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('case-reminders-refresh', { detail: { caseId } }));
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
      applicationAwaitingReason = null,
      holdReviewDate = null,
      holdReasonLabel = '',
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
      const payload = {
        applicationStatus: mapWorkflowStatusToPersistenceStatus(nextStatus, {
          currentStatus: applicationStatusFromCase || application?.status || null,
          awaitingReason:
            caseData?.application_awaiting_reason ??
            caseData?.applicationAwaitingReason ??
            application?.application_awaiting_reason ??
            application?.awaiting_reason ??
            null,
          decisionOutcome:
            caseData?.decision_outcome ??
            caseData?.decisionOutcome ??
            application?.decision_outcome ??
            application?.decisionOutcome ??
            null,
        }) || nextStatus,
      };
      if (applicationAwaitingReason) {
        payload.applicationAwaitingReason = applicationAwaitingReason;
      }
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
        try { await refreshCasePayload(); } catch (_) {}
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
      let reminderSaved = true;
      if (nextStatus === 'on_hold' && holdReviewDate) {
        try {
          await createHoldReviewReminder({
            caseId: caseData.id,
            applicationId: application?.id || application_id || caseData?.application_id || null,
            dueDate: holdReviewDate,
            reasonLabel: holdReasonLabel,
            note,
          });
        } catch (_) {
          reminderSaved = false;
        }
      }

      await fetchLatestApplication();
      try {
        await refreshCasePayload();
      } catch (_) {
        // ignore refresh failures, local state already updated
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('case-events-refresh', { detail: { caseId: caseData.id } }));
      }
      await fetchEscalation().catch(() => {});
      if (!noteSaved || !reminderSaved) {
        setStatusFeedback({
          type: 'warning',
          content: !noteSaved
            ? `Application status updated to ${label}, but the note could not be saved. Please add the note manually.`
            : `Application status updated to ${label}, but the review reminder could not be saved. Please add the reminder manually.`,
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

  const runDocsRequestedUpdate = async (nextActive) => {
    if (!caseData?.id) {
      setStatusFeedback({ type: 'error', content: 'Case details are unavailable; cannot update document requests.' });
      return;
    }
    if (lockedByAnotherUser) {
      setStatusFeedback({ type: 'warning', content: lockAlertMessage || 'This case is currently locked by another user.' });
      return;
    }
    setDocsRequestSaving(true);
    let releaseAfter = false;
    try {
      if (!lockState.owned) {
        const lockResult = await acquireLock();
        if (!lockResult?.ok) {
          const message = buildLockConflictMessage(lockResult);
          setStatusFeedback({ type: 'warning', content: message });
          return;
        }
        releaseAfter = Boolean(lockResult.localOwner);
      } else if (lockHeldByCurrentUser) {
        releaseAfter = true;
        refreshLockHeartbeat().catch(() => {});
      }

      const expectedRowVersion = Number(rowVersion || caseData?.application_row_version || application?.row_version || 0);
      const payload = { docsRequested: nextActive };
      if (nextActive) {
        payload.docsRequestedSource = 'manual';
      }
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
        setStatusFeedback({ type: 'warning', content: message });
        if (releaseAfter) {
          releaseLock({ silent: true }).catch(() => {});
        }
        return;
      }

      if (response.status === 409) {
        const currentRowVersion = Number(body?.currentRowVersion ?? body?.application_row_version);
        if (currentRowVersion) {
          setRowVersion(prev => (currentRowVersion > prev ? currentRowVersion : prev));
          if (typeof onRowVersionUpdate === 'function') {
            onRowVersionUpdate(currentRowVersion);
          }
          setApplication(prev => (prev ? { ...prev, row_version: currentRowVersion } : prev));
        }
        await fetchLatestApplication();
        try { await refreshCasePayload(); } catch (_) {}
        setStatusFeedback({ type: 'warning', content: 'Another user updated this application first. The latest data has been reloaded.' });
        if (releaseAfter) {
          releaseLock({ silent: true }).catch(() => {});
        }
        return;
      }

      if (!response.ok) {
        const message = body?.error || 'Failed to update document request.';
        throw new Error(message);
      }

      if (typeof onCaseUpdate === 'function') {
        const nowIso = new Date().toISOString();
        onCaseUpdate({
          docs_requested_active: nextActive ? 1 : 0,
          docs_requested_at: nextActive ? nowIso : caseData?.docs_requested_at ?? null,
          docs_requested_cleared_at: nextActive ? null : nowIso,
          docs_requested_source: nextActive ? 'manual' : caseData?.docs_requested_source ?? null,
        });
      }
      await fetchLatestApplication();
      try { await refreshCasePayload(); } catch (_) {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('case-events-refresh', { detail: { caseId: caseData.id } }));
        window.dispatchEvent(new CustomEvent('case-reminders-refresh', { detail: { caseId: caseData.id } }));
      }
      setStatusFeedback({
        type: 'success',
        content: nextActive ? 'Document request timer started.' : 'Document request cleared.'
      });
    } catch (err) {
      setStatusFeedback({ type: 'error', content: err?.message || 'Failed to update document request.' });
    } finally {
      setDocsRequestSaving(false);
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
        const targetRole = roleKey === 'regional_manager' ? 'nwac_administrator' : 'regional_manager';
        endpoint = '/api/escalations';
        payload = {
          applicationId: application_id,
          caseId: caseData?.id || caseData?.case_id || null,
          reason: note,
          details: note,
          targetRole
        };
      } else {
        const targetRole = actionId === 'escalate_up' ? 'nwac_administrator' : escalation?.target_role || escalation?.targetRole || null;
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
      try { await refreshCasePayload(); } catch (_) {}
      if (isCreate) {
        const targetEmail = body?.target_email || null;
        const targetLabel = targetEmail || 'Regional Manager';
        setStatusFeedback({ type: 'success', content: `Application escalated to ${targetLabel}.` });
      } else if (actionId === 'escalate_up' || actionId === 'escalate') {
        const targetEmail = body?.target_email || null;
        const targetLabel = targetEmail || 'NWAC Administrator';
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
        ? 'Status changes in this widget are limited to System Administrators and NWAC Administrators.'
        : 'Status changes are not permitted right now.';
      setStatusFeedback({ type: 'info', content: message });
      return;
    }

    const canonicalNextStatus = getApplicationStatusContext(nextStatus).canonicalStatus;
    if (!isApplicationStatusTransitionAllowed({ role: canonicalRole || userRole, fromStatus: canonicalStatus, toStatus: canonicalNextStatus })) {
      setStatusFeedback({
        type: 'info',
        content: 'That status change is not available for your role.',
      });
      return;
    }

    if (
      requiresFinalApplicationStatusConfirmation({ role: canonicalRole || userRole, currentStatus: canonicalStatus }) &&
      canonicalNextStatus !== canonicalStatus
    ) {
      setConfirmStatusChange({ nextStatus, nextOption });
      return;
    }

    runStatusUpdate(nextStatus, nextOption);
  };

  const statusFormField = isAdminRole ? (
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
    <Badge color={statusBadgeColor}>{statusLabel}</Badge>
  );

  const overviewItems = [];

  const referenceNumber = payload?.submission_snapshot?.reference_number || caseData?.tracking_id;
  const preferredName = answers['preferred-name'];
  const contactEmail = caseData?.applicant_email || answers['contact-email-address'] || answers.email;
  const phoneNumber = caseData?.applicant_phone || answers['telephone-day'] || answers['telephone-alt'];
  const assignedStaffProfileId =
    resolveAssignedStaffProfileId(caseData) ||
    resolveAssignedStaffProfileId(application) ||
    null;
  const assignedDisplayName = typeof caseData?.assigned_user_display_name === 'string'
    ? caseData.assigned_user_display_name.trim()
    : '';
  const assignedEmail = caseData?.assigned_user_email;
  const isCaseManagerCurrentUser = Boolean(
    (assignedStaffProfileId != null && currentStaffProfileId && String(assignedStaffProfileId) === String(currentStaffProfileId)) ||
    (
      typeof assignedEmail === 'string' &&
      assignedEmail.trim() &&
      typeof currentUserEmail === 'string' &&
      currentUserEmail.trim() &&
      assignedEmail.trim().toLowerCase() === currentUserEmail.trim().toLowerCase()
    )
  );
  const assignedStaffDisplay = isCaseManagerCurrentUser
    ? (currentUserName || 'You')
    : (assignedDisplayName || assignedEmail || null);
  const assignedStaffValue = assignedStaffDisplay
    ? assignedStaffDisplay
    : null;

  let slaValue = null;
  if (application) {
    const assigned = Boolean(assignedStaffProfileId);
    const statusInfo = getStatusInfo({
      application_status: application?.status || fallbackStatus,
      application_lifecycle_status:
        application?.application_lifecycle_status ??
        application?.applicationLifecycleStatus ??
        application?.lifecycle_status ??
        caseData?.application_lifecycle_status ??
        caseData?.applicationLifecycleStatus ??
        null,
      decision_outcome:
        application?.decision_outcome ??
        application?.decisionOutcome ??
        caseData?.decision_outcome ??
        caseData?.decisionOutcome ??
        null,
      application_awaiting_reason:
        application?.application_awaiting_reason ??
        application?.applicationAwaitingReason ??
        application?.awaiting_reason ??
        caseData?.application_awaiting_reason ??
        caseData?.applicationAwaitingReason ??
        null,
      application_closure_reason:
        application?.application_closure_reason ??
        application?.applicationClosureReason ??
        application?.closure_reason ??
        caseData?.application_closure_reason ??
        caseData?.applicationClosureReason ??
        null,
      case_status: caseData?.status || null,
      case_id: caseData?.id ?? application?.case_id ?? null,
      assigned_user_id: assignedStaffProfileId,
      assessment_esdc_eligibility:
        application?.assessment_esdc_eligibility ??
        caseData?.assessment_esdc_eligibility ??
        null,
    });
    const slaMeta = computeSlaMeta(application, caseData, slaTargets, statusInfo.rawStatus, assigned);
    slaValue = <Badge color={slaMeta.color}>{slaMeta.label}</Badge>;
  }

  let checklistValue = null;
  if (applicantUserId) {
    checklistValue = 'Unavailable';
    if (checklistLoading) {
      checklistValue = 'Loading...';
    } else if (Number.isFinite(checklistMissingCount)) {
      const badge = checklistMissingCount > 0
        ? <Badge color="severity-high">{`${checklistMissingCount} missing`}</Badge>
        : <Badge color="green">Complete</Badge>;
      checklistValue = checklistGateLabel
        ? (
          <SpaceBetween size="xxs">
            {badge}
            <Box color="text-body-secondary" fontSize="body-s">{checklistGateLabel}</Box>
          </SpaceBetween>
        )
        : badge;
    }
  }

  const docsRequestedBadgeLabel = docsRequestedActive ? docsRequestedLabel : 'Not requested';
  const docsRequestedBadgeColor = docsRequestedActive ? (docsRequestedColor || 'grey') : 'grey';
  const docsRequestedContent = (
    <SpaceBetween size="xxs">
      <Badge color={docsRequestedBadgeColor}>{docsRequestedBadgeLabel}</Badge>
      <Toggle
        checked={docsRequestedActive}
        onChange={handleDocsRequestedToggle}
        disabled={docsRequestToggleDisabled}
      >
        Documents requested
      </Toggle>
    </SpaceBetween>
  );

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
  if (preferredName) overviewItems.push({ label: 'Preferred Name', value: preferredName });
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
  if (phoneNumber) overviewItems.push({ label: 'Phone', value: phoneNumber });
  if (provinceLabel) overviewItems.push({ label: 'Province / Territory', value: provinceLabel });
  if (application?.created_at) overviewItems.push({ label: 'Received At', value: formatDateTime(application.created_at) });
  if (application?.updated_at) overviewItems.push({ label: 'Last Updated', value: formatDateTime(application.updated_at) });
  overviewItems.push({ label: 'Application Status', value: statusFormField });
  if (slaValue) overviewItems.push({ label: 'Timeline status', value: slaValue });
  if (assignedStaffValue) overviewItems.push({ label: 'Case Manager', value: assignedStaffValue });
  if (checklistValue !== null) overviewItems.push({ label: 'Document Checklist', value: checklistValue });
  overviewItems.push({ label: 'Docs Requested', value: docsRequestedContent });
  if (isReportingOnlyApplication) {
    overviewItems.push({
      label: 'ESDC Reporting',
      value: <StatusIndicator type={ilmpStatusType}>{ilmpStatusLabel}</StatusIndicator>
    });
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
    <ColumnLayout columns={7} minColumnWidth={160} variant="text-grid" borders="vertical">
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
              <Hotspot hotspotId="app-workspace-quick-actions" direction="left">
                <SpaceBetween direction="horizontal" size="xs">
                  <ButtonDropdown
                    items={quickLayoutItems}
                    onItemClick={handleQuickLayoutSelect}
                    ariaLabel="Quick layouts"
                    expandToViewport
                    disabled={savingStatus}
                  >
                    Quick layouts
                  </ButtonDropdown>
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
              </Hotspot>
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
          <Hotspot hotspotId="app-workspace-application-overview" direction="right" />
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
        {watchlistHitSummary ? (
          <Alert
            type="warning"
            header="Applicant watchlist hit"
            action={<Button onClick={() => setWatchlistHitDetailsOpen(true)}>View details</Button>}
          >
            <Box>
              This applicant&apos;s Social Insurance Number matches an entry on the NWAC watchlist. View details for
              instructions on how to proceed and contact your manager before continuing assessment or approval work.
            </Box>
          </Alert>
        ) : null}
        {isReportingOnlyApplication && (
          <Alert type={ilmpStatus === 'blocked' ? 'error' : ilmpStatus === 'warning' ? 'warning' : ilmpStatus === 'clean' ? 'success' : 'info'}>
            <SpaceBetween size="xs">
              <Box>
                This {reportingApplicationLabel} is retained for ILMP reporting. Fix missing reporting data in the Application Form widget; corrections revalidate automatically and blocked records stay out of normal casework queues.
              </Box>
              {ilmpMessages.length > 0 && (
                <Box as="ul" padding={{ left: 'm' }}>
                  {ilmpMessages.map(message => (
                    <li key={message}>{message}</li>
                  ))}
                </Box>
              )}
              {ilmpParticipantWorkspacePath ? (
                <Box>
                  <Link href={ilmpParticipantWorkspacePath}>Open ESDC participant workspace</Link>
                </Box>
              ) : null}
            </SpaceBetween>
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
        <Modal
          visible={watchlistModalOpen}
          onDismiss={() => {
            if (watchlistSaving) return;
            setWatchlistModalOpen(false);
            setWatchlistNotes('');
            setWatchlistError(null);
          }}
          header="Add applicant to watchlist"
          closeAriaLabel="Close watchlist modal"
          footer={
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => {
                  if (watchlistSaving) return;
                  setWatchlistModalOpen(false);
                  setWatchlistNotes('');
                  setWatchlistError(null);
                }}
                disabled={watchlistSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={watchlistSaving}
                disabled={watchlistSaving || !watchlistReady}
                onClick={handleWatchlistSubmit}
              >
                Add to watchlist
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="s">
            <Box>{watchlistExplanation}</Box>
            {watchlistError ? <Alert type="error">{watchlistError}</Alert> : null}
            {!watchlistReady ? (
              <Alert type="warning">
                Name, date of birth, and SIN are required before adding an applicant to the watchlist.
              </Alert>
            ) : null}
            <FormField label="Applicant name">
              <Input value={watchlistDisplayName} readOnly />
            </FormField>
            <FormField label="Date of birth">
              <Input value={watchlistDisplayDob} readOnly />
            </FormField>
            <FormField label="Social Insurance Number">
              <Input value={watchlistDisplaySin} readOnly />
            </FormField>
            <FormField
              label="Notes"
              description="Shown in watchlist details when staff review a future watchlist hit."
            >
              <Textarea
                value={watchlistNotes}
                onChange={({ detail }) => setWatchlistNotes(detail.value)}
                placeholder="Explain why this applicant is watchlisted and what staff should do when a future watchlist hit is reviewed"
                rows={4}
                spellcheck={true}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
        <ApplicantWatchlistHitDetailsModal
          visible={watchlistHitDetailsOpen}
          onDismiss={() => setWatchlistHitDetailsOpen(false)}
          loading={watchlistHitLoading}
          error={watchlistHitError}
          details={watchlistHitDetails}
        />
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
            onDismiss={resetQuickActionState}
            closeAriaLabel="Close quick action confirmation"
            header={quickActionConfirm?.title || 'Confirm action'}
            footer={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  onClick={resetQuickActionState}
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
                      resetQuickActionState();
                      runEscalationAction(actionId, { note });
                      return;
                    }
                    if (!quickActionConfirm?.targetStatus) {
                      resetQuickActionState();
                      return;
                    }
                    const targetOption = quickActionConfirm?.targetOption;
                    const isHoldAction = quickActionConfirm?.targetStatus === 'on_hold';
                    const holdReason = isHoldAction ? quickActionHoldReason?.value : null;
                    const holdReasonLabel = holdReason ? getApplicationAwaitingReasonLabel(holdReason) : '';
                    const reviewDate = isHoldAction ? quickActionReviewDate : null;
                    const holdContext = [
                      holdReasonLabel ? `Reason: ${holdReasonLabel}` : null,
                      reviewDate ? `Review date: ${reviewDate}` : null,
                      quickActionNote?.trim() ? quickActionNote.trim() : null,
                    ].filter(Boolean).join('\n');
                    const note = isHoldAction ? holdContext : quickActionNote;
                    const actionLabel = quickActionConfirm?.actionLabel;
                    const resolveEscalation = Boolean(quickActionConfirm?.resolveEscalation);
                    const blockOnEscalation = Boolean(quickActionConfirm?.blockOnEscalation);
                    resetQuickActionState();
                    runStatusUpdate(quickActionConfirm.targetStatus, targetOption, {
                      note,
                      actionLabel,
                      resolveEscalation,
                      blockOnEscalation,
                      applicationAwaitingReason: holdReason,
                      holdReviewDate: reviewDate,
                      holdReasonLabel,
                    });
                  }}
                  loading={savingStatus}
                  disabled={
                    savingStatus ||
                    (quickActionConfirm?.confirmWord &&
                      quickActionConfirmInput.trim().toLowerCase() !== quickActionConfirm.confirmWord) ||
                    (quickActionConfirm?.requireNote && !quickActionNote.trim()) ||
                    (quickActionConfirm?.targetStatus === 'on_hold' && (!quickActionHoldReason?.value || !quickActionReviewDate))
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
              {quickActionConfirm?.targetStatus === 'on_hold' ? (
                <>
                  <FormField
                    label="Hold reason"
                    description="Used for the On Hold queue and status detail."
                  >
                    <Select
                      selectedOption={quickActionHoldReason}
                      options={HOLD_REASON_OPTIONS}
                      onChange={({ detail }) => setQuickActionHoldReason(detail.selectedOption)}
                      placeholder="Select a reason"
                      expandToViewport
                    />
                  </FormField>
                  <FormField
                    label="Review date"
                    description="Creates a case reminder so the file is revisited."
                  >
                    <DatePicker
                      value={quickActionReviewDate}
                      onChange={({ detail }) => setQuickActionReviewDate(detail.value)}
                      placeholder="YYYY-MM-DD"
                    />
                  </FormField>
                </>
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
                    spellcheck={true}
                  />
                </FormField>
              ) : quickActionConfirm?.targetStatus === 'on_hold' ? (
                <FormField
                  label="Notes"
                  description={quickActionConfirm?.noteHint || 'Provide context for this action.'}
                >
                  <Textarea
                    value={quickActionNote}
                    onChange={e => setQuickActionNote(e.detail.value || '')}
                    rows={3}
                    spellcheck={true}
                  />
                </FormField>
              ) : null}
              {quickActionConfirm?.confirmWord ? (
                <FormField label={`Type "${quickActionConfirm.confirmWord}" to confirm`}>
                  <Input
                    value={quickActionConfirmInput}
                    onChange={e => setQuickActionConfirmInput(e.detail.value || '')}
                    placeholder={quickActionConfirm.confirmWord}
                    spellcheck={false}
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

