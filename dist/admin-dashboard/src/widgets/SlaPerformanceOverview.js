import React, { useContext, useEffect, useState } from 'react';
import { Box, Header, StatusIndicator, ButtonDropdown } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { LocationContext } from '../context/LocationContext';

const SlaPerformanceOverview = ({ actions }) => {
  const { selectedLocation } = useContext(LocationContext);
  const [slaMetrics, setSlaMetrics] = useState([]);

  useEffect(() => {
    // Fetch SLA metrics based on the selected location
    const fetchSlaMetrics = async () => {
      // Replace with actual API call
      const metrics = [
        { name: 'Appointment Availability', value: '95%', status: 'green' },
        { name: 'Queue Time Compliance', value: '88%', status: 'yellow' },
        { name: 'System Uptime', value: '99.9%', status: 'green' },
      ];
      setSlaMetrics(metrics);
    };

    fetchSlaMetrics();
  }, [selectedLocation]);

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'green':
        return <StatusIndicator type="success">Compliant</StatusIndicator>;
      case 'yellow':
        return <StatusIndicator type="warning">Warning</StatusIndicator>;
      case 'red':
        return <StatusIndicator type="error">Breach</StatusIndicator>;
      default:
        return null;
    }
  };

  return (
    <BoardItem
      header={<Header variant="h2">SLA Performance Overview</Header>}
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
      <Box>
        {slaMetrics.map((metric, index) => (
          <Box key={index} margin={{ bottom: 's' }}>
            <Header variant="h3">{metric.name}</Header>
            <Box display="flex" alignItems="center">
              <Box margin={{ right: 's' }}>{metric.value}</Box>
              {getStatusIndicator(metric.status)}
            </Box>
          </Box>
        ))}
      </Box>
    </BoardItem>
  );
};

export default SlaPerformanceOverview;
