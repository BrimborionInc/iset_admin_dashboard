import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeDevTaskTrackerHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Development Tracker</Box>
    <Box>
      This internal widget tracks development work items for System Administrators.
    </Box>
    <Box>
      Use it to review the status, notes, and next steps for active engineering tasks.
    </Box>
  </SpaceBetween>
);

HomeDevTaskTrackerHelp.aiContext = `
You are assisting with the Development Tracker widget on the NWAC ISET homepage. Explain that it is an internal System Administrators-only view for development tasks.
`;

export default HomeDevTaskTrackerHelp;
