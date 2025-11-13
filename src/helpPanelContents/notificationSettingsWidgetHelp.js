import React from 'react';

const NotificationSettingsWidgetHelp = () => (
  <div>
    <h2>Notification Settings</h2>
    <p>
      Use this matrix to decide which workflow events send notifications, which
      roles receive them, and which template ID each row should render. Expand
      an event to see per-role toggles, assign the desired template, and switch
      on email or bell alerts as needed.
    </p>
    <p>
      Saved changes update the <code>notification_setting</code> table that the
      intake service reads before dispatching SES or secure-message copies. Only
      rows you modify are posted back to the API, so flip the Save and Cancel
      buttons to control when new settings take effect.
    </p>
  </div>
);

export default NotificationSettingsWidgetHelp;
