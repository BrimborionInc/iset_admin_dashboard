import React from 'react';

const IntakeStepLibraryWidgetHelp = () => (
  <>
    <p>
      Browse all intake steps, filter by name, and select one to preview. Use Modify to edit the
      selected step, Delete to remove it, or Create New Step to start a new one.
    </p>
    <ul>
      <li>Click a step name to load it in the preview widgets.</li>
      <li>Use the filter box to quickly find a step.</li>
      <li>Use Modify to open the full Step Editor.</li>
    </ul>
  </>
);

IntakeStepLibraryWidgetHelp.aiContext = 'Help for Intake Step Library widget: browsing, filtering, selecting, and editing steps.';

export default IntakeStepLibraryWidgetHelp;
