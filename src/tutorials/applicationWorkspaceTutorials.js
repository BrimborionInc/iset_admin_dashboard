import React from 'react';

const APPLICATION_WORKSPACE_TUTORIAL_ID = 'application-workspace-overview';

const buildApplicationWorkspaceTutorials = ({ completedMap = {} } = {}) => {
  const completed = Boolean(completedMap[APPLICATION_WORKSPACE_TUTORIAL_ID]);

  return [
    {
      tutorialId: APPLICATION_WORKSPACE_TUTORIAL_ID,
      category: 'application-workspace',
      title: 'Application workspace overview',
      description: (
        <div>
          <p>Get oriented in the assessment workspace and learn where each widget lives.</p>
          <p>Starts with Application Overview and Quick actions, then walks through the rest of the board.</p>
        </div>
      ),
      tasks: [
        {
          title: 'Start with the overview',
          steps: [
            {
              title: 'Application Overview',
              content: 'Use this snapshot to confirm status, SLA targets, assignment, and checklist progress.',
              hotspotId: 'app-workspace-application-overview'
            },
            {
              title: 'Quick actions',
              content: 'Assign or reassign, set closure notices, escalate, or apply saved layouts from here.',
              hotspotId: 'app-workspace-quick-actions'
            },
            {
              title: 'ISET Application Form',
              content: 'Review the intake submission, edit when permitted, and compare previous versions.',
              hotspotId: 'app-workspace-application-form'
            }
          ]
        },
        {
          title: 'Work the assessment',
          steps: [
            {
              title: 'Application Assessment',
              content: 'Complete eligibility, assessment, decision, and communication steps in the wizard.',
              hotspotId: 'app-workspace-assessment'
            },
            {
              title: 'Supporting Documents',
              content: 'Validate required evidence, upload missing files, and refresh to sync the checklist.',
              hotspotId: 'app-workspace-supporting-documents'
            },
            {
              title: 'Secure Messaging',
              content: 'Send updates to the applicant, attach files, and track conversation history.',
              hotspotId: 'app-workspace-secure-messaging'
            }
          ]
        },
        {
          title: 'Track follow-up work',
          steps: [
            {
              title: 'Notes and reminders',
              content: 'Capture internal notes, log decisions, and add follow-up reminders.',
              hotspotId: 'app-workspace-notes-tasks'
            },
            {
              title: 'Case calendar',
              content: 'Review upcoming reminders and deadlines in calendar or list view.',
              hotspotId: 'app-workspace-case-calendar'
            },
            {
              title: 'Events timeline',
              content: 'Audit status changes, assignments, and reminders. Export to CSV when needed.',
              hotspotId: 'app-workspace-events-timeline'
            }
          ]
        }
      ],
      completedScreenDescription: (
        <div>
          <p>You are ready to work applications in the assessment workspace.</p>
          <p>Return here anytime to replay the tour or onboard new staff.</p>
        </div>
      ),
      completed
    }
  ];
};

export { APPLICATION_WORKSPACE_TUTORIAL_ID, buildApplicationWorkspaceTutorials };
