import React from 'react';
import { Alert } from '@cloudscape-design/components';

export default function SessionAuditWidgetHelp() {
  return (
    <div>
      <h1>Session Audit</h1>
      <p>Summarizes recent session activity for behavioral monitoring, capacity planning, and anomaly detection.</p>
      <h2>Metrics</h2>
      <ul>
        <li><strong>Total Sessions:</strong> Current rows in session store / audit log.</li>
        <li><strong>Active Users 24h:</strong> Distinct user identities seen in last 24 hours.</li>
        <li><strong>Rows (24h):</strong> Session insert/update volume; spikes may indicate bot activity.</li>
        <li><strong>Newest Seen:</strong> Timestamp of most recent heartbeat/update.</li>
      </ul>
      <h2>Recent Sessions List</h2>
      <p>Provides quick glance at recency and distribution; truncated identifiers preserve privacy while enabling trace correlation.</p>
      <h2>Maintenance</h2>
      <ul>
        <li><strong>Refresh:</strong> Pull latest snapshot.</li>
        <li><strong>Prune &lt;60d:</strong> Removes aged entries to manage storage footprint.</li>
      </ul>
      <Alert header="Retention Strategy" type="info">Adjust prune policy in server configuration for compliance regimes requiring extended session audit history.</Alert>
    </div>
  );
}
SessionAuditWidgetHelp.aiContext = 'Widget help: Session audit metrics, interpretation, and pruning guidance.';
