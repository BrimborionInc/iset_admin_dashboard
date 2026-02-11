import {
  APPLICATION_WORKSPACE_TUTORIAL_ID,
  buildTutorialsByCategory
} from './tutorialPlatform';

const buildApplicationWorkspaceTutorials = ({ completedMap = {} } = {}) =>
  buildTutorialsByCategory('application-workspace', { completedMap });

export { APPLICATION_WORKSPACE_TUTORIAL_ID, buildApplicationWorkspaceTutorials };
