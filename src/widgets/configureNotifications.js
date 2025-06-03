import React, { useState, useEffect } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, SpaceBetween, FormField, Input, Select, Toggle, Multiselect } from '@cloudscape-design/components';

const ConfigureNotifications = ({ actions, dragHandleAriaLabel, i18nStrings }) => {
  const [reminderCount, setReminderCount] = useState(3);
  const [intervals, setIntervals] = useState(['7 days', '3 days', '24 hours']);
  const [serviceType, setServiceType] = useState('Regular');
  const [acknowledgmentRequired, setAcknowledgmentRequired] = useState(false);
  const [deliveryMethods, setDeliveryMethods] = useState({
    email: true,
    sms: true,
    roboCall: false,
  });
  const [fallbackBehavior, setFallbackBehavior] = useState('If SMS fails, send email');
  const [fallbackLanguages, setFallbackLanguages] = useState([
    { label: 'English', value: 'English' },
    { label: 'French', value: 'French' }
  ]);

  const serviceTypes = ['Urgent', 'Regular'];
  const fallbackOptions = ['If SMS fails, send email', 'If Email fails, send SMS', 'Do nothing'];
  const languageOptions = [
    { label: 'English', value: 'English' },
    { label: 'French', value: 'French' }
  ];

  useEffect(() => {
    const newIntervals = Array(reminderCount).fill('').map((_, index) => intervals[index] || '');
    setIntervals(newIntervals);
  }, [reminderCount]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          actions={<div />} // Placeholder for any actions
        >
          Configuration
        </Header>
      }
      dragHandleAriaLabel={dragHandleAriaLabel}
      i18nStrings={i18nStrings}
      settings={
        <div /> // Placeholder for any settings
      }
    >
      <SpaceBetween size="l">
        <FormField label="Reminder Count">
          <Input
            type="number"
            value={reminderCount}
            onChange={({ detail }) => setReminderCount(Number(detail.value))}
          />
        </FormField>
        <FormField label="Reminder Intervals">
          {intervals.map((interval, index) => (
            <Input
              key={index}
              value={interval}
              onChange={({ detail }) => {
                const newIntervals = [...intervals];
                newIntervals[index] = detail.value;
                setIntervals(newIntervals);
              }}
            />
          ))}
        </FormField>
        <FormField label="Service Type">
          <Select
            options={serviceTypes.map(type => ({ label: type, value: type }))}
            selectedOption={{ label: serviceType, value: serviceType }}
            onChange={({ detail }) => setServiceType(detail.selectedOption.value)}
          />
        </FormField>
        <FormField label="Acknowledgment Requests">
          <Toggle
            checked={acknowledgmentRequired}
            onChange={({ detail }) => setAcknowledgmentRequired(detail.checked)}
          />
        </FormField>
        <FormField label="Delivery Methods Enabled">
          <Toggle
            checked={deliveryMethods.email}
            onChange={({ detail }) => setDeliveryMethods({ ...deliveryMethods, email: detail.checked })}
          >
            Email
          </Toggle>
          <Toggle
            checked={deliveryMethods.sms}
            onChange={({ detail }) => setDeliveryMethods({ ...deliveryMethods, sms: detail.checked })}
          >
            SMS
          </Toggle>
          <Toggle
            checked={deliveryMethods.roboCall}
            onChange={({ detail }) => setDeliveryMethods({ ...deliveryMethods, roboCall: detail.checked })}
          >
            Robo-Call
          </Toggle>
        </FormField>
        <FormField label="Fallback Behavior">
          <Select
            options={fallbackOptions.map(option => ({ label: option, value: option }))}
            selectedOption={{ label: fallbackBehavior, value: fallbackBehavior }}
            onChange={({ detail }) => setFallbackBehavior(detail.selectedOption.value)}
          />
        </FormField>
        <FormField label="Fallback Languages">
        <span>If no template in the applicants preferred language then use...</span>
          <Multiselect
            options={languageOptions}
            selectedOptions={fallbackLanguages}
            onChange={({ detail }) => setFallbackLanguages(detail.selectedOptions)}
            tokenLimit={3}
            selectedAriaLabel="Selected"
            placeholder="Choose languages"
            inlineTokens
          />
        </FormField>
      </SpaceBetween>
    </BoardItem>
  );
};

export default ConfigureNotifications;
