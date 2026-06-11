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
        Use the flow widget at the top as the working order: confirm the applicant&apos;s identity, check for
        an existing PATH client or applicant account, choose the account handling plan, complete the
        application details, then submit and follow up from the workspace.
      </p>
    </Box>
    <Box>
      <strong>Wizard steps</strong>
      <p>
        The wizard walks through identity, existing-account search, account handling, application details,
        and review. Select an existing client/account when the applicant is already known to PATH, prepare
        a PATH account for later activation when the applicant is ready for portal access, or record why
        portal access is not planned yet.
      </p>
    </Box>
    <Box>
      <strong>How the intake flow behaves</strong>
      <p>
        PATH validates each step before moving forward. If you leave and come back in the same browser,
        the page can restore your in-progress draft. Manual Intake now follows the published schema&apos;s
        conditional visibility rules and skips steps that have nothing left to enter for the current answer
        path. Use <em>Reset</em> only when you want to clear the local draft and start over.
      </p>
    </Box>
    <Box>
      <strong>Limits to know</strong>
      <p>
        Manual Intake is for entering the application data itself. Steps that are only for portal uploads or
        portal-only signing are not completed here and may be skipped in the manual path.
      </p>
    </Box>
    <Box>
      <strong>After creating the application</strong>
      <p>
        PATH creates the application record and opens the Application Workspace for that file. Upload any
        supporting documents that were received separately, send or defer PATH account activation as
        appropriate, and record any applicant follow-up in notes or secure messaging once the file is open.
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
- Tell the user to follow the top flow widget and wizard steps: confirm identity, check existing account/client records, choose account handling, enter the application information accurately, then submit and follow up from the workspace.
- Explain that the wizard helps staff avoid duplicate clients, reuse an existing account/case when selected, prepare an account for later activation, or record why portal access is not planned yet.
- Explain that each step validates before Next, drafts can be restored in the same browser session, conditional visibility can hide and skip irrelevant steps, and Reset clears the local draft.
- Mention that upload-only or portal-signature-only steps are not completed in Manual Intake and may be skipped in this admin path.
- After Create Application, PATH opens the Application Workspace where documents, PATH account activation, notes, and applicant follow-up continue.

Training-aligned reminders to mention when relevant:
- Enter new applications promptly.
- Missing information should be followed up and documented.
- Keep documents and staff interactions recorded in PATH.
- All files should remain tracked even if they are later not funded.`;

export default ManualApplicationIntakeHelp;
