import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  CollectionPreferences,
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
import useCurrentUser from '../../../hooks/useCurrentUser';

const PERIOD_OPTIONS = [
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'This quarter', value: 'quarter' },
  { label: 'This year', value: 'year' }
];

const METRICS_WIDGET_SETTINGS_PREFIX = 'home-metrics-widget-settings-v1';
const METRIC_DEFINITIONS = [
  {
    id: 'newApplications',
    label: 'New applications',
    description: 'Applications submitted in the selected period.',
    format: 'count'
  },
  {
    id: 'inReview',
    label: 'In review',
    description: 'Applications currently in review and updated in the selected period.',
    format: 'count'
  },
  {
    id: 'awaitingApproval',
    label: 'Awaiting approval',
    description: 'Applications currently pending approval and updated in the selected period.',
    format: 'count'
  },
  {
    id: 'approved',
    label: 'Applications approved',
    description: 'Applications currently approved and updated in the selected period.',
    format: 'count'
  },
  {
    id: 'denied',
    label: 'Applications denied',
    description: 'Applications currently denied and updated in the selected period.',
    format: 'count'
  },
  {
    id: 'actionPlansStarted',
    label: 'Action plans started',
    description: 'Action plans that started in the selected period.',
    format: 'count'
  },
  {
    id: 'activeCases',
    label: 'Active cases',
    description: 'Current active cases in your scope.',
    format: 'count'
  },
  {
    id: 'newInterventionProposals',
    label: 'New intervention proposals',
    description: 'Intervention proposals created in the selected period.',
    format: 'count'
  },
  {
    id: 'interventionsCompleted',
    label: 'Interventions completed',
    description: 'Interventions completed in the selected period.',
    format: 'count'
  },
  {
    id: 'employed',
    label: 'Employed',
    description: 'Action plans with an employed result in the selected period.',
    format: 'count'
  },
  {
    id: 'returnedToSchool',
    label: 'Returned to school',
    description: 'Action plans with a returned-to-school result in the selected period.',
    format: 'count'
  },
  {
    id: 'fundsApproved',
    label: 'Funds approved',
    description: 'Approved intervention funding in the selected period.',
    format: 'currency'
  },
  {
    id: 'fundsCommitted',
    label: 'Funds committed',
    description: 'Finance transactions submitted to finance in the selected period.',
    format: 'currency'
  },
  {
    id: 'fundsActual',
    label: 'Funds recorded actual',
    description: 'PATH finance transactions recorded paid in the selected period.',
    format: 'currency'
  }
];

const DEFAULT_METRIC_IDS = [
  'newApplications',
  'approved',
  'denied',
  'activeCases',
  'employed',
  'returnedToSchool'
];

const normalizeMetricIds = ids => {
  const validIds = new Set(METRIC_DEFINITIONS.map(metric => metric.id));
  const seen = new Set();
  const normalized = Array.isArray(ids)
    ? ids.filter(id => validIds.has(id) && !seen.has(id) && seen.add(id))
    : null;
  return normalized || DEFAULT_METRIC_IDS;
};

const buildMetricsSettingsStorageKey = (role, userId, email) => {
  const scopePart = String(role || 'guest').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const userPart = String(userId || email || 'anonymous').trim().toLowerCase().replace(/[^a-z0-9@._-]+/g, '-');
  return `${METRICS_WIDGET_SETTINGS_PREFIX}.${scopePart}.${userPart}`;
};

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

const metricLabelStyle = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  color: 'var(--color-text-label)'
};

const metricValueStyle = {
  display: 'inline-block',
  fontSize: '1.75rem',
  lineHeight: 1.1,
  fontWeight: 700
};

const MetricTile = ({ label, value, href, onFollow, description, active }) => {
  const renderedValue = <span style={metricValueStyle}>{value}</span>;

  return (
    <Box padding="s" background="layer-1" borderRadius="medium" width="100%">
      <div style={metricLabelStyle}>
      {label}
      </div>
      <div>
        {href ? (
          <Link href={href} onFollow={onFollow}>
            {renderedValue}
          </Link>
        ) : (
          renderedValue
        )}
      </div>
      {description ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-body-secondary)' }}>{description}</div>
      ) : null}
      {active ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-status-info)' }}>Showing below.</div>
      ) : null}
    </Box>
  );
};

const MetricsWidget = ({
  actions = {},
  metadata = {},
  role,
  toggleHelpPanel,
  metricDrilldown = null,
  onOpenMetricDrilldown
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState(PERIOD_OPTIONS[0]);
  const [metricsResponse, setMetricsResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [metricPreferences, setMetricPreferences] = useState({ visibleContent: DEFAULT_METRIC_IDS });
  const { userId, email } = useCurrentUser();
  const settingsStorageKey = useMemo(
    () => buildMetricsSettingsStorageKey(role || 'default', userId, email),
    [email, role, userId]
  );

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(settingsStorageKey);
      if (!raw) {
        setMetricPreferences({ visibleContent: DEFAULT_METRIC_IDS });
        return;
      }
      const parsed = JSON.parse(raw);
      const candidate = Array.isArray(parsed?.visibleContent)
        ? parsed.visibleContent
        : Array.isArray(parsed?.selectedMetricIds)
          ? parsed.selectedMetricIds
          : Array.isArray(parsed)
            ? parsed
            : null;
      setMetricPreferences({ visibleContent: normalizeMetricIds(candidate) });
    } catch (_) {
      setMetricPreferences({ visibleContent: DEFAULT_METRIC_IDS });
    }
  }, [settingsStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        settingsStorageKey,
        JSON.stringify({ visibleContent: normalizeMetricIds(metricPreferences?.visibleContent) })
      );
    } catch (_) {}
  }, [metricPreferences, settingsStorageKey]);

  const periodData = useMemo(
    () => metricsResponse?.periods?.[selectedPeriod.value] || null,
    [metricsResponse, selectedPeriod.value]
  );
  const periodMetrics = useMemo(
    () => periodData?.metrics || {},
    [periodData]
  );
  const rangeLabel = periodData?.rangeLabel || '';

  useEffect(() => {
    if (!metricDrilldown?.metricId || typeof onOpenMetricDrilldown !== 'function') {
      return;
    }
    const activePeriodKey = metricDrilldown?.period?.key || null;
    if (activePeriodKey === selectedPeriod.value || metricDrilldown?.loading) {
      return;
    }
    onOpenMetricDrilldown({
      metricId: metricDrilldown.metricId,
      metricLabel: metricDrilldown.metricLabel,
      period: selectedPeriod.value
    });
  }, [
    metricDrilldown?.loading,
    metricDrilldown?.metricId,
    metricDrilldown?.metricLabel,
    metricDrilldown?.period?.key,
    onOpenMetricDrilldown,
    selectedPeriod.value
  ]);

  const visibleMetricIds = metricPreferences?.visibleContent || DEFAULT_METRIC_IDS;
  const visibleMetricDefinitions = useMemo(
    () => METRIC_DEFINITIONS.filter(metric => visibleMetricIds.includes(metric.id)),
    [visibleMetricIds]
  );

  const metricCards = useMemo(
    () =>
      visibleMetricDefinitions.map(metric => ({
        id: metric.id,
        label: metric.label,
        description: metric.description,
        value: loading
          ? '—'
          : metric.format === 'currency'
            ? formatCurrency(periodMetrics[metric.id])
            : formatCount(periodMetrics[metric.id]),
        rawValue: Number(periodMetrics[metric.id] ?? 0),
        clickable:
          metric.format === 'count' &&
          Number(periodMetrics[metric.id] ?? 0) > 0 &&
          typeof onOpenMetricDrilldown === 'function',
        active:
          metricDrilldown?.metricId === metric.id &&
          (metricDrilldown?.period?.key || null) === selectedPeriod.value,
        busy:
          metricDrilldown?.metricId === metric.id &&
          Boolean(metricDrilldown?.loading)
      })),
    [loading, metricDrilldown, onOpenMetricDrilldown, periodMetrics, selectedPeriod.value, visibleMetricDefinitions]
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
      <CollectionPreferences
        title="Metric preferences"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        preferences={metricPreferences}
        contentBefore={
          <Box variant="p" margin={{ bottom: 's' }}>
            Choose which metrics appear in this widget. Preferences are saved in this browser.
          </Box>
        }
        onConfirm={({ detail }) => {
          const visibleContent = normalizeMetricIds(detail?.visibleContent);
          setMetricPreferences({ visibleContent });
        }}
        visibleContentPreference={{
          title: 'Select visible metrics',
          options: [
            {
              label: 'Metrics',
              options: METRIC_DEFINITIONS.map(metric => ({
                id: metric.id,
                label: metric.label
              }))
            }
          ]
        }}
      />
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
          description={metadata.description ?? 'Configurable snapshot of application, outcome, case, and funding activity.'}
          actions={headerActions}
        >
          {metadata.title ?? 'Metrics'}
        </Header>
      }
      settings={
        <ButtonDropdown
          ariaLabel="Metrics widget settings"
          variant="icon"
          items={typeof actions.removeItem === 'function' ? [{ id: 'remove', text: 'Remove widget' }] : []}
          onItemClick={handleSettingsClick}
        />
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="l">
        {errorMessage ? <Alert type="error">{errorMessage}</Alert> : null}
        {!errorMessage && loading ? (
          <StatusIndicator type="loading">Loading metrics</StatusIndicator>
        ) : null}
        <ColumnLayout columns={3} variant="text-grid">
          {metricCards.map(metric => (
            <MetricTile
              key={metric.id}
              label={metric.label}
              value={metric.busy ? 'Loading...' : metric.value}
              description={metric.description}
              href={metric.clickable && !metric.busy ? '#' : undefined}
              active={metric.active}
              onFollow={metric.clickable && !metric.busy
                ? event => {
                    event.preventDefault();
                    onOpenMetricDrilldown({
                      metricId: metric.id,
                      metricLabel: metric.label,
                      period: selectedPeriod.value
                    });
                  }
                : undefined}
            />
          ))}
        </ColumnLayout>
        {!metricCards.length ? (
          <Box color="text-body-secondary">
            No metrics selected. Open preferences to choose which metrics appear in this widget.
          </Box>
        ) : null}
        {rangeLabel ? (
          <Box color="text-body-secondary" fontSize="body-s">
            Period: {rangeLabel}
          </Box>
        ) : null}
      </SpaceBetween>
    </BoardItem>
  );
};

export default MetricsWidget;
