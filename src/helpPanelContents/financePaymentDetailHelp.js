import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentDetailHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide Finance and program staff with a single view of packet metadata, payment lines, evidence checklists,
        approvals, and status history.
      </p>
    </Box>
    <Box>
      <strong>Packet overview</strong>
      <ul>
        <li>Total amount and stream split (CRF vs EI).</li>
        <li>Reporting unit and case/client context.</li>
        <li>Baseline compliance status and risk flags.</li>
      </ul>
    </Box>
    <Box>
      <strong>Lines and evidence</strong>
      <ul>
        <li>Each line carries payee, amount, service period, pot, and line status.</li>
        <li>Evidence checklist shows required vs received items per line.</li>
        <li>Missing required evidence blocks key status changes.</li>
      </ul>
    </Box>
    <Box>
      <strong>Actions</strong>
      <ul>
        <li>Send to finance logs an outbound email to the configured region address.</li>
        <li>Update status to move through review, batching, sent, and confirmed.</li>
        <li>Mark confirmed when proof of payment is attached.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Actions here update the audit trail. Confirmed packets post finance transactions for reporting, so verify
        evidence completeness before advancing a packet.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentDetailHelp.aiContext =
  "Explain the payment detail widget: packet metadata, line items, evidence checklist, approvals/timeline, and actions (send to finance, status updates, mark confirmed). Mention evidence gates and that confirmation posts transactions.";

export default FinancePaymentDetailHelp;
