import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { apiFetch } from '../auth/apiClient';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, ButtonDropdown, Table, StatusIndicator, Box, Spinner, TextFilter, SpaceBetween, Link, Button, Badge } from '@cloudscape-design/components';
import ApplicationEventsHelp from '../helpPanelContents/applicationEventsHelp';

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_review: 'In Review',
  'in review': 'In Review',
  docs_requested: 'Action Required',
  'docs requested': 'Action Required',
  action_required: 'Action Required',
  approved: 'Approved',
  completed: 'Completed',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  archived: 'Archived'
};

const trimValue = (value) => (typeof value === 'string' ? value.trim() : '');

const isEmail = (value) => /^[^@\s]+@[^@\s]+$/.test(value);

const selectFirst = (values, predicate = null) => {
  for (const value of values) {
    const trimmed = trimValue(value);
    if (!trimmed) continue;
    if (predicate && !predicate(trimmed)) continue;
    return trimmed;
  }
  return '';
};

const normalizeStatusLabel = (value) => {
  const token = trimValue(value);
  if (!token) return '';
  const normalized = token.toLowerCase().replace(/\s+/g, '_');
  if (STATUS_LABELS[normalized]) {
    return STATUS_LABELS[normalized];
  }
  const words = normalized.split('_').filter(Boolean);
  if (!words.length) return '';
  return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const ensureSentence = (text) => {
  const trimmed = trimValue(text);
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const toUtcStartOfDay = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const daysBetweenUtc = (earlier, later) => {
  const startA = toUtcStartOfDay(earlier);
  const startB = toUtcStartOfDay(later);
  if (startA === null || startB === null) return null;
  return Math.floor((startB - startA) / (24 * 60 * 60 * 1000));
};

const truncate = (text, limit = 160) => {
  const value = trimValue(text);
  if (!value) return '';
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trim()}…`;
};

const formatReminderDetails = (payload = {}, fallbackTitle) => {
  const title = trimValue(payload.title) || fallbackTitle || 'Reminder';
  const due = payload.due_at ? new Date(payload.due_at).toLocaleDateString() : null;
  const trackingId = payload.tracking_id || payload.application_id || '';
  const caseId = payload.case_id || '';
  const category = trimValue(payload.category);
  const description = truncate(payload.description || payload.note || payload.body);
  const parts = [`Reminder due: ${title}`];
  if (due) parts.push(`due ${due}`);
  if (category) parts.push(`Category: ${category}`);
  if (trackingId) parts.push(`Tracking ID ${trackingId}`);
  if (caseId) parts.push(`Case ${caseId}`);
  if (description) parts.push(`Note: ${description}`);
  return parts.join(' • ');
};

const formatActorDisplay = (event) => {
  if (!event) return '';
  const payload = event.event_data || {};
  const name = selectFirst([
    event.user_name,
    event.actor?.displayName,
    payload.evaluator_name,
    payload.actor_name,
    payload.updated_by,
    payload.to_assignee_name,
    payload.from_assignee_name,
    payload.submitter_name
  ], value => !isEmail(value));
  const email = selectFirst([
    event.actor_email,
    payload.actor_email,
    payload.to_assignee_email,
    payload.from_assignee_email,
    payload.submitter_email,
    name
  ], isEmail);
  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return `${name} (${email})`;
  }
  return name || email || '';
};

const formatEventMessage = (event, actorDisplay) => {
  const payload = event.event_data || {};
  const actorSuffix = actorDisplay ? ` by ${actorDisplay}` : '';

  switch (event.event_type) {
    case 'status_changed': {
      const fromLabel = normalizeStatusLabel(payload.from);
      const toLabel = normalizeStatusLabel(payload.to) || 'Unknown status';
      const base = fromLabel && toLabel && fromLabel !== toLabel
        ? `Status changed from ${fromLabel} to ${toLabel}`
        : `Status updated to ${toLabel}`;
      return ensureSentence(`${base}${actorSuffix}`);
    }
    case 'case_assigned': {
      const toAssignee = trimValue(payload.to_assignee_name) || trimValue(payload.to_assignee_email) || 'assigned staff member';
      const fromAssignee = trimValue(payload.from_assignee_name) || trimValue(payload.from_assignee_email);
      let base = `Case assigned to ${toAssignee}`;
      if (fromAssignee) {
        base += ` (previously ${fromAssignee})`;
      }
      return ensureSentence(actorSuffix ? `${base}${actorSuffix}` : base);
    }
    case 'case_reassigned': {
      const toAssignee = trimValue(payload.to_assignee_name) || trimValue(payload.to_assignee_email) || 'new assignee';
      const fromAssignee = trimValue(payload.from_assignee_name) || trimValue(payload.from_assignee_email) || 'previous assignee';
      const base = `Case reassigned from ${fromAssignee} to ${toAssignee}`;
      return ensureSentence(actorSuffix ? `${base}${actorSuffix}` : base);
    }
    case 'assessment_submitted': {
      const name = trimValue(payload.evaluator_name) || actorDisplay;
      const base = 'Assessment submitted';
      return ensureSentence(name ? `${base} by ${name}` : base);
    }
    case 'nwac_review_submitted': {
      const reviewer = trimValue(payload.evaluator_name) || actorDisplay;
      const outcomeRaw = trimValue(payload.outcome);
      const outcome = outcomeRaw ? outcomeRaw.replace(/_/g, ' ') : '';
      const reason = trimValue(payload.reason);
      const parts = ['NWAC review'];
      if (outcome) parts.push(`(${outcome})`);
      let base = parts.join(' ');
      if (reason) base += `: ${reason}`;
      return ensureSentence(reviewer ? `${base} by ${reviewer}` : base);
    }
    case 'reminder_created': {
      const title = trimValue(payload.title) || 'Reminder';
      const due = payload.due_at ? new Date(payload.due_at).toLocaleDateString() : '';
      const base = due ? `${title} (due ${due})` : title;
      return ensureSentence(actorSuffix ? `${base}${actorSuffix}` : base);
    }
    case 'reminder_due': {
      const base = formatReminderDetails(
        { ...payload, tracking_id: event.tracking_id, case_id: event.case_id }
      );
      return ensureSentence(actorSuffix ? `${base}${actorSuffix}` : base);
    }
    case 'reminder_overdue': {
      const title = trimValue(payload.title) || 'Reminder';
      const due = payload.due_at ? new Date(payload.due_at).toLocaleDateString() : 'previously';
      const daysOverdue = (() => {
        if (Number.isFinite(payload.overdue_days) && payload.overdue_days > 0) return Math.floor(payload.overdue_days);
        const diff = daysBetweenUtc(payload.due_at, new Date());
        if (diff === null) return null;
        return diff > 0 ? diff : null;
      })();
      const overdueLabel = daysOverdue ? `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue` : null;
      const base = `Reminder overdue: ${title} (was due ${due}${overdueLabel ? `, ${overdueLabel}` : ''})`;
      const detail = truncate(payload.description || payload.body || payload.note);
      const trackingId = payload.tracking_id || payload.application_id || event.tracking_id;
      const caseId = payload.case_id || event.case_id;
      const parts = [base];
      if (trackingId) parts.push(`Tracking ID ${trackingId}`);
      if (caseId) parts.push(`Case ${caseId}`);
      if (detail) parts.push(`Note: ${detail}`);
      const message = parts.join(' • ');
      return ensureSentence(actorSuffix ? `${message}${actorSuffix}` : message);
    }
    case 'reminder_completed': {
      const title = trimValue(payload.title) || 'Reminder';
      const base = `Reminder completed: ${title}`;
      return ensureSentence(actorSuffix ? `${base}${actorSuffix}` : base);
    }
    case 'application_submitted': {
      const submitter = actorDisplay || trimValue(payload.submitter_name) || trimValue(payload.submitter_email);
      const base = 'Application submitted';
      return ensureSentence(submitter ? `${base} by ${submitter}` : base);
    }
    default:
      if (payload.message) return ensureSentence(payload.message);
      if (payload.summary) return ensureSentence(payload.summary);
      return '';
  }
};

const decorateEvent = (event) => {
  const actorDisplay = formatActorDisplay(event);
  return {
    ...event,
    actorDisplay,
    reminderDetails: formatReminderDetails(
      {
        ...event.event_data,
        tracking_id: event.tracking_id,
        case_id: event.case_id
      },
      event.event_data?.title
    ),
    displayMessage: formatEventMessage(event, actorDisplay)
  };
};

const ApplicationEvents = ({ actions, caseData, toggleHelpPanel }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [sortingColumn, setSortingColumn] = useState({ sortingField: 'created_at' });
  const [isDescending, setIsDescending] = useState(true);
  const [ackLoadingId, setAckLoadingId] = useState(null);
  const [csvGenerating, setCsvGenerating] = useState(false);

  const caseId = caseData?.id || caseData?.case_id || null;

  const loadEvents = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!caseId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/cases/' + caseId + '/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (_) {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const handler = event => {
      const targetCaseId = event?.detail?.caseId;
      if (!caseId) return;
      if (targetCaseId && Number(targetCaseId) !== Number(caseId)) return;
      loadEvents({ silent: true });
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('case-events-refresh', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('case-events-refresh', handler);
      }
    };
  }, [caseId, loadEvents]);

  const handleAcknowledgeReminder = async reminderId => {
    if (!reminderId || !caseId) return;
    setAckLoadingId(reminderId);
    try {
      const res = await apiFetch(`/api/reminders/${reminderId}/acknowledge`, { method: 'POST' });
      if (!res.ok) throw res;
      loadEvents({ silent: true });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('case-reminders-refresh', { detail: { caseId } }));
        window.dispatchEvent(new CustomEvent('case-notes-refresh', { detail: { caseId } }));
      }
    } catch (err) {
      // surface minimal error inline
      console.error('Failed to acknowledge reminder', err);
    } finally {
      setAckLoadingId(null);
    }
  };

  const parseEventDate = useCallback((value) => {
    if (!value) return null;
    const raw = String(value);
    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;
    const withZ = new Date(`${raw}Z`);
    if (!Number.isNaN(withZ.getTime())) return withZ;
    return null;
  }, []);

  const decoratedEvents = useMemo(() => events.map(decorateEvent), [events]);

  const filteredEvents = decoratedEvents.filter(item => {
    if (!filteringText) return true;
    const text = filteringText.toLowerCase();
    const eventDate = parseEventDate(item.created_at);
    const parts = [
      eventDate ? eventDate.toLocaleString().toLowerCase() : '',
      item.event_type_label ? item.event_type_label.toLowerCase() : '',
      item.event_type ? item.event_type.toLowerCase() : '',
      item.displayMessage ? item.displayMessage.toLowerCase() : '',
      item.actorDisplay ? item.actorDisplay.toLowerCase() : ''
    ];
    return parts.some(part => part.includes(text));
  });

  const columnDefinitions = [
    {
      id: 'date',
      header: 'Date/Time',
      sortingField: 'created_at',
      cell: item => {
        const d = parseEventDate(item.created_at);
        return d ? d.toLocaleString() : '';
      }
    },
    {
      id: 'type',
      header: 'Event Type',
      cell: item => <StatusIndicator type={item.alert_variant || 'info'}>{item.event_type_label || item.event_type}</StatusIndicator>
    },
    {
      id: 'data',
      header: 'Event Data',
      cell: item => {
        const isReminder =
          item?.event_type && item.event_type.startsWith('reminder_') && item?.event_data?.reminder_id;
        if (!isReminder) {
          return item.displayMessage || '';
        }
        const trackingId = item.event_data?.tracking_id || item.tracking_id;
        const caseId = item.event_data?.case_id || item.case_id;
        const href = caseId
          ? `/cases/${caseId}`
          : trackingId
            ? `/application-case/${trackingId}`
            : null;
        const detailText =
          item.event_type === 'reminder_due'
            ? item.reminderDetails || item.displayMessage || ''
            : item.displayMessage || '';
        return (
          <SpaceBetween size="xxs">
            <div>{detailText}</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {trackingId ? <Badge color="blue">Tracking ID {trackingId}</Badge> : null}
              {item.event_data?.category ? <Badge color="grey">{item.event_data.category}</Badge> : null}
              {href ? (
                <Link href={href}>View {caseId ? 'case' : 'application'}</Link>
              ) : null}
            </div>
          </SpaceBetween>
        );
      }
    },
    {
      id: 'actor',
      header: 'Actor',
      cell: item => item.actorDisplay || ''
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: item => {
        const reminderId = item?.event_data?.reminder_id;
        const isReminderEvent = item?.event_type?.startsWith('reminder_') && reminderId;
        const isCompleted =
          item?.event_type === 'reminder_completed' ||
          (item?.event_data?.status || '').toLowerCase() === 'completed' ||
          (item?.event_data?.status || '').toLowerCase() === 'cancelled';
        if (!isReminderEvent || isCompleted) return '';
        return (
          <Button
            variant="inline-link"
            onClick={() => handleAcknowledgeReminder(reminderId)}
            loading={ackLoadingId === reminderId}
          >
            Acknowledge reminder
          </Button>
        );
      }
    }
  ];

  const currentSortingColumn = columnDefinitions.find(
    col => col.sortingField === sortingColumn.sortingField
  ) || columnDefinitions[0];

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (currentSortingColumn.sortingField === 'created_at') {
      const aTime = parseEventDate(a.created_at)?.getTime() ?? 0;
      const bTime = parseEventDate(b.created_at)?.getTime() ?? 0;
      if (aTime === bTime) return 0;
      return isDescending ? bTime - aTime : aTime - bTime;
    }
    return 0;
  });

  const handleDownloadCsv = useCallback(() => {
    if (!sortedEvents.length || csvGenerating) return;
    setCsvGenerating(true);
    try {
      const header = ['Date/Time', 'Event Type', 'Event Data', 'Actor'];
      const rows = sortedEvents.map(item => {
        const dateStr = item.created_at ? new Date(item.created_at).toISOString() : '';
        const typeStr = item.event_type_label || item.event_type || '';
        const dataStr = (item.displayMessage || '').replace(/\r?\n/g, ' ').trim();
        const actorStr = item.actorDisplay || '';
        return [dateStr, typeStr, dataStr, actorStr];
      });
      const csv = [header, ...rows]
        .map(cols => cols.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'case-events.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download CSV', err);
    } finally {
      setCsvGenerating(false);
    }
  }, [csvGenerating, sortedEvents]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={
            toggleHelpPanel ? (
              <Link
                variant="info"
                onFollow={() =>
                  toggleHelpPanel(
                    <ApplicationEventsHelp />,
                    'Events Help',
                    ApplicationEventsHelp.aiContext
                  )
                }
              >
                Info
              </Link>
            ) : undefined
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                onClick={handleDownloadCsv}
                disabled={!sortedEvents.length || csvGenerating}
              >
                Download .csv
              </Button>
              <Button
                variant="icon"
                iconName="refresh"
                ariaLabel="Refresh events"
                onClick={() => loadEvents({ silent: false })}
                disabled={loading || !caseId}
              />
            </SpaceBetween>
          }
        >
          Events Timeline
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions?.removeItem?.()}
        />
      }
    >
      <Box variant="small" margin={{ bottom: 's' }}>
        This widget displays a timeline of key events and actions related to the applicant's case, including status changes, messages, and other important updates.
      </Box>
      {loading ? (
        <Box textAlign="center" padding="m"><Spinner /> Loading events...</Box>
      ) : error ? (
        <Box color="error" textAlign="center">{error}</Box>
      ) : (
        <SpaceBetween size="m">
          <TextFilter
            filteringText={filteringText}
            onChange={({ detail }) => setFilteringText(detail.filteringText)}
            filteringPlaceholder="Find events"
            countText={
              filteringText
                ? `${sortedEvents.length} match${sortedEvents.length === 1 ? '' : 'es'}`
                : ''
            }
          />
          <Table
            columnDefinitions={columnDefinitions.map(col =>
              col.sortingField === currentSortingColumn.sortingField
                ? {
                    ...col,
                    isSorted: true,
                    isSortedDescending: isDescending
                  }
                : col
            )}
            items={sortedEvents}
            sortingColumn={currentSortingColumn}
            sortingDescending={isDescending}
            onSortingChange={({ detail }) => {
              if (detail.sortingColumn.sortingField === currentSortingColumn.sortingField) {
                setIsDescending(prev => !prev);
              } else {
                setSortingColumn({ sortingField: detail.sortingColumn.sortingField });
                setIsDescending(true);
              }
            }}
            variant="embedded"
            stickyHeader
            resizableColumns
            empty={<div>No events</div>}
          />
        </SpaceBetween>
      )}
    </BoardItem>
  );
};

export default ApplicationEvents;
