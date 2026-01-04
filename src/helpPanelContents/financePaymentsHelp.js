import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Coordinate evidence-gated payment packets between program teams and Finance. Each packet groups payment lines,
        evidence, approvals, and confirmations so disbursements stay audit-ready and align with Annual Reporting.
      </p>
    </Box>
    <Box>
      <strong>What this dashboard covers</strong>
      <ul>
        <li>Queue: prioritise packets by status, evidence completeness, and ageing.</li>
        <li>Detail: view line items, evidence checklist, approvals, and audit timeline.</li>
        <li>Communications: track outbound email sends and manual follow-ups.</li>
        <li>SLA snapshot: spot bottlenecks across review, batching, and confirmation.</li>
      </ul>
    </Box>
    <Box>
      <strong>Key rules</strong>
      <ul>
        <li>Required evidence must be received before advancing to finance review, batching, sent, or confirmed.</li>
        <li>Confirmed packets create posted finance transactions for reporting rollups.</li>
        <li>Reporting unit and region metadata drive finance routing and audit context.</li>
      </ul>
    </Box>
    <Box>
      <strong>Quick start</strong>
      <ol>
        <li>Select a packet in the queue to load detail.</li>
        <li>Check evidence completeness and resolve missing items.</li>
        <li>Send the packet to Finance and update status as it moves.</li>
        <li>Mark confirmed when proof of payment is on file.</li>
      </ol>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use queue filters to prioritise reviews, keep the communications log complete, and monitor SLA buckets to keep
        packets flowing toward confirmation.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentsHelp.aiContext =
  "Explain the Finance Payments dashboard: packet queue, detail view, communications log, and SLA snapshot. Include evidence gates, key statuses, and the fact that confirmed packets post finance transactions for reporting.";

export default FinancePaymentsHelp;
