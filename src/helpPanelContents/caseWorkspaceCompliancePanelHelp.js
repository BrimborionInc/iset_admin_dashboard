import React from "react";

const CaseWorkspaceCompliancePanelHelp = () => (
  <div>
    <p>
      Compliance checks verify ILMP schema requirements and finance mappings before export. This panel highlights blocking
      issues that must be resolved before the ILMP XML or finance postings can be released.
    </p>

    <h3>Checklist</h3>
    <ul>
      <li>Run validation after editing interventions or budgets to refresh status badges.</li>
      <li>Resolve blocking errors (red) before exporting; warnings (blue) can be reviewed later.</li>
      <li>Future integrations will provide links from each message to the offending intervention or budget pot.</li>
    </ul>
  </div>
);

CaseWorkspaceCompliancePanelHelp.aiContext = `You are assisting with the Compliance widget on the Case Dashboard. It shows ILMP and finance validation results and blocks export until blocking errors are cleared.`;

export default CaseWorkspaceCompliancePanelHelp;
