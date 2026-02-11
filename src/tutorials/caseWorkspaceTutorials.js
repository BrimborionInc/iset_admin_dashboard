import {
  CASE_WORKSPACE_TUTORIAL_ID,
  buildTutorialsByCategory
} from './tutorialPlatform';

const buildCaseWorkspaceTutorials = ({ completedMap = {} } = {}) =>
  buildTutorialsByCategory('case-workspace', { completedMap });

export { CASE_WORKSPACE_TUTORIAL_ID, buildCaseWorkspaceTutorials };
