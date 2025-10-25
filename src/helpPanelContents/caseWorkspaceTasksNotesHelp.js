import React from "react";

const CaseWorkspaceTasksNotesHelp = () => (
  <div>
    <p>
      Track tasks, follow-ups, and collaboration notes related to the case. Notes sync with the portfolio dashboard so
      teams can triage at a glance.
    </p>

    <h3>Best practices</h3>
    <ul>
      <li>Record who you contacted and when to support audit requirements.</li>
      <li>Use the upcoming integration with reminders to set due dates for outstanding items.</li>
      <li>Keep sensitive information out of notes until security tagging is implemented.</li>
    </ul>
  </div>
);

CaseWorkspaceTasksNotesHelp.aiContext = `You are assisting a coordinator using the Tasks & notes widget inside the Case Dashboard. It lists notes and allows adding follow-ups for the current case.`;

export default CaseWorkspaceTasksNotesHelp;
