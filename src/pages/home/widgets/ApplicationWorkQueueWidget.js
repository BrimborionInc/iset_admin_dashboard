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
import { apiFetch } from '../../../auth/apiClient';

const getBucketTemplate = role => {
  switch (role) {
    case 'NWAC Administrator':
      return [
        { id: 'new-submissions', label: 'Unassigned Applications', count: '-', description: 'Applications in submitted status without an assigned owner.' },
        { id: 'awaiting-ei-validation', label: 'Awaiting EI Validation', count: '-', description: 'Applications missing EI eligibility confirmation.' },
        { id: 'in-assessment', label: 'In Assessment', count: '-', description: 'Applications in active review by their owners.' },
        { id: 'on-hold', label: 'On Hold', count: '-', description: 'Applications intentionally parked for follow-up.' },
        { id: 'awaiting-decision', label: 'Pending decision', count: '-', description: 'Application assessments complete, but need a final decision.' },
        { id: 'decisions-made', label: 'Decisions Made', count: '-', description: 'Applications approved or denied this week.' }
      ];
    case 'Regional Manager':
      return [
        { id: 'region-queue', label: 'Assigned to my region', count: '-', description: 'Applications owned by me or assessors in my region.' },
        { id: 'needs-reassignment', label: 'Assigned to me', count: '-', description: 'Applications waiting for me to re-route or pick up.' },
        { id: 'awaiting-my-approval', label: 'Pending review', count: '-', description: 'Applications waiting for Regional Manager review.' },
        { id: 'awaiting-info', label: 'Awaiting info', count: '-', description: 'Applications awaiting applicant action.' },
        { id: 'due-this-week', label: 'Due this week', count: '-', description: 'Applications approaching their target date within 7 days.' },
        { id: 'overdue', label: 'Overdue', count: '-', description: 'Applications past target date within my region.' }
      ];
    case 'ISET Coordinator':
      return [
        { id: 'assigned-to-me', label: 'Assigned to me', count: '-', description: 'Your active assessment queue.' },
        { id: 'due-today', label: 'Due today', count: '-', description: 'Assessments reaching their target date soon.' },
        { id: 'due-soon', label: 'Due soon', count: '-', description: 'Assessments due within the next few days.' },
        { id: 'awaiting-applicant', label: 'Awaiting applicant', count: '-', description: 'Cases paused while the applicant responds.' },
        { id: 'overdue', label: 'Overdue', count: '-', description: 'Cases past target that need immediate attention.' }
      ];
    case 'System Administrator':
      return [
        { id: 'workflow-drafts', label: 'Workflow drafts', count: '-', description: 'Draft workflows pending publish.' },
        { id: 'release-prep', label: 'Release prep tasks', count: '-', description: 'Configuration or release items awaiting action.' },
        { id: 'platform-alerts', label: 'Platform alerts', count: '-', description: 'Active platform alerts requiring follow-up.' }
      ];
    default:
      return [
        { id: 'assigned', label: 'Assigned cases', count: '-', description: 'Cases currently assigned to you.' },
        { id: 'awaiting-review', label: 'Awaiting review', count: '-', description: 'Cases needing your review.' },
        { id: 'overdue', label: 'Overdue', count: '-', description: 'Items past their target date.' }
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
  return { Accept: 'application/json' };
};

const ApplicationWorkQueueWidget = ({ role, refreshKey = 0, actions }) => {
  const [buckets, setBuckets] = useState(() => getBucketTemplate(role));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setBuckets(getBucketTemplate(role));
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
          setBuckets(mergeWorkQueueBuckets(getBucketTemplate(role), payload.buckets));
        } else {
          throw new Error('Unexpected response format while loading application counts.');
        }
      } catch (err) {
        if (!ignore) {
          setError(err?.message || 'Unable to load application counts.');
          setBuckets(getBucketTemplate(role));
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

  const getBucketLink = (currentRole, bucketId) => {
    const basePath = '/case-assignment-dashboard';
    const query = `?bucket=${encodeURIComponent(bucketId)}`;
    if (
      currentRole === 'NWAC Administrator' &&
      (bucketId === 'new-submissions' ||
        bucketId === 'awaiting-ei-validation' ||
        bucketId === 'in-assessment' ||
        bucketId === 'on-hold' ||
        bucketId === 'awaiting-decision' ||
        bucketId === 'decisions-made')
    ) {
      return `${basePath}${query}`;
    }
    if (currentRole === 'Regional Manager') {
      return `${basePath}${query}`;
    }
    if (
      currentRole === 'ISET Coordinator' &&
      (bucketId === 'assigned-to-me' ||
        bucketId === 'due-today' ||
        bucketId === 'due-soon' ||
        bucketId === 'awaiting-applicant' ||
        bucketId === 'overdue')
    ) {
      return `${basePath}${query}`;
    }
    return null;
  };

  const content = useMemo(() => {
    if (!Array.isArray(buckets) || !buckets.length) {
      return <Box variant="p">No work items to display.</Box>;
    }
    return (
      <ColumnLayout columns={6} variant="text-grid" minColumnWidth={185}>
        {buckets.map(item => (
          <Box key={item.id} padding={{ bottom: 's' }}>
            <Box fontSize="display-l" fontWeight="bold">{item.count}</Box>
            <Box fontWeight="bold" margin={{ top: 'xxs' }}>
              {(() => {
                const link = getBucketLink(role, item.id);
                if (link) {
                  return <Link href={link}>{item.label}</Link>;
                }
                return item.label;
              })()}
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
        {error && !loading && <StatusIndicator type="error">{error}</StatusIndicator>}
        {content}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ApplicationWorkQueueWidget;
