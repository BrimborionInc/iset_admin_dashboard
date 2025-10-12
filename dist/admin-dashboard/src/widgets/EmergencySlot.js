import React, { useState } from 'react';
import {
  BoardItem,
} from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Button,
  Input,
  Select,
  Multiselect,
  Checkbox,
  Flashbar,
  Box,
  Form,
  FormField,
  Grid
} from '@cloudscape-design/components';

const EmergencySlotWidget = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [quota, setQuota] = useState('4'); // Hardcoded value for demo
  const [days, setDays] = useState([
    { label: 'Monday', value: 'Monday' },
    { label: 'Tuesday', value: 'Tuesday' },
    { label: 'Wednesday', value: 'Wednesday' },
    { label: 'Thursday', value: 'Thursday' },
    { label: 'Friday', value: 'Friday' },
  ]); // Hardcoded value for demo
  const [releasePolicy, setReleasePolicy] = useState('1h'); // Hardcoded value for demo
  const [flashMessages, setFlashMessages] = useState([]);

  const dayOptions = [
    { label: 'Monday', value: 'Monday' },
    { label: 'Tuesday', value: 'Tuesday' },
    { label: 'Wednesday', value: 'Wednesday' },
    { label: 'Thursday', value: 'Thursday' },
    { label: 'Friday', value: 'Friday' },
  ];

  const releaseOptions = [
    { label: '1h', value: '1h' },
    { label: '2h', value: '2h' },
    { label: '3h', value: '3h' },
    { label: '4h', value: '4h' },
    { label: 'Never', value: 'never' },
  ];

  const handleSave = () => {
    setFlashMessages([{
      type: 'success',
      content: 'Emergency slot configuration saved.',
      dismissible: true,
      onDismiss: () => setFlashMessages([]),
    }]);
  };

  const handleCancel = () => {
    setIsEnabled(false);
    setQuota('4'); // Reset to hardcoded value
    setDays(dayOptions); // Reset to hardcoded value
    setReleasePolicy('1h'); // Reset to hardcoded value
    setFlashMessages([]);
  };

  const handleReleaseNow = () => {
    setFlashMessages([{
      type: 'info',
      content: 'Emergency slots released now.',
      dismissible: true,
      onDismiss: () => setFlashMessages([]),
    }]);
  };

  return (
    <BoardItem
      header={
        <Header
          description="Configure emergency slot holdbacks for this location"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleSave}>Save</Button>
              <Button variant="link" onClick={handleCancel}>Cancel</Button>
            </SpaceBetween>
          }
        >
          Emergency Slots
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.',
      }}
    >
      <Flashbar items={flashMessages} />
      <Box margin={{ bottom: 's' }} />
      <Form>
        <SpaceBetween size="m">
          <Checkbox
            checked={isEnabled}
            onChange={({ detail }) => setIsEnabled(detail.checked)}
          >
            Enable emergency slot holdback
          </Checkbox>
          <FormField label="Select Applicable Days">
            <Box width="100%">
              <Multiselect
                selectedOptions={days}
                onChange={({ detail }) => setDays(detail.selectedOptions)}
                options={dayOptions}
                placeholder="Select days"
              />
            </Box>
          </FormField>
          <Grid
            gridDefinition={[
              { colspan: 4 },
              { colspan: 4 },
              { colspan: 4 },
            ]}
          >
            <FormField label="Slots per Day">
              <Input
                type="number"
                value={quota}
                onChange={({ detail }) => setQuota(detail.value)}
              />
            </FormField>
            <FormField label="Release After">
              <Select
                selectedOption={releasePolicy}
                onChange={({ detail }) => setReleasePolicy(detail.selectedOption.value)}
                options={releaseOptions}
              />
            </FormField>
            <FormField label=" ">
              <Button onClick={handleReleaseNow}>Release Now</Button>
            </FormField>
          </Grid>
        </SpaceBetween>
      </Form>
    </BoardItem>
  );
};

export default EmergencySlotWidget;
