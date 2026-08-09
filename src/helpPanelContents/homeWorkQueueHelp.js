import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeWorkQueueHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue</Box>
    <Box>
      This widget groups your workload into role-scoped queues. For Decision Makers and Regional Managers,
      queues can include both application and case/intervention work.
    </Box>
    <Box>
      Decision Makers see <strong>New Applications</strong>, <strong>In Assessment</strong>,
      <strong>Pending Decision</strong>, and <strong>Pending Completion</strong> first, and then
      <strong> All Cases</strong>. Those queues roll up application work and open client cases
      across the full portfolio. <strong>Pending Decision</strong> is the decision stage in that
      pipeline and combines submitted application assessments, new intervention proposals, and
      proposed intervention changes. <strong>Pending Completion</strong> covers files and approved
      intervention proposal/revision follow-ups where the decision is recorded but post-decision
      work is still outstanding.
    </Box>
    <Box>
      Regional Managers see <strong>Applications in My Region</strong> first. It rolls up all non-terminal
      applications in the provinces and territories assigned on their staff profile.
    </Box>
    <Box>
      Regional Managers also see <strong>My Applications</strong> as a personal slice of assigned files, then the
      shared application-pipeline queues, and then <strong>Clients in My Region</strong>. For Regional Managers,
      that pipeline still includes <strong>EI Check Needed</strong> as the EI-verification hold stage. The
      client-case queue is case-based rather than deduped by person and still includes files with no active plan.
      <strong> Pending Review</strong> is the Regional Manager review stage for submitted application assessments,
      new intervention proposals, and proposed intervention changes.
      <strong> Pending Completion</strong> is the
      post-decision stage for files and approved intervention proposal/revision follow-ups that still need letters,
      funding-form follow-through, signatures, or other closeout work.
    </Box>
    <Box>
      Select a queue to drive the Work Queue Items table and focus the next actions for that queue.
    </Box>
    <Box>
      When you select <strong>Pending Decision</strong>, the shared table becomes <strong>Pending Decision Items</strong>.
      Use it to scan province, EI status, and timeline target, then open the workspace to review the item. Decision Makers complete the final decision there.
    </Box>
    <Box>
      When a Regional Manager selects <strong>Pending Review</strong>, the table shows submitted assessments,
      proposals, and proposed changes waiting for RM review or waiting for the RM to forward
      the Decision Maker&apos;s requested changes to the submitter.
    </Box>
    <Box>
      EI status does not decide queue ownership. It controls CRF/EI funding alignment and may block
      final approval; the active review stage controls Pending Review versus Pending Decision. CFA
      preparation and signing happen only after final approval when funded cost lines exist.
    </Box>
    <Box>
      When you select <strong>Pending Completion</strong>, the shared table shows decision-recorded applications and
      approved intervention proposal/revision letter follow-ups that are not complete yet.
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
Explain that queues are role-scoped, selecting one updates the Work Queue Items table, and Work queue preferences lets users show/hide queues with browser-saved settings. Mention that final-decision users start with New Applications, In Assessment, Pending Decision, and Pending Completion, then All Cases; Regional Managers get Applications in My Region first, My Applications second, then the shared application-pipeline queues including Pending Review, then Clients in My Region. Regional Managers still keep EI Check Needed as the EI-verification hold stage, while final-decision users do not see that queue separately because those files are folded into New Applications. All Cases counts open client cases across the portfolio, including files with no active plan, and is case-based rather than deduped by person. Applications in My Region includes non-terminal applications in the manager's assigned provinces and territories; Clients in My Region counts open client cases in their regional portfolio, including files with no active plan, and is case-based rather than deduped by person. Clarify that Pending Decision is for Decision Maker final decisions, while Regional Manager Pending Review is for application assessments, new intervention proposals, and proposed intervention changes in RM review or returned to RM after the Decision Maker requested changes. In the returned-to-RM stage, the RM forwards the Decision Maker request to the recorded submitter; corrected work passes RM review again. EI status controls CRF/EI funding alignment, not queue ownership. Pending Completion is post-decision follow-through and may include the exact application/Action Plan-linked CFA and signatures for funded approvals; zero-funding approvals have no CFA package. Decision Makers complete decisions from the workspace after opening the selected row. If a queue appears disabled, clarify it is intentionally non-selectable in the current release.
`;

export default HomeWorkQueueHelp;
