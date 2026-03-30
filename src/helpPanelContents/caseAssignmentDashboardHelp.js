import React from 'react';

const CaseAssignmentDashboardHelp = () => (
  <div>
    <h2>Manage ISET Applications</h2>
    <p>
      This dashboard is the coordinator&apos;s application list. Use it to see the applications in your
      scope, confirm which ones need attention, and open the full Application Workspace for review,
      applicant follow-up, and assessment.
    </p>

    <h3>What this table tells you</h3>
    <ul>
      <li>
        <strong>Case / Submission ID:</strong> the tracking reference for the application. Use
        <em> View</em> to open the full file.
      </li>
      <li>
        <strong>Status:</strong> shows where the file is in the process, for example submitted, in
        review, docs requested, or pending approval.
      </li>
      <li>
        <strong>Docs Requested age:</strong> helps you see how long the file has been waiting on a
        response from the applicant.
      </li>
      <li>
        <strong>SLA Health:</strong> shows whether the file is on time or overdue against PATH&apos;s
        service timing.
      </li>
      <li>
        <strong>Owner:</strong> confirms who is responsible for the file.
      </li>
      <li>
        <strong>Received:</strong> helps you spot ageing applications and prioritize the oldest files
        first when needed.
      </li>
    </ul>

    <h3>Typical coordinator flow</h3>
    <ol>
      <li>Search or sort the table to find the assigned application you need to work on.</li>
      <li>Check status, docs age, and SLA health to understand what kind of follow-up is required.</li>
      <li>Use <em>View</em> to open the Application Workspace and review the form, documents, notes, and secure messages.</li>
      <li>Complete applicant follow-up, document review, and assessment in the workspace, then return here to move to the next file.</li>
      <li>Refresh the table when assignments or statuses have changed and you need the current list.</li>
    </ol>

    <h3>Role-based visibility</h3>
    <ul>
      <li><strong>NWAC Administrators</strong> can browse every application.</li>
      <li><strong>Regional Managers</strong> see cases in their hub or region, plus any files assigned directly to them.</li>
      <li><strong>ISET Coordinators</strong> only see applications assigned to them.</li>
    </ul>

    <h3>Training-aligned reminders</h3>
    <ul>
      <li>Contact applicants promptly and document follow-up attempts for missing information.</li>
      <li>Applications remain pending until documents, assessment, NWAC approval, and the signed Funding Agreement are complete.</li>
      <li>Every application must stay tracked, even when it will not be funded or is later closed.</li>
      <li>Use the table to find the file; use the workspace to record the actual work and audit trail.</li>
    </ul>
  </div>
);

CaseAssignmentDashboardHelp.aiContext = `You are assisting staff on the "Manage ISET Applications" dashboard (route /case-assignment-dashboard). This dashboard currently contains the ISET Applications table widget only. Do not describe a separate Application Work Queue here.

How to guide users:
- Treat the table as a list for finding the right application and opening the full Application Workspace.
- Explain the practical meaning of status, Docs Requested age, SLA health, owner, and received date.
- Use View to send the user to /application-case/{case_id} when they need to review the form, documents, messages, notes, or assessment.
- If the user cannot find a case, explain role visibility: coordinators only see assigned applications; regional managers and NWAC admins have broader scope.
- Mention Assign/Reassign only when relevant to the user’s role. Reassign is not the normal coordinator path here.

Training-aligned guidance:
- Prompt acknowledgement and documented follow-up matter more than board mechanics.
- Missing information should be followed up and recorded.
- Pending means the file is still moving through documents, assessment, NWAC approval, and signed agreement steps.
- All applications must remain tracked for audit, whether funded or not.
- Keep answers oriented to staff workflow and program expectations, not frontend implementation details.`;

export default CaseAssignmentDashboardHelp;
