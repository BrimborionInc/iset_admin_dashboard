import React from "react";

const RegionalSnapshotDashboardHelp = () => (
  <div>
    <p>
      Use this dashboard to review a saved regional snapshot for a selected month, quarter, or fiscal year.
      It combines live PATH counts with saved regional reporting inputs such as funding details, salary values, operating costs,
      compliance notes, and recommendations.
    </p>

    <h3>What You Can Review</h3>
    <ul>
      <li>Region information and reporting period for the selected snapshot.</li>
      <li>Applications received, funded, and denied or withdrawn during the selected period.</li>
      <li>Live client funding and salary figures for the region, plus saved operating values.</li>
      <li>Calculated totals and ratios based on the saved amounts and live funded count.</li>
      <li>Compliance flag and comments or recommendations for the selected reporting window.</li>
    </ul>

    <h3>Filters</h3>
    <ul>
      <li>Select the region, period type, fiscal year, and reporting period at the top of the page.</li>
      <li>Monthly, quarterly, and annual views use the same layout so snapshots stay easy to compare.</li>
    </ul>

    <h3>Editing</h3>
    <ul>
      <li>Admins can update the saved regional manager, regional manager, operating, compliance, and comments fields.</li>
      <li>Coordinator salary is pulled from the Salaries dashboard for the selected region and period.</li>
      <li>Totals and ratios are calculated automatically from the live and saved values on the snapshot.</li>
      <li>Live client activity counts remain read-only system values.</li>
    </ul>
  </div>
);

RegionalSnapshotDashboardHelp.aiContext = `
Regional Snapshot dashboard for management and Board-style regional reporting. Keep explanations concise and
plain-language. Explain that the page combines live PATH counts with saved regional reporting inputs for the
selected region and reporting period. Cover the region, period type, fiscal year, and period selectors. Explain
that applications received, funded, denied or withdrawn, client funding, and coordinator salary are live system
values, while operating, compliance, and comments fields are saved report inputs that admins can edit. Note that
totals and ratios are calculated automatically from the live and saved inputs and funded count.
`;

export default RegionalSnapshotDashboardHelp;
