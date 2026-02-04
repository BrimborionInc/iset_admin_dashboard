import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReconciliationSyncHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Surface the health of the inbound case-management feed so finance staff know if exceptions
        are up to date or if there is an ingestion backlog that needs attention.
      </p>
    </Box>
    <Box>
      <strong>What it displays</strong>
      <ul>
        <li>Last successful sync timestamp and ingest duration.</li>
        <li>Backlog counts by severity (critical, warning, info).</li>
        <li>Outstanding API or queue errors with recommended next steps.</li>
      </ul>
    </Box>
    <Box>
      <strong>Operational notes</strong>
      <ul>
        <li>Escalate to IT if the backlog exceeds agreed thresholds or errors persist.</li>
        <li>Use the refresh button to request a manual sync when the feed is behind schedule.</li>
        <li>Sync health contributes to Monitoring dashboard KPIs, so keep it green.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceReconciliationSyncHelp.aiContext =
  "Describe the Reconciliation sync status widget and how to interpret the indicators.";

export default FinanceReconciliationSyncHelp;
