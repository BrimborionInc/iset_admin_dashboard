import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReconciliationDetailHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide full visibility into the selected Intacct submission attempt so authorized PATH
        administrators can identify why a packet failed and where to fix it.
      </p>
    </Box>
    <Box>
      <strong>Key sections</strong>
      <ul>
        <li>Packet summary (case, client, intervention, totals, packet status).</li>
        <li>Latest Intacct response (outcome, reason, HTTP status, bill ID).</li>
        <li>Validation details returned by Intacct (if any).</li>
        <li>Attempt history for repeated submissions.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Fix validation issues back in the payment packet screens, then resubmit. This dashboard is
        read-only and focused on submission outcomes rather than resolution workflows.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReconciliationDetailHelp.aiContext =
  "Summarise what the Intacct submission detail widget displays and how it helps resolve REST failures.";

export default FinanceReconciliationDetailHelp;
