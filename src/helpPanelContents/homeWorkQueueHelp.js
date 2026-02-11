import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWorkQueueHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue</Box>
    <Box>
      This widget groups your workload into role-scoped queues. For Program Administrators and Regional Managers,
      queues can include both application and case/intervention work.
    </Box>
    <Box>
      Select a queue to drive the Work Queue Items table and focus the next actions for that queue.
    </Box>
    <Box>
      Use <strong>Work queue preferences</strong> in the widget header to choose which queues are visible. Preferences
      are saved in this browser per role.
    </Box>
  </SpaceBetween>
);

HomeWorkQueueHelp.aiContext = `
You are assisting with the Work Queue widget on the NWAC ISET homepage.
Explain that queues are role-scoped, selecting one updates the Work Queue Items table, and Work queue preferences lets users show/hide queues with browser-saved settings.
`;

export default HomeWorkQueueHelp;
