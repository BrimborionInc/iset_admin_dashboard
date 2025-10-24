import React from 'react';

const EsdcParticipantQueueHelp = () => (
  <div>
    <p>
      The queue lists participants awaiting ESDC submission. Use the filters (to be wired later) to isolate blocked,
      ready, or in-progress records. Open the workspace to resolve issues or complete the submission workflow.
    </p>
    <p>
      Readiness badges use three states:
    </p>
    <ul>
      <li><strong>Ready</strong> (green) — all mandatory ILMP rules pass.</li>
      <li><strong>Needs review</strong> (orange) — no hard failures, but warnings exist (e.g., optional data missing or placeholders like “No Address”).</li>
      <li><strong>Blocked</strong> (red) — at least one hard validation failure that must be fixed before a payload can be sent.</li>
    </ul>
    <p>
      Columns include the community, readiness state, and the timestamp of the last validation run.
    </p>
  </div>
);

EsdcParticipantQueueHelp.aiContext = `
Widget help: Participant submission queue. Describe columns, readiness states, and how to open the workspace.
`;

export default EsdcParticipantQueueHelp;
