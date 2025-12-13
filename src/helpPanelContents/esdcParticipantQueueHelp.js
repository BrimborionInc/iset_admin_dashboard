import React from 'react';

const EsdcParticipantQueueHelp = () => (
  <div>
    <p>
      The queue lists participants who currently need an ILMP submission. Use it to open a participant workspace, review
      validation, and decide when each client is ready for the next export batch.
    </p>
    <p>
      Readiness badges:
    </p>
    <ul>
      <li><strong>Ready</strong> (green) — all mandatory ILMP rules pass.</li>
      <li><strong>Needs review</strong> (orange) — no hard failures, but warnings exist (e.g., optional data missing or placeholders like “No Address”).</li>
      <li><strong>Blocked</strong> (red) — at least one hard validation failure that must be fixed before a payload can be sent.</li>
    </ul>
    <p>
      Columns include participant name, reference ID, readiness/submission state, and last validation time. Click a name to open the participant workspace for full validation and payload prep.
    </p>
  </div>
);

EsdcParticipantQueueHelp.aiContext = `
Widget help: ILMP export queue. Describe readiness states, columns, and opening the participant workspace to resolve issues.
`;

export default EsdcParticipantQueueHelp;
