import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeApprovalsItemsHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Decision and Review Items</Box>
    <Box>
      This table shows the selected decision or review queue. Decision Makers use
      <strong> Pending Decision</strong> for final decisions. Regional Managers use
      <strong> Pending Review</strong> for application assessments, new intervention proposals,
      and proposed intervention changes waiting on RM review.
    </Box>
    <Box>
      Use the table to identify which record to open next. <strong>Province</strong> shows the
      applicant&apos;s province, <strong>EI status</strong> shows the recorded assessment EI status,
      and <strong>Timeline target</strong> shows the due or overdue badge for the configured
      <strong>Program decision</strong> timing target.
    </Box>
    <Box>
      Select the applicant or item name to review the full record and complete the next action
      there. Regional Manager review entries open the relevant review step. Final-decision entries
      open the application or case workspace in a decision-focused layout. For intervention
      proposals and changes, any letter preparation is a separate follow-up after the decision is
      recorded.
    </Box>
    <Box>
      The item details show only funded proposed payment items, grouped under the intervention
      type. Use the Tag column if you want to keep a personal follow-up marker in
      <strong>My Tagged Applications</strong>.
    </Box>
  </SpaceBetween>
);

HomeApprovalsItemsHelp.aiContext = `
You are assisting with the Pending Decision Items table on the NWAC ISET homepage.
Explain that Decision Makers use Pending Decision for submitted application assessments, new intervention proposals, and proposed intervention changes at final-decision review. Regional Managers use Pending Review for application assessments, new intervention proposals, and proposed intervention changes waiting on RM review or returned to RM after the Decision Maker requested changes. Regional Managers do not record final decisions.

Keep answers operational:
- Mention the key columns: Province, EI status, and Timeline target.
- Explain that Timeline target uses the configured Program decision timing target, but the badge text is intentionally shortened to due/overdue wording.
- Explain that reviews and decisions are completed inside the workspace, not as inline table actions.
- Explain that the applicant/item name carries review or decision context so the target workspace opens in the relevant step.
- Clarify that intervention letter preparation is separate and does not add another approval step.
- Clarify that the item breakdown shows only funded proposed payment items grouped under intervention type.
- Mention tagging only as a personal follow-up aid, not as part of the final decision itself.
`;

export default HomeApprovalsItemsHelp;
