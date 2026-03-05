import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeDevTaskTrackerHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Development Tracker</Box>
    <Box>
      This internal widget tracks development work items for System Administrators.
    </Box>
    <Box>
      Use it to review status, notes, and next steps for active engineering tasks. Status controls update in place and
      are persisted in browser session storage.
    </Box>
    <Box>
      Select a task title to open details, update status, and open linked documentation.
    </Box>
  </SpaceBetween>
);

HomeDevTaskTrackerHelp.aiContext = `
You are assisting with the Development Tracker widget on the NWAC ISET homepage. Explain that it is an internal System Administrators-only view, status updates persist in the browser session, and task titles open detail modal content.
`;

export default HomeDevTaskTrackerHelp;
