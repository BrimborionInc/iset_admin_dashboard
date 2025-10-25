import React from "react";

const CaseWorkspaceTimelineHelp = () => (
  <div>
    <p>
      The timeline assembles the history of action plans, interventions, and major updates so you can see the client&apos;s
      journey at a glance.
    </p>

    <h3>Guidance</h3>
    <ul>
      <li>Use it to verify start/end dates before exporting ILMP data.</li>
      <li>Upcoming events and overdue milestones will appear here once scheduling hooks are wired.</li>
      <li>Hover to see notes associated with each milestone.</li>
    </ul>
  </div>
);

CaseWorkspaceTimelineHelp.aiContext = `You are advising on the timeline widget within the Case Dashboard. It shows action plan and intervention events in chronological order.`;

export default CaseWorkspaceTimelineHelp;
