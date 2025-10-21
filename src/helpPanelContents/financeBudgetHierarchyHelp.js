import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceBudgetHierarchyHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What this widget shows</strong>
      <p>
        A configurable tree or flat list of budget pots. Each node surfaces approved, adjusted, committed, actual, and
        remaining balances alongside forecast variance and administrative allocation.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Switch between tree and flat views to match the organisation&rsquo;s hierarchy complexity.</li>
        <li>Filter for overruns, underspend, or admin attribution to focus on pots that need intervention.</li>
        <li>Expand a pot to view children (funding streams, programs, delivery partners) with inline KPIs.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Select a pot to populate the detail panel, trigger reallocations, or open linked evidence in Monitoring and
        Reconciliation workspaces.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceBudgetHierarchyHelp.aiContext = "Explain the Budgets hierarchy widget: tree vs. flat view, filters for overruns, underspend, admin attribution, and how selection feeds other widgets.";

export default FinanceBudgetHierarchyHelp;

