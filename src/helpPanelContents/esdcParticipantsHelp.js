import React from 'react';

const EsdcParticipantsHelp = () => (
  <div>
    <p>
      The participant submissions dashboard is the day-to-day workspace for managing ILMP client payloads. It shows
      who is waiting for validation, highlights the most common blocking rules, and lists recent submissions.
    </p>
    <h3>Workflow</h3>
    <ol>
      <li>Select a participant from the queue when you are ready to review their readiness.</li>
      <li>Use the validation widget to understand which rules are failing most often.</li>
      <li>Open the participant workspace to run the detailed checklist and download the payload.</li>
    </ol>
  </div>
);

EsdcParticipantsHelp.aiContext = `
ESDC participant submissions dashboard: queue, validation summary, recent submissions.
Audience: administrators preparing ILMP participant files.
`;

export default EsdcParticipantsHelp;
