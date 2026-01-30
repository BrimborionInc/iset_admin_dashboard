import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentDetailHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide program staff with a single view of payment lines and evidence before submission to finance.
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
        <li>Evidence checklist shows required vs received items per line.</li>
        <li>Missing required evidence blocks submission.</li>
      </ul>
    </Box>
    <Box>
      <strong>Actions</strong>
      <ul>
        <li>Validate checks policy, evidence, and funding before submission.</li>
        <li>Submit to finance emails the configured region address.</li>
        <li>Submission locks edits to lines and evidence.</li>
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
        Actions here update the audit trail. Confirm required evidence is received before submitting a packet.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentDetailHelp.aiContext =
  "Explain the payment detail widget: line items, evidence checklist, validate step, submit-to-finance action, and the Intacct XML (Draft) preview tab. Mention evidence gates and that submission emails finance, locks edits, and the XML preview is read-only and not transmitted.";

export default FinancePaymentDetailHelp;
