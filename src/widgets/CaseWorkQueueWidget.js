import React, { useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  ButtonDropdown,
  ColumnLayout,
  Header,
  Link,
  SpaceBetween,
  StatusIndicator
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';

const getCaseTemplate = role => {
  return [
    { id: 'new-intakes', label: 'New Intakes', count: '-', description: 'New clients since Monday of this week.' },
    { id: 'active-cases', label: 'Active Cases', count: '-', description: 'Clients currently in active action plans.' },
    { id: 'follow-ups-due', label: 'Follow-ups due', count: '-', description: 'Tasks due in the next 7 days across the portfolio.' },
    { id: 'inactive-cases', label: 'Inactive Cases', count: '-', description: 'No active plans or no activity in the last 30 days.' },
    { id: 'ilmp-issues', label: 'ILMP Issues', count: '-', description: 'Cases failing ILMP 1.4 validation checks.' },
    { id: 'ready-to-close', label: 'Ready to close', count: '-', description: 'Cases flagged as ready for closure review.' }
  ];
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
      description:
        typeof update.description === 'string' && update.description.trim().length
          ? update.description
          : item.description
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

const CaseWorkQueueWidget = ({ role, refreshKey = 0, actions }) => {
  const [buckets, setBuckets] = useState(() => getCaseTemplate(role));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setBuckets(getCaseTemplate(role));
  }, [role]);

  useEffect(() => {
    let ignore = false;

    const loadCaseQueue = async () => {
      if (!role || role === 'Guest') {
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch('/api/dashboard/case-work-queue', {
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
          setBuckets(mergeWorkQueueBuckets(getCaseTemplate(role), payload.buckets));
        } else {
          throw new Error('Unexpected response format while loading case counts.');
        }
      } catch (err) {
        if (!ignore) {
          setError(err?.message || 'Unable to load case counts.');
          setBuckets(getCaseTemplate(role));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadCaseQueue();
    return () => {
      ignore = true;
    };
  }, [role, refreshKey]);

  const getBucketLink = currentRole => {
    if (!currentRole || currentRole === 'Guest') {
      return null;
    }
    return '/iset/cases';
  };

  const content = useMemo(() => {
    if (!Array.isArray(buckets) || !buckets.length) {
      return <Box variant="p">No case work items to display.</Box>;
    }
    const link = getBucketLink(role);
    return (
      <ColumnLayout columns={6} variant="text-grid" minColumnWidth={185}>
        {buckets.map(item => (
          <Box key={item.id} padding={{ bottom: 's' }}>
            <Box fontSize="display-l" fontWeight="bold">{item.count}</Box>
            <Box fontWeight="bold" margin={{ top: 'xxs' }}>
              {link ? <Link href={link}>{item.label}</Link> : item.label}
            </Box>
            {item.description && (
              <Box fontSize="body-s" color="text-status-inactive" margin={{ top: 'xxs' }}>
                {item.description}
              </Box>
            )}
          </Box>
        ))}
      </ColumnLayout>
    );
  }, [buckets, role]);

  return (
    <BoardItem
      header={<Header variant="h2" description="Cases currently in your remit by status. Client case files are only created when a client's first ISET application is approved.">Case Work Queue</Header>}
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
        {error && !loading && <StatusIndicator type="error">{error}</StatusIndicator>}
        {content}
      </SpaceBetween>
    </BoardItem>
  );
};

export default CaseWorkQueueWidget;
