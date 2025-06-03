import React, { useEffect, useState } from 'react';
import {
  Box,
  Header,
  ButtonDropdown,
  Spinner,
  Table,
  Button,
  StatusIndicator,
  Link
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

// Map priority to StatusIndicator variants
const priorityVariant = {
  high: 'error',    // red emphasis for urgent
  medium: 'warning',
  low: 'success'
};

const CaseTasks = ({ actions }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch open tasks
  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Mark task complete
  const completeTask = async (taskId) => {
    try {
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/tasks/${taskId}/complete`, { method: 'PUT' });
      loadTasks();
    } catch (err) {
      console.error('Error completing task:', err);
    }
  };

  const formatDueDate = (dueDate, priority) => {
    if (!dueDate) {
      return priority === 'high' ? 'ASAP' : '—';
    }

    const date = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString(); // Format as MM/DD/YYYY or localized format
    }
  };

  const sortTasks = (tasks) => {
    return [...tasks].sort((a, b) => {
      const priorityOrder = { ASAP: 1, Today: 2, Tomorrow: 3, default: 4 };

      const aDueDate = formatDueDate(a.due_date, a.priority);
      const bDueDate = formatDueDate(b.due_date, b.priority);

      const aOrder = priorityOrder[aDueDate] || priorityOrder.default;
      const bOrder = priorityOrder[bDueDate] || priorityOrder.default;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      const aDate = new Date(a.due_date || 0);
      const bDate = new Date(b.due_date || 0);
      return aDate - bDate;
    });
  };

  const columnDefinitions = [
    {
      id: 'title',
      header: 'Title',
      cell: item => (
        <Box>
          <Box>
            {item.title}
            {item.tracking_id && (
              <Box display="inline" margin={{ left: 'xs' }}>
                <Link href={`/case/${item.case_id}`}>[{item.tracking_id}]</Link>
              </Box>
            )}
          </Box>
          <Box color="text-body-secondary" fontSize="body-s">
            {item.description}
          </Box>
        </Box>
      ),
      sortingField: 'title',
      width: 350 
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: item => formatDueDate(item.due_date, item.priority),
      sortingField: 'due_date',
      width: 120
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: item => (
        <Button
          variant="inline-link"
          onClick={() => completeTask(item.id)}
          ariaLabel={`Close task ${item.title}`}
        >
          Complete
        </Button>
      )
    }
  ];

  const sortedTasks = React.useMemo(() => sortTasks(tasks), [tasks]);

  return (
    <BoardItem
      header={<Header variant="h2">My Tasks & Reminders</Header>}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions.removeItem()}
        />
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
    >
      <Box padding={{ top: 's' }}>
        {loading ? (
          <Spinner />
        ) : (
          <Table
            items={sortedTasks}
            columnDefinitions={columnDefinitions}
            loading={loading}
            loadingText="Loading tasks"
            variant="embedded"
            stickyHeader
            resizableColumns
            sortingDisabled // Disable manual sorting
          />
        )}
      </Box>
    </BoardItem>
  );
};

export default CaseTasks;
