import React from 'react';

const EsdcReportingChecklistHelp = () => (
  <div>
    <p>
      The checklist tracks required artefacts for the current reporting package (financial statements, outcomes
      worksheet, narrative summary, sign-off, etc.). Use it to confirm every prerequisite is uploaded before you mark
      the package as ready.
    </p>
  </div>
);

EsdcReportingChecklistHelp.aiContext = `
Widget help: Reporting readiness checklist for required attachments and data points.
`;

export default EsdcReportingChecklistHelp;
