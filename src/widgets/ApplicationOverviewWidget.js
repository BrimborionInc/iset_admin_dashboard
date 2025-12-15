import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BoardItem } from '@cloudscape-design/board-components';

import {
  Header,
  Box,
  KeyValuePairs,
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
  Textarea
} from '@cloudscape-design/components';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import { apiFetch } from '../auth/apiClient';
import ApplicationOverviewHelp from '../helpPanelContents/applicationOverviewHelp';
import useCurrentUser from '../hooks/useCurrentUser';
import useApplicationLock, { buildLockConflictMessage } from '../hooks/useApplicationLock';
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

function normalizeClosedStatus(status) {
  const key = (status || '').toString().trim().toLowerCase();
  return key === 'withdrawn' ? 'closed' : key;
}

function statusColor(status = '') {
  const normalized = normalizeClosedStatus(status);
  if (['approved', 'completed'].includes(normalized)) return 'green';
  if (['submitted', 'in review', 'in_review', 'in progress', 'pending', 'assigned', 'pending_approval'].includes(normalized)) return 'blue';
  if (['docs requested', 'docs_requested', 'action required', 'action required (docs requested)'].includes(normalized)) return 'severity-high';
  if (['rejected', 'declined', 'errored'].includes(normalized)) return 'red';
  if (['closed', 'inactive', 'archived'].includes(normalized)) return 'grey';
  return 'grey';
}

const COMPLETED_STATUSES = new Set(['approved', 'completed', 'rejected', 'declined', 'cancelled', 'closed', 'archived']);
const DECISION_STATUSES = new Set(['pending_approval']);
const ASSESSMENT_STATUSES = new Set([
  'in_review', 'in review',
  'docs_requested', 'docs requested',
  'action_required', 'action required', 'action required (docs requested)',
  'pending info', 'pending information', 'info requested', 'information requested',
  'on hold', 'on_hold'
]);

const FINAL_APPLICATION_STATUSES = new Set(['approved', 'completed', 'rejected', 'declined', 'cancelled', 'closed', 'archived']);

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
    if (['docs_requested', 'action_required'].includes(rawStatus)) return 'warning';
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

const isNonTerminalApplicationStatus = (status) => {
  if (!status) return true;
  const key = status.toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
  return !FINAL_APPLICATION_STATUSES.has(key);
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
  if (diffDays < -4) return { label: `${stageLabel} ${Math.abs(diffDays)} days overdue`, color: 'severity-critical' };
  if (diffDays < 0) return { label: `${stageLabel} ${Math.abs(diffDays)} days overdue`, color: 'severity-high' };
  if (diffDays === 0) return { label: `${stageLabel} due today`, color: 'severity-medium' };
  if (diffDays <= 3) return { label: `${stageLabel} due in ${diffDays} days`, color: 'severity-low' };
  return { label: `${stageLabel} due in ${diffDays} days`, color: 'green' };
};

const APPLICATION_STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Action Required', value: 'docs_requested' },
  { label: 'Pending Approval', value: 'pending_approval' },
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
  const [rowVersion, setRowVersion] = useState(() => {
    const fromProp = Number(applicationRowVersion || 0);
    const fromCase = Number(caseData?.application_row_version || 0);
    const fromApp = Number(application?.row_version || 0);
    return Math.max(fromProp || 0, fromCase || 0, fromApp || 0, 0);
  });
  const {
    userId: currentUserId,
    displayName: currentUserName,
    role: currentUserRole
  } = useCurrentUser();
  const userRole = currentUserRole || '';
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
    if (application?.lock_owner_id || application?.lock_owner_name || application?.lock_owner_email) {
      return {
        applicationId: application_id || null,
        ownerUserId: application?.lock_owner_id ? String(application.lock_owner_id) : null,
        ownerDisplayName: application?.lock_owner_name || null,
        ownerEmail: application?.lock_owner_email || null,
        expiresAt: application?.lock_expires_at || null,
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
    application_id,
    lockState.lock,
    lockState.owned
  ]);
  const lockOwnerId = activeLock?.ownerUserId ? String(activeLock.ownerUserId) : null;
  const lockHeldByCurrentUser = Boolean(isLockedByMe || (currentUserId && lockOwnerId && String(currentUserId) === lockOwnerId));
  const lockedByAnotherUser = Boolean(lockOwnerId && !lockHeldByCurrentUser);
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

  const fallbackStatusRaw = statusValue || applicationStatusFromCase || application?.status || '';
  const fallbackStatus = normalizeClosedStatus(fallbackStatusRaw);
  const statusContext = getCaseStatusContext(fallbackStatus);
  const roleAccess = getRoleGroups(userRole);
  const { canonicalStatus, isFinalStatus } = statusContext;
  const { isSystemAdministratorRole, isAdminRole } = roleAccess;
  const rawRoleKey = canonicalizeRole(userRole);
  const roleKey = normalizeEscalationRole(rawRoleKey);
  const canEditStatus = isSystemAdministratorRole && canEditCaseStatus({
    role: userRole,
    status: fallbackStatus,
    hasCase: Boolean(caseData?.id),
  });

  const statusOption = APPLICATION_STATUS_OPTIONS.find(option => option.value === fallbackStatus);
  const statusLabel = statusOption?.label || formatStatusLabel(fallbackStatus);
  const selectedStatusOption = statusOption || (fallbackStatus ? { label: statusLabel, value: fallbackStatus } : null);
  const badgeLabel = statusLabel;
  const badgeColor = statusColor(statusOption?.value || fallbackStatus || 'unknown');
  const statusSelectDisabled = !canEditStatus || savingStatus || lockedByAnotherUser;
  const canRunQuickActions = !lockedByAnotherUser;
  const nonTerminalStatus = isNonTerminalApplicationStatus(fallbackStatus);
  const hasOpenEscalation = escalation && escalation.state && escalation.state !== 'resolved';
  const escalationOwnerRole = normalizeEscalationRole(canonicalizeRole(escalation?.current_owner_role || escalation?.currentOwnerRole));
  const isEscalationOwner = hasOpenEscalation && (isSystemAdministratorRole || (roleKey && roleKey === escalationOwnerRole));
  const escalationBadgeLabel = hasOpenEscalation
    ? `Escalated to ${formatRoleLabel(escalationOwnerRole || escalation?.target_role || escalation?.targetRole || '')}`
    : null;

  const statusKey = (fallbackStatus || '').toLowerCase();
  const normalizedStatusKey = (fallbackStatus || '').toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
  const quickActionItems = [];
  const canRunStatusQuickActions = isSystemAdministratorRole;

  if (canRunStatusQuickActions) {
    if (statusKey === 'in_review' || normalizedStatusKey === 'in_review' || normalizedStatusKey === 'pending_approval') {
      quickActionItems.push({
        id: 'suspend',
        text: 'Suspend Application',
        description: 'Move to Action Required when you need more information from the applicant.'
      });
    }
    if (statusKey === 'docs_requested' || normalizedStatusKey === 'docs_requested') {
      quickActionItems.push({
        id: 'resume',
        text: 'Resume Application',
        description: 'Return to In Review after applicant provides requested information.'
      });
    }
    if (
      ['submitted', 'in_review', 'docs_requested', 'pending_approval'].includes(statusKey) ||
      ['submitted', 'in_review', 'docs_requested', 'pending_approval'].includes(normalizedStatusKey)
    ) {
      quickActionItems.push({
        id: 'close',
        text: 'Close Application',
        description: 'Mark the application as closed.'
      });
    }
  }

  const escalationTargetRoleLabel = roleKey === 'regional_manager' ? 'Program Administrator' : 'Regional Manager';
  const canCreateEscalation =
    nonTerminalStatus &&
    !hasOpenEscalation &&
    (roleKey === 'coordinator' || roleKey === 'regional_manager' || isSystemAdministratorRole);
  const canRespondEscalation = hasOpenEscalation && isEscalationOwner;

  if (canCreateEscalation) {
    quickActionItems.push({
      id: 'escalate',
      text: `Escalate to ${escalationTargetRoleLabel}`,
      description: `Send this application to the ${escalationTargetRoleLabel} for review.`,
      type: 'escalation'
    });
  }
  if (canRespondEscalation) {
    quickActionItems.push({
      id: 'respond_escalation',
      text: 'Respond to escalation',
      description: 'Add guidance or next steps and return it to the requester.',
      type: 'escalation'
    });
    if (roleKey === 'regional_manager') {
      quickActionItems.push({
        id: 'escalate_up',
        text: 'Escalate to Program Administrator',
        description: 'Forward this escalation to Program Administrators.',
        type: 'escalation'
      });
    }
    quickActionItems.push({
      id: 'resolve_escalation',
      text: 'Resolve escalation',
      description: 'Close the escalation after addressing the issue.',
      type: 'escalation'
    });
  }

  const handleConfirmDismiss = () => setConfirmStatusChange(null);
  const [quickActionConfirm, setQuickActionConfirm] = useState(null);
  const [quickActionConfirmInput, setQuickActionConfirmInput] = useState('');

  const selectOptionByValue = value =>
    APPLICATION_STATUS_OPTIONS.find(option => option.value === value) ||
    { value, label: formatStatusLabel(value) };

  const handleQuickActionSelect = ({ detail }) => {
    const actionId = detail?.id;
    if (!actionId || !canRunQuickActions) return;
    if (lockedByAnotherUser) {
      setStatusFeedback({
        type: 'warning',
        content: lockAlertMessage || 'This case is currently locked by another user.'
      });
      return;
    }

    const buildConfirm = (title, body, targetStatus) => ({
      type: 'status',
      title,
      body,
      targetStatus,
      targetOption: selectOptionByValue(targetStatus),
    });

    if (actionId === 'suspend') {
      setQuickActionConfirmInput('');
      setQuickActionConfirm(buildConfirm(
        'Suspend application',
        'Suspending will set the application to Action Required so the applicant can provide additional information or documents.',
        'docs_requested'
      ));
      return;
    }

    if (actionId === 'resume') {
      setQuickActionConfirmInput('');
      setQuickActionConfirm(buildConfirm(
        'Resume application',
        'Resuming returns the application to In Review so you can continue the evaluation after receiving the requested information.',
        'in_review'
      ));
      return;
    }

    if (actionId === 'close') {
      setQuickActionConfirmInput('');
      setQuickActionConfirm({
        ...buildConfirm(
          'Close application',
          'Closing will move this application to Closed. Once closed it cannot be processed further. Use this when the applicant requests closure or is no longer pursuing the application.',
          'closed'
        ),
        confirmWord: 'close',
      });
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

    if (actionId === 'respond_escalation') {
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

    if (actionId === 'resolve_escalation') {
      setQuickActionConfirmInput('');
      setQuickActionNote('');
      setQuickActionConfirm({
        type: 'escalation',
        actionId: 'resolve',
        title: 'Resolve escalation',
        body: 'Resolving will close the escalation. Add a brief note describing the resolution.',
        requireNote: true,
        confirmWord: 'resolve'
      });
      return;
    }

    if (actionId === 'escalate_up') {
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

  const runStatusUpdate = async (nextStatus, nextOption) => {
    if (!caseData?.id) {
      setStatusFeedback({ type: 'error', content: 'Case details are unavailable; cannot update status.' });
      return;
    }
    const previousStatus = statusValue;
    const label = nextOption?.label || formatStatusLabel(nextStatus);
    setStatusFeedback(null);
    manualStatusRef.current = { pending: nextStatus, previous: previousStatus || '' };
    setStatusValue(nextStatus);
    setSavingStatus(true);
    let releaseAfter = false;
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

      const expectedRowVersion = Number(rowVersion || caseData?.application_row_version || application?.row_version || 0);
      const payload = { status: nextStatus, applicationStatus: nextStatus };
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

      await fetchLatestApplication();
      if (typeof actions?.refreshCaseData === 'function') {
        try {
          await actions.refreshCaseData();
        } catch (_) {
          // ignore refresh failures, local state already updated
        }
      }
      setStatusFeedback({ type: 'success', content: `Application status updated to ${label}.` });
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
    if (!isStatusTransitionAllowed({ role: userRole, fromStatus: canonicalStatus, toStatus: canonicalNextStatus })) {
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

  const assignedName = caseData?.assigned_user_name || application?.assigned_evaluator?.name;
  const assignedEmail = caseData?.assigned_user_email || application?.assigned_evaluator?.email;
  if (assignedName || assignedEmail) {
    const display = assignedName && assignedEmail ? `${assignedName} (${assignedEmail})` : (assignedName || assignedEmail);
    overviewItems.push({ label: 'Assigned Evaluator', value: display });
  }

  if (caseData?.assigned_user_ptma_name) {
    overviewItems.push({ label: 'Assigned PTMA', value: caseData.assigned_user_ptma_name });
  }

  // Removed separate caseStatusSection; status selector now inline in overviewItems

  const overviewContent = loading ? (
    <Box textAlign="center" padding="m">
      <Spinner />
    </Box>
  ) : error ? (
    <Box color="text-status-critical">{error}</Box>
  ) : overviewItems.length ? (
  <KeyValuePairs columns={5} items={overviewItems} />
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
                    disabled={!canRunQuickActions || savingStatus || quickActionItems.length === 0}
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
                    setQuickActionConfirm(null);
                    setQuickActionConfirmInput('');
                    setQuickActionNote('');
                    runStatusUpdate(quickActionConfirm.targetStatus, targetOption);
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
                <FormField label="Notes" description="Provide context for this action.">
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

