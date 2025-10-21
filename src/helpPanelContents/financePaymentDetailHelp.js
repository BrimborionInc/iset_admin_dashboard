import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentDetailHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide Finance and program staff with a single place to review documents, notes, and action history for the
        selected payment packet.
      </p>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Review key metadata (amount, timeline, tags) alongside the list of uploaded documents.</li>
        <li>Trigger workflow actions, such as marking a payment complete or requesting confirmation documents.</li>
        <li>Use the document links to open EFT forms, invoices, or proofs of payment.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Actions taken here update workflow status, audit logs, and notification trails, so ensure the packet is complete
        before marking it paid.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentDetailHelp.aiContext =
  "Explain the payment detail widget: reviewing documents, updating status, and understanding packet metadata.";

export default FinancePaymentDetailHelp;
