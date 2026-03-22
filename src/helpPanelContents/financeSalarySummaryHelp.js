import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const FinanceSalarySummaryHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Annual total</strong>
      <p>The combined annual salary value currently shown for the selected fiscal year.</p>
    </Box>
    <Box>
      <strong>Derived monthly total</strong>
      <p>The combined monthly value implied by the annual figures currently entered.</p>
    </Box>
    <Box>
      <strong>Coverage</strong>
      <p>The summary also shows how many regions have a salary value entered and how many have a pot assigned.</p>
    </Box>
  </SpaceBetween>
);

FinanceSalarySummaryHelp.aiContext =
  "Explain the salary summary widget in concise user-facing terms: annual total, derived monthly total, regions entered, and pot assignment coverage.";

export default FinanceSalarySummaryHelp;
