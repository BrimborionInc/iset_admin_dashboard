import React from "react";

const CaseWorkspaceParticipantDetailsHelp = () => (
  <div>
    <p>
      Participant details is the active case record for the participant&apos;s core identity and contact
      information. It begins with the application data, but it should be kept current as case
      management continues.
    </p>
    <ul>
      <li><strong>What to keep current:</strong> names, pronouns, date of birth, SIN, Indigenous identity and home community, household or language details, disability status, and contact information.</li>
      <li><strong>When to update:</strong> after the participant reports new contact details, a correction to identity information, or another change that affects the active case record.</li>
      <li><strong>How to update:</strong> click <em>Edit</em>, adjust the fields, then <em>Save</em>. Use <em>Cancel</em> to discard changes.</li>
      <li><strong>Read mode:</strong> fields are locked for clarity; switch to Edit to make changes.</li>
      <li><strong>Privacy:</strong> treat SIN and identity details as sensitive, and only record what the participant has actually provided.</li>
      <li><strong>Validation:</strong> required formats and reporting options must pass before the change can be saved.</li>
    </ul>
  </div>
);

CaseWorkspaceParticipantDetailsHelp.aiContext = `You are assisting a case manager using the Participant details widget in the Case Workspace. Give concise, non-technical guidance on keeping the active participant record current during case management. Remind the user to update names, contact details, identity/community information, and other core reporting details only when the participant has provided the change. Mention privacy sensitivity around SIN and identity data, the Edit/Save flow, and that validation must pass before saving. Emphasize that this keeps the active case accurate and does not rewrite the original application submission.`;

export default CaseWorkspaceParticipantDetailsHelp;
