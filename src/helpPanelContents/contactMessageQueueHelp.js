import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const ContactMessageQueueHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What this widget shows</strong>
      <p>
        A triage table of public portal enquiries with submission timestamp, applicant details, message preview, and current status.
      </p>
    </Box>
    <Box>
      <strong>How to use it</strong>
      <ul>
        <li>Sort by <em>Submitted</em> to work newest-to-oldest or filter for a specific status.</li>
        <li>Open a row to review the message preview, then launch the full record in the contact workspace.</li>
        <li>Update status directly from the inline actions to keep the queue current.</li>
      </ul>
    </Box>
    <Box>
      <strong>Implementation notes</strong>
      <ul>
        <li>Backed by the <code>contact_message</code> table and the associated audit trail once wired to production.</li>
        <li>Respect portal-side rate limiting and spam flags; suppress any messages flagged as blocked.</li>
        <li>Persist table preferences (columns, filters, density) so coordinators maintain their preferred triage view.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

ContactMessageQueueHelp.aiContext =
  "Explain the Contact Communications queue widget that lists contact_message records with status, priority, assignee, and inline actions for NWAC Administrators.";

export default ContactMessageQueueHelp;
