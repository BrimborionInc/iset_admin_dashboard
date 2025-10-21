import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReportsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Hub for generating interim and year-end submissions, validating results, managing certification, and producing export packages that satisfy agreement and funder requirements.
      </p>
    </Box>
    <Box>
      <strong>Concept</strong>
      <p>
        Guide finance teams through preparation, validation, certification, and submission of compliant reports with clear visibility into status, blockers, and outstanding tasks.
      </p>
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Run draft reports that reconcile budgets, transactions, and eligibility rules before certification.</li>
        <li>Resolve validation findings with navigation back to Budgets, Allocations, or Reconciliation as needed.</li>
        <li>Manage certification workflow, lock statements, and monitor XML/CSV export acknowledgements from ESDC.</li>
      </ul>
    </Box>
    <Box>
      <strong>Widgets in this dashboard</strong>
      <ul>
        <li>Lifecycle tracker showing progress from Draft → Validation → Certification → Submission.</li>
        <li>Validation summary grouped by severity with deep links to remediation workflows.</li>
        <li>Certification card covering signatory status, locks, and telemetry.</li>
        <li>Export history table with XML hash, envelope version, channel, and acknowledgement timestamps.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies &amp; notes</strong>
      <ul>
        <li>Requires reporting engine calculations plus administrative flat-rate and eligibility rules configured in Finance Settings.</li>
        <li>Should ingest monitoring feedback so corrective actions surface alongside submissions.</li>
        <li>Must emit telemetry (`agreement_id`, `report_id`, `validation_status`) for observability pipelines.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceReportsHelp.aiContext =
  "Explain the Financial Reports dashboard: lifecycle tracking, validation handling, certification workflow, export monitoring, and the telemetry finance teams rely on to prove submissions.";

export default FinanceReportsHelp;
