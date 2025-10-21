import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Coordinate payment packets between program teams and Finance. Each packet carries the EFT form, invoice,
        supporting documents, and confirmation trail so NWAC/PTMA finance can process disbursements with full audit
        visibility.
      </p>
    </Box>
    <Box>
      <strong>Workflow</strong>
      <ol>
        <li>Program staff submit a payment packet (EFT form, invoice, justification).</li>
        <li>Finance reviews, attaches proof of payment, and updates the packet status.</li>
        <li>Communications log captures request and confirmation emails for audit purposes.</li>
        <li>SLA metrics highlight packets nearing their due date or awaiting confirmation.</li>
      </ol>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use the queue filters to prioritise reviews, update packet status as confirmations arrive, and ensure supporting
        documents remain attached so audit queries can be resolved quickly.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentsHelp.aiContext =
  "Describe the Finance Payments dashboard: how the Payment Requests queue triages packets, the Payment Packet Detail widget manages documents and status updates, the communications log records request/confirmation emails, and the SLA snapshot highlights ageing or overdue packets.";

export default FinancePaymentsHelp;
