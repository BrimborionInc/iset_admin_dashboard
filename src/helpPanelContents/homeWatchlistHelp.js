import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWatchlistHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">My Flagged Applications</Box>
    <Box>
      This widget shows the applications you have flagged for follow-up. Use the filters to find a file quickly.
    </Box>
    <Box>
      Clear a flag when you are done, or use the flag icon in Work Queue Items to add or remove a case.
    </Box>
  </SpaceBetween>
);

HomeWatchlistHelp.aiContext = `
You are assisting with the My Flagged Applications widget on the NWAC ISET homepage. Explain that it lists flagged cases and how to clear or add flags.
`;

export default HomeWatchlistHelp;
