import React from "react";

const CaseWorkspaceHelp = () => (
  <div>
    <p>
      The case workspace is where caseworkers and program admins update action plans, interventions, finances, and
      documentation for a single ISET case.
    </p>

    <h3>Workflow</h3>
    <ul>
      <li>Review the case header to confirm you&apos;re working with the correct client and agreement.</li>
      <li>Select an action plan, edit interventions, and attach required documents.</li>
      <li>Reconcile finance and compliance warnings before generating the ILMP and finance exports.</li>
    </ul>

    <h3>Next steps</h3>
    <ul>
      <li>Wire API hooks (`/api/cases`, `/api/action-plans`, `/api/interventions`, `/api/finance`, `/api/compliance`).</li>
      <li>Add optimistic updates and error handling for each widget&apos;s CRUD flow.</li>
      <li>Propagate validation results back to the portfolio dashboard so status badges stay current.</li>
    </ul>
  </div>
);

CaseWorkspaceHelp.aiContext = `You are guiding a user through the ISET Case Dashboard. It manages a single case with action plans, interventions, finance, compliance, documents, and export previews.`;

export default CaseWorkspaceHelp;
