import React from 'react';

const EsdcParticipantsHelp = () => (
  <div>
    <p>
      The ILMP Submissions &amp; Exports dashboard is the hub for preparing and downloading participant ILMP files for ESDC.
      It shows who is ready, what still needs fixing, and provides the batch export history.
    </p>
    <h3>Typical workflow</h3>
    <ol>
      <li>Run <strong>Validate all</strong> to refresh readiness for everyone in the queue.</li>
      <li>Use the queue and “Participants needing attention” to fix blockers/warnings in the participant workspace.</li>
      <li>Generate the batch XML when all required participants are validated, then download the file for upload to the portal.</li>
      <li>Use Recent ILMP exports to confirm what was downloaded and, if needed, mark a batch back to pending for re-export.</li>
    </ol>
    <p>
      The dashboard is aimed at program admins responsible for assembling and tracking ILMP submissions; it does not upload to ESDC, only prepares the compliant XML.
    </p>
  </div>
);

EsdcParticipantsHelp.aiContext = `
ILMP Submissions & Exports dashboard: queue + validation + batch generation + recent exports. Audience: program admins preparing/downloading ILMP XML files for upload to ESDC.
`;

export default EsdcParticipantsHelp;
