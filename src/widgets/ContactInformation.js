import React, { useState, useEffect } from 'react';
import { Form, FormField, Input, Grid, SpaceBetween, Header, Button, Flashbar, Box } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const ContactInformation = ({ ptma }) => {
  const [ptmaData, setPtmaData] = useState(ptma || {});
  const [initialPtma, setInitialPtma] = useState(ptma || {});
  const [flashMessages, setFlashMessages] = useState([]);
  const [isChanged, setIsChanged] = useState(false);

  useEffect(() => {
    if (ptma) {
      setPtmaData(ptma);
      setInitialPtma(ptma);
    }
  }, [ptma]);

  const handleSave = () => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/ptmas/${ptmaData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ptmaData),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setPtmaData(data);
        setInitialPtma(data);
        setIsChanged(false);
        setFlashMessages([{ type: 'success', content: 'Contact information saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error saving contact information', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error saving contact information:', error);
      });
  };

  const handleCancel = () => {
    setPtmaData(initialPtma);
    setIsChanged(false);
  };

  const handleChange = (field, value) => {
    setPtmaData(prevPtma => {
      const updatedPtma = { ...prevPtma, [field]: value };
      setIsChanged(JSON.stringify(updatedPtma) !== JSON.stringify(initialPtma));
      return updatedPtma;
    });
  };

  return (
    <BoardItem
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.'
      }}
      header={
        <Header
          description="Contact information for this PTMA"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
              <Button variant="link" onClick={handleCancel} disabled={!isChanged}>Cancel</Button>
            </SpaceBetween>
          }
        >
          Contact Information
        </Header>
      }
    >
      <Flashbar items={flashMessages} />
      <Box margin={{ bottom: 's' }} /> {/* Add small space after Flashbar */}
      <Form>
        <Grid
          gridDefinition={[
            { colspan: 6 },
            { colspan: 6 },
            { colspan: 6 },
            { colspan: 6 },
            { colspan: 12 },
          ]}
        >
          <FormField label="Contact Name">
            <Input
              value={ptmaData.contact_name || ''}
              onChange={e => handleChange('contact_name', e.detail.value)}
            />
          </FormField>
          <FormField label="Contact Email">
            <Input
              value={ptmaData.contact_email || ''}
              onChange={e => handleChange('contact_email', e.detail.value)}
            />
          </FormField>
          <FormField label="Contact Phone">
            <Input
              value={ptmaData.contact_phone || ''}
              onChange={e => handleChange('contact_phone', e.detail.value)}
            />
          </FormField>
          <FormField label="Notes">
            <Input
              value={ptmaData.contact_notes || ''}
              onChange={e => handleChange('contact_notes', e.detail.value)}
            />
          </FormField>
        </Grid>
      </Form>
    </BoardItem>
  );
};

export default ContactInformation;
