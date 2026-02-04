import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReconciliationTransactionsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Workflow</strong>
      <p>
        Review Intacct REST submission attempts by payment packet. Use the Outcome and Reason
        filters to focus on failures or partial uploads, then select a packet to open full context
        in the Submission detail widget.
      </p>
    </Box>
    <Box>
      <strong>What the table shows</strong>
      <ul>
        <li>Packet + case identifiers, total amount, and last submission timestamp.</li>
        <li>Latest outcome (success, partial, failed) with an Intacct reason category.</li>
        <li>Search across packet, case, client, or intervention names.</li>
      </ul>
    </Box>
    <Box>
      <strong>Tips</strong>
      <ul>
        <li>Filter to failed submissions first to triage urgent issues.</li>
        <li>Use the Reason filter to isolate validation vs. connectivity problems.</li>
        <li>Resolve issues in the payment packet screens, then retry submission.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceReconciliationTransactionsHelp.aiContext =
  "Describe the Intacct submission queue widget, including outcome/reason filters and how selections feed submission detail.";

export default FinanceReconciliationTransactionsHelp;
