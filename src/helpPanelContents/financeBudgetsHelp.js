import React from "react";
import { SpaceBetween, Box, Link } from "@cloudscape-design/components";

const FinanceBudgetsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>The Budgets dashboard lets admins view the live (Active) budget hierarchy, stage changes in Drafts, and publish a new hierarchy when ready.</p>
    </Box>
    <Box>
      <strong>Key concepts</strong>
      <ul>
        <li><strong>Active Budget</strong>: Read-only view of the live hierarchy and amounts.</li>
        <li><strong>Draft Budgets</strong>: Staging area to review drafts, publish them, or restore a draft from a snapshot.</li>
        <li><strong>Structure manager</strong>: Edit the selected draft (create/update pots), copy Active to a new draft, and capture/restore snapshots.</li>
      </ul>
    </Box>
    <Box>
      <strong>Typical flows</strong>
      <ul>
        <li>Copy the Active hierarchy to a new draft, edit in Structure manager, then publish to replace Active.</li>
        <li>Restore a new draft from a saved snapshot, adjust, and publish.</li>
        <li>Use Active view for monitoring; all edits happen in Drafts/Structure manager.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <ul>
        <li>Publishing takes a snapshot for rollback, then replaces the live hierarchy.</li>
        <li>Active amounts reflect finance transactions; draft edits don’t affect spend until published.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceBudgetsHelp.aiContext =
  "Explain the Budgets dashboard: Active is read-only live hierarchy; Draft Budgets stages hierarchies and publishes; Structure manager edits drafts, copies Active to draft, captures/restores snapshots; publishing replaces Active after a safety snapshot.";

export default FinanceBudgetsHelp;
