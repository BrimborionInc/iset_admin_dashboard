import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceAllocationApprovalsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Monitor every in-flight reallocation request by approval stage so program managers, finance officers, and
        executives know which actions are outstanding.
      </p>
    </Box>
    <Box>
      <strong>How to use</strong>
      <ul>
        <li>Filter by stage or SLA status to focus on the tasks assigned to your role.</li>
        <li>Select a row to open the transfer details, justification, and attached evidence.</li>
        <li>Escalate items nearing SLA breach or missing mandatory documentation.</li>
      </ul>
    </Box>
    <Box>
      <strong>Automation</strong>
      <p>
        Status and due dates sync with the approval workflow engine so follow-up notifications, escalations, and audit
        logs stay aligned across teams.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceAllocationApprovalsHelp.aiContext =
  "Explain the allocations approvals queue: how stages, filters, and SLA indicators help teams progress transfers through each required reviewer.";

export default FinanceAllocationApprovalsHelp;
