import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
  Box,
  ButtonDropdown,
  ColumnLayout,
  Header,
  Link,
  SpaceBetween,
} from '@cloudscape-design/components';
import { apiFetch } from '../../../auth/apiClient';
import HomeOperationsSnapshotHelp from '../../../helpPanelContents/homeOperationsSnapshotHelp';

const boardItemI18nStrings = {
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
};

const metricDefinitions = [
  {
    id: 'esdcBlocked',
    label: 'ESDC blocked',
    description: 'Participant records blocked from ILMP submission until data is corrected.',
    href: '/esdc/participants?readiness=blocked',
  },
  {
    id: 'esdcNeedsReview',
    label: 'ESDC needs review',
    description: 'Participant records that still need review before submission.',
    href: '/esdc/participants?readiness=needs_review',
  },
  {
    id: 'applicantReadyToInvite',
    label: 'Ready to invite',
    description: 'Applicant accounts created and waiting for PATH activation email.',
    href: '/user-management-dashboard?tab=applicant-accounts&status=created',
  },
  {
    id: 'applicantInvitationSent',
    label: 'Invitations sent',
    description: 'Applicant accounts invited but not yet activated.',
    href: '/user-management-dashboard?tab=applicant-accounts&status=invitation_sent',
  },
  {
    id: 'staffMfaMissing',
    label: 'Staff without MFA',
    description: 'Administrative users who still do not have MFA enabled.',
    href: '/user-management-dashboard?tab=admin-users&filter=noMfa',
  },
  {
    id: 'staffPendingReset',
    label: 'Pending password reset',
    description: 'Administrative users currently waiting on password reset completion.',
    href: '/user-management-dashboard?tab=admin-users&filter=pending',
  },
];

const readJson = async (path, signal) => {
  const response = await apiFetch(path, { signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || payload?.detail || `Request failed: ${response.status}`);
  }
  return response.json();
};

const SystemAdminOperationsSnapshotWidget = ({ actions, toggleHelpPanel }) => {
  const history = useHistory();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadSummary() {
      setLoading(true);
      setError('');
      try {
        const [usersSummary, applicantsSummary, esdcBlocked, esdcNeedsReview] = await Promise.all([
          readJson('/api/admin/users/summary', controller.signal),
          readJson('/api/admin/applicants/summary', controller.signal),
          readJson('/api/esdc/participants?groupByClient=true&readiness=blocked&limit=1&offset=0', controller.signal),
          readJson('/api/esdc/participants?groupByClient=true&readiness=needs_review&limit=1&offset=0', controller.signal),
        ]);

        if (cancelled) return;

        setSummary({
          esdcBlocked: Number(esdcBlocked?.total || 0),
          esdcNeedsReview: Number(esdcNeedsReview?.total || 0),
          applicantReadyToInvite: Number(applicantsSummary?.metrics?.readyToInvite || 0),
          applicantInvitationSent: Number(applicantsSummary?.metrics?.invitationSent || 0),
          staffMfaMissing: Number(usersSummary?.metrics?.mfaMissing || 0),
          staffPendingReset: Number(usersSummary?.metrics?.pending || 0),
        });
      } catch (err) {
        if (!cancelled && err?.name !== 'AbortError') {
          setSummary(null);
          setError(err?.message || 'Failed to load operations snapshot.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSummary();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const infoLink = toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(
          <HomeOperationsSnapshotHelp />,
          'Operations Snapshot',
          HomeOperationsSnapshotHelp.aiContext || ''
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  const metrics = useMemo(
    () =>
      metricDefinitions.map(definition => ({
        ...definition,
        value: Number(summary?.[definition.id] || 0),
      })),
    [summary]
  );

  const handleFollow = (event, href) => {
    event.preventDefault();
    if (!href) return;
    history.push(href);
  };

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>Operations Snapshot</Header>}
      settings={
        actions?.removeItem ? (
          <ButtonDropdown
            ariaLabel="Operations Snapshot settings"
            variant="icon"
            items={[{ id: 'remove', text: 'Remove widget' }]}
            onItemClick={({ detail }) => {
              if (detail.id === 'remove') {
                actions.removeItem();
              }
            }}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {error ? <Alert type="error">{error}</Alert> : null}
        <ColumnLayout columns={3} variant="text-grid">
          {metrics.map(metric => (
            <Box key={metric.id} padding={{ right: 's' }}>
              <SpaceBetween size="xxs">
                <Box variant="awsui-key-label">
                  <Link href={metric.href} onFollow={event => handleFollow(event, metric.href)}>
                    {metric.label}
                  </Link>
                </Box>
                <Box variant="strong" fontSize="display-l">
                  {loading ? '...' : metric.value}
                </Box>
                <Box variant="small" color="inherit">
                  {metric.description}
                </Box>
              </SpaceBetween>
            </Box>
          ))}
        </ColumnLayout>
      </SpaceBetween>
    </BoardItem>
  );
};

export default SystemAdminOperationsSnapshotWidget;
