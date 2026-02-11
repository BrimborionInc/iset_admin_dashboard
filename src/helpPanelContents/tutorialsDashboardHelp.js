import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const TutorialsDashboardHelp = () => {
  return (
    <SpaceBetween size="m">
      <Box variant="p">
        Tutorials auto-prompt the first time you visit a page that supports a tour.
      </Box>
      <Box variant="p">
        This page is for resetting your tutorial progress so tours may prompt again.
      </Box>
      <Box variant="p">
        Resetting clears both completion and dismissal state.
      </Box>
    </SpaceBetween>
  );
};

TutorialsDashboardHelp.aiContext = `
Tutorials dashboard help:
- Tutorials are prompted on first visit to supported pages.
- This page resets per-user tutorial completion/dismissal state (DB-backed).
`.trim();

export default TutorialsDashboardHelp;
