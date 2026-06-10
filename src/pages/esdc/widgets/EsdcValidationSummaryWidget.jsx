import React, { useCallback, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Container,
  ColumnLayout,
  Box,
  ButtonDropdown,
  Link,
  ProgressBar,
  Button,
  Alert
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';
import { apiFetch } from '../../../auth/apiClient';

const EsdcValidationSummaryWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  submission,
  loading,
  onRefresh
}) => {
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState(null);

  const infoLink = useMemo(() => {
    if (!metadata?.helpComponent || !toggleHelpPanel) {
      return undefined;
    }
    return (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Validation summary help', metadata.aiContext ?? '');
        }}
      >
        Info
      </Link>
    );
  }, [metadata?.helpComponent, metadata?.helpTitle, metadata?.aiContext, toggleHelpPanel]);

  const rawSummary = submission?.readiness_summary;
  const parsedSummary = useMemo(() => {
    if (!rawSummary) return null;
    if (typeof rawSummary === 'string') {
      try {
        return JSON.parse(rawSummary);
      } catch {
        return { raw: rawSummary };
      }
    }
    return rawSummary;
  }, [rawSummary]);

  const handleValidate = useCallback(async () => {
    if (!submission?.id || validating) return;
    setValidating(true);
    setValidateError(null);
    try {
      const resp = await apiFetch(`/api/esdc/participants/${submission.id}/validate`, {
        method: 'POST'
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || body.message || `Validation failed with status ${resp.status}`);
      }
      await resp.json().catch(() => null);
      if (typeof onRefresh === 'function') {
        await onRefresh();
      }
    } catch (err) {
      if (err?.statusText === 'redirecting-to-login') {
        return;
      }
      setValidateError(err?.message || 'Failed to validate participant submission.');
    } finally {
      setValidating(false);
    }
  }, [submission?.id, validating, onRefresh]);

  const handleRefresh = useCallback(() => {
    if (typeof onRefresh === 'function') {
      onRefresh();
    }
  }, [onRefresh]);

  const extractMetric = (obj, keys) => {
    if (!obj) return null;
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
    }
    return null;
  };

  const mandatory = parsedSummary?.mandatory || parsedSummary?.mandatoryFields || null;
  const optional = parsedSummary?.optional || parsedSummary?.optionalFields || null;

  const mandatoryComplete = extractMetric(mandatory, ['complete', 'completed', 'ready', 'count']);
  const mandatoryTotal = extractMetric(mandatory, ['total', 'required', 'expected']);
  const optionalComplete = extractMetric(optional, ['complete', 'completed', 'ready', 'count']);
  const optionalTotal = extractMetric(optional, ['total', 'available', 'expected']);

  const blockingCount = (() => {
    const value = extractMetric(parsedSummary, ['blocking', 'blockingCount', 'blocking_errors']);
    if (typeof value === 'number') return value;
    if (Array.isArray(value)) return value.length;
    if (Array.isArray(parsedSummary?.blocking_issues)) return parsedSummary.blocking_issues.length;
    return null;
  })();
  const warningCount = (() => {
    const value = extractMetric(parsedSummary, ['warnings', 'warningsCount']);
    if (typeof value === 'number') return value;
    if (Array.isArray(value)) return value.length;
    if (Array.isArray(parsedSummary?.warnings)) return parsedSummary.warnings.length;
    return null;
  })();

  const metrics = [];
  if (mandatoryComplete !== null && mandatoryTotal !== null) {
    metrics.push({
      id: 'mandatory',
      label: 'Mandatory fields',
      value: `${mandatoryComplete} / ${mandatoryTotal}`,
      description: 'Fields ESDC requires in the client payload.'
    });
  }
  if (optionalComplete !== null && optionalTotal !== null) {
    metrics.push({
      id: 'optional',
      label: 'Optional fields',
      value: `${optionalComplete} / ${optionalTotal}`,
      description: 'Additional context captured for reporting.'
    });
  }
  if (warningCount !== null) {
    metrics.push({
      id: 'warnings',
      label: 'Warnings',
      value: String(warningCount),
      description: 'Soft issues to review before submission.'
    });
  }
  if (blockingCount !== null) {
    metrics.push({
      id: 'blocking',
      label: 'Blocking issues',
      value: String(blockingCount),
      description: 'Hard validation failures that must be cleared.'
    });
  }

  let progressValue = null;
  if (mandatoryComplete !== null && mandatoryTotal) {
    progressValue = Math.min(100, Math.round((Number(mandatoryComplete) / Number(mandatoryTotal)) * 100));
  } else if (typeof parsedSummary?.overall_percent === 'number') {
    progressValue = Math.round(parsedSummary.overall_percent);
  } else if (typeof parsedSummary?.score === 'number') {
    progressValue = Math.round(parsedSummary.score);
  }

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          actions={(
            <SpaceBetween size="xs" direction="horizontal">
              {typeof onRefresh === 'function' && (
                <Button
                  variant="inline-icon"
                  iconName="refresh"
                  onClick={handleRefresh}
                  disabled={loading || validating}
                >
                  Refresh
                </Button>
              )}
              <Button
                variant="primary"
                iconName="refresh"
                onClick={handleValidate}
                loading={validating}
                disabled={loading || validating || !submission?.id}
              >
                Validate now
              </Button>
            </SpaceBetween>
          )}
        >
          Validation summary
        </Header>
      )}
      settings={typeof actions.removeItem === 'function' ? (
        <ButtonDropdown
          ariaLabel="Validation summary settings"
          variant="icon"
          items={[{ id: 'remove', text: 'Remove widget' }]}
          onItemClick={({ detail }) => {
            if (detail?.id === 'remove') {
              actions.removeItem();
            }
          }}
        />
      ) : undefined}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {validateError && (
          <Alert type="error" dismissible onDismiss={() => setValidateError(null)}>
            {validateError}
          </Alert>
        )}
        {loading && (
          <Box>Loading validation summary…</Box>
        )}
        {!loading && !parsedSummary && (
          <Box color="text-body-secondary">Run validation to generate a summary for this participant.</Box>
        )}
        {progressValue !== null && (
          <ProgressBar
            value={progressValue}
            variant={progressValue === 100 ? 'success' : (progressValue >= 70 ? 'normal' : 'warning')}
            description="Overall readiness"
            resultText={`${progressValue}% ready for submission`}
          />
        )}
        {metrics.length > 0 && (
          <ColumnLayout columns={2} variant="text-grid" minColumnWidth={260}>
            {metrics.map(metric => (
              <Container key={metric.id}>
                <SpaceBetween size="xxs">
                  <Box variant="awsui-key-label">{metric.label}</Box>
                  <Box variant="strong">{metric.value}</Box>
                  <Box variant="p">{metric.description}</Box>
                </SpaceBetween>
              </Container>
            ))}
          </ColumnLayout>
        )}
        {parsedSummary && metrics.length === 0 && (
          <Container>
            <Box variant="awsui-key-label">Summary details</Box>
            <Box as="pre" fontFamily="monospace" padding="s" background="code-editor" overflow="auto">
              {JSON.stringify(parsedSummary, null, 2)}
            </Box>
          </Container>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default EsdcValidationSummaryWidget;
