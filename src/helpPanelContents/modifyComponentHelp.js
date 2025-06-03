import React from 'react';
import { Alert, SpaceBetween } from '@cloudscape-design/components';

const ModifyComponentHelp = () => (
  <div>
    <SpaceBetween direction="vertical" size="s">
      <Alert type="info" header="Modify Component Help">
        <p>This section allows you to modify and preview components dynamically. You can drag and drop components, edit their properties, and see the changes in real-time.</p>
      </Alert>
    </SpaceBetween>
    <h2>Modify Component Dashboard</h2>
    <p>The Modify Component dashboard provides tools to customize and preview various components. You can add new components, edit existing ones, and see the Nunjucks output for integration with your templates.</p>
  </div>
);

export default ModifyComponentHelp;
