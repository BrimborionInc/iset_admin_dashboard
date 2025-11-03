import React from "react";

const CaseWorkspaceCaseHeaderHelp = () => (
  <div>
    <p>
      Use the case header as your quick briefing. It highlights who the case belongs to, which agreement is in play,
      and which teammate is currently responsible. Review it before making changes so every update lands on the right
      record.
    </p>

    <h3>What to check</h3>
    <ul>
      <li><strong>Client profile:</strong> Name, identifiers, region, and primary contact information.</li>
      <li><strong>Agreement snapshot:</strong> Funding agreement number, status, start and end dates.</li>
      <li><strong>Ownership:</strong> Assigned staff member and escalation contacts. Reassign directly from this panel.</li>
      <li><strong>Quick actions:</strong> Refresh data, lock the case, or mark it ready to close once all steps are complete.</li>
    </ul>

    <h3>Best practice</h3>
    <ul>
      <li>Confirm you have the correct case before editing plans or finances.</li>
      <li>Update ownership after hand-offs so reminders and dashboards stay accurate.</li>
      <li>Refresh if another teammate has made changes elsewhere in the workspace.</li>
    </ul>
  </div>
);

CaseWorkspaceCaseHeaderHelp.aiContext = `You are helping a caseworker using the case header widget in the Case Dashboard. It shows client details, agreement number, owner, and provides quick actions like reassign or mark ready to close.`;

export default CaseWorkspaceCaseHeaderHelp;
