import React from 'react';

const ManageTemplatesWidgetHelp = () => (
  <div>
    <h2>Template Editor</h2>
    <p>
      The Template Editor is where you draft the email copy that downstream
      services render for each notification. Pick a template from the library,
      edit the English and French subject/body tabs, and use the insert-field
      menu to drop tokens such as <code>{'{tracking_id}'}</code> or
      <code>{'{portal_dashboard_url}'}</code>.
    </p>
    <p>
      Saving pushes the localized JSON payload to <code>notification_template.localized</code>.
      Once saved, the refreshed template becomes available immediately in the
      Notification Settings widget so you can link it to events and roles.
    </p>
  </div>
);

export default ManageTemplatesWidgetHelp;
