import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceAllocationApprovalsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Review and decide on proposed transfers: see justification, effective date, and evidence so you can approve or
        reject with confidence.
      </p>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Use filters to focus on your queue; select a row to open the modal with details and evidence table.</li>
        <li>Approve/Reject with an optional reviewer note. Approved items auto-apply if effective date is today/past; future-dated approvals move to Pending transfers.</li>
        <li>Ensure evidence is present; policy notes and balances are visible in the modal.</li>
      </ul>
    </Box>
    <Box>
      <strong>Automation</strong>
      <p>
        Approval actions update transfer status and, when eligible, apply immediately; future-dated approvals are
        scheduled for apply (or can be applied from the Transfers widget). Audit logs retain decisions and evidence.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceAllocationApprovalsHelp.aiContext =
  "Approvals queue: shows proposed transfers only. Open modal to view source/dest, amount, effective date, justification, evidence table, and approve/reject with comment. Approval auto-applies if effective date <= today; otherwise moves to pending transfers for scheduled/manual apply. Evidence must be present; decisions are logged for audit.";

export default FinanceAllocationApprovalsHelp;
