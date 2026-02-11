import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const TutorialsDashboardHelp = () => {
  return (
    <SpaceBetween size="m">
      <Box variant="p">
        Tutorials auto-prompt the first time you visit a page that supports a tour.
      </Box>
      <Box variant="p">
        This page lets you manage tutorial status per tutorial using completion toggles.
      </Box>
      <Box variant="p">
        Use Reset all to clear both completion and dismissal state across all tutorials.
      </Box>
    </SpaceBetween>
  );
};

TutorialsDashboardHelp.aiContext = `
Tutorials dashboard help:
- Tutorials are prompted on first visit to supported pages.
- This page supports per-tutorial completion toggles and a Reset all action (DB-backed).
`.trim();

export default TutorialsDashboardHelp;
