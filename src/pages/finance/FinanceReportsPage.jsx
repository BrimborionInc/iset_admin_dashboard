import React from 'react';
import { Box } from '@cloudscape-design/components';
import FinancePlaceholder from './FinancePlaceholder.jsx';

const FinanceReportsPage = () => (
  <FinancePlaceholder
    title="Financial Reports"
    description="Hub for generating interim and year-end submissions, validating results, and managing certification/exports."
  >
    <Box variant="p">
      <strong>Concept:</strong> Guide finance teams through preparation, validation, certification, and submission of compliant reports, with full visibility into status and outstanding tasks.
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Run draft reports that automatically reconcile budgets, transactions, and eligibility rules.</li>
        <li>Address validation findings prior to certification, with clear navigation back to source issues.</li>
        <li>Manage certification workflow, then monitor XML/CSV exports and acknowledgements from ESDC.</li>
      </ul>
    </Box>
    <Box>
      <strong>Provisional widgets</strong>
      <ul>
        <li>Report lifecycle tracker (Draft → Validation → Certification → Submitted) with per-step checklist.</li>
        <li>Validation summary panel grouped by severity and linked to Budgets/Reconciliation remediation paths.</li>
        <li>Certification card capturing signatory, digital signature status, and lock state.</li>
        <li>Export history table capturing XML hash, envelope version, submission channel, and acknowledgement timestamps.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies & notes</strong>
      <ul>
        <li>Depends on reporting engine calculations, Appendix D flat-rate rules, and Appendix B eligibility metadata.</li>
        <li>Should ingest monitoring feedback (Appendix C) so corrective actions are surfaced alongside submissions.</li>
        <li>Must emit telemetry (`agreement_id`, `report_id`, `validation_status`) for observability pipelines.</li>
      </ul>
    </Box>
  </FinancePlaceholder>
);

export default FinanceReportsPage;
