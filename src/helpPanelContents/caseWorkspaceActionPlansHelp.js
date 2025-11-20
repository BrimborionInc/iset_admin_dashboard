import React from "react";

const CaseWorkspaceActionPlansHelp = () => (
  <div>
    <p>
      Action plans organise the client&apos;s goals and link the interventions that deliver them. They are the core of
      ILMP reporting, so keep their status and dates accurate.
    </p>

    <h3>Common actions</h3>
    <ul>
      <li><strong>View plan:</strong> Open the summary to edit the name, description, key dates, and outcome details.</li>
      <li><strong>Activate:</strong> Move a draft into service when work begins. Only one plan can be active per case.</li>
      <li><strong>Close:</strong> Record the result code and completion date once every intervention is finished.</li>
      <li><strong>Archive:</strong> Hide closed or unused drafts from the main list while preserving the history.</li>
      <li><strong>New plan:</strong> Start a fresh goal pathway when the client begins a new phase of support.</li>
      <li><strong>Review date reminders:</strong> Setting a review date will create or update a calendar reminder for the case (assigned to the plan owner if available). Clearing the review date cancels the reminder.</li>
    </ul>

    <h3>Helpful tips</h3>
    <ul>
      <li>Align plan start and review dates with the interventions underneath so reminders and exports stay in sync.</li>
      <li>Use the summary field to capture the client objective-this text appears in the details panel alongside context.</li>
      <li>Consider archiving instead of deleting so past decisions remain available for audit or reference.</li>
    </ul>
  </div>
);

CaseWorkspaceActionPlansHelp.aiContext = `You are assisting with the Action Plans widget in the Case Workspace. The widget lists plans, exposes a "View action plan" modal with inline editing, and provides lifecycle actions (activate, close, archive). Emphasise ILMP data requirements and the rule that only one plan per case may be active at a time.`;

export default CaseWorkspaceActionPlansHelp;
