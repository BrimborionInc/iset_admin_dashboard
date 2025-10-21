import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceBudgetStructureManagerHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Govern the lifecycle for creating, editing, and publishing budget pots so finance teams can maintain an accurate
        hierarchy with clear audit traceability. Draft changes stay staged until they are formally published.
      </p>
    </Box>
    <Box>
      <strong>Key actions</strong>
      <ul>
        <li>
          <strong>Create pot</strong> &mdash; add new funding streams, programs, or delivery partners and capture baseline amounts,
          owners, and policy controls.
        </li>
        <li>
          <strong>Edit selected</strong> &mdash; update metadata or figures for the highlighted pot, clone structures, or retire
          unused entries.
        </li>
        <li>
          <strong>Drafts &amp; versions</strong> &mdash; review staged edits, publish the structure when ready, or capture snapshots for
          audit evidence.
        </li>
      </ul>
    </Box>
    <Box>
      <strong>Operational behaviours</strong>
      <ul>
        <li>New pots default to draft status until published; the hierarchy widget flags the change immediately.</li>
        <li>Publishing clears the draft queue, records a snapshot, and promotes the layout to downstream dashboards.</li>
        <li>Discard restores the last published structure if drafts are no longer required.</li>
        <li>Quick actions route to Allocations and Forecasting so teams can follow through on structural changes.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceBudgetStructureManagerHelp.aiContext =
  "Describe how the Budget Structure Manager lets finance teams create, edit, and publish pots, manage drafts and snapshots, and coordinate with allocations and forecasting workflows.";

export default FinanceBudgetStructureManagerHelp;
