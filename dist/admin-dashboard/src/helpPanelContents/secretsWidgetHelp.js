import React from 'react';
import { Alert } from '@cloudscape-design/components';

export default function SecretsWidgetHelp() {
  return (
    <div>
      <h1>Secrets</h1>
      <p>Reports presence (not values) of critical secret material (API keys, signing secrets, encryption keys) to validate deployment completeness without exposing sensitive content.</p>
      <h2>Indicators</h2>
      <ul>
        <li><strong>present:</strong> Secret loaded & masked.</li>
        <li><strong>missing:</strong> Secret absent — may impair functionality or security posture.</li>
      </ul>
      <h2>Operational Guidance</h2>
      <ul>
        <li>Investigate any missing secrets before enabling end-user traffic.</li>
        <li>Rotate secrets externally; dashboard intentionally omits rotation controls to enforce separation of duties.</li>
      </ul>
      <Alert header="Least Privilege" type="info">Detailed secret values restricted; exposure avoided to minimize blast radius in UI compromise scenarios.</Alert>
    </div>
  );
}
SecretsWidgetHelp.aiContext = 'Widget help: Secret presence verification and rotation principles.';
