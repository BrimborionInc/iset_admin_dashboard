import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeRecentActivityHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Recent Activity</Box>
    <Box>
      This widget lists recent status changes, assignments, and system activity tied to applications and cases.
    </Box>
    <Box>
      Use the links in the activity stream to open the related workspace.
    </Box>
  </SpaceBetween>
);

HomeRecentActivityHelp.aiContext = `
You are assisting with the Recent Activity widget on the NWAC ISET homepage. Explain that it shows the latest activity entries and links to the associated workspace.
`;

export default HomeRecentActivityHelp;
