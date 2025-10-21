import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceForecastingComparisonHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Summarise every scenario's totals, admin rate, status, and risk so decision makers can choose which one to advance.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Scan totals and admin percentages to spot scenarios that exceed policy limits.</li>
        <li>Review status and owner to understand where each scenario sits in the workflow.</li>
        <li>Jump back into the workspace to edit or promote the scenario you want to progress.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Risk indicators should reflect tolerance rules from Finance Settings. Approved scenarios feed directly into Allocations and Reporting dashboards.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceForecastingComparisonHelp.aiContext =
  "Explain the scenario comparison widget: reviewing totals/admin %, understanding status/ownership, and selecting scenarios for further action.";

export default FinanceForecastingComparisonHelp;

