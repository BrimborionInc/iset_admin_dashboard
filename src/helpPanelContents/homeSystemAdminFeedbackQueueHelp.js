import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeSystemAdminFeedbackQueueHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Bugs and Change Requests</Box>
    <Box>
      This dashboard is the triage queue for internal PATH bug reports and change requests.
    </Box>
    <Box>
      Use the summary counts, filters, and search box to focus on newly submitted, in-progress, or high-priority items.
    </Box>
    <Box>
      Opening a report launches a floating review panel so you can inspect the description, captured page context, supporting files,
      status history, and internal notes without leaving the main console.
    </Box>
    <Box>
      Status changes and internal notes are operational tracking for the admin team. They do not create applicant-facing messages or
      supporting-document records.
    </Box>
  </SpaceBetween>
);

HomeSystemAdminFeedbackQueueHelp.aiContext = `
You are assisting with the Bugs and Change Requests dashboard in PATH.
Explain that it is the internal triage queue for bug reports and change requests, with filters for open/high-priority items and a floating review panel for status changes, attachments, page context, and internal notes.
`;

export default HomeSystemAdminFeedbackQueueHelp;
