import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceAllocationHistoryHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide a full audit trail of applied transfers and those scheduled to apply, with balances and evidence in one
        place.
      </p>
    </Box>
    <Box>
      <strong>Key details captured</strong>
      <ul>
        <li>Before/after balances for source and destination pots.</li>
        <li>Effective date, justification, approval chain, and evidence table (labels, types, attachments).</li>
        <li>Pending tab for approved, future-dated transfers; Historical tab for applied transfers only.</li>
      </ul>
    </Box>
    <Box>
      <strong>Usage</strong>
      <p>
        Select a row to view balances and evidence. Apply future-dated approvals from Pending transfers or let them
        auto-apply at the effective date. Use Historical transfers for audit responses and reconciliations.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceAllocationHistoryHelp.aiContext =
  "Transfers widget: Pending transfers tab shows approved transfers with future effective dates (apply now or scheduled); Historical transfers tab shows applied items only. Each row has before/after balances, effective date, approval chain, and evidence (labels/types/attachments). Selecting a row reveals balances and an evidence table.";

export default FinanceAllocationHistoryHelp;
