import React, { useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  ButtonDropdown,
  Header,
  Link,
  SpaceBetween,
  StatusIndicator
} from '@cloudscape-design/components';
import { apiFetch } from '../../../auth/apiClient';
import HomeRecentActivityHelp from '../../../helpPanelContents/homeRecentActivityHelp';

const isSystemAdministrator = role => role === 'System Administrator';

const getWidgetTitle = role => (isSystemAdministrator(role) ? 'Recent Admin Activity' : 'Recent Activity');

const getRequestUrl = role => (
  isSystemAdministrator(role)
    ? '/api/dashboard/system-admin-recent-activity?limit=6'
    : '/api/events/feed?limit=5'
);

const getFallbackErrorMessage = role => (
  isSystemAdministrator(role)
    ? 'Showing sample admin activity (live feed unavailable).'
    : 'Showing sample activity (live feed unavailable).'
);

const getEmptyStateMessage = role => (
  isSystemAdministrator(role)
    ? 'No recent admin activity.'
    : 'No recent activity.'
);

const getMockRecentActivity = role => {
  const now = Date.now();
  if (isSystemAdministrator(role)) {
    return [
      {
        id: 'sa1',
        title: 'Main intake workflow published',
        message: 'Workflow 1 schema published.',
        actor_name: 'System Administrator',
        ts: now - 1000 * 60 * 18,
        link_href: '/manage-workflows',
        link_label: 'Manage Workflows',
      },
      {
        id: 'sa2',
        title: 'Event capture updated',
        message: 'Assessments & Reviews capture enabled.',
        actor_name: 'System Administrator',
        ts: now - 1000 * 60 * 47,
        link_href: '/configuration/events',
        link_label: 'Event Capture',
      },
      {
        id: 'sa3',
        title: 'File upload configuration updated',
        message: 'Changed: maxSizeMB, allowedMime',
        actor_name: 'System Administrator',
        ts: now - 1000 * 60 * 92,
        link_href: '/admin/upload-config',
        link_label: 'File Upload Config',
      },
    ];
  }
  return [
    { id: 'a1', title: 'Case 2457 updated', ts: now - 1000 * 60 * 14 },
    { id: 'a2', title: 'New workflow version published', ts: now - 1000 * 60 * 42 },
  ];
};

const relativeTime = ts => {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + 'h ago';
  const diffD = Math.floor(diffH / 24);
  return diffD + 'd ago';
};

const pickFirstText = (...candidates) => {
  const visited = new Set();

  const extract = value => {
    if (value === null || value === undefined) {
      return '';
    }
    const valueType = typeof value;
    if (valueType === 'string') {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : '';
    }
    if (valueType === 'number' || valueType === 'bigint') {
      return String(value);
    }
    if (valueType === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (valueType === 'object') {
      if (visited.has(value)) {
        return '';
      }
      visited.add(value);
      if (Array.isArray(value)) {
        for (const entry of value) {
          const nested = extract(entry);
          if (nested) {
            return nested;
          }
        }
        return '';
      }
      const fields = ['displayName', 'name', 'label', 'title', 'text', 'summary', 'message', 'email', 'value', 'description'];
      for (const field of fields) {
        if (field in value) {
          const nested = extract(value[field]);
          if (nested) {
            return nested;
          }
        }
      }
      if ('id' in value) {
        const nested = extract(value.id);
        if (nested) {
          return nested;
        }
      }
    }
    return '';
  };

  for (const candidate of candidates) {
    const result = extract(candidate);
    if (result) {
      return result;
    }
  }
  return '';
};

const buildRequestHeaders = role => {
  return { Accept: 'application/json' };
};

const normalizeText = value => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const resolveActivityLink = (item, caseId, trackingId) => {
  const explicitHref = pickFirstText(item?.link_href, item?.linkHref, item?.href);
  const explicitLabel = pickFirstText(item?.link_label, item?.linkLabel);
  if (explicitHref) {
    return {
      href: explicitHref,
      label: explicitLabel || 'Open',
    };
  }

  if (caseId) {
    return {
      href: `/cases/${caseId}`,
      label: trackingId || `Case ${caseId}`,
    };
  }

  const subjectType = pickFirstText(item?.subject_type, item?.subjectType);
  const subjectId = pickFirstText(item?.subject_id, item?.subjectId);
  if (subjectType === 'application' && subjectId) {
    return {
      href: `/application-case/${subjectId}`,
      label: explicitLabel || `Application ${subjectId}`,
    };
  }

  return null;
};

const RecentActivityWidget = ({ role, refreshKey = 0, actions, toggleHelpPanel }) => {
  const [activityItems, setActivityItems] = useState(() => getMockRecentActivity(role));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const widgetTitle = getWidgetTitle(role);

  useEffect(() => {
    setActivityItems(getMockRecentActivity(role));
  }, [role]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);

    const loadActivity = async () => {
      if (!role || role === 'Guest') {
        setLoading(false);
        setError(null);
        return;
      }
      try {
        const response = await apiFetch(getRequestUrl(role), {
          headers: buildRequestHeaders(role)
        });
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const payload = await response.json();
        if (ignore) {
          return;
        }
        if (Array.isArray(payload)) {
          setActivityItems(payload);
        } else if (payload && Array.isArray(payload.items)) {
          setActivityItems(payload.items);
        } else {
          setActivityItems([]);
        }
      } catch (err) {
        if (!ignore) {
          setError(getFallbackErrorMessage(role));
          setActivityItems(getMockRecentActivity(role));
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[dashboard] recent activity feed fetch failed', err);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadActivity();
    return () => {
      ignore = true;
    };
  }, [role, refreshKey]);

  const renderedItems = useMemo(() => {
    if (!Array.isArray(activityItems) || !activityItems.length) {
      return <Box variant="p">{getEmptyStateMessage(role)}</Box>;
    }

    return activityItems.map((item, idx) => {
      const eventData = item && typeof item.event_data === 'object' ? item.event_data : null;
      const key = pickFirstText(
        item?.id,
        item?.event_id,
        item?.event_entry_id,
        item?.uuid,
        item?.eventId,
        item?.tracking_id
      ) || `event-${idx}`;

      const candidateTimestamp = (() => {
        if (typeof item?.ts === 'number' && Number.isFinite(item.ts)) {
          return item.ts;
        }
        const rawTs = item?.created_at || item?.createdAt || item?.timestamp || item?.occurred_at;
        if (!rawTs) {
          return null;
        }
        if (typeof rawTs === 'number' && Number.isFinite(rawTs)) {
          return rawTs;
        }
        if (typeof rawTs === 'string') {
          const normalized = rawTs.includes('T') ? rawTs : rawTs.replace(' ', 'T');
          const parsed = Date.parse(normalized);
          if (!Number.isNaN(parsed)) {
            return parsed;
          }
          const parsedWithZone = Date.parse(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
          if (!Number.isNaN(parsedWithZone)) {
            return parsedWithZone;
          }
        }
        return null;
      })();

      const timestamp = Number.isFinite(candidateTimestamp) ? candidateTimestamp : null;
      const tooltip = timestamp !== null ? new Date(timestamp).toLocaleString() : undefined;
      const timeLabel = timestamp !== null ? relativeTime(timestamp) : '';
      const title = pickFirstText(
        item?.title,
        item?.summary,
        item?.label,
        item?.event_type,
        eventData && eventData.summary,
        eventData && eventData.message
      ) || 'Activity update';
      const actorName = pickFirstText(
        item?.actor_name,
        item?.actor,
        item?.user_name,
        item?.user,
        eventData && eventData.actor_name,
        eventData && eventData.actor
      );
      const message = pickFirstText(
        item?.message,
        eventData && eventData.message,
        eventData && eventData.summary,
        eventData && eventData.note_preview,
        eventData && eventData.description
      );
      const caseIdRaw = item?.case_id !== undefined && item?.case_id !== null
        ? item.case_id
        : item?.subject_type === 'case'
          ? item?.subject_id
          : eventData && eventData.case_id;
      const caseId = caseIdRaw !== undefined && caseIdRaw !== null ? String(caseIdRaw) : null;
      const trackingId = pickFirstText(
        item?.tracking_id,
        eventData && eventData.tracking_id,
        eventData && eventData.reference_number
      );
      const activityLink = resolveActivityLink(item, caseId, trackingId);
      const showMessage = message && normalizeText(message) !== normalizeText(title);

      return (
        <Box key={key} title={tooltip} margin={{ bottom: 'xxs' }}>
          <Box display="inline" margin={{ right: 'xs' }}>{title}</Box>
          {actorName && (
            <Box display="inline" margin={{ right: 'xs' }} color="text-status-inactive">by {actorName}</Box>
          )}
          {activityLink && (
            <Box display="inline" margin={{ right: 'xs' }}>
              <Link href={activityLink.href}>{activityLink.label}</Link>
            </Box>
          )}
          {showMessage && (
            <Box display="inline" margin={{ right: 'xs' }}>{message}</Box>
          )}
          {timeLabel && (
            <Box display="inline" color="text-status-inactive">{timeLabel}</Box>
          )}
        </Box>
      );
    });
  }, [activityItems, role]);

  const infoLink = toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(<HomeRecentActivityHelp role={role} />, widgetTitle, HomeRecentActivityHelp.aiContext || '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={<Header variant="h2" info={infoLink}>{widgetTitle}</Header>}
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
        {loading ? (
          <StatusIndicator type="loading">Loading activity</StatusIndicator>
        ) : (
          <>
            {error && <Box color="text-status-inactive">{error}</Box>}
            {renderedItems}
          </>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default RecentActivityWidget;
