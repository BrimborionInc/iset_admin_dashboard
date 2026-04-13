import React from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  ColumnLayout,
  FormField,
  Modal,
  SpaceBetween,
  Spinner,
  Textarea,
} from '@cloudscape-design/components';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMatchSource(value) {
  const source = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!source) return '—';
  if (source === 'sin') return 'Social Insurance Number';
  return source
    .split(/[_-\s]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatStatusLabel(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!status) return 'Unknown';
  return status
    .split(/[_-\s]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusBadgeColor(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (status === 'active') return 'red';
  if (status === 'inactive') return 'grey';
  return 'blue';
}

const DetailItem = ({ label, value }) => (
  <SpaceBetween size="xxs">
    <Box color="text-body-secondary" fontSize="body-s">
      {label}
    </Box>
    {React.isValidElement(value) ? value : <Box fontWeight="bold">{value || '—'}</Box>}
  </SpaceBetween>
);

const ApplicantWatchlistHitDetailsModal = ({
  visible,
  onDismiss,
  loading = false,
  error = null,
  details = null,
}) => {
  const summary = details?.summary || null;
  const entry = details?.entry || null;
  const statusValue = entry?.status || summary?.watchlistStatus || null;
  const notesValue = entry?.notes || '';

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      closeAriaLabel="Close watchlist details"
      size="large"
      header="Watchlist details"
      footer={
        <Box float="right">
          <Button onClick={onDismiss}>Close</Button>
        </Box>
      }
    >
      {loading ? (
        <Box textAlign="center" padding="l">
          <Spinner />
        </Box>
      ) : error ? (
        <Alert type="error" header="Unable to load watchlist details">
          {error}
        </Alert>
      ) : !summary ? (
        <Box color="text-status-inactive">No watchlist details are available for this application.</Box>
      ) : (
        <SpaceBetween size="l">
          <Alert type="warning" header="Applicant watchlist hit">
            {summary.message || 'This application matches an applicant watchlist entry.'}
          </Alert>

          <ColumnLayout columns={2} variant="text-grid">
            <DetailItem label="Applicant" value={summary.applicantName || entry?.fullName || 'Applicant'} />
            <DetailItem label="Match source" value={formatMatchSource(summary.matchSource)} />
            <DetailItem label="Reference #" value={summary.trackingId || entry?.sourceTrackingId || '—'} />
            <DetailItem label="Case #" value={summary.caseNumber || entry?.sourceCaseNumber || '—'} />
            <DetailItem label="Masked SIN" value={summary.sinMasked || entry?.sinMasked || '—'} />
            <DetailItem
              label="Watchlist status"
              value={
                <Badge color={statusBadgeColor(statusValue)}>
                  {formatStatusLabel(statusValue)}
                </Badge>
              }
            />
            <DetailItem label="Hit recorded" value={formatDateTime(summary.hitCapturedAt)} />
            <DetailItem label="Watchlist source" value={entry?.sourceLabel || 'Direct entry'} />
            <DetailItem label="Watchlist added" value={formatDateTime(entry?.createdAt)} />
            <DetailItem label="Last updated" value={formatDateTime(entry?.updatedAt || entry?.createdAt)} />
            <DetailItem label="Updated by" value={entry?.updatedByLabel || entry?.createdByLabel || '—'} />
            <DetailItem label="Date of birth" value={formatDate(entry?.dob)} />
          </ColumnLayout>

          <FormField label="Notes" description="Current watchlist notes and handling instructions.">
            <Textarea
              readOnly
              value={notesValue || 'No notes recorded.'}
              rows={6}
            />
          </FormField>
        </SpaceBetween>
      )}
    </Modal>
  );
};

export default ApplicantWatchlistHitDetailsModal;
