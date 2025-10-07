import React from 'react';

const IntakeStepLibraryWidgetHelp = () => (
  <>
    <p>
  Browse all intake steps, filter by name, and select one to preview. Use Modify to edit the
  selected step, Delete to remove it, or Create New Step to start a new one. The table now
  focuses on essentials: step name, last updated time, and quick actions.
    </p>
    <ul>
      <li>Click a step name to load it in the preview widgets.</li>
      <li>Use the filter box to quickly find a step.</li>
      <li>Use Modify to open the full Step Editor or Delete to remove unused steps.</li>
      <li>Refer to the Updated column to see when a step was last changed.</li>
    </ul>
  </>
);

IntakeStepLibraryWidgetHelp.aiContext = 'Help for Intake Step Library widget: browse intake steps by name, filter results, review last updated timestamps, and open modify/delete actions.';

export default IntakeStepLibraryWidgetHelp;
