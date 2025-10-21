import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentCommsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Capture the audit trail of payment-related emails, templates, and attachments so Finance can prove when requests
        and confirmations were exchanged.
      </p>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Filter or search the table by payment ID, subject, or recipient to locate past messages.</li>
        <li>Log manual communications when offline channels (phone, Teams) generate follow-up actions.</li>
        <li>Review template usage to ensure standard request/confirmation wording is applied consistently.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Ensure the email service records message metadata and attachments automatically; use manual entries only when
        capturing offline conversations so the audit trail remains complete.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentCommsHelp.aiContext =
  "Describe the payment communications log: filtering, logging manual notes, and understanding template usage.";

export default FinancePaymentCommsHelp;
