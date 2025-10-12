import React, { useEffect, useState } from 'react';
import { Box, Header, Button, Alert } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import axios from 'axios';

const AppointmentConfirmed = ({ user, serviceType, slot, bilNumber, groupBooking, bookingReference }) => {
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [serviceName, setServiceName] = useState('');

  useEffect(() => {
    const fetchLocationDetails = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/locations/${slot.location}`);
        setLocationName(response.data.location);
        setLocationAddress(response.data.address);
      } catch (error) {
        console.error('Error fetching location details:', error);
      }
    };

    if (slot.location) {
      fetchLocationDetails();
    }
  }, [slot.location]);

  useEffect(() => {
    const fetchServiceName = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/services`);
        const service = response.data.find(s => s.id === serviceType);
        setServiceName(service ? service.name : `Service Type ${serviceType}`);
      } catch (error) {
        console.error('Error fetching service name:', error);
        setServiceName(`Service Type ${serviceType}`);
      }
    };

    if (serviceType) {
      fetchServiceName();
    }
  }, [serviceType]);

  if (!user) {
    return <Box padding="m" textAlign="center">No user selected</Box>;
  }

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
        >
          Appointment Confirmation
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
    >
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" padding="m">
        <Alert type="success" header="Success">
          The appointment has been successfully booked.  You can view and modify it in the Manage Appointments dashboard.
        </Alert>
        <Box margin={{ top: 'm' }}>
          <p><strong>Applicant:</strong> {user}</p>
          <p><strong>Service Type:</strong> {serviceName}</p>
          <p><strong>Date:</strong> {slot.date}</p>
          <p><strong>Time:</strong> {slot.time}</p>
          <p><strong>Location:</strong> {locationName}</p>
          <p><strong>Address:</strong> {locationAddress}</p>
          {serviceType === 1 && (
            <p><strong>BIL Reference:</strong> {bilNumber}</p>
          )}
          <p><strong>Group Booking:</strong> {groupBooking}</p>
          <p><strong>Booking Reference:</strong> {bookingReference}</p>
        </Box>
        <Button variant="primary">Print Confirmation</Button>
      </Box>
    </BoardItem>
  );
};

export default AppointmentConfirmed;