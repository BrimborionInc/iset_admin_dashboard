import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentSlaHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Visualise workload and timeliness across draft packets and packets already sent to finance so staff can spot delays early.
      </p>
    </Box>
    <Box>
      <strong>What each metric means</strong>
      <ul>
        <li>Drafts needing evidence: packets blocked by missing documents.</li>
        <li>Sent to finance: packets already emailed or handed off to finance.</li>
        <li>Overdue evidence tasks: missing documents past due.</li>
        <li>Avg. submission age: time since the packet was sent to finance.</li>
      </ul>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Monitor drafts with missing evidence to keep packets moving to finance.</li>
        <li>Track packets already sent to finance and follow up when they stall.</li>
        <li>Review average submission age to spot finance bottlenecks.</li>
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
  "Explain the payments SLA snapshot metrics for draft packets and packets already sent to finance, what each bucket means, and how staff should use them to triage delays and overdue evidence.";

export default FinancePaymentSlaHelp;
