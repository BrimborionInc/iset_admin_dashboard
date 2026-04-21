import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentDetailHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide a read-only inspection view of the selected packet's lines, evidence, and draft Intacct payload.
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
        <li>This finance view is inspection-only; create, edit, validate, and send actions happen in the program workflow.</li>
        <li>Use the queue selection to change which packet is shown here.</li>
      </ul>
    </Box>
    <Box>
      <strong>Intacct XML preview</strong>
      <ul>
        <li>Use the "Intacct XML (Draft)" tab to review a demo-only AP Bill payload.</li>
        <li>Preview is read-only, uses Draft status, and is not transmitted.</li>
        <li>Missing required fields are flagged in the preview.</li>
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
  "Explain the Batch Payments detail widget as a read-only inspection panel: line items, recurrence and service-period policy by payment type, evidence checklist, and the Intacct XML draft preview. Mention evidence and payee completeness gates, that packets should reflect the specific claim being sent now, and that edit/validate/send actions live in the program workflow rather than this finance overview.";

export default FinancePaymentDetailHelp;
