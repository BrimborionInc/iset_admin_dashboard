import React from 'react';
import { Alert } from '@cloudscape-design/components';

export default function AuthWidgetHelp() {
  return (
    <div>
      <h1>Authentication</h1>
      <p>Displays and manages authentication policy across Administrator and Applicant scopes where applicable. Consolidates token TTLs, password & MFA policies, lockout parameters, federation sync, and adaptive security features.</p>
      <h2>Scopes</h2>
      <ul>
        <li><strong>Admin:</strong> Elevated control plane users; stricter policy recommended.</li>
        <li><strong>Applicants:</strong> Public identity cohort; balance friction vs security.</li>
      </ul>
      <h2>Session / Token Lifetimes</h2>
      <ul>
        <li><strong>Access / ID Token:</strong> JWT presentation & identity tokens; keep short for least privilege.</li>
        <li><strong>Refresh:</strong> Security vs re-auth trade-off; rotate periodically.</li>
        <li><strong>Frontend Idle:</strong> Client inactivity logout threshold.</li>
        <li><strong>Absolute Session:</strong> Hard cap regardless of refresh churn.</li>
      </ul>
      <h2>Password Policy</h2>
      <ul>
        <li>Minimum length & character class requirements; widget flags weak configurations.</li>
        <li>Lockout threshold / duration deter brute force; recommended 5–10 attempts, ≥300s duration.</li>
      </ul>
      <h2>Federation</h2>
      <p>Displays external IdP providers and last synchronization timestamp. Use <em>Sync Federation</em> to refresh provider metadata (client ids, JWKS, attribute mappings) when reconfigured upstream.</p>
      <h2>Adaptive Controls</h2>
      <ul>
        <li><strong>PKCE Required:</strong> Mitigates auth code interception in public clients.</li>
        <li><strong>Max Password Resets / Day (public):</strong> Rate-limits social engineering and enumeration.</li>
        <li><strong>Anomaly Protection:</strong> Placeholder for risk-based enforcement tier (standard / strict).</li>
      </ul>
      <Alert header="Claims Mapping" type="info">Use the <strong>View Claims Mapping</strong> button (Admin scope) to inspect raw claims transform for identity / role attribution troubleshooting.</Alert>
    </div>
  );
}
AuthWidgetHelp.aiContext = 'Widget help: Authentication policy, token TTLs, password/MFA/lockout, federation sync.';
