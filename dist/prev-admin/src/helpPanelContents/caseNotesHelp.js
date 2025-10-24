import React from 'react';

const CaseNotesHelp = () => (
  <div>
    <h2>Case notes best practices</h2>
    <p>
      Use case notes to capture internal updates that keep the rest of the team aligned. Notes are only visible to
      staff and form the running history of decisions, conversations, and follow-ups.
    </p>

    <h3>How to use this widget</h3>
    <ul>
      <li>
        <strong>Add context quickly:</strong> Click <em>Add note</em> to log meeting summaries, phone calls, or
        reminders. Notes save instantly to the case.
      </li>
      <li>
        <strong>Edit or delete responsibly:</strong> You can revise or remove your own entries when mistakes occur,
        but aim to preserve a clear audit trail.
      </li>
      <li>
        <strong>Pin important updates:</strong> Pinned notes stay at the top, making critical instructions easy to
        find.
      </li>
      <li>
        <strong>Refresh anytime:</strong> Use the refresh icon after collaborating with others to see their latest
        additions.
      </li>
    </ul>

    <h3>Writing effective notes</h3>
    <ul>
      <li>Lead with the outcome or decision, then add relevant details.</li>
      <li>Record dates, follow-up owners, and deadlines where possible.</li>
      <li>Avoid sensitive personal data—store documents in the Supporting Documents widget instead.</li>
    </ul>

    <h3>Need inspiration?</h3>
    <p>
      Think of case notes as the hand-off briefing between teammates. A clear note answers “what changed, why it
      matters, and what happens next.”
    </p>
  </div>
);

CaseNotesHelp.aiContext = `
You are assisting an ISET program coordinator using the Case Notes widget. Explain how to add, edit, and pin notes,
what information belongs in a note, and when to refresh. Emphasise collaborative record-keeping and avoiding
sensitive data.
`;

export default CaseNotesHelp;
