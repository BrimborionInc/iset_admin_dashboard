import React from 'react';
import { Alert } from '@cloudscape-design/components';

export default function EnvironmentWidgetHelp() {
  return (
    <div>
      <h1>Environment</h1>
      <p>Surface of immutable runtime flags (e.g. NODE_ENV) exposed for situational awareness and troubleshooting.</p>
      <h2>Usage</h2>
      <ul>
        <li>Differentiates dev/test vs production logic branches.</li>
        <li>Assists support teams when validating feature flags vs environment tiers.</li>
      </ul>
      <Alert header="Modification" type="info">Adjust via deployment pipeline variables; not editable through the UI to maintain immutability guarantees.</Alert>
    </div>
  );
}
EnvironmentWidgetHelp.aiContext = 'Widget help: Environment immutability and diagnostic usage.';
