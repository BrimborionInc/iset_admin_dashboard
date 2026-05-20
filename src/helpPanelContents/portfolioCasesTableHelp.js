import React from "react";

const PortfolioCasesTableHelp = () => (
  <div>
    <p>
      The clients table lists the ISET client files you can access. It groups rows by client where possible,
      so a client with more than one case can be expanded to see the individual case rows.
    </p>
    <p>
      Use the search box to match client name, preferred name, case or application reference, or owner.
      Select a client or case row to open the case workspace.
    </p>

    <h3>Show filter logic</h3>
    <ul>
      <li><strong>Show Open Clients</strong>: client files in case lifecycle <strong>Initiated</strong>, <strong>Active</strong>, or <strong>Ready to close</strong>. Reporting-only denied or ineligible files are excluded.</li>
      <li><strong>Show Funded Clients</strong>: client files with at least one funded intervention amount greater than zero. The intervention can be approved, in progress, suspended, completed, or cancelled, so this view includes funded history as well as current funded work. Reporting-only denied or ineligible files are excluded.</li>
      <li><strong>Show Dormant Clients</strong>: client files in case lifecycle <strong>Dormant</strong>, <strong>Closed</strong>, or <strong>Archived</strong>. Reporting-only denied or ineligible files are excluded.</li>
      <li><strong>Show Denied / Ineligible Clients</strong>: files flagged as denied or ineligible for reporting-only tracking.</li>
      <li><strong>Show All Clients</strong>: all accessible case-management client files across Initiated, Active, Dormant, Ready to close, Closed, and Archived, including reporting-only denied or ineligible files.</li>
    </ul>

    <h3>Columns</h3>
    <ul>
      <li><strong>Client</strong>: client name. Expand grouped rows to see multiple cases for the same client.</li>
      <li><strong>Status</strong>: current case lifecycle status for the single case, or the primary case in a grouped row.</li>
      <li><strong>Owner</strong>: assigned case manager, or Unassigned.</li>
      <li><strong>Open tasks</strong>: open case tasks, with an overdue count when any are past due.</li>
      <li><strong>Open interventions</strong>: open intervention count over total intervention count.</li>
      <li><strong>Next action due</strong>: next open reminder due date for the case.</li>
      <li><strong>Last touch</strong>: the case's latest updated timestamp.</li>
    </ul>

    <h3>Tips</h3>
    <ul>
      <li>The search term persists for the browser session. The Show selector resets to Open Clients when the page is loaded again.</li>
      <li>Table preferences such as visible columns, page size, and column widths are saved in the browser.</li>
      <li>The list is still limited by your case access scope. Regional Managers and ISET Coordinators only see files the backend authorizes for their role and assignments.</li>
    </ul>
  </div>
);

PortfolioCasesTableHelp.aiContext = `You are helping an NWAC staff user with the ISET Clients table on /iset/cases. The widget groups accessible case-management files by client where possible and opens the case workspace from the client or case row. The search matches client name, preferred name, case/application reference, and owner. The Show selector sends clientCategory to /api/cases: Show Open Clients means case lifecycle initiated, active, or ready_to_close and excludes reporting-only denied/ineligible files; Show Funded Clients means at least one intervention with a positive approved/budget/intervention amount and effective status approved, in_progress, suspended, completed, or cancelled, excluding reporting-only files; Show Dormant Clients means dormant, closed, or archived, excluding reporting-only files; Show Denied / Ineligible Clients means case_context_json.reportingOnlyDenied or reportingOnlyDeniedIneligible is true; Show All Clients means accessible initiated, active, dormant, ready_to_close, closed, and archived files including reporting-only files. The default status set does not include intake-only application assessment files. Columns are Client, Status, Owner, Open tasks, Open interventions, Next action due, and Last touch.`;

export default PortfolioCasesTableHelp;
