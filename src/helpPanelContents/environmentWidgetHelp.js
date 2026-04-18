import React from 'react';
import { Alert } from '@cloudscape-design/components';

export default function EnvironmentWidgetHelp() {
  return (
    <div>
      <h1>Environment</h1>
      <p>Shows environment diagnostics plus the shared runtime visibility setting for the demo toolbar.</p>
      <h2>Usage</h2>
      <ul>
        <li>Confirms the active environment, such as dev, test, or production.</li>
        <li>Lets System Administrators control demo-toolbar visibility for staff roles through shared runtime config.</li>
        <li>If the demo-toolbar setting cannot be read, PATH hides the demo toolbar by default.</li>
      </ul>
      <Alert header="Modification" type="info">
        NODE_ENV remains deployment-controlled. Demo toolbar visibility is a centrally stored runtime setting for the
        active environment.
      </Alert>
    </div>
  );
}
EnvironmentWidgetHelp.aiContext = 'Widget help: Environment diagnostics plus shared demo toolbar runtime visibility.';
