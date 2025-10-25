import React from "react";

const CaseWorkspaceActionPlansHelp = () => (
  <div>
    <p>
      Action plans organise the client&apos;s objectives and group interventions for reporting. Select a plan to edit its
      details or manage the linked interventions.
    </p>

    <h3>Workflow</h3>
    <ul>
      <li>Create a plan when the client begins a new program or goal.</li>
      <li>Close plans when all interventions are complete and finance has reconciled costs.</li>
      <li>Keep start/end dates accurate so the portfolio timeline and ILMP export align.</li>
    </ul>
  </div>
);

CaseWorkspaceActionPlansHelp.aiContext = `You are assisting with the Action Plans widget in the Case Dashboard. It lists action plans, allows selection, and supports add/edit/close flows for ILMP reporting.`;

export default CaseWorkspaceActionPlansHelp;
