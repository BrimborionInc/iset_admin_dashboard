import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentRequestsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Process payment packets that are due to be sent. Create separate packets for separate months,
        receipts, or claim periods, then use this queue to send the ready ones to finance.
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
        <li>Select a packet to load lines and evidence in the detail widget.</li>
        <li>Create packets for the specific claim you are sending, not the whole approved intervention by default.</li>
        <li>Use the Ready only toggle to focus packets that can be sent now.</li>
        <li>Use table checkboxes to select packets, then Send selected to open a preflight summary and send ready packets in bulk.</li>
        <li>Search by packet ID, client, intervention, reporting unit, risk flags, or blocking reason.</li>
        <li>Customise table columns, widths, and pagination via the settings cogwheel.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        After a bulk send, review the result banner for any failed packet IDs, fix blockers in packet detail,
        and retry from the queue.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentRequestsHelp.aiContext =
  "Explain the due-to-send payment packet queue: draft-only scope, blocking reason, Ready only toggle, checkbox multi-select with Send selected preflight flow, row-to-detail behavior, and that packets should be created for the specific month, receipt, or claim period being sent rather than defaulting to the whole approved intervention.";

export default FinancePaymentRequestsHelp;
