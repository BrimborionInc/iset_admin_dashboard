import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceForecastingHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Forecasting &amp; Scenarios combines historical actuals with projected spend so finance leaders can anticipate overruns/underspends and plan reallocations before reporting deadlines.
      </p>
    </Box>
    <Box>
      <strong>Concept</strong>
      <p>
        Layer forecasts onto plan vs. actual data, model what-if scenarios, compare impacts, and promote approved changes back into Budgets and Allocations workflows.
      </p>
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Review forecasted spend across fiscal horizons (quarter, year end, multi-year agreements).</li>
        <li>Create sandbox scenarios, capture justifications, and quantify downstream impacts.</li>
        <li>Commit approved scenarios into live reallocations and notify stakeholders of upcoming changes.</li>
      </ul>
    </Box>
    <Box>
      <strong>Widgets in this dashboard</strong>
      <ul>
        <li>Forecast vs. budget chart with toggles for actual/forecast/combined views.</li>
        <li>Scenario workspace for adjusting pot forecasts with narrative context.</li>
        <li>Scenario comparison table tracking totals, admin rate, and risk flags.</li>
        <li>Commit changes panel summarising impacts ready for Allocations workflows.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies &amp; notes</strong>
      <ul>
        <li>Consumes historical spend from Budgets/Reconciliation and commitments from Allocations.</li>
        <li>Track forecast versions with audit data (`method`, `justification`, `created_by`) so scenario changes remain auditable.</li>
        <li>Integrates with Reports to surface variance narratives alongside submissions.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceForecastingHelp.aiContext =
  "Explain the Forecasting & Scenarios dashboard: forecast review, scenario modeling, comparison, and committing approved changes.";

export default FinanceForecastingHelp;
