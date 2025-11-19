import React from 'react';

const IsetApplicationFormHelpPanelContent = () => (
  <div>
    <h2>ISET application dossier</h2>
    <p>
      Review and correct the full intake submission without leaving the case dashboard. Sections mirror the applicant
      form and expand for easier scanning; version history keeps prior submissions intact.
    </p>

    <h3>What you can review</h3>
    <ul>
      <li>
        <strong>Identity & contact details:</strong> Confirm legal name, preferred name, addresses, and emergency
        contacts before reaching out.
      </li>
      <li>
        <strong>Eligibility checks:</strong> The eligibility questions show pass/fail badges so you can spot
        blockers quickly.
      </li>
      <li>
        <strong>Supports & barriers:</strong> Understand the applicant’s goals, requested services, and obstacles to
        employment.
      </li>
      <li>
        <strong>Finances:</strong> Side-by-side income and expense tables help you validate demonstrated need.
      </li>
      <li>
        <strong>Uploaded consent:</strong> Signature status indicators confirm whether declarations were captured at
        submission time.
      </li>
    </ul>

    <h3>Editing the record</h3>
    <ul>
      <li>Select <em>Edit</em> and confirm to acquire an edit lock; editing is disabled if the case is approved/rejected or another user holds the lock.</li>
      <li>Only editable fields expose inputs; Save writes a new version and keeps the original submission available in version history.</li>
      <li>Use <em>View versions</em> to compare or restore earlier submissions; Save or Cancel releases your lock.</li>
      <li>Monthly income/expense tables allow inline correction; clear incorrect totals with the inline clear controls.</li>
      <li>Download Indigenous Declaration or conflict-of-interest PDFs from the modal actions when validation is needed.</li>
    </ul>

    <h3>Tips for coordinators</h3>
    <ul>
      <li>Verify required evidence from the training module: Status/Treaty card or two Nation letters plus self-declaration, two IDs, acceptance letter and fee statement, band funding/denial letter (if applicable), and income/expense proofs for living allowance.</li>
      <li>Use Case Notes to log any coordinator-made edits and outreach attempts (5-day contact rule; up to three attempts before closing for non-response).</li>
      <li>If documents are missing, request them via Secure Messaging—uploads will surface in Supporting Documents.</li>
      <li>Pending stays pending until docs are complete, the case manager recommendation is recorded, NWAC approves/denies, and the Funding Agreement is signed; reflect this in the assessment widget and notes.</li>
    </ul>
  </div>
);

IsetApplicationFormHelpPanelContent.aiContext = `
You are assisting an ISET coordinator using the ISET Application Form widget. Key behaviors:
- Edit flow: press **Edit**, confirm, acquire an edit lock, then Save or Cancel to release; editing is blocked if case status is approved/rejected or another user holds the lock.
- Versioning: every save creates a new version; **View versions** shows history and allows restore. Original submission remains available.
- Scope: sections include identity/contact, eligibility answers, supports/barriers, income/expense tables, document placeholders, and submission signatures. Income/expense amounts can be corrected inline during edit mode.
- Related widgets: log coordinator-made edits/outreach in Notes and Tasks; request missing docs via Secure Messaging (attachments appear in Supporting Documents); align with the Application Assessment widget before final decisions.
- Program rules to surface: 5-day contact SLA and up to three follow-ups for missing info; required evidence includes Status/Treaty card or two Nation letters plus self-declaration, two IDs, acceptance letter and fee statement, band funding/denial where applicable, and income/expense proofs for living allowance; all applications (funded or not) must stay recorded for audit; “pending” means docs + recommendation + NWAC decision + signed Funding Agreement are still outstanding.
`;

export default IsetApplicationFormHelpPanelContent;
