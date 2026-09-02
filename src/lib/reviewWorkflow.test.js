const {
  REVIEW_ACTIONS,
  REVIEW_STAGES,
  REVIEW_WORKFLOW_TYPES,
  buildReviewSubjectKey,
  getInitialReviewStage,
  getReviewTransition,
  isReviewStageLockedForSubmitter,
  isTwoStepReviewEnabled,
  requiresSubmitterCorrectionReturn,
} = require('./reviewWorkflow');

describe('reviewWorkflow', () => {
  const supportedWorkflowTypes = Object.values(REVIEW_WORKFLOW_TYPES);
  const businessRoles = [
    'ISET Coordinator',
    'Regional Manager',
    'NWAC Administrator',
    '',
  ];
  const technicalSupportRoles = ['System Administrator'];
  const reviewRoles = [...businessRoles, ...technicalSupportRoles];
  const submitStartRoles = new Set(['ISET Coordinator', 'Regional Manager']);
  const businessFinalDecisionRoles = new Set(['NWAC Administrator']);
  const technicalFinalDecisionRoles = new Set(['System Administrator']);

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

  test('enforces submit-start roles across every supported workflow type', () => {
    supportedWorkflowTypes.forEach(workflowType => {
      reviewRoles.forEach(role => {
        const start = getReviewTransition({
          action: REVIEW_ACTIONS.SubmitForRmReview,
          workflowType,
          role,
        });
        expect(start.allowed).toBe(submitStartRoles.has(role));
        expect(start.nextStage).toBe(REVIEW_STAGES.RmReview);
        expect(start.nextOwnerRole).toBe('Regional Manager');
      });
    });
  });

  test('starts or restarts submission only from an initial, returned, or recalled stage', () => {
    const allowedStages = [undefined, null, '', REVIEW_STAGES.ReturnedToSubmitter, REVIEW_STAGES.Withdrawn];
    const lockedStages = [
      REVIEW_STAGES.RmReview,
      REVIEW_STAGES.ReturnedToRm,
      REVIEW_STAGES.NwacReview,
      REVIEW_STAGES.FinalDecisionRecorded,
    ];

    supportedWorkflowTypes.forEach(workflowType => {
      allowedStages.forEach(currentStage => {
        expect(getReviewTransition({
          action: REVIEW_ACTIONS.SubmitForRmReview,
          currentStage,
          workflowType,
          role: 'ISET Coordinator',
        }).allowed).toBe(true);
      });
      lockedStages.forEach(currentStage => {
        expect(getReviewTransition({
          action: REVIEW_ACTIONS.SubmitForRmReview,
          currentStage,
          workflowType,
          role: 'Regional Manager',
        }).allowed).toBe(false);
      });
    });
  });

  test('blocks every role from starting an unknown workflow type', () => {
    [undefined, null, '', 'unknown'].forEach(workflowType => {
      reviewRoles.forEach(role => {
        const start = getReviewTransition({
          action: REVIEW_ACTIONS.SubmitForRmReview,
          workflowType,
          role,
        });
        expect(start.allowed).toBe(false);
      });
    });
  });

  test('enforces the business review-action role and stage matrix', () => {
    const mismatches = [];
    const stages = [
      undefined,
      REVIEW_STAGES.RmReview,
      REVIEW_STAGES.NwacReview,
      REVIEW_STAGES.ReturnedToRm,
      REVIEW_STAGES.ReturnedToSubmitter,
      REVIEW_STAGES.FinalDecisionRecorded,
      REVIEW_STAGES.Withdrawn,
    ];
    const cases = [
      {
        action: REVIEW_ACTIONS.RmReturnToSubmitter,
        isAllowed: ({ stage, role }) => stage === REVIEW_STAGES.RmReview && role === 'Regional Manager',
        nextStage: REVIEW_STAGES.ReturnedToSubmitter,
        requiresNote: true,
      },
      {
        action: REVIEW_ACTIONS.RmSubmitToNwac,
        isAllowed: ({ stage, role }) => stage === REVIEW_STAGES.RmReview && role === 'Regional Manager',
        nextStage: REVIEW_STAGES.NwacReview,
        recordsRmSignoff: true,
      },
      {
        action: REVIEW_ACTIONS.NwacRequestChanges,
        isAllowed: ({ stage, role }) => stage === REVIEW_STAGES.NwacReview && businessFinalDecisionRoles.has(role),
        nextStage: REVIEW_STAGES.ReturnedToRm,
        requiresNote: true,
      },
      {
        action: REVIEW_ACTIONS.RmForwardChangesToSubmitter,
        isAllowed: ({ stage, role }) => stage === REVIEW_STAGES.ReturnedToRm && role === 'Regional Manager',
        nextStage: REVIEW_STAGES.ReturnedToSubmitter,
        requiresNote: true,
      },
      {
        action: REVIEW_ACTIONS.NwacApprove,
        isAllowed: ({ stage, role }) => stage === REVIEW_STAGES.NwacReview && businessFinalDecisionRoles.has(role),
        nextStage: REVIEW_STAGES.FinalDecisionRecorded,
        recordsFinalDecision: true,
      },
      {
        action: REVIEW_ACTIONS.NwacDeny,
        isAllowed: ({ stage, role }) => stage === REVIEW_STAGES.NwacReview && businessFinalDecisionRoles.has(role),
        nextStage: REVIEW_STAGES.FinalDecisionRecorded,
        requiresNote: true,
        recordsFinalDecision: true,
      },
    ];

    supportedWorkflowTypes.forEach(workflowType => {
      cases.forEach(testCase => {
        stages.forEach(stage => {
          businessRoles.forEach(role => {
            const transition = getReviewTransition({
              action: testCase.action,
              currentStage: stage,
              workflowType,
              role,
            });
            const expectedAllowed = testCase.isAllowed({ stage, role });
            if (transition.allowed !== expectedAllowed) {
              mismatches.push({
                workflowType,
                action: testCase.action,
                stage,
                role,
                expectedAllowed,
                actualAllowed: transition.allowed,
              });
            }
            if (expectedAllowed) {
              [
                ['nextStage', transition.nextStage, testCase.nextStage],
                ['requiresNote', Boolean(transition.requiresNote), Boolean(testCase.requiresNote)],
                ['recordsRmSignoff', Boolean(transition.recordsRmSignoff), Boolean(testCase.recordsRmSignoff)],
                ['recordsFinalDecision', Boolean(transition.recordsFinalDecision), Boolean(testCase.recordsFinalDecision)],
              ].forEach(([field, actual, expected]) => {
                if (actual !== expected) {
                  mismatches.push({
                    workflowType,
                    action: testCase.action,
                    stage,
                    role,
                    field,
                    expected,
                    actual,
                  });
                }
              });
            }
          });
        });
      });
    });
    expect(mismatches).toEqual([]);
  });

  test('keeps System Administrator outside the business submit and RM review path', () => {
    supportedWorkflowTypes.forEach(workflowType => {
      technicalSupportRoles.forEach(role => {
        expect(
          getReviewTransition({
            action: REVIEW_ACTIONS.SubmitForRmReview,
            workflowType,
            role,
          }).allowed
        ).toBe(false);
        expect(
          getReviewTransition({
            action: REVIEW_ACTIONS.RmReturnToSubmitter,
            currentStage: REVIEW_STAGES.RmReview,
            workflowType,
            role,
          }).allowed
        ).toBe(false);
        expect(
          getReviewTransition({
            action: REVIEW_ACTIONS.RmSubmitToNwac,
            currentStage: REVIEW_STAGES.RmReview,
            workflowType,
            role,
          }).allowed
        ).toBe(false);
      });
    });
  });

  test('preserves System Administrator final-decision behavior as technical support only', () => {
    supportedWorkflowTypes.forEach(workflowType => {
      technicalFinalDecisionRoles.forEach(role => {
        expect(
          getReviewTransition({
            action: REVIEW_ACTIONS.NwacApprove,
            currentStage: REVIEW_STAGES.NwacReview,
            workflowType,
            role,
          }).allowed
        ).toBe(true);
        expect(
          getReviewTransition({
            action: REVIEW_ACTIONS.NwacRequestChanges,
            currentStage: REVIEW_STAGES.NwacReview,
            workflowType,
            role,
          }).allowed
        ).toBe(true);
        const denial = getReviewTransition({
          action: REVIEW_ACTIONS.NwacDeny,
          currentStage: REVIEW_STAGES.NwacReview,
          workflowType,
          role,
        });
        expect(denial.allowed).toBe(true);
        expect(denial.requiresNote).toBe(true);
      });
    });
  });

  test('limits recall/withdraw to submitter roles and System Administrator support', () => {
    const permittedRoles = new Set([
      'ISET Coordinator',
      'Regional Manager',
      'System Administrator',
    ]);
    supportedWorkflowTypes.forEach(workflowType => {
      reviewRoles.forEach(role => {
        const transition = getReviewTransition({
          action: REVIEW_ACTIONS.Withdraw,
          currentStage: REVIEW_STAGES.RmReview,
          workflowType,
          role,
        });
        expect(transition.allowed).toBe(permittedRoles.has(role));
      });
    });

    expect(getReviewTransition({
      action: REVIEW_ACTIONS.Withdraw,
      currentStage: REVIEW_STAGES.FinalDecisionRecorded,
      workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
      role: 'ISET Coordinator',
    }).allowed).toBe(false);
  });

  test('terminal application withdrawal closes every pre-final assessment review for all file-access roles', () => {
    const permittedRoles = [
      'ISET Coordinator',
      'Regional Manager',
      'NWAC Administrator',
      'System Administrator',
    ];
    const permittedStages = [
      REVIEW_STAGES.RmReview,
      REVIEW_STAGES.ReturnedToSubmitter,
      REVIEW_STAGES.ReturnedToRm,
      REVIEW_STAGES.NwacReview,
      REVIEW_STAGES.Withdrawn,
    ];

    expect(REVIEW_ACTIONS.WithdrawApplication).not.toBe(REVIEW_ACTIONS.Withdraw);
    permittedRoles.forEach(role => {
      permittedStages.forEach(currentStage => {
        expect(getReviewTransition({
          action: REVIEW_ACTIONS.WithdrawApplication,
          currentStage,
          workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
          role,
        })).toMatchObject({
          allowed: true,
          nextStage: REVIEW_STAGES.Withdrawn,
          nextOwnerRole: null,
          requiresNote: true,
        });
      });
    });

    for (const currentStage of [undefined, '', REVIEW_STAGES.FinalDecisionRecorded]) {
      expect(getReviewTransition({
        action: REVIEW_ACTIONS.WithdrawApplication,
        currentStage,
        workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
        role: 'ISET Coordinator',
      })).toMatchObject({
        allowed: false,
        blockReason: 'application_withdrawal_review_stage_forbidden',
      });
    }

    for (const workflowType of [
      REVIEW_WORKFLOW_TYPES.InterventionProposal,
      REVIEW_WORKFLOW_TYPES.InterventionRevision,
      'unknown',
    ]) {
      expect(getReviewTransition({
        action: REVIEW_ACTIONS.WithdrawApplication,
        currentStage: REVIEW_STAGES.RmReview,
        workflowType,
        role: 'ISET Coordinator',
      })).toMatchObject({
        allowed: false,
        blockReason: 'application_withdrawal_review_stage_forbidden',
      });
    }

    expect(getReviewTransition({
      action: REVIEW_ACTIONS.WithdrawApplication,
      currentStage: REVIEW_STAGES.ReturnedToSubmitter,
      workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
      role: 'unknown',
    })).toMatchObject({
      allowed: false,
      blockReason: 'review_workflow_transition_forbidden',
    });
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

  test('forces a post-decision application correction back to the submitter before another final decision', () => {
    const metadata = { requiresSubmitterCorrectionReturn: true };
    expect(
      requiresSubmitterCorrectionReturn(REVIEW_WORKFLOW_TYPES.ApplicationAssessment, metadata)
    ).toBe(true);
    expect(
      requiresSubmitterCorrectionReturn(
        REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
        JSON.stringify({ requires_submitter_correction_return: true })
      )
    ).toBe(true);

    const blockedSubmit = getReviewTransition({
      action: REVIEW_ACTIONS.RmSubmitToNwac,
      currentStage: REVIEW_STAGES.RmReview,
      role: 'Regional Manager',
      workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
      workflowMetadata: metadata,
    });
    expect(blockedSubmit.allowed).toBe(false);
    expect(blockedSubmit.blockReason).toBe('review_workflow_return_required');

    const wrongRole = getReviewTransition({
      action: REVIEW_ACTIONS.RmSubmitToNwac,
      currentStage: REVIEW_STAGES.RmReview,
      role: 'ISET Coordinator',
      workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
      workflowMetadata: metadata,
    });
    expect(wrongRole.allowed).toBe(false);
    expect(wrongRole.blockReason).toBeNull();

    const requiredReturn = getReviewTransition({
      action: REVIEW_ACTIONS.RmReturnToSubmitter,
      currentStage: REVIEW_STAGES.RmReview,
      role: 'Regional Manager',
      workflowType: REVIEW_WORKFLOW_TYPES.ApplicationAssessment,
      workflowMetadata: metadata,
    });
    expect(requiredReturn.allowed).toBe(true);
    expect(requiredReturn.nextStage).toBe(REVIEW_STAGES.ReturnedToSubmitter);
    expect(requiredReturn.requiresNote).toBe(true);

    const unrelatedInterventionSubmit = getReviewTransition({
      action: REVIEW_ACTIONS.RmSubmitToNwac,
      currentStage: REVIEW_STAGES.RmReview,
      role: 'Regional Manager',
      workflowType: REVIEW_WORKFLOW_TYPES.InterventionProposal,
      workflowMetadata: metadata,
    });
    expect(unrelatedInterventionSubmit.allowed).toBe(true);
  });

  test('locks submitter edits while the packet is under RM or NWAC review', () => {
    expect(isReviewStageLockedForSubmitter(REVIEW_STAGES.RmReview)).toBe(true);
    expect(isReviewStageLockedForSubmitter(REVIEW_STAGES.NwacReview)).toBe(true);
    expect(isReviewStageLockedForSubmitter(REVIEW_STAGES.ReturnedToRm)).toBe(true);
    expect(isReviewStageLockedForSubmitter(REVIEW_STAGES.ReturnedToSubmitter)).toBe(false);
  });
});
