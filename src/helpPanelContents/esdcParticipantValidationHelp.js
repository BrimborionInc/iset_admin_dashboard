import React from 'react';

const EsdcParticipantValidationHelp = () => (
  <div>
    <p>
      The validation summary shows current ILMP readiness for everyone in the queue and lets you re-run validation in bulk.
      Use it to ensure all participants are validated before generating a batch export.
    </p>
    <p>
      Counters display how many are ready, need review, or are blocked. “Participants needing attention” links straight
      to the case workspace for blocked/warning cases. The <strong>Validate all</strong> button refreshes statuses for all queued
      participants; it’s enabled only when the queue is non-empty.
    </p>
  </div>
);

EsdcParticipantValidationHelp.aiContext = `
Widget help: ILMP validation summary + Validate all; explains counters, attention list, and bulk re-validation.
`;

export default EsdcParticipantValidationHelp;
