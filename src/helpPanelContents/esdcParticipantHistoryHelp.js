import React from 'react';

const EsdcParticipantHistoryHelp = () => (
  <div>
    <p>
      Recent ILMP exports lists the batch XML files you generated, with metadata, participant roster, and the exact XML
      payload. Use it to confirm what was downloaded and to re-queue a batch if it needs to be regenerated.
    </p>
    <ul>
      <li><strong>Batch details</strong>: filename/path, checksum, size, export time.</li>
      <li><strong>Participants</strong>: linked to the case workspace for follow-up.</li>
      <li><strong>XML view</strong>: preview and copy the batch XML that was downloaded.</li>
    </ul>
    <p>
      The “Mark pending” action resets all participants in the batch back to pending so they return to the queue for a new export.
    </p>
  </div>
);

EsdcParticipantHistoryHelp.aiContext = `
Widget help: ILMP export history with batch metadata, participants, XML view, and mark-pending action.
`;

export default EsdcParticipantHistoryHelp;
