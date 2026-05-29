import React from "react";

const PortfolioDashboardHelp = () => (
  <div>
    <p>
      The ISET Clients dashboard is the case-management landing page for client files after they have entered the
      case lifecycle. It gives staff a configurable board of widgets, with the Clients table as the default view.
    </p>
    <p>
      This dashboard is not the application assessment intake queue. The Clients table defaults to open case-management
      files and does not include intake-only application files that have not entered the case lifecycle.
    </p>

    <h3>Key actions</h3>
    <ul>
      <li>Use <strong>Add widget</strong> and <strong>Reset layout</strong> to manage the dashboard board.</li>
      <li>Use the Clients widget <strong>Show</strong> selector to move between Open, Funded, No Active Plan, Denied / Ineligible, and All client views.</li>
      <li>Search the Clients table by client name, preferred name, reference number, case number, or owner.</li>
      <li>Select a client or case row to open the case workspace for action plans, interventions, notes, documents, messages, and case finance work.</li>
    </ul>

    <h3>Client view logic</h3>
    <ul>
      <li><strong>Open</strong>: Initiated, Active, and Ready to close case lifecycle files.</li>
      <li><strong>Funded</strong>: files with at least one positive funded intervention amount, including approved, active, suspended, completed, or cancelled funded interventions.</li>
      <li><strong>No Active Plan</strong>: No Active Plan, Closed, and Archived lifecycle files.</li>
      <li><strong>Denied / Ineligible</strong>: reporting-only denied or ineligible files.</li>
      <li><strong>All</strong>: accessible case-management files across the listed lifecycle states, including reporting-only files.</li>
    </ul>

    <h3>Tips</h3>
    <ul>
      <li>Your role and assignments still limit which client files appear.</li>
      <li>The Clients widget search persists for the browser session; table column preferences are saved in the browser.</li>
      <li>When a case is Ready to close, complete closure and compliance work from the case workspace.</li>
    </ul>
  </div>
);

PortfolioDashboardHelp.aiContext = `You are guiding a user through the ISET Clients dashboard at /iset/cases. This is the case-management client-file dashboard, not the application assessment intake queue. The board can contain widgets such as Clients, Client summary, and Finance overview; the default layout shows the Clients table. The Clients table opens the case workspace and has a Show selector: Open = initiated/active/ready_to_close case lifecycle files; Funded = files with at least one positive funded intervention amount in approved, in_progress, suspended, completed, or cancelled effective status; No Active Plan = dormant/closed/archived; Denied / Ineligible = reporting-only denied/ineligible files; All = accessible initiated/active/dormant/ready_to_close/closed/archived files including reporting-only files. The persisted value remains dormant, but staff-facing labels say No Active Plan. Role and assignment scope still limit results.`;

export default PortfolioDashboardHelp;
