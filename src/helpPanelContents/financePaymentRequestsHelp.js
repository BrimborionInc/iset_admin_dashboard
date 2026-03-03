import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentRequestsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Process payment packets that are due for submission. This queue focuses on draft-stage work only
        and helps you submit ready packets to finance quickly.
      </p>
    </Box>
    <Box>
      <strong>What the columns mean</strong>
      <ul>
        <li>Evidence: received vs required evidence for the packet and its lines.</li>
        <li>Blocking reason: why a packet cannot be submitted yet (or Ready to send).</li>
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
        <li>Use the Ready only toggle to focus packets that can be sent now.</li>
        <li>Use table checkboxes to select packets, then Submit selected to open a preflight summary and submit ready packets in bulk.</li>
        <li>Search by packet ID, client, intervention, reporting unit, risk flags, or blocking reason.</li>
        <li>Customise table columns, widths, and pagination via the settings cogwheel.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        After bulk submission, review the result banner for any failed packet IDs, fix blockers in packet detail,
        and retry from the queue.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentRequestsHelp.aiContext =
  "Explain the due-for-submission batch payments queue: draft-only scope, blocking reason, Ready only toggle, checkbox multi-select with Submit selected preflight flow, row-to-detail behavior, and that blockers include evidence and payment-type recurrence policy checks.";

export default FinancePaymentRequestsHelp;
