import React from 'react';
import { FormField, Input, Button } from '@cloudscape-design/components';

const EmailAppointmentsWidget = ({ sendEmail }) => {
  return (
    <>
      <FormField label="Email Subject">
        <Input
          name="emailSubject"
          placeholder="Enter subject for the email"
        />
      </FormField>
      <FormField label="Email Body">
        <textarea
          name="emailBody"
          rows="5"
          placeholder="Type your message here"
          style={{ width: '100%', marginBottom: '10px' }}
        />
      </FormField>
      <Button variant="primary" onClick={sendEmail}>Send Email to Filtered List</Button>
    </>
  );
};

export default EmailAppointmentsWidget;
