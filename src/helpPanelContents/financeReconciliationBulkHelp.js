import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReconciliationBulkHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Coordinate large exception batches. Use this panel to apply actions to multiple selected
        transactions, monitor progress, and capture audit notes.
      </p>
    </Box>
    <Box>
      <strong>Bulk actions</strong>
      <ul>
        <li>Approve clean transactions once evidence is confirmed.</li>
        <li>Send information requests back to program staff with templated messages.</li>
        <li>Mark items non-claimable when policy violations cannot be fixed.</li>
      </ul>
    </Box>
    <Box>
      <strong>Good practices</strong>
      <ul>
        <li>Review the summary list to ensure the right items are selected before committing.</li>
        <li>Record bulk action notes; they appear in the audit history and reports.</li>
        <li>Resolve priority exceptions first—filters on the queue help feed this widget.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceReconciliationBulkHelp.aiContext =
  "Explain the Reconciliation bulk actions widget and how finance teams should use it.";

export default FinanceReconciliationBulkHelp;
