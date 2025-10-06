import React from 'react';

const IsetApplicationFormHelpPanelContent = () => (
  <div>
    <h2>ISET application dossier</h2>
    <p>
      This widget houses the complete intake submission so you can review, correct, and publish updates without
      leaving the case dashboard. Sections mirror the original form and expand for easier scanning.
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
      <li>Select <em>Edit</em> to enable fields; only sections that support updates will provide inputs.</li>
      <li>Use <em>Save</em> to capture your changes without altering application history.</li>
      <li>Version history stores every edit—open it to compare submissions or restore an earlier snapshot.</li>
      <li>Clear totals in the financial tables with the inline “Clear” links if values were entered incorrectly.</li>
    </ul>

    <h3>Tips for coordinators</h3>
    <ul>
      <li>Cross-check the application summary against the coordinator assessment before finalising a decision.</li>
      <li>Add clarifications in the Case Notes widget when you adjust applicant-provided data.</li>
      <li>If a document is missing, request it via Secure Messaging—the attachment will automatically appear in
        Supporting Documents.</li>
    </ul>
  </div>
);

IsetApplicationFormHelpPanelContent.aiContext = `
You are assisting an ISET team member reviewing the ISET Application Form widget. Explain how to audit applicant
details, edit sections safely, leverage version history, and coordinate with related widgets (Case Notes, Supporting
Documents, Secure Messaging).
`;

export default IsetApplicationFormHelpPanelContent;
