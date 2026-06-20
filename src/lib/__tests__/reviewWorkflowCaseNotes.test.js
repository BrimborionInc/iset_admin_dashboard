const { REVIEW_ACTIONS, REVIEW_WORKFLOW_TYPES } = require('../reviewWorkflow');
const {
  buildReviewWorkflowCaseNoteBody,
} = require('../reviewWorkflowCaseNotes');

describe('reviewWorkflowCaseNotes', () => {
  test('records Regional Manager submit notes with actor and context', () => {
    expect(buildReviewWorkflowCaseNoteBody({
      workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
      action: REVIEW_ACTIONS.RmSubmitToNwac,
      actorName: 'Bill Sillery',
      note: 'Looks ready for the Decision Maker.',
    })).toBe(
      'Regional Manager review: Bill Sillery submitted the application assessment for final decision with this note: Looks ready for the Decision Maker.'
    );
  });

  test('records Decision Maker change-request notes with actor and subject', () => {
    expect(buildReviewWorkflowCaseNoteBody({
      workflowType: REVIEW_WORKFLOW_TYPES.InterventionRevision,
      action: REVIEW_ACTIONS.NwacRequestChanges,
      actorName: 'Bill Sillery',
      note: 'Please clarify the revised end date.',
    })).toBe(
      'Decision Maker review: Bill Sillery requested changes on the intervention amendment with this note: Please clarify the revised end date.'
    );
  });

  test('returns null when no review note was entered', () => {
    expect(buildReviewWorkflowCaseNoteBody({
      workflowType: REVIEW_WORKFLOW_TYPES.InterventionProposal,
      action: REVIEW_ACTIONS.NwacApprove,
      actorName: 'Bill Sillery',
      note: '   ',
    })).toBeNull();
  });
});
