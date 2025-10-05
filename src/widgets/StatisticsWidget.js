import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Container,
  Header,
  Icon,
  SpaceBetween,
  StatusIndicator
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';

const BOARD_ITEM_I18N = {
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
};

const DEFAULT_SECTIONS = [
  {
    id: 'intake-flow',
    title: 'Intake Flow',
    description: 'New submissions entering the program versus outcomes recorded.',
    items: [
      { id: 'submissions-24h', label: 'Submissions (24h)', value: 0, format: 'number', hint: 'Applications submitted in the last 24 hours.' },
      { id: 'submissions-7d', label: 'Submissions (7d)', value: 0, format: 'number', hint: 'Week-to-date submissions.' },
      { id: 'decisions-7d', label: 'Decisions (7d)', value: 0, format: 'number', hint: 'Assessments closed with a decision this week.' }
    ]
  },
  {
    id: 'pipeline-health',
    title: 'Pipeline Health',
    description: 'Snapshot of the active case pipeline and SLA exposure.',
    items: [
      { id: 'active-cases', label: 'Active cases', value: 0, format: 'number', hint: 'Open cases across all regions.' },
      { id: 'unassigned-backlog', label: 'Unassigned', value: 0, format: 'number', hint: 'Cases awaiting assignment.', status: 'warning' },
      { id: 'sla-risk', label: 'SLA risk', value: 0, format: 'percentage', hint: 'Share of cases breaching SLA targets.', status: 'error' }
    ]
  },
  {
    id: 'staffing',
    title: 'Staff & Capacity',
    description: 'Active staff by role and recency of logins.',
    items: [
      { id: 'program-admins', label: 'Program Admins', value: 0, format: 'number' },
      { id: 'regional-coordinators', label: 'Regional Coordinators', value: 0, format: 'number' },
      { id: 'assessors-active', label: 'Assessors (active)', value: 0, format: 'number', hint: 'Assessors who signed in within 7 days.' }
    ]
  },
  {
    id: 'compliance',
    title: 'Documents & Reviews',
    description: 'Compliance signals from assessments and document intake.',
    items: [
      { id: 'documents-received', label: 'Documents received', value: 0, format: 'number', hint: 'Documents uploaded in the past 7 days.' },
      { id: 'cases-missing-docs', label: 'Cases missing docs', value: 0, format: 'number', status: 'warning' },
      { id: 'reviews-pending', label: 'Reviews pending', value: 0, format: 'number', hint: 'Assessments awaiting NWAC program decision.' }
    ]
  }
];

const MOCK_RESPONSE = role => ({
  generatedAt: new Date().toISOString(),
  sections: [
    {
      id: 'intake-flow',
      items: [
        { id: 'submissions-24h', value: 14, trend: { direction: 'up', label: '+5 vs prev. day' } },
        { id: 'submissions-7d', value: 83, trend: { direction: 'up', label: '+12% vs prior week' } },
        { id: 'decisions-7d', value: 65, trend: { direction: 'flat', label: 'On par with last week' } }
      ]
    },
    {
      id: 'pipeline-health',
      items: [
        { id: 'active-cases', value: 248 },
        { id: 'unassigned-backlog', value: role === 'Program Administrator' ? 19 : 7, status: 'warning', trend: { direction: 'down', label: '-6 this week' } },
        { id: 'sla-risk', value: 0.12, format: 'percentage', status: 'error', trend: { direction: 'up', label: '+2 pts' }, target: '≤ 8%' }
      ]
    },
    {
      id: 'staffing',
      items: [
        { id: 'program-admins', value: 6 },
        { id: 'regional-coordinators', value: 14 },
        { id: 'assessors-active', value: 38, hint: 'Logged in within 7 days' }
      ]
    },
    {
      id: 'compliance',
      items: [
        { id: 'documents-received', value: 112, trend: { direction: 'up', label: '+18% vs avg' } },
        { id: 'cases-missing-docs', value: 9, status: 'warning', trend: { direction: 'down', label: '-4 vs last week' } },
        { id: 'reviews-pending', value: 21, status: 'info', trend: { direction: 'flat', label: 'Stable' } }
      ]
    }
  ]
});

const deriveInitialSections = role => DEFAULT_SECTIONS.map(section => ({
  ...section,
  items: section.items.map(item => ({ ...item }))
}));

const buildRequestHeaders = role => {
  const headers = { Accept: 'application/json' };
  try {
    if (role && role !== 'Guest') {
      headers['X-Dev-Role'] = role;
    }
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('iamBypass') === 'off') {
      const token = sessionStorage.getItem('devBypassToken') || process.env.REACT_APP_DEV_AUTH_TOKEN || 'local-dev-secret';
      headers['X-Dev-Bypass'] = token;
      const simulatedUser = sessionStorage.getItem('devUserId');
      if (simulatedUser) headers['X-Dev-UserId'] = simulatedUser;
      const simulatedRegion = sessionStorage.getItem('devRegionId');
      if (simulatedRegion) headers['X-Dev-RegionId'] = simulatedRegion;
    }
  } catch (_) {
    // fall through with whatever headers we have
  }
  return headers;
};

const mergeSections = (baseSections, payloadSections) => {
  if (!Array.isArray(payloadSections)) {
    return baseSections;
  }
  const baseMap = new Map(baseSections.map(section => [section.id, section]));
  payloadSections.forEach(section => {
    if (!section || !section.id || !baseMap.has(section.id)) {
      return;
    }
    const baseSection = baseMap.get(section.id);
    const baseItems = new Map(baseSection.items.map(item => [item.id, item]));
    if (Array.isArray(section.items)) {
      section.items.forEach(item => {
        if (!item || !item.id || !baseItems.has(item.id)) {
          return;
        }
        const baseItem = baseItems.get(item.id);
        baseItems.set(item.id, {
          ...baseItem,
          ...item,
          value: item.value !== undefined && item.value !== null ? item.value : baseItem.value,
          format: item.format || baseItem.format,
          status: item.status || baseItem.status
        });
      });
      baseSection.items = Array.from(baseItems.values());
    }
    if (section.description) {
      baseSection.description = section.description;
    }
  });
  return Array.from(baseMap.values());
};

const formatValue = (value, format = 'number') => {
  if (value === null || value === undefined) {
    return '—';
  }
  switch (format) {
    case 'percentage':
      return `${Math.round(Number(value) * 1000) / 10}%`;
    case 'duration':
      return `${value}d`;
    case 'number':
    default: {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return value;
      }
      if (Math.abs(number) >= 1000) {
        return `${Math.round(number).toLocaleString()}`;
      }
      if (number % 1 === 0) {
        return number.toString();
      }
      return number.toFixed(1);
    }
  }
};

const TrendBadge = ({ trend }) => {
  if (!trend || !trend.direction || !trend.label) {
    return null;
  }
  const type = trend.direction === 'up' ? 'success' : trend.direction === 'down' ? 'info' : 'normal';
  const iconName = trend.direction === 'up' ? 'triangle-up' : trend.direction === 'down' ? 'triangle-down' : 'status-info';
  return (
    <Badge color={type === 'success' ? 'green' : type === 'info' ? 'blue' : 'grey'}>
      <Icon name={iconName} variant="subtle" />
      <span style={{ marginLeft: 4 }}>{trend.label}</span>
    </Badge>
  );
};

const MetricTile = ({ item }) => {
  const primary = formatValue(item.value, item.format);
  const statusType = item.status === 'error'
    ? 'error'
    : item.status === 'warning'
    ? 'warning'
    : item.status === 'info'
    ? 'info'
    : 'success';

  return (
    <Box padding={{ bottom: 's' }}>
      <Box fontSize="display-l" fontWeight="bold">
        {primary}
        {item.target && (
          <Box as="span" fontSize="body-s" color="text-status-inactive" margin={{ left: 'xs' }}>
            Target {item.target}
          </Box>
        )}
      </Box>
      <Box fontWeight="bold" margin={{ top: 'xxs' }}>{item.label}</Box>
      {item.hint && (
        <Box fontSize="body-s" color="text-status-inactive" margin={{ top: 'xxs' }}>
          {item.hint}
        </Box>
      )}
      {item.trend && (
        <Box margin={{ top: 'xxs' }}>
          <TrendBadge trend={item.trend} />
        </Box>
      )}
      {item.status && item.status !== 'info' && (
        <Box margin={{ top: 'xxs' }}>
          <StatusIndicator type={statusType}>
            {item.status === 'error' ? 'Attention required' : item.status === 'warning' ? 'Monitor closely' : 'On track'}
          </StatusIndicator>
        </Box>
      )}
    </Box>
  );
};

const StatisticsWidget = ({ actions, role = 'Guest', refreshKey = 0 }) => {
  const [sections, setSections] = useState(() => deriveInitialSections(role));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    setSections(deriveInitialSections(role));
  }, [role]);

  const loadStats = useCallback(async (options = { force: false }) => {
    setLoading(true);
    setError(null);
    let payload = null;
    try {
      const response = await apiFetch('/api/dashboard/program-admin-stats', {
        headers: buildRequestHeaders(role)
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      payload = await response.json();
    } catch (err) {
      setError('Showing representative sample data – live statistics are not available.');
      payload = MOCK_RESPONSE(role);
    } finally {
      setLoading(false);
    }

    if (!payload) {
      return;
    }
    setSections(current => mergeSections(deriveInitialSections(role), payload.sections));
    setLastUpdated(payload.generatedAt ? new Date(payload.generatedAt) : new Date());
  }, [role]);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  const handleManualRefresh = () => {
    loadStats({ force: true });
  };

  const header = (
    <Header
      variant="h2"
      actions={
        <Button iconName="refresh" onClick={handleManualRefresh} ariaLabel="Refresh statistics" loading={loading} />
      }
    >
      Statistics
    </Header>
  );

  return (
    <BoardItem
      header={header}
      settings={actions?.removeItem ? (
        <ButtonDropdown
          ariaLabel="Board item settings"
          variant="icon"
          items={[{ id: 'remove', text: 'Remove' }]}
          onItemClick={({ detail }) => {
            if (detail.id === 'remove') {
              actions.removeItem();
            }
          }}
        />
      ) : undefined}
      i18nStrings={BOARD_ITEM_I18N}
    >
      <SpaceBetween size="l">
        {error && (
          <Alert type="info" statusIconAriaLabel="Information">
            {error}
          </Alert>
        )}
        {lastUpdated && (
          <Box fontSize="body-s" color="text-status-inactive">
            Last updated {lastUpdated.toLocaleString()}
          </Box>
        )}
        {sections.map(section => (
          <Container
            key={section.id}
            header={<Header variant="h3">{section.title}</Header>}
            footer={section.description ? <Box fontSize="body-s" color="text-status-inactive">{section.description}</Box> : undefined}
          >
            <ColumnLayout columns={3} variant="text-grid">
              {section.items.map(item => (
                <MetricTile key={item.id} item={item} />
              ))}
            </ColumnLayout>
          </Container>
        ))}
      </SpaceBetween>
    </BoardItem>
  );
};

export default StatisticsWidget;
