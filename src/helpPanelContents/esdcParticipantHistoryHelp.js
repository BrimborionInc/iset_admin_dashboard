import React from 'react';

const EsdcParticipantHistoryHelp = () => (
  <div>
    <p>
      Recent participant submissions provides a simple audit trail of who submitted each client payload, when it was
      sent, and the resulting status from ESDC. Use it to confirm rejections have been followed up or to prove that a
      client was sent in the most recent batch.
    </p>
  </div>
);

EsdcParticipantHistoryHelp.aiContext = `
Widget help: Participant submission history table with submission timestamp, outcome, and notes.
`;

export default EsdcParticipantHistoryHelp;
