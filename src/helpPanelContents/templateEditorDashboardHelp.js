import React from 'react';
import { Alert, SpaceBetween } from '@cloudscape-design/components';

const TemplateEditorDashboardHelp = () => (
  <div>
    <SpaceBetween direction="vertical" size="s">
      <Alert type="info" header="Template Editor dashboard">
        Use this dashboard to create, localize, and test notification templates before linking
        them to workflow events. Changes you publish here are immediately available to the
        Notification Settings dashboard.
      </Alert>
    </SpaceBetween>
    <h2>How to work here</h2>
    <p>
      Pick a template from the library, edit the bilingual subject and body tabs, and use the
      formatting toolbar (bold, italic, underline, lists, links) to keep styling consistent. You can
      also translate between English and French, insert placeholders, and preview the rendered copy
      with sample data before saving.
    </p>
    <p>
      After saving, switch to the Notification Settings dashboard to assign the refreshed template to
      specific events and roles. Keeping authoring and routing separate helps avoid accidental
      regressions while you iterate on copy.
    </p>
  </div>
);

export default TemplateEditorDashboardHelp;
