import React from 'react';

const EsdcParticipantQueueHelp = () => (
  <div>
    <p>
      The queue combines ILMP readiness counts, bulk validation, and the participant list for export preparation. Use it
      to refresh validation, open the case workspace, and generate the next batch XML file.
    </p>
    <p>
      Use <strong>Validate all</strong> to refresh readiness for everyone in the queue before generating a batch. Use
      <strong> Generate batch XML</strong> when the ready records should be downloaded and marked as submitted.
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
      Columns include participant name, readiness, submission reason, and the first validation detail. Click a participant
      name to open the case workspace. Rows expand only when the participant has more than one submission/action plan row
      behind the grouped queue entry.
    </p>
  </div>
);

EsdcParticipantQueueHelp.aiContext = `
Widget help: combined ILMP participant validation/submission queue. Describe bucket readiness counts, Validate all, Generate batch XML/download marks ready records submitted, readiness states, columns, opening the case workspace, and expanded rows only for grouped multi-submission participants.
`;

export default EsdcParticipantQueueHelp;
