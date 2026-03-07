import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const ManualApplicationIntakeHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>Purpose</strong>
      <p>
        Use this page to create applications received outside the portal, such as paper or PDF forms.
      </p>
    </Box>
    <Box>
      <strong>When to use this page</strong>
      <p>
        Use Manual Intake when an applicant did not submit through the public portal and staff need to key in the
        form details. It is also appropriate for offline data-entry backlog work.
      </p>
    </Box>
    <Box>
      <strong>After creating an application</strong>
      <p>
        The new record is added to the Applications list, and PATH opens the Application Workspace for that file.
        If supporting documents were received separately, staff must upload them manually in the workspace.
      </p>
    </Box>
    <Box>
      <strong>Activity history</strong>
      <p>
        PATH records that the application was submitted through Manual Intake and captures the staff user who created it.
      </p>
    </Box>
  </SpaceBetween>
);

ManualApplicationIntakeHelp.aiContext =
  'Explain manual intake in plain language for staff users. Focus on what they do on this page, when create is allowed, what happens after create, and where to find the resulting application. Mention Add widget and Reset layout only as simple page controls.';

export default ManualApplicationIntakeHelp;
