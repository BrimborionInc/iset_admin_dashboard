import React from 'react';

const EsdcParticipantValidationHelp = () => (
  <div>
    <p>
      This widget summarises validation coverage across the participant backlog. It reports how many mandatory fields
      pass ILMP rules, optional enrichment captured, and the count of blocking issues that still need attention.
    </p>
    <p>
      The top issues list shows which rules are failing most frequently, helping administrators prioritise coaching and
      clean-up work.
    </p>
  </div>
);

EsdcParticipantValidationHelp.aiContext = `
Widget help: Participant validation summary showing mandatory coverage, blocking issues, and top failing rules.
`;

export default EsdcParticipantValidationHelp;
