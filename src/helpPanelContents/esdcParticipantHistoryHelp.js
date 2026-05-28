import React from 'react';

const EsdcParticipantHistoryHelp = () => (
  <div>
    <p>
      Recent ILMP exports is an optional dashboard widget for previously downloaded batch XML files. Add it from the
      dashboard palette when you need to confirm what PATH generated, see who downloaded it, inspect which clients were
      exported, copy the XML, or requeue clients for a replacement export.
    </p>
    <ul>
      <li><strong>History table</strong>: file name, downloaded time, clients exported, and requeue action.</li>
      <li><strong>Summary</strong>: recorded file path/name, downloaded time, downloaded-by display name, and clients exported.</li>
      <li><strong>Clients exported</strong>: exported clients linked to the case workspace for follow-up.</li>
      <li><strong>XML</strong>: preview and copy the XML snapshot that PATH generated at the time of export.</li>
    </ul>
    <p>
      The requeue action returns every client in the export to the ILMP queue. PATH does not upload to ESDC from this
      widget; ESDC upload remains a manual step outside PATH.
    </p>
  </div>
);

EsdcParticipantHistoryHelp.aiContext = `
Widget help: Recent ILMP exports for downloaded participant batch XML files. Summary shows recorded file path/name, downloaded time, downloaded-by display name, and clients exported. Clients exported tab links clients to case workspaces. XML tab shows the stored XML snapshot generated at the point of export, not live XML regenerated from current client data. Requeue returns every client in that export to the ILMP queue for a replacement export. Use downloaded/exported/manual-upload wording; do not describe the batch as submitted or uploaded to ESDC by PATH.
`;

export default EsdcParticipantHistoryHelp;
