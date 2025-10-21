import React from "react";
import { SpaceBetween, Box, Link } from "@cloudscape-design/components";

const FinanceComplianceHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide a health check on compliance posture — capacity tier, monitoring cadence, evidence gaps, and outstanding findings —
        so administrators know where to intervene before audits or reports.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Review the summary section to confirm current tier, sampling progress, and upcoming monitoring commitments.</li>
        <li>Work through outstanding findings using the quick links to Monitoring and Reports.</li>
        <li>Use the control checklist as a reminder for recurring governance tasks.</li>
      </ul>
    </Box>
    <Box>
      <strong>Data sources</strong>
      <ul>
        <li>Capacity tier and sampling rules are provided by the Monitoring service according to the organisation&rsquo;s risk profile.</li>
        <li>Findings list pulls from evidence reviews and variance tracking.</li>
        <li>Checklist items map to internal governance controls (update in Finance Settings when policies change).</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>If issues persist, drill into Monitoring & Evidence or Financial Reports for detailed remediation actions.</p>
      <Link href="/finance/monitoring">Open Monitoring & Evidence</Link>
    </Box>
  </SpaceBetween>
);

FinanceComplianceHelp.aiContext =
  "Explain the compliance summary: capacity tier, monitoring cadence, outstanding findings, and how teams follow up through monitoring or reporting workflows.";

export default FinanceComplianceHelp;
