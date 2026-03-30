import React from 'react';

const SecureMessagesHelpPanelContent = () => (
  <div>
    <h2>Secure messaging workspace</h2>
    <p>
      Keep applicant communication inside this secure inbox whenever PATH messaging is available. It
      keeps the conversation attached to the file and makes it easier to follow requests, responses,
      and attachments in one place.
    </p>

    <h3>Tabs explained</h3>
    <ul>
      <li>
        <strong>Inbox:</strong> Messages sent by the applicant or other staff members. Unread items stay bold
        until you open them.
      </li>
      <li>
        <strong>Sent:</strong> Outgoing messages you or your teammates have delivered to the applicant.
      </li>
      <li>
        <strong>Deleted:</strong> Items you have archived. Empty this tab to permanently remove sensitive
        content once it is no longer needed.
      </li>
    </ul>

    <h3>Common actions</h3>
    <ul>
      <li>
        Use <em>New Message</em> to acknowledge an application, request missing documents, or continue a
        thread without leaving the file.
      </li>
      <li>
        Mark a message as urgent when you need the applicant's immediate attention.
      </li>
      <li>
        Attachments you open here are also copied to the Supporting Documents widget for future reference. Labels remain editable in Supporting Documents if you need to rename them.
      </li>
      <li>
        Use search and filters to locate messages by subject, sender, or status.
      </li>
      <li>
        Refresh the inbox after expecting new information or when another team member has replied.
      </li>
    </ul>

    <h3>Working safely</h3>
    <ul>
      <li>Keep messaging professional - conversations are part of the auditable case history.</li>
      <li>If the message leads to an important decision or missed deadline, capture that outcome in Notes as well.</li>
      <li>Use Deleted &gt; Empty Items to permanently clear sensitive information once downstream tasks are done (type <strong>delete</strong> to confirm).</li>
      <li>If attachments fail to open, ask the applicant to resend or notify support for recovery.</li>
    </ul>
  </div>
);

SecureMessagesHelpPanelContent.aiContext = `
You are assisting an ISET staff member using the Secure Messaging widget. Explain the purpose of each tab, how to
compose and manage messages, search/filter the inbox, and what happens to attachments. Clarify that attachments are adopted into Supporting Documents (labels can be edited there). Highlight best practices for urgency flags and for emptying deleted items (type "delete" to confirm).

When relevant, frame messaging as part of staff workflow: acknowledge applications, request missing information, follow up with applicants, and keep important outcomes reflected in the case notes as well.
`;

export default SecureMessagesHelpPanelContent;
