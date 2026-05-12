import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentDetailHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Show the selected packet's lines, evidence, validation state, finance handoff, and follow-up.
      </p>
    </Box>
    <Box>
      <strong>Packet overview</strong>
      <ul>
        <li>Reporting unit and case/client context.</li>
        <li>Baseline compliance status and risk flags.</li>
      </ul>
    </Box>
    <Box>
      <strong>Lines and evidence</strong>
      <ul>
        <li>Each line carries payee, amount, service period, pot, and line status.</li>
        <li>Use the packet for the specific claim being sent now; future months or later receipts should usually be separate packets.</li>
        <li>Service period and recurrence are enforced from Finance Settings recurrence policy per payment type.</li>
        <li>Evidence checklist shows required vs received items per line.</li>
        <li>Missing required evidence blocks sending.</li>
        <li>Missing payee details also block sending and are flagged by line after validation.</li>
      </ul>
    </Box>
    <Box>
      <strong>Actions</strong>
      <ul>
        <li>In the Payments dashboard or Case Workspace, use this widget to edit drafts, validate packets, send to finance, and log follow-up.</li>
        <li>In the finance oversight route, actions may be limited to inspection and follow-up depending on role and packet status.</li>
        <li>Use the queue selection to change which packet is shown here.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Actions here update the audit trail. Confirm required evidence is received before sending a packet.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentDetailHelp.aiContext =
  "Explain the Payments detail widget as the selected packet work surface: line items, recurrence and service-period policy by payment type, evidence checklist, validation/send controls, and follow-up state. Mention evidence and payee completeness gates and that packets should reflect the specific claim being sent now.";

export default FinancePaymentDetailHelp;
