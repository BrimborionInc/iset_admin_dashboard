import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeApprovalsItemsHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Pending Decision Items</Box>
    <Box>
      This queue combines submitted application assessments, new intervention proposals, and
      proposed intervention changes waiting for an NWAC Administrator decision.
    </Box>
    <Box>
      Use the table to identify which record to open next. <strong>Province</strong> shows the
      applicant&apos;s province, <strong>EI status</strong> shows the recorded assessment EI status,
      and <strong>Timeline target</strong> shows the due or overdue badge for the configured
      <strong>Program decision</strong> timing target.
    </Box>
    <Box>
      Select the applicant or item name to review the full record and complete the decision
      there. Application decisions open the application workspace in a review layout with
      <strong>Application Assessment</strong> focused on <strong>Approval and decision</strong>.
      Intervention decisions open the case workspace in a review layout with the selected
      proposal loaded in <strong>Intervention assessment</strong> at <strong>Record of decision</strong>.
      For intervention proposals, the decision is committed there and any letter preparation is a
      separate follow-up.
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
Explain that this queue combines submitted application assessments, new intervention proposals, and proposed intervention changes for NWAC Administrator review. Regional Managers may monitor the queue, but only NWAC Administrators record the decision.

Keep answers operational:
- Mention the key columns: Province, EI status, and Timeline target.
- Explain that Timeline target uses the configured Program decision timing target, but the badge text is intentionally shortened to due/overdue wording.
- Explain that decisions are completed inside the workspace, not as an inline table action.
- Explain that the applicant/item name carries decision context so the target workspace opens in the relevant review layout and decision step.
- Clarify that intervention decisions are committed at 'Record of decision'; letter preparation is separate and does not add another approval step.
- Clarify that the item breakdown shows only funded proposed payment items grouped under intervention type.
- Mention tagging only as a personal follow-up aid, not as part of the approval decision itself.
`;

export default HomeApprovalsItemsHelp;
