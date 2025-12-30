import React from 'react';

const NWAC_ASSESSMENT_TUTORIAL_ID = 'nwac-assessment-decision';

const buildNwacAssessmentTutorials = ({ completedMap = {} } = {}) => {
  const completed = Boolean(completedMap[NWAC_ASSESSMENT_TUTORIAL_ID]);

  return [
    {
      tutorialId: NWAC_ASSESSMENT_TUTORIAL_ID,
      category: 'nwac-assessment',
      title: 'NWAC assessment decision',
      description: (
        <div>
          <p>Record the NWAC decision, confirm assurance, and communicate the outcome.</p>
          <p>Guidance highlights consistency checks and approval requirements from Module 9.</p>
        </div>
      ),
      tasks: [
        {
          title: 'Record the NWAC decision',
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
            }
          ]
        },
        {
          title: 'Finalize funding and communication',
          steps: [
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
      ],
      completedScreenDescription: (
        <div>
          <p>NWAC decision recorded. You can return here to review communication steps or restart the tutorial.</p>
        </div>
      ),
      completed
    }
  ];
};

export { NWAC_ASSESSMENT_TUTORIAL_ID, buildNwacAssessmentTutorials };
