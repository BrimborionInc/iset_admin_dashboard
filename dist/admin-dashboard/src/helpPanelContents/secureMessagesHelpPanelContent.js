import React from 'react';

const SecureMessagesHelpPanelContent = () => (
  <div>
    <h2>Secure messaging workspace</h2>
    <p>
      Keep all conversation with the applicant inside this encrypted inbox. Each tab mirrors a familiar
      email workflow so you can focus on responses, attachments, and follow-up actions without leaving the
      case file.
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
        Use <em>New Message</em> to start a conversation or reply in a thread to keep context together.
      </li>
      <li>
        Mark a message as urgent when you need the applicant’s immediate attention.
      </li>
      <li>
        Attachments you open here are also copied to the Supporting Documents widget for future reference.
      </li>
      <li>
        Refresh the inbox after expecting new information or when another team member has replied.
      </li>
    </ul>

    <h3>Working safely</h3>
    <ul>
      <li>Keep messaging professional—conversations are part of the auditable case history.</li>
      <li>Use Deleted &gt; Empty Items to permanently clear sensitive information once downstream tasks are done.</li>
      <li>If attachments fail to open, ask the applicant to resend or notify support for recovery.</li>
    </ul>
  </div>
);

SecureMessagesHelpPanelContent.aiContext = `
You are assisting an ISET staff member using the Secure Messaging widget. Explain the purpose of each tab, how to
compose and manage messages, and what happens to attachments. Highlight best practices for urgency flags and for
emptying deleted items.
`;

export default SecureMessagesHelpPanelContent;
