import React from 'react';

const ISET_COORDINATOR_INTRO_TUTORIAL_ID = 'iset-coordinator-intro-v2';
const REGIONAL_MANAGER_INTRO_TUTORIAL_ID = 'regional-manager-intro-v1';
const PROGRAM_ADMIN_INTRO_TUTORIAL_ID = 'program-admin-intro-v1';
const APPLICATION_WORKSPACE_TUTORIAL_ID = 'application-workspace-overview-v3';
const CASE_WORKSPACE_TUTORIAL_ID = 'case-workspace-overview-v3';
const NWAC_ASSESSMENT_TUTORIAL_ID = 'nwac-assessment-decision';

const TUTORIAL_DEFINITIONS = [
  {
    tutorialId: ISET_COORDINATOR_INTRO_TUTORIAL_ID,
    category: 'admin-console-intro',
    title: 'PATH coordinator quick start',
    descriptionLines: [
      'Start here if PATH is new to you. This tour shows how to decide what needs attention first, open the right file, and find help when you are unsure.',
      'It begins on your home page because that is where most coordinators should start the day.'
    ],
    completedLines: [
      'Quick start complete. You know where to start your day in PATH and where to get help when you need it.',
      'You can replay this tour later from the help panel or the Tutorials page under Support.'
    ],
    tasks: [
      {
        title: 'Home page quick start',
        steps: [
          {
            title: 'Start your day here',
            content: 'When you sign in, PATH brings you to the home page. Treat this as your daily starting point: use it to decide what needs attention first, then open the right file and do the real work there.',
            hotspotId: 'home-overview'
          },
          {
            title: 'Work Queue',
            content: 'Start with the coordinator Work Queue. This is where PATH groups the things that need action first, such as new applications, missing-document follow-up, approvals, active-client check-ins, and overdue work.',
            hotspotId: 'home-coordinator-work-queue'
          },
          {
            title: 'Queue Items',
            content: 'Once you choose a queue, use Queue Items to open the actual application or case record. The home page helps you choose the next file; the detailed work happens in the Application Workspace or Case Workspace.',
            hotspotId: 'home-work-queue-items'
          },
          {
            title: 'My Tagged Applications',
            content: 'Use tags as your personal watchlist for files you know you need to come back to. This is helpful for follow-up work, but your queue remains the main source of what is due next.',
            hotspotId: 'home-my-tagged-applications'
          },
          {
            title: 'Layout controls',
            content: 'If the page feels cluttered, use Add widget and Reset layout to bring it back to something manageable. This is optional support for your workflow, not the main point of the page.',
            hotspotId: 'home-layout-controls'
          },
          {
            title: 'Info links and Ask the AI',
            content: 'When PATH feels unfamiliar, use the page or widget Info links to open focused guidance in the help panel. From there, Ask the AI stays on the current topic and can help you with what to do next on that page.',
            hotspotId: 'home-info-link'
          },
          {
            title: 'Side navigation',
            content: 'Use the left navigation to move to the main places you will work in PATH, such as Manual Application Intake, Application Assessment, Guidance, and Help and Support.',
            hotspotId: 'intro-side-navigation'
          },
          {
            title: 'Tutorials',
            content: 'If you need the walkthroughs to prompt again for you or for training, use the Tutorials page under Support to reset progress and replay them.',
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
            hotspotId: 'home-info-link'
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
            content: 'Use queues to work new applications, pending decisions, escalations, and overdue actions.',
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
            hotspotId: 'home-info-link'
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
    title: 'Application workspace quick start',
    descriptionLines: [
      'Use this workspace to review the application, chase missing information, complete the assessment, and keep the file record together.',
      'This tour follows the normal coordinator workflow from orientation through assessment and audit trail.'
    ],
    completedLines: [
      'Quick start complete. You know where to review the file, request information, complete the assessment, and record your work in PATH.',
      'Return here anytime to replay the tour or help onboard new staff.'
    ],
    tasks: [
      {
        title: 'Application file walkthrough',
        steps: [
          {
            title: 'Application Overview',
            content: 'Start here to orient yourself. Confirm which file you are in, check status and assignment, review checklist progress, and see whether the application is waiting on documents, review, approval, or follow-through.',
            hotspotId: 'app-workspace-application-overview'
          },
          {
            title: 'Quick actions',
            content: 'Use Quick actions to switch into the layout that matches the job in front of you, such as review, documents and messages, notes and calendar, or audit trail.',
            hotspotId: 'app-workspace-quick-actions'
          },
          {
            title: 'ISET Application Form',
            content: 'Review the original intake submission, signatures, and client background here. If a factual correction is needed, edit carefully, save a new version, and make sure the change is reflected in your notes or follow-up where appropriate.',
            hotspotId: 'app-workspace-application-form'
          },
          {
            title: 'Supporting Documents',
            content: 'Use this widget to confirm the evidence is complete. This is where you check what is still missing, validate living-allowance or program evidence, and keep the document checklist moving toward complete.',
            hotspotId: 'app-workspace-supporting-documents'
          },
          {
            title: 'Secure Messaging',
            content: 'Use Secure Messaging to request missing information, acknowledge receipt, and communicate updates to the applicant without leaving the file. Attachments from messages are available in Supporting Documents.',
            hotspotId: 'app-workspace-secure-messaging'
          },
          {
            title: 'Notes and tasks',
            content: 'Use Notes and Tasks for the staff-side record: contact attempts, rationale, internal follow-up, and anything another staff member would need to understand the file later.',
            hotspotId: 'app-workspace-notes-tasks'
          },
          {
            title: 'Application Assessment',
            content: 'Complete the assessment only once the file supports your recommendation. If living allowance is still being considered, make sure the Financial Overview and verification are in the file before you submit to NWAC.',
            hotspotId: 'app-workspace-assessment'
          },
          {
            title: 'Case calendar',
            content: 'Use the calendar to stay on top of reminders, deadlines, and follow-up dates so no document request or next step gets lost.',
            hotspotId: 'app-workspace-case-calendar'
          },
          {
            title: 'Events timeline',
            content: 'Use the Events Timeline as the running audit trail for the application. It helps you confirm what changed, when it changed, and who moved the file forward.',
            hotspotId: 'app-workspace-events-timeline'
          }
        ]
      }
    ]
  },
  {
    tutorialId: CASE_WORKSPACE_TUTORIAL_ID,
    category: 'case-workspace',
    title: 'Case workspace quick start',
    descriptionLines: [
      'Use this workspace to manage the client after application approval: keep participant details current, run plans and interventions, record follow-up, and close the case properly.',
      'This tour follows the casework flow rather than just the board layout.'
    ],
    completedLines: [
      'Quick start complete. You know where to manage active casework, record follow-up, and prepare a case for proper closure in PATH.',
      'Return here anytime from the help panel to replay this walkthrough.'
    ],
    tasks: [
      {
        title: 'Casework walkthrough',
        steps: [
          {
            title: 'Case header',
            content: 'Start here to confirm you are in the right case, see who owns it, check agreement context, and orient yourself before making changes.',
            hotspotId: 'case-workspace-header'
          },
          {
            title: 'Quick actions and layouts',
            content: 'Use Quick actions when you want a focused working view, such as plans, notes and calendar, or documents and messages. This helps you stay on the task in front of you.',
            hotspotId: 'case-workspace-quick-actions'
          },
          {
            title: 'Participant details',
            content: 'Keep participant details current as circumstances change. This is the active case record for contact details and key participant information, and it should stay aligned with verified updates.',
            hotspotId: 'case-workspace-participant-details'
          },
          {
            title: 'Action plans',
            content: 'Action plans are the client’s working pathway. Use them to organize the goal, timing, and direction of support, and keep only the current plan active.',
            hotspotId: 'case-workspace-action-plans'
          },
          {
            title: 'Interventions',
            content: 'Interventions are the actual supports being delivered. Keep dates, status, and outcomes current so the case record reflects what the client is really doing.',
            hotspotId: 'case-workspace-interventions'
          },
          {
            title: 'Supporting documents',
            content: 'Use Supporting Documents for the file evidence that belongs with the case, such as proof, supporting records, or later documents that matter to the case history.',
            hotspotId: 'app-workspace-supporting-documents'
          },
          {
            title: 'Secure messaging',
            content: 'Use Secure Messaging for participant communication that should stay attached to the file, such as requests, updates, and documented follow-up.',
            hotspotId: 'app-workspace-secure-messaging'
          },
          {
            title: 'Notes and calendar',
            content: 'Use Notes and Tasks for internal context and follow-up records, and use the Case Calendar to make sure milestones, reminders, and next steps are not missed.',
            hotspotId: 'app-workspace-case-calendar'
          },
          {
            title: 'Before closure',
            content: 'Do not close a case just because training or an intervention has ended. First capture outcomes, document the required follow-up, including the 12-week follow-up where it applies, and make sure the file shows why it is ready to close.',
            hotspotId: 'app-workspace-notes-tasks'
          }
        ]
      }
    ]
  },
  {
    tutorialId: NWAC_ASSESSMENT_TUTORIAL_ID,
    category: 'nwac-assessment',
    title: 'NWAC decision quick start',
    descriptionLines: [
      'Use this tutorial when reviewing a coordinator recommendation and recording the NWAC decision.',
      'It focuses on consistency, approval requirements, and communicating the outcome clearly.'
    ],
    completedLines: [
      'Quick start complete. You know where to record the NWAC decision, check the file quality, and move the outcome into communication.'
    ],
    tasks: [
      {
        title: 'NWAC decision walkthrough',
        steps: [
          {
            title: 'Funding decision',
            content: 'Choose Approved, Denied, or Push back. Use Push back when the coordinator needs to correct the file before a final decision. Use Commit to record the decision; letter preparation opens as a separate follow-up after the decision is saved.',
            hotspotId: 'nwac-decision-status'
          },
          {
            title: 'Assessment assurance',
            content: 'Record whether the coordinator recommendation is sound. Before approving, make sure the assessment tells the story of the file clearly and that amounts, dates, prior ISET history, and program details are consistent with the evidence.',
            hotspotId: 'nwac-assessment-assurance'
          },
          {
            title: 'Decision reason',
            content: 'If you are not approving or you are pushing the file back, record a clear reason tied to the evidence. This reason should stay consistent with what is later communicated to the client.',
            hotspotId: 'nwac-decision-reason'
          },
          {
            title: 'Budget pot and paid from',
            content: 'For approvals with funded costs, assign the budget pot and paid-from context carefully. Amounts must match the approved recommendation; if they change, the file should be corrected before moving on.',
            hotspotId: 'nwac-budget-pot'
          },
          {
            title: 'Decision letter',
            content: 'Use the decision letter step to communicate the outcome clearly. The letter should match the recorded decision and reason, and the case record should show that the client was informed.',
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

  if (normalized === 'iset coordinator') {
    return ISET_COORDINATOR_INTRO_TUTORIAL_ID;
  }

  if (normalized === 'regional manager') {
    return REGIONAL_MANAGER_INTRO_TUTORIAL_ID;
  }

  if (normalized === 'nwac administrator') {
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
  'nwac administrator',
  'regional manager'
]);

const CASE_WORKSPACE_ROLE_KEYS = new Set([
  ...APPLICATION_WORKSPACE_ROLE_KEYS,
  'system administrator'
]);

const NWAC_ASSESSMENT_ROLE_KEYS = new Set([
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
