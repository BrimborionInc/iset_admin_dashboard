import React from "react";

const CaseWorkspaceCaseHeaderHelp = () => (
  <div>
    <p>
      Use the case header as your quick briefing before you do anything else. It confirms whose file
      you are in, what agreement or case context is active, and who currently owns the case.
    </p>

    <h3>What to check</h3>
    <ul>
      <li><strong>Client profile:</strong> name, identifiers, region, and main contact information.</li>
      <li><strong>PATH account status:</strong> whether the participant can already use PATH or still needs activation support.</li>
      <li><strong>Agreement snapshot:</strong> agreement number, status, and key dates.</li>
      <li><strong>Ownership:</strong> who is responsible for the case right now.</li>
      <li><strong>Quick actions:</strong> actions such as reassignment, PATH account activation, <strong>View audit trail</strong>, or on imported/application-less files the backload actions <strong>Add existing action plan</strong>, <strong>Add existing intervention</strong>, and <strong>Upload existing documents</strong>.</li>
    </ul>

    <h3>Best practice</h3>
    <ul>
      <li>Confirm you have the correct case before editing plans or finances.</li>
      <li>Update ownership after hand-offs so reminders and dashboards stay accurate.</li>
      <li>Use the PATH account status to decide whether secure online interaction with the participant is available yet.</li>
      <li>On imported or application-less client files, use the backload quick actions here to record historical plans, interventions, and documents instead of creating fake intake history somewhere else.</li>
      <li>Remember that these backload actions are historical only: they save the record without starting approval, checklist, or applicant-notification workflow.</li>
      <li>Use <strong>View audit trail</strong> when you need the case record of status changes, reminders, and key actions.</li>
      <li>Refresh if another teammate has made changes elsewhere in the workspace.</li>
    </ul>
  </div>
);

CaseWorkspaceCaseHeaderHelp.aiContext = `You are helping a case manager using the case header widget in the Case Workspace. Explain it as the quick orientation panel for confirming the right participant, agreement context, ownership, and PATH account status before deeper casework begins. Mention reassignment, PATH account activation, and the audit-trail quick action only when they are relevant to the visible controls. When the file is imported or application-less, also explain that this header exposes the backload quick actions \`Add existing action plan\`, \`Add existing intervention\`, and \`Upload existing documents\` for recording pre-PATH history silently without starting approvals, checklist progression, or applicant notifications.`;

export default CaseWorkspaceCaseHeaderHelp;
