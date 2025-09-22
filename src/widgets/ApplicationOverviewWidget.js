import React, { useEffect, useMemo, useState } from 'react';

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
  SpaceBetween
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';

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
  if (['submitted', 'in review', 'in_review', 'in progress', 'pending', 'assigned'].includes(normalized)) return 'blue';
  if (['docs requested', 'docs_requested', 'action required', 'action required (docs requested)'].includes(normalized)) return 'orange';
  if (['rejected', 'declined', 'errored'].includes(normalized)) return 'red';
  if (['withdrawn', 'closed', 'inactive'].includes(normalized)) return 'grey';
  return 'grey';
}

const STATUS_OPTIONS = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'In review', value: 'in_review' },
  { label: 'Action required (docs requested)', value: 'docs_requested' },
  { label: 'Approved', value: 'approved' },
  { label: 'Completed', value: 'completed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Withdrawn', value: 'withdrawn' },
];

const ApplicationOverviewWidget = ({ actions, application_id, caseData }) => {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(Boolean(application_id));
  const [error, setError] = useState(null);
  const [statusValue, setStatusValue] = useState(caseData?.status || '');
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);

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
    setStatusValue(nextStatus || '');
  }, [caseData?.status, application?.status, savingStatus]);

  const { answers, payload } = useMemo(() => {
    if (!application) return { answers: {}, payload: {} };
    const payload = application.__payload || {};
    const rawAnswers = payload.answers || payload.intake_answers || payload;
    return {
      payload,
      answers: rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {},
    };
  }, [application]);

  const canEditStatus = Boolean(caseData?.id);
  const fallbackStatus = statusValue || application?.status || caseData?.status || '';
  const statusOption = STATUS_OPTIONS.find(option => option.value === statusValue);
  const selectedStatusOption = statusOption || (fallbackStatus ? { label: fallbackStatus, value: fallbackStatus } : null);
  const badgeLabel = statusOption?.label || (fallbackStatus ? fallbackStatus : 'Unknown');
  const badgeColor = statusColor(statusOption?.value || fallbackStatus || 'unknown');

  const handleStatusChange = async ({ detail }) => {
    const nextStatus = detail.selectedOption?.value;
    if (!nextStatus || nextStatus === statusValue) return;
    if (!caseData?.id) {
      setStatusFeedback({ type: 'error', content: 'Case details are unavailable; cannot update status.' });
      return;
    }
    const previousStatus = statusValue;
    const nextOption = STATUS_OPTIONS.find(option => option.value === nextStatus);
    setStatusFeedback(null);
    setStatusValue(nextStatus);
    setSavingStatus(true);
    try {
      const res = await apiFetch(`/api/cases/${caseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        let message = 'Failed to update status.';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch (_) {
          // ignore body parse issues
        }
        throw new Error(message);
      }
      if (typeof actions?.refreshCaseData === 'function') {
        try {
          await actions.refreshCaseData();
        } catch (_) {
          // ignore refresh failures, local state already updated
        }
      }
      const label = nextOption?.label || nextStatus;
      setStatusFeedback({ type: 'success', content: `Case status updated to ${label}.` });
    } catch (err) {
      setStatusValue(previousStatus);
      setStatusFeedback({ type: 'error', content: err?.message || 'Failed to update status.' });
    } finally {
      setSavingStatus(false);
    }
  };

  const overviewItems = useMemo(() => {
    const items = [];

    const referenceNumber = payload?.submission_snapshot?.reference_number || caseData?.tracking_id;
    if (referenceNumber) {
      items.push({ label: 'Reference #', value: referenceNumber });
    }

    // Inline status selector replaces separate top section
    items.push({
      label: 'Case Status',
      value: (
        <FormField stretch={true} label="" description="">
          <Select
            selectedOption={selectedStatusOption}
            options={STATUS_OPTIONS}
            onChange={handleStatusChange}
            placeholder={canEditStatus ? 'Select status' : 'Status unavailable'}
            disabled={!canEditStatus || savingStatus}
            statusType={savingStatus ? 'loading' : undefined}
            loadingText="Updating status"
            empty="No status options available"
            expandToViewport
            ariaLabel="Case status"
          />
        </FormField>
      )
    });

    const preferredName = answers['preferred-name'];
    if (preferredName) items.push({ label: 'Preferred Name', value: preferredName });

    const applicantName = caseData?.applicant_name || [answers['first-name'], answers['middle-names'], answers['last-name']].filter(Boolean).join(' ');
    if (applicantName) items.push({ label: 'Applicant', value: applicantName });

    const contactEmail = caseData?.applicant_email || answers['contact-email-address'] || answers.email;
    if (contactEmail) items.push({ label: 'Email', value: contactEmail });

    const phoneNumber = caseData?.applicant_phone || answers['telephone-day'] || answers['telephone-alt'];
    if (phoneNumber) items.push({ label: 'Phone', value: phoneNumber });

    if (caseData?.stage) items.push({ label: 'Case Stage', value: caseData.stage });
    if (caseData?.priority) items.push({ label: 'Priority', value: caseData.priority });

    if (payload?.ingested_at) items.push({ label: 'Ingested At', value: formatDateTime(payload.ingested_at) });

    if (application?.created_at) items.push({ label: 'Created At', value: formatDateTime(application.created_at) });
    if (application?.updated_at) items.push({ label: 'Last Updated', value: formatDateTime(application.updated_at) });

    const assignedName = caseData?.assigned_user_name || application?.assigned_evaluator?.name;
    const assignedEmail = caseData?.assigned_user_email || application?.assigned_evaluator?.email;
    if (assignedName || assignedEmail) {
      const display = assignedName && assignedEmail ? `${assignedName} (${assignedEmail})` : (assignedName || assignedEmail);
      items.push({ label: 'Assigned Evaluator', value: display });
    }

    if (caseData?.assigned_user_ptma_name) {
      items.push({ label: 'Assigned PTMA', value: caseData.assigned_user_ptma_name });
    }

    return items;
  }, [application, answers, payload, caseData, selectedStatusOption, canEditStatus, savingStatus, handleStatusChange]);

  // Removed separate caseStatusSection; status selector now inline in overviewItems

  const overviewContent = loading ? (
    <Box textAlign="center" padding="m">
      <Spinner />
    </Box>
  ) : error ? (
    <Box color="text-status-critical">{error}</Box>
  ) : overviewItems.length ? (
    <KeyValuePairs columns={4} items={overviewItems} />
  ) : (
    <Box color="text-status-inactive">No overview data available.</Box>
  );

  return (
    <BoardItem
      header={<Header actions={badgeLabel ? <Badge color={badgeColor}>{badgeLabel}</Badge> : null}>Application Overview</Header>}
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
        {overviewContent}
        {statusFeedback && (
          <Alert
            type={statusFeedback.type}
            dismissible
            onDismiss={() => setStatusFeedback(null)}
          >
            {statusFeedback.content}
          </Alert>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ApplicationOverviewWidget;
