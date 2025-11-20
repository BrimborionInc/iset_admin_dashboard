import React from "react";

const CaseWorkspaceParticipantDetailsHelp = () => (
  <div>
    <p>
      The Participant details widget shows the core intake identity fields (gender, date of birth, SIN, address)
      copied into the case context on approval. Edits here stay with the case and do not change the original application.
    </p>
    <ul>
      <li><strong>Gender/SIN/DOB:</strong> Stored in the case context so ILMP validation can use current values.</li>
      <li><strong>Address:</strong> Update as the client’s address changes during case management.</li>
      <li><strong>Saving:</strong> Use the Edit/Save controls; changes persist via the case context API.</li>
    </ul>
  </div>
);

CaseWorkspaceParticipantDetailsHelp.aiContext = `You are helping with the Participant details widget in the Case Workspace. The widget surfaces case-level identity fields (gender, SIN, date of birth, address) that were seeded from the intake submission into case_context_json when the application was approved. Edits should persist to the case context and do not affect the original application submission. Keep guidance concise and focused on updating/saving these fields.`;

export default CaseWorkspaceParticipantDetailsHelp;
