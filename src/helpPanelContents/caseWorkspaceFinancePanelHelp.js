import React from "react";

const CaseWorkspaceFinancePanelHelp = () => (
  <div>
    <p>
      The finance panel shows approved funding, payment requests sent to finance, and PATH-recorded actuals for the case
      and its budget pots. It supports case planning and follow-up across the operations/finance handoff.
    </p>

    <h3>Key features</h3>
    <ul>
      <li>Totals show variance using approved, committed, and recorded-actual amounts.</li>
      <li>Each pot row highlights overspend so coordinators can rebalance or remap costs.</li>
      <li>Recorded actuals are PATH-side confirmations or historical backloads; Finance/Sage remains the financial record.</li>
    </ul>
  </div>
);

CaseWorkspaceFinancePanelHelp.aiContext = `You are assisting with the Finance Panel widget inside the Case Dashboard. It summarises approved funding, payment requests sent to finance, and PATH-recorded actuals by pot for the selected case. Explain the Finance/Sage distinction in help guidance when relevant, without turning normal widget labels into warnings.`;

export default CaseWorkspaceFinancePanelHelp;
