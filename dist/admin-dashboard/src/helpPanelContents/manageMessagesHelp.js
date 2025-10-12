import React from 'react';
import { Alert, SpaceBetween } from '@cloudscape-design/components';

const ManageMessagesHelp = () => (
  <div>
    <SpaceBetween direction="vertical" size="s">
    <Alert type="warning" header="Known Bugs">
      <p>"Select User" and "To" interactions are imperfect.  Multiselect may not be an ideal implementation.</p>
    </Alert>
    <Alert type="info" header="Development Notes">
      <p>Just MVP at the moment</p>
      <p>Send only.  Need to consider how replys work - if at all.  Replies mean that someone needs to watch for replies.  Maybe not a good idea.</p>
      <p>Sender ID is currently hardwired to me.</p>
      <p>Need to implement a "sent" view.</p>
      <p>Need to implement message filtering and sorting.</p>
      <p>Need to add message templates for standard messages.</p>
      <p>Need to integrate some tracking (e.g. to show how many messages have been read, deleted unread etc.)</p>
      <p>Need to integrate with notification system for urgent messages.</p>
    </Alert>
    </SpaceBetween>
    <h2>Secure Client Messaging Dashboard</h2>
    <p>The Secure Client Messaging dashboard allows administrators to manage client communications securely. This includes viewing, sending, and organizing messages. Administrators can also configure message templates, set up automated responses, and ensure compliance with security policies. The dashboard provides real-time analytics and reporting, enabling authorized users to monitor communication trends, identify issues, and optimize messaging workflows. Additionally, the system supports integration with external communication channels, ensuring seamless coordination and communication with clients.</p>
  </div>
);

export default ManageMessagesHelp;
