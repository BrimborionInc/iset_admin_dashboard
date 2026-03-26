import React from 'react';

const ISET_COORDINATOR_INTRO_TUTORIAL_ID = 'iset-coordinator-intro-v1';
const REGIONAL_MANAGER_INTRO_TUTORIAL_ID = 'regional-manager-intro-v1';
const PROGRAM_ADMIN_INTRO_TUTORIAL_ID = 'program-admin-intro-v1';
const APPLICATION_WORKSPACE_TUTORIAL_ID = 'application-workspace-overview-v2';
const CASE_WORKSPACE_TUTORIAL_ID = 'case-workspace-overview-v2';
const NWAC_ASSESSMENT_TUTORIAL_ID = 'nwac-assessment-decision';

const TUTORIAL_DEFINITIONS = [
  {
    tutorialId: ISET_COORDINATOR_INTRO_TUTORIAL_ID,
    category: 'admin-console-intro',
    title: 'ISET Coordinator intro tour',
    descriptionLines: [
      'Get oriented in the Admin Console home page, widgets, and navigation.',
      'Starts with your home page, then walks through key areas and where to manage tutorials.'
    ],
    completedLines: [
      'Tour complete. You are ready to work from your home page.',
      'You can always run tutorials later from the Tutorials page under Support.'
    ],
    tasks: [
      {
        title: 'Homepage walkthrough',
        steps: [
          {
            title: 'Your home page',
            content: 'When you first sign in, you will land on the home page. It pulls together your queues, widgets, and quick entry points.',
            hotspotId: 'home-overview'
          },
          {
            title: 'How this page is structured',
            content: 'Your homepage is a dashboard. A dashboard is made up of widgets that you can move, resize, remove and add to suit your preferences.',
            hotspotId: 'home-overview'
          },
          {
            title: 'Customize your layout',
            content: 'Use + Add widget to open the palette and add panels back. Use each widget menu to remove it. Drag widgets to rearrange, drag edges/corners to resize, and use Reset layout to restore the default setup.',
            hotspotId: 'home-layout-controls'
          },
          {
            title: 'Work Queue',
            content: 'Use these queues to focus on the next actions that are assigned to you.',
            hotspotId: 'home-coordinator-work-queue'
          },
          {
            title: 'Queue Items',
            content: 'This table lists items for the selected queue. Use it to open workspaces and keep files moving.',
            hotspotId: 'home-work-queue-items'
          },
          {
            title: 'My Tagged Applications',
            content: 'Tag important files so they stay visible here for quick access later.',
            hotspotId: 'home-my-tagged-applications'
          },
          {
            title: 'Info links',
            content: 'Most widgets include an Info link. Use it to open help that matches what you are looking at.',
            hotspotId: 'home-work-queue-items'
          },
          {
            title: 'Side navigation',
            content: 'Use the left navigation to switch areas like Applications, Cases, Budgets and Payments, Configuration, and Support.',
            hotspotId: 'intro-side-navigation'
          },
          {
            title: 'Tutorials and help',
            content: 'You can reset tutorial progress from the Tutorials dashboard under Support.',
            hotspotId: 'intro-tutorials-link'
          }
        ]
      }
    ]
  },
  {
    tutorialId: REGIONAL_MANAGER_INTRO_TUTORIAL_ID,
    category: 'admin-console-intro',
    title: 'Regional Manager intro tour',
    descriptionLines: [
      'Get oriented in the Admin Console home page, queue workflow, and navigation.',
      'Starts with your home page, then walks through key manager widgets and tutorial controls.'
    ],
    completedLines: [
      'Tour complete. You are ready to manage work from the home page.',
      'You can always run tutorials later from the Tutorials page under Support.'
    ],
    tasks: [
      {
        title: 'Homepage walkthrough',
        steps: [
          {
            title: 'Your home page',
            content: 'When you first sign in, you will land on the home page. It gives you queue visibility and quick access to files.',
            hotspotId: 'home-overview'
          },
          {
            title: 'How this page is structured',
            content: 'Your homepage is a dashboard. A dashboard is made up of widgets that you can move, resize, remove and add to suit your preferences.',
            hotspotId: 'home-overview'
          },
          {
            title: 'Customize your layout',
            content: 'Use + Add widget to open the palette and add panels back. Use each widget menu to remove it. Drag widgets to rearrange, drag edges/corners to resize, and use Reset layout to return to the default layout.',
            hotspotId: 'home-layout-controls'
          },
          {
            title: 'Work Queue',
            content: 'Use queues to prioritize unassigned, escalated, and approval work across your scope.',
            hotspotId: 'home-program-work-queue'
          },
          {
            title: 'Queue Items',
            content: 'This table lists items for the selected queue with direct links into the right workspace.',
            hotspotId: 'home-work-queue-items'
          },
          {
            title: 'My Tagged Applications',
            content: 'Tag files you want to track closely and return to quickly.',
            hotspotId: 'home-my-tagged-applications'
          },
          {
            title: 'Info links',
            content: 'Most widgets include an Info link for context-aware guidance.',
            hotspotId: 'home-work-queue-items'
          },
          {
            title: 'Side navigation',
            content: 'Use the left navigation to move between applications, workspaces, budgets/payments, configuration, and support.',
            hotspotId: 'intro-side-navigation'
          },
          {
            title: 'Tutorials and help',
            content: 'You can reset tutorial progress from the Tutorials dashboard under Support.',
            hotspotId: 'intro-tutorials-link'
          }
        ]
      }
    ]
  },
  {
    tutorialId: PROGRAM_ADMIN_INTRO_TUTORIAL_ID,
    category: 'admin-console-intro',
    title: 'NWAC Administrator intro tour',
    descriptionLines: [
      'Get oriented in the Admin Console home page, queue workflow, and navigation.',
      'Starts with your home page, then walks through key administrator widgets and tutorial controls.'
    ],
    completedLines: [
      'Tour complete. You are ready to manage operations from the home page.',
      'You can always run tutorials later from the Tutorials page under Support.'
    ],
    tasks: [
      {
        title: 'Homepage walkthrough',
        steps: [
          {
            title: 'Your home page',
            content: 'When you first sign in, you will land on your home page dashboard. This gives you a consolidated view of your work and allows you to switch between queues of work items. Notifications are shown at the top of the dashboard.',
            hotspotId: 'home-overview'
          },
          {
            title: 'How this page is structured',
            content: 'Your homepage is a dashboard. A dashboard is made up of widgets that you can move, resize, remove and add to suit your preferences.',
            hotspotId: 'home-overview'
          },
          {
            title: 'Customize your layout',
            content: 'Use + Add widget to open the palette and add panels back. Use each widget menu to remove it. Drag widgets to rearrange, drag edges/corners to resize, and use Reset layout to return to the default layout.',
            hotspotId: 'home-layout-controls'
          },
          {
            title: 'Work Queue',
            content: 'Use queues to work unassigned files, approvals, escalations, and overdue actions.',
            hotspotId: 'home-program-work-queue'
          },
          {
            title: 'Queue Items',
            content: 'This table lists items for the selected queue with direct links into the right workspace.',
            hotspotId: 'home-work-queue-items'
          },
          {
            title: 'My Tagged Applications',
            content: 'Tag priority files so you can return to them quickly.',
            hotspotId: 'home-my-tagged-applications'
          },
          {
            title: 'Info links',
            content: 'Most widgets include an Info link for context-aware guidance.',
            hotspotId: 'home-work-queue-items'
          },
          {
            title: 'Side navigation',
            content: 'Use the left navigation to move between applications, workspaces, budgets/payments, configuration, and support.',
            hotspotId: 'intro-side-navigation'
          },
          {
            title: 'Tutorials and help',
            content: 'You can reset tutorial progress from the Tutorials dashboard under Support.',
            hotspotId: 'intro-tutorials-link'
          }
        ]
      }
    ]
  },
  {
    tutorialId: APPLICATION_WORKSPACE_TUTORIAL_ID,
    category: 'application-workspace',
    title: 'Application workspace overview',
    descriptionLines: [
      'Get oriented in the assessment workspace and learn where each widget lives.',
      'Starts with Application Overview and Quick actions, then walks through the rest of the board.'
    ],
    completedLines: [
      'You are ready to work applications in the assessment workspace.',
      'Return here anytime to replay the tour or onboard new staff.'
    ],
    tasks: [
      {
        title: 'Application workspace walkthrough',
        steps: [
          {
            title: 'Application Overview',
            content: 'Start here to orient yourself. Confirm which file you are in, check current status and owner, review checklist progress, and note any lock or escalation context before editing anything.',
            hotspotId: 'app-workspace-application-overview'
          },
          {
            title: 'Quick actions',
            content: 'Use Quick actions to switch between focused dashboard layouts (review, documents/messages, notes/calendar, audit trail) and, when your role allows, run assignment, escalation, and closure actions.',
            hotspotId: 'app-workspace-quick-actions'
          },
          {
            title: 'ISET Application Form',
            content: 'Review the original intake submission and signatures here. Use Edit only when permitted, then save updates and check version history if you need to compare or restore prior values.',
            hotspotId: 'app-workspace-application-form'
          },
          {
            title: 'Application Assessment',
            content: 'Complete the assessment workflow in order: declaration, eligibility, recommendation, and review. Save progress as you work, then submit to move the file into the NWAC decision stage.',
            hotspotId: 'app-workspace-assessment'
          },
          {
            title: 'Supporting Documents',
            content: 'Use this widget to validate evidence and checklist requirements, upload or relabel files, and confirm the application has the required supporting documents before final decisions.',
            hotspotId: 'app-workspace-supporting-documents'
          },
          {
            title: 'Secure Messaging',
            content: 'Communicate directly with the applicant from here. Use threads to request missing information, send updates, and track message history; attachments are available in Supporting Documents.',
            hotspotId: 'app-workspace-secure-messaging'
          },
          {
            title: 'Notes and tasks',
            content: 'Capture internal case notes, rationale, and follow-up tasks for staff. Use this for your operational record and handoffs that should stay inside the admin workspace.',
            hotspotId: 'app-workspace-notes-tasks'
          },
          {
            title: 'Case calendar',
            content: 'Review upcoming deadlines and reminders in calendar or list view so follow-ups, milestone dates, and due items are not missed.',
            hotspotId: 'app-workspace-case-calendar'
          },
          {
            title: 'Events timeline',
            content: 'Use the Events Timeline as your audit trail for status changes, assignment updates, reminders, and key case activity. Filter to investigate what changed and when.',
            hotspotId: 'app-workspace-events-timeline'
          }
        ]
      }
    ]
  },
  {
    tutorialId: CASE_WORKSPACE_TUTORIAL_ID,
    category: 'case-workspace',
    title: 'Case workspace overview',
    descriptionLines: [
      'Get oriented in the case workspace and learn where to manage plans, interventions, documents, and client communications.',
      'Starts with the case header and quick actions, then walks through the key operational widgets.'
    ],
    completedLines: [
      'You are ready to work cases in the case workspace.',
      'Return here anytime from the help panel to replay this walkthrough.'
    ],
    tasks: [
      {
        title: 'Case workspace walkthrough',
        steps: [
          {
            title: 'Case header',
            content: 'Start here to confirm which case you are in, current lifecycle status, assigned owner, and key dates before making updates.',
            hotspotId: 'case-workspace-header'
          },
          {
            title: 'Quick actions and layouts',
            content: 'Use Quick actions to switch focused layouts (plans, notes/calendar, documents/messages, payments, and compliance) and to run key case actions when your role allows.',
            hotspotId: 'case-workspace-quick-actions'
          },
          {
            title: 'Participant details',
            content: 'Keep participant details current here as circumstances change. This case-level profile supports case operations and should stay aligned with verified updates.',
            hotspotId: 'case-workspace-participant-details'
          },
          {
            title: 'Action plans',
            content: 'Create and manage action plans, then select the active plan to control which interventions are in scope for day-to-day delivery.',
            hotspotId: 'case-workspace-action-plans'
          },
          {
            title: 'Interventions',
            content: 'Manage interventions under the selected action plan, track status and costs, and progress each intervention through its lifecycle.',
            hotspotId: 'case-workspace-interventions'
          },
          {
            title: 'Supporting documents',
            content: 'Review evidence and uploaded files for this case. Use filters to focus context and confirm required documentation is available.',
            hotspotId: 'app-workspace-supporting-documents'
          },
          {
            title: 'Secure messaging',
            content: 'Communicate with the participant and maintain message history. Use this for requests, updates, and documented follow-up communications.',
            hotspotId: 'app-workspace-secure-messaging'
          },
          {
            title: 'Notes and calendar',
            content: 'Use Notes and Tasks for internal context, then track upcoming obligations in the Case Calendar so follow-ups and milestones are not missed.',
            hotspotId: 'app-workspace-notes-tasks'
          },
          {
            title: 'Tutorials and help',
            content: 'You can replay tutorials from dashboard and widget Info links in the help panel, and reset tutorial progress from the Tutorials dashboard under Support.',
            hotspotId: 'case-workspace-header'
          }
        ]
      }
    ]
  },
  {
    tutorialId: NWAC_ASSESSMENT_TUTORIAL_ID,
    category: 'nwac-assessment',
    title: 'NWAC assessment decision',
    descriptionLines: [
      'Record the NWAC decision, confirm assurance, and communicate the outcome.',
      'Guidance highlights consistency checks and approval requirements from Module 9.'
    ],
    completedLines: [
      'NWAC decision recorded. You can return here to review communication steps or restart the tutorial.'
    ],
    tasks: [
      {
        title: 'NWAC decision walkthrough',
        steps: [
          {
            title: 'Funding decision',
            content: 'Select Approved, Not Approved, or Push back. Use Push back if the assessment needs corrections. NWAC guidance expects a response within about 5 business days of submission. Use Commit at the bottom to record the decision and unlock Communication.',
            hotspotId: 'nwac-decision-status'
          },
          {
            title: 'Assessment assurance',
            content: 'Record whether you agree or disagree with the coordinator recommendation. Confirm the assessment tells the story of the file, includes clear justification, and that amounts, dates, and program details match supporting documents and prior ISET history.',
            hotspotId: 'nwac-assessment-assurance'
          },
          {
            title: 'Decision reason',
            content: 'If not approving or pushing back, enter a clear reason that ties to evidence. This text feeds the denial letter, so do not introduce new reasons later.',
            hotspotId: 'nwac-decision-reason'
          },
          {
            title: 'Budget pot and paid from',
            content: 'For approvals with costs, assign the budget pot and paid-from context. Amounts must match the NWAC-approved recommendation; changes require re-approval before issuing the funding agreement.',
            hotspotId: 'nwac-budget-pot'
          },
          {
            title: 'Decision letter',
            content: 'Use Decision letter to draft and send the approval or denial. Ensure the decision and reason are consistent with what you recorded. Communicate the outcome to the client and document it in the case record.',
            hotspotId: 'nwac-decision-letter'
          }
        ]
      }
    ]
  }
];

const HOME_INTRO_TUTORIAL_IDS = new Set([
  ISET_COORDINATOR_INTRO_TUTORIAL_ID,
  REGIONAL_MANAGER_INTRO_TUTORIAL_ID,
  PROGRAM_ADMIN_INTRO_TUTORIAL_ID
]);

const renderParagraphs = (lines = []) => (
  <div>
    {lines.map((line, index) => (
      <p key={index}>{line}</p>
    ))}
  </div>
);

const cloneTasks = (tasks = []) => tasks.map(task => ({
  ...task,
  steps: (task.steps || []).map(step => ({ ...step }))
}));

const validateTutorialDefinitions = () => {
  const ids = new Set();
  TUTORIAL_DEFINITIONS.forEach((definition) => {
    const id = definition?.tutorialId;
    if (!id || ids.has(id)) {
      throw new Error(`Invalid or duplicate tutorialId: ${String(id)}`);
    }
    ids.add(id);
    if (!Array.isArray(definition.tasks) || definition.tasks.length === 0) {
      throw new Error(`Tutorial ${id} must include at least one task`);
    }
    definition.tasks.forEach((task, taskIndex) => {
      if (!Array.isArray(task.steps) || task.steps.length === 0) {
        throw new Error(`Tutorial ${id} task ${taskIndex + 1} must include at least one step`);
      }
    });
  });
};

validateTutorialDefinitions();

const buildTutorials = ({ completedMap = {} } = {}) => TUTORIAL_DEFINITIONS.map((definition) => ({
  tutorialId: definition.tutorialId,
  category: definition.category,
  title: definition.title,
  description: renderParagraphs(definition.descriptionLines),
  tasks: cloneTasks(definition.tasks),
  completedScreenDescription: renderParagraphs(definition.completedLines),
  completed: Boolean(completedMap[definition.tutorialId])
}));

const buildTutorialsByCategory = (category, { completedMap = {} } = {}) =>
  buildTutorials({ completedMap }).filter(tutorial => tutorial.category === category);

const normalizeRole = (role) => String(role || '')
  .trim()
  .toLowerCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ');

const getHomeIntroTutorialIdForRole = (role) => {
  const normalized = normalizeRole(role);
  if (!normalized) return null;

  if (
    normalized === 'iset coordinator' ||
    normalized === 'iset coordinator'
  ) {
    return ISET_COORDINATOR_INTRO_TUTORIAL_ID;
  }

  if (
    normalized === 'regional manager' ||
    normalized === 'regional manager'
  ) {
    return REGIONAL_MANAGER_INTRO_TUTORIAL_ID;
  }

  if (
    normalized === 'nwac administrator' ||
    normalized === 'program admin' ||
    normalized === 'nwac administrator'
  ) {
    return PROGRAM_ADMIN_INTRO_TUTORIAL_ID;
  }

  return null;
};

const isHomeIntroTutorialId = (tutorialId) =>
  typeof tutorialId === 'string' && HOME_INTRO_TUTORIAL_IDS.has(tutorialId.trim());

const isHomeIntroTutorial = (tutorial) => {
  if (!tutorial) return false;
  const tutorialId = typeof tutorial.tutorialId === 'string' ? tutorial.tutorialId.trim() : '';
  if (tutorial.category === 'admin-console-intro') return true;
  return isHomeIntroTutorialId(tutorialId);
};

const APPLICATION_WORKSPACE_ROLE_KEYS = new Set([
  'iset coordinator',
  'iset coordinator',
  'nwac administrator',
  'program admin',
  'nwac administrator',
  'regional manager',
  'regional manager'
]);

const CASE_WORKSPACE_ROLE_KEYS = new Set([
  ...APPLICATION_WORKSPACE_ROLE_KEYS,
  'system administrator'
]);

const NWAC_ASSESSMENT_ROLE_KEYS = new Set([
  'nwac administrator',
  'program admin',
  'nwac administrator',
  'system administrator'
]);

const isTutorialRelevantForRole = (tutorial, role) => {
  if (!tutorial) return false;
  const category = tutorial?.category || '';
  const tutorialId = typeof tutorial?.tutorialId === 'string' ? tutorial.tutorialId.trim() : '';
  const normalizedRole = normalizeRole(role);

  if (category === 'admin-console-intro') {
    const homeIntroTutorialId = getHomeIntroTutorialIdForRole(role);
    return Boolean(homeIntroTutorialId) && tutorialId === homeIntroTutorialId;
  }
  if (category === 'application-workspace') {
    return APPLICATION_WORKSPACE_ROLE_KEYS.has(normalizedRole);
  }
  if (category === 'case-workspace') {
    return CASE_WORKSPACE_ROLE_KEYS.has(normalizedRole);
  }
  if (category === 'nwac-assessment') {
    return NWAC_ASSESSMENT_ROLE_KEYS.has(normalizedRole);
  }
  return true;
};

export {
  APPLICATION_WORKSPACE_TUTORIAL_ID,
  CASE_WORKSPACE_TUTORIAL_ID,
  ISET_COORDINATOR_INTRO_TUTORIAL_ID,
  NWAC_ASSESSMENT_TUTORIAL_ID,
  PROGRAM_ADMIN_INTRO_TUTORIAL_ID,
  REGIONAL_MANAGER_INTRO_TUTORIAL_ID,
  buildTutorials,
  buildTutorialsByCategory,
  getHomeIntroTutorialIdForRole,
  isTutorialRelevantForRole,
  isHomeIntroTutorial,
  isHomeIntroTutorialId
};
