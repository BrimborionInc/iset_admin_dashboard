import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWorkQueueItemsHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue Items</Box>
    <Box>
      This table lists items for the selected Work Queue. Depending on role and queue, items may be
      applications, cases, interventions, or operational tasks.
    </Box>
    <Box>
      Use search, sorting, and resizable columns to focus on a specific file quickly.
    </Box>
    <Box>
      Use the Actions links to open the right workspace (application or case) and complete queue-specific actions.
      Use the tag icon to add or remove items from <strong>My Tagged Applications</strong>.
    </Box>
  </SpaceBetween>
);

HomeWorkQueueItemsHelp.aiContext = `
You are assisting with the Work Queue Items widget on the NWAC ISET homepage.
Explain that the table is driven by the selected queue, supports search/sort/column resizing, routes to application or case workspaces from Actions links, and uses tags to populate My Tagged Applications.
`;

export default HomeWorkQueueItemsHelp;
