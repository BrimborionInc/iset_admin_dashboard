import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const FinanceSalariesHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>The Salaries dashboard records annual salary totals by province or territory and assigns each entry to a budget pot.</p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <p>Select a fiscal year, review the row for each region, assign the correct pot, enter the annual total, and save your changes. PATH derives the monthly amount automatically.</p>
    </Box>
    <Box>
      <strong>Scope</strong>
      <p>This dashboard supports oversight and reporting preparation. It is not the payroll or accounting system of record.</p>
    </Box>
  </SpaceBetween>
);

FinanceSalariesHelp.aiContext =
  "Guide finance admins using the Salaries dashboard. Keep the language user-facing: annual salary totals by province or territory, explicit budget-pot assignment, derived monthly amounts, save and refresh workflow, and the fact that PATH is tracking/reporting support rather than the payroll system of record.";

export default FinanceSalariesHelp;
