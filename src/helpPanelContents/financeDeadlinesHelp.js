import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const FinanceDeadlinesHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Surface the next finance deliverables across reporting, monitoring, and compliance so leadership can see what
        needs attention and who owns each task.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Scan the table for due dates, owners, and current status of each milestone.</li>
        <li>Use the <em>Next step</em> link on any row to jump directly into the workflow for that task.</li>
        <li>Leverage the action buttons to open the reporting calendar, adjust notification rules, or create reminders.</li>
      </ul>
    </Box>
    <Box>
      <strong>Data sources &amp; behaviour</strong>
      <ul>
        <li>Reporting milestones sync with the finance reporting service and respect CR-0003 cadence settings.</li>
        <li>Monitoring tasks originate from the evidence/monitoring workspace and reflect capacity-tier sampling rules.</li>
        <li>Compliance follow-ups pull from sub-agreement variance tracking.</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Align default notification thresholds in Finance Settings so reminder intensity matches your organisation&apos;s operating rhythm.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceDeadlinesHelp.aiContext = "Explain the finance deadlines widget: upcoming reporting, monitoring, and compliance milestones plus shortcuts to calendar, notifications, and reminder tools.";

export default FinanceDeadlinesHelp;
