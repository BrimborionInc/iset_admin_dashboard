import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceBudgetHierarchyHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <p>
        Use this widget to see the live budget hierarchy (Active) and stage the next version (Draft Budgets) without
        disrupting current spend. Active stays authoritative; Drafts are where you prepare and publish changes.
      </p>
    </Box>
    <Box>
      <strong>How to work</strong>
      <ul>
        <li>
          Draft Budgets: Create a new empty draft or copy the current Active from “Drafts and Snapshots” in Structure
          manager. Edit draft pots there; Active remains untouched.
        </li>
        <li>
          Publish: When the draft is approved, publish it to replace Active. The prior Active is archived for reporting
          and retained as a snapshot for rollback.
        </li>
        <li>Selection: Picking a pot in Draft Budgets drives Structure manager “Edit selected.” Active is read-only.</li>
      </ul>
    </Box>
    <Box>
      <strong>When to use drafts</strong>
      <ul>
        <li>Mid-year replan: reshuffle regions/lines while live spend continues on the old structure.</li>
        <li>New fiscal: build next-year hierarchy ahead of go-live.</li>
        <li>Special initiatives: add temporary program pots and publish once approved.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceBudgetHierarchyHelp.aiContext =
  "Explain the Budget hierarchy widget from a business perspective: Active is live/read-only; Draft Budgets is staging; copy Active to draft, edit in Structure manager, publish with safety snapshot; use drafts for replans, new fiscal, special initiatives; selection in Drafts feeds Structure manager.";

export default FinanceBudgetHierarchyHelp;
