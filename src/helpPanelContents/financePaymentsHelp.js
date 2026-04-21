import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Manage payment packets from draft through finance handoff. Packets group the specific payment lines and
        evidence being sent now; they are not the full approved intervention by default.
      </p>
    </Box>
    <Box>
      <strong>What this dashboard covers</strong>
      <ul>
        <li>Payment packet queue: focus current packets, blockers, and ageing.</li>
        <li>Detail: inspect the currently selected packet's lines, evidence, and draft Intacct payload.</li>
        <li>Communications: review outbound finance emails and follow-ups for the selected packet or across all packets.</li>
        <li>SLA snapshot: optional summary card available from the widget palette when needed.</li>
      </ul>
    </Box>
    <Box>
      <strong>Key rules</strong>
      <ul>
        <li>Required evidence must be received before sending.</li>
        <li>Recurrence and service-period requirements are enforced per payment type from Finance Settings.</li>
        <li>Approved intervention funding is the authorization ceiling; create separate packets for separate months, receipts, or claim periods.</li>
        <li>Sending a packet emails finance and locks edits.</li>
        <li>Reporting unit and region metadata drive finance routing and audit context.</li>
      </ul>
    </Box>
    <Box>
      <strong>Quick start</strong>
      <ol>
        <li>Use the queue filter to narrow the current oversight slice.</li>
        <li>Select one packet in the queue to inspect its detail and evidence.</li>
        <li>Review communications for that packet or clear selection to return to the broader picture.</li>
      </ol>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use queue filters to prioritise drafts, keep the communications log complete, and monitor SLA buckets to keep
        finance sends moving.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentsHelp.aiContext =
  "Explain the Batch Payments dashboard as an oversight view: single-packet queue selection drives the detail panel, communications can show the active packet or all packets, SLA snapshot is optional in the palette, approved intervention funding is an authorization ceiling rather than a packet amount, and sending a packet emails finance and locks edits in the program workflow.";

export default FinancePaymentsHelp;
