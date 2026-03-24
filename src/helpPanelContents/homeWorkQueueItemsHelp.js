import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWorkQueueItemsHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue Items</Box>
    <Box>
      This table usually lists items for the selected Work Queue. It can also switch into a metric-results view when
      you select a linked count from the Metrics widget.
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
    <Box>
      If the table is showing metric results, use <strong>Back to work queue</strong> to return to the queue-driven
      view.
    </Box>
  </SpaceBetween>
);

HomeWorkQueueItemsHelp.aiContext = `
You are assisting with the Work Queue Items widget on the NWAC ISET homepage.
Explain that the table is usually driven by the selected queue but can also show metric drilldown results from the Metrics widget. Mention search/sort/column resizing, Open workspace, the Tag column sync with My Tagged Applications, queue-specific inline actions in queue mode, and the Back to work queue action when metric results are open.
`;

export default HomeWorkQueueItemsHelp;
