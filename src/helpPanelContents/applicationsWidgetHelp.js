import React from 'react';

const ApplicationsWidgetHelp = () => (
  <div>
    <h2>ISET applications list</h2>
    <p>
      Use this table to find the application you need to work on, confirm where it sits in the
      process, and open the full application workspace. For coordinators, this is usually the list
      of files already assigned to you.
    </p>

    <h3>What to look at first</h3>
    <ul>
      <li><strong>Status:</strong> Check whether the file is newly submitted, in review, waiting on documents, or already with NWAC for approval.</li>
      <li><strong>Docs Requested badge:</strong> Use the age on the badge to see how long the applicant has been waiting to respond.</li>
      <li><strong>Timeline status and received date:</strong> Use these together to spot ageing files that need action now.</li>
      <li><strong>Owner:</strong> Confirm who is responsible for the file before taking further action.</li>
      <li><strong>View:</strong> Open the full Application Workspace to review the form, documents, notes, messaging, and assessment.</li>
    </ul>

    <h3>Working practice</h3>
    <ul>
      <li>Use the list selector in the widget header to switch between active, new, assessment, pending-decision, decision-recorded, approved, denied, closed, flagged, or all applications. All applications includes historical applications for the same client/case.</li>
      <li><strong>Active</strong> includes post-decision files that are still awaiting completion, such as approval-letter, funding-form, signature, or final-checklist follow-up.</li>
      <li>Search or sort the table when you need to find a specific applicant, tracking number, owner, province, or status.</li>
      <li>Refresh the widget after assignment changes or major updates made by another staff member.</li>
      <li>Use the Application Workspace for the real work: request documents, message the applicant, write notes, and complete the assessment there.</li>
      <li>Follow NWAC training expectations: acknowledge new applications promptly, document follow-up attempts, and keep every application tracked even when it is not funded.</li>
    </ul>

    <h3>Role visibility</h3>
    <ul>
      <li><strong>ISET Coordinators:</strong> See applications assigned to them.</li>
      <li><strong>Regional Managers:</strong> See their own files and files in scope for their region.</li>
      <li><strong>NWAC Administrators:</strong> See the full application list.</li>
    </ul>
  </div>
);

ApplicationsWidgetHelp.aiContext = `You are assisting staff using the ISET Applications table widget on the Manage ISET Applications dashboard. Keep answers practical and role-aware.

For coordinators, treat this table as the place to identify which assigned application needs attention and then open the full Application Workspace to do the actual assessment, messaging, document review, and note-taking.

Important guidance:
- Explain the meaning of the main columns in staff language: status, Docs Requested age, timeline status, owner, and received date.
- Explain that the header selector filters the server-paginated list by application status group, including Active, New, In Assessment, Pending Decision, Decision Recorded, Approved, Denied, Closed, My Flagged, and All.
- Explain that Active includes pending-completion application work and excludes only closed or archived application lifecycle rows. All Applications returns every matching application record, including historical applications for the same client/case.
- Tell users to use View to open /application-case/{case_id} for detailed work.
- Mention that coordinators only see applications assigned to them; regional managers and NWAC admins have broader scope.
- Mention Assign/Reassign only when the user has a role that can see those actions.
- Reinforce training expectations when relevant: contact applicants promptly, document follow-up attempts, keep all applications tracked, and avoid treating the table itself as the full case record.`;

export default ApplicationsWidgetHelp;
