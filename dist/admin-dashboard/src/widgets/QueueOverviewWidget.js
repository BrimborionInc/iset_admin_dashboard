import React, { useState, useEffect } from 'react';
import { Header, ButtonDropdown, Link, Table, Alert, Box, SpaceBetween } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import QueueOverviewHelp from '../helpPanelContents/QueueOverviewHelp';

const QueueOverviewWidget = ({ toggleHelpPanel, refreshTrigger }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [queueSummary, setQueueSummary] = useState([]);

  const fetchQueueSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/queue/summary?locationId=1`);
      if (!response.ok) {
        throw new Error('Failed to fetch queue summary.');
      }
      const data = await response.json();
      setQueueSummary(data);
    } catch (err) {
      setError('Error loading queue summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueSummary();
  }, [refreshTrigger]); // Refresh when the trigger changes

  return (
    <BoardItem
      header={
        <Header
          description="Get an overview of the current queue."
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel(<QueueOverviewHelp />, "Queue Overview Help")}
            >
              Info
            </Link>
          }
        >
          Queue Overview
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
        />
      }
    >
      <SpaceBetween size="m">
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box>Loading...</Box>
        ) : (
          <Table
            columnDefinitions={[
              { id: 'prefix', header: 'Prefix', cell: item => item.prefix },
              { id: 'label', header: 'Label', cell: item => item.label },
              { id: 'waiting', header: 'Waiting', cell: item => item.waiting },
              { id: 'called', header: 'Called', cell: item => item.called },
              { id: 'serving', header: 'Serving', cell: item => item.serving },
              { id: 'averageWaitMinutes', header: 'Avg Wait (min)', cell: item => item.averageWaitMinutes },
              { id: 'longestWaitingTicket', header: 'Longest-waiting Ticket', cell: item => item.longestWaitingTicket },
            ]}
            items={queueSummary}
            loadingText="Loading queue summary..."
            empty={
              <Box textAlign="center" color="inherit">
                <b>No data available</b>
              </Box>
            }
            header={<Box>Queue Summary</Box>}
          />
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default QueueOverviewWidget;
