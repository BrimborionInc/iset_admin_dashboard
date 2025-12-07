import React from "react";
import { SpaceBetween, Box } from "@cloudscape-design/components";

const FinanceAllocationTransferWizardHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Workflow</strong>
      <p>
        Use the transfer wizard to propose a reallocation between budget pots. Capture source/destination, amount,
        required effective date, and a clear justification before routing to approvals.
      </p>
    </Box>
    <Box>
      <strong>Policy checks</strong>
      <p>
        Live guardrails show available balance, admin cap impact, and forecast variance. Amount must be positive and
        within source availability; effective date is mandatory. Inline validation highlights what to fix.
      </p>
    </Box>
    <Box>
      <strong>Evidence &amp; approvals</strong>
      <p>
        Add evidence entries (label/type) and upload supporting files. Submitted requests go to Pending approvals. Once
        approved, effective dates in the past/today auto-apply; future dates go to Pending transfers for scheduled
        apply.
      </p>
    </Box>
    <Box>
      <strong>Next steps</strong>
      <ul>
        <li>Submit to trigger approvals; review in Pending approvals.</li>
        <li>After approval: if effective date is future, apply from Pending transfers; otherwise it applies immediately.</li>
        <li>Review applied results and evidence in Transfers (Historical) and Budgets pot detail.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

FinanceAllocationTransferWizardHelp.aiContext =
  "Transfer wizard: fields (source/dest pot, amount>0 within availability, required effective date, justification, tags), live guardrails (availability, admin cap, forecast variance), evidence list with uploads. Submit sends to approvals; approved items auto-apply if effective date <= today, otherwise go to pending transfers for scheduled/manual apply. Applied transfers update budgets and retain evidence.";

export default FinanceAllocationTransferWizardHelp;
