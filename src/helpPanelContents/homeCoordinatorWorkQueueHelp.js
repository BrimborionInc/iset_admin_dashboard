import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeCoordinatorWorkQueueHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Work Queue (ISET Coordinator)</Box>
    <Box>
      This widget is the coordinator&apos;s daily priority list. Each card groups work that needs a
      different kind of follow-up, from new applications through active-case check-ins and closure.
    </Box>
    <Box>
      Select a queue card to drive the Work Queue Items table below. Open the record from that table,
      then do the detailed work in the Application Workspace or Case Workspace.
    </Box>
    <Box>
      Common coordinator queues include:
      <ul>
        <li><strong>My Applications:</strong> assigned application files that need review.</li>
        <li><strong>EI Verification Pending:</strong> cases waiting for EI consent or verification before the assessment can move forward.</li>
        <li><strong>Ready to assess:</strong> files that appear ready for the assessment and recommendation work.</li>
        <li><strong>Missing Docs / Follow-ups Needed:</strong> applications waiting on the applicant.</li>
        <li><strong>Awaiting Approval:</strong> recommendations already submitted to NWAC.</li>
        <li><strong>Pending Completion:</strong> decision-recorded files that still need letters, funding forms, signatures, or other post-decision follow-through before completion.</li>
        <li><strong>Active Clients</strong>, <strong>Payments &amp; Proof Due</strong>, and <strong>Follow-ups &amp; File Closure Due:</strong> active case-management work after approval.</li>
      </ul>
    </Box>
    <Box>
      Use <strong>Work queue preferences</strong> in the widget header to choose which queue cards
      appear. Your selections are saved in this browser.
    </Box>
  </SpaceBetween>
);

HomeCoordinatorWorkQueueHelp.aiContext = `
You are assisting with the ISET Coordinator Work Queue widget on the NWAC ISET homepage.
Explain the coordinator queue cards in staff language and connect them to the next job step, not just the UI:
- My Applications -> open the assigned file and review it.
- EI Verification Pending -> check consent/verification requirements before assessment.
- Ready to assess -> complete the assessment and recommendation.
- Missing Docs / Follow-ups Needed -> contact the applicant, request missing items, and document the attempt.
- Awaiting Approval -> monitor files submitted to NWAC.
- Pending Completion / Active Clients / Payments / Follow-ups -> continue post-decision and active case-management work after approval or denial.

Always mention that the selected card drives the Work Queue Items table, and that Work queue preferences lets the user show or hide queue cards in this browser.
`;

export default HomeCoordinatorWorkQueueHelp;
