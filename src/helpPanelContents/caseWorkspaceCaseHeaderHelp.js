import React from "react";

const CaseWorkspaceCaseHeaderHelp = () => (
  <div>
    <p>
      The case header summarises key client and agreement information and provides quick actions to assign, refresh,
      or close the case.
    </p>

    <h3>Key fields</h3>
    <ul>
      <li>Client name, date of birth, and region.</li>
      <li>Current agreement number, owner, and status.</li>
      <li>Quick actions to refresh data, reassign, or mark ready to close.</li>
    </ul>

    <h3>When to use</h3>
    <p>
      Before editing intervention details, confirm ownership and agreement context so updates are saved to the right
      record and budget pot.
    </p>
  </div>
);

CaseWorkspaceCaseHeaderHelp.aiContext = `You are helping a caseworker using the case header widget in the Case Dashboard. It shows client details, agreement number, owner, and provides quick actions like reassign or mark ready to close.`;

export default CaseWorkspaceCaseHeaderHelp;
