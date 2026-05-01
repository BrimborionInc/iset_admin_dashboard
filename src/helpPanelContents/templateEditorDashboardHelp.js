import React from 'react';
import { Alert, SpaceBetween } from '@cloudscape-design/components';

const TemplateEditorDashboardHelp = () => (
  <div>
    <SpaceBetween direction="vertical" size="s">
      <Alert type="info" header="Template Editor dashboard">
        Use this dashboard to create, localize, preview, and validate notification templates
        before linking them to workflow events. Saved templates are immediately available in
        Notification Settings.
      </Alert>
    </SpaceBetween>
    <h2>How to work here</h2>
    <p>
      Pick a template from the library, edit the bilingual subject and body tabs, and use the
      searchable field pickers to insert supported placeholders. Open the collapsed field reference
      only when you need to browse every available field.
    </p>
    <p>
      Choose a preview scenario that matches the notification family you are authoring for. Scenario
      warnings are advisory: they tell you that a valid field may not usually be supplied by that
      event family. Unknown-field warnings should be fixed before assigning the template.
    </p>
    <p>
      After saving, switch to the Notification Settings dashboard to assign the refreshed template
      to specific events and roles. Authoring copy here does not change routing until Notification
      Settings points an event/role row at the template.
    </p>
  </div>
);

export default TemplateEditorDashboardHelp;
