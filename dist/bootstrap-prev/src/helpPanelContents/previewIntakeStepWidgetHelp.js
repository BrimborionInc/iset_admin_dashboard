import React from 'react';

const PreviewIntakeStepWidgetHelp = () => (
  <>
    <p>
      Renders the selected step using the same Nunjucks templates as the public portal. Use the
      Language dropdown to switch between English and French. Bilingual fields are flattened to the
      selected language to avoid rendering issues.
    </p>
  </>
);

PreviewIntakeStepWidgetHelp.aiContext = 'Help for Preview widget: Nunjucks rendering and language switching for bilingual content.';

export default PreviewIntakeStepWidgetHelp;
