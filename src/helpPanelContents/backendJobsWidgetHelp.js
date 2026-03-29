import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const BackendJobsWidgetHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Backend Jobs</Box>
    <Box>
      Configure server-side background jobs such as the reminder poller. Adjust the interval to control how often the backend checks for due/overdue reminders using the PATH business day in <code>America/Toronto</code>.
    </Box>
    <Box>
      Changes apply on the next poll cycle. Keep intervals reasonable (e.g., 5–15 minutes) to avoid unnecessary load.
    </Box>
  </SpaceBetween>
);

BackendJobsWidgetHelp.aiContext = `
You configure server-side background jobs here. The reminder poller uses this interval to emit reminder_due/overdue events based on the PATH business day in America/Toronto.
`;

export default BackendJobsWidgetHelp;
