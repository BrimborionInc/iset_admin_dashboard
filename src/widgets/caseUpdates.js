import React, { useEffect, useState } from 'react';
import {
  Box,
  Header,
  ButtonDropdown,
  Spinner,
  Table,
  Link,
  StatusIndicator,
  Button,
  Toggle
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const CaseUpdates = ({ actions }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortingState, setSortingState] = useState({ sortingColumn: null, isDescending: false });
  const [showReadUpdates, setShowReadUpdates] = useState(false); // Default toggle off (show unread updates only)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/case-events?limit=20`);
        const data = await response.json();
        setEvents(data);
      } catch (error) {
        console.error('Error fetching case events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  useEffect(() => {
    const savedShowReadUpdates = localStorage.getItem('showReadUpdates');
    if (savedShowReadUpdates !== null) {
      setShowReadUpdates(savedShowReadUpdates === 'true'); // Load preference from localStorage
    }
  }, []);

  const handleToggleReadUpdates = (checked) => {
    setShowReadUpdates(checked);
    localStorage.setItem('showReadUpdates', checked); // Save preference to localStorage
  };

  const columnDefinitions = [
    {
      id: 'description',
      header: 'Description',
      cell: (item) => {
        const data = item.event_data || {};
        const icon = <StatusIndicator type={item.alert_variant || 'info'} />;
        let text = '';
        switch (item.event_type) {
          case 'case_reassigned':
            text = `Case reassigned to you from user ${data.from_user_id}`;
            break;
          case 'document_uploaded':
            text = `Document uploaded: ${data.file_name}`;
            break;
          case 'note_added':
            text = `New note added: \"${data.note_preview}"`;
            break;
          case 'status_changed':
            text = `Status changed from ${data.from} to ${data.to}`;
            break;
          case 'followup_due':
            text = `Follow-up due: ${data.summary}`;
            break;
          default:
            text = item.label || 'Case activity update';
        }
        return (
          <Box display="inline" alignItems="center">
            {icon}
            <Box
              display="inline"
              margin={{ left: 'xs' }}
              fontWeight={item.is_read === 0 ? 'bold' : 'normal'} // Bold for unread
            >
              {text}
            </Box>
          </Box>
        );
      },
      sortingField: 'event_type',
      width: 350 
        },
    {
      id: 'tracking_id',
      header: 'Ref #',
      cell: (item) => <Link href={`/case/${item.case_id}`}>{item.tracking_id}</Link>,
      sortingField: 'tracking_id',
      minWidth: 100,
      maxWidth: 100
    },
    {
      id: 'created_at',
      header: 'Date',
      cell: (item) => new Date(item.created_at).toLocaleString(),
      sortingField: 'created_at',
      width: 200, // Set a narrower width
      minWidth: 150 // Ensure a minimum width for readability
    }
  ];

  const filteredEvents = React.useMemo(() => {
    return showReadUpdates
      ? events
      : events.filter((event) => event.is_read === 0); // Reverse logic for toggle
  }, [events, showReadUpdates]);

  const sortedEvents = React.useMemo(() => {
    const { sortingColumn, isDescending } = sortingState;
    if (!sortingColumn || !sortingColumn.sortingField) return filteredEvents;

    return [...filteredEvents].sort((a, b) => {
      const field = sortingColumn.sortingField;
      const aValue = a[field];
      const bValue = b[field];

      if (aValue < bValue) return isDescending ? 1 : -1;
      if (aValue > bValue) return isDescending ? -1 : 1;
      return 0;
    });
  }, [filteredEvents, sortingState]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          actions={
            <Toggle
              checked={showReadUpdates}
              onChange={({ detail }) => handleToggleReadUpdates(detail.checked)}
            >
              {showReadUpdates ? 'Show Read Updates' : 'Show Read Updates'}
            </Toggle>
          }
        >
          Case Updates
        </Header>
      }
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
          onItemClick={() => actions.removeItem()}
        />
      }
    >
      <Box padding={{ top: 's' }}>
        {loading ? <Spinner /> : sortedEvents.length === 0 ? (
          <Box color="text-status-inactive">No recent updates</Box>
        ) : (
          <Table
            items={sortedEvents}
            columnDefinitions={columnDefinitions}
            loading={loading}
            loadingText="Loading updates"
            variant="embedded"
            stickyHeader
            resizableColumns
            sortingDisabled={false}
            sortingColumn={sortingState.sortingColumn}
            sortingDescending={sortingState.isDescending}
            onSortingChange={({ detail }) => setSortingState({
              sortingColumn: detail.sortingColumn,
              isDescending: detail.isDescending
            })}
            ariaLabels={{
              selectionGroupLabel: 'Case updates',
              allItemsSelectionLabel: () => 'Select all',
              itemSelectionLabel: (data, item) => `Select update for ${item.tracking_id}`
            }}
          />
        )}
      </Box>
    </BoardItem>
  );
};

export default CaseUpdates;
