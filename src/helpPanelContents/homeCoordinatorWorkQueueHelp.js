import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeCoordinatorWorkQueueHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue (ISET Coordinator)</Box>
    <Box>
      This widget shows ISET Coordinator queues such as My Applications, EI Verification Pending, Ready to assess,
      Missing Docs / Follow-ups Needed, approvals, funding agreements, milestones, and overdue work.
    </Box>
    <Box>
      Select a queue to focus the Work Queue Items table on the items that need your attention.
    </Box>
    <Box>
      Use <strong>Work queue preferences</strong> in the widget header to choose which queues appear. Your selections
      are saved in this browser.
    </Box>
  </SpaceBetween>
);

HomeCoordinatorWorkQueueHelp.aiContext = `
You are assisting with the ISET Coordinator Work Queue widget on the NWAC ISET homepage.
Explain that coordinator queues drive the Work Queue Items table and that Work queue preferences lets users show/hide queues (saved locally in their browser).
`;

export default HomeCoordinatorWorkQueueHelp;
