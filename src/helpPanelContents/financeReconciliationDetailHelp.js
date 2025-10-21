import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReconciliationDetailHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide full visibility into the currently selected transaction so reviewers can decide how
        to resolve the exception. It consolidates metadata, validation results, evidence, and action
        history.
      </p>
    </Box>
    <Box>
      <strong>Key sections</strong>
      <ul>
        <li>Transaction summary (source, case ID, vendor, justification).</li>
        <li>Exception analysis (rule triggered, policy references, suggested pot).</li>
        <li>Evidence attachments and outstanding requests.</li>
        <li>Action buttons for approve, reclassify, request info, or mark non-claimable.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Decisions taken here immediately update the queue, audit log, and downstream reporting. Use the comment fields
        to capture rationale for auditors and program partners.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReconciliationDetailHelp.aiContext =
  "Summarise what the Reconciliation exception detail widget displays and how reviewers use it.";

export default FinanceReconciliationDetailHelp;
