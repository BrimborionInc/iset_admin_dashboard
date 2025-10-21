import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceReportsLifecycleHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Track each report through Draft → Validation → Certification → Submission so finance teams see blockers before due dates.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Select a report to view stage-by-stage status, due dates, and last updates.</li>
        <li>Advance stages as validation completes or submissions are sent to keep certification aligned.</li>
        <li>Use quick links to open Budgets or other dashboards when remediation is required.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Statuses should reflect reporting engine outputs and emit telemetry updates (`agreement_id`, `report_id`) each time the stage changes.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceReportsLifecycleHelp.aiContext =
  "Describe the Financial Reports lifecycle widget: stage tracking, advancing statuses, due dates, and telemetry expectations.";

export default FinanceReportsLifecycleHelp;

