import {
  canEditInterventionAssessmentBody,
  canRecallInterventionAssessmentSubmission,
} from '../interventionAssessmentEditAccess';

describe('canEditInterventionAssessmentBody', () => {
  test.each([
    ['ISET Coordinator'],
    ['Regional Manager'],
  ])('allows %s to begin a new proposal when no other proposal is open', role => {
    expect(canEditInterventionAssessmentBody({
      role,
      currentStaffProfileId: 54,
    })).toBe(true);
  });

  test.each([
    ['NWAC Administrator'],
    [''],
  ])('does not give %s proposal-body controls', role => {
    expect(canEditInterventionAssessmentBody({
      role,
      currentStaffProfileId: 54,
    })).toBe(false);
  });

  test('allows only the creator to edit an existing draft', () => {
    const options = {
      role: 'ISET Coordinator',
      reviewStatus: 'draft',
      createdByStaffProfileId: 54,
      hasExistingIntervention: true,
    };

    expect(canEditInterventionAssessmentBody({
      ...options,
      currentStaffProfileId: '54',
    })).toBe(true);
    expect(canEditInterventionAssessmentBody({
      ...options,
      currentStaffProfileId: 88,
    })).toBe(false);
  });

  test('allows only the recorded original submitter to edit returned work', () => {
    const options = {
      role: 'Regional Manager',
      reviewStatus: 'changes_requested',
      reviewWorkflow: {
        currentStage: 'returned_to_submitter',
        submittedByStaffProfileId: 54,
      },
      createdByStaffProfileId: 88,
      hasExistingIntervention: true,
    };

    expect(canEditInterventionAssessmentBody({
      ...options,
      currentStaffProfileId: 54,
    })).toBe(true);
    expect(canEditInterventionAssessmentBody({
      ...options,
      currentStaffProfileId: 88,
    })).toBe(false);
  });

  test('fails closed when workflow stage or submitter lineage is incomplete', () => {
    expect(canEditInterventionAssessmentBody({
      role: 'ISET Coordinator',
      reviewStatus: 'changes_requested',
      reviewWorkflow: {
        currentStage: 'returned_to_rm',
        submittedByStaffProfileId: 54,
      },
      currentStaffProfileId: 54,
      hasExistingIntervention: true,
    })).toBe(false);

    expect(canEditInterventionAssessmentBody({
      role: 'ISET Coordinator',
      reviewStatus: 'changes_requested',
      reviewWorkflow: { currentStage: 'returned_to_submitter' },
      currentStaffProfileId: 54,
      hasExistingIntervention: true,
    })).toBe(false);
  });

  test('fails closed for a changes-requested record without authoritative workflow lineage', () => {
    expect(canEditInterventionAssessmentBody({
      role: 'ISET Coordinator',
      reviewStatus: 'changes_requested',
      createdByStaffProfileId: 54,
      currentStaffProfileId: 54,
      hasExistingIntervention: true,
    })).toBe(false);
  });

  test('preserves the explicit System Administrator support override', () => {
    expect(canEditInterventionAssessmentBody({
      role: 'System Administrator',
      reviewStatus: 'changes_requested',
      reviewWorkflow: {
        currentStage: 'returned_to_submitter',
        submittedByStaffProfileId: 54,
      },
      currentStaffProfileId: 999,
      hasExistingIntervention: true,
    })).toBe(true);

    expect(canEditInterventionAssessmentBody({
      role: 'System Administrator',
      reviewStatus: 'changes_requested',
      currentStaffProfileId: 999,
      hasExistingIntervention: true,
    })).toBe(false);
  });

  test.each([
    ['submitted'],
    ['in_review'],
    ['approved'],
    ['rejected'],
  ])('keeps the proposal body read-only during %s', reviewStatus => {
    expect(canEditInterventionAssessmentBody({
      role: 'Regional Manager',
      reviewStatus,
      currentStaffProfileId: 54,
      createdByStaffProfileId: 54,
      hasExistingIntervention: true,
    })).toBe(false);
  });

  test('does not start another blank proposal while one is already open', () => {
    expect(canEditInterventionAssessmentBody({
      role: 'ISET Coordinator',
      currentStaffProfileId: 54,
      hasBlockingProposal: true,
    })).toBe(false);
  });
});

describe('canRecallInterventionAssessmentSubmission', () => {
  const returnedWorkflow = {
    currentStage: 'rm_review',
    submittedByStaffProfileId: 54,
  };

  it('allows the exact recorded Coordinator or Regional Manager submitter before RM sign-off', () => {
    ['ISET Coordinator', 'Regional Manager'].forEach(role => {
      expect(canRecallInterventionAssessmentSubmission({
        role,
        reviewWorkflow: returnedWorkflow,
        currentStaffProfileId: 54,
      })).toBe(true);
    });
  });

  it('denies another submitter-role user and the Decision Maker', () => {
    expect(canRecallInterventionAssessmentSubmission({
      role: 'ISET Coordinator',
      reviewWorkflow: returnedWorkflow,
      currentStaffProfileId: 55,
    })).toBe(false);
    expect(canRecallInterventionAssessmentSubmission({
      role: 'NWAC Administrator',
      reviewWorkflow: returnedWorkflow,
      currentStaffProfileId: 54,
    })).toBe(false);
  });

  it('locks recall after RM sign-off and permits the explicit System Administrator support path', () => {
    expect(canRecallInterventionAssessmentSubmission({
      role: 'Regional Manager',
      reviewWorkflow: { ...returnedWorkflow, currentStage: 'nwac_review' },
      currentStaffProfileId: 54,
    })).toBe(false);
    expect(canRecallInterventionAssessmentSubmission({
      role: 'System Administrator',
      reviewWorkflow: returnedWorkflow,
      currentStaffProfileId: 99,
    })).toBe(true);
  });

  it('uses exact draft creator lineage for a legacy submission without a workflow row', () => {
    expect(canRecallInterventionAssessmentSubmission({
      role: 'Regional Manager',
      createdByStaffProfileId: 54,
      currentStaffProfileId: 54,
    })).toBe(true);
    expect(canRecallInterventionAssessmentSubmission({
      role: 'Regional Manager',
      createdByStaffProfileId: 54,
      currentStaffProfileId: 55,
    })).toBe(false);
  });
});
