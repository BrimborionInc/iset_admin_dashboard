import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const FinanceSalaryControlsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Fiscal year</strong>
      <p>Choose the salary year you want to work in. The table and summary update together.</p>
    </Box>
    <Box>
      <strong>Refresh</strong>
      <p>Use refresh to reload the latest saved values for the selected fiscal year.</p>
    </Box>
    <Box>
      <strong>Derived monthly amounts</strong>
      <p>The dashboard stores annual salary values and shows the implied monthly amount for review.</p>
    </Box>
  </SpaceBetween>
);

FinanceSalaryControlsHelp.aiContext =
  "Explain the salary controls widget in plain language: fiscal year, unsaved-change indicator, regions entered, refresh, and the fact that PATH derives monthly salary values from annual entries.";

export default FinanceSalaryControlsHelp;
