import React, { useState } from 'react';
import { Header, ButtonDropdown, Link, Button, SpaceBetween, Alert, Box, Container, KeyValuePairs } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import CallNextHelp from '../helpPanelContents/CallNextHelp';

const CallNextWidget = ({ toggleHelpPanel, activeUserId, refreshQueueOverview }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [appointmentDetails, setAppointmentDetails] = useState(null); // New state for appointment details

  const handleServeCustomer = async () => {
    if (!activeUserId || !currentTicket) {
      setError('Active user ID and a called ticket are required to serve the customer.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/queue/start-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUserId }),
      });

      if (response.ok) {
        setMessage(`Service started for ticket ${currentTicket.ticketNumber}.`);
        setCurrentTicket(null); // Optionally disable or hide the "Serve Customer" button
        refreshQueueOverview(); // Trigger queue overview refresh
      } else {
        throw new Error('Failed to start service.');
      }
    } catch (err) {
      setError('Failed to start service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCallNext = async () => {
    if (!activeUserId) {
      setError('Active user ID is required to call the next customer.');
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/queue/call-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUserId }),
      });

      if (response.status === 200) {
        const data = await response.json();
        setMessage(`Ticket ${data.ticketNumber} is called to counter ${data.counterName}.`);
        setCurrentTicket(data); // Track the called ticket
        setAppointmentDetails(data.appointment || null); // Save appointment details
        refreshQueueOverview(); // Trigger queue overview refresh
      } else if (response.status === 204) {
        setMessage({ type: 'info', text: 'No customers in the queue.' });
        setAppointmentDetails(null); // Clear appointment details
      } else {
        throw new Error('Unexpected response from the server.');
      }
    } catch (err) {
      setError('Failed to call the next customer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BoardItem
      header={
        <Header
          description="Call the next customer in the queue."
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel(<CallNextHelp />, "Call Next Help")}
            >
              Info
            </Link>
          }
        >
          Call Next
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
        {message && (
          <Alert type={message.type || 'success'} dismissible onDismiss={() => setMessage(null)}>
            {message.text || message}
          </Alert>
        )}
        {loading ? (
          <Box>Loading...</Box>
        ) : (
          <>
            <Button variant="primary" onClick={handleCallNext}>
              Call Next Customer
            </Button>
            {currentTicket && (
              <Button variant="primary" onClick={handleServeCustomer}>
                Serve Customer
              </Button>
            )}
          </>
        )}
        {currentTicket && appointmentDetails && (
          <Container header={<Header>Appointment Details</Header>}>
            <KeyValuePairs
              columns={3} // Use three-column layout
              items={[
                { label: 'Applicant Name', value: appointmentDetails.applicantName || 'N/A' },
                { label: 'Date of Birth', value: appointmentDetails.date_of_birth || 'N/A' },
                { label: 'Gender', value: appointmentDetails.gender || 'N/A' },
                { label: 'BIL Reference', value: appointmentDetails.bilReference || 'N/A' },
                { label: 'Booking Reference', value: appointmentDetails.booking_reference || 'N/A' },
                { label: 'Reason Code ID', value: appointmentDetails.reason_code_id || 'N/A' },
                { label: 'Preferred Language', value: appointmentDetails.preferredLanguage || 'N/A' },
                { label: 'Interpreter Needed', value: appointmentDetails.interpreterNeeded ? 'Yes' : 'No' },
                { label: 'Interpreter Language', value: appointmentDetails.interpreterLanguage || 'N/A' },
                { label: 'Additional Service 1', value: appointmentDetails.additionalService1 || 'N/A' },
                { label: 'Additional Service 2', value: appointmentDetails.additionalService2 || 'N/A' },
                { label: 'Additional Service 3', value: appointmentDetails.additionalService3 || 'N/A' },
                { label: 'Additional Notes', value: appointmentDetails.additionalNotes || 'N/A' },
              ]}
            />
          </Container>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default CallNextWidget;
