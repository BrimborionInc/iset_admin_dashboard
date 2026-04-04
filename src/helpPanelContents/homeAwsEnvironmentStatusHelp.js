import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeAwsEnvironmentStatusHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">AWS Environment Status</Box>
    <Box>
      This System Administrator widget runs read-only AWS checks for the active environment so you can confirm whether
      the services PATH depends on are actually reachable right now.
    </Box>
    <Box>
      The first version checks staff Cognito, applicant Cognito, and SES mail. It is not a full infrastructure monitor
      and it does not send test email or mutate AWS resources.
    </Box>
    <Box>
      Open the linked User Management or Manage Notifications pages when a service shows a warning or error and you need
      to investigate configuration or access follow-up.
    </Box>
  </SpaceBetween>
);

HomeAwsEnvironmentStatusHelp.aiContext = `
You are assisting with the AWS Environment Status widget on the PATH homepage. Explain that it is a System Administrator-only, read-only operational widget that checks whether staff Cognito, applicant Cognito, and SES mail are reachable in the active environment and highlights configuration or access issues without changing AWS state.
`;

export default HomeAwsEnvironmentStatusHelp;
