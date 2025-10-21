import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentRequestsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Manage all submitted payment packets, including their PTMA region, amount, status, and supporting tags. Finance
        uses this queue to prioritise reviews and spot items approaching SLA deadlines.
      </p>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Select a packet to populate the detail widget with documents and actions.</li>
        <li>Filter by status or search by packet ID, region, or tag to narrow the list.</li>
        <li>Customise table columns, widths, and pagination via the settings cogwheel.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        When Finance moves a packet forward or marks it complete, the detail widget updates and the SLA snapshot
        recalculates in real time.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentRequestsHelp.aiContext =
  "Describe the payment request queue: filtering by status, selecting packets for review, and adjusting table preferences.";

export default FinancePaymentRequestsHelp;

