import React from "react";

const CaseWorkspaceNewHelp = () => (
  <div>
    <h2>Case Management (new)</h2>
    <p>
      This configurable dashboard is the new home for case management widgets. Use the buttons in the
      header to open the widget palette or reset back to the default layout. As widgets become
      available you can drag, resize, and remove them the same way as the finance dashboards.
    </p>
    <p>
      The board starts empty so you can curate the workspace from scratch. When widgets are added,
      each one surfaces its own help link for detailed guidance.
    </p>
  </div>
);

CaseWorkspaceNewHelp.aiContext = `You are assisting with the new Case Management configurable dashboard. The board starts empty and users will add widgets over time. Provide high-level guidance on managing the layout, opening the palette, and resetting the dashboard.`;

export default CaseWorkspaceNewHelp;

