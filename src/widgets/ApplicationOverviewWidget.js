import React, { useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Box,
  KeyValuePairs,
  Badge,
  Spinner,
  ButtonDropdown
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
    minute: '2-digit'
  });
}

function statusColor(status = '') {
  const normalized = status.toLowerCase();
  if (['active', 'open', 'submitted', 'in progress'].includes(normalized)) return 'green';
  if (['pending', 'assigned'].includes(normalized)) return 'blue';
  if (['closed', 'inactive', 'withdrawn'].includes(normalized)) return 'grey';
  if (['rejected', 'declined', 'errored'].includes(normalized)) return 'red';
  return 'grey';
}

const ApplicationOverviewWidget = ({ actions, application_id, caseData }) => {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(Boolean(application_id));
  const [error, setError] = useState(null);

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

  const { answers, payload } = useMemo(() => {
    if (!application) return { answers: {}, payload: {} };
    const payload = application.__payload || {};
    const rawAnswers = payload.answers || payload.intake_answers || payload;
    return {
      payload,
      answers: rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {}
    };
  }, [application]);

  const { overviewItems, status } = useMemo(() => {
    const items = [];

    const referenceNumber = payload?.submission_snapshot?.reference_number || caseData?.tracking_id;
    if (referenceNumber) {
      items.push({ label: 'Reference #', value: referenceNumber });
    }

    const status = application?.status || caseData?.status || 'Unknown';

    const preferredName = answers['preferred-name'];
    if (preferredName) items.push({ label: 'Preferred Name', value: preferredName });

    const applicantName = caseData?.applicant_name || [answers['first-name'], answers['middle-names'], answers['last-name']]
      .filter(Boolean)
      .join(' ');
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

    return { overviewItems: items, status };
  }, [application, answers, payload, caseData]);

  return (
    <BoardItem
      header={<Header actions={status ? <Badge color={statusColor(status)}>{status}</Badge> : null}>Application Overview</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
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
      {loading ? (
        <Box textAlign="center" padding="m">
          <Spinner />
        </Box>
      ) : error ? (
        <Box color="text-status-critical">{error}</Box>
      ) : overviewItems.length ? (
        <KeyValuePairs columns={4} items={overviewItems} />
      ) : (
        <Box color="text-status-inactive">No overview data available.</Box>
      )}
    </BoardItem>
  );
};

export default ApplicationOverviewWidget;
