import React, { useState, useEffect } from 'react';
import {
  Table,
  SpaceBetween,
  Box,
  Header,
  Button,
  Input,
  Flashbar,
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const HolidayClosures = ({ locationId }) => {
  const [holidayClosures, setHolidayClosures] = useState([]);
  const [initialHolidayClosures, setInitialHolidayClosures] = useState([]);
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
        setHolidayClosures(data.holidayClosures);
        setInitialHolidayClosures(data.holidayClosures);
        console.log('Holiday Closures:', data.holidayClosures); // Add console log
      })
      .catch(error => {
        console.error('Error fetching holiday closures:', error);
        // Log the full response for debugging
        fetch(`${process.env.REACT_APP_API_BASE_URL}/api/operating-hours/${locationId}`)
          .then(response => response.text())
          .then(text => console.log('Full response:', text));
      });
  }, [locationId]);

  const handleSave = () => {
    const formattedHolidayClosures = holidayClosures.map(closure => ({
      ...closure,
      date: closure.date.split('T')[0], // Format date to YYYY-MM-DD
    }));

    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/holiday-closures/${locationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formattedHolidayClosures),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setHolidayClosures(data.holidayClosures);
        setInitialHolidayClosures(data.holidayClosures);
        setIsChanged(false);
        setFlashMessages([{ type: 'success', content: 'Holiday closures saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.log('Holiday closures saved successfully:', data);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error saving holiday closures', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error saving holiday closures:', error);
      });
  };

  const handleCancel = () => {
    setHolidayClosures(initialHolidayClosures);
    setIsChanged(false);
  };

  const handleInputChange = (id, field, value) => {
    setHolidayClosures(prevClosures => {
      const updatedClosures = prevClosures.map(closure =>
        closure.id === id ? { ...closure, [field]: value } : closure
      );
      setIsChanged(JSON.stringify(updatedClosures) !== JSON.stringify(initialHolidayClosures));
      return updatedClosures;
    });
  };

  const handleAddHoliday = () => {
    const newHoliday = {
      id: Date.now(), // Temporary ID for the new holiday
      date: '',
      holidayName: ''
    };
    setHolidayClosures([...holidayClosures, newHoliday]);
    setIsChanged(true);
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
          description="Holiday closures for the location"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
              <Button variant="link" onClick={handleCancel}>Cancel</Button>
            </SpaceBetween>
          }
        >
          Holiday Closures
        </Header>
      }
    >
      <Flashbar items={flashMessages} />
      <Box margin={{ bottom: 's' }} /> {/* Add small space after Flashbar */}
      <Box padding="0">
        <Table
          columnDefinitions={[
            {
              id: 'date',
              header: 'Date',
              cell: item => (
                <Input
                  type="date"
                  value={item.date.split('T')[0]} // Ensure date is in YYYY-MM-DD format
                  onChange={e => handleInputChange(item.id, 'date', e.detail.value)}
                />
              ),
            },
            {
              id: 'holidayName',
              header: 'Holiday Name',
              cell: item => (
                <Input
                  value={item.holidayName}
                  onChange={e => handleInputChange(item.id, 'holidayName', e.detail.value)}
                />
              ),
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="inline-link"
                    ariaLabel={`Delete ${item.holidayName}`}
                    onClick={() => {
                      const updatedClosures = holidayClosures.filter(i => i.id !== item.id);
                      setHolidayClosures(updatedClosures);
                      setIsChanged(JSON.stringify(updatedClosures) !== JSON.stringify(initialHolidayClosures));
                    }}
                  >
                    Delete
                  </Button>
                </SpaceBetween>
              ),
            },
          ]}
          items={holidayClosures}
          empty={
            <b>No resources</b>
          }
          footer={
            <Box>
              <Button onClick={handleAddHoliday}>Add Holiday</Button>
            </Box>
          }
        />
      </Box>
    </BoardItem>
  );
};

export default HolidayClosures;
