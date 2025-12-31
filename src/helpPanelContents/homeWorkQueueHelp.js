import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWorkQueueHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue</Box>
    <Box>
      This widget groups your workload into role-based buckets. Select a bucket to update the Work Queue Items table.
    </Box>
    <Box>
      Counts reflect your current role and scope. Use Refresh to pull the latest totals.
    </Box>
  </SpaceBetween>
);

HomeWorkQueueHelp.aiContext = `
You are assisting with the Work Queue widget on the NWAC ISET homepage. Explain that buckets are role-scoped and selecting one updates the Work Queue Items table.
`;

export default HomeWorkQueueHelp;
