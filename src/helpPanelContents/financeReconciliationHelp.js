import React from "react";
import { SpaceBetween, Box, Link } from "@cloudscape-design/components";

const FinanceReconciliationHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Exception management area for aligning case-management transactions with finance budgets and
        eligibility rules. This workspace exists to highlight mismatches before they impact
        reporting timelines while preserving a full audit trail.
      </p>
    </Box>
    <Box>
      <strong>Concept</strong>
      <p>
        Deliver a triage queue that highlights validation failures, missing evidence, and policy
        violations so finance teams can resolve issues before reporting deadlines. The dashboard
        pairs an actionable transaction list with detailed drill-ins, bulk fixes, and feed health
        indicators.
      </p>
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
        <li>Exception detail panel showing transaction metadata, proposed pot reclassification, and evidence preview.</li>
        <li>Bulk action toolbar for approving clean items or requesting documentation from case workers.</li>
        <li>Sync status banner highlighting ingestion lag or API failures from case management.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies &amp; notes</strong>
      <ul>
        <li>Requires mapping rules between case categories and finance pots (maintained in Finance Settings).</li>
        <li>Should write back resolution outcomes to the Transactions &amp; Evidence registry for audit trail.</li>
        <li>Feeds variance analysis in Reports and risk signals in Monitoring dashboards.</li>
      </ul>
      <Link href="/finance/settings">Open Finance Settings</Link>
    </Box>
  </SpaceBetween>
);

FinanceReconciliationHelp.aiContext =
  "Explain the Finance Reconciliation dashboard: how the queue, detail view, bulk actions, and feed health indicators help teams clear transaction exceptions before reporting.";

export default FinanceReconciliationHelp;
