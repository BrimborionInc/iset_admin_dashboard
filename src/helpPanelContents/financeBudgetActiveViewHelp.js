import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceBudgetActiveViewHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Show which saved view or dashboard preference set is currently applied so
        everyone understands the context for the hierarchy and downstream widgets.
      </p>
    </Box>
    <Box>
      <strong>How it works</strong>
      <ul>
        <li>Loading a saved view emits a dashboard event that updates this summary.</li>
        <li>The summary lists the preset filters (view mode, risk filter, timeframe, etc.).</li>
        <li>Clearing the summary resets the widget until the next view is loaded.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use this widget alongside the Saved views &amp; exports widget to confirm what the
        rest of the dashboard is showing before exporting or making reallocations.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceBudgetActiveViewHelp.aiContext =
  "Summarise the currently loaded budgets dashboard view and its presets.";

export default FinanceBudgetActiveViewHelp;

