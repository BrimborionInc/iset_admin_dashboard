import React from 'react';

const PreviewNunjucksWidgetHelp = () => (
  <>
    <p>
      Shows the raw JSON for the selected step, useful for debugging and support. You can copy it
      to the clipboard using the action in the top-right of the code view.
    </p>
  </>
);

PreviewNunjucksWidgetHelp.aiContext = 'Help for Step JSON widget: inspecting and copying the JSON payload for a step.';

export default PreviewNunjucksWidgetHelp;
