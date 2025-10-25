import React from "react";

const CaseWorkspaceFinancePanelHelp = () => (
  <div>
    <p>
      The finance panel shows allocations, commitments, and actuals for the case and its budget pots. Finance and program
      teams use it to reconcile spending before export.
    </p>

    <h3>Key features</h3>
    <ul>
      <li>Totals at the top provide instant variance and spend-to-date.</li>
      <li>Each pot row highlights overspend so coordinators can rebalance or remap costs.</li>
      <li>Future updates will expose posting status and integration with finance systems.</li>
    </ul>
  </div>
);

CaseWorkspaceFinancePanelHelp.aiContext = `You are assisting with the Finance Panel widget inside the Case Dashboard. It summarises allocated, committed, and actual costs along with per-pot status for the selected case.`;

export default CaseWorkspaceFinancePanelHelp;
