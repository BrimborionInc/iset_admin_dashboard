import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const TutorialsDashboardHelp = () => {
  return (
    <SpaceBetween size="m">
      <Box variant="p">
        Tutorials auto-prompt the first time you visit a page that supports a tour.
      </Box>
      <Box variant="p">
        Use this page when PATH still feels unfamiliar and you want tours to prompt again for yourself or for staff training.
      </Box>
      <Box variant="p">
        Each tutorial can be marked complete or incomplete, and Reset all clears both completion and dismissal state across all tutorials.
      </Box>
    </SpaceBetween>
  );
};

TutorialsDashboardHelp.aiContext = `
Tutorials dashboard help:
- Tutorials are prompted on first visit to supported pages.
- This page supports per-tutorial completion toggles and a Reset all action (DB-backed).
- Use it when staff need tours to prompt again during PATH onboarding or refresher training.
`.trim();

export default TutorialsDashboardHelp;
