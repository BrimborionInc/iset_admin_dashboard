import React, { useState, useEffect } from 'react';
import {
  Table,
  SpaceBetween,
  Box,
  Header,
  Button,
  TimeInput,
  Flashbar,
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const OperatingHours = ({ locationId }) => {
  const [operatingHours, setOperatingHours] = useState([]);
  const [initialOperatingHours, setInitialOperatingHours] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [isChanged, setIsChanged] = useState(false);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/operating-hours/${locationId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setOperatingHours(data.operatingHours);
        setInitialOperatingHours(data.operatingHours);
        console.log('Operating Hours:', data.operatingHours); // Add console log
      })
      .catch(error => {
        console.error('Error fetching operating hours:', error);
        // Log the full response for debugging
        fetch(`${process.env.REACT_APP_API_BASE_URL}/api/operating-hours/${locationId}`)
          .then(response => response.text())
          .then(text => console.log('Full response:', text));
      });
  }, [locationId]);

  const handleSave = () => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/operating-hours/${locationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(operatingHours),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setOperatingHours(data.operatingHours);
        setInitialOperatingHours(data.operatingHours);
        setIsChanged(false);
        setFlashMessages([{ type: 'success', content: 'Operating hours saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.log('Operating hours saved successfully:', data);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error saving operating hours', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error saving operating hours:', error);
      });
  };

  const handleCancel = () => {
    setOperatingHours(initialOperatingHours);
    setIsChanged(false);
  };

  const handleTimeChange = (day, field, value) => {
    setOperatingHours(prevHours => {
      const updatedHours = prevHours.map(hour =>
        hour.day_of_week === day ? { ...hour, [field]: value } : hour
      );
      setIsChanged(JSON.stringify(updatedHours) !== JSON.stringify(initialOperatingHours));
      return updatedHours;
    });
  };

  return (
    <BoardItem
      i18nStrings={{
        dragHandleAriaLabel: "Drag handle",
        dragHandleAriaDescription: "Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.",
        resizeHandleAriaLabel: "Resize handle",
        resizeHandleAriaDescription: "Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard."
      }}
      header={
        <Header
          description="Operating hours for the location at the local time"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
              <Button variant="link" onClick={handleCancel}>Cancel</Button>
            </SpaceBetween>
          }
        >
          Operating Hours
        </Header>
      }
    >
      <Flashbar items={flashMessages} />
      <Box margin={{ bottom: 's' }} /> {/* Add small space after Flashbar */}
      <Box padding="0">
        <Table
          columnDefinitions={[
            {
              id: 'day',
              header: 'Day',
              cell: item => item.day_of_week,
            },
            {
              id: 'open',
              header: 'Open Time',
              cell: item => (
                <TimeInput
                  value={item.open_time}
                  onChange={e => handleTimeChange(item.day_of_week, 'open_time', e.detail.value)}
                />
              ),
            },
            {
              id: 'close',
              header: 'Close Time',
              cell: item => (
                <TimeInput
                  value={item.close_time}
                  onChange={e => handleTimeChange(item.day_of_week, 'close_time', e.detail.value)}
                />
              ),
            },
          ]}
          items={operatingHours}
        />
      </Box>
    </BoardItem>
  );
};

export default OperatingHours;
