import {
  canEditApplicationAssessmentBody,
  canPreserveReturnedAssessmentEligibility,
  canRegionalManagerEditApplicationAssessment,
  isReturnedAssessmentEligibilityChangeUnverified,
} from '../assessmentEditAccess';

describe('canPreserveReturnedAssessmentEligibility', () => {
  test('preserves the accepted EI status for a returned correction when it is unchanged', () => {
    expect(canPreserveReturnedAssessmentEligibility({
      reviewWorkflow: { current_stage: 'returned_to_submitter' },
      currentEligibility: 'CRF',
      initialEligibility: 'crf',
    })).toBe(true);
  });

  test.each([
    [{ current_stage: 'rm_review' }, 'CRF', 'CRF'],
    [{ current_stage: 'returned_to_submitter' }, 'EI Active Claim', 'CRF'],
    [{ current_stage: 'returned_to_submitter' }, '', ''],
  ])('does not preserve eligibility outside an unchanged returned correction', (
    reviewWorkflow,
    currentEligibility,
    initialEligibility
  ) => {
    expect(canPreserveReturnedAssessmentEligibility({
      reviewWorkflow,
      currentEligibility,
      initialEligibility,
    })).toBe(false);
  });
});

describe('isReturnedAssessmentEligibilityChangeUnverified', () => {
  test('blocks an EI status change on a returned legacy assessment until evidence exists', () => {
    expect(isReturnedAssessmentEligibilityChangeUnverified({
      reviewWorkflow: { current_stage: 'returned_to_submitter' },
      currentEligibility: 'EI Active Claim',
      initialEligibility: 'CRF',
    })).toBe(true);
  });

  test.each([
    { reviewWorkflow: { current_stage: 'rm_review' }, currentEligibility: 'EI Active Claim', initialEligibility: 'CRF' },
    { reviewWorkflow: { current_stage: 'returned_to_submitter' }, currentEligibility: 'CRF', initialEligibility: 'CRF' },
    { reviewWorkflow: { current_stage: 'returned_to_submitter' }, currentEligibility: 'EI Active Claim', initialEligibility: 'CRF', hasVerificationDocument: true },
    { reviewWorkflow: { current_stage: 'returned_to_submitter' }, currentEligibility: 'EI Active Claim', initialEligibility: 'CRF', hasSelectedVerificationFile: true },
  ])('allows unchanged, evidenced, selected-file, and non-returned eligibility states', options => {
    expect(isReturnedAssessmentEligibilityChangeUnverified(options)).toBe(false);
  });
});

describe('canRegionalManagerEditApplicationAssessment', () => {
  test('preserves Regional Manager editing for an unsubmitted in-review draft', () => {
    expect(canRegionalManagerEditApplicationAssessment({
      isRegionalManager: true,
      applicationStatus: 'in_review',
      reviewWorkflow: null,
      currentStaffProfileId: 55,
    })).toBe(true);
  });

  test('allows a returned assessment when the Regional Manager is its submitter', () => {
    expect(canRegionalManagerEditApplicationAssessment({
      isRegionalManager: true,
      applicationStatus: 'in_review',
      reviewWorkflow: {
        current_stage: 'returned_to_submitter',
        submitted_by_staff_profile_id: 55,
      },
      currentStaffProfileId: '55',
    })).toBe(true);
  });

  test('does not allow a different Regional Manager to edit the returned assessment', () => {
    expect(canRegionalManagerEditApplicationAssessment({
      isRegionalManager: true,
      applicationStatus: 'in_review',
      reviewWorkflow: {
        currentStage: 'returned_to_submitter',
        submittedByStaffProfileId: 995581,
      },
      currentStaffProfileId: 55,
    })).toBe(false);
  });

  test.each([
    'rm_review',
    'nwac_review',
    'returned_to_rm',
    'final_decision_recorded',
    'withdrawn',
  ])('keeps the assessment locked during %s', currentStage => {
    expect(canRegionalManagerEditApplicationAssessment({
      isRegionalManager: true,
      applicationStatus: 'in_review',
      reviewWorkflow: {
        currentStage,
        submittedByStaffProfileId: 55,
      },
      currentStaffProfileId: 55,
    })).toBe(false);
  });

  test('fails closed when a workflow exists without complete submitter lineage', () => {
    expect(canRegionalManagerEditApplicationAssessment({
      isRegionalManager: true,
      applicationStatus: 'in_review',
      reviewWorkflow: { currentStage: 'returned_to_submitter' },
      currentStaffProfileId: 55,
    })).toBe(false);

    expect(canRegionalManagerEditApplicationAssessment({
      isRegionalManager: true,
      applicationStatus: 'in_review',
      reviewWorkflow: { submittedByStaffProfileId: 55 },
      currentStaffProfileId: 55,
    })).toBe(false);
  });

  test('does not grant this Regional Manager exception to another role or application state', () => {
    expect(canRegionalManagerEditApplicationAssessment({
      isRegionalManager: false,
      applicationStatus: 'in_review',
      reviewWorkflow: null,
      currentStaffProfileId: 55,
    })).toBe(false);

    expect(canRegionalManagerEditApplicationAssessment({
      isRegionalManager: true,
      applicationStatus: 'pending_approval',
      reviewWorkflow: null,
      currentStaffProfileId: 55,
    })).toBe(false);
  });
});

describe('canEditApplicationAssessmentBody', () => {
  const returnedWorkflow = {
    current_stage: 'returned_to_submitter',
    submitted_by_staff_profile_id: 54,
  };

  test('allows the recorded Coordinator submitter and denies another Coordinator', () => {
    expect(canEditApplicationAssessmentBody({
      isAssessor: true,
      isRegionalManager: false,
      isSystemAdministrator: false,
      applicationStatus: 'in_review',
      reviewWorkflow: returnedWorkflow,
      currentStaffProfileId: 54,
    })).toBe(true);

    expect(canEditApplicationAssessmentBody({
      isAssessor: true,
      isRegionalManager: false,
      isSystemAdministrator: false,
      applicationStatus: 'in_review',
      reviewWorkflow: returnedWorkflow,
      currentStaffProfileId: 88,
    })).toBe(false);
  });

  test('allows the recorded dual-role Regional Manager submitter and denies another RM', () => {
    expect(canEditApplicationAssessmentBody({
      isAssessor: false,
      isRegionalManager: true,
      isSystemAdministrator: false,
      applicationStatus: 'in_review',
      reviewWorkflow: returnedWorkflow,
      currentStaffProfileId: 54,
    })).toBe(true);

    expect(canEditApplicationAssessmentBody({
      isAssessor: false,
      isRegionalManager: true,
      isSystemAdministrator: false,
      applicationStatus: 'in_review',
      reviewWorkflow: returnedWorkflow,
      currentStaffProfileId: 88,
    })).toBe(false);
  });

  test('preserves System Administrator support and no-workflow draft editing', () => {
    expect(canEditApplicationAssessmentBody({
      isAssessor: false,
      isRegionalManager: false,
      isSystemAdministrator: true,
      applicationStatus: 'in_review',
      reviewWorkflow: returnedWorkflow,
      currentStaffProfileId: 999,
    })).toBe(true);

    expect(canEditApplicationAssessmentBody({
      isAssessor: true,
      isRegionalManager: false,
      isSystemAdministrator: false,
      applicationStatus: 'in_review',
      reviewWorkflow: null,
      currentStaffProfileId: 88,
    })).toBe(true);

    expect(canEditApplicationAssessmentBody({
      isAssessor: false,
      isRegionalManager: true,
      isSystemAdministrator: false,
      applicationStatus: 'in_review',
      reviewWorkflow: null,
      currentStaffProfileId: 88,
    })).toBe(true);
  });
});
