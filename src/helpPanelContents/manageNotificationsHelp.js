import React from 'react';
import { Alert, SpaceBetween } from '@cloudscape-design/components';

export const ManageNotificationsHelp = () => (
  <div>
    <SpaceBetween direction="vertical" size="s">
      <Alert type="info" header="Manage Notifications dashboard">
        Use this workspace to keep outbound messaging consistent across staff and
        applicant audiences. The Template Editor lets you draft bilingual email
        copy for each notification, while the Notification Settings matrix
        decides which events are enabled, which roles receive them, and which
        template ID is linked to each delivery channel.
      </Alert>
    </SpaceBetween>
    <h2>When to use this dashboard</h2>
    <p>
      Visit the Manage Notifications dashboard whenever you need to refresh email
      wording, add a new locale, or toggle applicant/staff delivery for a given
      workflow event. Draft updates in the Template Editor, save, and then
      select the refreshed template inside Notification Settings so downstream
      services render the new copy.
    </p>
    <p>
      Changes here feed the configurable notification pipeline documented in
      <code>docs/dashboards/manage-notifications-dashboard.md</code>; keep both
      widgets in sync so intake and casework services always pull the expected
      template IDs and delivery flags.
    </p>
  </div>
);
