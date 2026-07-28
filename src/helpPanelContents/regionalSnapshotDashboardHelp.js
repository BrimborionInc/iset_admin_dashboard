import React from "react";

const RegionalSnapshotDashboardHelp = () => (
  <div>
    <p>
      Use this dashboard to review a saved regional snapshot for a selected month, quarter, or fiscal year.
      It combines live PATH activity with saved regional reporting inputs such as operating costs,
      compliance notes, and recommendations.
    </p>

    <h3>What You Can Review</h3>
    <ul>
      <li>Region information and reporting period for the selected snapshot.</li>
      <li>Application activity assigned to the period by intervention start dates and scheduled approved-funding due dates. The application received date is used only when there is no dated intervention.</li>
      <li>Approved, denied/ineligible/withdrawn/NC, and pending rows always partition the same Applications Received total using each application's current outcome.</li>
      <li>CRF/EI funding is assigned to the period in which each positive approved funding occurrence is due. Recurring funding is split across its scheduled periods.</li>
      <li>Funded clients are shown with the funding metrics because they are a unique participant count, not an application-status bucket.</li>
      <li>Coordinator salary is pulled from the Salaries dashboard, with saved operating values shown beside it.</li>
      <li>Calculated totals and ratios based on the saved amounts and live funded-client count.</li>
      <li>Compliance flag and comments or recommendations for the selected reporting window.</li>
      <li>Any record needing attention appears in an expandable table showing the participant, application, intervention type, and a plain-English explanation.</li>
    </ul>

    <h3>Filters</h3>
    <ul>
      <li>Select the region, period type, fiscal year, and reporting period at the top of the page.</li>
      <li>Monthly, quarterly, and annual views use the same layout so snapshots stay easy to compare.</li>
    </ul>

    <h3>Editing</h3>
    <ul>
      <li>Admins can update the saved regional manager, coordinator, operating, compliance, and comments fields.</li>
      <li>Coordinator salary is pulled from the Salaries dashboard for the selected region and period.</li>
      <li>Totals and ratios are calculated automatically from the live and saved values on the snapshot.</li>
      <li>Live application activity, funded-client totals, and approved funding remain read-only system values.</li>
    </ul>
  </div>
);

RegionalSnapshotDashboardHelp.aiContext = `
Regional Snapshot dashboard for management and Board-style regional reporting. Keep explanations concise and
plain-language. Explain that the page combines live PATH counts with saved regional reporting inputs for the
selected region and reporting period. Cover the region, period type, fiscal year, and period selectors. Explain
that Client Activity assigns applications to periods using intervention start dates and scheduled positive
approved-funding due dates, falling back to the received date only when no dated intervention exists. The current
application outcome partitions Applications Received into approved, denied/ineligible/withdrawn/NC, and pending
rows. Funded clients are unique participants with a positive approved funding occurrence due in the period.
CRF/EI amounts allocate one-time and recurring approved funding occurrences to their scheduled due periods. Coordinator
salary is a live value from the Salaries dashboard, while operating, compliance, and comments fields are saved
report inputs that admins can edit. Note that totals and ratios are calculated automatically from the live and
saved inputs and funded-client count. Explain records needing attention in plain English, using the
participant, application, intervention type, reporting treatment, and corrective action shown in the table.
Do not describe funded clients as part of the Client Activity status breakdown.
`;

export default RegionalSnapshotDashboardHelp;
