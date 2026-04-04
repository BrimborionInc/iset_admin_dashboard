import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeRecentActivityHelp = ({ role }) => {
  const isSystemAdministrator = role === 'System Administrator';

  return (
    <SpaceBetween size="s">
      <Box variant="h3">{isSystemAdministrator ? 'Recent Admin Activity' : 'Recent Activity'}</Box>
      {isSystemAdministrator ? (
        <>
          <Box>
            This widget highlights recent System Administrator activity, including workflow publishes, configuration
            updates, event-capture changes, and relevant admin/system case events.
          </Box>
          <Box>
            Use the links in the activity stream to jump straight into the affected admin surface or case workspace. If
            the live feed is temporarily unavailable, the widget falls back to sample admin activity until the next
            refresh.
          </Box>
        </>
      ) : (
        <>
          <Box>
            This widget lists recent status changes, assignments, and system activity tied to applications and cases.
          </Box>
          <Box>
            Use the links in the activity stream to open related records. If the live feed is temporarily unavailable,
            the widget falls back to sample activity until the next refresh.
          </Box>
        </>
      )}
    </SpaceBetween>
  );
};

HomeRecentActivityHelp.aiContext = `
You are assisting with the homepage activity widget on the NWAC ISET dashboard. For System Administrators, explain that it shows recent admin configuration changes, workflow publishes, and admin/system case events. For other roles, explain that it shows recent activity entries tied to cases and applications, links to related records, and may show sample fallback entries when the live feed is unavailable.
`;

export default HomeRecentActivityHelp;
