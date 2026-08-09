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
      In the <strong>Pending Review</strong> or <strong>Pending Decision</strong> queue, select the
      applicant or item name to complete the review or final decision. These actions are handled
      inside the workspace rather than as inline table actions.
    </Box>
    <Box>
      Pending Review can also contain work returned by the Decision Maker. In that state, the
      Regional Manager reviews the Decision Maker note and forwards changes to the original
      submitter; the RM does not send the unchanged item back for final decision.
    </Box>
    <Box>
      The EI status column does not control queue ownership. EI determines CRF/EI funding alignment;
      the active review stage determines whether the next action belongs to the Regional Manager or
      Decision Maker. Client Funding Agreement work begins only after final approval and appears as
      post-decision completion work when funded cost lines exist.
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
- Clarify that Pending Review and Pending Decision queues open through the applicant/item name and that review/final-decision actions happen inside the workspace.
- Clarify that Decision Maker-requested changes return to the RM first; the RM forwards them to the recorded submitter, and corrected work must pass RM review again.
- Clarify that EI status controls CRF/EI funding alignment, not Pending Review/Pending Decision ownership.
- Clarify that Pending Completion application rows open the active post-decision wizard step: approval letters first, then funding forms and signatures after the approval letter has been sent.
- Clarify that funded approvals may include the exact application/Action Plan-linked CFA and EFT form; zero-funding approvals do not. CFA signing is post-approval work, not another review stage.
- Clarify that Pending Completion can also include approved intervention proposal/revision letter follow-up rows, which open Case Workspace for the intervention-scoped approval/funding revision letter and revised CFA where funded.
- Clarify that assignable rows can use Assign/Reassign inline actions, while the applicant or item name opens the workspace.
- Mention queue-specific inline actions only when they are visible for the current queue.
- Mention Back to work queue when the table is showing metric results.
`;

export default HomeWorkQueueItemsHelp;
