import React from 'react';
import { Button, SpaceBetween } from '@cloudscape-design/components';

const IsetCoordinatorIntroTourHelp = ({ tutorial, onRestartTutorial, onEndTutorial }) => {
  const tutorialTitle = tutorial?.title || 'Home intro tour';

  return (
    <div>
      <h2>Take a tour</h2>
      <p><strong>{tutorialTitle}</strong></p>
      <p>This walkthrough highlights your home page, key widgets, and where to find help.</p>
      <SpaceBetween direction="horizontal" size="xs">
        <Button onClick={() => onRestartTutorial?.()}>Restart tour</Button>
        <Button onClick={() => onEndTutorial?.()}>End</Button>
      </SpaceBetween>
      <p>
        Use the on-screen hotspot prompts to move step by step. You can exit at any time and re-run tutorials later
        from the Tutorials page under Support.
      </p>
    </div>
  );
};

export default IsetCoordinatorIntroTourHelp;
