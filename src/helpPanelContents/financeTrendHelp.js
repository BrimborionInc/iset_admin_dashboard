import React from "react";
import { SpaceBetween, Box, Link } from "@cloudscape-design/components";

const FinanceTrendHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Visualise cumulative spend progress against plan and forecast so finance leads can spot burn-rate issues early
        and respond with reallocations or evidence follow-up.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Select the reporting period to view a full fiscal year or drill down to a specific quarter.</li>
        <li>Filter by region or program to focus on a subset of agreements.</li>
        <li>Toggle the forecast overlay to compare projected outcomes with recorded actual and planned spend.</li>
      </ul>
    </Box>
    <Box>
      <strong>Data sources</strong>
      <ul>
        <li>Recorded actuals originate from PATH finance transactions and historical backloads.</li>
        <li>Plan values come from budget baselines configured in the Budgets workspace.</li>
        <li>Forecast values come from the scenario engine and should emit telemetry with <code>agreement_id</code> and <code>report_id</code>.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        When trends deviate beyond policy thresholds, jump to Budgets or Reports to initiate reallocations or variance analysis.
      </p>
      <Link href="/finance/budgets">Open Budgets</Link>
    </Box>
  </SpaceBetween>
);

FinanceTrendHelp.aiContext =
  "Explain the spend trend widget: selecting periods and filters, interpreting recorded actual versus plan and forecast lines, and deciding when follow-up action is required.";

export default FinanceTrendHelp;
