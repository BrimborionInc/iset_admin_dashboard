import React from 'react';
import { Button, SpaceBetween } from '@cloudscape-design/components';

const IsetCoordinatorIntroTourHelp = ({ tutorial, onRestartTutorial, onEndTutorial }) => {
  const tutorialTitle = tutorial?.title || 'PATH quick start';

  return (
    <div>
      <h2>PATH Quick Start</h2>
      <p><strong>{tutorialTitle}</strong></p>
      <p>This walkthrough is meant for staff who are still getting used to PATH. It shows how to decide what to work on first, open the right file, and find help when you get stuck.</p>
      <SpaceBetween direction="horizontal" size="xs">
        <Button onClick={() => onRestartTutorial?.()}>Restart tour</Button>
        <Button onClick={() => onEndTutorial?.()}>End</Button>
      </SpaceBetween>
      <p>
        Use the on-screen hotspot prompts to move step by step. You can exit at any time and replay tutorials later
        from the help panel or from the Tutorials page under Support.
      </p>
    </div>
  );
};

export default IsetCoordinatorIntroTourHelp;
