import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceAllocationPolicyHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Surface policy exceptions and required overrides early so reallocations stay compliant with admin caps, funding
        rules, and agreement conditions.
      </p>
    </Box>
    <Box>
      <strong>What to watch</strong>
      <ul>
        <li>Admin flat-rate overages that need ESDC approval references.</li>
        <li>Capital or restricted-use pots that demand pre-approval.</li>
        <li>Segregation-of-duties conflicts if requester and approver roles overlap.</li>
      </ul>
    </Box>
    <Box>
      <strong>Actions</strong>
      <p>
        Each policy warning links to supporting guidance and capture fields for documenting the override. Resolve these
        before submission to avoid workflow rejections.
      </p>
    </Box>
  </SpaceBetween>
);

FinanceAllocationPolicyHelp.aiContext =
  "Explain the allocations policy exceptions panel: which risks it flags, how overrides are documented, and how compliance teams use the information.";

export default FinanceAllocationPolicyHelp;
