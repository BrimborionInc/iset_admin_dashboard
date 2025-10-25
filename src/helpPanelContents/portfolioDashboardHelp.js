import React from "react";

const PortfolioDashboardHelp = () => (
  <div>
    <p>
      The portfolio dashboard is your landing page for ISET case management. It combines queue controls, finance signals,
      and quick navigation into individual case workspaces.
    </p>

    <h3>Key actions</h3>
    <ul>
      <li>Search or filter the cases table to focus on clients, owners, or agreements.</li>
      <li>Use the finance overview to find agreements that need pot mapping or reconciliation.</li>
      <li>Select a case row to open the detailed case dashboard where you can manage action plans and interventions.</li>
    </ul>

    <h3>Tips</h3>
    <ul>
      <li>Filters persist through the session, so you can return to the same queue after refreshing.</li>
      <li>Supervisors can save snapshots by exporting the table to CSV for reporting.</li>
      <li>When cases reach “Ready to Close”, confirm compliance in the case workspace before exporting to ILMP.</li>
    </ul>
  </div>
);

PortfolioDashboardHelp.aiContext = `You are guiding a user through the ISET Case Management portfolio dashboard. It features summary metrics, a finance overview, and the cases table that opens the case workspace when a row is selected.`;

export default PortfolioDashboardHelp;
