const {
  REVIEW_ACTIONS,
  REVIEW_STAGES,
  REVIEW_WORKFLOW_TYPES,
  buildReviewSubjectKey,
  getInitialReviewStage,
  getReviewTransition,
  isReviewStageLockedForSubmitter,
  isTwoStepReviewEnabled,
} = require('./reviewWorkflow');

describe('reviewWorkflow', () => {
  test('reads the two-step review feature flag with per-workflow overrides', () => {
    expect(isTwoStepReviewEnabled(true, REVIEW_WORKFLOW_TYPES.ApplicationAssessment)).toBe(true);
    expect(isTwoStepReviewEnabled(false, REVIEW_WORKFLOW_TYPES.ApplicationAssessment)).toBe(false);
    expect(isTwoStepReviewEnabled({ enabled: true }, REVIEW_WORKFLOW_TYPES.InterventionProposal)).toBe(true);
    expect(isTwoStepReviewEnabled({ enabled: false }, REVIEW_WORKFLOW_TYPES.InterventionProposal)).toBe(false);
    expect(
      isTwoStepReviewEnabled(
        {
          enabled: true,
          workflows: {
            application_assessment: false,
            intervention_proposal: true,
          },
        },
        REVIEW_WORKFLOW_TYPES.ApplicationAssessment
      )
    ).toBe(false);
    expect(
      isTwoStepReviewEnabled(
        {
          enabled: false,
          workflows: {
            application_assessment: true,
          },
        },
        REVIEW_WORKFLOW_TYPES.ApplicationAssessment
      )
    ).toBe(false);
  });

  test('builds stable subject keys for supported workflow types', () => {
    expect(
      buildReviewSubjectKey({
        workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
        applicationId: 42,
      })
    ).toBe('application_assessment:application:42');
    expect(
      buildReviewSubjectKey({
        workflowType: REVIEW_WORKFLOW_TYPES.InterventionProposal,
        interventionId: 77,
      })
    ).toBe('intervention_proposal:intervention:77');
    expect(
      buildReviewSubjectKey({
        workflowType: REVIEW_WORKFLOW_TYPES.InterventionRevision,
        proposalId: 9,
        interventionId: 77,
      })
    ).toBe('intervention_revision:proposal:9');
    expect(buildReviewSubjectKey({ workflowType: 'unknown', applicationId: 42 })).toBeNull();
  });

  test('starts supported workflows in Regional Manager review', () => {
    expect(getInitialReviewStage({ workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment })).toBe(
      REVIEW_STAGES.RmReview
    );
    expect(getInitialReviewStage({ workflowType: 'unknown' })).toBeNull();
  });

  test('allows submitter to start RM review but not make final decisions', () => {
    const start = getReviewTransition({
      action: REVIEW_ACTIONS.SubmitForRmReview,
      role: 'ISET Coordinator',
    });
    expect(start.allowed).toBe(true);
    expect(start.nextStage).toBe(REVIEW_STAGES.RmReview);

    const finalDecision = getReviewTransition({
      action: REVIEW_ACTIONS.NwacApprove,
      currentStage: REVIEW_STAGES.NwacReview,
      role: 'ISET Coordinator',
    });
    expect(finalDecision.allowed).toBe(false);
  });

  test('allows RM return and upward submission but not final approval', () => {
    const returnToSubmitter = getReviewTransition({
      action: REVIEW_ACTIONS.RmReturnToSubmitter,
      currentStage: REVIEW_STAGES.RmReview,
      role: 'Regional Manager',
    });
    expect(returnToSubmitter.allowed).toBe(true);
    expect(returnToSubmitter.requiresNote).toBe(true);
    expect(returnToSubmitter.nextStage).toBe(REVIEW_STAGES.ReturnedToSubmitter);

    const submitToNwac = getReviewTransition({
      action: REVIEW_ACTIONS.RmSubmitToNwac,
      currentStage: REVIEW_STAGES.RmReview,
      role: 'Regional Manager',
    });
    expect(submitToNwac.allowed).toBe(true);
    expect(submitToNwac.recordsRmSignoff).toBe(true);
    expect(submitToNwac.nextStage).toBe(REVIEW_STAGES.NwacReview);

    const approve = getReviewTransition({
      action: REVIEW_ACTIONS.NwacApprove,
      currentStage: REVIEW_STAGES.NwacReview,
      role: 'Regional Manager',
    });
    expect(approve.allowed).toBe(false);
  });

  test('routes NWAC request changes back to RM before submitter', () => {
    const requestChanges = getReviewTransition({
      action: REVIEW_ACTIONS.NwacRequestChanges,
      currentStage: REVIEW_STAGES.NwacReview,
      role: 'NWAC Administrator',
    });
    expect(requestChanges.allowed).toBe(true);
    expect(requestChanges.requiresNote).toBe(true);
    expect(requestChanges.nextStage).toBe(REVIEW_STAGES.ReturnedToRm);

    const forwardToSubmitter = getReviewTransition({
      action: REVIEW_ACTIONS.RmForwardChangesToSubmitter,
      currentStage: REVIEW_STAGES.ReturnedToRm,
      role: 'Regional Manager',
    });
    expect(forwardToSubmitter.allowed).toBe(true);
    expect(forwardToSubmitter.requiresNote).toBe(true);
    expect(forwardToSubmitter.nextStage).toBe(REVIEW_STAGES.ReturnedToSubmitter);

    const resubmitWithoutSubmitterChanges = getReviewTransition({
      action: REVIEW_ACTIONS.RmSubmitToNwac,
      currentStage: REVIEW_STAGES.ReturnedToRm,
      role: 'Regional Manager',
    });
    expect(resubmitWithoutSubmitterChanges.allowed).toBe(false);
  });

  test('locks submitter edits while the packet is under RM or NWAC review', () => {
    expect(isReviewStageLockedForSubmitter(REVIEW_STAGES.RmReview)).toBe(true);
    expect(isReviewStageLockedForSubmitter(REVIEW_STAGES.NwacReview)).toBe(true);
    expect(isReviewStageLockedForSubmitter(REVIEW_STAGES.ReturnedToRm)).toBe(true);
    expect(isReviewStageLockedForSubmitter(REVIEW_STAGES.ReturnedToSubmitter)).toBe(false);
  });
});
