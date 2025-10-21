import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceAllocationTransferWizardHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Workflow</strong>
      <p>
        Use the transfer wizard to propose a reallocation between budget pots. Capture the source and destination
        context, amount, effective date, and the justification the approvals chain will review.
      </p>
    </Box>
    <Box>
      <strong>Policy checks</strong>
      <p>
        As you complete the form the widget calculates key guardrails: available balance, admin flat-rate impact, and
        forecast variance. Address warnings before submitting to keep processing smooth.
      </p>
    </Box>
    <Box>
      <strong>Evidence &amp; approvals</strong>
      <p>
        Attach supporting documents (board minutes, ESDC approvals) and tag the request so the pending approvals queue
        can route it to the right approvers.
      </p>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <ul>
        <li>Submit the transfer to trigger the approval workflow.</li>
        <li>Track progress in the Approvals queue and Timeline widgets.</li>
        <li>Review updated balances in Budgets once the transfer is committed.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceAllocationTransferWizardHelp.aiContext =
  "Explain the allocations transfer wizard: required fields, live policy checks, evidence attachments, and how submitted requests flow into approvals and budgets.";

export default FinanceAllocationTransferWizardHelp;
