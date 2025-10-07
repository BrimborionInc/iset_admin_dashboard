import React from 'react';

const CaseAssignmentDashboardHelp = () => (
  <div>
  <h2>Manage ISET Applications workspace</h2>
    <p>
      Use this dashboard to triage newly submitted ISET applications, keep tabs on ageing caseloads, and direct work to the
      right assessor or coordinator. The board currently ships with a single <strong>ISET Applications</strong> widget that can
      be resized but not removed.
    </p>

    <h3>What you see</h3>
    <ul>
      <li>
        <strong>Case / Submission ID</strong> gives the tracking identifier linked to the intake submission. Select the inline
        <em>View</em> action to jump straight into the full application workspace.
      </li>
      <li>
        <strong>Status</strong> highlights whether the record is new, submitted, in review, or closed. Unassigned submissions
        show a yellow "Unassigned" chip to help coordinators prioritise triage.
      </li>
      <li>
        <strong>SLA Health</strong> displays an OK / Overdue badge based on the configured service standard, with tooltip text
        explaining the case age and expected due date.
      </li>
      <li>
        <strong>Owner</strong> names the assessor or coordinator who currently holds the file. Unassigned cases display an
        em dash so you can spot them quickly.
      </li>
      <li>
        <strong>Received</strong> shows the intake date. Combine this with the SLA badge to spot ageing submissions that still
        need an assignee.
      </li>
    </ul>

    <h3>Typical assignment flow</h3>
    <ol>
      <li>Filter or search within the table to locate cases by tracking ID, status, owner, or PTMA code.</li>
      <li>Select <em>Assign</em> on a submission that has not yet been claimed. Coordinators can also use <em>Reassign</em> when an
        existing owner needs to hand off the file.</li>
      <li>Pick the new owner from the staff list. If the submission is still in <em>Submitted</em> status, the workflow promotes it
        to <em>In Review</em> once the assignment succeeds.</li>
      <li>Confirm the success alert, then refresh the widget or trigger the board action to pull the latest data.</li>
      <li>Use <em>View</em> to open the application case dashboard whenever deeper assessment or document review is required.</li>
    </ol>

    <h3>Role-based visibility</h3>
    <ul>
      <li><strong>Program Administrators</strong> can browse every application.</li>
      <li><strong>Regional Coordinators</strong> see cases in their hub or region, plus any files assigned directly to them.</li>
      <li><strong>Assessors</strong> only see applications assigned to them.</li>
    </ul>

    <h3>Tips</h3>
    <ul>
      <li>Use the column preferences menu to hide data you do not need; the table remembers your choices per session.</li>
      <li>The refresh icon inside the widget retrieves the newest list without reloading the entire page.</li>
      <li>Watch for the success, warning, or error alerts that appear above the table after assignment attempts—they explain
        next steps if something fails.</li>
    </ul>
  </div>
);

CaseAssignmentDashboardHelp.aiContext = `You are assisting staff working on the "Manage ISET Applications" dashboard (route /case-assignment-dashboard) in the ISET Admin portal. The board currently contains the "ISET Applications" table widget which lists submissions with columns for tracking ID, status, SLA health, owner, and received date.

The table supports inline actions: **View** opens /application-case/{case_id}, **Assign** is available when a submitted case has no owner, and **Reassign** shows up for Program Administrators and Regional Coordinators on already owned files. Selecting Assign/Reassign opens a modal with a search-able staff list loaded from /api/staff/assignable.

When an assignment succeeds and the prior status was Submitted, the frontend automatically attempts to PUT /api/cases/{case_id} with status "in_review". Surface a reminder to refresh the widget (using the refresh icon) if the user does not see the change immediately.

Only Program Administrators can see every row. Regional Coordinators see their region's cases plus their own. Assessors only see cases assigned to them. Bring up these visibility rules when users ask why they cannot find a case.

If assignment fails, advise the coordinator to check the alert above the table for follow-up instructions, or try again after refreshing data.`;

export default CaseAssignmentDashboardHelp;
