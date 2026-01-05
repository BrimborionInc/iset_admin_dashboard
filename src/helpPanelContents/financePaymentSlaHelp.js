import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentSlaHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Visualise workload and timeliness across draft and submitted packets so staff can spot delays before submission.
      </p>
    </Box>
    <Box>
      <strong>What each metric means</strong>
      <ul>
        <li>Drafts needing evidence: packets blocked by missing documents.</li>
        <li>Submitted to finance: packets already emailed to finance.</li>
        <li>Overdue evidence tasks: missing documents past due.</li>
        <li>Avg. submission age: time since submission to finance.</li>
      </ul>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Monitor drafts with missing evidence to keep submissions moving.</li>
        <li>Track submitted packets to ensure finance has received them.</li>
        <li>Review average submission age to spot bottlenecks.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        SLA metrics are driven by packet status changes and evidence receipt; align internal targets accordingly.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentSlaHelp.aiContext =
  "Explain the payments SLA snapshot metrics for drafts and submitted packets, what each bucket means, and how staff should use them to triage delays and overdue evidence.";

export default FinancePaymentSlaHelp;
