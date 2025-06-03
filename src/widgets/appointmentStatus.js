import React, { useState, useEffect } from 'react';
import { Box, Header, ButtonDropdown, SpaceBetween, Button, Select, Slider } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const AppointmentStatus = ({ actions, appointmentId }) => {
  const [currentStatus, setCurrentStatus] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [options, setOptions] = useState([
    { label: 'Booked', value: 'booked' },
    { label: 'Waiting', value: 'waiting' },
    { label: 'Serving', value: 'serving' },
    { label: 'Package', value: 'package' },
    { label: 'Complete', value: 'complete' },
  ]);

  useEffect(() => {
    // Fetch the current status of the appointment
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/appointments/${appointmentId}`)
      .then(response => response.json())
      .then(data => {
        setCurrentStatus(data.status);
        setNewStatus(data.status);
      })
      .catch(error => console.error('Error fetching appointment status:', error));
  }, [appointmentId]);

  const handleSave = () => {
    // Save the updated status
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/appointments/${appointmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(response => response.json())
      .then(data => {
        console.log('Status updated:', data);
        if (newStatus === 'serving') {
          // Update the service_start_time and status in the queue table
          fetch(`${process.env.REACT_APP_API_BASE_URL}/api/queue`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ appointmentId, service_start_time: new Date().toISOString(), status: newStatus }),
          })
            .then(response => response.json())
            .then(data => console.log('Service start time and status updated:', data))
            .catch(error => console.error('Error updating service start time and status:', error));
        } else if (newStatus === 'package' || newStatus === 'complete') {
          // Update the service_end_time and status in the queue table
          fetch(`${process.env.REACT_APP_API_BASE_URL}/api/queue`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ appointmentId, service_end_time: new Date().toISOString(), status: newStatus }),
          })
            .then(response => response.json())
            .then(data => console.log('Service end time and status updated:', data))
            .catch(error => console.error('Error updating service end time and status:', error));
        } else if (newStatus === 'booked') {
          // Delete the record from the queue table
          fetch(`${process.env.REACT_APP_API_BASE_URL}/api/queue/${appointmentId}`, {
            method: 'DELETE',
          })
            .then(response => response.json())
            .then(data => console.log('Queue record deleted:', data))
            .catch(error => console.error('Error deleting queue record:', error));
        }
        setCurrentStatus(newStatus);
      })
      .catch(error => console.error('Error updating status:', error));
  };

  const handleCancel = () => {
    // Reset the status to the original value
    setNewStatus(currentStatus);
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleSave}>Save</Button>
              <Button variant="link" onClick={handleCancel}>Cancel</Button>
            </SpaceBetween>
          }
        >
          Testing Queue Management
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
      <Box>
        <SpaceBetween size="m">
          <Select
            selectedOption={options.find(option => option.value === newStatus)}
            onChange={({ detail }) => setNewStatus(detail.selectedOption.value)}
            options={options}
            placeholder="Select status"
          />
          <Slider
            value={options.findIndex(option => option.value === newStatus)}
            onChange={({ detail }) => setNewStatus(options[detail.value].value)}
            min={0}
            max={options.length - 1}
            step={1}
            tickMarks
            referenceValues={[1, 2, 3]}
            valueFormatter={value => options[value]?.label || ''}
            ariaDescription="Status slider"
          />
        </SpaceBetween>
        <Box>
          <Header variant="h3">Current Status: {currentStatus}</Header>
          <Header variant="h3">New Status: {newStatus}</Header>
        </Box>
      </Box>
    </BoardItem>
  );
};

export default AppointmentStatus;
