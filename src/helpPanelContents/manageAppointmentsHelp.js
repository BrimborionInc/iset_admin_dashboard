import React from 'react';
import { Alert, SpaceBetween } from '@cloudscape-design/components';

const ManageAppointmentsHelp = () => (
  <div>
    <SpaceBetween direction="vertical" size="s">
      <Alert
        type="warning"
        header="Development Note"
      >
        Appointments table must cope with Million+ records. Current functionality is demo-only. Needs server-side implementation of search (with limited client-side filtering). Needs pagination and row limiters.
      </Alert>
    </SpaceBetween>
    <h2>Manage Appointments Help</h2>
    <p>
      The Manage Appointments dashboard provides administrators with a comprehensive interface to manage all aspects of appointment scheduling. This includes viewing and managing appointment slots, rescheduling appointments, and tracking appointment statuses. Administrators can also configure appointment rules, send notifications, and ensure compliance with organizational policies. The dashboard offers real-time analytics and reporting, allowing authorized users to monitor appointment trends, identify bottlenecks, and optimize scheduling workflows. Additionally, the system supports integration with external calendars and communication channels, ensuring seamless coordination and communication with clients.
    </p>
  </div>
);

export default ManageAppointmentsHelp;
