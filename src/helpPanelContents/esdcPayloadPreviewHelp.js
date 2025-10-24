import React from 'react';

const EsdcPayloadPreviewHelp = () => (
  <div>
    <p>
      The payload preview renders the XML that will be shared with ESDC for this client. It mirrors the client segment
      of the ILMP data exchange schema and should be reviewed before export for accuracy and privacy considerations.
    </p>

    <h3>Usage tips</h3>
    <ul>
      <li>Confirm personally identifiable information (PII) matches the source records before downloading.</li>
      <li>Use the download button to save the XML, or copy it into downstream tooling for testing.</li>
      <li>If the preview looks stale, refresh the readiness widgets to regenerate the payload from the latest data.</li>
    </ul>

    <h3>Security</h3>
    <ul>
      <li>Handle downloaded files according to NWAC’s secure transmission policies.</li>
      <li>Clean up local copies once the submission is successfully transmitted.</li>
    </ul>
  </div>
);

EsdcPayloadPreviewHelp.aiContext = `
Widget help: Show generated ILMP client XML payload with options to download or copy. Validate sensitive fields before export.
`;

export default EsdcPayloadPreviewHelp;
