import React from 'react';

const ISET_COORDINATOR_INTRO_TUTORIAL_ID = 'iset-coordinator-intro-v1';

const buildIsetCoordinatorIntroTutorials = ({ completedMap = {} } = {}) => {
  const completed = Boolean(completedMap[ISET_COORDINATOR_INTRO_TUTORIAL_ID]);

  return [
    {
      tutorialId: ISET_COORDINATOR_INTRO_TUTORIAL_ID,
      category: 'admin-console-intro',
      title: 'ISET Coordinator intro tour',
      description: (
        <div>
          <p>Get oriented in the Admin Console home page, widgets, and navigation.</p>
          <p>Starts with where to find tutorials, then walks through the main home page areas.</p>
        </div>
      ),
      tasks: [
        {
          title: 'Welcome',
          steps: [
            {
              title: 'Tutorials and help',
              content: 'Welcome to the Admin Console. Tutorials live under Support in the left navigation.',
              hotspotId: 'intro-tutorials-link'
            },
            {
              title: 'Your home page',
              content: 'When you first sign in, you will land on the home page. It pulls together your queues, widgets, and quick entry points.',
              hotspotId: 'home-overview'
            }
          ]
        },
        {
          title: 'Home page widgets',
          steps: [
            {
              title: 'Work Queue',
              content: 'Use these buckets to focus on the next actions that are assigned to you.',
              hotspotId: 'home-coordinator-work-queue'
            },
            {
              title: 'Queue Items',
              content: 'This table lists items for the selected bucket. Use it to open workspaces and keep files moving.',
              hotspotId: 'home-work-queue-items'
            },
            {
              title: 'My Tagged Applications',
              content: 'Flag important files so they stay visible here for quick access later.',
              hotspotId: 'home-my-tagged-applications'
            }
          ]
        },
        {
          title: 'In-context help',
          steps: [
            {
              title: 'Info links',
              content: 'Most widgets include an Info link. Use it to open help that matches what you are looking at.',
              hotspotId: 'home-info-link'
            }
          ]
        },
        {
          title: 'Navigation',
          steps: [
            {
              title: 'Side navigation',
              content: 'Use the left navigation to switch areas like Applications, Cases, Budgets and Payments, Configuration, and Support.',
              hotspotId: 'intro-side-navigation'
            }
          ]
        }
      ],
      completedScreenDescription: (
        <div>
          <p>Tour complete. You are ready to work from your home page.</p>
          <p>You can always run tutorials later from the Tutorials page under Support.</p>
        </div>
      ),
      completed
    }
  ];
};

export { ISET_COORDINATOR_INTRO_TUTORIAL_ID, buildIsetCoordinatorIntroTutorials };

