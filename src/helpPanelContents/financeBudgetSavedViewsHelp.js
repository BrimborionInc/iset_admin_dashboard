import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceBudgetSavedViewsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Manage preset filters and pivots for the Budgets dashboard. Saved views capture hierarchy level, filters, and
        export preferences tailored to executive, program, or regional stakeholders.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Load a view to apply the associated filters across hierarchy, detail, and burn-rate widgets.</li>
        <li>Save new views after refining filters or hierarchy states for recurring governance reports.</li>
        <li>Export CSV or PDF snapshots to share with Boards, Program Managers, or ESDC partners.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Views should capture the target reporting timeframe and admin attribution assumptions to avoid confusion in
        downstream reconciliations.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceBudgetSavedViewsHelp.aiContext =
  "Explain how saved budget views capture filters, hierarchy states, and export settings for recurring management and governance reporting.";

export default FinanceBudgetSavedViewsHelp;
