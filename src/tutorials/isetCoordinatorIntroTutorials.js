import {
  ISET_COORDINATOR_INTRO_TUTORIAL_ID,
  PROGRAM_ADMIN_INTRO_TUTORIAL_ID,
  REGIONAL_MANAGER_INTRO_TUTORIAL_ID,
  buildTutorialsByCategory
} from './tutorialPlatform';

const buildIsetCoordinatorIntroTutorials = ({ completedMap = {} } = {}) =>
  buildTutorialsByCategory('admin-console-intro', { completedMap });

export {
  ISET_COORDINATOR_INTRO_TUTORIAL_ID,
  REGIONAL_MANAGER_INTRO_TUTORIAL_ID,
  PROGRAM_ADMIN_INTRO_TUTORIAL_ID,
  buildIsetCoordinatorIntroTutorials
};
