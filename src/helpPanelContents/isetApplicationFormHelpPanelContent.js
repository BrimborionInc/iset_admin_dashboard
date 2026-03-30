import React from 'react';

const IsetApplicationFormHelpPanelContent = () => (
  <div>
    <h2>ISET application form</h2>
    <p>
      This widget shows the applicant&apos;s submitted intake information in one place. Use it to understand
      who the applicant is, what they are requesting, what they disclosed about their situation, and
      whether the record needs factual correction.
    </p>

    <h3>What coordinators usually review here</h3>
    <ul>
      <li>
        <strong>Identity and contact details:</strong> confirm who you are working with and how to reach them.
      </li>
      <li>
        <strong>Eligibility and program fit:</strong> review Indigenous identity, EI details, target program, and requested supports.
      </li>
      <li>
        <strong>Education, employment, supports, and barriers:</strong> understand the client background and the employment goal being proposed.
      </li>
      <li>
        <strong>Finances:</strong> review household income and expenses, especially when living allowance may be part of the assessment.
      </li>
      <li>
        <strong>Declarations and signatures:</strong> confirm that the required consents and declarations were actually signed.
      </li>
    </ul>

    <h3>When to edit the record</h3>
    <ul>
      <li>Edit when a factual correction is required, for example a wrong phone number, address, or staff-entered intake error.</li>
      <li>Select <em>Edit</em> and confirm to acquire the edit lock. Saving creates a new version and keeps the original submission in version history.</li>
      <li>Use <em>View versions</em> when you need to understand what changed over time.</li>
      <li>If the applicant provides new supporting information, update the record carefully and make sure the related note or document is also captured elsewhere in the file.</li>
      <li>Open the signed declaration modals when you need to confirm what the applicant agreed to at submission time.</li>
    </ul>

    <h3>Training-aligned reminders</h3>
    <ul>
      <li>Use Case Notes to log meaningful coordinator-made corrections and outreach attempts.</li>
      <li>If documents are missing, request them through Secure Messaging and review uploads in Supporting Documents.</li>
      <li>Review EI consent before treating EI verification as complete.</li>
      <li>Use the application form together with the resume, documents, and financial evidence when building the assessment recommendation.</li>
    </ul>
  </div>
);

IsetApplicationFormHelpPanelContent.aiContext = `
You are assisting an ISET coordinator using the ISET Application Form widget. Answer like a staff job aid, not a technical specification.

Key behaviors:
- Edit flow: press Edit, confirm, acquire an edit lock, then Save or Cancel to release; editing is blocked after a final decision except for denied-ineligible ILMP reporting records, and it is always blocked when another user holds the lock.
- Versioning: every save creates a new version; **View versions** shows history and allows restore. Original submission remains available.
- Scope: sections include identity/contact, eligibility answers, supports/barriers, income/expense tables, and submission signatures. Use the widget to understand the applicant story and verify details that support the assessment.
- Reporting-only denied cases: when the overview indicates the record was denied on eligibility grounds but retained for ILMP reporting, fixes made here automatically resync downstream client/action-plan/intervention data and revalidate ESDC readiness.
- Declarations: use the Indigenous declaration or conflict-of-interest modals to review and download signed PDFs.
- Related widgets: log coordinator-made edits or important contact in Notes and Tasks; request missing docs via Secure Messaging (attachments appear in Supporting Documents); align with the Application Assessment widget before final decisions.

Training-aligned guidance to surface when relevant:
- EI consent must be signed before EI verification can be requested.
- Resume, background, and requested intervention should support a realistic employment goal.
- If living allowance is in scope, the financial overview and verification matter to the recommendation.
- Prefer explaining what the coordinator should review or confirm, not just which button exists.
`;

export default IsetApplicationFormHelpPanelContent;
