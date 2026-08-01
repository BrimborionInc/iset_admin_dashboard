import { canRegionalManagerEditApplicationAssessment } from '../assessmentEditAccess';

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
