import {
  buildApplicationStatusInfo,
  buildAssessmentDecisionAlignmentError,
  deriveAssessmentDecisionStatusFromAgreement,
  deriveAssessmentReviewStatusSelection,
  deriveApplicationDecisionOutcome,
  getApplicationStatusLabel,
  mapWorkflowStatusToPersistenceStatus,
  resolveApplicationStateFields,
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

describe('resolveApplicationStateFields', () => {
  it('keeps raw status available when display status collapses to awaiting applicant', () => {
    expect(
      resolveApplicationStateFields({
        applicationStatus: 'closure_notice',
        applicationLifecycleStatus: 'awaiting_applicant',
        awaitingReason: 'closure_response',
      })
    ).toMatchObject({
      applicationStatusRaw: 'closure_notice',
      application_status_raw: 'closure_notice',
      applicationStatus: 'awaiting_applicant',
      application_status: 'awaiting_applicant',
    });
  });

  it('prefers explicit raw status when an already-normalized display status is also present', () => {
    expect(
      resolveApplicationStateFields({
        applicationStatusRaw: 'docs_requested',
        applicationStatus: 'awaiting_applicant',
        applicationLifecycleStatus: 'awaiting_applicant',
        awaitingReason: 'documents',
      })
    ).toMatchObject({
      applicationStatusRaw: 'docs_requested',
      applicationStatus: 'awaiting_applicant',
    });
  });
});

describe('withdrawn application status presentation', () => {
  it('preserves withdrawn as the persisted quick-action status', () => {
    expect(mapWorkflowStatusToPersistenceStatus('withdrawn')).toBe('withdrawn');
  });

  it('labels raw withdrawn applications as Withdrawn', () => {
    expect(getApplicationStatusLabel('withdrawn')).toBe('Withdrawn');
  });

  it('renders withdrawn closure records as Withdrawn while keeping closed lifecycle semantics', () => {
    const info = buildApplicationStatusInfo({
      applicationStatus: 'withdrawn',
      applicationLifecycleStatus: 'closed',
      closureReason: 'withdrawn',
      caseId: 123,
    });

    expect(info.rawStatus).toBe('closed');
    expect(info.statusLabel).toBe('Withdrawn');
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
