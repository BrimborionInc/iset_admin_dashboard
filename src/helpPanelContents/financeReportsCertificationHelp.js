import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReportsCertificationHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Manage certification tasks, capture signatory status, and ensure telemetry is ready before locking the report.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Review who must sign the report and whether digital certification is complete.</li>
        <li>Trigger reminders or mark signatures recorded once approvals arrive.</li>
        <li>Verify telemetry values (`agreement_id`, `report_id`, `validation_status`) before sending exports.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Completing certification locks the report, updates audit logs, and prepares export payloads so submissions can be sent without further edits.</p>
    </Box>
  </SpaceBetween>
);

FinanceReportsCertificationHelp.aiContext =
  "Describe the Financial Reports certification widget: signatory tracking, telemetry checks, and locking behaviour before submission.";

export default FinanceReportsCertificationHelp;
