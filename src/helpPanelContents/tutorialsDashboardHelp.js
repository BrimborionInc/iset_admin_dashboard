import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const TutorialsDashboardHelp = () => {
  return (
    <SpaceBetween size="m">
      <Box variant="p">
        Training shorts are short Synthesia-hosted videos for PATH onboarding and refresher learning.
      </Box>
      <Box variant="p">
        Guided tours are the in-app walkthroughs that can prompt the first time you visit a supported page.
      </Box>
      <Box variant="p">
        Use the guided-tour controls when PATH still feels unfamiliar and you want tours to prompt again for yourself or for staff training.
      </Box>
    </SpaceBetween>
  );
};

TutorialsDashboardHelp.aiContext = `
Tutorials dashboard help:
- Training shorts are Synthesia-hosted videos listed from PATH metadata; PATH does not store MP4 files in the React bundle.
- Guided tours are prompted on first visit to supported pages.
- This page supports per-guided-tour completion toggles and a Reset all action (DB-backed).
- Use the guided-tour controls when staff need tours to prompt again during PATH onboarding or refresher training.
`.trim();

export default TutorialsDashboardHelp;
