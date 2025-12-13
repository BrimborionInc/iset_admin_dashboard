import React, { useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Box,
  Link,
  ButtonDropdown,
  Button,
  StatusIndicator,
  ColumnLayout,
  Table
} from '@cloudscape-design/components';
import { boardItemI18nStrings } from './common';
import { apiFetch } from '../../../auth/apiClient';

const EsdcParticipantValidationWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validatingAll, setValidatingAll] = useState(false);
  const [validateMessage, setValidateMessage] = useState(null);

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === 'remove' && typeof actions.removeItem === 'function') {
      actions.removeItem();
    }
  };

  const infoLink = metadata?.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Validation summary', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  const loadSummary = React.useCallback(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resp = await apiFetch('/api/esdc/participants?limit=500&offset=0', {
          signal: controller.signal
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || body.message || `Request failed with ${resp.status}`);
        }
        const data = await resp.json();
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch (err) {
        if (!cancelled && err.name !== 'AbortError') {
          setError(err.message || 'Failed to load validation summary.');
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const cleanup = loadSummary();
    return () => cleanup && cleanup();
  }, [loadSummary]);

  const handleValidateAll = async () => {
    setValidatingAll(true);
    setValidateMessage(null);
    try {
      const resp = await apiFetch('/api/esdc/participants/validate-all', { method: 'POST' });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(body.error || body.message || `Validation failed with ${resp.status}`);
      }
      setValidateMessage(`Validated ${body.validated || 0} of ${body.total || 0}${body.failures?.length ? `, failures: ${body.failures.length}` : ''}`);
      // Refresh summary and queue
      loadSummary();
      try {
        window.dispatchEvent(new CustomEvent('esdcParticipants:refresh'));
      } catch (_) {}
    } catch (err) {
      setValidateMessage(err?.message || 'Validation failed');
    } finally {
      setValidatingAll(false);
    }
  };

  const counts = useMemo(() => {
    const ready = items.filter(item => (item.readiness_status || '').toLowerCase() === 'ready').length;
    const blockedItems = items.filter(item => (item.readiness_status || '').toLowerCase() === 'blocked');
    const needsReviewItems = items.filter(item => (item.readiness_status || '').toLowerCase() === 'needs_review');
    const pending = items.filter(item => (item.submission_status || '').toLowerCase() === 'pending').length;
    const rejected = items.filter(item => (item.submission_status || '').toLowerCase() === 'rejected').length;
    const awaitingValidation = items.filter(item => !item.last_validated_at).length;
    return {
      ready,
      blocked: blockedItems.length,
      needsReview: needsReviewItems.length,
      total: items.length,
      pending,
      rejected,
      awaitingValidation,
      blockedItems,
      needsReviewItems
    };
  }, [items]);

  const issues = useMemo(() => {
    const extractIssues = item => {
      const warnings = (() => {
        if (!item.warnings) return [];
        if (Array.isArray(item.warnings)) return item.warnings;
        if (typeof item.warnings === 'string') {
          try { const parsed = JSON.parse(item.warnings); if (Array.isArray(parsed)) return parsed; } catch (_) {}
          return [item.warnings];
        }
        return [];
      })();
      const blocking = (() => {
        if (!item.blocking_issues) return [];
        if (Array.isArray(item.blocking_issues)) return item.blocking_issues;
        if (typeof item.blocking_issues === 'string') {
          try { const parsed = JSON.parse(item.blocking_issues); if (Array.isArray(parsed)) return parsed; } catch (_) {}
          return [item.blocking_issues];
        }
        return [];
      })();
      return { warnings, blocking };
    };

    const formatDetail = (item) => {
      const { warnings, blocking } = extractIssues(item);
      const list = (item.readiness || item.readiness_status) === 'blocked' ? blocking : [...blocking, ...warnings];
      if (!list.length) {
        if ((item.readiness || item.readiness_status) === 'blocked') return 'Blocking issues present';
        if ((item.readiness || item.readiness_status) === 'needs_review') return 'Warnings or soft mandatory issues';
        return '';
      }
      const [first, ...rest] = list;
      return rest.length ? `${first} (+${rest.length} other issue${rest.length > 1 ? 's' : ''})` : first;
    };

    const toRow = item => ({
      id: item.id,
      participant: item.participant_name || item.tracking_id || `Submission #${item.id}`,
      readiness: (item.readiness_status || '').toLowerCase() || 'needs_review',
      caseId: item.case_id,
      caseNumber: item.case_number || item.tracking_id,
      detail: formatDetail(item)
    });
    return [
      ...counts.blockedItems.map(toRow),
      ...counts.needsReviewItems.map(toRow)
    ];
  }, [counts.blockedItems, counts.needsReviewItems]);

  const statBox = (label, value, type = 'info', description = '') => (
    <Box
      padding="s"
      borderRadius="medium"
      border={{ style: 'solid', color: 'border-divider-panel', width: '1px' }}
    >
      <StatusIndicator type={type}>
        {label}
      </StatusIndicator>
      <Box variant="strong" display="block" fontSize="heading-s">
        {value}
      </Box>
      {description ? (
        <Box variant="p" fontSize="body-s" color="text-body-secondary">
          {description}
        </Box>
      ) : null}
    </Box>
  );

  const renderBody = () => {
    if (loading) {
      return <StatusIndicator type="loading">Loading validation summary</StatusIndicator>;
    }
    if (error) {
      return <StatusIndicator type="error">{error}</StatusIndicator>;
    }
    if (counts.total === 0) {
      return <StatusIndicator type="info">No participants in the queue</StatusIndicator>;
    }
    return (
      <SpaceBetween size="m">
        <ColumnLayout columns={3} variant="text-grid">
          {statBox('Ready', counts.ready, 'success', 'Passed ILMP validation; eligible for file generation.')}
          {statBox('Needs review', counts.needsReview, 'info', 'Non-blocking issues (warnings or soft mandatory gaps); review before submission.')}
          {statBox('Blocked', counts.blocked, 'error', 'Hard failures (required fields/rules missing); must fix before submission.')}
        </ColumnLayout>
        <ColumnLayout columns={3} variant="text-grid">
          {statBox('Pending submission', counts.pending, 'info', 'Ready state not yet submitted.')}
          {statBox('Rejected (resubmit)', counts.rejected, 'warning', 'Previously rejected by ESDC; requires correction and resubmit.')}
          {statBox('Awaiting validation', counts.awaitingValidation, 'pending', 'Never validated; run validation to see readiness.')}
        </ColumnLayout>
        <Box variant="p">
          Total queued participants: <strong>{counts.total}</strong>. Use the queue to open a participant workspace and run validation or prepare an ILMP payload. Batch validate/file generation to be added.
        </Box>
        {issues.length > 0 && (
          <Table
            variant="embedded"
            header={<Header variant="h3">Participants needing attention</Header>}
            columnDefinitions={[
              {
                id: 'participant',
                header: 'Participant',
                cell: item => (
                  <Link href={`/cases/${item.caseId || item.case_id || item.id}`}>
                    {item.participant} ({item.caseNumber || `Case ${item.caseId || item.case_id || item.id}`})
                  </Link>
                )
              },
              {
                id: 'status',
                header: 'Validation status',
                cell: item => {
                  const value = item.readiness;
                  if (value === 'blocked') return <StatusIndicator type="error">Blocked</StatusIndicator>;
                  if (value === 'needs_review') return <StatusIndicator type="info">Needs review</StatusIndicator>;
                  return <StatusIndicator type="pending">{value}</StatusIndicator>;
                }
              },
              {
                id: 'detail',
                header: 'Detail',
                cell: item => item.detail || 'See workspace for rule details'
              }
            ]}
            items={issues}
            stickyHeader
            resizableColumns
            empty={<Box padding="s">No participants require attention.</Box>}
          />
        )}
      </SpaceBetween>
    );
  };

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          actions={(
            <Button
              variant="primary"
              iconName="refresh"
              loading={validatingAll}
              onClick={handleValidateAll}
              disabled={items.length === 0 || loading}
            >
              Validate all
            </Button>
          )}
        >
          Validation summary
        </Header>
      )}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="Participant validation summary settings"
              variant="icon"
              items={[{ id: 'remove', text: 'Remove widget' }]}
              onItemClick={handleSettingsClick}
            />
          )
          : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {validateMessage ? <StatusIndicator type="info">{validateMessage}</StatusIndicator> : null}
        {renderBody()}
      </SpaceBetween>
    </BoardItem>
  );
};

export default EsdcParticipantValidationWidget;
