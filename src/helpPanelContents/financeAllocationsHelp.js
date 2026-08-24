import React from "react";
import { SpaceBetween, Box, Link } from "@cloudscape-design/components";

const FinanceAllocationsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Manage reallocations end-to-end: capture the request, enforce guardrails, route approvals, store evidence, and
        push applied balances back into Budgets/Forecasting with an audit-ready trail.
      </p>
    </Box>
    <Box>
      <strong>Core flow</strong>
      <p>
        Start in the Transfer wizard (source/destination, amount, effective date, justification, evidence). Requests go
        to Pending approvals. Approved items with an effective date today/past auto-apply; future-dated approvals land
        in Pending transfers for scheduled or manual apply. Applied transfers move into Historical transfers with
        before/after balances and evidence.
      </p>
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Initiate reallocations with clear source/destination context, amounts, dates, and justifications.</li>
        <li>Validate availability, admin cap impact, and effective date rules before submit.</li>
        <li>Approve/reject with evidence at hand; auto-apply or schedule based on effective date.</li>
        <li>Review applied transfers with before/after balances, approval chain, and linked evidence.</li>
        <li>Keep Budgets in sync (debit/credit pots, adjustments tab) and retain audit evidence.</li>
      </ul>
    </Box>
    <Box>
      <strong>Key widgets</strong>
      <ul>
        <li>Transfer wizard: required effective date, amount guardrails, evidence list + uploads.</li>
        <li>Pending approvals: proposed items; modal to approve/reject with evidence table.</li>
        <li>Transfers widget: Pending (approved future-dated; apply now or scheduled) and Historical (applied) with evidence and before/after balances.</li>
        <li>Snapshots/Policy widgets: optional context for governance and point-in-time reporting.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies &amp; notes</strong>
      <ul>
        <li>Only PATH administrators can approve or apply changes; the effective date controls immediate or scheduled application.</li>
        <li>Applied transfers write adjustments back to Budgets and update pot evidence lists.</li>
        <li>Evidence uploads use the allocations namespace in object storage; links are presigned when viewed.</li>
      </ul>
      <Link href="/finance/settings">Configure Finance policies</Link>
    </Box>
  </SpaceBetween>
);

FinanceAllocationsHelp.aiContext =
  "Allocations & Transfers workspace: wizard to propose transfers (source/dest, amount, effective date, justification, evidence uploads), approvals queue for proposed items, pending transfers for approved future-dated items, historical transfers for applied items with before/after balances and evidence. Auto-apply when effective date is today/past; future dates go pending or scheduled. Applied transfers update Budgets and keep evidence.";

export default FinanceAllocationsHelp;
