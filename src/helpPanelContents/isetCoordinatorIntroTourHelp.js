import React from 'react';
import TutorialPanel from '@cloudscape-design/components/tutorial-panel';
import { useTutorials } from '../context/TutorialsContext';
import { tutorialPanelI18nStrings } from '../tutorials/tutorialI18n';
import { ISET_COORDINATOR_INTRO_TUTORIAL_ID } from '../tutorials/isetCoordinatorIntroTutorials';

const IsetCoordinatorIntroTourHelp = () => {
  const { tutorials } = useTutorials();
  const introTutorials = (tutorials || []).filter(
    tutorial => tutorial?.tutorialId === ISET_COORDINATOR_INTRO_TUTORIAL_ID
  );

  return (
    <div>
      <h2>Take a tour</h2>
      <p>This intro walkthrough highlights your home page, key widgets, and where to find help.</p>

      {introTutorials.length ? (
        <TutorialPanel tutorials={introTutorials} i18nStrings={tutorialPanelI18nStrings} />
      ) : (
        <p>No hands-on tutorials are available yet.</p>
      )}
    </div>
  );
};

export default IsetCoordinatorIntroTourHelp;

