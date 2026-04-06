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
        <li>Payment packet queue: focus draft packets due to be sent, blockers, and ageing.</li>
        <li>Detail: view line items and evidence checklist before sending.</li>
        <li>Communications: track outbound finance emails and follow-ups.</li>
        <li>SLA snapshot: spot bottlenecks across drafts and packets already sent to finance.</li>
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
        <li>Create a packet when a specific month, receipt, or claim period is ready.</li>
        <li>Select the packet in the queue to load detail and check evidence completeness.</li>
        <li>Send the packet to finance when it is ready.</li>
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
  "Explain the Payments dashboard: payment packet queue, detail view, communications log, and SLA snapshot. Include evidence gates, recurrence and service-period policy by payment type, that approved intervention funding is an authorization ceiling rather than a packet amount, and that sending a packet emails finance and locks edits.";

export default FinancePaymentsHelp;
