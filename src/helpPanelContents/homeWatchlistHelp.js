import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWatchlistHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">My Tagged Applications</Box>
    <Box>
      This widget shows the applications you have tagged for follow-up. Use the filters to find a file quickly.
    </Box>
    <Box>
      Remove a tag when you are done, or use the tag icon in Work Queue Items to add or remove tagged items.
    </Box>
  </SpaceBetween>
);

HomeWatchlistHelp.aiContext = `
You are assisting with the My Tagged Applications widget on the NWAC ISET homepage. Explain that it lists tagged cases and how to remove or add tags.
`;

export default HomeWatchlistHelp;
