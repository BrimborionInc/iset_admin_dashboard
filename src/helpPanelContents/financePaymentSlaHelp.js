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
      <strong>How to use</strong>
      <ul>
        <li>Monitor counts for packets awaiting finance review, awaiting confirmation, or overdue.</li>
        <li>Track draft volume to remind program teams about unsubmitted packets.</li>
        <li>Review the rolling average turnaround time to spot bottlenecks or process drift.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        SLA metrics are fed by payment telemetry; configure thresholds and escalation rules in Finance Settings so alerts
        align with organisational expectations.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentSlaHelp.aiContext =
  "Explain the payments SLA snapshot: monitoring queue volumes, overdue packets, and turnaround averages.";

export default FinancePaymentSlaHelp;
