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
      Click the applicant or item name to open the workspace. Queue-specific row actions appear only
      when there is a direct action to take from the table.
    </Box>
    <Box>
      In <strong>Pending Completion</strong>, application rows open the assessment wizard on the
      active post-decision step instead of restoring the last step you viewed. Approved intervention
      proposal or revision rows open the Case Workspace approval-letter follow-up.
    </Box>
    <Box>
      In the <strong>Pending Decision</strong> queue, select the applicant or item name to complete the
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
- Mention search, sort, column resizing, item-name workspace links, and tagging.
- In coordinator-focused answers, emphasize that this table is a launching point into the detailed application or case workspace where notes, messaging, documents, and assessment are actually handled.
- Clarify that the Pending Decision queue opens through the applicant/item name and that approval decisions happen inside the workspace.
- Clarify that Pending Completion application rows open the active post-decision wizard step: approval letters first, then funding forms and signatures after the approval letter has been sent.
- Clarify that Pending Completion can also include approved intervention proposal/revision letter follow-up rows, which open Case Workspace for the intervention-scoped approval/funding revision letter.
- Clarify that assignable rows can use Assign/Reassign inline actions, while the applicant or item name opens the workspace.
- Mention queue-specific inline actions only when they are visible for the current queue.
- Mention Back to work queue when the table is showing metric results.
`;

export default HomeWorkQueueItemsHelp;
