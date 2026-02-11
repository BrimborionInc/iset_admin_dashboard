import {
  NWAC_ASSESSMENT_TUTORIAL_ID,
  buildTutorialsByCategory
} from './tutorialPlatform';

const buildNwacAssessmentTutorials = ({ completedMap = {} } = {}) =>
  buildTutorialsByCategory('nwac-assessment', { completedMap });

export { NWAC_ASSESSMENT_TUTORIAL_ID, buildNwacAssessmentTutorials };
