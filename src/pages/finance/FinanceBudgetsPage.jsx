import React from 'react';
import { Box } from '@cloudscape-design/components';
import FinancePlaceholder from './FinancePlaceholder.jsx';

const FinanceBudgetsPage = () => (
  <FinancePlaceholder
    title="Budgets"
    description="Workspace for configuring and tracking agreement budgets across funding streams, programs, and regions."
  >
    <Box variant="p">
      <strong>Concept:</strong> Offer a flexible tree/grid that lets finance teams visualise allocations, adjustments, commitments, and remaining balance for each budget pot.
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Review current budget state, including approved amounts, reallocations, commitments, and burn-rate.</li>
        <li>Toggle between simple (single-level) and advanced (multi-level) hierarchies depending on organisation complexity.</li>
        <li>Highlight pots approaching overrun and capture annotations (Board approvals, ESDC confirmations) per adjustment.</li>
      </ul>
    </Box>
    <Box>
      <strong>Provisional widgets</strong>
      <ul>
        <li>Hierarchical budget tree with inline KPIs and quick filters (overrun risk, underspend, admin attribution).</li>
        <li>Pot detail side panel summarising history of adjustments, supporting evidence, and proportional admin allocation.</li>
        <li>Saved view selector (by program, region, funding stream) and export to CSV/PDF for Board packs.</li>
        <li>Burn-rate micro charts indicating pace vs. plan over the fiscal year.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies & notes</strong>
      <ul>
        <li>Requires budget hierarchy metadata and terminology from Finance Settings.</li>
        <li>Feeds data to Allocations, Reconciliation, and Forecasting dashboards for context and validation.</li>
        <li>Must respect eligibility metadata and admin flat-rate logic defined in Appendices B &amp; D of CR-0003.</li>
      </ul>
    </Box>
  </FinancePlaceholder>
);

export default FinanceBudgetsPage;
