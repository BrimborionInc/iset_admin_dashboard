import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceBudgetStructureManagerHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>Edit budget pots inside a selected draft, copy the Active hierarchy to a new draft, and manage snapshots (capture, delete, restore to draft). Publishing happens from the Draft Budgets tab.</p>
    </Box>
    <Box>
      <strong>Key actions</strong>
      <ul>
        <li><strong>Select a draft</strong> (from Draft Budgets or the Drafts table) to unlock Create/Edit.</li>
        <li><strong>Create/Edit pot</strong> &mdash; updates stay within the draft; Active is untouched until publish.</li>
        <li><strong>Copy active hierarchy as new draft</strong> &mdash; clones today’s Active into a fresh draft.</li>
        <li><strong>Snapshots</strong> &mdash; capture Active, delete snapshots, or restore one into a new draft.</li>
      </ul>
    </Box>
    <Box>
      <strong>Operational behaviours</strong>
      <ul>
        <li>Live edits are disabled; all changes are draft-scoped and sync to the Draft Budgets tab.</li>
        <li>Publish from Draft Budgets takes a safety snapshot, then replaces Active with the draft.</li>
        <li>Restoring a snapshot creates a new draft; it does not overwrite Active.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceBudgetStructureManagerHelp.aiContext =
  "Describe Structure manager: select a draft to create/edit pots (draft-only), copy Active to a new draft, capture/delete/restore snapshots (restore creates a new draft), and publish is triggered from Draft Budgets after staging.";

export default FinanceBudgetStructureManagerHelp;
