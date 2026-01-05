import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentRequestsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Manage draft and submitted payment packets. The queue highlights evidence completeness, risk flags,
        reporting units, and ageing so submissions stay audit-ready.
      </p>
    </Box>
    <Box>
      <strong>What the columns mean</strong>
      <ul>
        <li>Evidence: received vs required evidence for the packet and its lines.</li>
        <li>Stream: CRF and EI totals; used for funding stream rollups.</li>
        <li>Reporting unit: regional/partner attribution for routing and reporting.</li>
        <li>Age (days): time since submission; use to spot stale items.</li>
        <li>Risk flags: overdue evidence, exceptions, or duplicate warnings.</li>
      </ul>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Select a packet to load lines and evidence in the detail widget.</li>
        <li>Filter by queue state (draft vs submitted).</li>
        <li>Search by packet ID, client, intervention, reporting unit, or risk flags.</li>
        <li>Customise table columns, widths, and pagination via the settings cogwheel.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        When a packet status changes, the detail widget and SLA snapshot update to reflect the new queue mix.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentRequestsHelp.aiContext =
  "Explain the payment packet queue: columns (evidence, stream totals, reporting unit, age, risk flags), draft/submitted filters, and how selecting a row drives the detail widget.";

export default FinancePaymentRequestsHelp;
