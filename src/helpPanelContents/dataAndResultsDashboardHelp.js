import React from "react";

const DataAndResultsDashboardHelp = () => (
  <div>
    <p>
      Use this dashboard to review annual results, quarterly submissions, and reporting notes in
      one place. By default, Intake and Assessment appears first under the report controls,
      followed by Interventions, and the other sections remain available below. You can remove
      sections you do not need and add them back later from the page header.
    </p>

    <h3>What You Can Review</h3>
    <ul>
      <li>Monthly or cumulative new, approved, and denied application counts by participant home province or territory.</li>
      <li>Annual targets and year-end results for the selected fiscal year.</li>
      <li>Quarterly submission due dates, receipt dates, and current status.</li>
      <li>Interventions, client results, ILMP data upload submissions, and action plan status counts for the selected fiscal year.</li>
      <li>Additional comments for the selected fiscal year.</li>
    </ul>

    <h3>Filters</h3>
    <ul>
      <li>Filter the report by participant home province or territory, case manager, and fiscal year.</li>
      <li>Use Results view to switch the matrix sections between cumulative values and monthly values.</li>
      <li>Use the Intake and Assessment section controls to switch between new, approved, and denied applications and to filter the province rows shown in that table.</li>
      <li>New application counts use submission month. Approved and denied counts currently use the application record&apos;s latest status update as the decision-month proxy.</li>
      <li>Use the Interventions section controls to switch that table between count and cost, choose completed, planned, active, or cancelled interventions, and change how intervention activity is grouped.</li>
      <li>When Interventions is set to Cost, values are shown by payment month; completed interventions use actual cost when available and other statuses use planned cost.</li>
      <li>In live data mode, select a non-zero value in Intake and Assessment or Interventions to open the contributing records inline directly beneath the clicked row.</li>
      <li>The drilldown list stays anchored to the clicked row and links each applicant or participant name to the related application workspace or case workspace when available.</li>
      <li>In cumulative view, a clicked month shows records from the fiscal year start through that month. In monthly view, it shows only the records in that month, except Final which still represents the full fiscal-year total.</li>
      <li>Use Demo mode when you want to view sample figures instead of current reporting data.</li>
      <li>Province or territory and case manager filters apply across the report sections below.</li>
      <li>Quarterly Data Uploads applies to the agreement as a whole, so it does not change with province or territory or case manager filters.</li>
      <li>Use Add section and Reset layout in the page header to restore removed sections or return to the default report layout.</li>
    </ul>

    <h3>Editing</h3>
    <ul>
      <li>Admins can update the annual target values shown in the Overall Results section.</li>
      <li>Admins can update the Additional Comments section for each fiscal year.</li>
      <li>All other dashboard content is shown as read-only report information.</li>
    </ul>
  </div>
);

DataAndResultsDashboardHelp.aiContext = `
Data and Results dashboard for management and NWAC reporting review. Keep explanations concise,
plain-language, and focused on what the report shows. Cover intake and assessment application counts
by province or territory, annual targets and year-end results, quarterly submissions, interventions,
client results, ILMP data upload submissions, action plan statuses, and fiscal-year comments.
Explain that the report can be filtered by participant home province or territory, case manager,
and fiscal year. Explain that Results view switches the matrix sections between cumulative and
monthly values. Explain that the Intake and Assessment section has its own show selector for new,
approved, or denied applications plus a province-row text filter. Explain that in live mode,
non-zero values in Intake and Assessment and Interventions open inline contributing-record lists
directly beneath the clicked row, and those lists link names to the related application or case
workspace when available. Note that new applications use
submission month, while approved and denied applications currently use the application record's
latest status update as the decision-month proxy. Explain that the Interventions section also has
its own show, status, and date-basis controls. Explain that when Interventions is set to cost,
amounts are shown by payment month and completed interventions use actual cost when available.
Explain that Demo mode shows sample data instead of current reporting data. Note that Quarterly
Data Uploads is agreement-wide and does not change with province/territory or case manager filters.
Explain that report sections are shown as removable board items and can be restored from the page
header. Note that admin users can update annual targets and Additional Comments for the selected
fiscal year.
`;

export default DataAndResultsDashboardHelp;
