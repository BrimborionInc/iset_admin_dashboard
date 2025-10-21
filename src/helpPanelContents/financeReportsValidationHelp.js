import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReportsValidationHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Summarise automated validation findings so finance officers can resolve issues before certification.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Filter by severity to focus on high-impact findings first.</li>
        <li>Open remediation links to jump into Budgets, Monitoring, or Reconciliation with context.</li>
        <li>Reassign findings or mark them resolved as supporting evidence is uploaded.</li>
      </ul>
    </Box>
    <Box>
      <strong>Data sources</strong>
      <p>
        Findings originate from the reporting engine (variance rules, evidence coverage gaps, flat-rate checks). Each entry should capture severity, owner, linked workspace, and status timeline for audit traceability.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsValidationHelp.aiContext =
  "Explain the Financial Reports validation summary widget: filtering severities, resolving findings, linking to remediation workspaces.";

export default FinanceReportsValidationHelp;
