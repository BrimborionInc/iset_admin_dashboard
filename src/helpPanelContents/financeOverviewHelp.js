import React from "react";

const FinanceOverviewHelp = () => (
  <div>
    <p>
      Leadership snapshot for agreement-wide financial health, compliance posture, and upcoming milestones.
    </p>

    <h3>Concept</h3>
    <p>
      Give Executive Directors and Finance Officers immediate insight into budget burn, administrative caps, monitoring
      status, and report readiness without drilling into individual sub-pages.
    </p>

    <h3>Key user goals</h3>
    <ul>
      <li>Assess current spend vs. budget and forecast year-end position at a glance.</li>
      <li>Track upcoming reporting deadlines, certification tasks, and XML submission status.</li>
      <li>Stay aware of compliance risks (capacity tier changes, outstanding findings, evidence coverage gaps).</li>
    </ul>

    <h3>Provisional widgets</h3>
    <ul>
      <li>KPI board tiles: total budget vs. spent, admin flat-rate utilised, evidence coverage, forecast variance.</li>
      <li>Trend chart showing month-by-month spend vs. forecasted spend.</li>
      <li>Compliance strip with capacity tier, next monitoring date, unresolved findings count.</li>
      <li>Deadline panel listing next interim/year-end report milestones and XML validation status.</li>
    </ul>

    <h3>Dependencies &amp; notes</h3>
    <ul>
      <li>Requires aggregation over all active agreements and sub-agreements.</li>
      <li>Should consume telemetry emitted by reporting service for submission and validation states.</li>
      <li>Expect to surface quick links that deep-link to Budgets, Reports, and Monitoring views with filters applied.</li>
    </ul>
  </div>
);

export default FinanceOverviewHelp;
