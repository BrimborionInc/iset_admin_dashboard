import React from 'react';

const EsdcSubmissionHistoryHelp = () => (
  <div>
    <p>
      The submission history widget records who exported client payloads, when they were generated, and the downstream
      response from ESDC. Use it to support audits and to quickly identify failed transmissions that need follow-up.
    </p>

    <h3>Details tracked</h3>
    <ul>
      <li>Timestamp and user identity of each export.</li>
      <li>Filename or package identifier used during transmission.</li>
      <li>Result (accepted, rejected, pending) and any error description from ESDC.</li>
    </ul>

    <h3>Best practices</h3>
    <ul>
      <li>Ensure comments explain rejections so future reviewers understand remediation steps.</li>
      <li>Keep the history in sync with transport logs for complete traceability.</li>
      <li>Use this trail when responding to compliance reviews or data subject requests.</li>
    </ul>
  </div>
);

EsdcSubmissionHistoryHelp.aiContext = `
Widget help: Maintain audit trail of ILMP client exports—timestamps, user, filename, ESDC response, rejection notes.
`;

export default EsdcSubmissionHistoryHelp;
