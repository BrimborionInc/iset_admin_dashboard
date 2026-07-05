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
        The status in this tab shows whether the message is only sent, read by the applicant, or
        followed by an applicant reply.
      </li>
      <li>
        <strong>Deleted:</strong> Items removed from your view. Emptying this tab clears your Deleted list only;
        it does not recall messages for the applicant or other staff.
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
        Use <em>Withdraw sent message</em> when a plain sent message must be removed from the applicant's
        live inbox. Messages with linked forms or attachments need support review before withdrawal.
      </li>
      <li>
        Refresh the inbox after expecting new information or when another team member has replied.
      </li>
    </ul>

    <h3>Working safely</h3>
    <ul>
      <li>Keep messaging professional - conversations are part of the auditable case history.</li>
      <li>If the message leads to an important decision or missed deadline, capture that outcome in Notes as well.</li>
      <li>Confirm the recipient and case before sending. PATH delivers staff messages to the applicant account linked to the current case.</li>
      <li>Use Deleted &gt; Empty Items only to clear your Deleted list (type <strong>delete</strong> to confirm).</li>
      <li>If attachments fail to open, ask the applicant to resend or notify support for recovery.</li>
    </ul>
  </div>
);

SecureMessagesHelpPanelContent.aiContext = `
You are assisting an ISET staff member using the Secure Messaging widget. Explain the purpose of each tab, how to
compose and manage messages, search/filter the inbox, withdrawal of plain sent messages, and what happens to attachments. Clarify that attachments are adopted into Supporting Documents (labels can be edited there). Explain that Sent status shows applicant state (Sent, Read by applicant, Applicant replied), while Inbox unread/read reflects the current staff viewer's mailbox state. Explain that Deleted/Empty Items clears only the current staff viewer's mailbox list and is not the same as withdrawing a sent message. Highlight recipient/case confirmation before send.

When relevant, frame messaging as part of staff workflow: acknowledge applications, request missing information, follow up with applicants, and keep important outcomes reflected in the case notes as well.
`;

export default SecureMessagesHelpPanelContent;
