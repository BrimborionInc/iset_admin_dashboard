import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Header,
  Link,
  Select,
  SpaceBetween,
  StatusIndicator
} from '@cloudscape-design/components';
import { apiFetch } from '../../../auth/apiClient';
import { boardItemI18nStrings } from '../../../widgets/common';
import HomeMetricsHelp from '../../../helpPanelContents/homeMetricsHelp';

const PERIOD_OPTIONS = [
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'This quarter', value: 'quarter' },
  { label: 'This year', value: 'year' }
];

const formatCount = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('en-CA');
};

const formatCurrency = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const MetricTile = ({ label, value, description }) => (
  <Box padding="s" background="layer-1" borderRadius="medium" width="100%">
    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-label)' }}>
      {label}
    </div>
    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{value}</div>
    {description ? (
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-body-secondary)' }}>{description}</div>
    ) : null}
  </Box>
);

const MetricsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[0]);
  const [metricsResponse, setMetricsResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchMetrics = useCallback(async signal => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await apiFetch('/api/dashboard/metrics', { signal });
      if (!response.ok) {
        let errorPayload = null;
        try {
          errorPayload = await response.json();
        } catch (_) {
          errorPayload = null;
        }
        throw new Error(errorPayload?.message || 'Failed to load metrics.');
      }
      const payload = await response.json();
      setMetricsResponse(payload);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setErrorMessage(err?.message || 'Failed to load metrics.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchMetrics(controller.signal);
    return () => controller.abort();
  }, [fetchMetrics]);

  const periodData = metricsResponse?.periods?.[selectedPeriod.value] || null;
  const periodMetrics = periodData?.metrics || {};
  const rangeLabel = periodData?.rangeLabel || '';

  const metricCards = useMemo(
    () => [
      {
        id: 'newApplications',
        label: 'New Applications',
        value: loading ? '—' : formatCount(periodMetrics.newApplications)
      },
      {
        id: 'decisionsMade',
        label: 'Decisions Made',
        value: loading ? '—' : formatCount(periodMetrics.decisionsMade)
      },
      {
        id: 'activeCases',
        label: 'Active Cases',
        value: loading ? '—' : formatCount(periodMetrics.activeCases)
      },
      {
        id: 'fundsCommitted',
        label: 'Funds Committed',
        value: loading ? '—' : formatCurrency(periodMetrics.fundsCommitted)
      },
      {
        id: 'fundsSpent',
        label: 'Funds Spent',
        value: loading ? '—' : formatCurrency(periodMetrics.fundsSpent)
      }
    ],
    [loading, periodMetrics]
  );

  const infoLink = toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(<HomeMetricsHelp />, 'Metrics', HomeMetricsHelp.aiContext || '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === 'remove' && typeof actions.removeItem === 'function') {
      actions.removeItem();
    }
  };

  const handleRefresh = () => {
    const controller = new AbortController();
    fetchMetrics(controller.signal);
  };

  const headerActions = (
    <SpaceBetween direction="horizontal" size="xs">
      <Select
        selectedOption={selectedPeriod}
        options={PERIOD_OPTIONS}
        onChange={({ detail }) => setSelectedPeriod(detail.selectedOption)}
        ariaLabel="Metrics period"
      />
      <Button
        iconName="refresh"
        variant="icon"
        ariaLabel="Refresh metrics"
        onClick={handleRefresh}
        loading={loading}
      />
    </SpaceBetween>
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description ?? 'Snapshot of application, decision, case, and funding activity.'}
          actions={headerActions}
        >
          {metadata.title ?? 'Metrics'}
        </Header>
      }
      settings={
        typeof actions.removeItem === 'function' ? (
          <ButtonDropdown
            ariaLabel="Metrics widget settings"
            variant="icon"
            items={[{ id: 'remove', text: 'Remove widget' }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="l">
        {rangeLabel ? (
          <Box variant="awsui-key-label">
            Period: {rangeLabel}
          </Box>
        ) : null}
        {errorMessage ? <Alert type="error">{errorMessage}</Alert> : null}
        {!errorMessage && loading ? (
          <StatusIndicator type="loading">Loading metrics</StatusIndicator>
        ) : null}
        <ColumnLayout columns={3} variant="text-grid">
          {metricCards.map(metric => (
            <MetricTile key={metric.id} label={metric.label} value={metric.value} description={metric.description} />
          ))}
        </ColumnLayout>
      </SpaceBetween>
    </BoardItem>
  );
};

export default MetricsWidget;
