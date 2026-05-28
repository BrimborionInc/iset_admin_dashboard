import React from 'react';

const EsdcBatchSubmissionHelp = () => (
  <div>
    <p>
      The standalone Batch submission widget has been retired from the default dashboard. The same workflow now lives in
      the Participant submission queue header as <strong>Generate batch XML</strong>.
    </p>
    <ol>
      <li>Run <strong>Validate all</strong> on the dashboard to refresh readiness for everyone in the queue.</li>
      <li>Click <strong>Generate batch XML</strong> in the queue header to build the file (enabled only when at least one participant is ready).</li>
      <li>Save or download the XML. Downloading marks included participants as submitted.</li>
      <li>If a batch needs to be redone, add Recent ILMP exports from the palette and use “Mark pending” before re-exporting.</li>
    </ol>
    <p>
      The batch modal lists excluded participants so staff can correct them without blocking ready clients from going out.
    </p>
  </div>
);

EsdcBatchSubmissionHelp.aiContext = `
Widget help: historical ILMP batch submission/export copy. Current workflow is in Participant submission queue: validate all, generate batch XML for ready participants only, preview, download marks included participants submitted, and non-ready participants are excluded automatically instead of stopping the whole batch.
`;

export default EsdcBatchSubmissionHelp;
