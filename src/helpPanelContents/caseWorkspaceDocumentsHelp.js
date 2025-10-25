import React from "react";

const CaseWorkspaceDocumentsHelp = () => (
  <div>
    <p>
      Upload and manage supporting documents required for action plans and interventions. Each file is retained with the
      case record for audit and export checks.
    </p>

    <h3>Usage</h3>
    <ul>
      <li>Drag and drop files or use Upload to add PDFs, images, or spreadsheets.</li>
      <li>Future iterations will map documents to specific interventions or compliance rules.</li>
      <li>Use descriptive file names so finance and compliance teams can recognise records quickly.</li>
    </ul>
  </div>
);

CaseWorkspaceDocumentsHelp.aiContext = `You are assisting with the Documents widget on the Case Dashboard. It lists uploaded files and allows new uploads for the current case.`;

export default CaseWorkspaceDocumentsHelp;
