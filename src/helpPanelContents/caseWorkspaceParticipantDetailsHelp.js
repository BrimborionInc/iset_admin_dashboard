import React from "react";

const CaseWorkspaceParticipantDetailsHelp = () => (
  <div>
    <p>
      Participant details is the case-managed record of the participant’s core identity and contact information.
      It starts with the application submission and must be kept current throughout case management.
      Edits here do not change the original application; they keep the active case file accurate.
    </p>
    <ul>
      <li><strong>What to keep current:</strong> Legal names, preferred name/pronouns, DOB, SIN, Indigenous identity and home community, household/language, disability status, and contact details (main, alternate, emergency).</li>
      <li><strong>Privacy:</strong> Treat SIN and identity details as sensitive. Only record what the participant provides, avoid duplicating outside the system, and follow agency privacy guidance.</li>
      <li><strong>How to update:</strong> Click <em>Edit</em>, adjust fields, then <em>Save</em>. Use <em>Cancel</em> to discard changes. Errors (e.g., SIN length/checksum) will show inline.</li>
      <li><strong>Read mode:</strong> Fields are locked for clarity; emails offer inline “copy” controls. Switch to Edit to change values.</li>
      <li><strong>When to change:</strong> Update after the participant reports new contact info, a name change, corrections to identity details, or updated household/language information.</li>
      <li><strong>Validation:</strong> SIN must be 9 digits and pass the checksum; select lists align to reporting requirements (e.g., yes/no, province, language).</li>
    </ul>
  </div>
);

CaseWorkspaceParticipantDetailsHelp.aiContext = `You are assisting a caseworker using the Participant details widget in the Case Workspace. Provide concise, non-technical guidance on keeping participant identity and contact info up to date (names, pronouns, DOB, SIN, Indigenous identity/home community, household/language, disability, contact channels including emergency). Remind them of privacy sensitivity (especially SIN) and to only record participant-provided updates. Explain the Edit/Save flow, that read mode is locked with inline copy for emails, and that validation (e.g., SIN checksum, required formats, allowed options) must pass before saving. Emphasize that changes here keep the active case accurate and do not alter the original application submission.`;

export default CaseWorkspaceParticipantDetailsHelp;
