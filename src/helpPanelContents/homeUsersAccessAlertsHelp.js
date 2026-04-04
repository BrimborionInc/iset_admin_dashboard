import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeUsersAccessAlertsHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Users & Access Alerts</Box>
    <Box>
      This widget highlights operational identity and access follow-up for System Administrators, including staff MFA
      gaps, pending first sign-in or reset states, disabled accounts, and applicant activation backlog.
    </Box>
    <Box>
      The policy strip shows the current staff-pool MFA posture and temporary password settings so you can judge how
      urgent each alert count is before opening User Management.
    </Box>
    <Box>
      Use the linked alert titles to open User Management in the relevant filtered tab. The widget is read-only and
      does not change account state directly.
    </Box>
  </SpaceBetween>
);

HomeUsersAccessAlertsHelp.aiContext = `
You are assisting with the Users & Access Alerts widget on the NWAC ISET homepage. Explain that it shows System Administrator identity/access follow-up counts such as staff MFA gaps, pending reset or first-sign-in states, disabled accounts, never-signed-in accounts, and applicant activation backlog, plus a small staff-pool policy summary.
`;

export default HomeUsersAccessAlertsHelp;
