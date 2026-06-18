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
      It checks app capacity, database stress, database query pressure, staff Cognito, applicant Cognito, and SES mail.
      It does not send test email, run load tests, or mutate AWS resources.
    </Box>
    <Box>
      Use warning and error summaries as early indicators for unhealthy app instances, high EC2 or Aurora load,
      unusual database query pressure, broken sign-in services, or notification-mail configuration issues.
    </Box>
  </SpaceBetween>
);

HomeAwsEnvironmentStatusHelp.aiContext = `
You are assisting with the AWS Environment Status widget on the PATH homepage. Explain that it is a System Administrator-only, read-only operational widget that checks app capacity, database stress, database query pressure, staff Cognito, applicant Cognito, and SES mail in the active environment. It highlights platform health and configuration issues without changing AWS state, sending test email, or introducing background polling.
`;

export default HomeAwsEnvironmentStatusHelp;
