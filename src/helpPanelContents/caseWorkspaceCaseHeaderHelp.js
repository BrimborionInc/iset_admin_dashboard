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
      <li><strong>Quick actions:</strong> actions such as reassignment or PATH account activation, depending on the file and your role.</li>
    </ul>

    <h3>Best practice</h3>
    <ul>
      <li>Confirm you have the correct case before editing plans or finances.</li>
      <li>Update ownership after hand-offs so reminders and dashboards stay accurate.</li>
      <li>Use the PATH account status to decide whether secure online interaction with the participant is available yet.</li>
      <li>Refresh if another teammate has made changes elsewhere in the workspace.</li>
    </ul>
  </div>
);

CaseWorkspaceCaseHeaderHelp.aiContext = `You are helping a case manager using the case header widget in the Case Workspace. Explain it as the quick orientation panel for confirming the right participant, agreement context, ownership, and PATH account status before deeper casework begins. Mention reassignment and PATH account activation only when they are relevant to the visible controls.`;

export default CaseWorkspaceCaseHeaderHelp;
