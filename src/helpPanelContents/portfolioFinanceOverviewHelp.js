import React from "react";

const PortfolioFinanceOverviewHelp = () => (
  <div>
    <p>
      The finance overview compares each agreement’s allocation against the accumulated actual and committed costs.
      It highlights overspends and lets you pivot the case list to a specific agreement with a single click.
    </p>

    <h3>Usage</h3>
    <ul>
      <li>Hover over a bar to see allocation, actual, committed, and variance totals.</li>
      <li>Click a bar to apply a filter that keeps only cases from that agreement in the table and metrics.</li>
      <li>Use the clear filter action to return to the full portfolio view.</li>
    </ul>

    <h3>Next steps</h3>
    <p>
      Wire the widget to live finance APIs so allocation, commitment, and actual values stay current. Update variance rules
      when NWAC adds additional budget pot types or multi-agreement rollups.
    </p>
  </div>
);

PortfolioFinanceOverviewHelp.aiContext = `You are helping a finance analyst using the portfolio finance overview widget. The widget stacks actual+committed costs against remaining allocation per agreement and can filter the cases table when an agreement bar is selected.`;

export default PortfolioFinanceOverviewHelp;
