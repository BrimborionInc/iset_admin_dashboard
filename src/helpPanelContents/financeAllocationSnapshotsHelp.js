import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceAllocationSnapshotsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Maintain point-in-time snapshots of allocation balances so the organisation can reproduce numbers presented to
        boards, auditors, or ESDC on demand.
      </p>
    </Box>
    <Box>
      <strong>How snapshots behave</strong>
      <ul>
        <li>Each snapshot stores the balances, approvals, and commentary as of the capture date.</li>
        <li>Snapshots can be exported or restored into read-only views for auditors.</li>
        <li>Metadata tracks who captured the snapshot and why (e.g., board meeting, quarterly close).</li>
      </ul>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <p>
        Use snapshots to validate report narratives, answer monitoring queries, or seed variance analysis when
        comparing historical and current allocations.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceAllocationSnapshotsHelp.aiContext =
  "Describe the allocations snapshot widget: why snapshots are captured, what data they store, and how finance teams use them for governance, audit, and variance analysis.";

export default FinanceAllocationSnapshotsHelp;
