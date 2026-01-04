import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentCommsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Capture the audit trail of packet-related emails, templates, and attachments so Finance can prove when requests
        and confirmations were exchanged.
      </p>
    </Box>
    <Box>
      <strong>What shows up here</strong>
      <ul>
        <li>Emails sent from the packet detail view (Send to finance).</li>
        <li>Manually logged outbound or inbound communications.</li>
        <li>Attachment counts for evidence bundles and confirmations.</li>
      </ul>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Filter or search the table by packet ID, subject, or recipient to locate past messages.</li>
        <li>Log manual communications when offline channels (phone, Teams) generate follow-up actions.</li>
        <li>Review template usage to ensure standard request/confirmation wording is applied consistently.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use manual entries only for offline conversations so the audit trail stays complete and consistent.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentCommsHelp.aiContext =
  "Explain the payment communications log: automatic email entries from Send to finance, manual log entries, filtering by packet/subject/recipient, and how templates/attachments support audit trails.";

export default FinancePaymentCommsHelp;
