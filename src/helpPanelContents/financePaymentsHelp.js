import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Manage batch payment submissions from draft through finance handoff. Packets group payment lines and evidence
        so submissions stay audit-ready.
      </p>
    </Box>
    <Box>
      <strong>What this dashboard covers</strong>
      <ul>
        <li>Batch queue: focus draft packets due for submission, blockers, and ageing.</li>
        <li>Detail: view line items and evidence checklist before submission.</li>
        <li>Communications: track outbound finance emails and follow-ups.</li>
        <li>SLA snapshot: spot bottlenecks across drafts and submissions.</li>
      </ul>
    </Box>
    <Box>
      <strong>Key rules</strong>
      <ul>
        <li>Required evidence must be received before submission.</li>
        <li>Recurrence and service-period requirements are enforced per payment type from Finance Settings.</li>
        <li>Submitting a packet emails finance and locks edits.</li>
        <li>Reporting unit and region metadata drive finance routing and audit context.</li>
      </ul>
    </Box>
    <Box>
      <strong>Quick start</strong>
      <ol>
        <li>Select a packet in the queue to load detail.</li>
        <li>Check evidence completeness and resolve missing items.</li>
        <li>Submit the packet to finance (email sent automatically).</li>
      </ol>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use queue filters to prioritise drafts, keep the communications log complete, and monitor SLA buckets to keep
        submissions moving.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentsHelp.aiContext =
  "Explain the Batch Payments dashboard: due-for-submission queue, detail view, communications log, and SLA snapshot. Include evidence gates, recurrence/service-period policy by payment type, and that submission emails finance and locks edits.";

export default FinancePaymentsHelp;
