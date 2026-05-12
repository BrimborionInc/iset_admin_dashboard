import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentRequestsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Review payment packets at a queue level and pick one packet at a time for deeper inspection.
      </p>
    </Box>
    <Box>
      <strong>What the columns mean</strong>
      <ul>
        <li>Evidence: received vs required evidence for the packet and its lines.</li>
        <li>Blocking reason: why a packet cannot be sent yet, or why it is already ready to send.</li>
        <li>Stream: CRF and EI totals; used for funding stream rollups.</li>
        <li>Reporting unit: regional/partner attribution for routing and reporting.</li>
        <li>Age (days): time since the packet was sent to finance; use to spot stale items.</li>
        <li>Risk flags: overdue evidence, exceptions, or duplicate warnings.</li>
      </ul>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Select one packet in the queue to load lines and evidence in the detail widget.</li>
        <li>Use the queue filter to switch between unsubmitted, sent, blocked, and overdue slices.</li>
        <li>Create packets for the specific claim you are sending, not the whole approved intervention by default.</li>
        <li>Search by packet ID, client, intervention, reporting unit, risk flags, or blocking reason.</li>
        <li>Customise table columns, widths, and pagination via the settings cogwheel.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use the selected packet's detail view to inspect evidence completeness, validate the packet, send it to finance, or record follow-up.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentRequestsHelp.aiContext =
  "Explain the Payments queue as an operational list: single-packet selection drives the detail panel, queue filters slice the packet list, blocking reason and schedule indicate attention, and packets should be created for the specific month, receipt, or claim period being sent rather than defaulting to the whole approved intervention.";

export default FinancePaymentRequestsHelp;
