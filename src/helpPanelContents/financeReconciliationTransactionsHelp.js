import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReconciliationTransactionsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Workflow</strong>
      <p>
        Review inbound transactions that failed automated validation. Use the filters to focus on
        specific exception types, funding streams, or statuses, then select transactions to open
        detailed context or perform bulk actions.
      </p>
    </Box>
    <Box>
      <strong>What the table shows</strong>
      <ul>
        <li>Source data (transaction ID, date, amount, case ID).</li>
        <li>Current pot assignment and proposed reclassification.</li>
        <li>Exception category (missing evidence, out of period, ineligible vendor, etc.).</li>
        <li>Validation status and evidence availability.</li>
      </ul>
    </Box>
    <Box>
      <strong>Tips</strong>
      <ul>
        <li>Use saved preferences to tailor column visibility and page size to your workflow.</li>
        <li>Selections feed both the Exception detail and Bulk actions widgets.</li>
        <li>Use exports to share filtered exception lists with program partners or auditors when additional input is needed.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceReconciliationTransactionsHelp.aiContext =
  "Describe the Reconciliation transactions queue widget, including columns, filters, and selection behaviour.";

export default FinanceReconciliationTransactionsHelp;
