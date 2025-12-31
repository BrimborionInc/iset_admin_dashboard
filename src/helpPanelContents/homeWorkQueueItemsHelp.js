import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWorkQueueItemsHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue Items</Box>
    <Box>
      This table lists the items for the selected Work Queue bucket. Use search, sorting, and resizable columns to
      focus on a specific file.
    </Box>
    <Box>
      Use the flag icon to add or remove an item from your watchlist, and open the workspace link to work the file.
    </Box>
  </SpaceBetween>
);

HomeWorkQueueItemsHelp.aiContext = `
You are assisting with the Work Queue Items widget on the NWAC ISET homepage. Explain how the table is driven by the selected bucket, how to search, and how flags add items to the watchlist.
`;

export default HomeWorkQueueItemsHelp;
