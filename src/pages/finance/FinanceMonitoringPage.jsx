import React from 'react';
import { Box } from '@cloudscape-design/components';
import FinancePlaceholder from './FinancePlaceholder.jsx';

const FinanceMonitoringPage = () => (
  <FinancePlaceholder
    title="Monitoring & Evidence"
    description="Control centre for sampling, evidence coverage, monitoring findings, and remediation activities."
  >
    <Box variant="p">
      <strong>Concept:</strong> Help finance and compliance teams demonstrate control effectiveness by tracking required evidence, sampling outputs, and follow-up actions tied to ESDC monitoring cycles.
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Measure evidence coverage across transactions, highlighting gaps by pot, vendor, or program.</li>
        <li>Generate sampling sets based on capacity-tier parameters and assign review tasks.</li>
        <li>Log monitoring findings, remediation plans, and deadlines with clear ownership.</li>
      </ul>
    </Box>
    <Box>
      <strong>Provisional widgets</strong>
      <ul>
        <li>Evidence coverage dashboard with filters (timeframe, pot, transaction type) and gap alerts.</li>
        <li>Sampling task board showing review status (queued, in-progress, completed) with sampling rationale.</li>
        <li>Findings log table capturing issue type, severity, assigned owner, target resolution date, and attachments.</li>
        <li>Evidence bundle generator for packaging documents requested by auditors.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies & notes</strong>
      <ul>
        <li>Relies on capacity tier configuration (Appendix C) to determine sampling rates and monitoring cadence.</li>
        <li>Should integrate with evidence storage to calculate coverage and to retrieve artefact metadata (hash, uploader).</li>
        <li>Works in tandem with Reports dashboard to surface monitoring feedback linked to submitted reports.</li>
      </ul>
    </Box>
  </FinancePlaceholder>
);

export default FinanceMonitoringPage;
