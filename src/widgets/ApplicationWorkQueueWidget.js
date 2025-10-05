import React, { useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  ButtonDropdown,
  ColumnLayout,
  Header,
  SpaceBetween,
  StatusIndicator
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';

const getMockMyWork = role => {
  switch (role) {
    case 'Program Administrator':
      return [
        { id: 'new-submissions', label: 'New submissions', count: 18, description: 'Applications received in the last 24 hours awaiting triage.' },
        { id: 'unassigned', label: 'Unassigned backlog', count: 32, description: 'Cases ready to be routed to regional teams or assessors.' },
        { id: 'in-assessment', label: 'In assessment', count: 57, description: 'Applications actively under review across all regions.' },
        { id: 'awaiting-decision', label: 'Awaiting program decision', count: 9, description: 'Assessments that need a Program Administrator approval.' },
        { id: 'on-hold', label: 'On hold / info requested', count: 6, description: 'Applicants have been asked for more information.' },
        { id: 'overdue', label: 'Overdue', count: 4, description: 'Cases past the program turnaround target.' }
      ];
    case 'Regional Coordinator':
      return [
        { id: 'region-queue', label: 'Assigned to my region', count: 21, description: 'Cases owned by you or assessors in your region.' },
        { id: 'needs-reassignment', label: 'Assigned to me', count: 3, description: 'Cases waiting for you to re-route or pick up.' },
        { id: 'awaiting-info', label: 'Awaiting applicant info', count: 5, description: 'Follow-ups sent to applicants from your region.' },
        { id: 'due-this-week', label: 'Due this week', count: 12, description: 'Cases with upcoming SLA deadlines.' },
        { id: 'overdue', label: 'Overdue', count: 1, description: 'Items breaching SLA within your region.' }
      ];
    case 'Application Assessor':
      return [
        { id: 'assigned-to-me', label: 'Assigned to me', count: 7, description: 'Your active assessment queue.' },
        { id: 'due-today', label: 'Due today', count: 2, description: 'Assessments approaching their SLA window.' },
        { id: 'awaiting-applicant', label: 'Awaiting applicant response', count: 1, description: 'Cases paused while the applicant responds.' },
        { id: 'overdue', label: 'Overdue', count: 0, description: 'Cases past SLA that need immediate attention.' }
      ];
    case 'System Administrator':
      return [
        { id: 'workflow-drafts', label: 'Workflow drafts', count: 4, description: 'Draft workflows pending publish.' },
        { id: 'release-prep', label: 'Release prep tasks', count: 3, description: 'Configuration or release items awaiting action.' },
        { id: 'platform-alerts', label: 'Platform alerts', count: 2, description: 'Active platform alerts requiring follow-up.' }
      ];
    default:
      return [
        { id: 'assigned', label: 'Assigned cases', count: 0, description: 'Cases currently assigned to you.' },
        { id: 'awaiting-review', label: 'Awaiting review', count: 0, description: 'Cases needing your review.' },
        { id: 'overdue', label: 'Overdue', count: 0, description: 'Items past their target date.' }
      ];
  }
};

const mergeWorkQueueBuckets = (base, updates) => {
  if (!Array.isArray(base)) {
    return [];
  }
  const updateMap = new Map();
  (Array.isArray(updates) ? updates : []).forEach(bucket => {
    if (bucket && bucket.id) {
      updateMap.set(bucket.id, bucket);
    }
  });
  const merged = base.map(item => {
    const update = updateMap.get(item.id);
    if (!update) {
      return item;
    }
    const parsedCount = Number(update.count);
    return {
      ...item,
      count: Number.isFinite(parsedCount) ? parsedCount : item.count,
      label: update.label || item.label,
      description: typeof update.description === 'string' && update.description.trim().length ? update.description : item.description
    };
  });
  updateMap.forEach((bucket, id) => {
    if (!merged.some(entry => entry.id === id)) {
      const parsedCount = Number(bucket.count);
      merged.push({
        id,
        label: bucket.label || id,
        count: Number.isFinite(parsedCount) ? parsedCount : 0,
        description: typeof bucket.description === 'string' ? bucket.description : ''
      });
    }
  });
  return merged;
};

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
  } catch (_) {}
  return headers;
};

const ApplicationWorkQueueWidget = ({ role, refreshKey = 0, actions }) => {
  const [buckets, setBuckets] = useState(() => getMockMyWork(role));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setBuckets(getMockMyWork(role));
  }, [role]);

  useEffect(() => {
    let ignore = false;

    const loadWorkQueue = async () => {
      if (!role || role === 'Guest') {
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch('/api/dashboard/application-work-queue', {
          headers: buildRequestHeaders(role)
        });
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const payload = await response.json();
        if (ignore) {
          return;
        }
        if (payload && Array.isArray(payload.buckets) && (!payload.role || payload.role === role)) {
          setBuckets(mergeWorkQueueBuckets(getMockMyWork(role), payload.buckets));
        }
      } catch (err) {
        if (!ignore) {
          setError('Showing default counts (live data unavailable).');
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[dashboard] application work queue fetch failed', err);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadWorkQueue();
    return () => {
      ignore = true;
    };
  }, [role, refreshKey]);

  const content = useMemo(() => {
    if (!Array.isArray(buckets) || !buckets.length) {
      return <Box variant="p">No work items to display.</Box>;
    }
    return (
      <ColumnLayout columns={3} variant="text-grid">
        {buckets.map(item => (
          <Box key={item.id} padding={{ bottom: 's' }}>
            <Box fontSize="display-l" fontWeight="bold">{item.count}</Box>
            <Box fontWeight="bold" margin={{ top: 'xxs' }}>{item.label}</Box>
            {item.description && (
              <Box fontSize="body-s" color="text-status-inactive" margin={{ top: 'xxs' }}>
                {item.description}
              </Box>
            )}
          </Box>
        ))}
      </ColumnLayout>
    );
  }, [buckets]);

  return (
    <BoardItem
      header={<Header variant="h2" description="Applications currently in your remit by status.">Application Work Queue</Header>}
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
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
    >
      <SpaceBetween size="s">
        {loading && <StatusIndicator type="loading">Loading latest counts</StatusIndicator>}
        {error && <Box color="text-status-inactive">{error}</Box>}
        {content}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ApplicationWorkQueueWidget;
