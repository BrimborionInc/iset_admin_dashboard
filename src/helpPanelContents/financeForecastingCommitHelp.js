import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceForecastingCommitHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Summarise the adjustments in the active scenario and stage them for hand-off to the Allocations workflow.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Review current vs. proposed forecasts and confirm variances look reasonable.</li>
        <li>Mark the scenario ready once it passes review so Allocations can consume the changes.</li>
        <li>Jump into Allocations to initiate transfers once stakeholders approve the scenario.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Only scenarios in review or approved state should be committed. Capture approvals before promoting to avoid divergence between forecasting and allocations records.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceForecastingCommitHelp.aiContext =
  "Describe the commit changes widget: reviewing variances, promoting scenarios for Allocations, and ensuring approvals are captured.";

export default FinanceForecastingCommitHelp;

