import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const HomeOperationsSnapshotHelp = () => (
  <SpaceBetween size="s">
    <Box variant="h3">Operations Snapshot</Box>
    <Box>
      This System Administrator widget highlights the current operational work that needs follow-up, not normal casework.
    </Box>
    <Box>
      Counts open the relevant management surfaces for ILMP submission blockers, applicant-account activation backlog, and staff access hygiene.
    </Box>
    <Box>
      Use it as the homepage triage point before opening deeper reporting or user-management pages.
    </Box>
  </SpaceBetween>
);

HomeOperationsSnapshotHelp.aiContext = `
You are assisting with the System Administrator Operations Snapshot widget on the PATH homepage.
Explain that it summarizes operational backlog and exception counts, and that each count links to the relevant admin surface for follow-up.
`;

export default HomeOperationsSnapshotHelp;
