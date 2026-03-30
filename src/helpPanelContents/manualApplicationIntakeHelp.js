import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const ManualApplicationIntakeHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Use this page to enter an application that did not arrive through the public portal, such as a
        paper form, PDF, phone intake, or in-person intake.
      </p>
    </Box>
    <Box>
      <strong>Before you start</strong>
      <p>
        Work from the source document or notes in front of you. Enter the applicant&apos;s information as
        accurately as possible, choose the correct intake source, and use source notes when the origin
        needs explanation.
      </p>
    </Box>
    <Box>
      <strong>How the intake flow behaves</strong>
      <p>
        PATH validates each step before moving forward. If you leave and come back in the same browser,
        the page can restore your in-progress draft. Use <em>Reset</em> only when you want to clear the
        local draft and start over.
      </p>
    </Box>
    <Box>
      <strong>After creating the application</strong>
      <p>
        PATH creates the application record and opens the Application Workspace for that file. Upload any
        supporting documents that were received separately, and record any applicant follow-up in notes or
        secure messaging once the file is open.
      </p>
    </Box>
    <Box>
      <strong>Training-aligned reminders</strong>
      <p>
        Manual Intake should support the same staff expectations used in training: enter the file promptly,
        keep the record complete, acknowledge missing information quickly, and make sure documents and staff
        interactions are captured in PATH.
      </p>
    </Box>
  </SpaceBetween>
);

ManualApplicationIntakeHelp.aiContext =
  `You are assisting staff using the Manual Application Intake page in PATH.

Explain the page as a staff data-entry workflow, not a technical feature:
- Use it for applications received outside the public portal.
- Tell the user to work from the paper/PDF/phone/in-person source and enter the information accurately.
- Explain that each step validates before Next, drafts can be restored in the same browser session, and Reset clears the local draft.
- After Create Application, PATH opens the new Application Workspace where documents, notes, and applicant follow-up continue.

Training-aligned reminders to mention when relevant:
- Enter new applications promptly.
- Missing information should be followed up and documented.
- Keep documents and staff interactions recorded in PATH.
- All files should remain tracked even if they are later not funded.`;

export default ManualApplicationIntakeHelp;
