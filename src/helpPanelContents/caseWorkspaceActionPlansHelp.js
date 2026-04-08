import React from "react";

const CaseWorkspaceActionPlansHelp = () => (
  <div>
    <p>
      Action plans organize the client&apos;s goals and the interventions that support them. They are the
      working roadmap for the case and should stay aligned with what the client is actually doing.
    </p>

    <h3>Common actions</h3>
    <ul>
      <li><strong>View plan:</strong> edit the plan name, summary, dates, and outcome details.</li>
      <li><strong>Client context:</strong> update shared case context such as education, employment goal, barriers, priorities, or childcare details.</li>
      <li><strong>Activate:</strong> move the plan into service when the client is actively working on it. Only one plan can be active at a time.</li>
      <li><strong>Close:</strong> record the result and completion date once the plan has actually reached an end point.</li>
      <li><strong>Archive:</strong> hide old or unused plans without losing the audit history.</li>
      <li><strong>New plan:</strong> start a fresh pathway when the client moves into a new phase of support.</li>
      <li><strong>Review date reminders:</strong> use review dates to create timely reminders for check-ins and case review.</li>
    </ul>

    <h3>Helpful tips</h3>
    <ul>
      <li>Align plan dates with the interventions underneath so reminders and reporting stay in sync.</li>
      <li>Use the summary to describe the client objective in plain language.</li>
      <li>Only keep one plan active, and close or archive the others cleanly.</li>
      <li>Consider archiving instead of deleting so past decisions remain available for audit or reference.</li>
    </ul>

    <h3>Imported client-file backloads</h3>
    <ul>
      <li>When a plan already existed before PATH go-live, start from <strong>Case header &gt; Add existing action plan</strong> instead of inventing intake or approval history.</li>
      <li>Backloaded plans should reflect the real historical or current state, including the real start date, status, and summary.</li>
      <li>If the historical plan is already closed, record the real close/result details so reporting and later intervention rules stay accurate.</li>
    </ul>
  </div>
);

CaseWorkspaceActionPlansHelp.aiContext = `You are assisting with the Action Plans widget in the Case Workspace. Explain action plans as the client's working roadmap, not just a data object. Emphasize keeping goals, dates, and shared client context accurate, using review dates for follow-up, and the rule that only one plan per case may be active at a time. Mention activate, close, archive, and create-new actions when relevant. If the question is about imported or application-less cases, explain that historical plans should be entered from \`Case header > Add existing action plan\` as a backload step, and that closed historical plans need their real result details recorded.`;

export default CaseWorkspaceActionPlansHelp;
