import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReportsExportHistoryHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Track every export package (XML, CSV, PDF) produced for submissions, along with acknowledgement status from ESDC.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Confirm which formats were generated, their envelope version, and distribution channel.</li>
        <li>Monitor whether acknowledgements have been received and follow up on pending items.</li>
        <li>Reference export hashes to reconcile against submitted artifacts or audit logs.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Export metadata should sync with the reporting engine and telemetry feeds so downstream monitoring can flag stale or rejected submissions.</p>
    </Box>
  </SpaceBetween>
);

FinanceReportsExportHistoryHelp.aiContext =
  "Explain the Financial Reports export history widget: tracking generated packages, channels, acknowledgements, and hashes.";

export default FinanceReportsExportHistoryHelp;

