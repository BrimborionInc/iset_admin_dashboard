import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
  Badge,
  Box,
  ButtonDropdown,
  ColumnLayout,
  Header,
  Link,
  SpaceBetween,
  StatusIndicator,
} from '@cloudscape-design/components';
import { apiFetch } from '../../../auth/apiClient';
import HomeAwsEnvironmentStatusHelp from '../../../helpPanelContents/homeAwsEnvironmentStatusHelp';

const boardItemI18nStrings = {
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
};

const toneLabels = {
  success: 'Healthy',
  warning: 'Needs attention',
  error: 'Action required',
};

const environmentBadgeColor = label => {
  const normalized = String(label || '').trim().toLowerCase();
  if (normalized === 'production') return 'blue';
  if (normalized === 'test') return 'grey';
  if (normalized === 'development') return 'green';
  return 'grey';
};

const readJson = async (path, signal) => {
  const response = await apiFetch(path, { signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || payload?.detail || `Request failed: ${response.status}`);
  }
  return response.json();
};

const formatCheckedAt = value => {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString();
};

const SystemAdminAwsEnvironmentStatusWidget = ({ actions, toggleHelpPanel }) => {
  const history = useHistory();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadStatus() {
      setLoading(true);
      setError('');
      try {
        const payload = await readJson('/api/dashboard/system-admin-aws-environment-status', controller.signal);
        if (cancelled) return;
        setData(payload);
      } catch (err) {
        if (!cancelled && err?.name !== 'AbortError') {
          setData(null);
          setError(err?.message || 'Failed to load AWS environment status.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStatus();
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
          <HomeAwsEnvironmentStatusHelp />,
          'AWS Environment Status',
          HomeAwsEnvironmentStatusHelp.aiContext || ''
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  const services = useMemo(() => (Array.isArray(data?.services) ? data.services : []), [data]);
  const statusCounts = data?.statusCounts || { success: 0, warning: 0, error: 0 };
  const environment = data?.environment || {};

  const handleFollow = (event, href) => {
    event.preventDefault();
    if (!href) return;
    history.push(href);
  };

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>AWS Environment Status</Header>}
      settings={
        actions?.removeItem ? (
          <ButtonDropdown
            ariaLabel="AWS Environment Status settings"
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
        {loading && !data ? (
          <StatusIndicator type="loading">Loading AWS environment status</StatusIndicator>
        ) : data ? (
          <>
            <ColumnLayout columns={4} variant="text-grid">
              <Box>
                <Box variant="awsui-key-label">Environment</Box>
                <Badge color={environmentBadgeColor(environment.label)}>
                  {environment.label || 'Unknown'}
                </Badge>
              </Box>
              <Box>
                <Box variant="awsui-key-label">Cognito region</Box>
                <Box>{environment.cognitoRegion || 'Unavailable'}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">SES region</Box>
                <Box>{environment.sesRegion || 'Unavailable'}</Box>
              </Box>
              <Box>
                <Box variant="awsui-key-label">Last checked</Box>
                <Box>{formatCheckedAt(data.generatedAt)}</Box>
              </Box>
            </ColumnLayout>

            <Box variant="small" color="text-status-inactive">
              {statusCounts.success} healthy, {statusCounts.warning} needs attention, {statusCounts.error} errors.
            </Box>

            <ColumnLayout columns={3} variant="text-grid">
              {services.map(service => (
                <Box key={service.id} padding={{ right: 's' }}>
                  <SpaceBetween size="xxs">
                    <Box variant="awsui-key-label">
                      {service.href ? (
                        <Link href={service.href} onFollow={event => handleFollow(event, service.href)}>
                          {service.label}
                        </Link>
                      ) : (
                        service.label
                      )}
                    </Box>
                    <StatusIndicator type={service.tone || 'info'}>
                      {toneLabels[service.tone] || 'Review'}
                    </StatusIndicator>
                    <Box variant="strong">{service.summary}</Box>
                    {(service.details || []).map(detail => (
                      <Box key={`${service.id}-${detail}`} variant="small" color="text-status-inactive">
                        {detail}
                      </Box>
                    ))}
                  </SpaceBetween>
                </Box>
              ))}
            </ColumnLayout>
          </>
        ) : null}
      </SpaceBetween>
    </BoardItem>
  );
};

export default SystemAdminAwsEnvironmentStatusWidget;
