import React, { useEffect, useState } from 'react';
import { apiFetch } from '../auth/apiClient';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, ButtonDropdown, Table, StatusIndicator, Box, Spinner, TextFilter, SpaceBetween } from '@cloudscape-design/components';

const ApplicationEvents = ({ actions, application_id, caseData, user_id: propUserId }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filteringText, setFilteringText] = useState('');
  const [sortingColumn, setSortingColumn] = useState({ sortingField: 'created_at' });
  const [isDescending, setIsDescending] = useState(true);

  // Prefer explicit user_id prop, else from caseData, else null
  const userId = propUserId || caseData?.user_id || caseData?.applicant_user_id || null;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    apiFetch(`/api/case-events?user_id=${userId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch events');
        return res.json();
      })
      .then(data => setEvents(data))
      .catch(() => setError('Failed to load events'))
      .finally(() => setLoading(false));
  }, [userId]);

  // Filtering logic: match any column (date, type, data, user)
  const filteredEvents = events.filter(item => {
    if (!filteringText) return true;
    const text = filteringText.toLowerCase();
    return (
      (item.created_at && new Date(item.created_at).toLocaleString().toLowerCase().includes(text)) ||
      (item.event_type_label && item.event_type_label.toLowerCase().includes(text)) ||
      (item.event_type && item.event_type.toLowerCase().includes(text)) ||
      (item.event_data?.message && item.event_data.message.toLowerCase().includes(text)) ||
      (item.user_name && item.user_name.toLowerCase().includes(text))
    );
  });

  // Cloudscape Table expects sortingColumn to be the full column definition, not just { sortingField }
  // We'll define the column definitions outside the render so we can reference them
  const columnDefinitions = [
    {
      id: 'date',
      header: 'Date/Time',
      sortingField: 'created_at',
      cell: item => new Date(item.created_at).toLocaleString(),
    },
    {
      id: 'type',
      header: 'Event Type',
      cell: item => <StatusIndicator type={item.alert_variant || 'info'}>{item.event_type_label || item.event_type}</StatusIndicator>,
    },
    {
      id: 'data',
      header: 'Event Data',
      cell: item => item.event_data?.message || '',
    },
    {
      id: 'user',
      header: 'Applicant Name',
      cell: item => item.user_name,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: () => '',
    },
  ];

  // Find the current sorting column definition
  const currentSortingColumn = columnDefinitions.find(
    col => col.sortingField === sortingColumn.sortingField
  ) || columnDefinitions[0];

  // Sort filteredEvents by created_at if sortingColumn is set
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
      header={<Header variant="h2">Events</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
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
        This widget displays a timeline of key events and actions related to the applicant’s case, including status changes, messages, and other important updates.
      </Box>
      {loading ? (
        <Box textAlign="center" padding="m"><Spinner /> Loading events…</Box>
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
                    isSortedDescending: isDescending,
                  }
                : col
            )}
            items={sortedEvents}
            sortingColumn={currentSortingColumn}
            sortingDescending={isDescending}
            onSortingChange={({ detail }) => {
              // If the same column is clicked, toggle direction. Otherwise, set to descending by default.
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
