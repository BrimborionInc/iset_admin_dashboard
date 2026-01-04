import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentSlaHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Visualise workload and timeliness across the payments pipeline so Finance can intervene before packets breach
        service-level agreements.
      </p>
    </Box>
    <Box>
      <strong>What each metric means</strong>
      <ul>
        <li>Ready for finance review: packets waiting on finance validation.</li>
        <li>Ready for batching: finance-approved packets awaiting EFT grouping.</li>
        <li>On hold: blocked by missing evidence or risk flags.</li>
        <li>Sent awaiting confirmation: payments issued but not confirmed.</li>
        <li>Overdue evidence tasks: missing documents past due.</li>
        <li>Avg. turnaround: submission-to-confirmation cycle time.</li>
      </ul>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Monitor counts for finance review, batching, on-hold, and sent queues.</li>
        <li>Watch overdue evidence tasks that could block confirmation.</li>
        <li>Review the average turnaround time to spot bottlenecks.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        SLA metrics are driven by packet status changes; align thresholds and escalation rules in Finance Settings so
        alerts match organisational expectations.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentSlaHelp.aiContext =
  "Explain the payments SLA snapshot metrics, what each bucket means, and how Finance should use them to triage delays and overdue evidence.";

export default FinancePaymentSlaHelp;
