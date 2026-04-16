import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWorkQueueHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue</Box>
    <Box>
      This widget groups your workload into role-scoped queues. For NWAC Administrators and Regional Managers,
      queues can include both application and case/intervention work.
    </Box>
    <Box>
      NWAC Administrators see <strong>All Applications</strong> first and <strong>All Cases</strong> second. Those
      queues roll up non-terminal applications and open client cases across the full portfolio. The shared
      <strong>Approvals</strong> queue is pinned directly underneath <strong>All Cases</strong> and
      combines submitted application assessments with new intervention proposals.
    </Box>
    <Box>
      Regional Managers see <strong>Applications in My Region</strong> first. It rolls up all non-terminal
      applications in the provinces and territories assigned on their staff profile.
    </Box>
    <Box>
      Regional Managers also see <strong>Clients in My Region</strong>. That queue counts open client cases in
      their regional portfolio, is case-based rather than deduped by person, and still includes dormant files.
      Their shared <strong>Approvals</strong> queue is pinned directly underneath <strong>Clients in My Region</strong>
      and combines submitted application assessments with new intervention proposals.
    </Box>
    <Box>
      Select a queue to drive the Work Queue Items table and focus the next actions for that queue.
    </Box>
    <Box>
      When you select <strong>Approvals</strong>, the shared table becomes <strong>Approvals Items</strong>.
      Use it to scan province, EI status, and timeline target, then open the workspace to complete
      the decision there.
    </Box>
    <Box>
      Use <strong>Work queue preferences</strong> in the widget header to choose which queues are visible. Preferences
      are saved in this browser per role.
    </Box>
    <Box>
      Some queues may be present but not selectable in this release; the card remains visible so the queue model stays consistent.
    </Box>
  </SpaceBetween>
);

HomeWorkQueueHelp.aiContext = `
You are assisting with the Work Queue widget on the NWAC ISET homepage.
Explain that queues are role-scoped, selecting one updates the Work Queue Items table, and Work queue preferences lets users show/hide queues with browser-saved settings. Mention that NWAC Administrators get All Applications first, All Cases second, and Approvals directly below All Cases, while Regional Managers get Applications in My Region first, Clients in My Region second, and Approvals directly below Clients in My Region. All Applications includes non-terminal applications across the portfolio; All Cases counts open client cases across the portfolio, including dormant files, and is case-based rather than deduped by person. Applications in My Region includes non-terminal applications in the manager's assigned provinces and territories; Clients in My Region counts open client cases in their regional portfolio, including dormant files, and is case-based rather than deduped by person. Clarify that the shared Approvals queue combines submitted application assessments and new intervention proposals, and that decisions are completed from the workspace after opening the selected row. If a queue appears disabled, clarify it is intentionally non-selectable in the current release.
`;

export default HomeWorkQueueHelp;
