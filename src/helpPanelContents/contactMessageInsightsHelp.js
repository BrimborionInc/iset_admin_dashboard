import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const ContactMessageInsightsHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Offer a quick snapshot of volume, response progress, and backlog risk for legacy contact messages visible to
        the current staff member.
      </p>
    </Box>
    <Box>
      <strong>Metrics included</strong>
      <ul>
        <li>
          <em>New today</em>: submissions received in the last 24 hours.
        </li>
        <li>
          <em>Awaiting response</em>: messages still marked <code>new</code> or <code>in-progress</code>.
        </li>
        <li>
          <em>Average first response</em>: rolling 7-day average of time-to-first-reply.
        </li>
        <li>
          <em>Flagged / escalated</em>: enquiries marked urgent or tagged for leadership review.
        </li>
      </ul>
    </Box>
    <Box>
      <strong>When live</strong>
      <ul>
        <li>Drive the counts from the contact message store and audit events, not from the table page size.</li>
        <li>Apply the same scoped Regional Manager visibility as the queue so metrics match the messages they can open.</li>
        <li>Ensure escalations are tracked in the notification framework so the metric stays accurate.</li>
        <li>Highlight days breaching the SLA to guide staffing adjustments.</li>
      </ul>
    </Box>
  </SpaceBetween>
);

ContactMessageInsightsHelp.aiContext =
  "Describe the KPI widget on the Contact Communications dashboard that summarises legacy portal contact enquiries, backlog, response time, and escalations.";

export default ContactMessageInsightsHelp;
