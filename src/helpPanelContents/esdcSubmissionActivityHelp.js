import React from 'react';

const EsdcSubmissionActivityHelp = () => (
  <div>
    <p>
      Recent activity captures validation runs, participant export/download records, and ESDC response records when
      they exist. It helps administrators track who took action and whether follow-up is required.
    </p>
    <p>
      Clicking the detail link opens the relevant participant or reporting route for additional context.
    </p>
  </div>
);

EsdcSubmissionActivityHelp.aiContext = `
Widget help: Recent ILMP activity log showing validation, export/download, and ESDC response records with actor/status context.
`;

export default EsdcSubmissionActivityHelp;
