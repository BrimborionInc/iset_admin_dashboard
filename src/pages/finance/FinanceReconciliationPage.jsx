import React from 'react';
import { Box } from '@cloudscape-design/components';
import FinancePlaceholder from './FinancePlaceholder.jsx';

const FinanceReconciliationPage = () => (
  <FinancePlaceholder
    title="Reconciliation"
    description="Exception management area for aligning case-management transactions with finance budgets and eligibility rules."
  >
    <Box variant="p">
      <strong>Concept:</strong> Deliver a triage queue that highlights mismatches, missing evidence, and policy violations so finance teams can resolve issues before reporting deadlines.
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Review newly ingested transactions with automatic pot assignments and validation results.</li>
        <li>Resolve exceptions (missing evidence, date out of period, ineligible vendor) with clear corrective actions.</li>
        <li>Collaborate with program staff by requesting information and tracking responses.</li>
      </ul>
    </Box>
    <Box>
      <strong>Provisional widgets</strong>
      <ul>
        <li>Inbound transactions table with filters (exception type, funding stream, sub-agreement, status).</li>
        <li>Exception detail drawer showing transaction metadata, proposed pot reclassification, and evidence preview.</li>
        <li>Bulk action toolbar for approving clean items or requesting documentation from case workers.</li>
        <li>Sync status banner highlighting ingestion lag or API failures from case management.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies & notes</strong>
      <ul>
        <li>Requires mapping rules between case categories and finance pots (maintained in Finance Settings).</li>
        <li>Should write back resolution outcomes to the Transactions & Evidence registry for audit trail.</li>
        <li>Feeds variance analysis in Reports and risk signals in Monitoring dashboards.</li>
      </ul>
    </Box>
  </FinancePlaceholder>
);

export default FinanceReconciliationPage;
