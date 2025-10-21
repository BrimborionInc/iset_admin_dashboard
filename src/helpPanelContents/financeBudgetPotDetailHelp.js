import React from "react";
import { SpaceBetween, Box, Link } from "@cloudscape-design/components";

const FinanceBudgetPotDetailHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What this widget shows</strong>
      <p>
        Pot-level summary including allocation history, supporting evidence, approvals, and proportional administrative
        charges. It reflects the currently selected pot from the hierarchy widget.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Review the adjustment timeline to confirm who authorised changes and why.</li>
        <li>Check supporting evidence links before submitting reports or reallocations.</li>
        <li>Capture notes and attach references (Board minutes, ESDC correspondence) for audit readiness.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use the quick actions to jump into Forecasting for scenario testing or Allocations to initiate fund transfers
        with full context.
      </p>
      <Link href="/finance/allocations">Open Allocations workspace</Link>
    </Box>
  </SpaceBetween>
);

FinanceBudgetPotDetailHelp.aiContext = "Describe the pot detail widget: adjustment history, evidence, admin allocation, and how it links to reallocations and forecasting.";

export default FinanceBudgetPotDetailHelp;

