import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeCoordinatorWorkQueueHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue (ISET Coordinator)</Box>
    <Box>
      This view highlights buckets tailored to ISET Coordinators, including missing docs, EI verification, approvals,
      and active client check-ins.
    </Box>
    <Box>
      Select a bucket to focus the Work Queue Items table on the items that need your attention.
    </Box>
    <Box>
      Use the settings (cog) icon to choose which buckets appear in this widget. Your selections are saved in this browser.
    </Box>
  </SpaceBetween>
);

HomeCoordinatorWorkQueueHelp.aiContext = `
You are assisting with the ISET Coordinator Work Queue widget on the NWAC ISET homepage. Explain that buckets are tailored to coordinator work and drive the Work Queue Items table.
If asked, explain that the settings icon lets the user show/hide buckets (saved locally in their browser).
`;

export default HomeCoordinatorWorkQueueHelp;
