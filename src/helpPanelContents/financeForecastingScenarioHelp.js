import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceForecastingScenarioHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Workspace for adjusting forecast values inside the active scenario and documenting rationale before promotion.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Select a budget pot to tweak forecast amounts with sliders or manual adjustments.</li>
        <li>Record justification text so reviewers understand the assumptions behind each change.</li>
        <li>Duplicate or create scenarios to test alternatives, then route drafts for review.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Every adjustment should roll up to scenario totals and admin percentages. When scenarios move to review, capture approvals to feed Allocations and Reporting workflows.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceForecastingScenarioHelp.aiContext =
  "Explain the Forecasting scenario workspace: adjusting pot forecasts, capturing justifications, creating/duplicating scenarios, and promoting drafts.";

export default FinanceForecastingScenarioHelp;

