import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceMonitoringEvidenceHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide a real-time view of evidence coverage so staff can close gaps before monitoring deadlines.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Filter by risk level or program to isolate areas with missing documentation.</li>
        <li>Review coverage percentages versus targets and follow up with the listed owner.</li>
        <li>Use due dates to prioritise which pots need evidence uploads first.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Coverage should reflect transactions tagged in the evidence registry. Targets and risk thresholds align with capacity-tier settings in Finance Settings.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceMonitoringEvidenceHelp.aiContext =
  "Describe the Monitoring & Evidence coverage widget: filtering by risk/program, interpreting coverage vs. targets, and prioritising follow-up.";

export default FinanceMonitoringEvidenceHelp;
