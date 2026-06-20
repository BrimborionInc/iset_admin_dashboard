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
        <li><strong>My Applications:</strong> assigned application files that remain in your queue until the application is fully complete.</li>
        <li><strong>My Clients:</strong> assigned client case files, including files that no longer have an active application task.</li>
        <li><strong>EI Verification Pending:</strong> cases waiting for EI consent or verification before the assessment can move forward.</li>
        <li><strong>Ready to assess:</strong> files that appear ready for the assessment and recommendation work.</li>
        <li><strong>Missing Docs / Follow-ups Needed:</strong> applications waiting on the applicant.</li>
        <li><strong>Submitted for Review:</strong> application assessments and new/revised intervention proposals you submitted for Regional Manager or final decision review.</li>
        <li><strong>Pending Completion:</strong> approved application assessments that still need approval-letter, document, signature, or final completion work; denied applications stay here only until the denial letter is sent.</li>
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
- My Applications -> open the assigned file; keep decision-recorded applications here until completion follow-through is done.
- My Clients -> open an assigned client case file in Case Workspace.
- EI Verification Pending -> check consent/verification requirements before assessment.
- Ready to assess -> complete the assessment and recommendation.
- Missing Docs / Follow-ups Needed -> contact the applicant, request missing items, and document the attempt.
- Submitted for Review -> monitor application assessments and intervention proposals/revisions submitted for Regional Manager or final decision review.
- Pending Completion / Active Clients / Payments / Follow-ups -> continue post-decision and active case-management work after approval or denial, including approved intervention proposal/revision approval-letter follow-up.

Always mention that the selected card drives the Work Queue Items table, and that Work queue preferences lets the user show or hide queue cards in this browser.
`;

export default HomeCoordinatorWorkQueueHelp;
