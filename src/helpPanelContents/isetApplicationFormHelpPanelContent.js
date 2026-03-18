import React from 'react';

const IsetApplicationFormHelpPanelContent = () => (
  <div>
    <h2>ISET application form</h2>
    <p>
      Review and correct the full intake submission without leaving the case dashboard. Sections mirror the applicant
      form and expand for easier scanning. Version history preserves prior submissions.
    </p>

    <h3>What you can review</h3>
    <ul>
      <li>
        <strong>Identity & contact details:</strong> Confirm legal name, preferred name, addresses, and emergency
        contacts before reaching out.
      </li>
      <li>
        <strong>Eligibility & program fit:</strong> Review indigenous identity, EI status, target program, and
        requested supports to confirm eligibility signals.
      </li>
      <li>
        <strong>Supports & barriers:</strong> Understand the applicant's goals, requested services, and obstacles to
        employment.
      </li>
      <li>
        <strong>Finances:</strong> Income and expense tables include totals for quick validation of need.
      </li>
      <li>
        <strong>Declarations & signatures:</strong> Status indicators show whether consent and conflict declarations
        were signed at submission time.
      </li>
    </ul>

    <h3>Editing the record</h3>
    <ul>
      <li>Select <em>Edit</em> and confirm to acquire an edit lock; editing is disabled after a final decision unless the record is a denied-ineligible ILMP reporting file, or if another user holds the lock.</li>
      <li>Only editable fields expose inputs; Save writes a new version and keeps the original submission available in version history.</li>
      <li>Use <em>View versions</em> to compare or restore earlier submissions; Save or Cancel releases your lock.</li>
      <li>Monthly income/expense tables allow inline correction; clear incorrect totals with the inline clear controls.</li>
      <li>Open Indigenous Declaration or conflict-of-interest modals to review and download signed PDFs.</li>
      <li>For denied-ineligible ILMP records, fixes made here automatically resync the client/reporting data and re-run ILMP validation.</li>
    </ul>

    <h3>Tips for coordinators</h3>
    <ul>
      <li>Use Case Notes to log any coordinator-made edits and outreach attempts.</li>
      <li>If documents are missing, request them via Secure Messaging; uploads appear in Supporting Documents.</li>
      <li>Keep the assessment widget aligned with intake updates so status and recommendation remain consistent.</li>
    </ul>
  </div>
);

IsetApplicationFormHelpPanelContent.aiContext = `
You are assisting an ISET coordinator using the ISET Application Form widget. Key behaviors:
- Edit flow: press Edit, confirm, acquire an edit lock, then Save or Cancel to release; editing is blocked after a final decision except for denied-ineligible ILMP reporting records, and it is always blocked when another user holds the lock.
- Versioning: every save creates a new version; **View versions** shows history and allows restore. Original submission remains available.
- Scope: sections include identity/contact, eligibility answers, supports/barriers, income/expense tables, and submission signatures. Income and expense amounts can be corrected inline during edit mode.
- Reporting-only denied cases: when the overview indicates the record was denied on eligibility grounds but retained for ILMP reporting, fixes made here automatically resync downstream client/action-plan/intervention data and revalidate ESDC readiness.
- Declarations: use the Indigenous declaration or conflict-of-interest modals to review and download signed PDFs.
- Related widgets: log coordinator-made edits in Notes and Tasks; request missing docs via Secure Messaging (attachments appear in Supporting Documents); align with the Application Assessment widget before final decisions.
`;

export default IsetApplicationFormHelpPanelContent;
