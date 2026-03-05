import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWatchlistHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">My Tagged Applications</Box>
    <Box>
      This widget shows the files you have tagged for follow-up. Use the search box, paging, and column preferences to
      find a file quickly.
    </Box>
    <Box>
      Remove a tag when you are done, or use the Tag icon in Work Queue Items to add or remove tagged items. Tracking
      IDs open the related application or case workspace.
    </Box>
  </SpaceBetween>
);

HomeWatchlistHelp.aiContext = `
You are assisting with the My Tagged Applications widget on the NWAC ISET homepage. Explain that it lists tagged files, supports search/column preferences, and lets users remove tags or open the linked workspace.
`;

export default HomeWatchlistHelp;
