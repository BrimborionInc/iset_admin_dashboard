import React from 'react';
import { Box } from '@cloudscape-design/components';
import FinancePlaceholder from './FinancePlaceholder.jsx';

const FinanceAllocationsPage = () => (
  <FinancePlaceholder
    title="Allocations & Transfers"
    description="Guided workflow for moving funds between pots while capturing approvals, justifications, and audit evidence."
  >
    <Box variant="p">
      <strong>Concept:</strong> Provide a transfer wizard and approvals workspace so reallocations remain policy-compliant and fully documented.
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Initiate reallocations with clear source/destination context, effective date, and justification.</li>
        <li>Validate requests against availability, eligibility rules, administrative caps, and reporting periods.</li>
        <li>Manage multi-step approvals (Program Manager → Finance → Executive) with transparent history.</li>
      </ul>
    </Box>
    <Box>
      <strong>Provisional widgets</strong>
      <ul>
        <li>Transfer wizard card with validation summary, evidence uploads, and policy hints.</li>
        <li>Pending approvals board grouped by approver role with SLA indicators.</li>
        <li>Allocation timeline showing all historical transfers, linked evidence, and balance before/after snapshots.</li>
        <li>Policy exceptions panel (e.g., admin cap breach) prompting overrides with ESDC approval references.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies & notes</strong>
      <ul>
        <li>Needs integration with Role Matrix to enforce segregation of duties.</li>
        <li>Must feed adjustments back into Budgets (for balances) and Forecasting (for projected impact).</li>
        <li>Expect to reuse evidence storage patterns defined for Transactions & Evidence registry.</li>
      </ul>
    </Box>
  </FinancePlaceholder>
);

export default FinanceAllocationsPage;
