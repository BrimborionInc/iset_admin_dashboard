import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceBudgetBurnRateHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What this covers</strong>
      <p>
        Mini trend indicators showing how each major pot is pacing against plan, including projected year-end balance
        and variance thresholds that trigger reallocations or evidence reviews.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Scan for pots breaching burn-rate guardrails to prioritise interventions.</li>
        <li>Compare forecast versus budget to decide if reallocations or spending holds are required.</li>
        <li>Click through to open the hierarchy at the corresponding pot for deeper investigation.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use the insights to seed forecasting scenarios or to flag monitoring follow-ups when underspend threatens
        program delivery commitments.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceBudgetBurnRateHelp.aiContext = "Describe the burn-rate widget’s role in highlighting over/under spend pacing for Budgets dashboard planning.";

export default FinanceBudgetBurnRateHelp;

