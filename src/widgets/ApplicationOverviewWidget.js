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
  Link
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';
import ApplicationOverviewHelp from '../helpPanelContents/applicationOverviewHelp';
import useCurrentUser from '../hooks/useCurrentUser';
import useApplicationLock, { buildLockConflictMessage } from '../hooks/useApplicationLock';

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

function statusColor(status = '') {
  const normalized = (status || '').toLowerCase();
  if (['approved', 'completed'].includes(normalized)) return 'green';
  if (['submitted', 'in review', 'in_review', 'in progress', 'pending', 'assigned', 'pending_approval'].includes(normalized)) return 'blue';
  if (['docs requested', 'docs_requested', 'action required', 'action required (docs requested)'].includes(normalized)) return 'orange';
  if (['rejected', 'declined', 'errored'].includes(normalized)) return 'red';
  if (['withdrawn', 'closed', 'inactive', 'archived'].includes(normalized)) return 'grey';
  return 'grey';
}

const STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Action Required', value: 'docs_requested' },
  { label: 'Assessed, Pending Approval', value: 'pending_approval' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Withdrawn', value: 'withdrawn' },
  { label: 'Archived', value: 'archived' },
];

const ADMIN_ROLES = new Set(['program administrator', 'system administrator']);
const REGIONAL_COORDINATOR_ROLES = new Set(['regional coordinator']);
const APPLICATION_ASSESSOR_ROLES = new Set(['application assessor']);
const FINAL_CASE_STATUSES = new Set(['approved', 'rejected', 'withdrawn', 'archived']);

const canonicalizeStatus = (status) => (status || '')
  .toString()
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, '_');

const ApplicationOverviewWidget = ({ actions, application_id, caseData, toggleHelpPanel }) => {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(Boolean(application_id));
  const [error, setError] = useState(null);
  const [statusValue, setStatusValue] = useState(caseData?.status || '');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);
  const manualStatusRef = useRef(null);
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
      return data;
    } catch (_) {
      return null;
    }
  }, [application_id]);


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

  useEffect(() => {
    if (savingStatus) return;
    const nextStatus = caseData?.status || application?.status || '';
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
  }, [caseData?.status, application?.status, savingStatus, statusValue]);

  const { answers, payload } = useMemo(() => {
    if (!application) return { answers: {}, payload: {} };
    const payload = application.__payload || {};
    const rawAnswers = payload.answers || payload.intake_answers || payload;
    return {
      payload,
      answers: rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {},
    };
  }, [application]);

  const fallbackStatus = statusValue || caseData?.status || application?.status || '';
  const canonicalStatus = canonicalizeStatus(fallbackStatus);
  const normalizedRole = (userRole || '').trim().toLowerCase();
  const isAdminRole = ADMIN_ROLES.has(normalizedRole);
  const isRegionalCoordinator = REGIONAL_COORDINATOR_ROLES.has(normalizedRole);
  const isApplicationAssessor = APPLICATION_ASSESSOR_ROLES.has(normalizedRole);
  const isFinalStatus = FINAL_CASE_STATUSES.has(canonicalStatus);
  const isPendingApprovalStatus = canonicalStatus === 'pending_approval';

  let canEditStatus = Boolean(caseData?.id);
  if (canEditStatus) {
    if (isAdminRole) {
      canEditStatus = true;
    } else if (isApplicationAssessor) {
      canEditStatus = !(isFinalStatus || isPendingApprovalStatus);
    } else if (isRegionalCoordinator) {
      canEditStatus = !isFinalStatus;
    } else {
      canEditStatus = !isFinalStatus;
    }
  }

  const statusOption = STATUS_OPTIONS.find(option => option.value === statusValue);
  const selectedStatusOption = statusOption || (fallbackStatus ? { label: fallbackStatus, value: fallbackStatus } : null);
  const badgeLabel = statusOption?.label || (fallbackStatus ? fallbackStatus : 'Unknown');
  const badgeColor = statusColor(statusOption?.value || fallbackStatus || 'unknown');
  const statusSelectDisabled = !canEditStatus || savingStatus || lockedByAnotherUser;

  const handleConfirmDismiss = () => setConfirmStatusChange(null);

  const handleConfirmProceed = async () => {
    if (!confirmStatusChange) return;
    const { nextStatus, nextOption } = confirmStatusChange;
    setConfirmStatusChange(null);
    await runStatusUpdate(nextStatus, nextOption);
  };

  const confirmModalVisible = Boolean(confirmStatusChange);
  const confirmTargetLabel = confirmStatusChange?.nextOption?.label || confirmStatusChange?.nextStatus;
  const confirmCurrentLabel = badgeLabel || (fallbackStatus ? fallbackStatus : canonicalStatus || 'current status');

  const runStatusUpdate = async (nextStatus, nextOption) => {
    if (!caseData?.id) {
      setStatusFeedback({ type: 'error', content: 'Case details are unavailable; cannot update status.' });
      return;
    }
    const previousStatus = statusValue;
    const label = nextOption?.label || nextStatus;
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

      const expectedRowVersion = Number(application?.row_version || 0);
      const payload = { status: nextStatus };
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
      setStatusFeedback({ type: 'success', content: `Case status updated to ${label}.` });
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

    const canonicalNextStatus = canonicalizeStatus(nextStatus);

    if (isAdminRole && isFinalStatus && canonicalNextStatus !== canonicalStatus) {
      setConfirmStatusChange({ nextStatus, nextOption });
      return;
    }

    if (statusSelectDisabled) {
      setStatusFeedback({ type: 'info', content: 'Status changes are not permitted for your role on this case.' });
      return;
    }

    runStatusUpdate(nextStatus, nextOption);
  };

  const statusFormField = (
    <FormField stretch={true} label="" description="">
      <Select
        selectedOption={selectedStatusOption}
        options={STATUS_OPTIONS}
        onChange={handleStatusChange}
        placeholder={canEditStatus ? 'Select status' : 'Status unavailable'}
        disabled={statusSelectDisabled}
        statusType={savingStatus ? 'loading' : undefined}
        loadingText="Updating status"
        empty="No status options available"
        expandToViewport
        ariaLabel="Case status"
      />
    </FormField>
  );

  const overviewItems = [];

  const referenceNumber = payload?.submission_snapshot?.reference_number || caseData?.tracking_id;
  if (referenceNumber) {
    overviewItems.push({ label: 'Reference #', value: referenceNumber });
  }

  overviewItems.push({ label: 'Case Status', value: statusFormField });

  const preferredName = answers['preferred-name'];
  if (preferredName) overviewItems.push({ label: 'Preferred Name', value: preferredName });

  const applicantName = caseData?.applicant_name || [answers['first-name'], answers['middle-names'], answers['last-name']].filter(Boolean).join(' ');
  if (applicantName) overviewItems.push({ label: 'Applicant', value: applicantName });

  const contactEmail = caseData?.applicant_email || answers['contact-email-address'] || answers.email;
  if (contactEmail) overviewItems.push({ label: 'Email', value: contactEmail });

  const phoneNumber = caseData?.applicant_phone || answers['telephone-day'] || answers['telephone-alt'];
  if (phoneNumber) overviewItems.push({ label: 'Phone', value: phoneNumber });

  if (caseData?.stage) overviewItems.push({ label: 'Case Stage', value: caseData.stage });
  if (caseData?.priority) overviewItems.push({ label: 'Priority', value: caseData.priority });

  if (application?.created_at) overviewItems.push({ label: 'Received At', value: formatDateTime(application.created_at) });
  if (application?.updated_at) overviewItems.push({ label: 'Last Updated', value: formatDateTime(application.updated_at) });

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

  return (
    <BoardItem
      header={
        <Header
          actions={badgeLabel ? <Badge color={badgeColor}>{badgeLabel}</Badge> : null}
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
          Application Overview
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
        {lockAlertMessage && (
          <Alert type={lockedByAnotherUser ? 'warning' : 'info'}>
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
      </SpaceBetween>
    </BoardItem>
  );
};

export default ApplicationOverviewWidget;

