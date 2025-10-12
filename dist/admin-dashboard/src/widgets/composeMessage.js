import React, { useState, useEffect } from 'react';
import { apiFetch } from '../auth/apiClient';
import { Box, Header, ButtonDropdown, FormField, Input, Textarea, Button, SpaceBetween, Multiselect, Alert } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const ComposeMessageWidget = ({ actions, onSend, recipient }) => {
  const [recipientInput, setRecipientInput] = useState(recipient || []); // Use recipient prop as initial value
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [options, setOptions] = useState(recipient || []); // Initialize options with recipient
  const [alertMessage, setAlertMessage] = useState(null); // State for alert message
  const [isFormComplete, setIsFormComplete] = useState(false); // State for form completeness
  const [isMessageSent, setIsMessageSent] = useState(false); // State to track if message is sent

  useEffect(() => {
    if (recipient) {
      setRecipientInput(recipient); // Update recipient input when recipient prop changes
      setOptions(recipient); // Update options when recipient prop changes
    }
  }, [recipient]);

  useEffect(() => {
    setIsFormComplete(recipientInput.length > 0 && subject && body);
  }, [recipientInput, subject, body]);

  const handleSend = async () => {
    if (!isFormComplete) return;

    try {
      const response = await apiFetch(`/api/admin/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender_id: 8, // Hardwire currentUserId to be user 8 NWAC.
          recipient_id: recipientInput.map(r => r.value), // Ensure recipient_id is an array of user IDs
          subject,
          body,
          urgent,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAlertMessage({ type: 'success', content: 'Message sent successfully', dismissible: true });
      setIsMessageSent(true); // Set message sent state to true
      console.log('Message sent successfully:', data);
    } catch (error) {
      setAlertMessage({ type: 'error', content: 'Error sending message', dismissible: true });
      console.error('Error sending message:', error);
    }
  };

  const handleRecipientChange = ({ detail }) => {
    const newSelection = detail.selectedOptions.filter(option => option.label && option.value); // Prevent empty values
    console.log('New selection:', newSelection); // Log new selection
    setRecipientInput(newSelection);
    setOptions(prevOptions => {
      const newOptions = newSelection.filter(option => !prevOptions.some(opt => opt.value === option.value));
      console.log('New options:', newOptions); // Log new options
      return [...prevOptions, ...newOptions];
    });
    setIsMessageSent(false); // Reset message sent state
    setAlertMessage(null); // Clear alert message
  };

  const handleSubjectChange = ({ detail }) => {
    setSubject(detail.value);
    setIsMessageSent(false); // Reset message sent state
    setAlertMessage(null); // Clear alert message
  };

  const handleBodyChange = ({ detail }) => {
    setBody(detail.value);
    setIsMessageSent(false); // Reset message sent state
    setAlertMessage(null); // Clear alert message
  };

  const handleSelectUserClick = (user) => {
    if (!user || !user.email || !user.id) {
        console.error('Invalid user object received:', user);
        return;
    }

    console.log('User option:', { label: user.email, value: user.id });

    if (!recipientInput.some(option => option.value === user.id)) {
        setRecipientInput([...recipientInput, { label: user.email, value: user.id }]);
        setOptions([...options, { label: user.email, value: user.id }]); 
    }
};

  useEffect(() => {
    console.log('Recipient input:', recipientInput); // Log recipient input
    console.log('Options:', options); // Log options
  }, [recipientInput, options]);

  return (
    <BoardItem
      header={<Header variant="h2">Compose Message</Header>}
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
      <Box padding={{ vertical: 'm', horizontal: 'l' }}>
        <SpaceBetween size="m">
          {alertMessage && (
            <Alert type={alertMessage.type} onDismiss={() => setAlertMessage(null)}>
              {alertMessage.content}
            </Alert>
          )}
          <FormField label="To">
            <Multiselect
              selectedOptions={recipientInput}
              onChange={handleRecipientChange}
              options={options}
              ariaLabel="Recipients"
              inlineTokens
              placeholder="Enter recipient email"
            />
          </FormField>
          <FormField label="Subject">
            <Input value={subject} onChange={handleSubjectChange} placeholder="Enter subject" />
          </FormField>
          <FormField label="Message">
            <Textarea value={body} onChange={handleBodyChange} placeholder="Enter message body" rows={5} />
          </FormField>
          <FormField>
            <label>
              <input type="checkbox" checked={urgent} onChange={() => setUrgent(!urgent)} /> Mark as Urgent
            </label>
          </FormField>
          {!isMessageSent && (
            <Button variant={isFormComplete ? "primary" : "normal"} onClick={handleSend} disabled={!isFormComplete}>
              Send Message
            </Button>
          )}
        </SpaceBetween>
      </Box>
    </BoardItem>
  );
};

export default ComposeMessageWidget;
