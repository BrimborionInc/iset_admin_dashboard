import React from "react";
import { SpaceBetween, Box, Link } from "@cloudscape-design/components";

const FinanceAllocationsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Provide a dedicated workspace for reallocating funds while capturing the policy checks, approvals, and evidence
        trail that keep the organisation compliant with segregation-of-duties rules and ensure downstream budgets,
        forecasts, and reports reflect every approved transfer.
      </p>
    </Box>
    <Box>
      <strong>Concept</strong>
      <p>
        Structure the experience around a transfer wizard, approvals queue, and historical timeline so finance officers
        can propose changes, shepherd them through review, and reconcile the final outcome back to budgets and
        forecasting scenarios.
      </p>
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Initiate reallocations with clear source/destination context, amounts, dates, and justifications.</li>
        <li>Validate requests against availability, policy caps (including admin flat-rate), and reporting periods before submission.</li>
        <li>Manage multi-step approvals (Program Manager → Finance → Executive) with transparent status and SLA tracking.</li>
        <li>Review a complete audit history showing before/after balances, evidence, and linked board or ESDC approvals.</li>
        <li>Surface policy exceptions and required overrides with supporting documentation.</li>
      </ul>
    </Box>
    <Box>
      <strong>Key widgets</strong>
      <ul>
        <li>Transfer wizard card with validation summary, evidence uploads, and policy hints.</li>
        <li>Pending approvals board grouped by approver role with SLA indicators.</li>
        <li>Allocation timeline showing every approved transfer, user, timestamp, and before/after balances.</li>
        <li>Policy exceptions panel prompting overrides and capturing ESDC approval references.</li>
        <li>Snapshot view to show balances as of a specific date for board or audit queries.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies &amp; notes</strong>
      <ul>
        <li>Requires role-matrix integration to enforce segregation of duties and approval thresholds.</li>
        <li>Writes adjustments back into Budgets for real-time balances and Forecasting for projected impacts.</li>
        <li>Reuses evidence storage patterns from the Transactions &amp; Evidence registry.</li>
      </ul>
      <Link href="/finance/settings">Configure Finance policies</Link>
    </Box>
  </SpaceBetween>
);

FinanceAllocationsHelp.aiContext =
  "Describe the Allocations & Transfers workspace: initiating reallocations, managing approvals, auditing history, resolving policy exceptions, and maintaining balance snapshots.";

export default FinanceAllocationsHelp;
