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
import HomeUsersAccessAlertsHelp from '../../../helpPanelContents/homeUsersAccessAlertsHelp';

const boardItemI18nStrings = {
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
};

const toneLabels = {
  success: 'Clear',
  warning: 'Needs attention',
  error: 'Action required',
  info: 'Review',
};

const badgeColorForMfaMode = mode => {
  switch (mode) {
    case 'required':
      return 'red';
    case 'optional':
      return 'blue';
    case 'off':
      return 'grey';
    default:
      return 'grey';
  }
};

const readJson = async (path, signal) => {
  const response = await apiFetch(path, { signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || payload?.detail || `Request failed: ${response.status}`);
  }
  return response.json();
};

const SystemAdminUsersAccessAlertsWidget = ({ actions, toggleHelpPanel }) => {
  const history = useHistory();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadAlerts() {
      setLoading(true);
      setError('');
      try {
        const payload = await readJson('/api/dashboard/system-admin-users-access-alerts', controller.signal);
        if (cancelled) return;
        setData(payload);
      } catch (err) {
        if (!cancelled && err?.name !== 'AbortError') {
          setData(null);
          setError(err?.message || 'Failed to load users and access alerts.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAlerts();
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
          <HomeUsersAccessAlertsHelp />,
          'Users & Access Alerts',
          HomeUsersAccessAlertsHelp.aiContext || ''
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  const alerts = useMemo(() => (Array.isArray(data?.alerts) ? data.alerts : []), [data]);
  const policy = data?.policy || {};

  const handleFollow = (event, href) => {
    event.preventDefault();
    if (!href) return;
    history.push(href);
  };

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>Users & Access Alerts</Header>}
      settings={
        actions?.removeItem ? (
          <ButtonDropdown
            ariaLabel="Users & Access Alerts settings"
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
          <StatusIndicator type="loading">Loading access alerts</StatusIndicator>
        ) : data ? (
          <>
            <ColumnLayout columns={3} variant="text-grid">
              {alerts.map(alert => (
                <Box key={alert.id} padding={{ right: 's' }}>
                  <SpaceBetween size="xxs">
                    <Box variant="awsui-key-label">
                      <Link href={alert.href} onFollow={event => handleFollow(event, alert.href)}>
                        {alert.label}
                      </Link>
                    </Box>
                    <Box variant="strong" fontSize="display-l">
                      {Number(alert.count || 0)}
                    </Box>
                    <StatusIndicator type={alert.tone || 'info'}>
                      {toneLabels[alert.tone] || 'Review'}
                    </StatusIndicator>
                    <Box variant="small">{alert.description}</Box>
                    <Box variant="small" color="text-status-inactive">
                      {alert.context}
                    </Box>
                  </SpaceBetween>
                </Box>
              ))}
            </ColumnLayout>

            <ColumnLayout columns={4} variant="text-grid">
              <Box>
                <Box variant="awsui-key-label">Staff pool MFA</Box>
                <Badge color={badgeColorForMfaMode(policy.mfaMode)}>
                  {policy.mfaMode || 'unknown'}
                </Badge>
              </Box>
              <Box>
                <Box variant="awsui-key-label">Software token MFA</Box>
                <Badge color={policy.softwareTokenEnabled ? 'green' : 'grey'}>
                  {policy.softwareTokenEnabled ? 'enabled' : 'disabled'}
                </Badge>
              </Box>
              <Box>
                <Box variant="awsui-key-label">SMS MFA</Box>
                <Badge color={policy.smsEnabled ? 'green' : 'grey'}>
                  {policy.smsEnabled ? 'enabled' : 'disabled'}
                </Badge>
              </Box>
              <Box>
                <Box variant="awsui-key-label">Temp password validity</Box>
                <Box>
                  {policy.temporaryPasswordValidityDays
                    ? `${policy.temporaryPasswordValidityDays} day(s)`
                    : 'Unavailable'}
                </Box>
              </Box>
            </ColumnLayout>
          </>
        ) : null}
      </SpaceBetween>
    </BoardItem>
  );
};

export default SystemAdminUsersAccessAlertsWidget;
