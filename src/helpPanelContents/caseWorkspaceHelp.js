import React from "react";

const CaseWorkspaceHelp = () => (
  <div>
    <p>
      The case workspace brings everything about a single case into one configurable board. Drag widgets to match
      your workflow, resize them for more space, or remove items you do not need. The layout remembers your
      choices and can be reset at any time from the widget menu.
    </p>

    <h3>Getting orientated</h3>
    <ul>
      <li>Start with the Case header to double-check the client, agreement, and assigned teammate.</li>
      <li>Use the board navigation icons (⋮) to remove widgets or access additional settings.</li>
      <li>Select <em>Add widget</em> to open the palette and drag optional panels such as Finance or Compliance into view.</li>
    </ul>

    <h3>Working the case</h3>
    <ul>
      <li>Keep plans and interventions current so ILMP data, reminders, and reports reflect the latest decisions.</li>
      <li>Pin important notes or set follow-up dates to raise reminders on the Case calendar.</li>
      <li>Check Supporting documents and Secure messaging for new evidence or client updates before closing tasks.</li>
    </ul>

    <h3>Tips</h3>
    <ul>
      <li>Use the Reset layout button if a colleague needs the default view again.</li>
      <li>The workspace automatically refreshes after edits, but you can use individual widget refresh buttons to see team changes instantly.</li>
      <li>Calendar events combine action-plan milestones and reminders that you (or automation) create, giving a single view of upcoming obligations.</li>
    </ul>
  </div>
);

CaseWorkspaceHelp.aiContext = `You are guiding a case manager through the Case Workspace board. Explain how to move widgets, add from the palette, and use the header, plans, notes, calendar, documents, and messaging panels together to progress a case.`;

export default CaseWorkspaceHelp;
