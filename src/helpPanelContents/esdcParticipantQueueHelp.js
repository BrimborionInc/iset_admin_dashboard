import React from 'react';

const EsdcParticipantQueueHelp = () => (
  <div>
    <p>
      The participant submission queue is the working list for the next ILMP export. It combines readiness counts,
      bulk validation, linked case-workspace follow-up, and the <strong>Generate batch XML</strong> action.
    </p>
    <p>
      Use <strong>Validate all</strong> before generating a file so readiness reflects current case data. Use
      <strong> Generate batch XML</strong> when ready clients should be included in a downloaded XML file and marked
      as exported in PATH. Non-ready records are listed as excluded so they can be fixed without holding back ready
      clients.
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
    <p>
      Saving or downloading the XML does not upload it to ESDC. Staff still complete the external manual upload step
      after PATH creates the file.
    </p>
  </div>
);

EsdcParticipantQueueHelp.aiContext = `
Widget help: ILMP participant validation/export queue for the next manual ESDC upload file. Explain bucket readiness counts, Validate all, Generate batch XML, ready/non-ready exclusion behavior, and that saving/downloading marks included clients exported in PATH but does not upload to ESDC. Readiness states: Ready passes mandatory ILMP rules; Needs review has warnings but no hard blocker; Blocked has hard validation failures. Participant names open the case workspace. Expanded rows appear only for grouped clients with multiple submission/action-plan rows.
`;

export default EsdcParticipantQueueHelp;
