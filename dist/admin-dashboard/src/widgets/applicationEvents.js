import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../auth/apiClient';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, ButtonDropdown, Table, StatusIndicator, Box, Spinner, TextFilter, SpaceBetween, Link } from '@cloudscape-design/components';
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
      const base = 'NWAC review submitted';
      return ensureSentence(reviewer ? `${base} by ${reviewer}` : base);
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

  const caseId = caseData?.id || caseData?.case_id || null;

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    apiFetch('/api/cases/' + caseId + '/events')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch events');
        return res.json();
      })
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setError('Failed to load events'))
      .finally(() => setLoading(false));
  }, [caseId]);

  const decoratedEvents = useMemo(() => events.map(decorateEvent), [events]);

  const filteredEvents = decoratedEvents.filter(item => {
    if (!filteringText) return true;
    const text = filteringText.toLowerCase();
    const parts = [
      item.created_at ? new Date(item.created_at).toLocaleString().toLowerCase() : '',
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
      cell: item => new Date(item.created_at).toLocaleString()
    },
    {
      id: 'type',
      header: 'Event Type',
      cell: item => <StatusIndicator type={item.alert_variant || 'info'}>{item.event_type_label || item.event_type}</StatusIndicator>
    },
    {
      id: 'data',
      header: 'Event Data',
      cell: item => item.displayMessage || ''
    },
    {
      id: 'actor',
      header: 'Actor',
      cell: item => item.actorDisplay || ''
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: () => ''
    }
  ];

  const currentSortingColumn = columnDefinitions.find(
    col => col.sortingField === sortingColumn.sortingField
  ) || columnDefinitions[0];

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (currentSortingColumn.sortingField === 'created_at') {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      if (aTime === bTime) return 0;
      return isDescending ? bTime - aTime : aTime - bTime;
    }
    return 0;
  });

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
        >
          Events
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
