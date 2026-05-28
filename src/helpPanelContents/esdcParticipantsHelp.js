import React from 'react';

const EsdcParticipantsHelp = () => (
  <div>
    <p>
      The ILMP Submissions &amp; Exports dashboard is the hub for preparing and downloading participant ILMP files for ESDC.
      It shows who is ready, what still needs fixing, and prepares the batch XML for download.
    </p>
    <h3>Typical workflow</h3>
    <ol>
      <li>Run <strong>Validate all</strong> to refresh readiness for everyone in the queue.</li>
      <li>Use the queue detail column to fix blockers/warnings in the case workspace.</li>
      <li>Generate the batch XML from the queue header when required participants are validated, then download the file for upload to the portal.</li>
      <li>Add Recent ILMP exports from the dashboard palette if you need to confirm a prior download or mark a batch back to pending for re-export.</li>
    </ol>
    <p>
      The dashboard is aimed at program admins responsible for assembling and tracking ILMP submissions; it does not upload to ESDC, only prepares the compliant XML.
    </p>
  </div>
);

EsdcParticipantsHelp.aiContext = `
ILMP Submissions & Exports dashboard: combined participant queue with validation, bucket readiness counts, batch XML generation/download, and optional recent exports history. Audience: program admins preparing/downloading ILMP XML files for upload to ESDC.
`;

export default EsdcParticipantsHelp;
