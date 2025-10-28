import React from "react";

const CaseWorkspaceActionPlansHelp = () => (
  <div>
    <p>
      Action plans group interventions, track client goals, and provide the data required for ILMP reporting.
      Use the action column to open the plan details modal, update metadata, and perform lifecycle changes.
    </p>

    <h3>What you can do</h3>
    <ul>
      <li><strong>View action plan</strong> &mdash; opens a full summary (status, lifecycle timestamps, result data, client context). From this modal you can edit the name, summary, and dates, then save or cancel.</li>
      <li><strong>Activate</strong> &mdash; promotes a draft plan to active. Only one plan per case can be active; the service prevents conflicts.</li>
      <li><strong>Close</strong> &mdash; records ILMP result code/date and optional outcome/closure notes once interventions are complete.</li>
      <li><strong>Archive</strong> &mdash; moves a draft or closed plan into read-only storage and hides it from future activation.</li>
      <li><strong>Create plan</strong> &mdash; start a new plan when a client begins a fresh program or goal.</li>
    </ul>

    <h3>Operational guidance</h3>
    <ul>
      <li>Keep start/review dates aligned with the interventions so timelines and ILMP exports remain accurate.</li>
      <li>Update the summary with key client context; the details modal shows a preview alongside the full context block.</li>
      <li>Closed or archived plans are read-only; re-open by creating a new draft instead of editing historical records.</li>
      <li>If the action dropdown is clipped, ensure the widget is not nested inside a constrained container; the component uses `expandToViewport` so menus should appear above the table.</li>
    </ul>
  </div>
);

CaseWorkspaceActionPlansHelp.aiContext = `You are assisting with the Action Plans widget in the Case Workspace. The widget lists plans, exposes a “View action plan” modal with inline editing, and provides lifecycle actions (activate, close, archive). Emphasise ILMP data requirements and the rule that only one plan per case may be active at a time.`;

export default CaseWorkspaceActionPlansHelp;
