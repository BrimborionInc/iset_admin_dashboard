import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinancePaymentCommsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Capture the audit trail of packet-related emails, templates, and attachments so Finance can prove when requests
        were sent.
      </p>
    </Box>
    <Box>
      <strong>What shows up here</strong>
      <ul>
        <li>Emails sent when packets are sent to finance.</li>
        <li>Manually logged outbound or inbound communications.</li>
        <li>Attachment counts for evidence bundles.</li>
      </ul>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Select a packet in the queue to focus the log on that packet, or clear selection to review all packets together.</li>
        <li>Filter or search the table by packet ID, subject, or recipient to locate past messages.</li>
        <li>Review template usage to ensure standard request wording is applied consistently.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use this log to confirm when packets were sent and which packets still need follow-up.
      </p>
    </Box>
  </SpaceBetween>
);

FinancePaymentCommsHelp.aiContext =
  "Explain the Batch Payments communications log: automatic email entries from packets sent to finance, packet-scoped versus all-packets viewing, filtering by packet or recipient, and how attachments support audit trails.";

export default FinancePaymentCommsHelp;
