import React from 'react';

const EsdcParticipantsHelp = () => (
  <div>
    <p>
      The ILMP Submissions &amp; Exports dashboard is where staff prepare participant ILMP XML files for manual
      upload outside PATH. Use it to see which clients are ready, fix validation blockers, and download the next
      export file.
    </p>
    <h3>Typical workflow</h3>
    <ol>
      <li>Run <strong>Validate all</strong> to refresh readiness for everyone currently in the queue.</li>
      <li>Open the linked case workspace for blocked records or warnings that need staff review.</li>
      <li>Use <strong>Generate batch XML</strong> when ready clients should be exported, then save or download the file.</li>
      <li>Upload the downloaded XML manually through the external ESDC process.</li>
      <li>Add <strong>Recent ILMP exports</strong> from the dashboard palette when you need to confirm a prior export, review the exported clients, inspect the XML snapshot, or requeue clients for a replacement file.</li>
    </ol>
    <p>
      PATH records that the clients were exported and keeps the generated XML for audit/requeue work. It does not
      upload participant data to ESDC from this dashboard.
    </p>
  </div>
);

EsdcParticipantsHelp.aiContext = `
ILMP Submissions & Exports dashboard: staff prepare participant ILMP XML files for manual upload outside PATH. Main flow: Validate all, fix blockers in the linked case workspace, Generate batch XML for ready clients, then save/download the XML and manually upload it through the external ESDC process. PATH records exported/downloaded clients and stores the generated XML snapshot; it does not directly submit or upload participant data to ESDC. Optional Recent ILMP exports shows prior downloaded files, clients exported, downloader display name, stored XML snapshot, and Requeue for replacement exports.
`;

export default EsdcParticipantsHelp;
