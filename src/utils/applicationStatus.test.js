import {
  buildAssessmentDecisionAlignmentError,
  deriveAssessmentDecisionStatusFromAgreement,
  deriveAssessmentReviewStatusSelection,
  deriveApplicationDecisionOutcome,
} from './applicationStatus';

describe('deriveAssessmentReviewStatusSelection', () => {
  it('prefers the explicit stored review status when present', () => {
    expect(
      deriveAssessmentReviewStatusSelection({
        assessmentReviewStatus: 'reject',
        assessmentReview: 'agree',
        applicationStatus: 'approved',
        decisionOutcome: 'approved',
        caseStatus: 'initiated',
      })
    ).toBe('reject');
  });

  it('prefers the canonical denied outcome over a conflicting agree assurance', () => {
    expect(
      deriveAssessmentReviewStatusSelection({
        assessmentReviewStatus: null,
        assessmentReview: 'agree',
        applicationStatus: 'rejected',
        decisionOutcome: 'denied',
        caseStatus: 'closed',
      })
    ).toBe('reject');
  });

  it('falls back to the assurance value only when no canonical decision exists yet', () => {
    expect(
      deriveAssessmentReviewStatusSelection({
        assessmentReviewStatus: null,
        assessmentReview: 'agree',
        applicationStatus: 'pending_approval',
        decisionOutcome: null,
        caseStatus: 'open',
      })
    ).toBe('approve');
  });
});

describe('deriveApplicationDecisionOutcome', () => {
  it('returns denied for a rejected application status', () => {
    expect(
      deriveApplicationDecisionOutcome({
        applicationStatus: 'rejected',
        decisionOutcome: null,
        caseStatus: 'closed',
      })
    ).toBe('denied');
  });
});

describe('deriveAssessmentDecisionStatusFromAgreement', () => {
  it('defaults agreement with a no-funding recommendation to deny funding', () => {
    expect(
      deriveAssessmentDecisionStatusFromAgreement({
        recommendation: 'no_recommend',
        assessmentReview: 'agree',
      })
    ).toBe('reject');
  });

  it('defaults disagreement with a no-funding recommendation to approve funding', () => {
    expect(
      deriveAssessmentDecisionStatusFromAgreement({
        recommendation: 'no_recommend',
        assessmentReview: 'disagree',
      })
    ).toBe('approve');
  });
});

describe('buildAssessmentDecisionAlignmentError', () => {
  it('flags approve plus agreement with a no-funding recommendation as contradictory', () => {
    expect(
      buildAssessmentDecisionAlignmentError({
        recommendation: 'no_recommend',
        assessmentReview: 'agree',
        decisionStatus: 'approve',
      })
    ).toContain('conflicts');
  });

  it('allows deny plus agreement with a no-funding recommendation', () => {
    expect(
      buildAssessmentDecisionAlignmentError({
        recommendation: 'no_recommend',
        assessmentReview: 'agree',
        decisionStatus: 'reject',
      })
    ).toBe('');
  });
});
