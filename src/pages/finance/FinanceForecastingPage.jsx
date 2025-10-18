import React from 'react';
import { Box } from '@cloudscape-design/components';
import FinancePlaceholder from './FinancePlaceholder.jsx';

const FinanceForecastingPage = () => (
  <FinancePlaceholder
    title="Forecasting & Scenarios"
    description="Forward-looking view that combines actuals with projections to surface risks and support proactive reallocations."
  >
    <Box variant="p">
      <strong>Concept:</strong> Layer forecasts on top of plan vs. actual data so finance leaders can anticipate overruns/underspends, test what-if scenarios, and commit approved changes back to budgets and allocations.
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Review forecasted spend vs. budget across time horizons (quarter-end, year-end, multi-year agreements).</li>
        <li>Create sandbox scenarios that adjust pots, capture justifications, and quantify downstream impacts.</li>
        <li>Promote approved scenarios into live reallocations and notify stakeholders of expected changes.</li>
      </ul>
    </Box>
    <Box>
      <strong>Provisional widgets</strong>
      <ul>
        <li>Forecast vs. budget chart with toggle for Actual / Forecast / Combined views.</li>
        <li>Scenario workspace allowing inline forecast edits, sandbox totals, and variance callouts.</li>
        <li>Scenario comparison table showing key metrics (total spend, admin rate, risk flags) across saved scenarios.</li>
        <li>Commit changes panel summarising proposed reallocations to feed into the Allocations workflow.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies & notes</strong>
      <ul>
        <li>Consumes historical spend from Budgets/Reconciliation and commitments from Allocations.</li>
        <li>Should track forecast versions with audit trail (`method`, `justification`, `created_by`) per CR section 20.</li>
        <li>Integrates with Reporting to surface forecast vs. actual variance narratives.</li>
      </ul>
    </Box>
  </FinancePlaceholder>
);

export default FinanceForecastingPage;
