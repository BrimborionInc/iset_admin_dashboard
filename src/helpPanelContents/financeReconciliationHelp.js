import React from "react";
import { SpaceBetween, Box, Link } from "@cloudscape-design/components";

const FinanceReconciliationHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Monitor Sage Intacct REST submission attempts from PATH and understand which payment
        packets succeeded, failed, or partially uploaded.
      </p>
    </Box>
    <Box>
      <strong>Concept</strong>
      <p>
        Each time PATH submits a payment packet to Intacct (REST mode), the attempt is logged with
        outcome, reason, and any validation details. The dashboard surfaces the latest result per
        packet so program admins can quickly spot failures and resolve them back in the payment
        packet screens.
      </p>
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>See which packets failed Intacct submission and why.</li>
        <li>Confirm successful submissions and track partial attachment uploads.</li>
        <li>Navigate back to payment packets to fix validation issues and retry.</li>
      </ul>
    </Box>
    <Box>
      <strong>Provisional widgets</strong>
      <ul>
        <li>Submission queue with outcome + reason filters.</li>
        <li>Submission detail panel with Intacct error messages and attempt history.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies &amp; notes</strong>
      <ul>
        <li>Only packets with at least one Intacct REST submission attempt appear here.</li>
        <li>When PATH runs in email mode, no submission feedback is available.</li>
        <li>Fixes should be handled in payment packet workflows, then resubmitted.</li>
      </ul>
      <Link href="/finance/settings">Open Finance Settings</Link>
    </Box>
  </SpaceBetween>
);

FinanceReconciliationHelp.aiContext =
  "Explain the Intacct submissions dashboard: how the submission queue and detail view help track REST outcomes and resolve failures back in payment packets.";

export default FinanceReconciliationHelp;
