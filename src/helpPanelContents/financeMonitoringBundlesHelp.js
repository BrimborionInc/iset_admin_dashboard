import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceMonitoringBundlesHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Coordinate evidence bundles requested by auditors or ESDC, tracking status, delivery targets, and document counts.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Select bundles to mark progress (building, delivered) as artefacts are curated.</li>
        <li>Create new bundles when monitoring teams request additional documentation.</li>
        <li>Monitor target delivery dates to ensure submissions stay within agreed timelines.</li>
      </ul>
    </Box>
    <Box>
      <strong>Notes</strong>
      <p>
        Bundle metadata should include requester and timestamps so the audit trail reflects evidence handling from request through delivery.</p>
    </Box>
  </SpaceBetween>
);

FinanceMonitoringBundlesHelp.aiContext =
  "Explain the Monitoring evidence bundle widget: tracking bundle status, logging requests, and meeting delivery targets.";

export default FinanceMonitoringBundlesHelp;

