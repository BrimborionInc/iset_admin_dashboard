import React from 'react';

const EsdcReportingStatusHelp = () => (
  <div>
    <p>
      The reporting status table summarises each quarterly/annual submission: due date, owner, current status, and any
      notes. Use it during coordination meetings to assign tasks and ensure nothing slips past the deadline.
    </p>
  </div>
);

EsdcReportingStatusHelp.aiContext = `
Widget help: Reporting packages table showing period, due date, status, owner, and notes.
`;

export default EsdcReportingStatusHelp;
