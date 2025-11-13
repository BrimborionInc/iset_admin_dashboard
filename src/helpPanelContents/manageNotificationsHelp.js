import React from 'react';
import { Alert, SpaceBetween } from '@cloudscape-design/components';

export const ManageNotificationsHelp = () => (
  <div>
    <SpaceBetween direction="vertical" size="s">
      <Alert type="info" header="Manage Notifications dashboard">
        Use this dashboard to configure which workflow events trigger outbound notifications, which
        roles receive them, and which template ID each row should use. Authoring happens in the
        Template Editor dashboard; this space is dedicated to routing and delivery flags.
      </Alert>
    </SpaceBetween>
    <h2>When to use this dashboard</h2>
    <p>
      Visit the Manage Notifications dashboard when you need to enable/disable events, switch
      templates, or adjust email vs. bell alerts for staff and applicant roles. After saving, the
      intake service reads the updated settings to decide who gets notified.
    </p>
    <p>
      Need to change the content itself? Open the Template Editor dashboard, publish your updates,
      and return here to link the refreshed template to the appropriate events.
    </p>
  </div>
);
