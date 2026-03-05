import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeRecentActivityHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Recent Activity</Box>
    <Box>
      This widget lists recent status changes, assignments, and system activity tied to applications and cases.
    </Box>
    <Box>
      Use the links in the activity stream to open related records. If the live feed is temporarily unavailable, the
      widget falls back to sample activity until the next refresh.
    </Box>
  </SpaceBetween>
);

HomeRecentActivityHelp.aiContext = `
You are assisting with the Recent Activity widget on the NWAC ISET homepage. Explain that it shows recent activity entries, links to related records, and may show sample fallback entries when the live feed is unavailable.
`;

export default HomeRecentActivityHelp;
