import React from "react";

const CaseWorkspaceExportPreviewHelp = () => (
  <div>
    <p>
      Use the export preview to review ILMP XML and finance posting output before submitting to ESDC. Once all compliance
      checks pass, you can download the files for upload or transmission.
    </p>

    <h3>Workflow</h3>
    <ul>
      <li>Validate the case; resolve any compliance issues first.</li>
      <li>Review the ILMP XML tab to confirm participant data, action plans, and interventions look correct.</li>
      <li>Download the finance report to reconcile with internal finance systems before final posting.</li>
    </ul>
  </div>
);

CaseWorkspaceExportPreviewHelp.aiContext = `You are helping with the Export Preview widget on the Case Dashboard. It renders ILMP XML and finance posting previews and provides download buttons when validations pass.`;

export default CaseWorkspaceExportPreviewHelp;
