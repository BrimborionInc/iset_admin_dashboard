import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeApprovalsItemsHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Approvals Items</Box>
    <Box>
      This queue combines submitted application assessments and new intervention proposals waiting
      for an NWAC Administrator or Regional Manager decision.
    </Box>
    <Box>
      Use the table to identify which record to open next. <strong>Province</strong> shows the
      applicant&apos;s province, <strong>EI status</strong> shows the recorded assessment EI status,
      and <strong>Timeline target</strong> shows the due or overdue badge for the configured
      <strong>Program decision</strong> timing target.
    </Box>
    <Box>
      Select <strong>Open workspace</strong> to review the full record and complete the decision
      there. Application approvals open the application workspace in an approval review layout with
      <strong>Application Assessment</strong> focused on <strong>Approval and decision</strong>.
      Intervention approvals open the case workspace in an approval review layout with the selected
      proposal loaded in <strong>Intervention assessment</strong> at <strong>Record of decision</strong>.
      For intervention proposals, the approval is committed there and any letter preparation is a
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
You are assisting with the Approvals Items table on the NWAC ISET homepage.
Explain that this queue combines submitted application assessments and new intervention proposals for NWAC Administrator and Regional Manager review.

Keep answers operational:
- Mention the key columns: Province, EI status, Timeline target, and Open workspace.
- Explain that Timeline target uses the configured Program decision timing target, but the badge text is intentionally shortened to due/overdue wording.
- Explain that approval decisions are completed inside the workspace, not as an inline table action.
- Explain that Open workspace now carries approval context so the target workspace opens in the relevant review layout and decision step.
- Clarify that intervention approvals are committed at 'Record of decision'; letter preparation is separate and does not add another approval step.
- Clarify that the item breakdown shows only funded proposed payment items grouped under intervention type.
- Mention tagging only as a personal follow-up aid, not as part of the approval decision itself.
`;

export default HomeApprovalsItemsHelp;
