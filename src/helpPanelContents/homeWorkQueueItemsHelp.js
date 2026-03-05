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
      Every row includes <strong>Open workspace</strong>. Additional inline actions are queue-specific:
      conflicts use Assign/Reassign, EI checks use Set Eligibility, approvals use Record decision, and escalation
      queues include respond/escalate/resolve actions.
    </Box>
    <Box>
      Use the Tag column to add or remove items from <strong>My Tagged Applications</strong>.
    </Box>
  </SpaceBetween>
);

HomeWorkQueueItemsHelp.aiContext = `
You are assisting with the Work Queue Items widget on the NWAC ISET homepage.
Explain that the table is driven by the selected queue, supports search/sort/column resizing, always offers Open workspace, and exposes queue-specific inline actions (for example conflict assignment, EI eligibility, decisions, and escalation actions). Mention the Tag column sync with My Tagged Applications.
`;

export default HomeWorkQueueItemsHelp;
