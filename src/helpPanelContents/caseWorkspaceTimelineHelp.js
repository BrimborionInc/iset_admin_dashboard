import React from "react";

const CaseWorkspaceTimelineHelp = () => (
  <div>
    <h2>Case activity timeline</h2>
    <p>
      The events timeline is the case record&apos;s running audit trail. Use it to review status changes,
      reminders, assignments, document-request activity, and other key actions in the order they happened.
    </p>

    <h3>Working with the table</h3>
    <ul>
      <li>Use the search box to filter for keywords such as a status, event type, or staff member name.</li>
      <li>Sort by Date/Time to replay the file in order or focus on the latest activity first.</li>
      <li>Reminder rows include an action to acknowledge and clear the reminder when appropriate.</li>
      <li>Use the download action when you need a CSV copy of the timeline for review or audit support.</li>
    </ul>

    <h3>Operational use</h3>
    <ul>
      <li>Check the timeline before contacting the participant so you understand the latest activity on the file.</li>
      <li>Use it to confirm that important case actions were actually recorded after you update the file.</li>
      <li>During review or audit, use the timeline to show what changed, when it changed, and who triggered it.</li>
    </ul>
  </div>
);

CaseWorkspaceTimelineHelp.aiContext = `You are assisting a PATH case manager using the Events Timeline widget in the Case Workspace. Explain it as the case audit trail: how to read event messages, filter and sort the table, acknowledge reminders, and export CSV when needed. Focus on operational awareness, documentation quality, and audit readiness.`;

export default CaseWorkspaceTimelineHelp;
