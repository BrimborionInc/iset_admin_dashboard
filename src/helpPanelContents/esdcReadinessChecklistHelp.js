import React from 'react';

const EsdcReadinessChecklistHelp = () => (
  <div>
    <p>
      The readiness checklist mirrors the ILMP “Client” schema from ESDC, highlighting whether each mandatory
      data element meets format and validation rules (SIN checksum, DOB age span, address fallbacks, enumerations, etc.).
    </p>

    <h3>How to use</h3>
    <ul>
      <li>Resolve any <strong>Needs review</strong> or <strong>Blocked</strong> rows in the originating case data.</li>
      <li>Use quick links (future enhancement) to jump into the ISET Application Form for corrections.</li>
      <li>Re-run validation after edits to confirm all fields pass before exporting.</li>
    </ul>

    <h3>Key checks</h3>
    <ul>
      <li>Social Insurance Number passes MOD-10, not all zeros, exactly nine digits.</li>
      <li>Date of birth makes the client between 1 and 100 years old (inclusive) and not in the future.</li>
      <li>Postal address supports “No Address / No Postal Code / No Telephone” per homelessness guidance.</li>
      <li>Enumerated fields (gender, Indigenous identity, language, disability) use ESDC lookup codes.</li>
    </ul>
  </div>
);

EsdcReadinessChecklistHelp.aiContext = `
Widget help: Run ILMP client schema validation for SIN, names, DOB, Indigenous identity, address, language, disability.
Show statuses (ready/needs review) before ESDC submission.
`;

export default EsdcReadinessChecklistHelp;
