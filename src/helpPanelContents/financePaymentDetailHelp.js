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
        <li>Submit to finance emails the configured region address.</li>
        <li>Submission locks edits to lines and evidence.</li>
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
  "Explain the payment detail widget: line items, evidence checklist, and submit-to-finance action. Mention evidence gates and that submission emails finance and locks edits.";

export default FinancePaymentDetailHelp;
