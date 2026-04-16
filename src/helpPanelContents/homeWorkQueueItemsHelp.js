import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWorkQueueItemsHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue Items</Box>
    <Box>
      This table shows the actual records behind the queue card or metric you selected. Use it to
      identify the file that needs action and open the correct workspace.
    </Box>
    <Box>
      Use search, sorting, and resizable columns to focus on a specific file quickly. The exact
      columns and row actions change depending on the queue or metric currently being viewed.
    </Box>
    <Box>
      Every row includes <strong>Open workspace</strong>. In coordinator workflows, the most common next
      step is to open the file and then handle notes, documents, applicant messaging, or assessment
      inside the workspace itself.
    </Box>
    <Box>
      In the <strong>Approvals</strong> queue, use <strong>Open workspace</strong> to complete the
      review. Approval decisions are handled inside the workspace rather than as inline table actions.
    </Box>
    <Box>
      Use the Tag column to add or remove items from <strong>My Tagged Applications</strong> when you
      need to keep a personal watchlist for follow-up.
    </Box>
    <Box>
      If the table is showing metric results, use <strong>Back to work queue</strong> to return to the queue-driven
      view.
    </Box>
  </SpaceBetween>
);

HomeWorkQueueItemsHelp.aiContext = `
You are assisting with the Work Queue Items widget on the NWAC ISET homepage.
Explain that the table is usually driven by the selected queue but can also show metric drilldown results from the Metrics widget.

Keep answers operational:
- Help the user identify which row to open next.
- Mention search, sort, column resizing, Open workspace, and tagging.
- In coordinator-focused answers, emphasize that this table is a launching point into the detailed application or case workspace where notes, messaging, documents, and assessment are actually handled.
- Clarify that the Approvals queue uses Open workspace only and that approval decisions happen inside the workspace.
- Mention queue-specific inline actions only when they are visible for the current queue.
- Mention Back to work queue when the table is showing metric results.
`;

export default HomeWorkQueueItemsHelp;
