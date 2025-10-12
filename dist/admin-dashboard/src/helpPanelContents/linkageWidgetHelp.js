import React from 'react';
import { Alert } from '@cloudscape-design/components';

export default function LinkageWidgetHelp() {
  return (
    <div>
      <h1>Cognito Linkage Readiness</h1>
      <p>Assesses migration progress from legacy credential storage to consolidated Cognito identities. Targets: high linkage coverage and elimination of residual password hashes prior to column removal.</p>
      <h2>Metrics</h2>
      <ul>
        <li><strong>Total Users:</strong> Aggregate identity records under migration.</li>
        <li><strong>Linked (Cognito):</strong> Accounts successfully associated with Cognito identities.</li>
        <li><strong>Coverage %:</strong> Linked ÷ Total; ≥ 99% required to proceed to irreversible schema changes.</li>
        <li><strong>Legacy With Password:</strong> Remaining rows holding deprecated password hashes.</li>
        <li><strong>Active (7d):</strong> Recently active users validating post-migration session integrity.</li>
      </ul>
      <h2>Readiness Logic</h2>
      <ul>
        <li><strong>Below 99%:</strong> Continue remediation scripts and contact unlinked users.</li>
        <li><strong>Legacy Hashes &gt; 0:</strong> Delay column drop to retain fallback authentication.</li>
        <li><strong>Coverage ≥ 99% &amp; Legacy 0:</strong> Safe to finalize schema (drop password column).</li>
      </ul>
      <Alert header="Migration Safety" type="warning">Always export a pre-drop snapshot and validate login flows in staging before removing legacy credential columns.</Alert>
    </div>
  );
}
LinkageWidgetHelp.aiContext = 'Widget help: Cognito linkage migration KPIs and readiness criteria.';
