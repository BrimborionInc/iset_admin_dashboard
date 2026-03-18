import React from 'react';

const EsdcBatchSubmissionHelp = () => (
  <div>
    <p>
      Use this widget to generate a single ILMP XML file for all participants who are validated and ready. It will
      include only ready participants in the batch. Records that are blocked or still need review stay out of the file automatically.
    </p>
    <ol>
      <li>Run <strong>Validate all</strong> on the dashboard to refresh readiness for everyone in the queue.</li>
      <li>Click <strong>Generate batch XML</strong> to build the file (enabled only when at least one participant is ready).</li>
      <li>Review the preview, then <strong>Download</strong> to save the XML. Downloading marks included participants as submitted.</li>
      <li>If a batch needs to be redone, use the Recent ILMP exports widget to “Mark pending” and re-export.</li>
    </ol>
    <p>
      The widget lists excluded participants so staff can correct them in Application Workspace or Participant Workspace without blocking ready clients from going out.
    </p>
  </div>
);

EsdcBatchSubmissionHelp.aiContext = `
Widget help: ILMP batch submission/export. Steps: validate all, generate batch XML for ready participants only, preview, download marks included participants submitted, and non-ready participants are excluded automatically instead of stopping the whole batch.
`;

export default EsdcBatchSubmissionHelp;
