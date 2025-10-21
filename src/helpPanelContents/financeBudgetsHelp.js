import React from "react";
import { SpaceBetween, Box, Link } from "@cloudscape-design/components";

const FinanceBudgetsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Center for configuring and tracking agreement budgets across funding streams, programs, and regions. This view
        keeps finance teams aligned on the current allocation story, upcoming pressure points, and required approvals.
      </p>
    </Box>
    <Box>
      <strong>Concept</strong>
      <p>
        Provide a flexible tree or flat grid of budget pots showing allocations, adjustments, commitments, remaining
        balance, burn-rate, and administrative attribution. Operators can drill into pot histories, annotate decisions,
        and stage reallocations or forecast tweaks.
      </p>
    </Box>
    <Box>
      <strong>Key user goals</strong>
      <ul>
        <li>Review approved vs. adjusted budgets and actual spend for every pot.</li>
        <li>Toggle between simple and multi-level hierarchies based on organisation complexity.</li>
        <li>Highlight overspend risk, underspend opportunity, and admin flat-rate utilisation.</li>
        <li>Capture annotations for approvals (Board resolutions, ESDC confirmations) tied to each adjustment.</li>
      </ul>
    </Box>
    <Box>
      <strong>Key widgets</strong>
      <ul>
        <li>Hierarchical budget tree with inline KPIs and quick filters (overrun risk, underspend, admin attribution).</li>
        <li>Pot detail panel summarising adjustments, evidence, and proportional admin allocation.</li>
        <li>Saved view selector by program, region, funding stream with export to CSV/PDF for governance packs.</li>
        <li>Burn-rate micro charts indicating pace versus plan across the fiscal year.</li>
      </ul>
    </Box>
    <Box>
      <strong>Dependencies &amp; notes</strong>
      <ul>
        <li>Requires budget hierarchy metadata and terminology defined in Finance Settings.</li>
        <li>Feeds Allocations, Reconciliation, and Forecasting workspaces with up-to-date pot balances.</li>
        <li>Must respect eligibility rules and administrative flat-rate limits configured in Finance Settings.</li>
      </ul>
      <Link href="/finance/settings">Review Finance Settings</Link>
    </Box>
  </SpaceBetween>
);

FinanceBudgetsHelp.aiContext =
  "Summarise the Budgets dashboard: manage pot hierarchy, track approvals and balances, monitor admin caps, and feed allocations, reconciliation, and forecasting workflows.";

export default FinanceBudgetsHelp;
