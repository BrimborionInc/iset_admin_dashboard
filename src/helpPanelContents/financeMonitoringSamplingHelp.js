import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceMonitoringSamplingHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Track sampling exercises driven by capacity-tier rules and monitoring findings so reviewers stay on schedule.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Filter by status to focus on queued, in-progress, or completed samples.</li>
        <li>Update progress and mark completion as reviewers finish their checks.</li>
        <li>Reassign samples when workloads shift or additional expertise is required.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Sample sizes and frequency should respect the organisation&rsquo;s capacity-tier sampling settings. Each set should carry rationale for audit traceability.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceMonitoringSamplingHelp.aiContext =
  "Explain the Monitoring sampling widget: filtering by status, updating completion, reassigning reviewers, and linking to capacity-tier rules.";

export default FinanceMonitoringSamplingHelp;
