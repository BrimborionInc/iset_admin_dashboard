import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const FinanceSalaryAnnualEntriesHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Annual entry table</strong>
      <p>Each row represents one province or territory for the selected fiscal year.</p>
    </Box>
    <Box>
      <strong>Assigned pot</strong>
      <p>Select the budget pot that should carry the annual salary total for that region.</p>
    </Box>
    <Box>
      <strong>Annual salary</strong>
      <p>Enter the annual salary figure once and PATH will derive an even monthly amount for reporting and review.</p>
    </Box>
  </SpaceBetween>
);

FinanceSalaryAnnualEntriesHelp.aiContext =
  "Explain the annual salary entry table: one row per province or territory, explicit pot assignment, annual salary entry, derived monthly amount, and save workflow.";

export default FinanceSalaryAnnualEntriesHelp;
