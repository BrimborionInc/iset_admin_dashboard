import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Box,
  Link,
  ButtonDropdown,
  Button,
  Container,
  Badge,
  Tabs,
  Table,
  TextFilter
} from '@cloudscape-design/components';
import CaseCalendarHelp from '../helpPanelContents/caseCalendarHelp';
import { useCaseWorkspace } from '../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx';
import { apiFetch } from '../auth/apiClient';

const LIVE_CASES_STORAGE_KEY = 'iset-demo-use-live-cases';

const SAMPLE_EVENTS = [
  {
    offset: 2,
    title: 'Follow-up call',
    category: 'Reminder',
    description: 'Touch base with the applicant about supporting documents.',
    severity: 'success',
    source: 'Demo reminder'
  },
  {
    offset: 7,
    title: 'Finance review due',
    category: 'Deadline',
    description: 'Prepare figures for the upcoming finance approval walkthrough.',
    severity: 'warning',
    source: 'Demo deadline'
  },
  {
    offset: 12,
    title: 'Case inactivity check',
    category: 'Alert',
    description: '14 days without updates; review action plan progress.',
    severity: 'error',
    source: 'Demo alert'
  },
  {
    offset: 19,
    title: 'Schedule NWAC sync',
    category: 'Reminder',
    description: 'Book time with the NWAC reviewer to discuss the latest plan.',
    severity: 'success',
    source: 'Demo reminder'
  },
  {
    offset: 23,
    title: 'Program milestone',
    category: 'Milestone',
    description: 'Kick-off planning for next quarter reporting cycle.',
    severity: 'info',
    source: 'Demo milestone'
  }
];

const EVENT_STYLE = {
  success: {
    dot: 'var(--color-background-status-success, #1d8102)',
    badge: 'green'
  },
  warning: {
    dot: 'var(--color-background-status-warning, #f89256)',
    badge: 'yellow'
  },
  error: {
    dot: 'var(--color-background-status-error, #d13212)',
    badge: 'red'
  },
  info: {
    dot: 'var(--color-background-status-info, #0972d3)',
    badge: 'blue'
  }
};

const SEVERITY_LABEL = {
  success: 'On track',
  warning: 'Due soon',
  error: 'Overdue',
  info: 'Info'
};

const deriveReminderSeverity = (reminder, todayMidnight) => {
  if (!reminder || !reminder.dueAt) return 'info';
  const due = new Date(reminder.dueAt);
  if (Number.isNaN(due.getTime())) return 'info';
  const dueMidnight = new Date(due);
  dueMidnight.setHours(0, 0, 0, 0);
  const diffMs = dueMidnight.getTime() - todayMidnight;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) return 'error';
  if (diffDays <= 7) return 'warning';
  return 'success';
};

const resolveReminderSource = (reminder = {}) => {
  const assigned =
    reminder.assignedTo?.displayName ||
    reminder.assignedTo?.name ||
    reminder.assignedTo?.email ||
    null;
  if (assigned) return assigned;
  const creator =
    reminder.createdBy?.displayName ||
    reminder.createdBy?.name ||
    reminder.createdBy?.email ||
    null;
  if (creator) return `Created by ${creator}`;
  return 'Reminder';
};

const CELL_SIZE = 44;

const getWeekdayLabels = () => {
  const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  const start = new Date(Date.UTC(2024, 0, 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return formatter.format(date);
  });
};

const normalizeDateKey = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildMonthGrid = anchorDate => {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const startDay = firstOfMonth.getDay();
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - startDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const today = new Date();
    return {
      key: date.toISOString(),
      date,
      dateKey: normalizeDateKey(date),
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === anchorDate.getMonth(),
      isToday:
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    };
  });
};

const readLivePreference = () => {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage?.getItem(LIVE_CASES_STORAGE_KEY);
  if (stored === 'false') return false;
  if (stored === 'true') return true;
  return true;
};

const CaseCalendarWidget = ({ actions = {}, toggleHelpPanel, metadata, caseData: propCaseData }) => {
  const workspace = useCaseWorkspace();
  const workspaceCaseData = workspace && typeof workspace === 'object' ? workspace.caseData || null : null;
  const caseData = propCaseData || workspaceCaseData || (metadata && metadata.caseData) || null;

  const [useLiveData, setUseLiveData] = useState(() => readLivePreference());
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [activeTabId, setActiveTabId] = useState('calendar');
  const [tableFilteringText, setTableFilteringText] = useState('');
  const [tableSorting, setTableSorting] = useState({ id: 'date', descending: true });
  const [remindersState, setRemindersState] = useState({ items: [], isLoading: false, error: null });

  const caseId =
    caseData?.id ??
    caseData?.case_id ??
    workspace?.caseId ??
    workspace?.case_id ??
    null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = event => {
      const toggle = event?.detail?.useLiveCases;
      if (typeof toggle === 'boolean') {
        setUseLiveData(toggle);
      }
    };
    window.addEventListener('iset-portfolio:cases-data-mode', handler);
    return () => {
      window.removeEventListener('iset-portfolio:cases-data-mode', handler);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage?.getItem(LIVE_CASES_STORAGE_KEY);
    if (stored === 'false') {
      setUseLiveData(false);
    } else if (stored === 'true') {
      setUseLiveData(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!useLiveData || !caseId) {
      setRemindersState({ items: [], isLoading: false, error: null });
      return () => {
        cancelled = true;
      };
    }
    const fetchReminders = async () => {
      setRemindersState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const response = await apiFetch(`/api/reminders?caseId=${caseId}`);
        if (!response.ok) {
          let message = `Failed to load reminders (${response.status})`;
          try {
            const body = await response.json();
            if (body?.error || body?.message) {
              message = body.error || body.message;
            }
          } catch (_) {
            // ignore parse failures
          }
          throw new Error(message);
        }
        const payload = await response.json();
        if (cancelled) return;
        setRemindersState({
          items: Array.isArray(payload) ? payload : [],
          isLoading: false,
          error: null
        });
      } catch (error) {
        if (cancelled) return;
        setRemindersState({
          items: [],
          isLoading: false,
          error: error?.message || 'Failed to load reminders.'
        });
      }
    };

    fetchReminders();
    return () => {
      cancelled = true;
    };
  }, [useLiveData, caseId]);

  useEffect(() => {
    const handler = event => {
      const targetCaseId = event?.detail?.caseId;
      if (!useLiveData || !caseId || (targetCaseId && Number(targetCaseId) !== Number(caseId))) {
        return;
      }
      // Re-trigger by toggling the state to refetch
      (async () => {
        try {
          const response = await apiFetch(`/api/reminders?caseId=${caseId}`);
          if (!response.ok) throw new Error(`Failed to load reminders (${response.status})`);
          const payload = await response.json();
          setRemindersState({
            items: Array.isArray(payload) ? payload : [],
            isLoading: false,
            error: null
          });
        } catch (error) {
          setRemindersState({
            items: [],
            isLoading: false,
            error: error?.message || 'Failed to load reminders.'
          });
        }
      })();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('case-reminders-refresh', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('case-reminders-refresh', handler);
      }
    };
  }, [caseId, useLiveData]);

  const monthLabel = useMemo(
    () =>
      monthAnchor.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long'
      }),
    [monthAnchor]
  );

  const weekdayLabels = useMemo(() => getWeekdayLabels(), []);

  const offlineEventsMap = useMemo(() => {
    if (useLiveData) return new Map();
    const firstOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const daysInMonth = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth() + 1, 0).getDate();
    return SAMPLE_EVENTS.reduce((map, sample, index) => {
      const dayNumber = Math.min(daysInMonth, Math.max(1, sample.offset));
      const eventDate = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), dayNumber);
      const event = {
        id: `offline-${index}`,
        title: sample.title,
        category: sample.category,
        description: sample.description,
        date: eventDate,
        severity: sample.severity || 'info',
        source: sample.source || 'Demo data'
      };
      const key = normalizeDateKey(eventDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
      return map;
    }, new Map());
  }, [useLiveData, monthAnchor]);

  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const liveEventsMap = useMemo(() => {
    if (!useLiveData) return new Map();
    const map = new Map();

    const addEvent = (dateValue, event) => {
      if (!dateValue) return;
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return;
      const key = normalizeDateKey(date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ ...event, date });
    };

    if (caseData) {
      const actionPlans = Array.isArray(caseData?.actionPlans) ? caseData.actionPlans : [];
      actionPlans.forEach(plan => {
        const planName = plan.title || 'Action plan';
        const startSeverity = (() => {
          if (!plan.startDate) return 'info';
          const ts = new Date(plan.startDate).getTime();
          if (Number.isNaN(ts)) return 'info';
          return ts <= todayMidnight ? 'success' : 'info';
        })();
        const endSeverity = (() => {
          if (!plan.endDate) return 'info';
          const ts = new Date(plan.endDate).getTime();
          if (Number.isNaN(ts)) return 'info';
          if (ts < todayMidnight) return 'error';
          const diffDays = Math.floor((ts - todayMidnight) / 86400000);
          return diffDays <= 7 ? 'warning' : 'info';
        })();

        addEvent(plan.startDate, {
          id: `plan-${plan.id}-start`,
          title: planName,
          category: 'Action plan start',
          description: 'Action plan start date',
          severity: startSeverity,
          source: planName
        });
        addEvent(plan.endDate, {
          id: `plan-${plan.id}-end`,
          title: planName,
          category: 'Action plan end',
          description: 'Action plan end date',
          severity: endSeverity,
          source: planName
        });

        const interventions = Array.isArray(plan.interventions) ? plan.interventions : [];
        interventions.forEach(intervention => {
          const interventionName = intervention.title || 'Intervention';
          const startSeverityIntervention = (() => {
            if (!intervention.startDate) return 'info';
            const ts = new Date(intervention.startDate).getTime();
            if (Number.isNaN(ts)) return 'info';
            return ts <= todayMidnight ? 'success' : 'info';
          })();
          const endSeverityIntervention = (() => {
            if (!intervention.endDate) return 'info';
            const ts = new Date(intervention.endDate).getTime();
            if (Number.isNaN(ts)) return 'info';
            if (ts < todayMidnight) return 'error';
            const diffDays = Math.floor((ts - todayMidnight) / 86400000);
            return diffDays <= 7 ? 'warning' : 'info';
          })();

          const interventionSource = `${planName} / ${interventionName}`;
          addEvent(intervention.startDate, {
            id: `intervention-${intervention.id}-start`,
            title: interventionName,
            category: 'Intervention start',
            description: 'Intervention start date',
            severity: startSeverityIntervention,
            source: interventionSource
          });
          addEvent(intervention.endDate, {
            id: `intervention-${intervention.id}-end`,
            title: interventionName,
            category: 'Intervention end',
            description: 'Intervention end date',
            severity: endSeverityIntervention,
            source: interventionSource
          });
        });
      });
    }

    const reminders = Array.isArray(remindersState.items) ? remindersState.items : [];
    reminders.forEach(reminder => {
      if (!reminder?.dueAt || reminder.status === 'cancelled') return;
      const severity = deriveReminderSeverity(reminder, todayMidnight);
      addEvent(reminder.dueAt, {
        id: `reminder-${reminder.id}`,
        title: reminder.title || 'Reminder',
        category: reminder.category || 'Reminder',
        description: reminder.description || '',
        severity,
        source: resolveReminderSource(reminder),
        reminderId: reminder.id,
        reminderStatus: reminder.status || null
      });
    });

    return map;
  }, [useLiveData, caseData, todayMidnight, remindersState.items]);

  const days = useMemo(() => {
    const eventsMap = useLiveData ? liveEventsMap : offlineEventsMap;
    return buildMonthGrid(monthAnchor).map(day => ({
      ...day,
      events: eventsMap.get(day.dateKey) || []
    }));
  }, [monthAnchor, useLiveData, liveEventsMap, offlineEventsMap]);

  useEffect(() => {
    if (useLiveData) {
      setSelectedDayKey(prev => (prev && days.some(day => day.key === prev) ? prev : null));
      return;
    }
    const selectedHasEvents =
      selectedDayKey && days.some(day => day.key === selectedDayKey && day.events.length > 0);
    if (!selectedHasEvents) {
      const firstWithEvents = days.find(day => day.events.length > 0);
      setSelectedDayKey(firstWithEvents ? firstWithEvents.key : null);
    }
  }, [useLiveData, days, selectedDayKey]);

  const selectedDay = selectedDayKey ? days.find(day => day.key === selectedDayKey) : null;

  const adjustMonth = useCallback(delta => {
    setMonthAnchor(prev => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + delta);
      return new Date(next.getFullYear(), next.getMonth(), 1);
    });
  }, []);

  const canAdjustMonth = useCallback(
    delta => {
      if (!useLiveData) return true;
      const today = new Date();
      const limitStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const limitEnd = new Date(today.getFullYear(), today.getMonth() + 2, 1);
      const candidate = new Date(monthAnchor);
      candidate.setMonth(candidate.getMonth() + delta);
      return candidate >= limitStart && candidate < limitEnd;
    },
    [monthAnchor, useLiveData]
  );

  const allEvents = useMemo(() => {
    const eventsMap = useLiveData ? liveEventsMap : offlineEventsMap;
    const items = [];
    eventsMap.forEach(eventList => {
      eventList.forEach(event => {
        const dateObj = event.date instanceof Date ? new Date(event.date) : new Date(event.date);
        if (Number.isNaN(dateObj.getTime())) return;
        const severity = event.severity || 'info';
        items.push({
          ...event,
          date: dateObj,
          severity,
          severityLabel: SEVERITY_LABEL[severity] || 'Info',
          source: event.source || (useLiveData ? 'Case data' : 'Demo data')
        });
      });
    });
    return items;
  }, [useLiveData, liveEventsMap, offlineEventsMap]);

  const filteredEvents = useMemo(() => {
    const term = tableFilteringText.trim().toLowerCase();
    if (!term) return allEvents;
    return allEvents.filter(event =>
      [event.title, event.category, event.description, event.source]
        .filter(Boolean)
        .some(value => value.toLowerCase().includes(term))
    );
  }, [allEvents, tableFilteringText]);

  const sortedEvents = useMemo(() => {
    const items = [...filteredEvents];
    const { id, descending } = tableSorting;
    const compare = (a, b) => {
      switch (id) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
        case 'category':
          return (a.category || '').localeCompare(b.category || '', undefined, { sensitivity: 'base' });
        case 'source':
          return (a.source || '').localeCompare(b.source || '', undefined, { sensitivity: 'base' });
        case 'severity':
          return (a.severityLabel || '').localeCompare(b.severityLabel || '', undefined, { sensitivity: 'base' });
        case 'date':
        default:
          return a.date.getTime() - b.date.getTime();
      }
    };
    items.sort((a, b) => {
      const result = compare(a, b);
      return descending ? -result : result;
    });
    return items;
  }, [filteredEvents, tableSorting]);

  const tableColumnDefinitions = useMemo(
    () => [
      {
        id: 'date',
        header: 'Date',
        cell: item => item.date.toLocaleDateString(),
        sortingField: 'date'
      },
      {
        id: 'title',
        header: 'Title',
        cell: item => item.title || '�',
        sortingField: 'title'
      },
      {
        id: 'category',
        header: 'Category',
        cell: item => item.category || '�',
        sortingField: 'category'
      },
      {
        id: 'severity',
        header: 'Severity',
        cell: item => {
          const style = EVENT_STYLE[item.severity] || EVENT_STYLE.info;
          return <Badge color={style.badge}>{item.severityLabel || 'Info'}</Badge>;
        },
        sortingField: 'severity'
      },
      {
        id: 'source',
        header: 'Source',
        cell: item => item.source || '�',
        sortingField: 'source'
      },
      {
        id: 'description',
        header: 'Description',
        cell: item => item.description || '�'
      }
    ],
    []
  );

  const sortingColumn = tableColumnDefinitions.find(column => column.id === tableSorting.id) || tableColumnDefinitions[0];
  const tableCountText = `${filteredEvents.length} ${filteredEvents.length === 1 ? 'event' : 'events'}`;

  const calendarContent = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px',
        alignItems: 'flex-start'
      }}
    >
      <div
        style={{
          flex: '1 1 360px',
          minWidth: '280px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}
        >
          <Button iconName='angle-left' variant='icon' onClick={() => adjustMonth(-1)} ariaLabel='Previous month' disabled={useLiveData && !canAdjustMonth(-1)} />
          <Box fontSize='heading-m' fontWeight='bold'>
            {monthLabel}
          </Box>
          <Button iconName='angle-right' variant='icon' onClick={() => adjustMonth(1)} ariaLabel='Next month' disabled={useLiveData && !canAdjustMonth(1)} />
        </div>
        <div
          style={{
            border: '1px solid var(--color-border-divider, #d5dbdb)',
            borderRadius: '12px',
            padding: '8px'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              fontWeight: 600,
              color: 'var(--color-text-label-secondary, #414d5c)',
              marginBottom: '4px'
            }}
          >
            {weekdayLabels.map(label => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px'
            }}
          >
            {days.map(day => {
              const isSelected = day.key === selectedDayKey;
              const borderColor = isSelected
                ? 'var(--color-border-status-info, #0972d3)'
                : day.isToday
                  ? 'var(--color-border-highlight, #0972d3)'
                  : 'var(--color-border-divider, #d5dbdb)';
              const backgroundColor = day.isCurrentMonth
                ? 'var(--color-background-container-content, #ffffff)'
                : 'var(--color-background-layout-main, #f2f3f3)';

              return (
                <button
                  key={day.key}
                  type='button'
                  onClick={() => setSelectedDayKey(day.key)}
                  style={{
                    width: '100%',
                    height: `${CELL_SIZE}px`,
                    borderRadius: '8px',
                    border: `1px solid ${borderColor}`,
                    backgroundColor,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: 600,
                    color: day.isCurrentMonth ? 'var(--color-text-label, #1f2933)' : '#6b7280',
                    gap: '3px'
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedDayKey(day.key);
                    }
                  }}
                >
                  <span>{day.dayNumber}</span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    {day.events.slice(0, 3).map(event => {
                      const style = EVENT_STYLE[event.severity] || EVENT_STYLE.info;
                      return (
                        <span
                          key={event.id}
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: style.dot
                          }}
                        />
                      );
                    })}
                    {day.events.length > 3 ? (
                      <span style={{ fontSize: '11px', color: '#475569' }}>+{day.events.length - 3}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div
        style={{
          flex: '1 1 240px',
          minWidth: '220px'
        }}
      >
        <Container header={<Box fontWeight='bold'>Day details</Box>}>
          {selectedDay && selectedDay.events.length > 0 ? (
            <SpaceBetween size='s'>
              {selectedDay.events.map(event => {
                const style = EVENT_STYLE[event.severity] || EVENT_STYLE.info;
                const severityLabel = SEVERITY_LABEL[event.severity] || 'Info';
                return (
                  <Box key={event.id}>
                    <SpaceBetween size='xxs' direction='horizontal' alignItems='center'>
                      <Badge color={style.badge}>{severityLabel}</Badge>
                      <Box fontWeight='bold'>{event.title}</Box>
                    </SpaceBetween>
                    <Box fontSize='body-s' color='text-body-secondary'>
                      {event.category}
                    </Box>
                    <Box fontSize='body-s' color='text-body-secondary'>
                      {event.date.toLocaleDateString()}
                    </Box>
                    <Box fontSize='body-s' color='text-body-secondary'>
                      Source: {event.source || '�'}
                    </Box>
                    <Box fontSize='body-s' color='text-body-secondary'>
                      {event.description}
                    </Box>
                  </Box>
                );
              })}
            </SpaceBetween>
          ) : (
            <Box color='text-body-secondary' fontSize='body-s'>
              {useLiveData
                ? 'Live data mode enabled. Events will appear once reminders are available.'
                : selectedDay
                  ? `No events recorded for ${selectedDay.date.toLocaleDateString()}.`
                  : 'Select a day to view details.'}
            </Box>
          )}
        </Container>
      </div>
    </div>
  );

  const tableContent = (
    <div style={{ display: 'grid', gap: '8px' }}>
      <TextFilter
        filteringText={tableFilteringText}
        countText={tableCountText}
        onChange={({ detail }) => setTableFilteringText(detail.filteringText)}
        filteringPlaceholder='Find events'
      />
      <Table
        trackBy='id'
        columnDefinitions={tableColumnDefinitions}
        items={sortedEvents}
        sortingColumn={sortingColumn}
        sortingDescending={tableSorting.descending}
        onSortingChange={({ detail }) =>
          setTableSorting({ id: detail.sortingColumn.id, descending: detail.isDescending })
        }
        empty={<Box textAlign='center'>No events to display.</Box>}
        stickyHeader
        variant='embedded'
      />
    </div>
  );

  const tabs = [
    { id: 'calendar', label: 'Calendar view', content: calendarContent },
    { id: 'table', label: 'List view', content: tableContent }
  ];

  return (
    <BoardItem
      header={
        <Header
          info={
            toggleHelpPanel ? (
              <Link
                variant='info'
                onFollow={() =>
                  toggleHelpPanel(<CaseCalendarHelp />, 'Case Calendar Help', CaseCalendarHelp.aiContext)
                }
              >
                Info
              </Link>
            ) : undefined
          }
        >
          Case calendar
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription:
          'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription:
          'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        actions?.removeItem ? (
          <ButtonDropdown
            items={[{ id: 'remove', text: 'Remove' }]}
            ariaLabel='Board item settings'
            variant='icon'
            onItemClick={() => actions.removeItem()}
          />
        ) : null
      }
    >
      <SpaceBetween size='m'>
        <Box variant='small' color='text-body-secondary'>
          Review upcoming reminders and deadlines for this case. Switch calendar/list views, and use demo mode to see sample reminders when live data is unavailable.
        </Box>
        {useLiveData && remindersState.error ? (
          <Box color='text-status-warning' fontSize='body-s'>
            Reminders unavailable: {remindersState.error}
          </Box>
        ) : null}
        <Tabs
          activeTabId={activeTabId}
          onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          tabs={tabs}
        />
      </SpaceBetween>
    </BoardItem>
  );
};

export default CaseCalendarWidget;
