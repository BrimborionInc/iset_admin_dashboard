import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Manage payment packets from draft through submission to finance. Each packet groups payment lines and evidence
        so submissions stay audit-ready and align with Annual Reporting.
      </p>
    </Box>
    <Box>
      <strong>What this dashboard covers</strong>
      <ul>
        <li>Queue: prioritise packets by draft vs submitted status, evidence completeness, and ageing.</li>
        <li>Detail: view line items and evidence checklist before submission.</li>
        <li>Communications: track outbound finance emails and follow-ups.</li>
        <li>SLA snapshot: spot bottlenecks across drafts and submissions.</li>
      </ul>
    </Box>
    <Box>
      <strong>Key rules</strong>
      <ul>
        <li>Required evidence must be received before submission.</li>
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
  "Explain the Finance Payments dashboard: packet queue, detail view, communications log, and SLA snapshot. Include evidence gates, draft/submitted statuses, and that submission emails finance and locks edits.";

export default FinancePaymentsHelp;
