const tutorialPanelI18nStrings = {
  loadingText: 'Loading tutorials',
  tutorialListTitle: 'Hands-on tutorials',
  tutorialListDescription: 'Guided walkthroughs with on-screen highlights.',
  tutorialListDownloadLinkText: 'Download tutorial guide',
  tutorialCompletedText: 'Tutorial completed',
  learnMoreLinkText: 'Learn more',
  startTutorialButtonText: 'Start tutorial',
  restartTutorialButtonText: 'Restart tutorial',
  completionScreenTitle: 'Tutorial completed',
  feedbackLinkText: 'Share feedback',
  dismissTutorialButtonText: 'Dismiss',
  taskTitle: (taskIndex, taskTitle) => `Task ${taskIndex + 1}: ${taskTitle}`,
  stepTitle: (stepIndex, stepTitle) => `Step ${stepIndex + 1}: ${stepTitle}`,
  labelExitTutorial: 'Exit tutorial',
  labelTotalSteps: totalStepCount => `Total steps: ${totalStepCount}`,
  labelLearnMoreExternalIcon: 'Opens in a new tab',
  labelsTaskStatus: {
    pending: 'Not started',
    'in-progress': 'In progress',
    success: 'Completed'
  }
};

const annotationContextI18nStrings = {
  nextButtonText: 'Next',
  previousButtonText: 'Previous',
  finishButtonText: 'Finish',
  labelDismissAnnotation: 'Close tutorial',
  labelHotspot: (openState, stepIndex, totalStepCount) =>
    `${openState ? 'Close' : 'Open'} tutorial step ${stepIndex + 1} of ${totalStepCount}`,
  stepCounterText: (stepIndex, totalStepCount) => `Step ${stepIndex + 1} of ${totalStepCount}`,
  taskTitle: (taskIndex, taskTitle) => `Task ${taskIndex + 1}: ${taskTitle}`
};

export { tutorialPanelI18nStrings, annotationContextI18nStrings };
