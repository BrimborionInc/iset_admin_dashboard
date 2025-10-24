import React from 'react';

const SupportingDocumentsHelp = () => (
  <div>
    <h2>Supporting documents library</h2>
    <p>
      This table lists every file attached to the applicant, whether it was uploaded during intake or added later
      from secure messaging. Use it to verify eligibility proofs, download evidence, and confirm the latest
      submissions.
    </p>

    <h3>Key features</h3>
    <ul>
      <li>
        <strong>Document catalogue:</strong> View filenames, their source (application upload vs. secure message),
        and the date they were received.
      </li>
      <li>
        <strong>One-click download:</strong> Open a document in a new tab to review or save it locally. Downloads
        use secure, time-limited links.
      </li>
      <li>
        <strong>Auto-refresh:</strong> When a new attachment arrives through secure messaging, the list refreshes on
        its own so you do not miss new evidence.
      </li>
    </ul>

    <h3>When to use</h3>
    <ul>
      <li>Confirm identity, residency, and program eligibility documents before approving funding.</li>
      <li>Double-check that all required paperwork has arrived after requesting additional information.</li>
      <li>Provide auditors with a quick index of what was supplied by the applicant.</li>
    </ul>

    <h3>Good to know</h3>
    <ul>
      <li>
        If a file shows as <em>Unavailable</em>, ask the applicant to re-upload or contact support for recovery.
      </li>
      <li>
        The widget is applicant-centric—switching cases loads the new applicant’s document list automatically.
      </li>
      <li>
        Downloads respect your session permissions; if a link expires, refresh the page and try again.
      </li>
    </ul>
  </div>
);

SupportingDocumentsHelp.aiContext = `
You are assisting an ISET program staff member reviewing the Supporting Documents widget. Explain how to confirm the
latest uploads, download evidence, and understand document sources. Offer practical advice for handling missing or
outdated files.
`;

export default SupportingDocumentsHelp;
