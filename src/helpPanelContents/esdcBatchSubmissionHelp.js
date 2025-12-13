import React from 'react';

const EsdcBatchSubmissionHelp = () => (
  <div>
    <p>
      Use this widget to generate a single ILMP XML file for all participants who are validated and ready. It will
      block on any hard validation issues and prompt you to acknowledge warnings before proceeding.
    </p>
    <ol>
      <li>Run <strong>Validate all</strong> on the dashboard to refresh readiness for everyone in the queue.</li>
      <li>Click <strong>Generate batch XML</strong> to build the file (enabled only when the queue is populated and validated).</li>
      <li>Review the preview, then <strong>Download</strong> to save the XML. Downloading marks included participants as submitted.</li>
      <li>If a batch needs to be redone, use the Recent ILMP exports widget to “Mark pending” and re-export.</li>
    </ol>
    <p>
      Warnings can be bypassed with confirmation; blockers must be fixed in the participant workspace before a batch will generate.
    </p>
  </div>
);

EsdcBatchSubmissionHelp.aiContext = `
Widget help: ILMP batch submission/export. Steps: validate all, generate batch XML (gated by readiness), preview, download marks submitted, blockers stop generation, warnings need confirmation.
`;

export default EsdcBatchSubmissionHelp;
