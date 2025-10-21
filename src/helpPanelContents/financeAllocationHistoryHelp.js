import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceAllocationHistoryHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide a full audit timeline of completed reallocations so finance teams can reference who approved what, when,
        and with which supporting evidence.
      </p>
    </Box>
    <Box>
      <strong>Key details captured</strong>
      <ul>
        <li>Before/after balances for source and destination pots.</li>
        <li>Justification text and links to supporting evidence.</li>
        <li>Approval chain with timestamps and policy notes.</li>
      </ul>
    </Box>
    <Box>
      <strong>Usage</strong>
      <p>
        Filter the timeline to answer board, audit, or ESDC questions. Export the view when preparing narrative sections
        of financial reports.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceAllocationHistoryHelp.aiContext =
  "Describe the allocations history timeline: which data points are captured and how finance teams use it for audit, governance, and reporting enquiries.";

export default FinanceAllocationHistoryHelp;
