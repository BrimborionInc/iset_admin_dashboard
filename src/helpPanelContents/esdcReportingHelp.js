import React from 'react';

const EsdcReportingHelp = () => (
  <div>
    <p>
      The reporting dashboard tracks quarterly and annual agreement submissions. Use it to confirm the status of each
      package, ensure supporting documents are in place, and capture coordination notes between program and finance
      teams.
    </p>
    <h3>Workflow</h3>
    <ol>
      <li>Review the status table to identify packages that are in progress or rejected.</li>
      <li>Work through the readiness checklist to confirm all attachments are present.</li>
      <li>Capture follow-up notes so everyone knows what remains before submission.</li>
    </ol>
  </div>
);

EsdcReportingHelp.aiContext = `
ESDC reporting dashboard overview for ISET administrators managing quarterly/annual packages.
`;

export default EsdcReportingHelp;
