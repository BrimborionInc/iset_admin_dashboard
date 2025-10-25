import React from "react";

const PortfolioSummaryMetricsHelp = () => (
  <div>
    <p>
      The summary strip aggregates high-level metrics for the cases currently visible in the portfolio table.
      It helps you spot workload peaks, overspends, and financial readiness without drilling into individual cases.
    </p>

    <h3>Included metrics</h3>
    <ul>
      <li><strong>Active cases</strong>: cases that are open or moving toward closure.</li>
      <li><strong>Ready to close</strong>: cases with clean ILMP and finance validation.</li>
      <li><strong>Overspends</strong>: cases exceeding allocation in their mapped budget pots.</li>
      <li><strong>Total FY Actuals &amp; variance</strong>: rolled-up spend and remaining headroom for the filtered set.</li>
    </ul>

    <h3>Best practices</h3>
    <ul>
      <li>Use this widget with table filters (owner, agreement, search) to create focused work queues.</li>
      <li>Where overspends appear, drill into the finance panel inside the case workspace to reconcile mappings.</li>
      <li>When ready-to-close counts climb, prioritise compliance review so export deadlines are met.</li>
    </ul>
  </div>
);

PortfolioSummaryMetricsHelp.aiContext = `You are assisting a manager reviewing the portfolio summary widget on the ISET Case Management dashboard. The widget rolls up active, ready-to-close, overspend counts, and financial totals for the current filters.`;

export default PortfolioSummaryMetricsHelp;
