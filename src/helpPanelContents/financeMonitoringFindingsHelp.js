import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceMonitoringFindingsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Maintain a central log of monitoring findings, remediation owners, due dates, and links back to source workspaces.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Filter by severity to prioritise high-risk issues first.</li>
        <li>Update status as corrective actions progress or close findings once evidence is validated.</li>
        <li>Reassign ownership when teams change or escalation is required.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Findings should link to Financial Reports or Budgets dashboards when they impact submissions. Ensure updates emit telemetry so downstream boards reflect remediation progress.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceMonitoringFindingsHelp.aiContext =
  "Describe the Monitoring findings log: severity filtering, status updates, ownership, and links to remediation workflows.";

export default FinanceMonitoringFindingsHelp;

