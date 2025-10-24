import React from 'react';

const EsdcSubmissionActivityHelp = () => (
  <div>
    <p>
      Recent activity captures the latest validation runs, submissions, and ESDC responses. It helps administrators
      track who took action and whether follow-up is required (for example, if a rejection needs remediation).
    </p>
    <p>
      Clicking the detail link opens the relevant participant or reporting route for additional context.
    </p>
  </div>
);

EsdcSubmissionActivityHelp.aiContext = `
Widget help: Recent submission activity log showing who validated/submitted and resulting status.
`;

export default EsdcSubmissionActivityHelp;
